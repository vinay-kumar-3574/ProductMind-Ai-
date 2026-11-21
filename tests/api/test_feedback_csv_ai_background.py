"""
Unit and integration tests for Module 2:
Automatic AI Analysis for CSV Uploads, Background Worker, Persistent MongoDB States,
Rate-Limit Backoff, and Recovery across Restarts.
"""

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from bson import ObjectId

from app.core.enums import FeedbackCategory, FeedbackPriority, FeedbackSentiment, FeedbackSourceType, PlatformRole, MembershipStatus, UserRole
from app.models.auth import User, Workspace, WorkspaceMembership
from app.models.feedback import FeedbackBatch, FeedbackItem
from app.repositories import FeedbackRepository, FeedbackBatchRepository
from app.services.feedback_ai_background import FeedbackAIBackgroundWorker
from app.ai.exceptions import AIRateLimitException, AIServiceException


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.feedback_items = MagicMock()
    db.feedback_batches = MagicMock()
    return db


@pytest.mark.asyncio
async def test_background_worker_singleton():
    """Worker provides a singleton instance."""
    w1 = FeedbackAIBackgroundWorker.get_instance()
    w2 = FeedbackAIBackgroundWorker.get_instance()
    assert w1 is w2


@pytest.mark.asyncio
async def test_worker_extract_wait_seconds():
    """Worker parses retry wait duration from rate limit message correctly."""
    worker = FeedbackAIBackgroundWorker.get_instance()
    # Explicit 'try again in Xs'
    assert worker._extract_wait_seconds("Rate limit reached: Please try again in 14.5s.") == 15.5
    # Capped at minimum 5.0s
    assert worker._extract_wait_seconds("try again in 1.2s") == 5.0
    # Capped at maximum 45.0s
    assert worker._extract_wait_seconds("try again in 80s") == 45.0
    # Fallback default
    assert worker._extract_wait_seconds("Rate limit exceeded") == 20.0


@pytest.mark.asyncio
async def test_worker_recover_interrupted_tasks():
    """Worker recovers items stuck in 'analyzing' state on startup."""
    worker = FeedbackAIBackgroundWorker.get_instance()
    db = MagicMock()

    with patch.object(FeedbackRepository, "recover_interrupted_items", new_callable=AsyncMock) as mock_recover, \
         patch.object(FeedbackRepository, "claim_next_queued_item", new_callable=AsyncMock) as mock_claim:
        mock_recover.return_value = 3
        mock_claim.return_value = None

        recovered = await worker.recover_and_resume(db)
        assert recovered == 3
        mock_recover.assert_called_once()


@pytest.mark.asyncio
async def test_worker_reuses_cached_ai_analysis():
    """Worker does not invoke LLM if feedback item already contains cached analysis."""
    worker = FeedbackAIBackgroundWorker.get_instance()
    db = MagicMock()

    existing_item = FeedbackItem(
        id=ObjectId(),
        workspace_id=ObjectId(),
        title="Speed issue on dashboard",
        description="Takes 5 seconds to load",
        ai_analysis={"category": "Performance", "sentiment": "Negative"},
        ai_status="queued",
    )

    with patch.object(FeedbackRepository, "claim_next_queued_item", new_callable=AsyncMock) as mock_claim, \
         patch.object(FeedbackRepository, "update_ai_status", new_callable=AsyncMock) as mock_update:
        # First call returns the item, second call returns None to terminate loop
        mock_claim.side_effect = [existing_item, None]

        # Temporarily zero spacing delay for fast test execution
        orig_delay = worker.spacing_delay_seconds
        worker.spacing_delay_seconds = 0.0

        try:
            await worker._process_queue_loop(db)
            mock_update.assert_called_with(existing_item.id, existing_item.workspace_id, "completed")
        finally:
            worker.spacing_delay_seconds = orig_delay


