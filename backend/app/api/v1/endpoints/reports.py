"""
ProductMind AI — Executive Reporting & Saved Reports Endpoints
Provides authenticated endpoints for:
- Executive Summary & Product Health Metrics
- Delivery Risk Assessment & Bottleneck Watchlist
- Saved Reports Management (Atlas CRUD)
- Structured Data Export (JSON / CSV)
"""

import csv
from datetime import date, datetime, timezone
import io
import logging
from typing import Any, Dict, List, Literal, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.dependencies import (
    get_current_user,
    get_product_intelligence_service,
    get_saved_report_repository,
    get_workspace_membership_repository,
    get_workspace_repository,
)
from app.api.workspace_access import load_accessible_workspace
from app.database.objectid import PyObjectId
from app.models.auth import User, Workspace
from app.models.reporting import SavedReport
from app.repositories import (
    SavedReportRepository,
    WorkspaceMembershipRepository,
    WorkspaceRepository,
)
from app.schemas.intelligence import (
    DeliveryRiskReport,
    ProductIntelligenceSummary,
)
from app.schemas.reporting import (
    ExecutiveReportExportResponse,
    SavedReportCreate,
    SavedReportListResponse,
    SavedReportResponse,
    SavedReportUpdate,
)
from app.services.product_intelligence_service import ProductIntelligenceService

logger = logging.getLogger("productmind.api.reports")

router = APIRouter(prefix="/reports", tags=["Reporting & Executive Analytics"])


def _to_report_response(saved: SavedReport) -> SavedReportResponse:
    report_type_str = (
        saved.report_type.value
        if hasattr(saved.report_type, "value")
        else str(saved.report_type)
    )
    return SavedReportResponse(
        id=str(saved.id),
        workspaceId=str(saved.workspace_id),
        createdBy=str(saved.created_by),
        title=saved.title,
        reportType=report_type_str,
        filters=saved.filters or {},
        layoutConfig=saved.layout_config or [],
        isFavorite=bool(saved.is_favorite),
        createdAt=saved.created_at,
        updatedAt=saved.updated_at,
    )


# -----------------------------------------------------------------------------
# 1. Executive Summary & Product Health
# -----------------------------------------------------------------------------
@router.get(
    "/executive-summary",
    response_model=ProductIntelligenceSummary,
    summary="Get unified executive summary and product health metrics",
)
async def get_executive_summary(
    workspace_id: str = Query(..., alias="workspaceId"),
    time_range: Optional[Literal["7d", "30d", "90d", "all"]] = Query(
        default="30d", alias="timeRange"
    ),
    start_date: Optional[date] = Query(default=None, alias="startDate"),
    end_date: Optional[date] = Query(default=None, alias="endDate"),
    current_user: User = Depends(get_current_user),
    service: ProductIntelligenceService = Depends(get_product_intelligence_service),
) -> ProductIntelligenceSummary:
    """
    Computes cross-domain product intelligence metrics:
    - Product Health Score (0-100) with dynamic reweighting
    - Customer Sentiment Index
    - Feature Adoption Index
    - Delivery Predictability Index
    - Prioritization Alignment Index
    - Delivery Risk Score
    - Top Feature Opportunities & Pain Points
    """
    return await service.get_product_intelligence(
        workspace_id=workspace_id,
        user=current_user,
        time_range=time_range or "30d",
        start_date=start_date,
        end_date=end_date,
    )


# -----------------------------------------------------------------------------
# 2. Delivery Risk & Bottleneck Analysis
# -----------------------------------------------------------------------------
@router.get(
    "/delivery-risk",
    response_model=DeliveryRiskReport,
    summary="Get delivery risk report and deliverable bottlenecks",
)
async def get_delivery_risk(
    workspace_id: str = Query(..., alias="workspaceId"),
    current_user: User = Depends(get_current_user),
    service: ProductIntelligenceService = Depends(get_product_intelligence_service),
) -> DeliveryRiskReport:
    """
    Analyzes active roadmap deliverables to identify:
    - Overdue deliverables and milestones
    - Blocked items
    - Items approaching deadline (< 14 days) with insufficient progress
    - Dependency bottlenecks blocking multiple downstream initiatives
    """
    summary = await service.get_product_intelligence(
        workspace_id=workspace_id,
        user=current_user,
    )
    return summary.delivery_risk


# -----------------------------------------------------------------------------
# 3. Saved Reports Management (Atlas CRUD)
# -----------------------------------------------------------------------------
@router.get(
    "/saved",
    response_model=SavedReportListResponse,
    summary="List saved reports for workspace",
)
async def list_saved_reports(
    workspace_id: str = Query(..., alias="workspaceId"),
    is_favorite: Optional[bool] = Query(default=None, alias="isFavorite"),
    limit: int = Query(default=50, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repository),
    membership_repo: WorkspaceMembershipRepository = Depends(get_workspace_membership_repository),
    saved_report_repo: SavedReportRepository = Depends(get_saved_report_repository),
) -> SavedReportListResponse:
    workspace, _, _, _ = await load_accessible_workspace(
        workspace_id, current_user, workspace_repo, membership_repo
    )
    filter_query: Dict[str, Any] = {}
    if is_favorite is not None:
        filter_query["isFavorite"] = is_favorite

    items = await saved_report_repo.find_by_workspace(
        workspace.id,
        filter_query=filter_query if filter_query else None,
        sort=[("createdAt", -1)],
        limit=limit,
        skip=skip,
    )
    total = await saved_report_repo.count(workspace.id, filter_query=filter_query if filter_query else None)

    return SavedReportListResponse(
        total=total,
        items=[_to_report_response(item) for item in items],
    )


