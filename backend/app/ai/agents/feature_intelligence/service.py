"""
ProductMind AI — Feature Intelligence Service
Orchestrates feature request retrieval, workspace authorization, candidate filtering,
LLM agent execution, deterministic validation & metrics aggregation, and MongoDB persistence.
"""

from datetime import datetime, timezone
import asyncio
import logging
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status

from app.ai.agents.feature_intelligence.agent import FeatureIntelligenceAgent
from app.ai.agents.feature_intelligence.grouping import (
    filter_eligible_feature_requests,
    calculate_demand_metrics,
    validate_and_sanitize_groups,
    detect_lexical_duplicates,
)
from app.ai.agents.feature_intelligence.schemas import (
    FeatureRequestCandidate,
    FeatureGroupAnalysis,
    FeatureGroupResult,
    GroupFeaturesResponse,
    DuplicateDetectionItem,
    DuplicateDetectionResponse,
    MergeFeatureGroupsResponse,
    DuplicateType,
)
from app.core.enums import (
    PlatformRole,
    MembershipStatus,
    FeedbackCategory,
    FeatureGroupStatus,
)
from app.models.auth import User
from app.models.intelligence import FeatureGroup, SentimentDistribution
from app.repositories import (
    FeatureGroupRepository,
    FeedbackRepository,
    WorkspaceRepository,
    WorkspaceMembershipRepository,
)

logger = logging.getLogger("productmind.ai.service.features")


