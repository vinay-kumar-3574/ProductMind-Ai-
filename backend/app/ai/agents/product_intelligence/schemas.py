"""
ProductMind AI — Executive Briefing Agent Schemas
Defines structured domain schemas for LLM-generated executive product briefings.
Enforces evidence-grounded outputs and strict zero-fabrication rules.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class StrategicRecommendation(BaseModel):
    recommendation: str = Field(..., description="Actionable recommendation for product leaders")
    reason: str = Field(..., description="Evidence-based reasoning behind this recommendation")
    supporting_evidence: str = Field(..., description="Direct metrics or feedback evidence supporting the recommendation")
    priority_level: str = Field(default="High", description="'Critical', 'High', or 'Medium'")
    target_area: str = Field(default="Strategy", description="'Sentiment', 'Adoption', 'Delivery', or 'Strategy'")


class ExecutiveBriefingResult(BaseModel):
    executive_summary: str = Field(..., min_length=20, description="Concise high-level synopsis for executive stakeholders")
    product_health_assessment: str = Field(..., description="Assessment of overall product health score and status")
    customer_sentiment_highlights: str = Field(..., description="Analysis of customer sentiment index, ratios, and top complaints")
    adoption_highlights: str = Field(..., description="Highlights of feature usage, telemetry adoption, and trends")
    delivery_risk_watchlist: str = Field(..., description="Watchlist of overdue deliverables, blocked items, and dependency risks")
    strategic_recommendations: List[StrategicRecommendation] = Field(
        default_factory=list, description="Ranked strategic recommendations for leadership"
    )
    immediate_action_items: List[str] = Field(
        default_factory=list, description="Immediate 7-14 day concrete action steps"
    )
    data_limitations: List[str] = Field(
        default_factory=list, description="Explicit data gaps or unverified signals"
    )
    model_metadata: Optional[Dict[str, Any]] = None


class ExecutiveBriefingRequest(BaseModel):
    workspace_id: str = Field(alias="workspaceId")
    time_range: str = Field(default="30d", alias="timeRange")
    force_regenerate: bool = Field(default=False, alias="forceRegenerate")


class ExecutiveBriefingResponse(BaseModel):
    workspace_id: str = Field(alias="workspaceId")
    generated_at: datetime = Field(alias="generatedAt")
    briefing: ExecutiveBriefingResult
    source_summary: Dict[str, Any] = Field(alias="sourceSummary")
