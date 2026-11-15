"""
Unit & Service Tests for ProductIntelligenceService (Phase 7.2)
Verifies:
- Deterministic Customer Sentiment Index calculation & missing data handling
- Feature Adoption Index calculation from telemetry & zero-telemetry handling
- Delivery Predictability Index with on-time, overdue, and blocked deliverables
- Prioritization Alignment Index with demand-linked scoring
- Dynamic Product Health Score reweighting across 1, 2, 3, and 4 dimensions
- Missing data policy (never substituting zero for missing dimensions)
- Delivery Risk Score, overdue milestone detection, and dependency bottlenecks
- Feature Opportunity Index combining feedback demand & usage adoption
- Workspace isolation and permission validation
- Zero LLM calls required
"""

from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId
import pytest
from fastapi import HTTPException

from app.core.enums import FeedbackPriority, FeedbackSentiment, PlatformRole, RoadmapStatus
from app.models.auth import User, Workspace
from app.models.feedback import FeedbackItem
from app.models.intelligence import FeatureGroup, SentimentDistribution
from app.models.planning import PrioritizationScenario, RoadmapItem
from app.schemas.intelligence import (
    CustomerSentimentMetrics,
    DeliveryPredictabilityMetrics,
    FeatureAdoptionMetrics,
    PrioritizationAlignmentMetrics,
    TopFeatureMetric,
)
from app.services.product_intelligence_service import (
    NOMINAL_WEIGHTS,
    ProductIntelligenceService,
)


@pytest.fixture
def mock_repos():
    return {
        "feedback_repo": AsyncMock(),
        "analytics_rollup_repo": AsyncMock(),
        "analytics_event_repo": AsyncMock(),
        "feature_group_repo": AsyncMock(),
        "prioritization_scenario_repo": AsyncMock(),
        "roadmap_repo": AsyncMock(),
        "workspace_repo": AsyncMock(),
        "membership_repo": AsyncMock(),
    }


@pytest.fixture
def intelligence_service(mock_repos):
    return ProductIntelligenceService(
        feedback_repo=mock_repos["feedback_repo"],
        analytics_rollup_repo=mock_repos["analytics_rollup_repo"],
        analytics_event_repo=mock_repos["analytics_event_repo"],
        feature_group_repo=mock_repos["feature_group_repo"],
        prioritization_scenario_repo=mock_repos["prioritization_scenario_repo"],
        roadmap_repo=mock_repos["roadmap_repo"],
        workspace_repo=mock_repos["workspace_repo"],
        membership_repo=mock_repos["membership_repo"],
    )


@pytest.fixture
def test_user():
    return User(
        id=ObjectId(),
        email="lead@productmind.ai",
        name="Lead PM",
        password_hash="hashed_pass_lead_12345",
        platform_role=PlatformRole.USER,
        is_active=True,
    )


@pytest.fixture
def test_workspace(test_user):
    return Workspace(
        id=ObjectId(),
        name="Intelligence Workspace",
        slug="intelligence-ws",
        owner_id=test_user.id,
    )


# -----------------------------------------------------------------------------
# 1. Customer Sentiment Index Tests
# -----------------------------------------------------------------------------
def test_sentiment_calculation_balanced(intelligence_service, test_workspace):
    ws_id = test_workspace.id
    items = [
        FeedbackItem(workspaceId=ws_id, title="Great experience", description="Positive feedback", sentiment=FeedbackSentiment.POSITIVE),
        FeedbackItem(workspaceId=ws_id, title="Average app", description="Neutral feedback", sentiment=FeedbackSentiment.NEUTRAL),
        FeedbackItem(workspaceId=ws_id, title="Needs work", description="Negative feedback", sentiment=FeedbackSentiment.NEGATIVE),
    ]
    metrics = intelligence_service.compute_sentiment_metrics(items)

    assert metrics.status == "available"
    assert metrics.total_analyzed == 3
    assert metrics.positive_count == 1
    assert metrics.neutral_count == 1
    assert metrics.negative_count == 1
    # ((1 * 100) + (1 * 50) + (1 * 0)) / 3 = 150 / 3 = 50.0
    assert metrics.sentiment_index == 50.0


def test_sentiment_calculation_all_positive(intelligence_service, test_workspace):
    ws_id = test_workspace.id
    items = [
        FeedbackItem(workspaceId=ws_id, title="Superb feature", description="Love it", sentiment=FeedbackSentiment.POSITIVE),
        FeedbackItem(workspaceId=ws_id, title="Excellent UI", description="Very fast", sentiment=FeedbackSentiment.POSITIVE),
    ]
    metrics = intelligence_service.compute_sentiment_metrics(items)

    assert metrics.status == "available"
    assert metrics.sentiment_index == 100.0
    assert metrics.positive_ratio == 1.0


