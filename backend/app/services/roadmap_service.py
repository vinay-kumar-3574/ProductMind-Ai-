"""
ProductMind AI — Roadmap Service
Encapsulates business logic, workspace authorization, optimistic concurrency,
and data validation for ProductRoadmaps and RoadmapItems.
"""

import logging
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException, status

from app.models.auth import User
from app.models.planning import ProductRoadmap, RoadmapItem
from app.core.enums import (
    PlatformRole,
    MembershipStatus,
    RoadmapStatus,
    ProductRoadmapStatus,
    ProductRoadmapType,
    RoadmapTimeHorizon,
)
from app.schemas.roadmap import (
    ProductRoadmapCreate,
    ProductRoadmapUpdate,
    ProductRoadmapResponse,
    ProductRoadmapListResponse,
    RoadmapItemCreate,
    RoadmapItemUpdate,
    RoadmapItemResponse,
    RoadmapItemListResponse,
)
from app.repositories import (
    RoadmapRepository,
    ProductRoadmapRepository,
    WorkspaceRepository,
    WorkspaceMembershipRepository,
    PRDRepository,
    FeatureGroupRepository,
)

logger = logging.getLogger(__name__)


def bump_semver(current_version: Optional[str], bump_type: str = "patch") -> str:
    """Safely increments a semantic version string (patch/minor/major/none)."""
    b_type = (bump_type or "patch").lower().strip()
    if b_type == "none":
        return current_version or "1.0.0"

    v_str = (current_version or "1.0.0").strip()
    parts = v_str.split(".")
    try:
        major = int(parts[0])
        minor = int(parts[1]) if len(parts) > 1 else 0
        patch = int(parts[2].split("-")[0].split("+")[0]) if len(parts) > 2 else 0

        if b_type == "major":
            return f"{major + 1}.0.0"
        elif b_type == "minor":
            return f"{major}.{minor + 1}.0"
        else:
            return f"{major}.{minor}.{patch + 1}"
    except (ValueError, IndexError):
        return "1.0.1"


