"""
ProductMind AI — Roadmap & Product Roadmap Repositories
Provides workspace-scoped persistence for ProductRoadmaps and RoadmapItems.
"""

from typing import Optional, List, Any, Dict, Tuple
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import IndexModel, ASCENDING, DESCENDING

from app.database.collections import Collections
from app.models.planning import ProductRoadmap, RoadmapItem
from app.core.enums import RoadmapStatus, ProductRoadmapStatus
from app.repositories.base import BaseRepository


class ProductRoadmapRepository(BaseRepository[ProductRoadmap]):
    """Repository managing ProductRoadmap containers in MongoDB Atlas."""

    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, Collections.PRODUCT_ROADMAPS, ProductRoadmap)

    async def ensure_indexes(self) -> None:
        """Provisions necessary compound indexes for ProductRoadmap collection."""
        indexes = [
            IndexModel(
                [("workspaceId", ASCENDING), ("status", ASCENDING)],
                name="idx_roadmaps_workspace_status",
            ),
            IndexModel(
                [("workspaceId", ASCENDING), ("updatedAt", DESCENDING)],
                name="idx_roadmaps_workspace_updated",
            ),
            IndexModel(
                [("workspaceId", ASCENDING), ("isDefault", ASCENDING)],
                name="idx_roadmaps_workspace_default",
            ),
        ]
        try:
            await self.collection.create_indexes(indexes)
        except Exception as exc:
            # Code 85: IndexOptionsConflict (index already exists with another name)
            if getattr(exc, "code", None) != 85:
                raise

    async def create_roadmap(self, roadmap: ProductRoadmap) -> ProductRoadmap:
        return await self.create(roadmap)

    async def find_by_id_and_workspace(
        self,
        roadmap_id: Any,
        workspace_id: Any,
    ) -> Optional[ProductRoadmap]:
        return await self.find_by_id(roadmap_id, workspace_id=workspace_id)

    async def find_by_workspace(
        self,
        workspace_id: Any,
        status: Optional[ProductRoadmapStatus] = None,
        skip: int = 0,
        limit: int = 100,
        sort: Optional[List[tuple]] = None,
    ) -> List[ProductRoadmap]:
        ws_oid = self._ensure_object_id(workspace_id)
        query: Dict[str, Any] = {"workspaceId": ws_oid}
        if status:
            query["status"] = status.value if hasattr(status, "value") else str(status)

        sort_rules = sort or [("updatedAt", -1)]
        cursor = self.collection.find(query).sort(sort_rules).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [self.model_cls.from_mongo(d) for d in docs]

    async def count_by_workspace(
        self,
        workspace_id: Any,
        status: Optional[ProductRoadmapStatus] = None,
    ) -> int:
        ws_oid = self._ensure_object_id(workspace_id)
        query: Dict[str, Any] = {"workspaceId": ws_oid}
        if status:
            query["status"] = status.value if hasattr(status, "value") else str(status)
        return await self.collection.count_documents(query)

    async def archive_roadmap(
        self,
        roadmap_id: Any,
        workspace_id: Any,
    ) -> Optional[ProductRoadmap]:
        ws_oid = self._ensure_object_id(workspace_id)
        r_oid = self._ensure_object_id(roadmap_id)
        now = datetime.now(timezone.utc)
        result = await self.collection.find_one_and_update(
            {"_id": r_oid, "workspaceId": ws_oid},
            {"$set": {"status": ProductRoadmapStatus.ARCHIVED.value, "updatedAt": now}},
            return_document=True,
        )
        return self.model_cls.from_mongo(result) if result else None

    async def update_with_optimistic_concurrency(
        self,
        roadmap_id: Any,
        workspace_id: Any,
        update_data: Dict[str, Any],
        expected_version: Optional[str] = None,
    ) -> Tuple[Optional[ProductRoadmap], bool]:
        """
        Updates a ProductRoadmap document with optimistic concurrency check.
        Returns:
            (updated_doc, False) on success
            (current_doc, True) on version conflict (409)
            (None, False) if document not found
        """
        ws_oid = self._ensure_object_id(workspace_id)
        r_oid = self._ensure_object_id(roadmap_id)

        current = await self.find_by_id_and_workspace(r_oid, ws_oid)
        if not current:
            return None, False

        if expected_version is not None and current.version != expected_version:
            return current, True  # Conflict

        now = datetime.now(timezone.utc)
        payload = dict(update_data)
        payload["updatedAt"] = now

        result = await self.collection.find_one_and_update(
            {"_id": r_oid, "workspaceId": ws_oid},
            {"$set": payload},
            return_document=True,
        )
        return (self.model_cls.from_mongo(result) if result else None), False