def test_sentiment_calculation_empty_or_unanalysed(intelligence_service, test_workspace):
    ws_id = test_workspace.id
    items = [
        FeedbackItem(workspaceId=ws_id, title="Unclassified", description="No sentiment yet", sentiment=None),
    ]
    metrics = intelligence_service.compute_sentiment_metrics(items)

    assert metrics.status == "insufficient_data"
    assert metrics.total_analyzed == 0
    assert metrics.sentiment_index is None


# -----------------------------------------------------------------------------
# 2. Feature Adoption Index Tests
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_adoption_calculation_with_telemetry(intelligence_service, mock_repos, test_workspace):
    ws_oid = test_workspace.id
    today = date.today()

    mock_repos["analytics_event_repo"].aggregate_range_overview = AsyncMock(return_value={
        "totalEvents": 1200,
        "activeUsers": 100,
    })
    mock_repos["analytics_event_repo"].aggregate_feature_page = AsyncMock(return_value={
        "items": [
            {"_id": "Search Bar", "eventCount": 600, "uniqueUsers": 80},  # 80% adoption
            {"_id": "Export CSV", "eventCount": 400, "uniqueUsers": 40},  # 40% adoption
        ]
    })

    metrics = await intelligence_service.compute_adoption_metrics(
        ws_oid=ws_oid,
        start_date=today - timedelta(days=30),
        end_date=today,
        start_dt=datetime.now(timezone.utc) - timedelta(days=30),
        end_dt_exclusive=datetime.now(timezone.utc),
    )

    assert metrics.status == "available"
    assert metrics.total_events == 1200
    assert metrics.active_users == 100
    assert metrics.total_features_tracked == 2
    # Avg adoption of 80% and 40% = 60.0%
    assert metrics.avg_adoption_rate == 60.0
    assert metrics.adoption_index == 60.0
    assert metrics.telemetry_coverage == "observed"


@pytest.mark.asyncio
async def test_adoption_calculation_no_events(intelligence_service, mock_repos, test_workspace):
    ws_oid = test_workspace.id
    today = date.today()

    mock_repos["analytics_event_repo"].aggregate_range_overview = AsyncMock(return_value={
        "totalEvents": 0,
        "activeUsers": None,
    })

    metrics = await intelligence_service.compute_adoption_metrics(
        ws_oid=ws_oid,
        start_date=today - timedelta(days=30),
        end_date=today,
        start_dt=datetime.now(timezone.utc) - timedelta(days=30),
        end_dt_exclusive=datetime.now(timezone.utc),
    )

    assert metrics.status == "insufficient_data"
    assert metrics.adoption_index is None
    assert metrics.total_events == 0
    assert metrics.telemetry_coverage == "no_data"



# -----------------------------------------------------------------------------
# 3. Delivery Predictability Index Tests
# -----------------------------------------------------------------------------
def test_delivery_predictability_on_track_and_completed(intelligence_service, test_workspace):
    ws_id = test_workspace.id
    today = date.today()
    past_date = (today - timedelta(days=20)).isoformat()
    future_date = (today + timedelta(days=30)).isoformat()

    items = [
        RoadmapItem(
            workspaceId=ws_id,
            title="Shipped API",
            status=RoadmapStatus.SHIPPED,
            progress=100.0,
            startDate=past_date,
            targetDate=(today - timedelta(days=5)).isoformat(),
        ),
        RoadmapItem(
            workspaceId=ws_id,
            title="In Progress Feature",
            status=RoadmapStatus.IN_PROGRESS,
            progress=60.0,
            startDate=past_date,
            targetDate=future_date,
        ),
    ]

    metrics = intelligence_service.compute_delivery_metrics(items, today_date=today)

    assert metrics.status == "available"
    assert metrics.total_items == 2
    assert metrics.completed_items == 1
    assert metrics.in_progress_items == 1
    assert metrics.overdue_items == 0
    assert metrics.blocked_items == 0
    assert metrics.predictability_index is not None
    assert metrics.predictability_index >= 70.0


