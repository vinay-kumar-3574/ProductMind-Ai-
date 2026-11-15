"""
ProductMind AI — Roadmap & Product Roadmap API Endpoints
Provides authenticated, workspace-scoped RESTful endpoints for ProductRoadmap
containers and RoadmapItems backed by MongoDB Atlas.
"""

import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status

from app.api.dependencies import (
    get_current_user,
    get_roadmap_service,
)
from app.models.auth import User
from app.core.enums import RoadmapStatus, ProductRoadmapStatus
from app.schemas.roadmap import (
    ProductRoadmapCreate,
    ProductRoadmapUpdate,
    ProductRoadmapResponse,
    ProductRoadmapListResponse,
    RoadmapItemCreate,
    RoadmapItemUpdate,
    RoadmapItemResponse,
    RoadmapItemListResponse,
    RoadmapCandidateItem,
    RoadmapCandidateListResponse,
    PromotePRDRequest,
    PromotePRDResponse,
)
from app.services.roadmap_service import RoadmapService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/roadmap", tags=["Roadmap"])


# ===========================================================================
# ProductRoadmap Container Endpoints
# ===========================================================================

@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="Create Product Roadmap",
    description="Creates a new ProductRoadmap container within an authorized workspace.",
    response_model=ProductRoadmapResponse,
)
async def create_product_roadmap(
    request: ProductRoadmapCreate,
    workspace_id: str = Query(..., description="Target workspace ID"),
    current_user: User = Depends(get_current_user),
    service: RoadmapService = Depends(get_roadmap_service),
) -> ProductRoadmapResponse:
    """Creates a new ProductRoadmap container."""
    try:
        return await service.create_roadmap(
            workspace_id=workspace_id,
            request=request,
            user=current_user,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error creating product roadmap: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating product roadmap.",
        )