class FeatureIntelligenceService:
    """
    Coordinates Feature Intelligence Agent execution with MongoDB repositories,
    deterministic validation, demand metric calculations, and strict workspace isolation.
    """

    def __init__(
        self,
        agent: Optional[FeatureIntelligenceAgent] = None,
        feature_group_repo: Optional[FeatureGroupRepository] = None,
        feedback_repo: Optional[FeedbackRepository] = None,
        workspace_repo: Optional[WorkspaceRepository] = None,
        membership_repo: Optional[WorkspaceMembershipRepository] = None,
    ):
        self.agent = agent or FeatureIntelligenceAgent()
        self.feature_group_repo = feature_group_repo
        self.feedback_repo = feedback_repo
        self.workspace_repo = workspace_repo
        self.membership_repo = membership_repo

    async def verify_workspace_access(self, user: User, workspace_id: Any) -> None:
        """
        Enforces strict workspace authorization.
        Permits access if user is platform admin, workspace owner, or active member.
        Raises HTTP 403 Forbidden if user lacks workspace access.
        """
        if user.platform_role == PlatformRole.PLATFORM_ADMIN:
            return

        if self.workspace_repo is None or self.membership_repo is None:
            return

        if not ObjectId.is_valid(str(workspace_id)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid workspace ID format: '{workspace_id}'",
            )

        ws_oid = ObjectId(str(workspace_id))
        workspace = await self.workspace_repo.find_by_id(ws_oid)
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found",
            )

        # Workspace owner check
        if str(workspace.owner_id) == str(user.id):
            return

        # Active membership check
        membership = await self.membership_repo.find_membership(ws_oid, user.id)
        if not membership or membership.status != MembershipStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have active access to this workspace.",
            )

    async def group_feature_requests(
        self,
        workspace_id: str,
        user: User,
        feedback_ids: Optional[List[str]] = None,
        force_regroup: bool = False,
        confidence_threshold: float = 0.6,
        min_group_size: int = 1,
    ) -> GroupFeaturesResponse:
        """
        Groups eligible feature requests into consolidated feature intelligence:
        1. Enforces workspace security.
        2. Retrieves feedback items from MongoDB.
        3. Filters eligible feature requests (with explicit fallback).
        4. Invokes Feature Intelligence Agent for semantic clustering.
        5. Validates IDs, prevents double-counting, and checks confidence in Python.
        6. Aggregates demand metrics (counts, unique customers, distributions) deterministically.
        7. Persists feature groups to MongoDB and links feedback items.
        8. Returns structured response with telemetry.
        """
        await self.verify_workspace_access(user, workspace_id)

        if not ObjectId.is_valid(workspace_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid workspace ID: '{workspace_id}'",
            )
        ws_oid = ObjectId(workspace_id)

        # ---------------------------------------------------------------------
        # Stage 1 & 2: Feedback Retrieval & Filtering
        # ---------------------------------------------------------------------
        raw_items: List[Any] = []
        if self.feedback_repo is not None:
            query: Dict[str, Any] = {"workspaceId": ws_oid}

            if feedback_ids is not None:
                # Specific explicit feedback IDs requested
                valid_oids = [ObjectId(fid) for fid in feedback_ids if ObjectId.is_valid(fid)]
                if not valid_oids:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="No valid feedback IDs provided in request",
                    )
                query["_id"] = {"$in": valid_oids}
            elif not force_regroup:
                # Only unassigned items unless force_regroup is True
                query["$or"] = [
                    {"featureGroupId": None},
                    {"featureGroupId": {"$exists": False}},
                ]

            cursor = self.feedback_repo.collection.find(query).limit(100)
            raw_items = await cursor.to_list(length=100)

        # Extract eligible feature requests
        candidates: List[FeatureRequestCandidate] = filter_eligible_feature_requests(raw_items)

        if not candidates:
            return GroupFeaturesResponse(
                workspace_id=workspace_id,
                groups_created=0,
                total_feedback_analyzed=0,
                groups=[],
                ungrouped_feedback_ids=[],
                execution_metadata={
                    "status": "no_eligible_feature_requests",
                    "total_retrieved": len(raw_items),
                },
            )

        candidate_lookup = {c.feedback_id: c for c in candidates}

        # ---------------------------------------------------------------------
        # Stage 3 & 4: LLM Semantic Grouping Execution with Bounded Batches
        # ---------------------------------------------------------------------
        # Limit candidate chunk size to 6 to guarantee complete, untruncated JSON within token limits
        BATCH_CHUNK_SIZE = 6
        candidate_batches = [
            candidates[i:i + BATCH_CHUNK_SIZE]
            for i in range(0, len(candidates), BATCH_CHUNK_SIZE)
        ]

        all_sanitized_groups: List[FeatureGroupAnalysis] = []
        all_ungrouped_ids: List[str] = []
        batch_metadata: List[Dict[str, Any]] = []

        for batch_idx, batch_candidates in enumerate(candidate_batches):
            # If not first batch, apply a slight buffer to avoid RPM/TPM bursts
            if batch_idx > 0:
                await asyncio.sleep(2.0)

            try:
                agent_exec = await self.agent.execute(
                    input_data={
                        "candidates": batch_candidates,
                        "confidence_threshold": confidence_threshold,
                        "min_group_size": min_group_size,
                    },
                    temperature=0.1,
                    max_output_tokens=4096,
                )

                batch_output = agent_exec.data
                batch_metadata.append(agent_exec.metadata.model_dump())

                sanitized, ungrouped = validate_and_sanitize_groups(
                    agent_output=batch_output,
                    candidates=batch_candidates,
                    confidence_threshold=confidence_threshold,
                    min_group_size=min_group_size,
                )
                all_sanitized_groups.extend(sanitized)
                all_ungrouped_ids.extend(ungrouped)

            except Exception as batch_err:
                logger.error(
                    "Feature grouping batch %d/%d failed: %s",
                    batch_idx + 1,
                    len(candidate_batches),
                    batch_err,
                )
                # If this is the only batch or no groups have been created, re-raise to notify user
                if len(candidate_batches) == 1 or not all_sanitized_groups:
                    raise batch_err
                # Otherwise, record failed batch items as ungrouped and continue with remaining batches
                all_ungrouped_ids.extend([c.feedback_id for c in batch_candidates])

        sanitized_groups = all_sanitized_groups
        ungrouped_ids = list(dict.fromkeys(all_ungrouped_ids))
        metadata = batch_metadata[0] if batch_metadata else {}

        # ---------------------------------------------------------------------
        # Stage 7: MongoDB Persistence & Linkage
        # ---------------------------------------------------------------------
        persisted_results: List[FeatureGroupResult] = []
        now = datetime.now(timezone.utc)

        for group in sanitized_groups:
            metrics = calculate_demand_metrics(group.related_feedback_ids, candidate_lookup)

            group_doc_id = str(ObjectId())

            if self.feature_group_repo is not None:
                fg_model = FeatureGroup(
                    workspace_id=ws_oid,
                    title=group.group_name[:200],
                    category=FeedbackCategory.FEATURE_REQUESTS,
                    primary_tag=group.common_themes[0] if group.common_themes else "general",
                    description=group.consolidated_description[:2000],
                    feature_summary=group.feature_summary,
                    status=FeatureGroupStatus.SUGGESTED,
                    sentiment_distribution=SentimentDistribution(
                        Positive=metrics["sentiment_distribution"]["Positive"],
                        Neutral=metrics["sentiment_distribution"]["Neutral"],
                        Negative=metrics["sentiment_distribution"]["Negative"],
                    ),
                    pain_points=group.common_pain_points,
                    feedback_count=metrics["total_request_count"],
                    related_feedback_ids=[ObjectId(fid) for fid in group.related_feedback_ids if ObjectId.is_valid(fid)],
                    common_themes=group.common_themes,
                    evidence=group.evidence,
                    suggested_capability=group.suggested_capability,
                    grouping_confidence=group.grouping_confidence,
                    grouping_reason=group.grouping_reason,
                    unique_customer_count=metrics["unique_customer_count"],
                    urgency_distribution=metrics["urgency_distribution"],
                    ai_metadata=metadata,
                )

                created_fg = await self.feature_group_repo.create(fg_model)
                group_doc_id = str(created_fg.id)

                # Link feedback items to the feature group
                if self.feedback_repo is not None:
                    await self.feedback_repo.link_to_feature_group(
                        feedback_ids=group.related_feedback_ids,
                        feature_group_id=created_fg.id,
                        workspace_id=ws_oid,
                    )

            result_item = FeatureGroupResult(
                feature_group_id=group_doc_id,
                workspace_id=workspace_id,
                group_name=group.group_name,
                feature_summary=group.feature_summary,
                consolidated_description=group.consolidated_description,
                related_feedback_ids=group.related_feedback_ids,
                total_request_count=metrics["total_request_count"],
                unique_customer_count=metrics["unique_customer_count"],
                sentiment_distribution=metrics["sentiment_distribution"],
                urgency_distribution=metrics["urgency_distribution"],
                common_themes=group.common_themes,
                common_pain_points=group.common_pain_points,
                evidence=group.evidence,
                suggested_capability=group.suggested_capability,
                grouping_confidence=group.grouping_confidence,
                grouping_reason=group.grouping_reason,
                grouping_status="suggested",
                created_at=now,
                updated_at=now,
            )
            persisted_results.append(result_item)

        # Trigger automatic background AI prioritization for newly created feature groups
        if persisted_results and self.feature_group_repo is not None:
            try:
                from app.services.prioritization_background import PrioritizationBackgroundWorker
                new_group_ids = [r.feature_group_id for r in persisted_results]
                PrioritizationBackgroundWorker.get_instance().trigger_auto_prioritization(
                    db=self.feature_group_repo.db,
                    workspace_id=workspace_id,
                    feature_group_ids=new_group_ids,
                    force_reanalyze=True,
                )
            except Exception as auto_prio_err:
                logger.warning("Could not trigger auto-prioritization after grouping: %s", auto_prio_err)

        return GroupFeaturesResponse(
            workspace_id=workspace_id,
            groups_created=len(persisted_results),
            total_feedback_analyzed=len(candidates),
            groups=persisted_results,
            ungrouped_feedback_ids=ungrouped_ids,
            execution_metadata={
                **metadata,
                "sanitized_group_count": len(sanitized_groups),
                "ungrouped_count": len(ungrouped_ids),
            },
        )

    async def get_feature_groups(
        self,
        workspace_id: str,
        user: User,
        status: Optional[str] = None,
        min_request_count: Optional[int] = None,
        limit: int = 100,
        skip: int = 0,
    ) -> List[FeatureGroupResult]:
        """Retrieves stored feature groups for a workspace."""
        await self.verify_workspace_access(user, workspace_id)

        if not self.feature_group_repo:
            return []

        ws_oid = ObjectId(str(workspace_id)) if ObjectId.is_valid(str(workspace_id)) else workspace_id

        groups = await self.feature_group_repo.find_by_workspace_and_filters(
            workspace_id=workspace_id,
            status=status,
            min_feedback_count=min_request_count,
            limit=limit,
            skip=skip,
        )

        results: List[FeatureGroupResult] = []
        for g in groups:
            sent_dist = {
                "Positive": g.sentiment_distribution.positive if g.sentiment_distribution else 0,
                "Neutral": g.sentiment_distribution.neutral if g.sentiment_distribution else 0,
                "Negative": g.sentiment_distribution.negative if g.sentiment_distribution else 0,
                "Mixed": 0,
            }

            fids = [str(fid) for fid in g.related_feedback_ids] if g.related_feedback_ids else []

            # If related_feedback_ids is empty in database, fallback to querying feedback items pointing to this group
            if not fids and self.feedback_repo:
                pointing_cursor = self.feedback_repo.collection.find(
                    {"workspaceId": ws_oid, "featureGroupId": g.id},
                    {"_id": 1}
                )
                pointing_docs = await pointing_cursor.to_list(length=100)
                if pointing_docs:
                    fids = [str(d["_id"]) for d in pointing_docs]

            cat_val = g.category.value if hasattr(g.category, "value") else str(g.category or "Feature Requests")

            results.append(
                FeatureGroupResult(
                    feature_group_id=str(g.id),
                    workspace_id=str(g.workspace_id),
                    group_name=g.title,
                    feature_summary=g.feature_summary or g.description[:200],
                    consolidated_description=g.description,
                    related_feedback_ids=fids,
                    total_request_count=g.feedback_count or len(fids),
                    unique_customer_count=g.unique_customer_count or 1,
                    sentiment_distribution=sent_dist,
                    urgency_distribution=g.urgency_distribution or {},
                    common_themes=g.common_themes or [g.primary_tag],
                    category=cat_val,
                    primary_tag=g.primary_tag,
                    common_pain_points=g.pain_points or [],
                    evidence=g.evidence or [],
                    suggested_capability=g.suggested_capability,
                    grouping_confidence=g.grouping_confidence or 0.8,
                    grouping_reason=g.grouping_reason,
                    grouping_status=g.status.value if hasattr(g.status, "value") else str(g.status),
                    created_at=g.created_at,
                    updated_at=g.updated_at,
                )
            )

        return results

    async def get_feature_group_by_id(
        self,
        group_id: str,
        workspace_id: str,
        user: User,
    ) -> FeatureGroupResult:
        """Retrieves a single feature group by its ID."""
        await self.verify_workspace_access(user, workspace_id)

        if not ObjectId.is_valid(group_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid feature group ID: '{group_id}'",
            )

        if not self.feature_group_repo:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable",
            )

        g = await self.feature_group_repo.find_by_id(ObjectId(group_id))
        if not g or str(g.workspace_id) != str(workspace_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Feature group not found",
            )

        sent_dist = {
            "Positive": g.sentiment_distribution.positive if g.sentiment_distribution else 0,
            "Neutral": g.sentiment_distribution.neutral if g.sentiment_distribution else 0,
            "Negative": g.sentiment_distribution.negative if g.sentiment_distribution else 0,
            "Mixed": 0,
        }
        fids = [str(fid) for fid in g.related_feedback_ids] if g.related_feedback_ids else []

        # Populate member feedback records
        feedback_items_data: List[Dict[str, Any]] = []
        if self.feedback_repo:
            valid_foids = [ObjectId(fid) for fid in fids if ObjectId.is_valid(fid)]
            query_conds = []
            if valid_foids:
                query_conds.append({"_id": {"$in": valid_foids}})
            query_conds.append({"featureGroupId": ObjectId(group_id)})
            
            fb_cursor = self.feedback_repo.collection.find(
                {"workspaceId": ObjectId(str(workspace_id)), "$or": query_conds}
            )
            fb_docs = await fb_cursor.to_list(length=100)
            seen_fb_ids = set()
            for fb in fb_docs:
                fb_id_str = str(fb.get("_id") or fb.get("id"))
                if fb_id_str in seen_fb_ids:
                    continue
                seen_fb_ids.add(fb_id_str)
                feedback_items_data.append({
                    "id": fb_id_str,
                    "title": fb.get("title", ""),
                    "description": fb.get("description", ""),
                    "customer": fb.get("customerName") or fb.get("customer_name") or fb.get("customer", "Anonymous"),
                    "company": fb.get("companyName") or fb.get("company_name") or fb.get("company", ""),
                    "sentiment": fb.get("sentiment", "Neutral"),
                    "priority": fb.get("priority", "Medium"),
                    "sourceType": fb.get("sourceType") or fb.get("source_type", "manual"),
                    "createdAt": str(fb.get("createdAt") or fb.get("created_at") or ""),
                })
            # Also update fids list if pointing feedback items were discovered
            if not fids and seen_fb_ids:
                fids = list(seen_fb_ids)

        cat_val = g.category.value if hasattr(g.category, "value") else str(g.category or "Feature Requests")

        return FeatureGroupResult(
            feature_group_id=str(g.id),
            workspace_id=str(g.workspace_id),
            group_name=g.title,
            feature_summary=g.feature_summary or g.description[:200],
            consolidated_description=g.description,
            related_feedback_ids=fids,
            total_request_count=g.feedback_count or len(fids),
            unique_customer_count=g.unique_customer_count or 1,
            sentiment_distribution=sent_dist,
            urgency_distribution=g.urgency_distribution or {},
            common_themes=g.common_themes or [g.primary_tag],
            category=cat_val,
            primary_tag=g.primary_tag,
            common_pain_points=g.pain_points or [],
            evidence=g.evidence or [],
            suggested_capability=g.suggested_capability,
            grouping_confidence=g.grouping_confidence or 0.8,
            grouping_reason=g.grouping_reason,
            grouping_status=g.status.value if hasattr(g.status, "value") else str(g.status),
            feedback_items=feedback_items_data,
            created_at=g.created_at,
            updated_at=g.updated_at,
        )

    async def get_feature_group_feedback_items(
        self,
        group_id: str,
        workspace_id: str,
        user: User,
    ) -> List[Dict[str, Any]]:
        """Retrieves actual customer feedback items belonging to a feature group."""
        group_res = await self.get_feature_group_by_id(group_id, workspace_id, user)
        return group_res.feedback_items or []

    async def merge_feature_groups(
        self,
        workspace_id: str,
        source_group_id: str,
        target_group_id: str,
        user: User,
    ) -> MergeFeatureGroupsResponse:
        """
        Merges a source feature group into a destination target feature group:
        1. Enforces workspace authorization and checks IDs.
        2. Validates that source != target and neither is already merged.
        3. Repoints all feedback items to the destination group.
        4. Recalculates demand counts and sentiment distribution deterministically.
        5. Marks source group as status='merged' with mergedIntoGroupId set.
        6. Updates target group in MongoDB Atlas and returns updated FeatureGroupResult.
        """
        await self.verify_workspace_access(user, workspace_id)

        if not ObjectId.is_valid(workspace_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid workspace ID format: '{workspace_id}'",
            )
        ws_oid = ObjectId(workspace_id)

        if not ObjectId.is_valid(source_group_id) or not ObjectId.is_valid(target_group_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both source_group_id and target_group_id must be valid ObjectIds.",
            )

        if source_group_id == target_group_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot merge a feature group into itself.",
            )

        source_oid = ObjectId(source_group_id)
        target_oid = ObjectId(target_group_id)

        if not self.feature_group_repo or not self.feedback_repo:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service unavailable",
            )

        source_group = await self.feature_group_repo.find_by_id(source_oid)
        target_group = await self.feature_group_repo.find_by_id(target_oid)

        if not source_group or str(source_group.workspace_id) != workspace_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Source feature group not found in active workspace.",
            )

        if not target_group or str(target_group.workspace_id) != workspace_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target feature group not found in active workspace.",
            )

        source_status = source_group.status.value if hasattr(source_group.status, "value") else str(source_group.status)
        target_status = target_group.status.value if hasattr(target_group.status, "value") else str(target_group.status)

        if source_status == "merged":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Source feature group has already been merged into another group.",
            )

        if target_status == "merged":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target feature group has already been merged and cannot absorb new feedback.",
            )

        # 1. Combine unique feedback IDs
        source_fids = [str(fid) for fid in (source_group.related_feedback_ids or [])]
        target_fids = [str(fid) for fid in (target_group.related_feedback_ids or [])]
        all_unique_fids = list(dict.fromkeys(target_fids + source_fids))
        valid_foids = [ObjectId(fid) for fid in all_unique_fids if ObjectId.is_valid(fid)]

        # 2. Query underlying feedback records to recalculate metrics
        cursor = self.feedback_repo.collection.find({"_id": {"$in": valid_foids}, "workspaceId": ws_oid})
        raw_feedback_docs = await cursor.to_list(length=500)
        candidates = filter_eligible_feature_requests(raw_feedback_docs)
        candidate_lookup = {c.feedback_id: c for c in candidates}

        # 3. Recalculate demand metrics
        metrics = calculate_demand_metrics(all_unique_fids, candidate_lookup)

        # Combine pain points and evidence without duplicates
        combined_pain_points = list(dict.fromkeys((target_group.pain_points or []) + (source_group.pain_points or [])))
        combined_evidence = list(dict.fromkeys((target_group.evidence or []) + (source_group.evidence or [])))

        # 4. Repoint all feedback records of source to target
        repointed_res = await self.feedback_repo.collection.update_many(
            {"workspaceId": ws_oid, "$or": [{"featureGroupId": source_oid}, {"_id": {"$in": [ObjectId(fid) for fid in source_fids if ObjectId.is_valid(fid)]}}]},
            {"$set": {"featureGroupId": target_oid}},
        )

        now = datetime.now(timezone.utc)

        # 5. Update target group in MongoDB
        target_update = {
            "relatedFeedbackIds": valid_foids,
            "feedbackCount": metrics["total_request_count"],
            "uniqueCustomerCount": metrics["unique_customer_count"],
            "sentimentDistribution": {
                "Positive": metrics["sentiment_distribution"]["Positive"],
                "Neutral": metrics["sentiment_distribution"]["Neutral"],
                "Negative": metrics["sentiment_distribution"]["Negative"],
            },
            "urgencyDistribution": metrics["urgency_distribution"],
            "painPoints": combined_pain_points,
            "evidence": combined_evidence,
            "updatedAt": now,
        }
        await self.feature_group_repo.collection.update_one({"_id": target_oid}, {"$set": target_update})

        # 6. Mark source group as merged
        source_update = {
            "status": FeatureGroupStatus.MERGED.value,
            "mergedIntoGroupId": target_oid,
            "updatedAt": now,
        }
        await self.feature_group_repo.collection.update_one({"_id": source_oid}, {"$set": source_update})

        # 7. Retrieve updated target result
        updated_target = await self.get_feature_group_by_id(target_group_id, workspace_id, user)

        # Trigger automatic background AI recalculation for merged feature group
        if self.feature_group_repo is not None:
            try:
                from app.services.prioritization_background import PrioritizationBackgroundWorker
                PrioritizationBackgroundWorker.get_instance().trigger_auto_prioritization(
                    db=self.feature_group_repo.db,
                    workspace_id=workspace_id,
                    feature_group_ids=[target_group_id],
                    force_reanalyze=True,
                )
            except Exception as auto_prio_err:
                logger.warning("Could not trigger auto-prioritization after merge: %s", auto_prio_err)

        return MergeFeatureGroupsResponse(
            workspace_id=workspace_id,
            source_group_id=source_group_id,
            target_group_id=target_group_id,
            repointed_feedback_count=repointed_res.modified_count,
            updated_target_group=updated_target,
            message=f"Successfully merged '{source_group.title}' into '{target_group.title}'. {repointed_res.modified_count} feedback records repointed.",
        )

    async def detect_duplicates(
        self,
        workspace_id: str,
        user: User,
        feedback_ids: Optional[List[str]] = None,
        target_feedback_id: Optional[str] = None,
    ) -> DuplicateDetectionResponse:
        """
        Detects exact, near, and semantic duplicates across candidate feature requests.
        Combines deterministic token matching with LLM semantic distinction.
        """
        await self.verify_workspace_access(user, workspace_id)

        if not ObjectId.is_valid(workspace_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid workspace ID: '{workspace_id}'",
            )
        ws_oid = ObjectId(workspace_id)

        raw_items: List[Any] = []
        if self.feedback_repo is not None:
            query: Dict[str, Any] = {"workspaceId": ws_oid}
            if feedback_ids:
                valid_oids = [ObjectId(fid) for fid in feedback_ids if ObjectId.is_valid(fid)]
                if valid_oids:
                    query["_id"] = {"$in": valid_oids}

            cursor = self.feedback_repo.collection.find(query).limit(50)
            raw_items = await cursor.to_list(length=50)

        candidates = filter_eligible_feature_requests(raw_items)
        if not candidates:
            return DuplicateDetectionResponse(
                workspace_id=workspace_id,
                total_evaluated=0,
                duplicates_found=0,
                results=[],
                execution_metadata={"status": "no_candidates_to_evaluate"},
            )

        # 1. Deterministic lexical detection
        lexical_duplicates = detect_lexical_duplicates(candidates)

        # 2. LLM Semantic detection
        comparison_context = ""
        if target_feedback_id:
            comparison_context = f"Specifically evaluate target feedback item '{target_feedback_id}' against all other items."

        agent_exec = await self.agent.detect_duplicates(
            candidates=candidates,
            comparison_context=comparison_context,
            temperature=0.1,
        )
        llm_duplicates = agent_exec.data.duplicates
        metadata = agent_exec.metadata.model_dump()

        # Combine results avoiding duplicated pairs
        seen_pairs = set()
        merged_results: List[DuplicateDetectionItem] = []

        for item in lexical_duplicates:
            pair_key = tuple(sorted([item.feedback_id, item.matched_feedback_id or ""]))
            seen_pairs.add(pair_key)
            merged_results.append(item)

        for item in llm_duplicates:
            pair_key = tuple(sorted([item.feedback_id, item.matched_feedback_id or ""]))
            if pair_key not in seen_pairs:
                seen_pairs.add(pair_key)
                merged_results.append(item)

        # Filter to actual duplicate relationships (exclude UNRELATED)
        actionable_duplicates = [
            d for d in merged_results if d.duplicate_type != DuplicateType.UNRELATED
        ]

        return DuplicateDetectionResponse(
            workspace_id=workspace_id,
            total_evaluated=len(candidates),
            duplicates_found=len(actionable_duplicates),
            results=merged_results,
            execution_metadata={
                **metadata,
                "lexical_duplicate_count": len(lexical_duplicates),
                "semantic_duplicate_count": len(llm_duplicates),
            },
        )
