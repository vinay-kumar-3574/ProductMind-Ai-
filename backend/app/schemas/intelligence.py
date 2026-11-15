"""
ProductMind AI — Cross-Domain Product Intelligence Schemas
Pydantic v2 domain schemas defining deterministic metrics for Product Health,
Customer Sentiment, Feature Adoption, Delivery Predictability, Prioritization Alignment,
Delivery Risk, and Feature Opportunities.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CustomerSentimentMetrics(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: str = Field(description="'available' or 'insufficient_data'")
    total_analyzed: int = Field(default=0, alias="totalAnalyzed")
    positive_count: int = Field(default=0, alias="positiveCount")
    neutral_count: int = Field(default=0, alias="neutralCount")
    negative_count: int = Field(default=0, alias="negativeCount")
    positive_ratio: float = Field(default=0.0, alias="positiveRatio")
    neutral_ratio: float = Field(default=0.0, alias="neutralRatio")
    negative_ratio: float = Field(default=0.0, alias="negativeRatio")
    sentiment_index: Optional[float] = Field(default=None, alias="sentimentIndex", ge=0.0, le=100.0)


class TopFeatureMetric(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    event_count: int = Field(alias="eventCount")
    unique_users: Optional[int] = Field(default=None, alias="uniqueUsers")
    adoption_percent: Optional[float] = Field(default=None, alias="adoptionPercent")
    trend_delta_percent: Optional[float] = Field(default=None, alias="trendDeltaPercent")


class FeatureAdoptionMetrics(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: str = Field(description="'available' or 'insufficient_data'")
    total_features_tracked: int = Field(default=0, alias="totalFeaturesTracked")
    active_users: Optional[int] = Field(default=None, alias="activeUsers")
    total_events: int = Field(default=0, alias="totalEvents")
    avg_adoption_rate: Optional[float] = Field(default=None, alias="avgAdoptionRate", ge=0.0, le=100.0)
    top_features: List[TopFeatureMetric] = Field(default_factory=list, alias="topFeatures")
    adoption_index: Optional[float] = Field(default=None, alias="adoptionIndex", ge=0.0, le=100.0)
    telemetry_coverage: str = Field(default="no_data", alias="telemetryCoverage")


class DeliveryPredictabilityMetrics(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: str = Field(description="'available' or 'insufficient_data'")
    total_items: int = Field(default=0, alias="totalItems")
    completed_items: int = Field(default=0, alias="completedItems")
    in_progress_items: int = Field(default=0, alias="inProgressItems")
    planned_items: int = Field(default=0, alias="plannedItems")
    blocked_items: int = Field(default=0, alias="blockedItems")
    overdue_items: int = Field(default=0, alias="overdueItems")
    on_track_items: int = Field(default=0, alias="onTrackItems")
    on_time_completion_rate: Optional[float] = Field(default=None, alias="onTimeCompletionRate")
    overdue_ratio: float = Field(default=0.0, alias="overdueRatio")
    blocked_ratio: float = Field(default=0.0, alias="blockedRatio")
    predictability_index: Optional[float] = Field(default=None, alias="predictabilityIndex", ge=0.0, le=100.0)


class PrioritizationAlignmentMetrics(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: str = Field(description="'available' or 'insufficient_data'")
    total_scenarios: int = Field(default=0, alias="totalScenarios")
    avg_priority_score: Optional[float] = Field(default=None, alias="avgPriorityScore", ge=0.0, le=100.0)
    critical_count: int = Field(default=0, alias="criticalCount")
    high_count: int = Field(default=0, alias="highCount")
    medium_count: int = Field(default=0, alias="mediumCount")
    demand_correlation: Optional[float] = Field(default=None, alias="demandCorrelation")
    alignment_index: Optional[float] = Field(default=None, alias="alignmentIndex", ge=0.0, le=100.0)


class ProductHealthScore(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    score: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    status: str = Field(description="'healthy', 'needs_attention', 'at_risk', 'insufficient_data', or 'unavailable'")
    nominal_weights: Dict[str, float] = Field(alias="nominalWeights")
    effective_weights: Dict[str, float] = Field(alias="effectiveWeights")
    available_dimensions: List[str] = Field(default_factory=list, alias="availableDimensions")
    missing_dimensions: List[str] = Field(default_factory=list, alias="missingDimensions")
    coverage_state: str = Field(alias="coverageState", description="'complete', 'partial', or 'unavailable'")
    summary_verdict: str = Field(alias="summaryVerdict")


class DeliveryRiskItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    item_id: str = Field(alias="itemId")
    title: str
    status: str
    target_date: str = Field(alias="targetDate")
    progress: float
    days_overdue_or_remaining: int = Field(alias="daysOverdueOrRemaining")
    risk_type: str = Field(alias="riskType", description="'overdue', 'approaching_deadline', 'blocked', 'dependency_bottleneck'")
    severity: str = Field(description="'critical', 'high', 'medium'")
    reason: str
    blocked_by: List[str] = Field(default_factory=list, alias="blockedBy")


class DeliveryRiskReport(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    overall_risk_score: float = Field(alias="overallRiskScore", ge=0.0, le=100.0)
    risk_level: str = Field(alias="riskLevel", description="'low', 'medium', 'high', or 'critical'")
    overdue_count: int = Field(default=0, alias="overdueCount")
    blocked_count: int = Field(default=0, alias="blockedCount")
    approaching_deadline_count: int = Field(default=0, alias="approachingDeadlineCount")
    bottlenecks_count: int = Field(default=0, alias="bottlenecksCount")
    items_at_risk: List[DeliveryRiskItem] = Field(default_factory=list, alias="itemsAtRisk")


class FeatureOpportunityItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    feature_group_id: Optional[str] = Field(default=None, alias="featureGroupId")
    title: str
    category: str = "Feature Request"
    demand_count: int = Field(default=0, alias="demandCount")
    urgency_level: str = Field(default="Medium", alias="urgencyLevel")
    current_adoption_percent: Optional[float] = Field(default=None, alias="currentAdoptionPercent")
    negative_sentiment_count: int = Field(default=0, alias="negativeSentimentCount")
    opportunity_score: float = Field(alias="opportunityScore", ge=0.0, le=100.0)
    reason: str
    key_pain_points: List[str] = Field(default_factory=list, alias="keyPainPoints")


class CustomerPainPointItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    theme: str
    customer_pain_point: str = Field(alias="customerPainPoint")
    severity: str = Field(default="Medium")
    frequency: int = Field(default=1)
    sample_feedback_ids: List[str] = Field(default_factory=list, alias="sampleFeedbackIds")


class ProductIntelligenceSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    workspace_id: str = Field(alias="workspaceId")
    time_range: str = Field(default="30d", alias="timeRange")
    calculated_at: datetime = Field(alias="calculatedAt")
    health_score: ProductHealthScore = Field(alias="healthScore")
    sentiment_metrics: CustomerSentimentMetrics = Field(alias="sentimentMetrics")
    adoption_metrics: FeatureAdoptionMetrics = Field(alias="adoptionMetrics")
    delivery_metrics: DeliveryPredictabilityMetrics = Field(alias="deliveryMetrics")
    alignment_metrics: PrioritizationAlignmentMetrics = Field(alias="alignmentMetrics")
    delivery_risk: DeliveryRiskReport = Field(alias="deliveryRisk")
    feature_opportunities: List[FeatureOpportunityItem] = Field(default_factory=list, alias="featureOpportunities")
    top_customer_pain_points: List[CustomerPainPointItem] = Field(default_factory=list, alias="topCustomerPainPoints")
    data_coverage: Dict[str, Any] = Field(default_factory=dict, alias="dataCoverage")
    missing_data_diagnostics: List[str] = Field(default_factory=list, alias="missingDataDiagnostics")