@router.post(
    "/saved",
    response_model=SavedReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new saved report configuration",
)
async def create_saved_report(
    payload: SavedReportCreate,
    workspace_id: str = Query(..., alias="workspaceId"),
    current_user: User = Depends(get_current_user),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repository),
    membership_repo: WorkspaceMembershipRepository = Depends(get_workspace_membership_repository),
    saved_report_repo: SavedReportRepository = Depends(get_saved_report_repository),
) -> SavedReportResponse:
    workspace, _, _, _ = await load_accessible_workspace(
        workspace_id, current_user, workspace_repo, membership_repo
    )
    model = SavedReport(
        workspaceId=workspace.id,
        createdBy=current_user.id,
        title=payload.title.strip(),
        reportType=payload.report_type,
        filters=payload.filters,
        layoutConfig=payload.layout_config,
        isFavorite=payload.is_favorite,
    )
    created = await saved_report_repo.create(model)
    return _to_report_response(created)


@router.get(
    "/saved/{report_id}",
    response_model=SavedReportResponse,
    summary="Retrieve a specific saved report configuration",
)
async def get_saved_report(
    report_id: str,
    workspace_id: str = Query(..., alias="workspaceId"),
    current_user: User = Depends(get_current_user),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repository),
    membership_repo: WorkspaceMembershipRepository = Depends(get_workspace_membership_repository),
    saved_report_repo: SavedReportRepository = Depends(get_saved_report_repository),
) -> SavedReportResponse:
    workspace, _, _, _ = await load_accessible_workspace(
        workspace_id, current_user, workspace_repo, membership_repo
    )
    report = await saved_report_repo.find_by_workspace_and_id(workspace.id, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved report not found",
        )
    return _to_report_response(report)


@router.patch(
    "/saved/{report_id}",
    response_model=SavedReportResponse,
    summary="Update a saved report configuration",
)
async def update_saved_report(
    report_id: str,
    payload: SavedReportUpdate,
    workspace_id: str = Query(..., alias="workspaceId"),
    current_user: User = Depends(get_current_user),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repository),
    membership_repo: WorkspaceMembershipRepository = Depends(get_workspace_membership_repository),
    saved_report_repo: SavedReportRepository = Depends(get_saved_report_repository),
) -> SavedReportResponse:
    workspace, _, _, _ = await load_accessible_workspace(
        workspace_id, current_user, workspace_repo, membership_repo
    )
    existing = await saved_report_repo.find_by_workspace_and_id(workspace.id, report_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved report not found",
        )

    updates: Dict[str, Any] = {}
    if payload.title is not None:
        updates["title"] = payload.title.strip()
    if payload.report_type is not None:
        updates["reportType"] = payload.report_type
    if payload.filters is not None:
        updates["filters"] = payload.filters
    if payload.layout_config is not None:
        updates["layoutConfig"] = payload.layout_config
    if payload.is_favorite is not None:
        updates["isFavorite"] = payload.is_favorite

    if not updates:
        return _to_report_response(existing)

    updates["updatedAt"] = datetime.now(timezone.utc)
    updated = await saved_report_repo.update(
        existing.id, updates, workspace_id=workspace.id
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update saved report",
        )
    return _to_report_response(updated)


@router.delete(
    "/saved/{report_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a saved report configuration",
)
async def delete_saved_report(
    report_id: str,
    workspace_id: str = Query(..., alias="workspaceId"),
    current_user: User = Depends(get_current_user),
    workspace_repo: WorkspaceRepository = Depends(get_workspace_repository),
    membership_repo: WorkspaceMembershipRepository = Depends(get_workspace_membership_repository),
    saved_report_repo: SavedReportRepository = Depends(get_saved_report_repository),
) -> Dict[str, Any]:
    workspace, _, _, _ = await load_accessible_workspace(
        workspace_id, current_user, workspace_repo, membership_repo
    )
    existing = await saved_report_repo.find_by_workspace_and_id(workspace.id, report_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved report not found",
        )

    deleted = await saved_report_repo.delete(existing.id, workspace_id=workspace.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete saved report",
        )
    return {
        "message": "Saved report deleted successfully",
        "id": str(existing.id),
    }