class RoadmapService:
    """Service handling multi-tenant ProductRoadmap and RoadmapItem domain logic."""

    def __init__(
        self,
        roadmap_repo: RoadmapRepository,
        product_roadmap_repo: ProductRoadmapRepository,
        workspace_repo: WorkspaceRepository,
        membership_repo: WorkspaceMembershipRepository,
        prd_repo: Optional[PRDRepository] = None,
        feature_group_repo: Optional[FeatureGroupRepository] = None,
    ):
        self.roadmap_repo = roadmap_repo
        self.product_roadmap_repo = product_roadmap_repo
        self.workspace_repo = workspace_repo
        self.membership_repo = membership_repo
        self.prd_repo = prd_repo
        self.feature_group_repo = feature_group_repo

    # ---------------------------------------------------------------------------
    # Authorization & Tenant Isolation
    # ---------------------------------------------------------------------------

    async def verify_workspace_access(self, user: User, workspace_id: Any) -> None:
        """
        Enforces strict workspace authorization.
        Permits access if user is platform admin, workspace owner, or active member.
        Raises HTTP 403 Forbidden or 400/404 if access is denied or invalid.
        """
        if user.platform_role == PlatformRole.PLATFORM_ADMIN:
            return

        if self.workspace_repo is None or self.membership_repo is None:
            return

        ws_str = str(workspace_id)
        if not ObjectId.is_valid(ws_str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid workspace ID format: '{ws_str}'",
            )

        ws_oid = ObjectId(ws_str)
        workspace = await self.workspace_repo.find_by_id(ws_oid)
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found",
            )

        # Workspace owner check
        if workspace.owner_id == user.id:
            return

        # Active membership check
        membership = None
        if hasattr(self.membership_repo, "find_membership"):
            membership = await self.membership_repo.find_membership(ws_oid, user.id)
        elif hasattr(self.membership_repo, "find_by_workspace_and_user"):
            membership = await self.membership_repo.find_by_workspace_and_user(workspace_id=ws_oid, user_id=user.id)

        if not membership or membership.status != MembershipStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: user is not an active member of this workspace",
            )

    # ---------------------------------------------------------------------------
    # ProductRoadmap Container Management
    # ---------------------------------------------------------------------------

    async def create_roadmap(
        self,
        workspace_id: str,
        request: ProductRoadmapCreate,
        user: User,
    ) -> ProductRoadmapResponse:
        await self.verify_workspace_access(user, workspace_id)
        ws_oid = ObjectId(workspace_id)

        roadmap_doc = ProductRoadmap(
            workspace_id=ws_oid,
            title=request.title.strip(),
            description=request.description.strip(),
            roadmap_type=request.roadmap_type,
            time_horizon=request.time_horizon,
            status=request.status,
            is_default=request.is_default,
            created_by=user.name,
            creator_id=user.id,
            version="1.0.0",
        )
        saved = await self.product_roadmap_repo.create_roadmap(roadmap_doc)
        return self._format_roadmap_response(saved, item_count=0)

    async def list_roadmaps(
        self,
        workspace_id: str,
        user: User,
        status_filter: Optional[ProductRoadmapStatus] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> ProductRoadmapListResponse:
        await self.verify_workspace_access(user, workspace_id)
        ws_oid = ObjectId(workspace_id)

        roadmaps = await self.product_roadmap_repo.find_by_workspace(
            workspace_id=ws_oid,
            status=status_filter,
            skip=skip,
            limit=limit,
        )
        total = await self.product_roadmap_repo.count_by_workspace(
            workspace_id=ws_oid,
            status=status_filter,
        )

        items_resp = []
        for r in roadmaps:
            cnt = await self.roadmap_repo.count_by_roadmap(ws_oid, r.id)
            items_resp.append(self._format_roadmap_response(r, item_count=cnt))

        return ProductRoadmapListResponse(total=total, items=items_resp)

    async def get_roadmap(
        self,
        workspace_id: str,
        roadmap_id: str,
        user: User,
    ) -> ProductRoadmapResponse:
        await self.verify_workspace_access(user, workspace_id)
        if not ObjectId.is_valid(roadmap_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid roadmap_id format: '{roadmap_id}'",
            )

        ws_oid = ObjectId(workspace_id)
        r_oid = ObjectId(roadmap_id)
        roadmap = await self.product_roadmap_repo.find_by_id_and_workspace(r_oid, ws_oid)
        if not roadmap:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product roadmap '{roadmap_id}' not found in workspace",
            )

        cnt = await self.roadmap_repo.count_by_roadmap(ws_oid, roadmap.id)
        return self._format_roadmap_response(roadmap, item_count=cnt)

    async def update_roadmap(
        self,
        workspace_id: str,
        roadmap_id: str,
        request: ProductRoadmapUpdate,
        user: User,
    ) -> ProductRoadmapResponse:
        await self.verify_workspace_access(user, workspace_id)
        if not ObjectId.is_valid(roadmap_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid roadmap_id format: '{roadmap_id}'",
            )

        ws_oid = ObjectId(workspace_id)
        r_oid = ObjectId(roadmap_id)
        current = await self.product_roadmap_repo.find_by_id_and_workspace(r_oid, ws_oid)
        if not current:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product roadmap '{roadmap_id}' not found in workspace",
            )

        # Optimistic Concurrency Control
        if request.expected_version is not None and current.version != request.expected_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Concurrent update conflict: Roadmap version is '{current.version}', expected '{request.expected_version}'.",
            )

        update_dict: Dict[str, Any] = {}
        if request.title is not None:
            update_dict["title"] = request.title.strip()
        if request.description is not None:
            update_dict["description"] = request.description.strip()
        if request.roadmap_type is not None:
            update_dict["roadmapType"] = request.roadmap_type.value if hasattr(request.roadmap_type, "value") else str(request.roadmap_type)
        if request.time_horizon is not None:
            update_dict["timeHorizon"] = request.time_horizon.value if hasattr(request.time_horizon, "value") else str(request.time_horizon)
        if request.status is not None:
            update_dict["status"] = request.status.value if hasattr(request.status, "value") else str(request.status)
        if request.is_default is not None:
            update_dict["isDefault"] = request.is_default

        if not update_dict:
            cnt = await self.roadmap_repo.count_by_roadmap(ws_oid, current.id)
            return self._format_roadmap_response(current, item_count=cnt)

        # Bump version atomically
        update_dict["version"] = bump_semver(current.version, "patch")

        updated, conflict = await self.product_roadmap_repo.update_with_optimistic_concurrency(
            roadmap_id=r_oid,
            workspace_id=ws_oid,
            update_data=update_dict,
            expected_version=request.expected_version,
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Concurrent update conflict during atomic write.",
            )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product roadmap '{roadmap_id}' not found",
            )

        cnt = await self.roadmap_repo.count_by_roadmap(ws_oid, updated.id)
        return self._format_roadmap_response(updated, item_count=cnt)

    async def archive_roadmap(
        self,
        workspace_id: str,
        roadmap_id: str,
        user: User,
    ) -> ProductRoadmapResponse:
        await self.verify_workspace_access(user, workspace_id)
        if not ObjectId.is_valid(roadmap_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid roadmap_id format: '{roadmap_id}'",
            )

        ws_oid = ObjectId(workspace_id)
        r_oid = ObjectId(roadmap_id)
        archived = await self.product_roadmap_repo.archive_roadmap(r_oid, ws_oid)
        if not archived:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product roadmap '{roadmap_id}' not found in workspace",
            )

        cnt = await self.roadmap_repo.count_by_roadmap(ws_oid, archived.id)
        return self._format_roadmap_response(archived, item_count=cnt)

    # ---------------------------------------------------------------------------
    # RoadmapItem Management
    # ---------------------------------------------------------------------------

    async def create_item(
        self,
        workspace_id: str,
        request: RoadmapItemCreate,
        user: User,
    ) -> RoadmapItemResponse:
        await self.verify_workspace_access(user, workspace_id)
        ws_oid = ObjectId(workspace_id)

        # 1. Validate Parent Roadmap if provided
        rm_oid: Optional[PyObjectId] = None
        if request.roadmap_id:
            if not ObjectId.is_valid(request.roadmap_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid roadmap_id format: '{request.roadmap_id}'",
                )
            rm_oid = ObjectId(request.roadmap_id)
            parent_roadmap = await self.product_roadmap_repo.find_by_id_and_workspace(rm_oid, ws_oid)
            if not parent_roadmap:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Parent roadmap '{request.roadmap_id}' not found in specified workspace",
                )
            if parent_roadmap.status == ProductRoadmapStatus.ARCHIVED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot add roadmap items to an archived roadmap.",
                )

        # 2. Validate IDs
        feat_oid = ObjectId(request.feature_id) if request.feature_id and ObjectId.is_valid(request.feature_id) else None
        fg_oid = ObjectId(request.feature_group_id) if request.feature_group_id and ObjectId.is_valid(request.feature_group_id) else None
        prd_oid = ObjectId(request.prd_id) if request.prd_id and ObjectId.is_valid(request.prd_id) else None
        scen_oid = ObjectId(request.prioritization_scenario_id) if request.prioritization_scenario_id and ObjectId.is_valid(request.prioritization_scenario_id) else None
        rel_oid = ObjectId(request.release_id) if request.release_id and ObjectId.is_valid(request.release_id) else None
        own_oid = ObjectId(request.owner_id) if request.owner_id and ObjectId.is_valid(request.owner_id) else None

        dep_oids = []
        for d in request.dependencies:
            if ObjectId.is_valid(d):
                dep_oids.append(ObjectId(d))

        # 3. Construct Model
        item_doc = RoadmapItem(
            workspace_id=ws_oid,
            roadmap_id=rm_oid,
            feature_id=feat_oid,
            feature_group_id=fg_oid,
            prd_id=prd_oid,
            prioritization_scenario_id=scen_oid,
            release_id=rel_oid,
            title=request.title.strip(),
            description=request.description.strip(),
            status=request.status,
            priority=request.priority,
            priority_score=request.priority_score,
            is_committed=request.is_committed,
            owner=request.owner or user.name,
            owner_id=own_oid or user.id,
            start_date=request.start_date,
            target_date=request.target_date,
            actual_start_date=request.actual_start_date,
            actual_end_date=request.actual_end_date,
            milestone=request.milestone,
            progress=request.progress,
            dependencies=dep_oids,
            notes=request.notes.strip(),
            version="1.0.0",
        )
        saved = await self.roadmap_repo.create(item_doc)
        return self._format_item_response(saved)

    async def list_items(
        self,
        workspace_id: str,
        user: User,
        roadmap_id: Optional[str] = None,
        status_filter: Optional[RoadmapStatus] = None,
        milestone: Optional[str] = None,
        is_committed: Optional[bool] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> RoadmapItemListResponse:
        await self.verify_workspace_access(user, workspace_id)
        ws_oid = ObjectId(workspace_id)

        query: Dict[str, Any] = {"workspaceId": ws_oid}

        if roadmap_id:
            if not ObjectId.is_valid(roadmap_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid roadmap_id format: '{roadmap_id}'",
                )
            query["roadmapId"] = ObjectId(roadmap_id)

        if status_filter:
            query["status"] = status_filter.value if hasattr(status_filter, "value") else str(status_filter)

        if milestone:
            query["milestone"] = milestone

        if is_committed is not None:
            query["isCommitted"] = is_committed

        if start_date and end_date:
            query["startDate"] = {"$gte": start_date}
            query["targetDate"] = {"$lte": end_date}
        elif start_date:
            query["startDate"] = {"$gte": start_date}
        elif end_date:
            query["targetDate"] = {"$lte": end_date}

        cursor = self.roadmap_repo.collection.find(query).sort([("targetDate", 1)]).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        total = await self.roadmap_repo.collection.count_documents(query)

        items_resp = [self._format_item_response(self.roadmap_repo.model_cls.from_mongo(d)) for d in docs]
        return RoadmapItemListResponse(total=total, items=items_resp)

    async def get_item(
        self,
        workspace_id: str,
        item_id: str,
        user: User,
    ) -> RoadmapItemResponse:
        await self.verify_workspace_access(user, workspace_id)
        if not ObjectId.is_valid(item_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid item_id format: '{item_id}'",
            )

        ws_oid = ObjectId(workspace_id)
        i_oid = ObjectId(item_id)
        item = await self.roadmap_repo.find_by_workspace_and_item(ws_oid, i_oid)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Roadmap item '{item_id}' not found in workspace",
            )
        return self._format_item_response(item)

    async def update_item(
        self,
        workspace_id: str,
        item_id: str,
        request: RoadmapItemUpdate,
        user: User,
    ) -> RoadmapItemResponse:
        await self.verify_workspace_access(user, workspace_id)
        if not ObjectId.is_valid(item_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid item_id format: '{item_id}'",
            )

        ws_oid = ObjectId(workspace_id)
        i_oid = ObjectId(item_id)
        current = await self.roadmap_repo.find_by_workspace_and_item(ws_oid, i_oid)
        if not current:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Roadmap item '{item_id}' not found in workspace",
            )

        # Optimistic Concurrency Control
        if request.expected_version is not None and current.version != request.expected_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Concurrent update conflict: Roadmap item version is '{current.version}', expected '{request.expected_version}'.",
            )

        # Validate parent roadmap if changing
        if request.roadmap_id:
            if not ObjectId.is_valid(request.roadmap_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid roadmap_id format: '{request.roadmap_id}'",
                )
            new_rm_oid = ObjectId(request.roadmap_id)
            parent_roadmap = await self.product_roadmap_repo.find_by_id_and_workspace(new_rm_oid, ws_oid)
            if not parent_roadmap:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Target roadmap '{request.roadmap_id}' not found in workspace",
                )
            if parent_roadmap.status == ProductRoadmapStatus.ARCHIVED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot move item to an archived roadmap.",
                )

        # Validate date consistency
        eff_start = request.actual_start_date or current.actual_start_date
        eff_end = request.actual_end_date or current.actual_end_date
        if eff_start and eff_end and eff_end < eff_start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"actual_end_date ('{eff_end}') cannot precede actual_start_date ('{eff_start}').",
            )

        update_dict: Dict[str, Any] = {}
        if request.roadmap_id is not None:
            update_dict["roadmapId"] = ObjectId(request.roadmap_id) if request.roadmap_id else None
        if request.feature_id is not None:
            update_dict["featureId"] = ObjectId(request.feature_id) if request.feature_id else None
        if request.feature_group_id is not None:
            update_dict["featureGroupId"] = ObjectId(request.feature_group_id) if request.feature_group_id else None
        if request.prd_id is not None:
            update_dict["prdId"] = ObjectId(request.prd_id) if request.prd_id else None
        if request.prioritization_scenario_id is not None:
            update_dict["prioritizationScenarioId"] = ObjectId(request.prioritization_scenario_id) if request.prioritization_scenario_id else None
        if request.release_id is not None:
            update_dict["releaseId"] = ObjectId(request.release_id) if request.release_id else None
        if request.title is not None:
            update_dict["title"] = request.title.strip()
        if request.description is not None:
            update_dict["description"] = request.description.strip()
        if request.status is not None:
            update_dict["status"] = request.status.value if hasattr(request.status, "value") else str(request.status)
        if request.priority is not None:
            update_dict["priority"] = request.priority.value if hasattr(request.priority, "value") else str(request.priority)
        if request.priority_score is not None:
            update_dict["priorityScore"] = request.priority_score
        if request.is_committed is not None:
            update_dict["isCommitted"] = request.is_committed
        if request.owner is not None:
            update_dict["owner"] = request.owner
        if request.owner_id is not None:
            update_dict["ownerId"] = ObjectId(request.owner_id) if request.owner_id else None
        if request.start_date is not None:
            update_dict["startDate"] = request.start_date
        if request.target_date is not None:
            update_dict["targetDate"] = request.target_date
        if request.actual_start_date is not None:
            update_dict["actualStartDate"] = request.actual_start_date
        if request.actual_end_date is not None:
            update_dict["actualEndDate"] = request.actual_end_date
        if request.milestone is not None:
            update_dict["milestone"] = request.milestone
        if request.progress is not None:
            update_dict["progress"] = request.progress
        if request.notes is not None:
            update_dict["notes"] = request.notes.strip()
        if request.dependencies is not None:
            dep_oids = [ObjectId(d) for d in request.dependencies if ObjectId.is_valid(d)]
            update_dict["dependencies"] = dep_oids

        if not update_dict:
            return self._format_item_response(current)

        # Bump version atomically
        update_dict["version"] = bump_semver(current.version, "patch")

        updated, conflict = await self.roadmap_repo.update_with_optimistic_concurrency(
            item_id=i_oid,
            workspace_id=ws_oid,
            update_data=update_dict,
            expected_version=request.expected_version,
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Concurrent update conflict during atomic write.",
            )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Roadmap item '{item_id}' not found",
            )
        return self._format_item_response(updated)

    async def delete_item(
        self,
        workspace_id: str,
        item_id: str,
        user: User,
    ) -> Dict[str, Any]:
        await self.verify_workspace_access(user, workspace_id)
        if not ObjectId.is_valid(item_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid item_id format: '{item_id}'",
            )

        ws_oid = ObjectId(workspace_id)
        i_oid = ObjectId(item_id)
        current = await self.roadmap_repo.find_by_workspace_and_item(ws_oid, i_oid)
        if not current:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Roadmap item '{item_id}' not found in workspace",
            )

        deleted = await self.roadmap_repo.delete(i_oid, workspace_id=ws_oid)
        return {
            "success": bool(deleted),
            "message": f"Roadmap item '{item_id}' deleted successfully.",
            "id": item_id,
        }

    # ---------------------------------------------------------------------------
    # Response Formatting Helpers
    # ---------------------------------------------------------------------------

    def _format_roadmap_response(self, doc: ProductRoadmap, item_count: int = 0) -> ProductRoadmapResponse:
        return ProductRoadmapResponse(
            id=str(doc.id),
            workspace_id=str(doc.workspace_id),
            legacy_id=doc.legacy_id,
            title=doc.title,
            description=doc.description,
            roadmap_type=doc.roadmap_type,
            time_horizon=doc.time_horizon,
            status=doc.status,
            is_default=doc.is_default,
            created_by=doc.created_by,
            creator_id=str(doc.creator_id) if doc.creator_id else None,
            version=doc.version or "1.0.0",
            item_count=item_count,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
        )

    def _format_item_response(self, doc: RoadmapItem) -> RoadmapItemResponse:
        deps = [str(d) for d in (doc.dependencies or [])]
        return RoadmapItemResponse(
            id=str(doc.id),
            workspace_id=str(doc.workspace_id),
            roadmap_id=str(doc.roadmap_id) if doc.roadmap_id else None,
            feature_id=str(doc.feature_id) if doc.feature_id else None,
            feature_group_id=str(doc.feature_group_id) if doc.feature_group_id else None,
            prd_id=str(doc.prd_id) if doc.prd_id else None,
            prioritization_scenario_id=str(doc.prioritization_scenario_id) if doc.prioritization_scenario_id else None,
            release_id=str(doc.release_id) if doc.release_id else None,
            legacy_id=doc.legacy_id,
            title=doc.title,
            description=doc.description or "",
            status=doc.status,
            priority=doc.priority,
            priority_score=doc.priority_score,
            is_committed=getattr(doc, "is_committed", False),
            owner=doc.owner,
            owner_id=str(doc.owner_id) if doc.owner_id else None,
            start_date=doc.start_date,
            target_date=doc.target_date,
            actual_start_date=doc.actual_start_date,
            actual_end_date=doc.actual_end_date,
            milestone=doc.milestone,
            progress=doc.progress,
            dependencies=deps,
            notes=doc.notes or "",
            version=getattr(doc, "version", "1.0.0") or "1.0.0",
            created_at=doc.created_at,
            updated_at=doc.updated_at,
        )
