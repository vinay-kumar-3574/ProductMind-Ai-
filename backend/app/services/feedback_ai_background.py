"""
ProductMind AI — Feedback AI Background Worker Service
Provides persistent, MongoDB-backed background processing for feedback AI analysis,
specifically designed for CSV batch imports, automatic rate-limit throttling,
bounded backoff retries, and cross-restart durability.
"""

import asyncio
from datetime import datetime, timezone
import logging
import re
from typing import Any, Dict, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.ai.agents.feedback_intelligence import (
    FeedbackIntelligenceAgent,
    FeedbackIntelligenceService,
)
from app.ai.exceptions import (
    AIRateLimitException,
    AITimeoutException,
    AIServiceException,
    AIProviderException,
)
from app.ai.llm_service import LLMService
from app.core.enums import FeedbackProcessingStatus, PlatformRole
from app.models.auth import User
from app.models.feedback import FeedbackItem
from app.repositories import (
    FeedbackRepository,
    FeedbackBatchRepository,
    WorkspaceRepository,
    WorkspaceMembershipRepository,
)

logger = logging.getLogger("productmind.ai.background")


class FeedbackAIBackgroundWorker:
    """
    Central background worker that drains queued feedback items from MongoDB Atlas.
    Enforces strict serial processing, Groq free-tier rate limit pacing,
    bounded backoff on 429, and automatic recovery across backend restarts.
    """

    _instance: Optional["FeedbackAIBackgroundWorker"] = None

    def __init__(self):
        self._lock = asyncio.Lock()
        self._is_processing = False
        self._task: Optional[asyncio.Task] = None
        self.spacing_delay_seconds: float = 2.0  # Safe pacing between consecutive LLM calls
        self.max_retries_per_item: int = 2

    @classmethod
    def get_instance(cls) -> "FeedbackAIBackgroundWorker":
        if cls._instance is None:
            cls._instance = FeedbackAIBackgroundWorker()
        return cls._instance

    def is_running(self) -> bool:
        return self._is_processing

    def trigger_worker(
        self,
        db: AsyncIOMotorDatabase,
        workspace_id: Optional[Any] = None,
        batch_id: Optional[Any] = None,
    ) -> None:
        """
        Triggers queue processing asynchronously in the background.
        If worker is already running, it will naturally pick up newly queued items.
        """
        if self._is_processing:
            logger.info("Feedback AI Background Worker is already active; queued items will be processed.")
            return

        loop = asyncio.get_event_loop()
        self._task = loop.create_task(
            self._process_queue_loop(db, workspace_id, batch_id),
            name="feedback-ai-queue-worker",
        )

    async def recover_and_resume(self, db: AsyncIOMotorDatabase) -> int:
        """
        Invoked during FastAPI lifespan startup:
        1. Resets any orphaned 'analyzing' items (from previous shutdown) back to 'queued'.
        2. Drains any pending 'queued' items in MongoDB.
        """
        if db is None:
            return 0
        repo = FeedbackRepository(db)
        recovered_count = await repo.recover_interrupted_items()
        if recovered_count > 0:
            logger.info("Recovered %d interrupted feedback items back to 'queued' state.", recovered_count)

        # Check if there are queued items needing processing
        queued_item = await repo.claim_next_queued_item()
        if queued_item:
            # Re-queue the claimed item so the worker loop picks it up properly
            await repo.update_ai_status(queued_item.id, queued_item.workspace_id, "queued")
            logger.info("Found pending queued feedback items on startup. Resuming background processing...")
            self.trigger_worker(db)

        return recovered_count

    async def _process_queue_loop(
        self,
        db: AsyncIOMotorDatabase,
        workspace_id: Optional[Any] = None,
        batch_id: Optional[Any] = None,
    ) -> None:
        """
        Main worker loop: pulls and executes items until the queue is completely drained.
        """
        if self._is_processing:
            return

        async with self._lock:
            self._is_processing = True
            logger.info("Feedback AI Background Worker started draining queue.")
            feedback_repo = FeedbackRepository(db)
            batch_repo = FeedbackBatchRepository(db)
            workspace_repo = WorkspaceRepository(db)
            membership_repo = WorkspaceMembershipRepository(db)

            # Build service with repositories and real agent
            llm_service = LLMService()
            agent = FeedbackIntelligenceAgent(llm_service=llm_service)
            service = FeedbackIntelligenceService(
                agent=agent,
                feedback_repo=feedback_repo,
                workspace_repo=workspace_repo,
                membership_repo=membership_repo,
            )

            try:
                consecutive_rate_limits = 0

                while True:
                    # Claim next available item atomically
                    item = await feedback_repo.claim_next_queued_item(
                        workspace_id=workspace_id,
                        batch_id=batch_id,
                    )
                    if not item:
                        # Queue is completely drained
                        logger.info("Feedback AI Background Worker finished: no more queued items.")
                        break

                    f_id_str = str(item.id)
                    ws_id_str = str(item.workspace_id)
                    logger.info("Processing feedback item for AI: [%s] '%s'", f_id_str, item.title[:40])

                    # 1. Check if already has cached valid analysis
                    if item.ai_analysis:
                        logger.info("Feedback item [%s] already has cached AI analysis. Reusing without LLM call.", f_id_str)
                        await feedback_repo.update_ai_status(item.id, item.workspace_id, "completed")
                        continue

                    # 2. Attempt AI analysis with controlled backoff retry
                    success = False
                    attempts = 0

                    while attempts <= self.max_retries_per_item and not success:
                        attempts += 1
                        try:
                            # Build dummy system user for workspace authorization
                            system_user = User(
                                id=ObjectId(),
                                email="system-worker@productmind.ai",
                                password_hash="system_worker_internal_hash",
                                name="AI Background Worker",
                                platform_role=PlatformRole.PLATFORM_ADMIN,
                            )

                            await service.analyze_feedback_item(
                                feedback_id=f_id_str,
                                user=system_user,
                                force_reanalyze=False,
                            )
                            success = True
                            consecutive_rate_limits = 0
                            logger.info("Feedback item [%s] AI analysis completed successfully.", f_id_str)

                        except AIRateLimitException as rle:
                            consecutive_rate_limits += 1
                            wait_s = self._extract_wait_seconds(str(rle))
                            logger.warning(
                                "Rate limit encountered on item [%s] (attempt %d/%d). Sleeping %0.1fs before retry...",
                                f_id_str,
                                attempts,
                                self.max_retries_per_item + 1,
                                wait_s,
                            )
                            if attempts <= self.max_retries_per_item:
                                await asyncio.sleep(wait_s)
                            else:
                                logger.error("Item [%s] exceeded max rate-limit retries. Marking as 'rate_limited'.", f_id_str)
                                await feedback_repo.update_ai_status(
                                    item.id,
                                    item.workspace_id,
                                    "rate_limited",
                                    ai_error="Groq free-tier rate limit reached. Retry available.",
                                )

                        except Exception as exc:
                            err_msg = str(exc)[:200]
                            logger.error("Feedback item [%s] AI analysis failed: %s", f_id_str, err_msg)
                            await feedback_repo.update_ai_status(
                                item.id,
                                item.workspace_id,
                                "failed",
                                ai_error=err_msg,
                            )
                            break

                    # If too many consecutive rate limits across items, pause queue to prevent thrashing
                    if consecutive_rate_limits >= 3:
                        logger.warning("Multiple consecutive rate limits detected (3). Pausing background worker for 30s...")
                        await asyncio.sleep(30.0)
                        consecutive_rate_limits = 0

                    # Spacing delay between consecutive requests to protect Groq TPM/RPM limits
                    if self.spacing_delay_seconds > 0:
                        await asyncio.sleep(self.spacing_delay_seconds)

                    # Update batch status if applicable
                    if item.batch_id:
                        await self._sync_batch_status(batch_repo, feedback_repo, item.batch_id, item.workspace_id)

            except Exception as loop_exc:
                logger.exception("Unexpected error in Feedback AI Background Worker loop: %s", loop_exc)
            finally:
                self._is_processing = False

    async def _sync_batch_status(
        self,
        batch_repo: FeedbackBatchRepository,
        feedback_repo: FeedbackRepository,
        batch_id: Any,
        workspace_id: Any,
    ) -> None:
        """Syncs FeedbackBatch status based on active item AI completion."""
        try:
            summary = await feedback_repo.get_batch_ai_summary(batch_id, workspace_id)
            if summary.get("queued", 0) == 0 and summary.get("analyzing", 0) == 0:
                # All items in batch have finished processing
                final_batch_status = "completed" if summary.get("failed", 0) == 0 and summary.get("rate_limited", 0) == 0 else "partial"
                await batch_repo.update(
                    batch_id,
                    {
                        "status": final_batch_status,
                        "completedAt": datetime.now(timezone.utc),
                    },
                    workspace_id=workspace_id,
                )
        except Exception as e:
            logger.warning("Could not sync batch status for %s: %s", batch_id, e)

    def _extract_wait_seconds(self, message: str) -> float:
        """Extracts retry-after seconds from rate limit message if present."""
        match = re.search(r"try again in ([\d\.]+)s", message, re.IGNORECASE)
        if match:
            try:
                val = float(match.group(1)) + 1.0
                return min(max(val, 5.0), 45.0)
            except (ValueError, TypeError):
                pass
        return 20.0
