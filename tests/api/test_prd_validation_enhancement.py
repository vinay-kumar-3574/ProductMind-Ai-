"""
ProductMind AI — Phase 5.5 PRD Validation Enhancement Unit & Integration Tests
Tests deterministic PRD completeness, requirement quality, evidence traceability,
Given-When-Then acceptance criteria, success metric integrity, risk mitigations,
scoring/severity calculations, workspace isolation, unauthenticated access,
persisted Atlas document validation, and read-only data preservation.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId
import pytest
from fastapi import HTTPException, status
from fastapi.testclient import TestClient

from app.main import app
from app.api.dependencies import get_current_user, get_mongo_db
from app.api.v1.endpoints.planning_ai import get_product_planning_service
from app.models.auth import User
from app.models.planning import PRD, PRDSections
from app.core.enums import PlatformRole, PRDStatus
from app.ai.agents.product_planning.schemas import (
    ValidationSeverity,
    ValidationCategory,
    ValidationIssue,
    ValidationSummary,
    PRDValidationResult,
    RequirementOrigin,
)
from app.ai.agents.product_planning.service import ProductPlanningService
from app.ai.agents.product_planning.validator import PRDValidator, validate_product_plan


client = TestClient(app)

MOCK_USER_ID = ObjectId("660011223344556677889901")
MOCK_WS_ID = ObjectId("660011223344556677889902")
MOCK_PLAN_ID = ObjectId("660011223344556677889903")
MOCK_FG_ID = ObjectId("660011223344556677889904")
MOCK_FEEDBACK_ID = "660011223344556677889905"


@pytest.fixture(autouse=True)
def clean_dependency_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def mock_user():
    return User(
        id=MOCK_USER_ID,
        name="Lead PM",
        email="lead.pm@productmind.ai",
        password_hash="mock_hash",
        platform_role=PlatformRole.USER,
        is_active=True,
    )


@pytest.fixture
def valid_prd_dict():
    """Returns a fully valid 13-section PRD dictionary with 100 quality score."""
    return {
        "id": str(MOCK_PLAN_ID),
        "planning_id": str(MOCK_PLAN_ID),
        "workspace_id": str(MOCK_WS_ID),
        "feature_group_id": str(MOCK_FG_ID),
        "title": "Automated CSV Export Engine",
        "version": "1.0.0",
        "status": "draft",
        "sections": {
            "overview": "Automated CSV Export Engine provides high-throughput streaming capabilities for financial reconciliation.",
            "problem_statement": "Manual export copy-pasting takes analysts over 2 hours weekly and leads to transcription errors.",
            "target_users": "- Financial Analysts\n- Accounting Leads",
            "customer_pain_points": "- Slow export latency\n- Row limit truncated at 5,000 rows",
            "proposed_solution": "Direct streaming button on analytics dashboard generating zip-compressed CSV files.",
            "goals_and_success_metrics": "Business Objectives:\n- Reduce audit time by 50%\nSuccess Metrics:\n- Adoption 40%",
            "functional_requirements": "- [REQ-001] (source_supported) Stream CSV rows: System streams up to 100k rows asynchronously",
            "non_functional_requirements": "- [NFR-001] (source_supported) Export Latency: Response initiates under 2 seconds for active workspaces",
            "user_stories": "[US-001] Export CSV\nAs a financial analyst, I want automated CSV exports, so that manual reconciliation effort is eliminated.",
            "acceptance_criteria": "US-001 Acceptance Criteria:\n  - [AC-001] (positive) Given an authenticated analyst on reports dashboard, When export button is clicked, Then a CSV download stream initiates within 2 seconds.",
            "dependencies_and_constraints": "Dependencies:\n- MongoDB Atlas data store\n- FastAPI streaming router",
            "risks_and_mitigations": "- Memory spikes on concurrent requests (Mitigation: async job queue with token bucket rate limiting)",
            "release_plan": "Phase 1: Foundation\nTasks:\n  - Implement streaming router\nDeliverables:\n  - API endpoint v1",
        },
        "structured_prd": {
            "functional_requirements": [
                {
                    "requirement_id": "REQ-001",
                    "title": "Stream CSV rows",
                    "description": "System streams up to 100,000 rows asynchronously with progress telemetry.",
                    "origin": "source_supported",
                    "is_confirmed": True,
                    "requires_confirmation": False,
                    "source_reference": "Customer feedback: We need automated CSV exports for our quarterly audit.",
                }
            ],
            "non_functional_requirements": [
                {
                    "requirement_id": "NFR-001",
                    "title": "Export Latency",
                    "description": "Streaming begins under 2 seconds for active workspaces.",
                    "origin": "source_supported",
                    "is_confirmed": True,
                    "requires_confirmation": False,
                    "numerical_threshold": "2s",
                    "source_reference": "User technical constraint: Latency must stay under 2s.",
                }
            ],
        },
        "user_stories": [
            {
                "story_id": "US-001",
                "title": "Automated CSV Export Engine",
                "description": "As a financial analyst, I want automated CSV exports, so that manual reconciliation is eliminated.",
                "persona": "Financial Analyst",
                "business_value": "Eliminates 2 hours of manual copying weekly",
                "priority": "High",
                "origin": "source_supported",
                "is_confirmed": True,
                "requires_confirmation": False,
                "source_reference": "Audit feedback #101",
                "supporting_feedback_ids": [MOCK_FEEDBACK_ID],
                "acceptance_criteria": [
                    {
                        "criterion_id": "AC-001",
                        "description": "Given authenticated analyst, When export is triggered, Then CSV download stream initiates within 2 seconds.",
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
        "success_metrics": [
            {
                "metric_name": "Weekly Export Active Users",
                "description": "Number of distinct analysts using export weekly",
                "measurement_method": "Telemetry event 'export_completed'",
                "expected_direction": "increase",
                "baseline": None,
                "suggested_target": "40%",
                "target_origin": "source_supported",
                "is_target_confirmed": True,
                "requires_confirmation": False,
                "source_reference": "Quarterly target 40%",
            }
        ],
        "risk_analysis": [
            {
                "description": "Server memory exhaustion on 500k row datasets",
                "category": "technical",
                "impact": "High",
                "likelihood": "Medium",
                "mitigation": "Chunked cursor streaming with max 5,000 rows per memory buffer",
                "requires_human_review": True,
            }
        ],
        "roadmap_recommendations": [
            {
                "phase_name": "Phase 1: Streaming MVP",
                "objective": "Deliver direct CSV streaming on key analytics tables",
                "tasks": ["FastAPI endpoint", "Unit test suite"],
                "deliverables": ["Export v1"],
                "suggested_sequencing": 1,
            }
        ],
    }


# -----------------------------------------------------------------------------
# 1. Missing PRD Sections Check
# -----------------------------------------------------------------------------
def test_validation_detects_missing_sections(valid_prd_dict):
    """1. Validates that missing canonical PRD sections are flagged as critical or high severity."""
    # Delete core section (overview) and secondary section (release_plan)
    del valid_prd_dict["sections"]["overview"]
    del valid_prd_dict["sections"]["release_plan"]

    result = validate_product_plan(valid_prd_dict)

    missing_overview = [i for i in result.issues if i.section_key == "overview" and "Missing Canonical Section" in i.title]
    assert len(missing_overview) == 1
    assert missing_overview[0].severity == ValidationSeverity.CRITICAL

    missing_release = [i for i in result.issues if i.section_key == "release_plan" and "Missing Canonical Section" in i.title]
    assert len(missing_release) == 1
    assert missing_release[0].severity == ValidationSeverity.HIGH
    assert result.summary.quality_score < 100
    assert result.summary.is_valid_for_review is False


# -----------------------------------------------------------------------------
# 2. Empty Sections Check
# -----------------------------------------------------------------------------
def test_validation_detects_empty_sections(valid_prd_dict):
    """2. Validates that sections containing only empty or whitespace strings are flagged as HIGH severity."""
    valid_prd_dict["sections"]["problemStatement"] = "   \n\t   "

    result = validate_product_plan(valid_prd_dict)
    empty_issues = [i for i in result.issues if "Empty Section Content" in i.title]
    assert len(empty_issues) == 1
    assert empty_issues[0].section_key == "problem_statement"
    assert empty_issues[0].severity == ValidationSeverity.HIGH
    assert result.section_status["problem_statement"] == "error"


# -----------------------------------------------------------------------------
# 3. Duplicate Requirements Check
# -----------------------------------------------------------------------------
def test_validation_detects_duplicate_requirements(valid_prd_dict):
    """3. Validates detection of duplicate titles, duplicate IDs, and near-duplicate descriptions."""
    req1 = {
        "requirement_id": "REQ-001",
        "title": "Data Export Engine",
        "description": "Stream data rows directly to client in comma separated format.",
        "origin": "user_provided",
        "is_confirmed": True,
        "requires_confirmation": False,
        "source_reference": "User directive",
    }
    req2 = {
        "requirement_id": "REQ-001",  # Duplicate ID
        "title": "Data Export Engine",  # Duplicate title
        "description": "Stream data rows directly to client in comma separated format.",  # Near/identical description
        "origin": "user_provided",
        "is_confirmed": True,
        "requires_confirmation": False,
        "source_reference": "User directive",
    }
    valid_prd_dict["structured_prd"]["functional_requirements"] = [req1, req2]

    result = validate_product_plan(valid_prd_dict)

    dup_id_issues = [i for i in result.issues if "Duplicate Requirement ID" in i.title]
    assert len(dup_id_issues) == 1
    assert dup_id_issues[0].severity == ValidationSeverity.HIGH

    dup_title_issues = [i for i in result.issues if "Duplicate Requirement Title" in i.title]
    assert len(dup_title_issues) == 1
    assert dup_title_issues[0].severity == ValidationSeverity.HIGH


# -----------------------------------------------------------------------------
# 4. Contradictory Requirements Check
# -----------------------------------------------------------------------------
def test_validation_detects_contradictory_requirements(valid_prd_dict):
    """4. Validates detection of mutually exclusive architectural paradigms (sync real-time vs. offline batch)."""
    valid_prd_dict["structured_prd"]["functional_requirements"] = [
        {
            "requirement_id": "REQ-001",
            "title": "Synchronous Export",
            "description": "System provides instant synchronous real-time streaming under 500ms latency directly.",
            "origin": "user_provided",
            "is_confirmed": True,
            "requires_confirmation": False,
            "source_reference": "User spec",
        },
        {
            "requirement_id": "REQ-002",
            "title": "Offline Batch Processor",
            "description": "All exports must process as asynchronous offline background batch jobs in delayed worker queue.",
            "origin": "user_provided",
            "is_confirmed": True,
            "requires_confirmation": False,
            "source_reference": "User spec",
        },
    ]

    result = validate_product_plan(valid_prd_dict)
    contradiction_issues = [i for i in result.issues if "Contradictory Requirements Detected" in i.title]
    assert len(contradiction_issues) >= 1
    assert contradiction_issues[0].severity == ValidationSeverity.HIGH
    assert "synchronous/real-time vs. offline/background asynchronous" in contradiction_issues[0].message


# -----------------------------------------------------------------------------
# 5. Unsupported Numerical Metrics (Zero-Fabrication Policy)
# -----------------------------------------------------------------------------
def test_validation_detects_unsupported_numerical_threshold(valid_prd_dict):
    """5. Validates that unbacked numerical SLAs or thresholds in AI recommendations violate zero-fabrication."""
    valid_prd_dict["structured_prd"]["non_functional_requirements"] = [
        {
            "requirement_id": "NFR-099",
            "title": "High Availability SLA",
            "description": "System guarantees 99.999% uptime with maximum 20ms response time globally.",
            "origin": "ai_recommendation",
            "is_confirmed": False,
            "requires_confirmation": True,
            "numerical_threshold": "99.999%",
            "source_reference": None,  # No grounding evidence
        }
    ]

    result = validate_product_plan(valid_prd_dict)
    sla_issues = [i for i in result.issues if "Unsupported Numerical Threshold" in i.title]
    assert len(sla_issues) == 1
    assert sla_issues[0].severity == ValidationSeverity.HIGH
    assert sla_issues[0].related_id == "NFR-099"


# -----------------------------------------------------------------------------
# 6. Missing Evidence References Check
# -----------------------------------------------------------------------------
def test_validation_detects_missing_evidence_references(valid_prd_dict):
    """6. Validates that source_supported claims without feedback quotes are flagged."""
    valid_prd_dict["structured_prd"]["functional_requirements"] = [
        {
            "requirement_id": "REQ-002",
            "title": "Custom Column Mapping",
            "description": "Allow users to map source columns to standard export columns.",
            "origin": "source_supported",
            "is_confirmed": True,
            "requires_confirmation": False,
            "source_reference": "",  # Missing!
        }
    ]

    result = validate_product_plan(valid_prd_dict)
    missing_evidence = [i for i in result.issues if "Missing Evidence Reference" in i.title]
    assert len(missing_evidence) == 1
    assert missing_evidence[0].severity == ValidationSeverity.HIGH
    assert missing_evidence[0].related_id == "REQ-002"


# -----------------------------------------------------------------------------
# 7. Invalid Feedback References Check
# -----------------------------------------------------------------------------
def test_validation_detects_invalid_feedback_references(valid_prd_dict):
    """7. Validates that references to feedback IDs not present in the workspace are caught."""
    valid_prd_dict["user_stories"][0]["supporting_feedback_ids"] = ["non_existent_feedback_id_999"]

    # Provide known workspace feedback set not including that ID
    known_feedback = {MOCK_FEEDBACK_ID}
    result = validate_product_plan(valid_prd_dict, workspace_feedback_ids=known_feedback)

    feedback_issues = [i for i in result.issues if "Invalid Feedback Reference" in i.title]
    assert len(feedback_issues) == 1
    assert feedback_issues[0].severity == ValidationSeverity.HIGH
    assert "non_existent_feedback_id_999" in feedback_issues[0].message


# -----------------------------------------------------------------------------
# 8. Incorrect Origin Classifications Check
# -----------------------------------------------------------------------------
def test_validation_detects_unconfirmed_ai_recommendation_marked_confirmed(valid_prd_dict):
    """8. Validates that AI recommendations marked confirmed without PM review are flagged."""
    valid_prd_dict["structured_prd"]["functional_requirements"] = [
        {
            "requirement_id": "REQ-003",
            "title": "Machine Learning Prediction",
            "description": "Predict quarterly volume using linear regression model.",
            "origin": "ai_recommendation",
            "is_confirmed": True,  # INVALID: AI recommendation cannot be pre-confirmed
            "requires_confirmation": False,
            "source_reference": None,
        }
    ]

    result = validate_product_plan(valid_prd_dict)
    origin_issues = [i for i in result.issues if "AI Recommendation Incorrectly Confirmed" in i.title]
    assert len(origin_issues) == 1
    assert origin_issues[0].severity == ValidationSeverity.HIGH


# -----------------------------------------------------------------------------
# 9. Incomplete Given-When-Then Criteria Check
# -----------------------------------------------------------------------------
def test_validation_detects_incomplete_given_when_then(valid_prd_dict):
    """9. Validates detection of acceptance criteria missing Given, When, or Then clauses."""
    valid_prd_dict["user_stories"][0]["acceptance_criteria"] = [
        {
            "criterion_id": "AC-001",
            "description": "User clicks the export button and downloads a CSV file.",  # Missing Given, When, Then
            "scenario_type": "positive",
            "testable": True,
            "origin": "user_provided",
            "is_confirmed": True,
            "requires_confirmation": False,
            "related_story_id": "US-001",
        }
    ]

    result = validate_product_plan(valid_prd_dict)
    gwt_issues = [i for i in result.issues if i.category == ValidationCategory.ACCEPTANCE_CRITERIA and "Missing" in i.title]
    # Expect Missing Given, When, and Then issues
    assert len(gwt_issues) >= 3
    assert any("Missing 'Given'" in i.title for i in gwt_issues)
    assert any("Missing 'When'" in i.title for i in gwt_issues)
    assert any("Missing 'Then'" in i.title for i in gwt_issues)


# -----------------------------------------------------------------------------
# 10. Duplicate Story and Criterion IDs Check
# -----------------------------------------------------------------------------
def test_validation_detects_duplicate_criterion_ids(valid_prd_dict):
    """10. Validates detection of duplicate criterion IDs across different user stories."""
    story1 = valid_prd_dict["user_stories"][0]
    story2 = {
        "story_id": "US-002",
        "title": "Column Filtering",
        "description": "As a user, I want column filtering, so that I export relevant columns.",
        "persona": "User",
        "business_value": "Saves bandwidth",
        "priority": "Medium",
        "origin": "user_provided",
        "is_confirmed": True,
        "requires_confirmation": False,
        "acceptance_criteria": [
            {
                "criterion_id": "AC-001",  # Duplicate of story1's AC-001!
                "description": "Given filtered columns, When user clicks export, Then only selected columns are in CSV.",
                "scenario_type": "positive",
                "testable": True,
                "origin": "user_provided",
                "is_confirmed": True,
                "requires_confirmation": False,
                "related_story_id": "US-002",
            }
        ],
    }
    valid_prd_dict["user_stories"] = [story1, story2]

    result = validate_product_plan(valid_prd_dict)
    dup_ac_issues = [i for i in result.issues if "Duplicate Criterion ID: AC-001" in i.title]
    assert len(dup_ac_issues) == 1
    assert dup_ac_issues[0].severity == ValidationSeverity.CRITICAL


# -----------------------------------------------------------------------------
# 11. Missing Risk Mitigations Check
# -----------------------------------------------------------------------------
def test_validation_detects_missing_or_vague_risk_mitigations(valid_prd_dict):
    """11. Validates detection of risks without mitigations or with placeholder 'TBD' text."""
    valid_prd_dict["risk_analysis"] = [
        {
            "description": "Database connection exhaustion",
            "category": "technical",
            "impact": "High",
            "likelihood": "High",
            "mitigation": "TBD",  # Vague placeholder
            "requires_human_review": True,
        },
        {
            "description": "User resistance to new workflow",
            "category": "adoption",
            "impact": "Medium",
            "likelihood": "Low",
            "mitigation": "",  # Empty
            "requires_human_review": True,
        },
    ]

    result = validate_product_plan(valid_prd_dict)
    empty_mitigation = [i for i in result.issues if "Risk Lacks Mitigation Plan" in i.title]
    assert len(empty_mitigation) == 1
    assert empty_mitigation[0].severity == ValidationSeverity.HIGH

    vague_mitigation = [i for i in result.issues if "Vague Mitigation Strategy" in i.title]
    assert len(vague_mitigation) == 1
    assert vague_mitigation[0].severity == ValidationSeverity.MEDIUM


# -----------------------------------------------------------------------------
# 12. Workspace Isolation & Unauthorized Tenant Access
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_validation_enforces_workspace_isolation(mock_user, valid_prd_dict):
    """12. Validates that passing a mismatched workspace_id returns 404/403."""
    mock_prd_repo = MagicMock()
    mock_prd_repo.find_by_id = AsyncMock(
        return_value=PRD(
            id=MOCK_PLAN_ID,
            workspace_id=MOCK_WS_ID,
            title="Isolated PRD",
            status=PRDStatus.DRAFT,
            sections=PRDSections(overview="Overview text"),
        )
    )

    mock_ws_repo = MagicMock()
    # User owns MOCK_WS_ID
    mock_ws_repo.find_by_id = AsyncMock(return_value=MagicMock(owner_id=mock_user.id))

    service = ProductPlanningService(
        agent=MagicMock(),
        prd_repo=mock_prd_repo,
        workspace_repo=mock_ws_repo,
    )

    # Attempt validation specifying another tenant's workspace
    foreign_workspace_id = str(ObjectId("660011223344556677889977"))
    with pytest.raises(HTTPException) as exc_info:
        await service.validate_plan(
            planning_id=str(MOCK_PLAN_ID),
            user=mock_user,
            workspace_id=foreign_workspace_id,
        )
    assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
    assert "does not belong to workspace" in exc_info.value.detail


# -----------------------------------------------------------------------------
# 13. Unauthorized Requests (Unauthenticated 401)
# -----------------------------------------------------------------------------
def test_validate_endpoint_unauthenticated():
    """13. Validates that requests to POST /api/v1/ai/planning/{id}/validate without JWT are rejected."""
    mock_db = MagicMock()
    app.dependency_overrides[get_mongo_db] = lambda: mock_db
    resp = client.post(f"/api/v1/ai/planning/{str(MOCK_PLAN_ID)}/validate")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


# -----------------------------------------------------------------------------
# 14. Validation of Persisted Atlas Documents
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_validate_persisted_atlas_document_via_service(mock_user, valid_prd_dict):
    """14. Validates that service loads real PRD model from repository and computes structured report."""
    mock_prd_repo = MagicMock()
    mock_prd_doc = PRD(
        id=MOCK_PLAN_ID,
        workspace_id=MOCK_WS_ID,
        feature_group_id=MOCK_FG_ID,
        title=valid_prd_dict["title"],
        version="1.0.0",
        status=PRDStatus.DRAFT,
        sections=PRDSections(**valid_prd_dict["sections"]),
        structured_prd=valid_prd_dict["structured_prd"],
        user_stories=valid_prd_dict["user_stories"],
        success_metrics=valid_prd_dict["success_metrics"],
        risk_analysis=valid_prd_dict["risk_analysis"],
        roadmap_recommendations=valid_prd_dict["roadmap_recommendations"],
    )
    mock_prd_repo.find_by_id = AsyncMock(return_value=mock_prd_doc)

    mock_ws_repo = MagicMock()
    mock_ws_repo.find_by_id = AsyncMock(return_value=MagicMock(owner_id=mock_user.id))

    mock_fb_repo = MagicMock()
    mock_fb_repo.find_by_workspace = AsyncMock(return_value=[MagicMock(id=ObjectId(MOCK_FEEDBACK_ID))])

    service = ProductPlanningService(
        agent=MagicMock(),
        prd_repo=mock_prd_repo,
        workspace_repo=mock_ws_repo,
        feedback_repo=mock_fb_repo,
    )

    result = await service.validate_plan(
        planning_id=str(MOCK_PLAN_ID),
        user=mock_user,
        workspace_id=str(MOCK_WS_ID),
    )

    assert isinstance(result, PRDValidationResult)
    assert result.planning_id == str(MOCK_PLAN_ID)
    assert result.summary.quality_score == 100
    assert result.summary.critical_issues == 0
    assert result.summary.high_severity_issues == 0
    assert result.summary.is_valid_for_review is True
    assert result.summary.has_blocking_issues is False


# -----------------------------------------------------------------------------
# 15. Confirmation That Validation Does NOT Modify PRD Data
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_validation_is_read_only_and_does_not_modify_prd(mock_user, valid_prd_dict):
    """15. Validates that PRD repository update or save methods are NEVER invoked during validation."""
    mock_prd_repo = MagicMock()
    mock_prd_doc = PRD(
        id=MOCK_PLAN_ID,
        workspace_id=MOCK_WS_ID,
        feature_group_id=MOCK_FG_ID,
        title=valid_prd_dict["title"],
        version="1.0.0",
        status=PRDStatus.PENDING_REVIEW,
        sections=PRDSections(**valid_prd_dict["sections"]),
        structured_prd=valid_prd_dict["structured_prd"],
        user_stories=valid_prd_dict["user_stories"],
        success_metrics=valid_prd_dict["success_metrics"],
        risk_analysis=valid_prd_dict["risk_analysis"],
        roadmap_recommendations=valid_prd_dict["roadmap_recommendations"],
    )
    mock_prd_repo.find_by_id = AsyncMock(return_value=mock_prd_doc)
    mock_prd_repo.update = AsyncMock()
    mock_prd_repo.create = AsyncMock()

    mock_ws_repo = MagicMock()
    mock_ws_repo.find_by_id = AsyncMock(return_value=MagicMock(owner_id=mock_user.id))

    service = ProductPlanningService(
        agent=MagicMock(),
        prd_repo=mock_prd_repo,
        workspace_repo=mock_ws_repo,
    )

    # Execute validation
    await service.validate_plan(str(MOCK_PLAN_ID), user=mock_user)

    # Explicitly assert that no write/mutation repository methods were executed
    mock_prd_repo.update.assert_not_called()
    mock_prd_repo.create.assert_not_called()
    assert mock_prd_doc.status == PRDStatus.PENDING_REVIEW
    assert mock_prd_doc.version == "1.0.0"
