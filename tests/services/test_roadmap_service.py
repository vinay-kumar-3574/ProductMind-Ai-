"""
ProductMind AI — Roadmap Service Unit Tests
Tests ProductRoadmap and RoadmapItem business logic, workspace authorization,
optimistic concurrency control (409 Conflict), and validation rules.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId
import pytest
from fastapi import HTTPException, status

from app.models.auth import User, Workspace, WorkspaceMembership
from app.models.planning import ProductRoadmap, RoadmapItem
from app.core.enums import (
    PlatformRole,
    MembershipStatus,
    RoadmapStatus,
    FeedbackPriority,
    ProductRoadmapType,
    RoadmapTimeHorizon,
    ProductRoadmapStatus,
)
from app.schemas.roadmap import (
    ProductRoadmapCreate,
    ProductRoadmapUpdate,
    RoadmapItemCreate,
    RoadmapItemUpdate,
)
from app.services.roadmap_service import RoadmapService, bump_semver


@pytest.fixture
def mock_user():
    return User(
        id=ObjectId("660011223344556677889901"),
        name="Lead PM",
        email="lead.pm@productmind.ai",
        password_hash="mock_hash",
        platform_role=PlatformRole.USER,
        is_active=True,
    )


@pytest.fixture
def mock_intruder_user():
    return User(
        id=ObjectId("660011223344556677889999"),
        name="Intruder User",
        email="intruder@productmind.ai",
        password_hash="mock_hash",
        platform_role=PlatformRole.USER,
        is_active=True,
    )


@pytest.fixture
def mock_workspace():
    return Workspace(
        id=ObjectId("660011223344556677889902"),
        name="Core SaaS Workspace",
        slug="core-saas-ws",
        owner_id=ObjectId("660011223344556677889901"),
    )


@pytest.fixture
def sample_roadmap(mock_workspace, mock_user):
    return ProductRoadmap(
        id=ObjectId("660011223344556677889910"),
        workspace_id=mock_workspace.id,
        title="2026 Core Delivery Roadmap",
        description="Strategic cross-functional execution plan",
        roadmap_type=ProductRoadmapType.PRODUCT,
        time_horizon=RoadmapTimeHorizon.QUARTERLY,
        status=ProductRoadmapStatus.ACTIVE,
        is_default=True,
        created_by=mock_user.name,
        creator_id=mock_user.id,
        version="1.0.0",
    )


@pytest.fixture
def sample_item(mock_workspace, sample_roadmap, mock_user):
    return RoadmapItem(
        id=ObjectId("660011223344556677889920"),
        workspace_id=mock_workspace.id,
        roadmap_id=sample_roadmap.id,
        title="Streaming CSV Exporter",
        description="Bounded memory export pipeline",
        status=RoadmapStatus.PLANNED,
        priority=FeedbackPriority.HIGH,
        priority_score=88.5,
        is_committed=False,
        owner=mock_user.name,
        owner_id=mock_user.id,
        start_date="2026-10-01",
        target_date="2026-11-15",
        actual_start_date=None,
        actual_end_date=None,
        milestone="Q4 Foundation",
        progress=0.0,
        dependencies=[],
        notes="Awaiting engineering sprint allocation",
        version="1.0.0",
    )


@pytest.fixture
def roadmap_service(mock_workspace):
    rm_repo = AsyncMock()
    prod_rm_repo = AsyncMock()
    ws_repo = AsyncMock()
    mem_repo = AsyncMock()

    ws_repo.find_by_id = AsyncMock(return_value=mock_workspace)
    mem_repo.find_membership = AsyncMock(
        return_value=WorkspaceMembership(
            workspace_id=mock_workspace.id,
            user_id=ObjectId("660011223344556677889901"),
            status=MembershipStatus.ACTIVE,
        )
    )

    return RoadmapService(
        roadmap_repo=rm_repo,
        product_roadmap_repo=prod_rm_repo,
        workspace_repo=ws_repo,
        membership_repo=mem_repo,
    )


# ===========================================================================
# ProductRoadmap Container Tests
# ===========================================================================

@pytest.mark.asyncio
async def test_create_product_roadmap_success(roadmap_service, mock_user, mock_workspace, sample_roadmap):
    roadmap_service.product_roadmap_repo.create_roadmap = AsyncMock(return_value=sample_roadmap)

    req = ProductRoadmapCreate(
        title="2026 Core Delivery Roadmap",
        description="Strategic cross-functional execution plan",
        roadmapType=ProductRoadmapType.PRODUCT,
        timeHorizon=RoadmapTimeHorizon.QUARTERLY,
        status=ProductRoadmapStatus.ACTIVE,
        isDefault=True,
    )

    resp = await roadmap_service.create_roadmap(str(mock_workspace.id), req, mock_user)
    assert resp.title == "2026 Core Delivery Roadmap"
    assert resp.roadmap_type == ProductRoadmapType.PRODUCT
    assert resp.version == "1.0.0"
    assert resp.item_count == 0


@pytest.mark.asyncio
async def test_list_product_roadmaps(roadmap_service, mock_user, mock_workspace, sample_roadmap):
    roadmap_service.product_roadmap_repo.find_by_workspace = AsyncMock(return_value=[sample_roadmap])
    roadmap_service.product_roadmap_repo.count_by_workspace = AsyncMock(return_value=1)
    roadmap_service.roadmap_repo.count_by_roadmap = AsyncMock(return_value=5)

    resp = await roadmap_service.list_roadmaps(str(mock_workspace.id), mock_user)
    assert resp.total == 1
    assert len(resp.items) == 1
    assert resp.items[0].item_count == 5


@pytest.mark.asyncio
async def test_get_product_roadmap_success(roadmap_service, mock_user, mock_workspace, sample_roadmap):
    roadmap_service.product_roadmap_repo.find_by_id_and_workspace = AsyncMock(return_value=sample_roadmap)
    roadmap_service.roadmap_repo.count_by_roadmap = AsyncMock(return_value=3)

    resp = await roadmap_service.get_roadmap(str(mock_workspace.id), str(sample_roadmap.id), mock_user)
    assert resp.id == str(sample_roadmap.id)
    assert resp.item_count == 3


@pytest.mark.asyncio
async def test_get_product_roadmap_not_found(roadmap_service, mock_user, mock_workspace):
    roadmap_service.product_roadmap_repo.find_by_id_and_workspace = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc_info:
        await roadmap_service.get_roadmap(str(mock_workspace.id), str(ObjectId()), mock_user)
    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_update_product_roadmap_optimistic_concurrency_conflict(
    roadmap_service, mock_user, mock_workspace, sample_roadmap
):
    # Current version is 1.0.0, but client sends expected_version = 0.9.0
    roadmap_service.product_roadmap_repo.find_by_id_and_workspace = AsyncMock(return_value=sample_roadmap)

    req = ProductRoadmapUpdate(
        title="Updated Title",
        expectedVersion="0.9.0",
    )

    with pytest.raises(HTTPException) as exc_info:
        await roadmap_service.update_roadmap(str(mock_workspace.id), str(sample_roadmap.id), req, mock_user)
    assert exc_info.value.status_code == status.HTTP_409_CONFLICT
    assert "Concurrent update conflict" in exc_info.value.detail


@pytest.mark.asyncio
async def test_update_product_roadmap_success_and_version_bump(
    roadmap_service, mock_user, mock_workspace, sample_roadmap
):
    roadmap_service.product_roadmap_repo.find_by_id_and_workspace = AsyncMock(return_value=sample_roadmap)
    updated_roadmap = sample_roadmap.model_copy()
    updated_roadmap.title = "Refined Roadmap Title"
    updated_roadmap.version = "1.0.1"
    roadmap_service.product_roadmap_repo.update_with_optimistic_concurrency = AsyncMock(
        return_value=(updated_roadmap, False)
    )
    roadmap_service.roadmap_repo.count_by_roadmap = AsyncMock(return_value=2)

    req = ProductRoadmapUpdate(
        title="Refined Roadmap Title",
        expectedVersion="1.0.0",
    )

    resp = await roadmap_service.update_roadmap(str(mock_workspace.id), str(sample_roadmap.id), req, mock_user)
    assert resp.title == "Refined Roadmap Title"
    assert resp.version == "1.0.1"


@pytest.mark.asyncio
async def test_archive_product_roadmap(roadmap_service, mock_user, mock_workspace, sample_roadmap):
    archived_rm = sample_roadmap.model_copy()
    archived_rm.status = ProductRoadmapStatus.ARCHIVED
    roadmap_service.product_roadmap_repo.archive_roadmap = AsyncMock(return_value=archived_rm)
    roadmap_service.roadmap_repo.count_by_roadmap = AsyncMock(return_value=0)

    resp = await roadmap_service.archive_roadmap(str(mock_workspace.id), str(sample_roadmap.id), mock_user)
    assert resp.status == ProductRoadmapStatus.ARCHIVED


# ===========================================================================
# RoadmapItem Management Tests
# ===========================================================================

@pytest.mark.asyncio
async def test_create_roadmap_item_success(
    roadmap_service, mock_user, mock_workspace, sample_roadmap, sample_item
):
    roadmap_service.product_roadmap_repo.find_by_id_and_workspace = AsyncMock(return_value=sample_roadmap)
    roadmap_service.roadmap_repo.create = AsyncMock(return_value=sample_item)

    req = RoadmapItemCreate(
        roadmapId=str(sample_roadmap.id),
        title="Streaming CSV Exporter",
        description="Bounded memory export pipeline",
        status=RoadmapStatus.PLANNED,
        priority=FeedbackPriority.HIGH,
        priorityScore=88.5,
        isCommitted=False,
        startDate="2026-10-01",
        targetDate="2026-11-15",
        milestone="Q4 Foundation",
        progress=0.0,
    )

    resp = await roadmap_service.create_item(str(mock_workspace.id), req, mock_user)
    assert resp.title == "Streaming CSV Exporter"
    assert resp.priority_score == 88.5
    assert resp.status == RoadmapStatus.PLANNED
    assert resp.version == "1.0.0"


@pytest.mark.asyncio
async def test_create_roadmap_item_rejects_archived_parent_roadmap(
    roadmap_service, mock_user, mock_workspace, sample_roadmap
):
    archived_rm = sample_roadmap.model_copy()
    archived_rm.status = ProductRoadmapStatus.ARCHIVED
    roadmap_service.product_roadmap_repo.find_by_id_and_workspace = AsyncMock(return_value=archived_rm)

    req = RoadmapItemCreate(
        roadmapId=str(sample_roadmap.id),
        title="New Item for Dead Roadmap",
        startDate="2026-10-01",
        targetDate="2026-11-15",
    )

    with pytest.raises(HTTPException) as exc_info:
        await roadmap_service.create_item(str(mock_workspace.id), req, mock_user)
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "archived roadmap" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_update_roadmap_item_optimistic_concurrency_conflict(
    roadmap_service, mock_user, mock_workspace, sample_item
):
    roadmap_service.roadmap_repo.find_by_workspace_and_item = AsyncMock(return_value=sample_item)

    req = RoadmapItemUpdate(
        title="Overwriting Edit",
        expectedVersion="0.9.0",  # Stale! Current is 1.0.0
    )

    with pytest.raises(HTTPException) as exc_info:
        await roadmap_service.update_item(str(mock_workspace.id), str(sample_item.id), req, mock_user)
    assert exc_info.value.status_code == status.HTTP_409_CONFLICT
    assert "Concurrent update conflict" in exc_info.value.detail


@pytest.mark.asyncio
async def test_update_roadmap_item_rejects_actual_end_before_start(
    roadmap_service, mock_user, mock_workspace, sample_item
):
    roadmap_service.roadmap_repo.find_by_workspace_and_item = AsyncMock(return_value=sample_item)

    req = RoadmapItemUpdate(
        actualStartDate="2026-11-10",
        actualEndDate="2026-11-01",  # Invalid: end precedes start!
    )

    with pytest.raises(HTTPException) as exc_info:
        await roadmap_service.update_item(str(mock_workspace.id), str(sample_item.id), req, mock_user)
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "cannot precede" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_delete_roadmap_item_success(roadmap_service, mock_user, mock_workspace, sample_item):
    roadmap_service.roadmap_repo.find_by_workspace_and_item = AsyncMock(return_value=sample_item)
    roadmap_service.roadmap_repo.delete = AsyncMock(return_value=True)

    result = await roadmap_service.delete_item(str(mock_workspace.id), str(sample_item.id), mock_user)
    assert result["success"] is True
    assert result["id"] == str(sample_item.id)


@pytest.mark.asyncio
async def test_cross_workspace_unauthorized_access_rejected(
    roadmap_service, mock_intruder_user, mock_workspace
):
    # Intruder is not owner and has no active membership
    foreign_ws_id = str(ObjectId("660011223344556677889988"))
    roadmap_service.membership_repo.find_membership = AsyncMock(return_value=None)
    roadmap_service.workspace_repo.find_by_id = AsyncMock(
        return_value=Workspace(
            id=ObjectId(foreign_ws_id),
            name="Other Workspace",
            slug="other-ws",
            owner_id=ObjectId("660011223344556677889901"),  # Not intruder
        )
    )

    with pytest.raises(HTTPException) as exc_info:
        await roadmap_service.list_roadmaps(foreign_ws_id, mock_intruder_user)
    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
