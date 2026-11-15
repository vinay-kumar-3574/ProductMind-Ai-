"""
ProductMind AI — Roadmap & Product Roadmap Repositories Live Tests
Tests ProductRoadmapRepository and RoadmapRepository against MongoDB Atlas:
indexing, multi-tenant isolation, query filtering, and optimistic concurrency.
"""

from datetime import datetime, timezone
from bson import ObjectId
import pytest

from app.models.planning import ProductRoadmap, RoadmapItem
from app.core.enums import (
    ProductRoadmapType,
    RoadmapTimeHorizon,
    ProductRoadmapStatus,
    RoadmapStatus,
    FeedbackPriority,
)
from app.repositories import ProductRoadmapRepository, RoadmapRepository


@pytest.mark.asyncio
async def test_product_roadmap_repository_lifecycle(async_db):
    """Verifies ProductRoadmap container CRUD, compound indexing, and optimistic concurrency."""
    repo = ProductRoadmapRepository(async_db)
    await repo.ensure_indexes()

    test_ws_id = ObjectId()
    doc = ProductRoadmap(
        workspace_id=test_ws_id,
        title="2027 Long-Range Strategy",
        description="Multi-horizon execution roadmap",
        roadmap_type=ProductRoadmapType.STRATEGIC,
        time_horizon=RoadmapTimeHorizon.YEARLY,
        status=ProductRoadmapStatus.ACTIVE,
        is_default=True,
        version="1.0.0",
        created_by="Staff Architect",
    )

    created = await repo.create_roadmap(doc)
    assert created.id is not None
    assert created.title == "2027 Long-Range Strategy"
    assert created.version == "1.0.0"

    try:
        # Retrieve by workspace and ID
        fetched = await repo.find_by_id_and_workspace(created.id, test_ws_id)
        assert fetched is not None
        assert fetched.title == created.title

        # Query by workspace
        roadmaps = await repo.find_by_workspace(test_ws_id, status=ProductRoadmapStatus.ACTIVE)
        assert len(roadmaps) == 1
        assert roadmaps[0].id == created.id

        # Optimistic concurrency update
        updated, conflict = await repo.update_with_optimistic_concurrency(
            created.id,
            test_ws_id,
            update_data={"title": "2027 Core Architecture Roadmap", "version": "1.0.1"},
            expected_version="1.0.0",
        )
        assert not conflict
        assert updated.title == "2027 Core Architecture Roadmap"
        assert updated.version == "1.0.1"

        # Stale version update conflict
        _, conflict = await repo.update_with_optimistic_concurrency(
            created.id,
            test_ws_id,
            update_data={"title": "Concurrent Edit"},
            expected_version="1.0.0",  # Stale: version is already 1.0.1
        )
        assert conflict is True

        # Archive roadmap
        archived = await repo.archive_roadmap(created.id, test_ws_id)
        assert archived is not None
        assert archived.status == ProductRoadmapStatus.ARCHIVED

    finally:
        # Cleanup
        await repo.collection.delete_many({"workspaceId": test_ws_id})


@pytest.mark.asyncio
async def test_roadmap_item_repository_lifecycle(async_db):
    """Verifies RoadmapItem CRUD, date range queries, PRD linkage, and optimistic concurrency."""
    repo = RoadmapRepository(async_db)
    await repo.ensure_indexes()

    test_ws_id = ObjectId()
    test_rm_id = ObjectId()
    test_prd_id = ObjectId()
    test_fg_id = ObjectId()

    item = RoadmapItem(
        workspace_id=test_ws_id,
        roadmap_id=test_rm_id,
        prd_id=test_prd_id,
        feature_group_id=test_fg_id,
        title="Zero-Downtime Migration Pipeline",
        description="Stream records with replica sync",
        status=RoadmapStatus.PLANNED,
        priority=FeedbackPriority.HIGH,
        priority_score=89.5,
        is_committed=True,
        owner="Staff PM",
        start_date="2026-10-01",
        target_date="2026-11-15",
        milestone="Phase 1: Foundation",
        progress=0.0,
        dependencies=[],
        notes="Approved deliverable",
        version="1.0.0",
    )

    created = await repo.create(item)
    assert created.id is not None
    assert created.is_committed is True

    try:
        # Find by PRD
        prd_items = await repo.find_by_prd(test_ws_id, test_prd_id)
        assert len(prd_items) == 1
        assert prd_items[0].id == created.id

        # Find by feature group
        fg_items = await repo.find_by_feature_group(test_ws_id, test_fg_id)
        assert len(fg_items) == 1
        assert fg_items[0].id == created.id

        # Find by commitment status
        committed_items = await repo.find_by_commitment_status(test_ws_id, is_committed=True)
        assert len(committed_items) == 1

        # Find by date range
        range_items = await repo.find_by_date_range(
            test_ws_id,
            start_date="2026-09-01",
            end_date="2026-12-01",
        )
        assert len(range_items) == 1

        # Optimistic concurrency update
        updated, conflict = await repo.update_with_optimistic_concurrency(
            created.id,
            test_ws_id,
            update_data={"progress": 25.0, "status": "In Progress", "version": "1.0.1"},
            expected_version="1.0.0",
        )
        assert not conflict
        assert updated.progress == 25.0
        assert updated.status == RoadmapStatus.IN_PROGRESS

        # Stale conflict test
        _, conflict = await repo.update_with_optimistic_concurrency(
            created.id,
            test_ws_id,
            update_data={"progress": 50.0},
            expected_version="1.0.0",  # Stale: already 1.0.1
        )
        assert conflict is True

    finally:
        # Cleanup
        await repo.collection.delete_many({"workspaceId": test_ws_id})