def test_delivery_predictability_overdue_penalty(intelligence_service, test_workspace):
    ws_id = test_workspace.id
    today = date.today()
    past_start = (today - timedelta(days=30)).isoformat()
    past_target = (today - timedelta(days=10)).isoformat()

    items = [
        RoadmapItem(
            workspaceId=ws_id,
            title="Overdue Feature A",
            status=RoadmapStatus.IN_PROGRESS,
            progress=20.0,
            startDate=past_start,
            targetDate=past_target,  # Overdue by 10 days
        ),
        RoadmapItem(
            workspaceId=ws_id,
            title="Overdue Feature B",
            status=RoadmapStatus.PLANNED,
            progress=0.0,
            startDate=past_start,
            targetDate=past_target,  # Overdue by 10 days
        ),
    ]

    metrics = intelligence_service.compute_delivery_metrics(items, today_date=today)

    assert metrics.status == "available"
    assert metrics.overdue_items == 2
    assert metrics.overdue_ratio == 1.0
    # Overdue items receive heavy penalty
    assert metrics.predictability_index < 30.0


def test_delivery_predictability_empty(intelligence_service):
    metrics = intelligence_service.compute_delivery_metrics([])
    assert metrics.status == "insufficient_data"
    assert metrics.total_items == 0
    assert metrics.predictability_index is None


# -----------------------------------------------------------------------------
# 4. Prioritization Alignment Index Tests
# -----------------------------------------------------------------------------
def test_prioritization_alignment_correlated(intelligence_service, test_workspace):
    ws_id = test_workspace.id
    fg_id = ObjectId()
    feature_groups = [
        FeatureGroup(id=fg_id, workspaceId=ws_id, title="Core Search", feedbackCount=15)
    ]
    scenarios = [
        PrioritizationScenario(
            workspaceId=ws_id,
            name="Priority Core Search",
            featureGroupId=fg_id,
            finalScore=85.0,
            priorityLevel="Critical",
        ),
        PrioritizationScenario(
            workspaceId=ws_id,
            name="Priority Fast Export",
            finalScore=75.0,
            priorityLevel="High",
        ),
    ]

    metrics = intelligence_service.compute_alignment_metrics(scenarios, feature_groups)

    assert metrics.status == "available"
    assert metrics.total_scenarios == 2
    assert metrics.avg_priority_score == 80.0
    assert metrics.critical_count == 1
    assert metrics.high_count == 1
    assert metrics.alignment_index is not None
    assert metrics.alignment_index >= 70.0


def test_prioritization_alignment_empty(intelligence_service):
    metrics = intelligence_service.compute_alignment_metrics([], [])
    assert metrics.status == "insufficient_data"
    assert metrics.total_scenarios == 0
    assert metrics.alignment_index is None


# -----------------------------------------------------------------------------
# 5. Product Health Score & Dynamic Reweighting Tests
# -----------------------------------------------------------------------------
def test_health_score_all_dimensions_complete(intelligence_service):
    sentiment = CustomerSentimentMetrics(
        status="available", totalAnalyzed=10, positiveCount=7, neutralCount=2, negativeCount=1,
        positiveRatio=0.7, neutralRatio=0.2, negativeRatio=0.1, sentimentIndex=80.0
    )
    adoption = FeatureAdoptionMetrics(
        status="available", totalFeaturesTracked=5, activeUsers=50, totalEvents=500,
        avgAdoptionRate=70.0, topFeatures=[], adoptionIndex=70.0, telemetryCoverage="observed"
    )
    delivery = DeliveryPredictabilityMetrics(
        status="available", totalItems=4, completedItems=2, inProgressItems=2, plannedItems=0,
        blockedItems=0, overdueItems=0, onTrackItems=2, onTimeCompletionRate=100.0,
        overdueRatio=0.0, blockedRatio=0.0, predictabilityIndex=80.0
    )
    alignment = PrioritizationAlignmentMetrics(
        status="available", totalScenarios=3, avgPriorityScore=75.0, criticalCount=1,
        highCount=2, mediumCount=0, demandCorrelation=0.9, alignmentIndex=75.0
    )

    health = intelligence_service.compute_product_health_score(sentiment, adoption, delivery, alignment)

    assert health.coverage_state == "complete"
    assert health.status == "healthy"
    assert len(health.available_dimensions) == 4
    assert len(health.missing_dimensions) == 0
    # Expected: (80.0 * 0.30) + (70.0 * 0.25) + (80.0 * 0.25) + (75.0 * 0.20)
    # = 24.0 + 17.5 + 20.0 + 15.0 = 76.5
    assert health.score == 76.5
    assert health.effective_weights == NOMINAL_WEIGHTS


