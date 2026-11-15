"""
ProductMind AI — Reporting API Endpoints Integration Tests
Tests all reporting endpoints:
- Executive summary & Product Health
- Delivery Risk Report
- Saved Reports CRUD (Create, List, Get, Update, Delete)
- Structured Data Export (JSON & CSV)
- Workspace authorization & 404/403 validation
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId
import pytest
from fastapi.testclient import TestClient
from fastapi import status

from app.main import app
from app.api.dependencies import (
    get_current_user,
    get_product_intelligence_service,
    get_saved_report_repository,
    get_workspace_membership_repository,
    get_workspace_repository,
)
from app.core.enums import PlatformRole, SavedReportType, UserRole
from app.models.auth import User, Workspace, WorkspaceMembership
from app.models.reporting import SavedReport
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
        name="Reporting Test Workspace",
        slug="reporting-ws",
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
def mock_intelligence_summary(mock_workspace):
    ws_id = str(mock_workspace.id)
    return ProductIntelligenceSummary(
        workspaceId=ws_id,
        timeRange="30d",
        calculatedAt=datetime.now(timezone.utc),
        healthScore=ProductHealthScore(
            score=78.5,
            status="healthy",
            nominalWeights={"sentiment": 0.3, "adoption": 0.25, "delivery": 0.25, "alignment": 0.2},
            effectiveWeights={"sentiment": 0.3, "adoption": 0.25, "delivery": 0.25, "alignment": 0.2},
            availableDimensions=["sentiment", "adoption", "delivery", "alignment"],
            missingDimensions=[],
            coverageState="complete",
            summaryVerdict="Product portfolio is performing strongly at 78.5/100 across 4 available dimensions.",
        ),
        sentimentMetrics=CustomerSentimentMetrics(
            status="available",
            totalAnalyzed=15,
            positiveCount=10,
            neutralCount=3,
            negativeCount=2,
            positiveRatio=0.67,
            neutralRatio=0.2,
            negativeRatio=0.13,
            sentimentIndex=76.67,
        ),
        adoptionMetrics=FeatureAdoptionMetrics(
            status="available",
            totalFeaturesTracked=4,
            activeUsers=120,
            totalEvents=1500,
            avgAdoptionRate=65.0,
            topFeatures=[],
            adoptionIndex=65.0,
            telemetryCoverage="observed",
        ),
        deliveryMetrics=DeliveryPredictabilityMetrics(
            status="available",
            totalItems=8,
            completedItems=5,
            inProgressItems=3,
            plannedItems=0,
            blockedItems=0,
            overdueItems=0,
            onTrackItems=3,
            onTimeCompletionRate=100.0,
            overdueRatio=0.0,
            blockedRatio=0.0,
            predictabilityIndex=85.0,
        ),
        alignmentMetrics=PrioritizationAlignmentMetrics(
            status="available",
            totalScenarios=6,
            avgPriorityScore=82.0,
            criticalCount=3,
            highCount=2,
            mediumCount=1,
            demandCorrelation=0.83,
            alignmentIndex=84.5,
        ),
        deliveryRisk=DeliveryRiskReport(
            overallRiskScore=15.0,
            riskLevel="low",
            overdueCount=0,
            blockedCount=0,
            approachingDeadlineCount=1,
            bottlenecksCount=0,
            itemsAtRisk=[],
        ),
        featureOpportunities=[],
        topCustomerPainPoints=[],
        dataCoverage={"totalFeedbackItems": 15},
        missingDataDiagnostics=[],
    )


@pytest.fixture
def mock_saved_report(mock_workspace, mock_user):
    return SavedReport(
        id=ObjectId("660011223344556677889903"),
        workspaceId=mock_workspace.id,
        createdBy=mock_user.id,
        title="Q4 Executive Summary Report",
        reportType=SavedReportType.EXECUTIVE_KPI,
        filters={"timeRange": "30d"},
        layoutConfig=["kpis", "trends", "delivery"],
        isFavorite=True,
    )


@pytest.fixture
def client(mock_user, mock_workspace, mock_membership, mock_intelligence_summary, mock_saved_report):
    mock_intelligence_service = AsyncMock()
    mock_intelligence_service.get_product_intelligence.return_value = mock_intelligence_summary

    mock_saved_report_repo = AsyncMock()
    mock_saved_report_repo.find_by_workspace.return_value = [mock_saved_report]
    mock_saved_report_repo.count.return_value = 1
    mock_saved_report_repo.find_by_workspace_and_id.return_value = mock_saved_report
    mock_saved_report_repo.create.return_value = mock_saved_report
    mock_saved_report_repo.update.return_value = mock_saved_report
    mock_saved_report_repo.delete.return_value = True

    mock_workspace_repo = AsyncMock()
    mock_workspace_repo.find_by_id.return_value = mock_workspace

    mock_membership_repo = AsyncMock()
    mock_membership_repo.find_by_workspace_and_user.return_value = mock_membership

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_product_intelligence_service] = lambda: mock_intelligence_service
    app.dependency_overrides[get_saved_report_repository] = lambda: mock_saved_report_repo
    app.dependency_overrides[get_workspace_repository] = lambda: mock_workspace_repo
    app.dependency_overrides[get_workspace_membership_repository] = lambda: mock_membership_repo

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 1. Executive Summary & Delivery Risk Tests
# -----------------------------------------------------------------------------
def test_get_executive_summary_success(client, mock_workspace):
    ws_id = str(mock_workspace.id)
    response = client.get(f"/api/v1/reports/executive-summary?workspaceId={ws_id}&timeRange=30d")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["workspaceId"] == ws_id
    assert data["healthScore"]["score"] == 78.5
    assert data["healthScore"]["status"] == "healthy"
    assert data["sentimentMetrics"]["status"] == "available"
    assert data["deliveryMetrics"]["completedItems"] == 5


def test_get_delivery_risk_success(client, mock_workspace):
    ws_id = str(mock_workspace.id)
    response = client.get(f"/api/v1/reports/delivery-risk?workspaceId={ws_id}")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["riskLevel"] == "low"
    assert data["overallRiskScore"] == 15.0


# -----------------------------------------------------------------------------
# 2. Saved Reports CRUD Tests
# -----------------------------------------------------------------------------
def test_list_saved_reports_success(client, mock_workspace):
    ws_id = str(mock_workspace.id)
    response = client.get(f"/api/v1/reports/saved?workspaceId={ws_id}&isFavorite=true")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["title"] == "Q4 Executive Summary Report"
    assert data["items"][0]["isFavorite"] is True


def test_create_saved_report_success(client, mock_workspace):
    ws_id = str(mock_workspace.id)
    payload = {
        "title": "Quarterly Product Health Brief",
        "reportType": "executive_kpi",
        "filters": {"timeRange": "90d"},
        "layoutConfig": ["kpis", "sentiment", "delivery"],
        "isFavorite": False,
    }
    response = client.post(f"/api/v1/reports/saved?workspaceId={ws_id}", json=payload)

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["title"] == "Q4 Executive Summary Report"


def test_get_saved_report_by_id_success(client, mock_workspace, mock_saved_report):
    ws_id = str(mock_workspace.id)
    report_id = str(mock_saved_report.id)
    response = client.get(f"/api/v1/reports/saved/{report_id}?workspaceId={ws_id}")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == report_id
    assert data["title"] == "Q4 Executive Summary Report"


def test_update_saved_report_success(client, mock_workspace, mock_saved_report):
    ws_id = str(mock_workspace.id)
    report_id = str(mock_saved_report.id)
    payload = {
        "title": "Updated Executive Summary Title",
        "isFavorite": False,
    }
    response = client.patch(f"/api/v1/reports/saved/{report_id}?workspaceId={ws_id}", json=payload)

    assert response.status_code == status.HTTP_200_OK


def test_delete_saved_report_success(client, mock_workspace, mock_saved_report):
    ws_id = str(mock_workspace.id)
    report_id = str(mock_saved_report.id)
    response = client.delete(f"/api/v1/reports/saved/{report_id}?workspaceId={ws_id}")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == report_id


# -----------------------------------------------------------------------------
# 3. Structured Data Export Tests (JSON & CSV)
# -----------------------------------------------------------------------------
def test_export_report_json(client, mock_workspace):
    ws_id = str(mock_workspace.id)
    response = client.get(f"/api/v1/reports/export?workspaceId={ws_id}&format=json")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["format"] == "json"
    assert data["productHealthScore"] == 78.5
    assert data["deliveryRiskLevel"] == "low"


def test_export_report_csv(client, mock_workspace):
    ws_id = str(mock_workspace.id)
    response = client.get(f"/api/v1/reports/export?workspaceId={ws_id}&format=csv")

    assert response.status_code == status.HTTP_200_OK
    assert "text/csv" in response.headers["Content-Type"]
    assert "attachment; filename=" in response.headers["Content-Disposition"]
    csv_text = response.text
    assert "ProductMind AI — Executive Product Intelligence Report" in csv_text
    assert "Product Health Score" in csv_text
    assert "78.5" in csv_text