# -----------------------------------------------------------------------------
# 4. Structured Data Export (JSON / CSV)
# -----------------------------------------------------------------------------
@router.get(
    "/export",
    summary="Export verified product intelligence report as JSON or CSV",
)
async def export_report(
    workspace_id: str = Query(..., alias="workspaceId"),
    format: Literal["json", "csv"] = Query(default="json"),
    time_range: Optional[Literal["7d", "30d", "90d", "all"]] = Query(
        default="30d", alias="timeRange"
    ),
    current_user: User = Depends(get_current_user),
    service: ProductIntelligenceService = Depends(get_product_intelligence_service),
):
    """
    Exports verified executive summary data in either JSON or CSV format.
    Never uses mock data or unverified fallbacks.
    """
    summary = await service.get_product_intelligence(
        workspace_id=workspace_id,
        user=current_user,
        time_range=time_range or "30d",
    )

    if format == "json":
        return ExecutiveReportExportResponse(
            workspaceId=str(summary.workspace_id),
            exportedAt=datetime.now(timezone.utc),
            format="json",
            productHealthScore=summary.health_score.score,
            healthVerdict=summary.health_score.summary_verdict,
            customerSentimentIndex=summary.sentiment_metrics.sentiment_index,
            featureAdoptionIndex=summary.adoption_metrics.adoption_index,
            deliveryPredictabilityIndex=summary.delivery_metrics.predictability_index,
            prioritizationAlignmentIndex=summary.alignment_metrics.alignment_index,
            overallDeliveryRisk=summary.delivery_risk.overall_risk_score,
            deliveryRiskLevel=summary.delivery_risk.risk_level,
            topFeatureOpportunities=[
                {
                    "title": opp.title,
                    "demand": opp.demand_count,
                    "urgency": opp.urgency_level,
                    "opportunityScore": opp.opportunity_score,
                    "reason": opp.reason,
                }
                for opp in summary.feature_opportunities
            ],
            topCustomerPainPoints=[
                {
                    "theme": pp.theme,
                    "painPoint": pp.customer_pain_point,
                    "severity": pp.severity,
                    "frequency": pp.frequency,
                }
                for pp in summary.top_customer_pain_points
            ],
        )

    # Generate CSV payload
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["ProductMind AI — Executive Product Intelligence Report"])
    writer.writerow(["Workspace ID", summary.workspace_id])
    writer.writerow(["Exported At (UTC)", datetime.now(timezone.utc).isoformat()])
    writer.writerow(["Time Window", summary.time_range])
    writer.writerow([])

    writer.writerow(["--- EXECUTIVE HEALTH INDICATORS ---"])
    writer.writerow(["Metric", "Score / Index", "Status", "Notes"])
    writer.writerow([
        "Product Health Score",
        summary.health_score.score if summary.health_score.score is not None else "N/A",
        summary.health_score.status,
        summary.health_score.summary_verdict,
    ])
    writer.writerow([
        "Customer Sentiment Index",
        summary.sentiment_metrics.sentiment_index if summary.sentiment_metrics.sentiment_index is not None else "N/A",
        summary.sentiment_metrics.status,
        f"{summary.sentiment_metrics.positive_count} Pos / {summary.sentiment_metrics.neutral_count} Neu / {summary.sentiment_metrics.negative_count} Neg",
    ])
    writer.writerow([
        "Feature Adoption Index",
        summary.adoption_metrics.adoption_index if summary.adoption_metrics.adoption_index is not None else "N/A",
        summary.adoption_metrics.status,
        f"{summary.adoption_metrics.total_events} events, {summary.adoption_metrics.active_users or 0} active users",
    ])
    writer.writerow([
        "Delivery Predictability Index",
        summary.delivery_metrics.predictability_index if summary.delivery_metrics.predictability_index is not None else "N/A",
        summary.delivery_metrics.status,
        f"{summary.delivery_metrics.completed_items} shipped, {summary.delivery_metrics.overdue_items} overdue, {summary.delivery_metrics.blocked_items} blocked",
    ])
    writer.writerow([
        "Prioritization Alignment Index",
        summary.alignment_metrics.alignment_index if summary.alignment_metrics.alignment_index is not None else "N/A",
        summary.alignment_metrics.status,
        f"{summary.alignment_metrics.total_scenarios} prioritized scenarios",
    ])
    writer.writerow([
        "Delivery Risk Score",
        summary.delivery_risk.overall_risk_score,
        summary.delivery_risk.risk_level,
        f"{len(summary.delivery_risk.items_at_risk)} items requiring attention",
    ])
    writer.writerow([])

    writer.writerow(["--- TOP FEATURE OPPORTUNITIES ---"])
    writer.writerow(["Title", "Demand Count", "Urgency", "Opportunity Score", "Reason"])
    for opp in summary.feature_opportunities:
        writer.writerow([opp.title, opp.demand_count, opp.urgency_level, opp.opportunity_score, opp.reason])
    writer.writerow([])

    writer.writerow(["--- TOP CUSTOMER PAIN POINTS ---"])
    writer.writerow(["Theme", "Pain Point", "Severity", "Frequency"])
    for pp in summary.top_customer_pain_points:
        writer.writerow([pp.theme, pp.customer_pain_point, pp.severity, pp.frequency])

    csv_content = output.getvalue()
    filename = f"product_intelligence_report_{summary.workspace_id}_{summary.time_range}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