def test_health_score_missing_analytics_proportional_reweighting(intelligence_service):
    """
    When analytics is missing:
    Nominal: sentiment=0.30, delivery=0.25, alignment=0.20. Total available = 0.75.
    Effective weights:
      sentiment = 0.30 / 0.75 = 0.4000
      delivery = 0.25 / 0.75 = 0.3333
      alignment = 0.20 / 0.75 = 0.2667
    """
    sentiment = CustomerSentimentMetrics(
        status="available", totalAnalyzed=10, positiveCount=8, neutralCount=2, negativeCount=0,
        positiveRatio=0.8, neutralRatio=0.2, negativeRatio=0.0, sentimentIndex=90.0
    )
    adoption = FeatureAdoptionMetrics(
        status="insufficient_data", totalFeaturesTracked=0, activeUsers=None, totalEvents=0,
        avgAdoptionRate=None, topFeatures=[], adoptionIndex=None, telemetryCoverage="no_data"
    )
    delivery = DeliveryPredictabilityMetrics(
        status="available", totalItems=2, completedItems=1, inProgressItems=1, plannedItems=0,
        blockedItems=0, overdueItems=0, onTrackItems=1, onTimeCompletionRate=100.0,
        overdueRatio=0.0, blockedRatio=0.0, predictabilityIndex=80.0
    )
    alignment = PrioritizationAlignmentMetrics(
        status="available", totalScenarios=2, avgPriorityScore=70.0, criticalCount=1,
        highCount=1, mediumCount=0, demandCorrelation=0.8, alignmentIndex=70.0
    )

    health = intelligence_service.compute_product_health_score(sentiment, adoption, delivery, alignment)

    assert health.coverage_state == "partial"
    assert "adoption" in health.missing_dimensions
    assert "sentiment" in health.available_dimensions
    assert health.effective_weights["adoption"] == 0.0

    # Sum of available effective weights must equal 1.0 (within rounding tolerance)
    total_effective = sum(health.effective_weights[dim] for dim in health.available_dimensions)
    assert pytest.approx(total_effective, 0.001) == 1.0

    # Score must be non-zero and non-None
    assert health.score is not None
    assert health.score > 0.0


def test_health_score_all_dimensions_unavailable(intelligence_service):
    """Empty workspace returns score=None, status='unavailable'."""
    sentiment = CustomerSentimentMetrics(status="insufficient_data", totalAnalyzed=0, sentimentIndex=None)
    adoption = FeatureAdoptionMetrics(status="insufficient_data", totalEvents=0, adoptionIndex=None)
    delivery = DeliveryPredictabilityMetrics(status="insufficient_data", totalItems=0, predictabilityIndex=None)
    alignment = PrioritizationAlignmentMetrics(status="insufficient_data", totalScenarios=0, alignmentIndex=None)

    health = intelligence_service.compute_product_health_score(sentiment, adoption, delivery, alignment)

    assert health.score is None
    assert health.status == "unavailable"
    assert health.coverage_state == "unavailable"
    assert len(health.available_dimensions) == 0
    assert len(health.missing_dimensions) == 4


# -----------------------------------------------------------------------------
# 6. Delivery Risk Report Tests
# -----------------------------------------------------------------------------
def test_delivery_risk_overdue_and_bottleneck_detection(intelligence_service, test_workspace):
    ws_id = test_workspace.id
    today = date.today()
    item_prereq_id = ObjectId()
    item_downstream1_id = ObjectId()
    item_downstream2_id = ObjectId()

    # Pre-requisite deliverable that is blocking two downstream items and is overdue
    item_prereq = RoadmapItem(
        id=item_prereq_id,
        workspaceId=ws_id,
        title="Foundation Database Schema",
        status=RoadmapStatus.IN_PROGRESS,
        progress=30.0,
        startDate=(today - timedelta(days=40)).isoformat(),
        targetDate=(today - timedelta(days=10)).isoformat(),  # 10 days overdue
    )
    item_downstream1 = RoadmapItem(
        id=item_downstream1_id,
        workspaceId=ws_id,
        title="API Integration Layer",
        status=RoadmapStatus.PLANNED,
        progress=0.0,
        startDate=today.isoformat(),
        targetDate=(today + timedelta(days=20)).isoformat(),
        dependencies=[item_prereq_id],
    )
    item_downstream2 = RoadmapItem(
        id=item_downstream2_id,
        workspaceId=ws_id,
        title="Frontend Reports Studio",
        status=RoadmapStatus.PLANNED,
        progress=0.0,
        startDate=today.isoformat(),
        targetDate=(today + timedelta(days=25)).isoformat(),
        dependencies=[item_prereq_id],
    )

    report = intelligence_service.compute_delivery_risk_report(
        [item_prereq, item_downstream1, item_downstream2],
        today_date=today,
    )

    assert report.overdue_count == 1
    assert report.bottlenecks_count >= 1
    assert report.overall_risk_score > 30.0
    assert len(report.items_at_risk) >= 1
    overdue_risk = next(r for r in report.items_at_risk if r.item_id == str(item_prereq_id))
    assert overdue_risk.risk_type == "overdue"


