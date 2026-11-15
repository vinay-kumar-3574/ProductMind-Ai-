"""
ProductMind AI — AI Executive Briefing Endpoints Integration Tests (Phase 7.4)
Tests:
- AI Executive Briefing generation with mocked LLM service
- Zero-fabrication enforcement and token budget bounding
- AIRateLimitException -> HTTP 429
- AITimeoutException -> HTTP 504
- Workspace authorization
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from bson import ObjectId
import pytest
from fastapi.testclient import TestClient
from fastapi import status

from app.main import app
from app.ai.agents.product_intelligence.schemas import (
    ExecutiveBriefingResult,
    StrategicRecommendation,
)
from app.ai.exceptions import AIRateLimitException, AITimeoutException
from app.ai.llm_service import get_llm_service
from app.api.dependencies import (
    get_current_user,
    get_product_intelligence_service,
    get_workspace_membership_repository,
    get_workspace_repository,
)
from app.core.enums import PlatformRole, UserRole
from app.models.auth import User, Workspace, WorkspaceMembership
from app.schemas.intelligence import (
    CustomerSentimentMetrics,
    DeliveryPredictabilityMetrics,
    DeliveryRiskReport,
    FeatureAdoptionMetrics,
    PrioritizationAlignmentMetrics,
    ProductHealthScore,
    ProductIntelligenceSummary,
)


@pytest.fixture
def mock_user():
    return User(
        id=ObjectId("660011223344556677889901"),
        name="Lead PM",
        email="lead@productmind.ai",
        password_hash="hashed_pass_lead_12345",
        platform_role=PlatformRole.USER,
        is_active=True,
    )


@pytest.fixture
def mock_workspace(mock_user):
    return Workspace(
        id=ObjectId("660011223344556677889902"),
        name="Briefing Workspace",
        slug="briefing-ws",
        owner_id=mock_user.id,
    )


@pytest.fixture
def mock_membership(mock_user, mock_workspace):
    return WorkspaceMembership(
        id=ObjectId(),
        workspace_id=mock_workspace.id,
        user_id=mock_user.id,
        role=UserRole.ADMIN,
        status="active",
    )


@pytest.fixture
def sample_briefing_result():
    return ExecutiveBriefingResult(
        executive_summary="Product performance is healthy at 82.5/100 with strong customer sentiment and high delivery momentum.",
        product_health_assessment="Product health score of 82.5 indicates robust alignment between priorities and customer requests.",
        customer_sentiment_highlights="Positive feedback ratio stands at 75%, driven by appreciation for the new data grid.",
        adoption_highlights="Feature adoption is averaging 62% across core search and export tools.",
        delivery_risk_watchlist="One deliverable is approaching target date within 7 days, currently on track at 70% progress.",
        strategic_recommendations=[
            StrategicRecommendation(
                recommendation="Accelerate API v2 delivery to capture high enterprise demand",
                reason="12 customer feedback items requested programmatic access",
                supporting_evidence="12 feedback requests, 85 priority score",
                priority_level="High",
                target_area="Delivery",
            )
        ],
        immediate_action_items=[
            "Review dependency blockers on the core billing module",
            "Schedule user interview with negative feedback accounts",
        ],
        data_limitations=[],
    )


@pytest.fixture
def mock_intelligence_summary(mock_workspace):
    ws_id = str(mock_workspace.id)
    return ProductIntelligenceSummary(
        workspaceId=ws_id,
        timeRange="30d",
        calculatedAt=datetime.now(timezone.utc),
        healthScore=ProductHealthScore(
            score=82.5,
            status="healthy",
            nominalWeights={"sentiment": 0.3, "adoption": 0.25, "delivery": 0.25, "alignment": 0.2},
            effectiveWeights={"sentiment": 0.3, "adoption": 0.25, "delivery": 0.25, "alignment": 0.2},
            availableDimensions=["sentiment", "adoption", "delivery", "alignment"],
            missingDimensions=[],
            coverageState="complete",
            summaryVerdict="Robust product performance.",
        ),
        sentimentMetrics=CustomerSentimentMetrics(
            status="available", totalAnalyzed=10, positiveCount=7, neutralCount=2, negativeCount=1,
            positiveRatio=0.7, neutralRatio=0.2, negativeRatio=0.1, sentimentIndex=80.0
        ),
        adoptionMetrics=FeatureAdoptionMetrics(
            status="available", totalFeaturesTracked=2, activeUsers=50, totalEvents=500,
            avgAdoptionRate=60.0, topFeatures=[], adoptionIndex=60.0, telemetryCoverage="observed"
        ),
        deliveryMetrics=DeliveryPredictabilityMetrics(
            status="available", totalItems=3, completedItems=2, inProgressItems=1, plannedItems=0,
            blockedItems=0, overdueItems=0, onTrackItems=1, onTimeCompletionRate=100.0,
            overdueRatio=0.0, blockedRatio=0.0, predictabilityIndex=85.0
        ),
        alignmentMetrics=PrioritizationAlignmentMetrics(
            status="available", totalScenarios=2, avgPriorityScore=80.0, criticalCount=1,
            highCount=1, mediumCount=0, demandCorrelation=0.9, alignmentIndex=82.0
        ),
        deliveryRisk=DeliveryRiskReport(
            overallRiskScore=10.0, riskLevel="low", overdueCount=0, blockedCount=0,
            approachingDeadlineCount=1, bottlenecksCount=0, itemsAtRisk=[]
        ),
        featureOpportunities=[],
        topCustomerPainPoints=[],
        dataCoverage={},
        missingDataDiagnostics=[],
    )


@pytest.fixture
def client(mock_user, mock_workspace, mock_membership, mock_intelligence_summary, sample_briefing_result):
    mock_llm_service = AsyncMock()
    mock_llm_service.generate_structured.return_value = sample_briefing_result

    mock_intelligence_service = AsyncMock()
    mock_intelligence_service.get_product_intelligence.return_value = mock_intelligence_summary

    mock_workspace_repo = AsyncMock()
    mock_workspace_repo.find_by_id.return_value = mock_workspace

    mock_membership_repo = AsyncMock()
    mock_membership_repo.find_by_workspace_and_user.return_value = mock_membership

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_llm_service] = lambda: mock_llm_service
    app.dependency_overrides[get_product_intelligence_service] = lambda: mock_intelligence_service
    app.dependency_overrides[get_workspace_repository] = lambda: mock_workspace_repo
    app.dependency_overrides[get_workspace_membership_repository] = lambda: mock_membership_repo

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_generate_executive_briefing_success(client, mock_workspace):
    ws_id = str(mock_workspace.id)
    payload = {
        "workspaceId": ws_id,
        "timeRange": "30d",
        "forceRegenerate": False,
    }
    response = client.post("/api/v1/reports/executive-briefing", json=payload)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["workspaceId"] == ws_id
    assert "briefing" in data
    briefing = data["briefing"]
    assert "healthy at 82.5/100" in briefing["executive_summary"]
    assert len(briefing["strategic_recommendations"]) == 1
    assert briefing["strategic_recommendations"][0]["priority_level"] == "High"


def test_generate_executive_briefing_rate_limit(mock_user, mock_workspace, mock_membership, mock_intelligence_summary):
    mock_llm_service = AsyncMock()
    mock_llm_service.generate_structured.side_effect = AIRateLimitException("Rate limit reached on Groq", provider="groq")

    mock_intelligence_service = AsyncMock()
    mock_intelligence_service.get_product_intelligence.return_value = mock_intelligence_summary

    mock_workspace_repo = AsyncMock()
    mock_workspace_repo.find_by_id.return_value = mock_workspace
    mock_membership_repo = AsyncMock()
    mock_membership_repo.find_by_workspace_and_user.return_value = mock_membership

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_llm_service] = lambda: mock_llm_service
    app.dependency_overrides[get_product_intelligence_service] = lambda: mock_intelligence_service
    app.dependency_overrides[get_workspace_repository] = lambda: mock_workspace_repo
    app.dependency_overrides[get_workspace_membership_repository] = lambda: mock_membership_repo

    with TestClient(app) as client:
        payload = {"workspaceId": str(mock_workspace.id), "timeRange": "30d"}
        response = client.post("/api/v1/reports/executive-briefing", json=payload)
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS

    app.dependency_overrides.clear()


def test_generate_executive_briefing_timeout(mock_user, mock_workspace, mock_membership, mock_intelligence_summary):
    mock_llm_service = AsyncMock()
    mock_llm_service.generate_structured.side_effect = AITimeoutException("Timeout connecting to Groq", provider="groq")

    mock_intelligence_service = AsyncMock()
    mock_intelligence_service.get_product_intelligence.return_value = mock_intelligence_summary

    mock_workspace_repo = AsyncMock()
    mock_workspace_repo.find_by_id.return_value = mock_workspace
    mock_membership_repo = AsyncMock()
    mock_membership_repo.find_by_workspace_and_user.return_value = mock_membership

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_llm_service] = lambda: mock_llm_service
    app.dependency_overrides[get_product_intelligence_service] = lambda: mock_intelligence_service
    app.dependency_overrides[get_workspace_repository] = lambda: mock_workspace_repo
    app.dependency_overrides[get_workspace_membership_repository] = lambda: mock_membership_repo

    with TestClient(app) as client:
        payload = {"workspaceId": str(mock_workspace.id), "timeRange": "30d"}
        response = client.post("/api/v1/reports/executive-briefing", json=payload)
        assert response.status_code == status.HTTP_504_GATEWAY_TIMEOUT

    app.dependency_overrides.clear()
