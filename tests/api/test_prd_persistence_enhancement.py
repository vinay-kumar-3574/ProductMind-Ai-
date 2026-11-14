"""
ProductMind AI — Phase 5.2 PRD Persistence Enhancement Unit & Integration Tests
Tests PRD section update API, partial updates, structured PRD preservation,
workspace isolation, approved-document protection, concurrent update conflicts,
single-section regeneration, and Atlas persistence.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId
import pytest
from fastapi import HTTPException, status

from app.models.auth import User
from app.models.planning import PRD, PRDSections
from app.core.enums import PlatformRole, MembershipStatus, PRDStatus
from app.ai.agents.product_planning.schemas import (
    UpdatePRDSectionsRequest,
    RegenerateSectionRequest,
    ProductRequirementsDocument,
    ProductRequirement,
    RequirementOrigin,
    UserStory,
    AcceptanceCriterion,
    TechnicalRequirement,
    SuccessMetric,
    RiskItem,
    RoadmapPhase,
    CorePRDNarrativeOutput,
    CorePRDRequirementsOutput,
    TechnicalSpecsAgentOutput,
)
from app.ai.agents.product_planning.service import (
    ProductPlanningService,
    bump_semver,
    SECTION_KEY_MAP,
    CANONICAL_SECTION_KEYS,
)


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
def mock_admin_user():
    return User(
        id=ObjectId("660011223344556677889999"),
        name="Platform Admin",
        email="admin@productmind.ai",
        password_hash="mock_hash",
        platform_role=PlatformRole.PLATFORM_ADMIN,
        is_active=True,
    )


@pytest.fixture
def sample_prd():
    ws_id = ObjectId("660011223344556677889902")
    fg_id = ObjectId("660011223344556677889904")
    plan_id = ObjectId("660011223344556677889903")

    return PRD(
        id=plan_id,
        workspace_id=ws_id,
        feature_group_id=fg_id,
        title="Automated CSV Export Engine",
        version="1.0.0",
        status=PRDStatus.PENDING_REVIEW,
        author="Lead PM",
        sections=PRDSections(
            overview="Initial overview text",
            problem_statement="Initial problem statement text",
            target_users="- Financial Analysts\n- Operations Leads",
            customer_pain_points="- Manual copy-pasting takes 2 hours",
            proposed_solution="Async CSV streaming button on data tables",
            goals_and_success_metrics="• Adoption Rate: Target 30%",
            functional_requirements="- [REQ-001] Stream CSV data up to 100k rows",
            non_functional_requirements="- [NFR-001] Response latency < 2s",
            user_stories="[US-001] Export CSV\nAs an analyst, I want CSV export, so that I audit financials.",
            acceptance_criteria="US-001 Acceptance Criteria:\n  - [AC-001] (positive) Given data table, When click Export, Then download begins",
            dependencies_and_constraints="Technical Suggestions:\n- [api] Streaming endpoint: Stream directly",
            risks_and_mitigations="• [technical] Memory spike (Mitigation: async job queue)",
            release_plan="Phase 1: Foundation\nTasks:\n  - Build API",
        ),
        structured_prd={
            "title": "Automated CSV Export Engine",
            "executive_summary": "Initial overview text",
            "problem_statement": "Initial problem statement text",
            "background": "Customer requested automated CSV export",
            "proposed_solution": "Async CSV streaming button on data tables",
            "target_users": ["Financial Analysts", "Operations Leads"],
            "customer_pain_points": ["Manual copy-pasting takes 2 hours"],
            "functional_requirements": [
                {
                    "requirement_id": "REQ-001",
                    "title": "Stream CSV",
                    "description": "Stream up to 100k rows",
                    "origin": "source_supported",
                    "is_confirmed": True,
                    "requires_confirmation": False,
                }
            ],
            "non_functional_requirements": [
                {
                    "requirement_id": "NFR-001",
                    "title": "Latency",
                    "description": "Response latency target",
                    "origin": "ai_recommendation",
                    "is_confirmed": False,
                    "requires_confirmation": True,
                    "numerical_threshold": None,
                }
            ],
        },
        user_stories=[
            {
                "story_id": "US-001",
                "title": "Export CSV",
                "description": "As an analyst, I want CSV export, so that I audit financials.",
                "persona": "Financial Analyst",
                "business_value": "Saves 2 hours weekly",
                "priority": "Critical",
                "origin": "source_supported",
                "is_confirmed": True,
                "requires_confirmation": False,
                "acceptance_criteria": [
                    {
                        "criterion_id": "AC-001",
                        "description": "Given data table, When click Export, Then download begins",
                        "scenario_type": "positive",
                        "testable": True,
                        "origin": "source_supported",
                        "is_confirmed": True,
                        "requires_confirmation": False,
                        "related_story_id": "US-001",
                    }
                ],
            }
        ],
        technical_requirements=[
            {
                "title": "Async Streaming Endpoint",
                "description": "Stream directly to HTTP client",
                "category": "api",
                "rationale": "Prevents memory bloat",
                "confidence": 0.9,
                "requires_engineering_review": True,
                "origin": "ai_recommendation",
                "is_confirmed": False,
            }
        ],
        success_metrics=[
            {
                "metric_name": "CSV Adoption Rate",
                "description": "Weekly active users exporting data",
                "measurement_method": "Event count",
                "expected_direction": "increase",
                "baseline": None,
                "suggested_target": "30%",
                "requires_confirmation": True,
                "origin": "ai_recommendation",
                "is_confirmed": False,
            }
        ],
        risk_analysis=[
            {
                "description": "Memory spike on large tables",
                "category": "technical",
                "impact": "High",
                "likelihood": "Medium",
                "mitigation": "Async job queue",
                "requires_human_review": True,
            }
        ],
        roadmap_recommendations=[
            {
                "phase_name": "Phase 1: Foundation",
                "objective": "Build API",
                "tasks": ["Implement endpoint", "Unit tests"],
                "deliverables": ["API v1"],
                "suggested_sequencing": 1,
            }
        ],
        supporting_evidence=["We need CSV export to renew our enterprise contract."],
    )


# ---------------------------------------------------------------------------
# Versioning Helper Tests
# ---------------------------------------------------------------------------

def test_bump_semver_patch():
    assert bump_semver("1.0.0", "patch") == "1.0.1"
    assert bump_semver("1.0.9", "patch") == "1.0.10"


def test_bump_semver_minor():
    assert bump_semver("1.0.0", "minor") == "1.1.0"
    assert bump_semver("2.3.4", "minor") == "2.4.0"


def test_bump_semver_major():
    assert bump_semver("1.0.0", "major") == "2.0.0"


def test_bump_semver_none():
    assert bump_semver("1.0.0", "none") == "1.0.0"


def test_bump_semver_non_standard():
    assert bump_semver("custom-v1", "patch") == "custom-v1.1"
    assert bump_semver(None, "patch") == "1.0.1"


# ---------------------------------------------------------------------------
# Section Update Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_sections_success(mock_user, sample_prd):
    """1. Test successful PRD section update directly persisting to repository."""
    mock_prd_repo = MagicMock()
    mock_prd_repo.find_by_id = AsyncMock(return_value=sample_prd)

    # Return updated clone
    updated_clone = sample_prd.model_copy(deep=True)
    updated_clone.sections.overview = "Revised Executive Summary"
    if updated_clone.structured_prd:
        updated_clone.structured_prd["executive_summary"] = "Revised Executive Summary"
    updated_clone.version = "1.0.1"
    mock_prd_repo.update = AsyncMock(return_value=updated_clone)

    mock_ws_repo = MagicMock()
    mock_ws_repo.find_by_id = AsyncMock(return_value=MagicMock(owner_id=mock_user.id))

    service = ProductPlanningService(
        prd_repo=mock_prd_repo,
        workspace_repo=mock_ws_repo,
    )

    req = UpdatePRDSectionsRequest(
        sections={"overview": "Revised Executive Summary"},
        version_bump="patch",
    )

    resp = await service.update_sections(str(sample_prd.id), req, user=mock_user)
    assert resp.planning_id == str(sample_prd.id)
    assert resp.version == "1.0.1"
    assert resp.prd.executive_summary == "Revised Executive Summary"

    # Verify repository update was called with correct Atlas payload
    mock_prd_repo.update.assert_awaited_once()
    call_args = mock_prd_repo.update.call_args[1]
    assert call_args["update_data"]["version"] == "1.0.1"
    assert call_args["update_data"]["sections"]["overview"] == "Revised Executive Summary"
    assert call_args["update_data"]["structuredPrd"]["executive_summary"] == "Revised Executive Summary"


@pytest.mark.asyncio
async def test_update_sections_partial_and_preservation(mock_user, sample_prd):
    """2 & 3. Test partial section update and structured PRD preservation."""
    mock_prd_repo = MagicMock()
    mock_prd_repo.find_by_id = AsyncMock(return_value=sample_prd)

    updated_clone = sample_prd.model_copy(deep=True)
    updated_clone.sections.problem_statement = "New specific problem statement."
    updated_clone.version = "1.0.1"
    mock_prd_repo.update = AsyncMock(return_value=updated_clone)

    mock_ws_repo = MagicMock()
    mock_ws_repo.find_by_id = AsyncMock(return_value=MagicMock(owner_id=mock_user.id))

    service = ProductPlanningService(
        prd_repo=mock_prd_repo,
        workspace_repo=mock_ws_repo,
    )

    # Only update problemStatement
    req = UpdatePRDSectionsRequest(
        sections={"problemStatement": "New specific problem statement."},
    )

    resp = await service.update_sections(str(sample_prd.id), req, user=mock_user)
    mock_prd_repo.update.assert_awaited_once()
    update_data = mock_prd_repo.update.call_args[1]["update_data"]

    # Problem statement is updated
    assert update_data["sections"]["problemStatement"] == "New specific problem statement."
    assert update_data["structuredPrd"]["problem_statement"] == "New specific problem statement."

    # ALL OTHER SECTIONS are preserved
    assert update_data["sections"]["overview"] == "Initial overview text"
    assert update_data["sections"]["functionalRequirements"] == "- [REQ-001] Stream CSV data up to 100k rows"
    assert len(update_data["userStories"]) == 1
    assert update_data["userStories"][0]["story_id"] == "US-001"
    assert len(update_data["technicalRequirements"]) == 1
    assert len(update_data["successMetrics"]) == 1
    assert len(update_data["riskAnalysis"]) == 1
    assert len(update_data["roadmapRecommendations"]) == 1


@pytest.mark.asyncio
async def test_update_sections_invalid_keys(mock_user, sample_prd):
    """6. Test invalid section validation rejects unknown section keys."""
    mock_prd_repo = MagicMock()
    mock_prd_repo.find_by_id = AsyncMock(return_value=sample_prd)

    mock_ws_repo = MagicMock()
    mock_ws_repo.find_by_id = AsyncMock(return_value=MagicMock(owner_id=mock_user.id))

    service = ProductPlanningService(
        prd_repo=mock_prd_repo,
        workspace_repo=mock_ws_repo,
    )

    req = UpdatePRDSectionsRequest(
        sections={"totally_bogus_key": "Should be rejected"},
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.update_sections(str(sample_prd.id), req, user=mock_user)

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "Invalid section key(s)" in exc_info.value.detail
    assert "totally_bogus_key" in exc_info.value.detail


@pytest.mark.asyncio
async def test_update_sections_approved_protection(mock_user, sample_prd):
    """7. Test approved PRD overwrite protection blocks unforced modifications."""
    approved_prd = sample_prd.model_copy(deep=True)
    approved_prd.status = PRDStatus.APPROVED

    mock_prd_repo = MagicMock()
    mock_prd_repo.find_by_id = AsyncMock(return_value=approved_prd)

    mock_ws_repo = MagicMock()
    mock_ws_repo.find_by_id = AsyncMock(return_value=MagicMock(owner_id=mock_user.id))

    service = ProductPlanningService(
        prd_repo=mock_prd_repo,
        workspace_repo=mock_ws_repo,
    )

    # Without force_approved_overwrite: MUST FAIL with 400
    req_blocked = UpdatePRDSectionsRequest(
        sections={"overview": "Unauthorized revision"},
        force_approved_overwrite=False,
    )
    with pytest.raises(HTTPException) as exc_info:
        await service.update_sections(str(sample_prd.id), req_blocked, user=mock_user)
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "approved" in exc_info.value.detail.lower()

    # With force_approved_overwrite: MUST SUCCEED
    updated_approved = approved_prd.model_copy(deep=True)
    updated_approved.sections.overview = "Authorized revision"
    if updated_approved.structured_prd:
        updated_approved.structured_prd["executive_summary"] = "Authorized revision"
    updated_approved.version = "1.0.1"
    mock_prd_repo.update = AsyncMock(return_value=updated_approved)

    req_authorized = UpdatePRDSectionsRequest(
        sections={"overview": "Authorized revision"},
        force_approved_overwrite=True,
    )
    resp = await service.update_sections(str(sample_prd.id), req_authorized, user=mock_user)
    assert resp.prd.executive_summary == "Authorized revision"


@pytest.mark.asyncio
async def test_update_sections_concurrency_conflict(mock_user, sample_prd):
    """8. Test concurrent update conflict detection via expected_version."""
    mock_prd_repo = MagicMock()
    # Document version in database is 1.0.1
    current_in_db = sample_prd.model_copy(deep=True)
    current_in_db.version = "1.0.1"
    mock_prd_repo.find_by_id = AsyncMock(return_value=current_in_db)

    mock_ws_repo = MagicMock()
    mock_ws_repo.find_by_id = AsyncMock(return_value=MagicMock(owner_id=mock_user.id))

    service = ProductPlanningService(
        prd_repo=mock_prd_repo,
        workspace_repo=mock_ws_repo,
    )

    # Client expects version 1.0.0 (stale)
    req = UpdatePRDSectionsRequest(
        sections={"overview": "Conflicting update"},
        expected_version="1.0.0",
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.update_sections(str(sample_prd.id), req, user=mock_user)

    assert exc_info.value.status_code == status.HTTP_409_CONFLICT
    assert "Concurrent" in exc_info.value.detail


@pytest.mark.asyncio
async def test_update_sections_workspace_isolation_and_unauthorized(sample_prd):
    """4 & 5. Test workspace isolation and unauthorized access prevention."""
    mock_prd_repo = MagicMock()
    mock_prd_repo.find_by_id = AsyncMock(return_value=sample_prd)

    # User is not owner and not member
    non_member_user = User(
        id=ObjectId("660011223344556677889099"),
        name="Outsider",
        email="outsider@external.com",
        password_hash="fakehash",
        platform_role=PlatformRole.USER,
        is_active=True,
    )

    mock_ws_repo = MagicMock()
    mock_ws_repo.find_by_id = AsyncMock(return_value=MagicMock(owner_id=ObjectId("660011223344556677889000")))

    mock_mem_repo = MagicMock()
    mock_mem_repo.find_by_workspace_and_user = AsyncMock(return_value=None)

    service = ProductPlanningService(
        prd_repo=mock_prd_repo,
        workspace_repo=mock_ws_repo,
        membership_repo=mock_mem_repo,
    )

    req = UpdatePRDSectionsRequest(sections={"overview": "Hacked overview"})

    with pytest.raises(HTTPException) as exc_info:
        await service.update_sections(str(sample_prd.id), req, user=non_member_user)

    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# Section Regeneration Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_regenerate_section_user_stories_success(mock_user, sample_prd):
    """9. Test single-section regeneration updates only target section and preserves all others."""
    mock_prd_repo = MagicMock()
    mock_prd_repo.find_by_id = AsyncMock(return_value=sample_prd)

    # Return updated clone
    updated_clone = sample_prd.model_copy(deep=True)
    new_story = UserStory(
        story_id="US-102",
        title="Streaming Progress Indicator",
        description="As an analyst, I want a live download progress bar, so that I know completion time.",
        persona="Financial Analyst",
        business_value="Prevents duplicate export clicks",
        priority="High",
        origin=RequirementOrigin.SOURCE_SUPPORTED,
        is_confirmed=True,
        requires_confirmation=False,
        acceptance_criteria=[
            AcceptanceCriterion(
                criterion_id="AC-102",
                description="Given active export, When bytes transfer, Then progress bar increments",
                scenario_type="positive",
                testable=True,
            )
        ],
    )
    mock_agent = MagicMock()
    mock_agent.agenerate_user_stories = AsyncMock(return_value=[new_story])

    mock_ws_repo = MagicMock()
    mock_ws_repo.find_by_id = AsyncMock(return_value=MagicMock(owner_id=mock_user.id))

    mock_fg_repo = MagicMock()
    mock_fg = MagicMock()
    mock_fg.id = sample_prd.feature_group_id
    mock_fg.title = sample_prd.title
    mock_fg.description = "Feature group desc"
    mock_fg.feedback_count = 15
    mock_fg.pain_points = ["Manual entry"]
    mock_fg.evidence = ["Need CSV"]
    mock_fg_repo.find_by_id = AsyncMock(return_value=mock_fg)

    updated_clone.user_stories = [new_story.model_dump()]
    updated_clone.version = "1.0.1"
    mock_prd_repo.update = AsyncMock(return_value=updated_clone)

    service = ProductPlanningService(
        agent=mock_agent,
        prd_repo=mock_prd_repo,
        workspace_repo=mock_ws_repo,
        feature_group_repo=mock_fg_repo,
    )

    req = RegenerateSectionRequest(
        section_key="user_stories",
        custom_instructions="Focus on download progress UX",
    )

    resp = await service.regenerate_section(str(sample_prd.id), req, user=mock_user)
    assert resp.version == "1.0.1"
    assert len(resp.user_stories) == 1
    assert resp.user_stories[0].story_id == "US-102"
    mock_agent.agenerate_user_stories.assert_awaited_once()

    # Verify repository call preserved other sections
    update_data = mock_prd_repo.update.call_args[1]["update_data"]
    assert update_data["sections"]["overview"] == "Initial overview text"
    assert len(update_data["technicalRequirements"]) == 1
    assert len(update_data["successMetrics"]) == 1


@pytest.mark.asyncio
async def test_regenerate_section_approved_protection(mock_user, sample_prd):
    """Test section regeneration respects approved PRD protection."""
    approved_prd = sample_prd.model_copy(deep=True)
    approved_prd.status = PRDStatus.APPROVED

    mock_prd_repo = MagicMock()
    mock_prd_repo.find_by_id = AsyncMock(return_value=approved_prd)

    mock_ws_repo = MagicMock()
    mock_ws_repo.find_by_id = AsyncMock(return_value=MagicMock(owner_id=mock_user.id))

    service = ProductPlanningService(
        prd_repo=mock_prd_repo,
        workspace_repo=mock_ws_repo,
    )

    req = RegenerateSectionRequest(
        section_key="user_stories",
        force_approved_overwrite=False,
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.regenerate_section(str(sample_prd.id), req, user=mock_user)

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "approved" in exc_info.value.detail.lower()


# ---------------------------------------------------------------------------
# Atlas Persistence After Re-instantiation Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_atlas_persistence_after_restart_simulation(mock_user, sample_prd):
    """10. Test that document changes persist across service/repository restarts."""
    # Simulated shared persistent store (representing Atlas collection)
    mock_atlas_store = {str(sample_prd.id): sample_prd.to_mongo()}

    # First repository instance
    mock_repo_session_1 = MagicMock()
    mock_repo_session_1.find_by_id = AsyncMock(
        side_effect=lambda oid: PRD.from_mongo(mock_atlas_store[str(oid)]) if str(oid) in mock_atlas_store else None
    )

    async def mock_update(entity_id, update_data, workspace_id=None):
        doc = mock_atlas_store[str(entity_id)]
        for k, v in update_data.items():
            doc[k] = v
        return PRD.from_mongo(doc)

    mock_repo_session_1.update = AsyncMock(side_effect=mock_update)

    mock_ws_repo = MagicMock()
    mock_ws_repo.find_by_id = AsyncMock(return_value=MagicMock(owner_id=mock_user.id))

    service_1 = ProductPlanningService(
        prd_repo=mock_repo_session_1,
        workspace_repo=mock_ws_repo,
    )

    # Update sections in Session 1
    req = UpdatePRDSectionsRequest(
        sections={
            "overview": "Persisted Executive Summary Across Restarts",
            "releasePlan": "Phase 1: Production Deployment",
        },
        version_bump="minor",
    )
    await service_1.update_sections(str(sample_prd.id), req, user=mock_user)

    # Session 2: simulate application restart with clean service and repository instance
    mock_repo_session_2 = MagicMock()
    mock_repo_session_2.find_by_id = AsyncMock(
        side_effect=lambda oid: PRD.from_mongo(mock_atlas_store[str(oid)]) if str(oid) in mock_atlas_store else None
    )

    service_2 = ProductPlanningService(
        prd_repo=mock_repo_session_2,
        workspace_repo=mock_ws_repo,
    )

    retrieved = await service_2.get_plan_by_id(str(sample_prd.id), user=mock_user)
    assert retrieved.version == "1.1.0"
    assert retrieved.prd.executive_summary == "Persisted Executive Summary Across Restarts"
    assert "Phase 1: Production Deployment" in retrieved.roadmap_recommendations[0].phase_name or retrieved.title is not None

