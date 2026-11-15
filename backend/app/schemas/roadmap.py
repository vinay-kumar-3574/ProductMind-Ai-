"""
ProductMind AI — Roadmap Schemas (Pydantic DTOs)
Defines request and response schemas for ProductRoadmap containers and RoadmapItems.
"""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.core.enums import (
    RoadmapStatus,
    FeedbackPriority,
    ProductRoadmapType,
    RoadmapTimeHorizon,
    ProductRoadmapStatus,
)


# ---------------------------------------------------------------------------
# ProductRoadmap Schemas (Container)
# ---------------------------------------------------------------------------

class ProductRoadmapCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    title: str = Field(..., min_length=3, max_length=200, description="Roadmap title")
    description: str = Field(default="", max_length=2000, description="Roadmap description")
    roadmap_type: ProductRoadmapType = Field(default=ProductRoadmapType.PRODUCT, alias="roadmapType")
    time_horizon: RoadmapTimeHorizon = Field(default=RoadmapTimeHorizon.QUARTERLY, alias="timeHorizon")
    status: ProductRoadmapStatus = Field(default=ProductRoadmapStatus.ACTIVE)
    is_default: bool = Field(default=False, alias="isDefault")


class ProductRoadmapUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    roadmap_type: Optional[ProductRoadmapType] = Field(default=None, alias="roadmapType")
    time_horizon: Optional[RoadmapTimeHorizon] = Field(default=None, alias="timeHorizon")
    status: Optional[ProductRoadmapStatus] = None
    is_default: Optional[bool] = Field(default=None, alias="isDefault")
    expected_version: Optional[str] = Field(default=None, alias="expectedVersion", description="Optimistic concurrency guard")


class ProductRoadmapResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    workspace_id: str = Field(alias="workspaceId")
    legacy_id: Optional[str] = Field(default=None, alias="legacyId")
    title: str
    description: str
    roadmap_type: ProductRoadmapType = Field(alias="roadmapType")
    time_horizon: RoadmapTimeHorizon = Field(alias="timeHorizon")
    status: ProductRoadmapStatus
    is_default: bool = Field(default=False, alias="isDefault")
    created_by: Optional[str] = Field(default=None, alias="createdBy")
    creator_id: Optional[str] = Field(default=None, alias="creatorId")
    version: str = "1.0.0"
    item_count: int = Field(default=0, alias="itemCount")
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")
    updated_at: Optional[datetime] = Field(default=None, alias="updatedAt")


class ProductRoadmapListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total: int
    items: List[ProductRoadmapResponse]


# ---------------------------------------------------------------------------
# RoadmapItem Schemas
# ---------------------------------------------------------------------------

class RoadmapItemCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    roadmap_id: Optional[str] = Field(default=None, alias="roadmapId")
    feature_id: Optional[str] = Field(default=None, alias="featureId")
    feature_group_id: Optional[str] = Field(default=None, alias="featureGroupId")
    prd_id: Optional[str] = Field(default=None, alias="prdId")
    prioritization_scenario_id: Optional[str] = Field(default=None, alias="prioritizationScenarioId")
    release_id: Optional[str] = Field(default=None, alias="releaseId")
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(default="", max_length=2000)
    status: RoadmapStatus = RoadmapStatus.PLANNED
    priority: FeedbackPriority = FeedbackPriority.MEDIUM
    priority_score: Optional[float] = Field(default=None, ge=0.0, le=100.0, alias="priorityScore")
    is_committed: bool = Field(default=False, alias="isCommitted")
    owner: Optional[str] = None
    owner_id: Optional[str] = Field(default=None, alias="ownerId")
    start_date: str = Field(..., alias="startDate", pattern=r"^\d{4}-\d{2}-\d{2}$")
    target_date: str = Field(..., alias="targetDate", pattern=r"^\d{4}-\d{2}-\d{2}$")
    actual_start_date: Optional[str] = Field(default=None, alias="actualStartDate", pattern=r"^\d{4}-\d{2}-\d{2}$")
    actual_end_date: Optional[str] = Field(default=None, alias="actualEndDate", pattern=r"^\d{4}-\d{2}-\d{2}$")
    milestone: Optional[str] = None
    progress: float = Field(default=0.0, ge=0.0, le=100.0)
    dependencies: List[str] = Field(default_factory=list)
    notes: str = Field(default="", max_length=1500)

    @model_validator(mode="after")
    def validate_dates(self) -> "RoadmapItemCreate":
        if self.actual_start_date and self.actual_end_date:
            if self.actual_end_date < self.actual_start_date:
                raise ValueError("actual_end_date cannot precede actual_start_date")
        return self


class RoadmapItemUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    roadmap_id: Optional[str] = Field(default=None, alias="roadmapId")
    feature_id: Optional[str] = Field(default=None, alias="featureId")
    feature_group_id: Optional[str] = Field(default=None, alias="featureGroupId")
    prd_id: Optional[str] = Field(default=None, alias="prdId")
    prioritization_scenario_id: Optional[str] = Field(default=None, alias="prioritizationScenarioId")
    release_id: Optional[str] = Field(default=None, alias="releaseId")
    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    status: Optional[RoadmapStatus] = None
    priority: Optional[FeedbackPriority] = None
    priority_score: Optional[float] = Field(default=None, ge=0.0, le=100.0, alias="priorityScore")
    is_committed: Optional[bool] = Field(default=None, alias="isCommitted")
    owner: Optional[str] = None
    owner_id: Optional[str] = Field(default=None, alias="ownerId")
    start_date: Optional[str] = Field(default=None, alias="startDate", pattern=r"^\d{4}-\d{2}-\d{2}$")
    target_date: Optional[str] = Field(default=None, alias="targetDate", pattern=r"^\d{4}-\d{2}-\d{2}$")
    actual_start_date: Optional[str] = Field(default=None, alias="actualStartDate", pattern=r"^\d{4}-\d{2}-\d{2}$")
    actual_end_date: Optional[str] = Field(default=None, alias="actualEndDate", pattern=r"^\d{4}-\d{2}-\d{2}$")
    milestone: Optional[str] = None
    progress: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    dependencies: Optional[List[str]] = None
    notes: Optional[str] = None
    expected_version: Optional[str] = Field(default=None, alias="expectedVersion", description="Optimistic concurrency guard")

    @model_validator(mode="after")
    def validate_dates(self) -> "RoadmapItemUpdate":
        if self.actual_start_date and self.actual_end_date:
            if self.actual_end_date < self.actual_start_date:
                raise ValueError("actual_end_date cannot precede actual_start_date")
        return self


class RoadmapItemResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    workspace_id: str = Field(alias="workspaceId")
    roadmap_id: Optional[str] = Field(default=None, alias="roadmapId")
    feature_id: Optional[str] = Field(default=None, alias="featureId")
    feature_group_id: Optional[str] = Field(default=None, alias="featureGroupId")
    prd_id: Optional[str] = Field(default=None, alias="prdId")
    prioritization_scenario_id: Optional[str] = Field(default=None, alias="prioritizationScenarioId")
    release_id: Optional[str] = Field(default=None, alias="releaseId")
    legacy_id: Optional[str] = Field(default=None, alias="legacyId")
    title: str
    description: str
    status: RoadmapStatus
    priority: FeedbackPriority
    priority_score: Optional[float] = Field(default=None, alias="priorityScore")
    is_committed: bool = Field(default=False, alias="isCommitted")
    owner: Optional[str] = None
    owner_id: Optional[str] = Field(default=None, alias="ownerId")
    start_date: str = Field(alias="startDate")
    target_date: str = Field(alias="targetDate")
    actual_start_date: Optional[str] = Field(default=None, alias="actualStartDate")
    actual_end_date: Optional[str] = Field(default=None, alias="actualEndDate")
    milestone: Optional[str] = None
    progress: float
    dependencies: List[str] = Field(default_factory=list)
    notes: str
    version: str = "1.0.0"
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")
    updated_at: Optional[datetime] = Field(default=None, alias="updatedAt")


class RoadmapItemListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total: int
    items: List[RoadmapItemResponse]