class RoadmapRepository(BaseRepository[RoadmapItem]):
    """Repository managing RoadmapItem records in MongoDB Atlas."""

    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, Collections.ROADMAP_ITEMS, RoadmapItem)

    async def ensure_indexes(self) -> None:
        """Ensures compound indexes for roadmap item queries."""
        indexes = [
            IndexModel(
                [("workspaceId", ASCENDING), ("roadmapId", ASCENDING), ("targetDate", ASCENDING)],
                name="idx_roadmap_items_ws_rm_target",
            ),
            IndexModel(
                [("workspaceId", ASCENDING), ("status", ASCENDING)],
                name="idx_roadmap_items_ws_status",
            ),
            IndexModel(
                [("workspaceId", ASCENDING), ("prdId", ASCENDING)],
                name="idx_roadmap_items_ws_prd",
            ),
            IndexModel(
                [("workspaceId", ASCENDING), ("featureGroupId", ASCENDING)],
                name="idx_roadmap_items_ws_fg",
            ),
        ]
        try:
            await self.collection.create_indexes(indexes)
        except Exception as exc:
            # Code 85: IndexOptionsConflict (index already exists with another name)
            if getattr(exc, "code", None) != 85:
                raise

    async def find_by_workspace_and_item(
        self,
        workspace_id: Any,
        item_id: Any,
    ) -> Optional[RoadmapItem]:
        return await self.find_by_id(item_id, workspace_id=workspace_id)

    async def find_items_by_workspace(
        self,
        workspace_id: Any,
        skip: int = 0,
        limit: int = 500,
    ) -> List[RoadmapItem]:
        """Defensive alias for workspace item retrieval."""
        return await self.find_by_workspace(workspace_id, skip=skip, limit=limit)

    async def find_by_release(self, workspace_id: Any, release_id: Any) -> List[RoadmapItem]:
        rel_oid = self._ensure_object_id(release_id)
        return await self.find_by_workspace(
            workspace_id,
            filter_query={"releaseId": rel_oid},
            sort=[("targetDate", 1)],
        )

    async def find_by_milestone(self, workspace_id: Any, milestone: str) -> List[RoadmapItem]:
        return await self.find_by_workspace(
            workspace_id,
            filter_query={"milestone": milestone},
            sort=[("targetDate", 1)],
        )

    async def find_by_status(self, workspace_id: Any, status: RoadmapStatus) -> List[RoadmapItem]:
        status_val = status.value if hasattr(status, "value") else str(status)
        return await self.find_by_workspace(
            workspace_id,
            filter_query={"status": status_val},
            sort=[("targetDate", 1)],
        )

    async def find_by_roadmap(
        self,
        workspace_id: Any,
        roadmap_id: Any,
        sort: Optional[List[tuple]] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[RoadmapItem]:
        rm_oid = self._ensure_object_id(roadmap_id)
        return await self.find_by_workspace(
            workspace_id,
            filter_query={"roadmapId": rm_oid},
            sort=sort or [("targetDate", 1)],
            skip=skip,
            limit=limit,
        )

    async def find_by_prd(self, workspace_id: Any, prd_id: Any) -> List[RoadmapItem]:
        p_oid = self._ensure_object_id(prd_id)
        return await self.find_by_workspace(
            workspace_id,
            filter_query={"prdId": p_oid},
            sort=[("targetDate", 1)],
        )

    async def find_by_feature_group(self, workspace_id: Any, feature_group_id: Any) -> List[RoadmapItem]:
        fg_oid = self._ensure_object_id(feature_group_id)
        return await self.find_by_workspace(
            workspace_id,
            filter_query={"featureGroupId": fg_oid},
            sort=[("targetDate", 1)],
        )

    async def find_by_commitment_status(
        self,
        workspace_id: Any,
        is_committed: bool,
        sort: Optional[List[tuple]] = None,
    ) -> List[RoadmapItem]:
        return await self.find_by_workspace(
            workspace_id,
            filter_query={"isCommitted": is_committed},
            sort=sort or [("targetDate", 1)],
        )

    async def find_by_date_range(
        self,
        workspace_id: Any,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        sort: Optional[List[tuple]] = None,
    ) -> List[RoadmapItem]:
        filter_query: Dict[str, Any] = {}
        if start_date and end_date:
            filter_query["startDate"] = {"$gte": start_date}
            filter_query["targetDate"] = {"$lte": end_date}
        elif start_date:
            filter_query["startDate"] = {"$gte": start_date}
        elif end_date:
            filter_query["targetDate"] = {"$lte": end_date}

        return await self.find_by_workspace(
            workspace_id,
            filter_query=filter_query if filter_query else None,
            sort=sort or [("startDate", 1), ("targetDate", 1)],
        )

    async def count_by_roadmap(self, workspace_id: Any, roadmap_id: Any) -> int:
        ws_oid = self._ensure_object_id(workspace_id)
        rm_oid = self._ensure_object_id(roadmap_id)
        return await self.collection.count_documents({"workspaceId": ws_oid, "roadmapId": rm_oid})

    async def update_with_optimistic_concurrency(
        self,
        item_id: Any,
        workspace_id: Any,
        update_data: Dict[str, Any],
        expected_version: Optional[str] = None,
    ) -> Tuple[Optional[RoadmapItem], bool]:
        """
        Updates a RoadmapItem with optimistic concurrency protection.
        Returns:
            (updated_doc, False) on success
            (current_doc, True) on version conflict (409)
            (None, False) if document not found
        """
        ws_oid = self._ensure_object_id(workspace_id)
        i_oid = self._ensure_object_id(item_id)

        current = await self.find_by_workspace_and_item(ws_oid, i_oid)
        if not current:
            return None, False

        if expected_version is not None and current.version != expected_version:
            return current, True  # Conflict detected

        now = datetime.now(timezone.utc)
        payload = dict(update_data)
        payload["updatedAt"] = now

        result = await self.collection.find_one_and_update(
            {"_id": i_oid, "workspaceId": ws_oid},
            {"$set": payload},
            return_document=True,
        )
        return (self.model_cls.from_mongo(result) if result else None), False