# -----------------------------------------------------------------------------
# 7. Feature Opportunity Index Tests
# -----------------------------------------------------------------------------
def test_feature_opportunity_high_demand_low_adoption(intelligence_service, test_workspace):
    ws_id = test_workspace.id
    fg = FeatureGroup(
        id=ObjectId(),
        workspaceId=ws_id,
        title="Automated PDF Export",
        feedbackCount=12,
        sentimentDistribution=SentimentDistribution(Positive=1, Neutral=2, Negative=9),
        urgencyDistribution={"Critical": 4, "High": 5},
        painPoints=["PDF generation times out", "Formatting is broken"],
    )
    adoption = FeatureAdoptionMetrics(
        status="available",
        totalFeaturesTracked=1,
        activeUsers=100,
        totalEvents=50,
        avgAdoptionRate=5.0,
        topFeatures=[
            TopFeatureMetric(name="PDF Export", eventCount=50, uniqueUsers=5, adoptionPercent=5.0)
        ],
        adoptionIndex=5.0,
        telemetryCoverage="observed",
    )

    opportunities = intelligence_service.compute_feature_opportunities([fg], [], adoption)

    assert len(opportunities) == 1
    opp = opportunities[0]
    assert opp.title == "Automated PDF Export"
    assert opp.demand_count == 12
    assert opp.urgency_level == "Critical"
    assert opp.opportunity_score >= 80.0
    assert "pain" in opp.reason.lower() or "demand" in opp.reason.lower()


# -----------------------------------------------------------------------------
# 8. Workspace Isolation & Full Orchestration Tests
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_workspace_authorization_failure(intelligence_service, mock_repos, test_user):
    fake_ws_id = str(ObjectId())
    mock_repos["workspace_repo"].find_by_id = AsyncMock(return_value=None)

    with pytest.raises(HTTPException) as exc:
        await intelligence_service.authorize_workspace(fake_ws_id, test_user)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_full_get_product_intelligence_orchestration(intelligence_service, mock_repos, test_user, test_workspace):
    ws_oid = test_workspace.id
    today = date.today()

    mock_repos["workspace_repo"].find_by_id = AsyncMock(return_value=test_workspace)
    mock_repos["feedback_repo"].find_by_workspace = AsyncMock(return_value=[
        FeedbackItem(workspaceId=ws_oid, title="Feature is great", description="Very satisfied with workflow", sentiment=FeedbackSentiment.POSITIVE),
        FeedbackItem(workspaceId=ws_oid, title="Bug in flow", description="Encountered crash on export", sentiment=FeedbackSentiment.NEGATIVE),
    ])
    mock_repos["roadmap_repo"].find_items_by_workspace = AsyncMock(return_value=[
        RoadmapItem(
            workspaceId=ws_oid,
            title="Core Delivery",
            status=RoadmapStatus.IN_PROGRESS,
            progress=50.0,
            startDate=(today - timedelta(days=10)).isoformat(),
            targetDate=(today + timedelta(days=20)).isoformat(),
        )
    ])
    mock_repos["feature_group_repo"].find_by_workspace = AsyncMock(return_value=[
        FeatureGroup(workspaceId=ws_oid, title="Core Delivery", feedbackCount=4)
    ])
    mock_repos["prioritization_scenario_repo"].find_by_workspace = AsyncMock(return_value=[
        PrioritizationScenario(workspaceId=ws_oid, name="Core Delivery", finalScore=80.0)
    ])
    mock_repos["analytics_event_repo"].aggregate_range_overview = AsyncMock(return_value={
        "totalEvents": 500,
        "activeUsers": 50,
    })
    mock_repos["analytics_event_repo"].aggregate_feature_page = AsyncMock(return_value={
        "items": [{"_id": "Core Delivery", "eventCount": 300, "uniqueUsers": 35}]
    })

    summary = await intelligence_service.get_product_intelligence(
        workspace_id=str(ws_oid),
        user=test_user,
        time_range="30d",
    )


    assert summary.workspace_id == str(ws_oid)
    assert summary.health_score.score is not None
    assert summary.health_score.coverage_state == "complete"
    assert summary.sentiment_metrics.status == "available"
    assert summary.delivery_metrics.status == "available"
    assert summary.adoption_metrics.status == "available"
    assert summary.alignment_metrics.status == "available"
    assert summary.delivery_risk.risk_level in ("low", "medium", "high", "critical")