@pytest.mark.asyncio
async def test_worker_handles_429_rate_limit_backoff():
    """Worker applies bounded retry and marks rate_limited when 429 persists."""
    worker = FeedbackAIBackgroundWorker.get_instance()
    db = MagicMock()

    item_to_process = FeedbackItem(
        id=ObjectId(),
        workspace_id=ObjectId(),
        title="Crash on export",
        description="CSV export crashes when rows > 1000",
        ai_analysis=None,
        ai_status="queued",
    )

    with patch.object(FeedbackRepository, "claim_next_queued_item", new_callable=AsyncMock) as mock_claim, \
         patch.object(FeedbackRepository, "update_ai_status", new_callable=AsyncMock) as mock_update, \
         patch("app.services.feedback_ai_background.FeedbackIntelligenceService.analyze_feedback_item", new_callable=AsyncMock) as mock_analyze, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        
        mock_claim.side_effect = [item_to_process, None]
        # Always raise 429 rate limit
        mock_analyze.side_effect = AIRateLimitException("Rate limit reached. Please try again in 5.0s.")

        orig_delay = worker.spacing_delay_seconds
        worker.spacing_delay_seconds = 0.0

        try:
            await worker._process_queue_loop(db)
            # Item should be marked 'rate_limited' after retries exhausted
            mock_update.assert_called_with(
                item_to_process.id,
                item_to_process.workspace_id,
                "rate_limited",
                ai_error="Groq free-tier rate limit reached. Retry available.",
            )
            assert mock_sleep.called
        finally:
            worker.spacing_delay_seconds = orig_delay


@pytest.mark.asyncio
async def test_worker_isolates_individual_failures():
    """A failure on one item does not halt the queue; it marks item failed and continues."""
    worker = FeedbackAIBackgroundWorker.get_instance()
    db = MagicMock()

    item1 = FeedbackItem(
        id=ObjectId(),
        workspace_id=ObjectId(),
        title="Broken Item",
        description="Unparsable content",
        ai_status="queued",
    )
    item2 = FeedbackItem(
        id=ObjectId(),
        workspace_id=ObjectId(),
        title="Good Item",
        description="Regular usable feedback",
        ai_status="queued",
    )

    with patch.object(FeedbackRepository, "claim_next_queued_item", new_callable=AsyncMock) as mock_claim, \
         patch.object(FeedbackRepository, "update_ai_status", new_callable=AsyncMock) as mock_update, \
         patch("app.services.feedback_ai_background.FeedbackIntelligenceService.analyze_feedback_item", new_callable=AsyncMock) as mock_analyze:

        mock_claim.side_effect = [item1, item2, None]
        # item1 fails with generic error, item2 succeeds
        mock_analyze.side_effect = [AIServiceException("Model syntax failure"), MagicMock()]

        orig_delay = worker.spacing_delay_seconds
        worker.spacing_delay_seconds = 0.0

        try:
            await worker._process_queue_loop(db)
            # Verify item1 was marked as 'failed'
            failed_calls = [
                c for c in mock_update.call_args_list
                if c[0][0] == item1.id and c[0][2] == "failed"
            ]
            assert len(failed_calls) == 1
            assert "Model syntax failure" in failed_calls[0][1]["ai_error"]
        finally:
            worker.spacing_delay_seconds = orig_delay


@pytest.mark.asyncio
async def test_batch_ai_summary_aggregation():
    """FeedbackRepository aggregates batch AI statuses correctly."""
    db = MagicMock()
    repo = FeedbackRepository(db)

    batch_id = ObjectId()
    workspace_id = ObjectId()

    # Mock aggregate output
    mock_cursor = MagicMock()
    mock_cursor.to_list = AsyncMock(return_value=[
        {"_id": "completed", "count": 8},
        {"_id": "queued", "count": 2},
        {"_id": "analyzing", "count": 1},
        {"_id": "rate_limited", "count": 1},
        {"_id": "failed", "count": 0},
    ])
    repo.collection.aggregate = MagicMock(return_value=mock_cursor)

    summary = await repo.get_batch_ai_summary(batch_id, workspace_id)
    assert summary["completed"] == 8
    assert summary["queued"] == 2
    assert summary["analyzing"] == 1
    assert summary["rate_limited"] == 1
    assert summary["failed"] == 0
