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
from app.models.planning import ProductRoadmap, RoadmapItem, PRD, PrioritizationScenario
from app.models.intelligence import FeatureGroup
from app.core.enums import (
    PlatformRole,
    MembershipStatus,
    RoadmapStatus,
    FeedbackPriority,
    ProductRoadmapType,
    RoadmapTimeHorizon,
    ProductRoadmapStatus,
    PRDStatus,
)
from app.schemas.roadmap import (
    ProductRoadmapCreate,
    ProductRoadmapUpdate,
    RoadmapItemCreate,
    RoadmapItemUpdate,
    PromotePRDRequest,
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
    prd_repo = AsyncMock()
    feature_group_repo = AsyncMock()
    prioritization_repo = AsyncMock()

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
        prd_repo=prd_repo,
        feature_group_repo=feature_group_repo,
        prioritization_repo=prioritization_repo,
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
    sample_item.actual_start_date = "2026-11-10"
    roadmap_service.roadmap_repo.find_by_workspace_and_item = AsyncMock(return_value=sample_item)

    req = RoadmapItemUpdate(
        actualEndDate="2026-11-01",  # Invalid: end precedes existing start!
    )

    with pytest.raises(HTTPException) as exc_info:
        await roadmap_service.update_item(str(mock_workspace.id), str(sample_item.id), req, mock_user)
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "cannot be after" in exc_info.value.detail.lower() or "cannot precede" in exc_info.value.detail.lower()


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


# ===========================================================================
# Candidate Retrieval & Approved PRD Promotion Tests (Phase 6.3 & 6.5)
# ===========================================================================

@pytest.mark.asyncio
async def test_get_candidates_flags_approved_prd(roadmap_service, mock_user, mock_workspace):
    fg_id = ObjectId("660011223344556677889950")
    fg = FeatureGroup(
        id=fg_id,
        workspace_id=mock_workspace.id,
        title="Real-time Webhook Streaming",
        description="Low-latency webhook architecture",
        feedback_count=42,
        customer_pain_points=["Delayed event delivery"],
    )
    prd_approved = PRD(
        id=ObjectId("660011223344556677889951"),
        workspace_id=mock_workspace.id,
        feature_group_id=fg_id,
        title="Webhook Streaming PRD",
        status=PRDStatus.APPROVED,
        version="1.2.0",
        roadmap_recommendations=[
            {"phase": "Phase 1: Ingestion Pipeline", "deliverables": "Kafka ingress"},
            {"phase": "Phase 2: Dispatcher Engine", "deliverables": "Retry queue"},
        ],
    )
    scenario = PrioritizationScenario(
        id=ObjectId("660011223344556677889952"),
        workspace_id=mock_workspace.id,
        feature_group_id=fg_id,
        name="RICE Prioritization",
        final_score=94.5,
        priority_level="Urgent",
        factor_scores={"reach": 85.0, "impact": 95.0},
    )

    roadmap_service.feature_group_repo.find_by_workspace = AsyncMock(return_value=[fg])
    roadmap_service.prd_repo.find_by_workspace = AsyncMock(return_value=[prd_approved])
    roadmap_service.prioritization_repo.find_by_workspace = AsyncMock(return_value=[scenario])
    roadmap_service.roadmap_repo.find_by_workspace = AsyncMock(return_value=[])

    resp = await roadmap_service.get_candidates(str(mock_workspace.id), mock_user)
    assert resp.total == 1
    cand = resp.items[0]
    assert cand.feature_group_id == str(fg_id)
    assert cand.prd_id == str(prd_approved.id)
    assert cand.is_approved_for_roadmap is True
    assert cand.priority_score == 94.5
    assert len(cand.roadmap_recommendations) == 2
    assert cand.is_fully_committed is False


@pytest.mark.asyncio
async def test_get_candidates_rejects_draft_prd_approval(roadmap_service, mock_user, mock_workspace):
    fg_id = ObjectId("660011223344556677889960")
    fg = FeatureGroup(
        id=fg_id,
        workspace_id=mock_workspace.id,
        title="Dark Mode Dashboard",
        feedback_count=12,
    )
    prd_draft = PRD(
        id=ObjectId("660011223344556677889961"),
        workspace_id=mock_workspace.id,
        feature_group_id=fg_id,
        title="Dark Mode PRD",
        status=PRDStatus.DRAFT,
        version="0.1.0",
    )

    roadmap_service.feature_group_repo.find_by_workspace = AsyncMock(return_value=[fg])
    roadmap_service.prd_repo.find_by_workspace = AsyncMock(return_value=[prd_draft])
    roadmap_service.prioritization_repo.find_by_workspace = AsyncMock(return_value=[])
    roadmap_service.roadmap_repo.find_by_workspace = AsyncMock(return_value=[])

    resp = await roadmap_service.get_candidates(str(mock_workspace.id), mock_user)
    cand = resp.items[0]
    assert cand.is_approved_for_roadmap is False
    assert cand.prd_status == "Draft"


@pytest.mark.asyncio
async def test_promote_approved_prd_success(roadmap_service, mock_user, mock_workspace, sample_roadmap):
    prd_id = ObjectId("660011223344556677889970")
    prd = PRD(
        id=prd_id,
        workspace_id=mock_workspace.id,
        title="Zero-Knowledge Audit Trail",
        status=PRDStatus.APPROVED,
        version="1.0.0",
        roadmap_recommendations=[
            {"phase": "Phase 1: Cryptographic Hashes", "deliverables": "Merkle tree generation"},
            {"phase": "Phase 2: Verifier Service", "deliverables": "Verification API"},
        ],
    )

    roadmap_service.prd_repo.find_by_id = AsyncMock(return_value=prd)
    roadmap_service.product_roadmap_repo.find_by_id_and_workspace = AsyncMock(return_value=sample_roadmap)
    roadmap_service.roadmap_repo.find_by_prd = AsyncMock(return_value=[])  # No prior promotions
    roadmap_service.roadmap_repo.create = AsyncMock(side_effect=lambda item: item)

    req = PromotePRDRequest(
        prdId=str(prd_id),
        roadmapId=str(sample_roadmap.id),
        targetMilestone="Q1 Release",
    )

    resp = await roadmap_service.promote_approved_prd(str(mock_workspace.id), req, mock_user)
    assert resp.success is True
    assert resp.promoted_count == 2
    assert resp.prd_title == "Zero-Knowledge Audit Trail"
    assert roadmap_service.roadmap_repo.create.call_count == 2


@pytest.mark.asyncio
async def test_promote_non_approved_prd_strictly_rejected(roadmap_service, mock_user, mock_workspace):
    # Test rejection across all non-approved PRD statuses
    for invalid_status in [PRDStatus.DRAFT, PRDStatus.IN_REVIEW, PRDStatus.PENDING_REVIEW, PRDStatus.REJECTED]:
        prd = PRD(
            id=ObjectId("660011223344556677889975"),
            workspace_id=mock_workspace.id,
            title="Unapproved Feature",
            status=invalid_status,
            version="1.0.0",
        )
        roadmap_service.prd_repo.find_by_id = AsyncMock(return_value=prd)

        req = PromotePRDRequest(prdId=str(prd.id))
        with pytest.raises(HTTPException) as exc_info:
            await roadmap_service.promote_approved_prd(str(mock_workspace.id), req, mock_user)
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Only PRDs with status 'Approved' are eligible" in exc_info.value.detail


@pytest.mark.asyncio
async def test_circular_dependency_detected_and_rejected(roadmap_service, mock_user, mock_workspace):
    item_a_id = ObjectId("660011223344556677889981")
    item_b_id = ObjectId("660011223344556677889982")

    # Item B already depends on Item A
    item_b = RoadmapItem(
        id=item_b_id,
        workspace_id=mock_workspace.id,
        title="Item B",
        start_date="2026-10-01",
        target_date="2026-11-01",
        dependencies=[item_a_id],
    )
    item_a = RoadmapItem(
        id=item_a_id,
        workspace_id=mock_workspace.id,
        title="Item A",
        start_date="2026-10-01",
        target_date="2026-11-01",
        dependencies=[],
    )

    roadmap_service.roadmap_repo.find_by_workspace_and_item = AsyncMock(
        side_effect=lambda ws, item_id: item_a if item_id == item_a_id else (item_b if item_id == item_b_id else None)
    )

    # Attempt to update Item A to depend on Item B -> creates cycle A -> B -> A!
    req = RoadmapItemUpdate(dependencies=[str(item_b_id)])
    with pytest.raises(HTTPException) as exc_info:
        await roadmap_service.update_item(str(mock_workspace.id), str(item_a_id), req, mock_user)
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "Circular dependency detected" in exc_info.value.detail


@pytest.mark.asyncio
async def test_self_dependency_rejected(roadmap_service, mock_user, mock_workspace, sample_item):
    roadmap_service.roadmap_repo.find_by_workspace_and_item = AsyncMock(return_value=sample_item)

    req = RoadmapItemUpdate(dependencies=[str(sample_item.id)])
    with pytest.raises(HTTPException) as exc_info:
        await roadmap_service.update_item(str(mock_workspace.id), str(sample_item.id), req, mock_user)
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "cannot depend on itself" in exc_info.value.detail
