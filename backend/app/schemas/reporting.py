"""
ProductMind AI — Saved Reports and Export Request/Response Schemas
Pydantic v2 schemas for SavedReport CRUD and structured data export endpoints.
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import SavedReportType


class SavedReportCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(..., min_length=3, max_length=150)
    report_type: SavedReportType = Field(default=SavedReportType.EXECUTIVE_KPI, alias="reportType")
    filters: Dict[str, Any] = Field(default_factory=lambda: {"timeRange": "30d"})
    layout_config: List[str] = Field(
        default_factory=lambda: ["kpis", "trends", "sentiment", "priorities", "delivery"],
        alias="layoutConfig",
    )
    is_favorite: bool = Field(default=False, alias="isFavorite")


class SavedReportUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: Optional[str] = Field(default=None, min_length=3, max_length=150)
    report_type: Optional[SavedReportType] = Field(default=None, alias="reportType")
    filters: Optional[Dict[str, Any]] = None
    layout_config: Optional[List[str]] = Field(default=None, alias="layoutConfig")
    is_favorite: Optional[bool] = Field(default=None, alias="isFavorite")


class SavedReportResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    workspace_id: str = Field(alias="workspaceId")
    created_by: str = Field(alias="createdBy")
    title: str
    report_type: str = Field(alias="reportType")
    filters: Dict[str, Any]
    layout_config: List[str] = Field(alias="layoutConfig")
    is_favorite: bool = Field(alias="isFavorite")
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")
    updated_at: Optional[datetime] = Field(default=None, alias="updatedAt")


class SavedReportListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total: int
    items: List[SavedReportResponse]


class ExecutiveReportExportResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    workspace_id: str = Field(alias="workspaceId")
    exported_at: datetime = Field(alias="exportedAt")
    format: str
    product_health_score: Optional[float] = Field(default=None, alias="productHealthScore")
    health_verdict: str = Field(alias="healthVerdict")
    customer_sentiment_index: Optional[float] = Field(default=None, alias="customerSentimentIndex")
    feature_adoption_index: Optional[float] = Field(default=None, alias="featureAdoptionIndex")
    delivery_predictability_index: Optional[float] = Field(default=None, alias="deliveryPredictabilityIndex")
    prioritization_alignment_index: Optional[float] = Field(default=None, alias="prioritizationAlignmentIndex")
    overall_delivery_risk: float = Field(alias="overallDeliveryRisk")
    delivery_risk_level: str = Field(alias="deliveryRiskLevel")
    top_feature_opportunities: List[Dict[str, Any]] = Field(default_factory=list, alias="topFeatureOpportunities")
    top_customer_pain_points: List[Dict[str, Any]] = Field(default_factory=list, alias="topCustomerPainPoints")
