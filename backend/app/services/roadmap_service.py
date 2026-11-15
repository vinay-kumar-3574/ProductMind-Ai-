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
    PRDStatus,
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
    RoadmapCandidateItem,
    RoadmapCandidateListResponse,
    PromotePRDRequest,
    PromotePRDResponse,
)
from app.repositories import (
    RoadmapRepository,
    ProductRoadmapRepository,
    WorkspaceRepository,
    WorkspaceMembershipRepository,
    PRDRepository,
    FeatureGroupRepository,
    PrioritizationScenarioRepository,
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
        prioritization_repo: Optional[PrioritizationScenarioRepository] = None,
    ):
        self.roadmap_repo = roadmap_repo
        self.product_roadmap_repo = product_roadmap_repo
        self.workspace_repo = workspace_repo
        self.membership_repo = membership_repo
        self.prd_repo = prd_repo
        self.feature_group_repo = feature_group_repo
        self.prioritization_repo = prioritization_repo

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
    # Validation Helpers (Dependencies, Ownership, Dates)
    # ---------------------------------------------------------------------------

    def _validate_dates(
        self,
        start_date: Optional[str],
        target_date: Optional[str],
        actual_start_date: Optional[str],
        actual_end_date: Optional[str],
    ) -> None:
        """Validates temporal order of planned and actual milestone dates."""
        if start_date and target_date and start_date > target_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"start_date ('{start_date}') cannot be after target_date ('{target_date}').",
            )
        if actual_start_date and actual_end_date and actual_start_date > actual_end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"actual_start_date ('{actual_start_date}') cannot be after actual_end_date ('{actual_end_date}').",
            )

    async def _validate_owner(self, ws_oid: ObjectId, owner_id: Optional[ObjectId]) -> None:
        """Validates that assigned owner belongs to the target workspace."""
        if not owner_id:
            return

        if self.workspace_repo is not None:
            workspace = await self.workspace_repo.find_by_id(ws_oid)
            if workspace and workspace.owner_id == owner_id:
                return

        if self.membership_repo is not None:
            membership = None
            if hasattr(self.membership_repo, "find_membership"):
                membership = await self.membership_repo.find_membership(ws_oid, owner_id)
            elif hasattr(self.membership_repo, "find_by_workspace_and_user"):
                membership = await self.membership_repo.find_by_workspace_and_user(workspace_id=ws_oid, user_id=owner_id)

            if membership and membership.status == MembershipStatus.ACTIVE:
                return

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Owner '{owner_id}' is not an active member or owner of workspace '{ws_oid}'.",
        )

    async def _validate_dependencies(
        self,
        ws_oid: ObjectId,
        item_id: Optional[ObjectId],
        dep_oids: List[ObjectId],
    ) -> None:
        """
        Validates that all dependencies exist in the same workspace and detects circular dependencies.
        """
        if not dep_oids:
            return

        # Check self-dependency
        if item_id and item_id in dep_oids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A roadmap item cannot depend on itself.",
            )

        # Validate existence in workspace
        for d in dep_oids:
            dep_item = await self.roadmap_repo.find_by_workspace_and_item(ws_oid, d)
            if not dep_item:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Dependency roadmap item '{d}' does not exist in this workspace.",
                )

        # Cycle detection if item_id exists
        if item_id:
            queue = list(dep_oids)
            visited = set(dep_oids)
            while queue:
                curr_id = queue.pop(0)
                if curr_id == item_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Circular dependency detected: Item '{item_id}' forms a dependency cycle.",
                    )
                curr_item = await self.roadmap_repo.find_by_workspace_and_item(ws_oid, curr_id)
                if curr_item and curr_item.dependencies:
                    for parent_dep in curr_item.dependencies:
                        if parent_dep not in visited:
                            visited.add(parent_dep)
                            queue.append(parent_dep)

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

        # Validate dates
        self._validate_dates(
            request.start_date,
            request.target_date,
            request.actual_start_date,
            request.actual_end_date,
        )

        # 1. Validate Parent Roadmap if provided
        rm_oid: Optional[ObjectId] = None
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

        # Validate owner if explicitly specified
        if own_oid:
            await self._validate_owner(ws_oid, own_oid)

        dep_oids = []
        for d in request.dependencies:
            if ObjectId.is_valid(d):
                dep_oids.append(ObjectId(d))

        # Validate dependencies
        await self._validate_dependencies(ws_oid, item_id=None, dep_oids=dep_oids)

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
        eff_start = request.start_date if request.start_date is not None else current.start_date
        eff_target = request.target_date if request.target_date is not None else current.target_date
        eff_act_start = request.actual_start_date if request.actual_start_date is not None else current.actual_start_date
        eff_act_end = request.actual_end_date if request.actual_end_date is not None else current.actual_end_date
        self._validate_dates(eff_start, eff_target, eff_act_start, eff_act_end)

        # Validate owner if updated
        if request.owner_id is not None and request.owner_id:
            await self._validate_owner(ws_oid, ObjectId(request.owner_id))

        # Validate dependencies if updated
        if request.dependencies is not None:
            dep_oids = [ObjectId(d) for d in request.dependencies if ObjectId.is_valid(d)]
            await self._validate_dependencies(ws_oid, i_oid, dep_oids)

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
    # Feature Prioritization & Approved PRD Candidates & Promotion
    # ---------------------------------------------------------------------------

    async def get_candidates(
        self,
        workspace_id: str,
        user: User,
    ) -> RoadmapCandidateListResponse:
        """
        Retrieves feature groups and PRDs eligible for roadmap promotion.
        Marks is_approved_for_roadmap=True ONLY if PRD status is 'Approved'.
        """
        await self.verify_workspace_access(user, workspace_id)
        ws_oid = ObjectId(workspace_id)

        # 1. Fetch feature groups
        feature_groups = []
        if self.feature_group_repo is not None:
            feature_groups = await self.feature_group_repo.find_by_workspace(ws_oid)

        # 2. Fetch PRDs
        prds = []
        if self.prd_repo is not None:
            prds = await self.prd_repo.find_by_workspace(ws_oid)

        # 3. Fetch Prioritization Scenarios
        scenarios = []
        if self.prioritization_repo is not None:
            scenarios = await self.prioritization_repo.find_by_workspace(ws_oid)

        # 4. Fetch Existing Roadmap Items
        roadmap_items = await self.roadmap_repo.find_by_workspace(ws_oid)

        # Indexing for lookup
        prds_by_fg = {}
        for p in prds:
            if getattr(p, "feature_group_id", None):
                prds_by_fg[str(p.feature_group_id)] = p

        scenarios_by_fg = {}
        for s in scenarios:
            if getattr(s, "feature_group_id", None):
                scenarios_by_fg[str(s.feature_group_id)] = s

        items_by_fg = {}
        items_by_prd = {}
        for it in roadmap_items:
            if getattr(it, "feature_group_id", None):
                items_by_fg.setdefault(str(it.feature_group_id), []).append(it)
            if getattr(it, "prd_id", None):
                items_by_prd.setdefault(str(it.prd_id), []).append(it)

        candidates: List[RoadmapCandidateItem] = []
        processed_prd_ids = set()

        for fg in feature_groups:
            fg_id_str = str(fg.id)
            scenario = scenarios_by_fg.get(fg_id_str)
            prd = prds_by_fg.get(fg_id_str)

            score = scenario.final_score if scenario else None
            tier = getattr(scenario, "priority_level", None) or getattr(scenario, "priority_tier", None)
            factors = getattr(scenario, "factor_scores", None) or getattr(scenario, "scores", None)
            scen_id = str(scenario.id) if scenario else None

            prd_id = None
            prd_title = None
            prd_status = None
            prd_version = None
            is_approved = False
            recs = []

            if prd:
                prd_id = str(prd.id)
                processed_prd_ids.add(prd_id)
                prd_title = prd.title
                prd_status = prd.status.value if hasattr(prd.status, "value") else str(prd.status)
                prd_version = prd.version or "1.0.0"
                is_approved = prd_status.strip().lower() == "approved"
                recs = prd.roadmap_recommendations or []

            existing_for_fg = [str(i.id) for i in items_by_fg.get(fg_id_str, [])]
            existing_for_prd = [str(i.id) for i in items_by_prd.get(prd_id, [])] if prd_id else []
            existing_ids = list(dict.fromkeys(existing_for_fg + existing_for_prd))

            is_committed = len(existing_ids) > 0 and (len(recs) == 0 or len(existing_ids) >= len(recs))

            sentiment_raw = getattr(fg, "sentiment_distribution", None)
            if sentiment_raw is not None:
                sentiment_dict = sentiment_raw.model_dump() if hasattr(sentiment_raw, "model_dump") else (sentiment_raw if isinstance(sentiment_raw, dict) else None)
            else:
                sentiment_dict = None

            pain_points_raw = getattr(fg, "pain_points", None) or getattr(fg, "customer_pain_points", None) or []

            candidates.append(
                RoadmapCandidateItem(
                    feature_group_id=fg_id_str,
                    title=fg.title if hasattr(fg, "title") and fg.title else getattr(fg, "name", "Feature Group"),
                    description=getattr(fg, "description", "") or "",
                    feedback_count=getattr(fg, "feedback_count", 0) or 0,
                    customer_pain_points=pain_points_raw if isinstance(pain_points_raw, list) else [],
                    sentiment_distribution=sentiment_dict,
                    priority_score=score,
                    priority_level=tier,
                    priority_factors=factors,
                    prioritization_scenario_id=scen_id,
                    prd_id=prd_id,
                    prd_title=prd_title,
                    prd_status=prd_status,
                    prd_version=prd_version,
                    is_approved_for_roadmap=is_approved,
                    roadmap_recommendations=recs,
                    existing_roadmap_item_ids=existing_ids,
                    is_fully_committed=is_committed,
                )
            )

        # Include standalone PRDs not linked to a feature group
        for prd in prds:
            p_id = str(prd.id)
            if p_id in processed_prd_ids:
                continue

            prd_status = prd.status.value if hasattr(prd.status, "value") else str(prd.status)
            is_approved = prd_status.strip().lower() == "approved"
            recs = prd.roadmap_recommendations or []
            existing_ids = [str(i.id) for i in items_by_prd.get(p_id, [])]
            is_committed = len(existing_ids) > 0 and (len(recs) == 0 or len(existing_ids) >= len(recs))

            candidates.append(
                RoadmapCandidateItem(
                    feature_group_id=str(prd.feature_group_id) if getattr(prd, "feature_group_id", None) else None,
                    title=prd.title,
                    description=prd.sections.get("Executive Summary", "") if getattr(prd, "sections", None) and isinstance(prd.sections, dict) else "",
                    feedback_count=0,
                    customer_pain_points=[],
                    sentiment_distribution=None,
                    priority_score=None,
                    priority_level="Medium",
                    priority_factors=None,
                    prioritization_scenario_id=str(prd.prioritization_scenario_id) if getattr(prd, "prioritization_scenario_id", None) else None,
                    prd_id=p_id,
                    prd_title=prd.title,
                    prd_status=prd_status,
                    prd_version=prd.version or "1.0.0",
                    is_approved_for_roadmap=is_approved,
                    roadmap_recommendations=recs,
                    existing_roadmap_item_ids=existing_ids,
                    is_fully_committed=is_committed,
                )
            )

        return RoadmapCandidateListResponse(total=len(candidates), items=candidates)

    async def promote_approved_prd(
        self,
        workspace_id: str,
        request: PromotePRDRequest,
        user: User,
    ) -> PromotePRDResponse:
        """
        Promotes an Approved PRD and its recommendations into formal committed RoadmapItems.
        STRICT BUSINESS RULE: Rejects PRDs with status other than 'Approved'.
        """
        await self.verify_workspace_access(user, workspace_id)
        ws_oid = ObjectId(workspace_id)

        if not ObjectId.is_valid(request.prd_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid prd_id format: '{request.prd_id}'",
            )

        prd_oid = ObjectId(request.prd_id)
        if self.prd_repo is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="PRD repository not configured.",
            )

        prd = await self.prd_repo.find_by_id(prd_oid, workspace_id=ws_oid)
        if not prd:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"PRD '{request.prd_id}' not found in specified workspace.",
            )

        # STRICT APPROVAL CHECK
        prd_status_str = prd.status.value if hasattr(prd.status, "value") else str(prd.status)
        if prd_status_str.strip().lower() != "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only PRDs with status 'Approved' are eligible for formal roadmap commitment. Current PRD status is '{prd_status_str}'.",
            )

        # Resolve target roadmap container
        roadmap: Optional[ProductRoadmap] = None
        if request.roadmap_id:
            if not ObjectId.is_valid(request.roadmap_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid roadmap_id format: '{request.roadmap_id}'",
                )
            r_oid = ObjectId(request.roadmap_id)
            roadmap = await self.product_roadmap_repo.find_by_id_and_workspace(r_oid, ws_oid)
            if not roadmap:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Target roadmap container '{request.roadmap_id}' not found in workspace.",
                )
            if roadmap.status == ProductRoadmapStatus.ARCHIVED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot promote deliverables into an archived roadmap.",
                )
        else:
            # Locate active roadmap or create default
            roadmaps = await self.product_roadmap_repo.find_by_workspace(ws_oid, status=ProductRoadmapStatus.ACTIVE)
            roadmap = next((r for r in roadmaps if r.is_default), None) or (roadmaps[0] if roadmaps else None)
            if not roadmap:
                new_roadmap = ProductRoadmap(
                    workspace_id=ws_oid,
                    title="Main Product Roadmap",
                    description="Default workspace product roadmap for committed deliverables.",
                    roadmap_type=ProductRoadmapType.HYBRID,
                    time_horizon=RoadmapTimeHorizon.QUARTERLY,
                    status=ProductRoadmapStatus.ACTIVE,
                    is_default=True,
                    created_by=user.name,
                    creator_id=user.id,
                    version="1.0.0",
                )
                roadmap = await self.product_roadmap_repo.create_roadmap(new_roadmap)

        # Determine priority score from prioritization scenario if available
        priority_score: Optional[float] = None
        if prd.prioritization_scenario_id and self.prioritization_repo is not None:
            scenario = await self.prioritization_repo.find_by_id(prd.prioritization_scenario_id, workspace_id=ws_oid)
            if scenario and scenario.final_score is not None:
                priority_score = scenario.final_score
        elif prd.feature_group_id and self.prioritization_repo is not None:
            scenario = await self.prioritization_repo.find_by_workspace_and_feature_group(ws_oid, prd.feature_group_id)
            if scenario and scenario.final_score is not None:
                priority_score = scenario.final_score

        # Query existing items for idempotency / duplicate prevention
        existing_items = await self.roadmap_repo.find_by_prd(ws_oid, prd.id)
        existing_item_ids = [str(it.id) for it in existing_items]
        existing_titles = {it.title.strip().lower() for it in existing_items}

        created_item_ids: List[str] = []
        recs = prd.roadmap_recommendations or []

        if recs:
            phases_to_promote = []
            if request.selected_phases is not None:
                for idx, r in enumerate(recs):
                    if idx in request.selected_phases or (idx + 1) in request.selected_phases:
                        phases_to_promote.append((idx, r))
            else:
                phases_to_promote = list(enumerate(recs))

            for idx, rec in phases_to_promote:
                rec_title = rec.get("phase") or rec.get("title") or rec.get("name") or f"Phase {idx + 1}: {prd.title}"
                rec_title = rec_title.strip()
                if rec_title.lower() in existing_titles:
                    logger.info("Skipping already promoted roadmap recommendation '%s' for PRD '%s'", rec_title, prd.id)
                    continue

                rec_desc = rec.get("deliverables") or rec.get("description") or rec.get("summary") or ""
                if isinstance(rec_desc, list):
                    rec_desc = "; ".join(str(d) for d in rec_desc)

                from datetime import timedelta
                rec_milestone = request.target_milestone or rec.get("phase") or rec.get("milestone") or f"Phase {idx + 1}"
                rec_start = request.start_date or rec.get("startDate") or rec.get("start_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
                rec_target = request.target_date or rec.get("targetDate") or rec.get("target_date") or rec.get("eta")

                if not rec_target:
                    try:
                        s_dt = datetime.strptime(rec_start, "%Y-%m-%d")
                        rec_target = (s_dt + timedelta(days=30)).strftime("%Y-%m-%d")
                    except Exception:
                        rec_target = rec_start

                # Validate date ordering
                if rec_start and rec_target and rec_start > rec_target:
                    rec_target = rec_start

                item_doc = RoadmapItem(
                    workspace_id=ws_oid,
                    roadmap_id=roadmap.id,
                    prd_id=prd.id,
                    feature_group_id=prd.feature_group_id,
                    prioritization_scenario_id=prd.prioritization_scenario_id,
                    title=rec_title,
                    description=rec_desc,
                    status=RoadmapStatus.PLANNED,
                    priority=rec.get("priority", "High"),
                    priority_score=priority_score,
                    is_committed=True,
                    owner=user.name,
                    owner_id=user.id,
                    start_date=rec_start,
                    target_date=rec_target,
                    milestone=rec_milestone,
                    progress=0,
                    dependencies=[],
                    notes=f"Promoted from approved PRD '{prd.title}' (v{prd.version})",
                    version="1.0.0",
                )
                saved_item = await self.roadmap_repo.create(item_doc)
                created_item_ids.append(str(saved_item.id))
                existing_titles.add(rec_title.lower())
        else:
            # Promote PRD as a single committed deliverable
            if prd.title.strip().lower() not in existing_titles:
                from datetime import timedelta
                s_date = request.start_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
                t_date = request.target_date
                if not t_date:
                    try:
                        s_dt = datetime.strptime(s_date, "%Y-%m-%d")
                        t_date = (s_dt + timedelta(days=30)).strftime("%Y-%m-%d")
                    except Exception:
                        t_date = s_date

                item_doc = RoadmapItem(
                    workspace_id=ws_oid,
                    roadmap_id=roadmap.id,
                    prd_id=prd.id,
                    feature_group_id=prd.feature_group_id,
                    prioritization_scenario_id=prd.prioritization_scenario_id,
                    title=prd.title,
                    description=f"Implementation deliverable for approved PRD '{prd.title}'",
                    status=RoadmapStatus.PLANNED,
                    priority="High",
                    priority_score=priority_score,
                    is_committed=True,
                    owner=user.name,
                    owner_id=user.id,
                    start_date=s_date,
                    target_date=t_date,
                    milestone=request.target_milestone or "Phase 1",
                    progress=0,
                    dependencies=[],
                    notes=f"Promoted from approved PRD '{prd.title}' (v{prd.version})",
                    version="1.0.0",
                )
                saved_item = await self.roadmap_repo.create(item_doc)
                created_item_ids.append(str(saved_item.id))

        return PromotePRDResponse(
            success=True,
            promoted_count=len(created_item_ids),
            created_item_ids=created_item_ids,
            existing_item_ids=existing_item_ids,
            roadmap_id=str(roadmap.id),
            prd_id=str(prd.id),
            prd_title=prd.title,
            message=f"Successfully committed {len(created_item_ids)} item(s) from approved PRD '{prd.title}' to roadmap '{roadmap.title}'.",
        )

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
