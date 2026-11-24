"""
ProductMind AI — Prioritization Background Worker Service
Provides automatic, non-blocking background AI prioritization of feature groups.
Triggers automatically whenever Module 5 clusters, creates, updates, or merges feature groups.
Handles Groq rate-limiting gracefully with bounded backoff, prevents duplicate runs,
and guarantees deterministic scoring even if AI is temporarily unavailable.
"""

import asyncio
from datetime import datetime, timezone
import logging
import re
from typing import Any, Dict, List, Optional, Set
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.ai.agents.prioritization import (
    PrioritizationAgent,
    PrioritizationService,
    AnalyzePrioritizationRequest,
)
from app.ai.exceptions import (
    AIRateLimitException,
    AITimeoutException,
    AIServiceException,
    AIProviderException,
)
from app.ai.llm_service import LLMService
from app.core.enums import PlatformRole
from app.database.collections import Collections
from app.models.auth import User
from app.models.planning import PrioritizationScenario
from app.repositories import (
    AnalyticsDailyRollupRepository,
    PrioritizationScenarioRepository,
    FeatureGroupRepository,
    FeedbackRepository,
    WorkspaceRepository,
    WorkspaceMembershipRepository,
)

logger = logging.getLogger("productmind.ai.prioritization.background")


class PrioritizationBackgroundWorker:
    """
    Central background worker that automatically prioritizes feature groups in the background.
    - Eliminates requirement for manual 'Run AI Prioritization' button click.
    - Prevents duplicate concurrent executions for the same workspace & feature group.
    - Paces LLM requests safely and applies backoff on Groq 429 rate limits.
    - Preserves deterministic scoring when AI is temporarily unavailable, marking status='failed'.
    """

    _instance: Optional["PrioritizationBackgroundWorker"] = None

    def __init__(self):
        self._lock = asyncio.Lock()
        self._active_jobs: Set[str] = set()  # Tracks "workspace_id:feature_group_id"
        self._task: Optional[asyncio.Task] = None
        self.spacing_delay_seconds: float = 1.5
        self.max_retries: int = 2

    @classmethod
    def get_instance(cls) -> "PrioritizationBackgroundWorker":
        if cls._instance is None:
            cls._instance = PrioritizationBackgroundWorker()
        return cls._instance

    def is_job_active(self, workspace_id: str, feature_group_id: Optional[str] = None) -> bool:
        key = f"{workspace_id}:{feature_group_id or '*'}"
        return key in self._active_jobs

    def trigger_auto_prioritization(
        self,
        db: AsyncIOMotorDatabase,
        workspace_id: str,
        feature_group_ids: Optional[List[str]] = None,
        force_reanalyze: bool = True,
    ) -> None:
        """
        Dispatches background task to prioritize eligible feature groups automatically.
        Safe to call fire-and-forget from endpoints, services, or background pipelines.
        """
        if not db or not workspace_id or not ObjectId.is_valid(str(workspace_id)):
            return

        loop = asyncio.get_event_loop()
        loop.create_task(
            self._execute_prioritization_job(
                db=db,
                workspace_id=str(workspace_id),
                feature_group_ids=[str(fid) for fid in feature_group_ids] if feature_group_ids else None,
                force_reanalyze=force_reanalyze,
            ),
            name=f"auto-prioritization-{workspace_id}",
        )

    async def _execute_prioritization_job(
        self,
        db: AsyncIOMotorDatabase,
        workspace_id: str,
        feature_group_ids: Optional[List[str]] = None,
        force_reanalyze: bool = True,
    ) -> None:
        """
        Executes prioritization for target groups with deduplication and rate-limit safety.
        """
        job_keys: List[str] = []
        if feature_group_ids:
            job_keys = [f"{workspace_id}:{fid}" for fid in feature_group_ids]
        else:
            job_keys = [f"{workspace_id}:*"]

        # Prevent duplicate overlapping jobs
        async with self._lock:
            for jk in job_keys:
                if jk in self._active_jobs:
                    logger.info("Prioritization job %s is already running. Skipping duplicate trigger.", jk)
                    return
            for jk in job_keys:
                self._active_jobs.add(jk)

        try:
            logger.info(
                "Auto-Prioritization triggered for workspace %s (target groups: %s)",
                workspace_id,
                feature_group_ids or "all eligible",
            )

            # Build service with real agent & repositories
            llm_service = LLMService()
            agent = PrioritizationAgent(llm_service=llm_service)
            service = PrioritizationService(
                agent=agent,
                prioritization_repo=PrioritizationScenarioRepository(db),
                feature_group_repo=FeatureGroupRepository(db),
                feedback_repo=FeedbackRepository(db),
                workspace_repo=WorkspaceRepository(db),
                membership_repo=WorkspaceMembershipRepository(db),
                analytics_rollup_repo=AnalyticsDailyRollupRepository(db),
            )

            # System execution user with Platform Admin privileges
            system_user = User(
                id=ObjectId(),
                email="system-prioritization-worker@productmind.ai",
                password_hash="internal_system_hash",
                name="AI Prioritization Worker",
                platform_role=PlatformRole.PLATFORM_ADMIN,
            )

            req = AnalyzePrioritizationRequest(
                workspace_id=workspace_id,
                feature_group_ids=feature_group_ids,
                force_reanalyze=force_reanalyze,
            )

            # Mark existing records as 'processing' so UI reflects active work
            ws_oid = ObjectId(workspace_id)
            prio_repo = PrioritizationScenarioRepository(db)
            if feature_group_ids:
                for fid in feature_group_ids:
                    if ObjectId.is_valid(fid):
                        await prio_repo.collection.update_many(
                            {"workspaceId": ws_oid, "featureGroupId": ObjectId(fid)},
                            {"$set": {"analysisStatus": "processing", "updatedAt": datetime.now(timezone.utc)}},
                        )

            # Execute analysis with controlled backoff for Groq rate limits
            attempts = 0
            success = False
            while attempts <= self.max_retries and not success:
                attempts += 1
                try:
                    res = await service.analyze_prioritization(request=req, user=system_user)
                    success = True
                    logger.info(
                        "Auto-Prioritization completed successfully for workspace %s: %d evaluated.",
                        workspace_id,
                        res.total_evaluated,
                    )
                except AIRateLimitException as rle:
                    wait_s = self._extract_wait_seconds(str(rle))
                    logger.warning(
                        "Groq rate limit hit during auto-prioritization (attempt %d/%d). Sleeping %0.1fs...",
                        attempts,
                        self.max_retries + 1,
                        wait_s,
                    )
                    if attempts <= self.max_retries:
                        await asyncio.sleep(wait_s)
                    else:
                        logger.error("Auto-prioritization exceeded max retries due to rate limits.")
                        await self._mark_failed(db, workspace_id, feature_group_ids, str(rle))
                except Exception as exc:
                    logger.exception("Auto-prioritization failed: %s", exc)
                    await self._mark_failed(db, workspace_id, feature_group_ids, str(exc))
                    break

        finally:
            async with self._lock:
                for jk in job_keys:
                    self._active_jobs.discard(jk)

    async def _mark_failed(
        self,
        db: AsyncIOMotorDatabase,
        workspace_id: str,
        feature_group_ids: Optional[List[str]],
        error_msg: str,
    ) -> None:
        """Marks target prioritization records as failed so the PM sees accurate status."""
        try:
            ws_oid = ObjectId(workspace_id)
            query: Dict[str, Any] = {"workspaceId": ws_oid}
            if feature_group_ids:
                valid_foids = [ObjectId(f) for f in feature_group_ids if ObjectId.is_valid(f)]
                if valid_foids:
                    query["featureGroupId"] = {"$in": valid_foids}

            await db[Collections.PRIORITIZATION_SCENARIOS if hasattr(Collections, 'PRIORITIZATION_SCENARIOS') else "prioritization_scenarios"].update_many(
                query,
                {
                    "$set": {
                        "analysisStatus": "failed",
                        "errorMessage": error_msg[:500],
                        "updatedAt": datetime.now(timezone.utc),
                    }
                },
            )
        except Exception as e:
            logger.warning("Could not mark prioritization status as failed: %s", e)

    def _extract_wait_seconds(self, err_text: str) -> float:
        match = re.search(r"try again in ([\d\.]+)s", err_text, re.IGNORECASE)
        if match:
            try:
                return min(30.0, max(2.0, float(match.group(1)) + 1.0))
            except Exception:
                pass
        return 10.0