@router.get(
    "/",
    status_code=status.HTTP_200_OK,
    summary="List Product Roadmaps",
    description="Retrieves a list of ProductRoadmap containers for the specified workspace.",
    response_model=ProductRoadmapListResponse,
)
async def list_product_roadmaps(
    workspace_id: str = Query(..., description="Target workspace ID"),
    status: Optional[ProductRoadmapStatus] = Query(None, description="Filter by roadmap status ('Active', 'Archived', 'Draft')"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    service: RoadmapService = Depends(get_roadmap_service),
) -> ProductRoadmapListResponse:
    """Lists workspace roadmaps with aggregated item counts."""
    try:
        return await service.list_roadmaps(
            workspace_id=workspace_id,
            user=current_user,
            status_filter=status,
            skip=skip,
            limit=limit,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error listing product roadmaps: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error listing product roadmaps.",
        )


# ===========================================================================
# Feature Prioritization & Approved PRD Candidate / Promotion Endpoints
# ===========================================================================

@router.get(
    "/candidates",
    status_code=status.HTTP_200_OK,
    summary="Get Roadmap Candidates",
    description="Retrieves feature groups and PRD deliverables eligible for roadmap commitment, calculating approval status and priority scores.",
    response_model=RoadmapCandidateListResponse,
)
async def get_roadmap_candidates(
    workspace_id: str = Query(..., description="Target workspace ID"),
    current_user: User = Depends(get_current_user),
    service: RoadmapService = Depends(get_roadmap_service),
) -> RoadmapCandidateListResponse:
    """Retrieves feature groups and PRDs eligible for roadmap commitment."""
    try:
        return await service.get_candidates(
            workspace_id=workspace_id,
            user=current_user,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error retrieving roadmap candidates: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving roadmap candidates.",
        )


@router.post(
    "/promote-prd",
    status_code=status.HTTP_201_CREATED,
    summary="Promote Approved PRD to Roadmap",
    description="Commits deliverables from an Approved PRD to the active roadmap container. Strict business rule: non-approved PRDs are rejected.",
    response_model=PromotePRDResponse,
)
async def promote_approved_prd(
    request: PromotePRDRequest,
    workspace_id: str = Query(..., description="Target workspace ID"),
    current_user: User = Depends(get_current_user),
    service: RoadmapService = Depends(get_roadmap_service),
) -> PromotePRDResponse:
    """Promotes an approved PRD into formal roadmap item(s)."""
    try:
        return await service.promote_approved_prd(
            workspace_id=workspace_id,
            request=request,
            user=current_user,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error promoting approved PRD: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error promoting approved PRD to roadmap.",
        )


# ===========================================================================
# RoadmapItem Endpoints
# ===========================================================================

@router.post(
    "/items",
    status_code=status.HTTP_201_CREATED,
    summary="Create Roadmap Item",
    description="Creates a new RoadmapItem in the specified workspace.",
    response_model=RoadmapItemResponse,
)
async def create_roadmap_item(
    request: RoadmapItemCreate,
    workspace_id: str = Query(..., description="Target workspace ID"),
    current_user: User = Depends(get_current_user),
    service: RoadmapService = Depends(get_roadmap_service),
) -> RoadmapItemResponse:
    """Creates a new RoadmapItem."""
    try:
        return await service.create_item(
            workspace_id=workspace_id,
            request=request,
            user=current_user,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error creating roadmap item: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating roadmap item.",
        )


@router.get(
    "/items",
    status_code=status.HTTP_200_OK,
    summary="List Roadmap Items",
    description="Retrieves paginated roadmap items for a workspace with multi-attribute filtering.",
    response_model=RoadmapItemListResponse,
)
async def list_roadmap_items(
    workspace_id: str = Query(..., description="Target workspace ID"),
    roadmap_id: Optional[str] = Query(None, description="Optional filter by parent roadmap ID"),
    status: Optional[RoadmapStatus] = Query(None, description="Optional filter by execution status"),
    milestone: Optional[str] = Query(None, description="Optional filter by milestone string"),
    is_committed: Optional[bool] = Query(None, description="Optional filter by commitment status"),
    start_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Filter start date >= YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Filter target date <= YYYY-MM-DD"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    service: RoadmapService = Depends(get_roadmap_service),
) -> RoadmapItemListResponse:
    """Lists workspace roadmap items with query filtering."""
    try:
        return await service.list_items(
            workspace_id=workspace_id,
            user=current_user,
            roadmap_id=roadmap_id,
            status_filter=status,
            milestone=milestone,
            is_committed=is_committed,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error listing roadmap items: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error listing roadmap items.",
        )


@router.get(
    "/items/{item_id}",
    status_code=status.HTTP_200_OK,
    summary="Retrieve Roadmap Item by ID",
    description="Retrieves a single RoadmapItem by its ID within the workspace.",
    response_model=RoadmapItemResponse,
)
async def get_roadmap_item(
    item_id: str = Path(..., description="Roadmap item ID"),
    workspace_id: str = Query(..., description="Target workspace ID"),
    current_user: User = Depends(get_current_user),
    service: RoadmapService = Depends(get_roadmap_service),
) -> RoadmapItemResponse:
    """Retrieves an individual RoadmapItem."""
    try:
        return await service.get_item(
            workspace_id=workspace_id,
            item_id=item_id,
            user=current_user,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error retrieving roadmap item '%s': %s", item_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving roadmap item.",
        )


@router.put(
    "/items/{item_id}",
    status_code=status.HTTP_200_OK,
    summary="Update Roadmap Item",
    description="Updates a RoadmapItem with optimistic concurrency control.",
    response_model=RoadmapItemResponse,
)
async def update_roadmap_item(
    request: RoadmapItemUpdate,
    item_id: str = Path(..., description="Roadmap item ID"),
    workspace_id: str = Query(..., description="Target workspace ID"),
    current_user: User = Depends(get_current_user),
    service: RoadmapService = Depends(get_roadmap_service),
) -> RoadmapItemResponse:
    """Updates a RoadmapItem with version verification."""
    try:
        return await service.update_item(
            workspace_id=workspace_id,
            item_id=item_id,
            request=request,
            user=current_user,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error updating roadmap item '%s': %s", item_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating roadmap item.",
        )


@router.delete(
    "/items/{item_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Roadmap Item",
    description="Permanently deletes a RoadmapItem from the workspace.",
    response_model=Dict[str, Any],
)
async def delete_roadmap_item(
    item_id: str = Path(..., description="Roadmap item ID"),
    workspace_id: str = Query(..., description="Target workspace ID"),
    current_user: User = Depends(get_current_user),
    service: RoadmapService = Depends(get_roadmap_service),
) -> Dict[str, Any]:
    """Permanently deletes a RoadmapItem."""
    try:
        return await service.delete_item(
            workspace_id=workspace_id,
            item_id=item_id,
            user=current_user,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error deleting roadmap item '%s': %s", item_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deleting roadmap item.",
        )


# ===========================================================================
# ProductRoadmap by ID Endpoints (Registered after specific static paths)
# ===========================================================================

@router.get(
    "/{roadmap_id}",
    status_code=status.HTTP_200_OK,
    summary="Retrieve Product Roadmap by ID",
    description="Retrieves an individual ProductRoadmap by its ID within the workspace.",
    response_model=ProductRoadmapResponse,
)
async def get_product_roadmap(
    roadmap_id: str = Path(..., description="Product roadmap ID"),
    workspace_id: str = Query(..., description="Target workspace ID"),
    current_user: User = Depends(get_current_user),
    service: RoadmapService = Depends(get_roadmap_service),
) -> ProductRoadmapResponse:
    """Retrieves an individual ProductRoadmap."""
    try:
        return await service.get_roadmap(
            workspace_id=workspace_id,
            roadmap_id=roadmap_id,
            user=current_user,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error retrieving product roadmap '%s': %s", roadmap_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving product roadmap.",
        )


@router.put(
    "/{roadmap_id}",
    status_code=status.HTTP_200_OK,
    summary="Update Product Roadmap",
    description="Updates a ProductRoadmap container with optimistic concurrency protection.",
    response_model=ProductRoadmapResponse,
)
async def update_product_roadmap(
    request: ProductRoadmapUpdate,
    roadmap_id: str = Path(..., description="Product roadmap ID"),
    workspace_id: str = Query(..., description="Target workspace ID"),
    current_user: User = Depends(get_current_user),
    service: RoadmapService = Depends(get_roadmap_service),
) -> ProductRoadmapResponse:
    """Updates a ProductRoadmap container."""
    try:
        return await service.update_roadmap(
            workspace_id=workspace_id,
            roadmap_id=roadmap_id,
            request=request,
            user=current_user,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error updating product roadmap '%s': %s", roadmap_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating product roadmap.",
        )


@router.delete(
    "/{roadmap_id}",
    status_code=status.HTTP_200_OK,
    summary="Archive Product Roadmap",
    description="Marks a ProductRoadmap container as Archived.",
    response_model=ProductRoadmapResponse,
)
async def archive_product_roadmap(
    roadmap_id: str = Path(..., description="Product roadmap ID"),
    workspace_id: str = Query(..., description="Target workspace ID"),
    current_user: User = Depends(get_current_user),
    service: RoadmapService = Depends(get_roadmap_service),
) -> ProductRoadmapResponse:
    """Archives a ProductRoadmap container."""
    try:
        return await service.archive_roadmap(
            workspace_id=workspace_id,
            roadmap_id=roadmap_id,
            user=current_user,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error archiving product roadmap '%s': %s", roadmap_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error archiving product roadmap.",
        )
