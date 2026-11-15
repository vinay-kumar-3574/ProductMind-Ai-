"""
ProductMind AI — Cross-Domain Product Intelligence Service
Provides deterministic calculations for:
1. Product Health Score (0-100) with dynamic reweighting across 4 dimensions:
   - Customer Sentiment Index (30%)
   - Feature Adoption Index (25%)
   - Delivery Predictability Index (25%)
   - Prioritization Alignment Index (20%)
2. Delivery Risk Score & Item-Level Bottleneck/Overdue Detection
3. Feature Opportunity Index combining feedback demand & usage telemetry
4. Traceable Evidence & Data Coverage Reporting
"""

from datetime import date, datetime, time, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional, Set, Tuple
from bson import ObjectId
from fastapi import HTTPException, status

from app.core.enums import PlatformRole
from app.models.auth import User, Workspace
from app.models.feedback import FeedbackItem
from app.models.intelligence import FeatureGroup
from app.models.planning import PrioritizationScenario, RoadmapItem
from app.repositories import (
    AnalyticsDailyRollupRepository,
    AnalyticsEventRepository,
    FeatureGroupRepository,
    FeedbackRepository,
    PrioritizationScenarioRepository,
    RoadmapRepository,
    WorkspaceMembershipRepository,
    WorkspaceRepository,
)
from app.schemas.intelligence import (
    CustomerPainPointItem,
    CustomerSentimentMetrics,
    DeliveryPredictabilityMetrics,
    DeliveryRiskItem,
    DeliveryRiskReport,
    FeatureAdoptionMetrics,
    FeatureOpportunityItem,
    PrioritizationAlignmentMetrics,
    ProductHealthScore,
    ProductIntelligenceSummary,
    TopFeatureMetric,
)

logger = logging.getLogger("productmind.intelligence")

NOMINAL_WEIGHTS: Dict[str, float] = {
    "sentiment": 0.30,
    "adoption": 0.25,
    "delivery": 0.25,
    "alignment": 0.20,
}


class ProductIntelligenceService:
    def __init__(
        self,
        feedback_repo: FeedbackRepository,
        analytics_rollup_repo: AnalyticsDailyRollupRepository,
        analytics_event_repo: AnalyticsEventRepository,
        feature_group_repo: FeatureGroupRepository,
        prioritization_scenario_repo: PrioritizationScenarioRepository,
        roadmap_repo: RoadmapRepository,
        workspace_repo: WorkspaceRepository,
        membership_repo: WorkspaceMembershipRepository,
    ):
        self.feedback_repo = feedback_repo
        self.analytics_rollup_repo = analytics_rollup_repo
        self.analytics_event_repo = analytics_event_repo
        self.feature_group_repo = feature_group_repo
        self.prioritization_scenario_repo = prioritization_scenario_repo
        self.roadmap_repo = roadmap_repo
        self.workspace_repo = workspace_repo
        self.membership_repo = membership_repo

    async def authorize_workspace(self, workspace_id: str, user: User) -> Workspace:
        """Validates workspace ID and ensures calling user has authenticated access."""
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
        if getattr(user, "platform_role", None) == PlatformRole.PLATFORM_ADMIN:
            return workspace
        if str(workspace.owner_id) == str(user.id):
            return workspace
        membership = await self.membership_repo.find_by_workspace_and_user(workspace.id, user.id)
        if not membership or getattr(membership, "status", None) != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have access to this workspace",
            )
        return workspace

    def _resolve_date_window(
        self,
        time_range: Optional[str] = "30d",
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Tuple[date, date, datetime, datetime]:
        today = datetime.now(timezone.utc).date()
        if start_date and end_date:
            if start_date > end_date:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="startDate must not be after endDate",
                )
            start, end = start_date, end_date
        elif time_range == "7d":
            start, end = today - timedelta(days=6), today
        elif time_range == "90d":
            start, end = today - timedelta(days=89), today
        elif time_range == "all":
            start, end = today - timedelta(days=364), today
        else:  # default 30d
            start, end = today - timedelta(days=29), today

        start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
        end_dt_exclusive = datetime.combine(end + timedelta(days=1), time.min, tzinfo=timezone.utc)
        return start, end, start_dt, end_dt_exclusive

    # -------------------------------------------------------------------------
    # 1. Customer Sentiment Index Calculation
    # -------------------------------------------------------------------------
    def compute_sentiment_metrics(self, feedback_items: List[FeedbackItem]) -> CustomerSentimentMetrics:
        """
        Calculates normalized sentiment index (0-100 scale).
        Formula: ((Positive * 100) + (Neutral * 50) + (Negative * 0)) / total_analyzed
        """
        def _val(s: Any) -> str:
            if hasattr(s, "value"):
                return str(s.value).lower()
            return str(s).lower()

        valid_items = [
            f for f in feedback_items
            if getattr(f, "sentiment", None) is not None
            and _val(f.sentiment).strip()
        ]
        total_analyzed = len(valid_items)
        if total_analyzed == 0:
            return CustomerSentimentMetrics(
                status="insufficient_data",
                totalAnalyzed=0,
                positiveCount=0,
                neutralCount=0,
                negativeCount=0,
                positiveRatio=0.0,
                neutralRatio=0.0,
                negativeRatio=0.0,
                sentimentIndex=None,
            )

        pos_count = sum(1 for f in valid_items if _val(f.sentiment) in ("positive", "pos"))
        neu_count = sum(1 for f in valid_items if _val(f.sentiment) in ("neutral", "neu"))
        neg_count = sum(1 for f in valid_items if _val(f.sentiment) in ("negative", "neg"))

        pos_ratio = round(pos_count / total_analyzed, 4)
        neu_ratio = round(neu_count / total_analyzed, 4)
        neg_ratio = round(neg_count / total_analyzed, 4)

        index = round(((pos_count * 100.0) + (neu_count * 50.0) + (neg_count * 0.0)) / total_analyzed, 2)


        return CustomerSentimentMetrics(
            status="available",
            totalAnalyzed=total_analyzed,
            positiveCount=pos_count,
            neutralCount=neu_count,
            negativeCount=neg_count,
            positiveRatio=pos_ratio,
            neutralRatio=neu_ratio,
            negativeRatio=neg_ratio,
            sentimentIndex=index,
        )

    # -------------------------------------------------------------------------
    # 2. Feature Adoption Index Calculation
    # -------------------------------------------------------------------------
    async def compute_adoption_metrics(
        self,
        ws_oid: ObjectId,
        start_date: date,
        end_date: date,
        start_dt: datetime,
        end_dt_exclusive: datetime,
    ) -> FeatureAdoptionMetrics:
        """
        Calculates feature adoption index from telemetry events and daily rollups.
        Formula: mean adoption percentage across top active features (0-100 scale).
        """
        raw_overview = await self.analytics_event_repo.aggregate_range_overview(
            ws_oid, start_dt, end_dt_exclusive
        )
        total_events = raw_overview.get("totalEvents", 0)
        active_users = raw_overview.get("activeUsers")

        if total_events == 0:
            return FeatureAdoptionMetrics(
                status="insufficient_data",
                totalFeaturesTracked=0,
                activeUsers=None,
                totalEvents=0,
                avgAdoptionRate=None,
                topFeatures=[],
                adoptionIndex=None,
                telemetryCoverage="no_data",
            )

        feature_page = await self.analytics_event_repo.aggregate_feature_page(
            ws_oid, start_dt, end_dt_exclusive, page=1, limit=10
        )
        items = feature_page.get("items", [])
        top_features: List[TopFeatureMetric] = []
        adoption_rates: List[float] = []

        for f in items:
            event_count = f.get("eventCount", 0)
            unique_users = f.get("uniqueUsers")
            adoption_pct = None
            if active_users and active_users > 0 and unique_users is not None:
                adoption_pct = round((unique_users / active_users) * 100.0, 2)
                adoption_rates.append(adoption_pct)

            top_features.append(
                TopFeatureMetric(
                    name=f.get("_id", "Unknown"),
                    eventCount=event_count,
                    uniqueUsers=unique_users,
                    adoptionPercent=adoption_pct,
                    trendDeltaPercent=None,
                )
            )

        if not adoption_rates:
            # Events exist but without user linkage; adoption rate cannot be verified
            return FeatureAdoptionMetrics(
                status="insufficient_data",
                totalFeaturesTracked=len(items),
                activeUsers=active_users,
                totalEvents=total_events,
                avgAdoptionRate=None,
                topFeatures=top_features,
                adoptionIndex=None,
                telemetryCoverage="partial",
            )

        avg_adoption = round(sum(adoption_rates) / len(adoption_rates), 2)
        adoption_index = round(min(100.0, max(0.0, avg_adoption)), 2)

        return FeatureAdoptionMetrics(
            status="available",
            totalFeaturesTracked=len(items),
            activeUsers=active_users,
            totalEvents=total_events,
            avgAdoptionRate=avg_adoption,
            topFeatures=top_features,
            adoptionIndex=adoption_index,
            telemetryCoverage="observed",
        )

    # -------------------------------------------------------------------------
    # 3. Delivery Predictability Index Calculation
    # -------------------------------------------------------------------------
    def compute_delivery_metrics(
        self,
        roadmap_items: List[RoadmapItem],
        today_date: Optional[date] = None,
    ) -> DeliveryPredictabilityMetrics:
        """
        Calculates delivery predictability index from roadmap deliverables.
        Formula:
          Base score = (completed_count * 100 + in_progress_progress) / active_items
          Penalty = (overdue_ratio * 40.0) + (blocked_ratio * 30.0)
          Index = max(0.0, min(100.0, Base * (1.0 - penalty/100.0)))
        """
        if not roadmap_items:
            return DeliveryPredictabilityMetrics(
                status="insufficient_data",
                totalItems=0,
                completedItems=0,
                inProgressItems=0,
                plannedItems=0,
                blockedItems=0,
                overdueItems=0,
                onTrackItems=0,
                onTimeCompletionRate=None,
                overdueRatio=0.0,
                blockedRatio=0.0,
                predictabilityIndex=None,
            )

        today_str = (today_date or datetime.now(timezone.utc).date()).isoformat()
        total_items = len(roadmap_items)

        completed_items = 0
        in_progress_items = 0
        planned_items = 0
        blocked_items = 0
        overdue_items = 0
        on_track_items = 0
        progress_sum = 0.0

        for item in roadmap_items:
            status_obj = getattr(item, "status", "")
            status_val = (getattr(status_obj, "value", str(status_obj)) or "").lower()
            target_date = str(getattr(item, "target_date", "")).strip()
            progress = float(getattr(item, "progress", 0.0) or 0.0)


            is_completed = status_val in ("shipped", "completed", "done")
            is_blocked = status_val in ("blocked", "deferred") or bool(getattr(item, "blocked_by", None))
            is_overdue = not is_completed and bool(target_date) and target_date < today_str

            if is_completed:
                completed_items += 1
                progress_sum += 100.0
            elif status_val in ("in progress", "in_progress", "in-progress", "in review", "in_review"):
                in_progress_items += 1
                progress_sum += progress
            else:
                planned_items += 1
                progress_sum += progress

            if is_blocked:
                blocked_items += 1
            if is_overdue:
                overdue_items += 1

            if not is_overdue and not is_blocked and not is_completed:
                on_track_items += 1

        due_items_count = completed_items + overdue_items
        on_time_rate = round((completed_items / due_items_count) * 100.0, 2) if due_items_count > 0 else 100.0
        overdue_ratio = round(overdue_items / total_items, 4)
        blocked_ratio = round(blocked_items / total_items, 4)

        avg_progress = progress_sum / total_items
        penalty = (overdue_ratio * 40.0) + (blocked_ratio * 30.0)
        predictability_index = round(max(0.0, min(100.0, (avg_progress * 0.7 + on_time_rate * 0.3) * (1.0 - penalty / 100.0))), 2)

        return DeliveryPredictabilityMetrics(
            status="available",
            totalItems=total_items,
            completedItems=completed_items,
            inProgressItems=in_progress_items,
            plannedItems=planned_items,
            blockedItems=blocked_items,
            overdueItems=overdue_items,
            onTrackItems=on_track_items,
            onTimeCompletionRate=on_time_rate,
            overdueRatio=overdue_ratio,
            blockedRatio=blocked_ratio,
            predictabilityIndex=predictability_index,
        )

    # -------------------------------------------------------------------------
    # 4. Prioritization Alignment Index Calculation
    # -------------------------------------------------------------------------
    def compute_alignment_metrics(
        self,
        scenarios: List[PrioritizationScenario],
        feature_groups: List[FeatureGroup],
    ) -> PrioritizationAlignmentMetrics:
        """
        Calculates prioritization alignment index (0-100 scale).
        Evaluates average composite score, proportion of critical/high priority items,
        and alignment between prioritized items and verified customer demand.
        """
        if not scenarios:
            return PrioritizationAlignmentMetrics(
                status="insufficient_data",
                totalScenarios=0,
                avgPriorityScore=None,
                criticalCount=0,
                highCount=0,
                mediumCount=0,
                demandCorrelation=None,
                alignmentIndex=None,
            )

        valid_scores = [
            float(sc.final_score)
            for sc in scenarios
            if getattr(sc, "final_score", None) is not None
        ]
        if not valid_scores:
            return PrioritizationAlignmentMetrics(
                status="insufficient_data",
                totalScenarios=len(scenarios),
                avgPriorityScore=None,
                criticalCount=0,
                highCount=0,
                mediumCount=0,
                demandCorrelation=None,
                alignmentIndex=None,
            )

        avg_score = round(sum(valid_scores) / len(valid_scores), 2)
        critical_count = sum(1 for s in valid_scores if s >= 80.0)
        high_count = sum(1 for s in valid_scores if 60.0 <= s < 80.0)
        medium_count = sum(1 for s in valid_scores if 40.0 <= s < 60.0)

        # Measure alignment with customer demand: check if high-scoring scenarios link to feature groups with feedback
        fg_map = {str(fg.id): fg for fg in feature_groups if fg.id}
        demand_correlated = 0
        for sc in scenarios:
            fg_id = str(getattr(sc, "feature_group_id", "") or "")
            if fg_id and fg_id in fg_map:
                if (fg_map[fg_id].feedback_count or 0) > 0:
                    demand_correlated += 1
            elif (getattr(sc, "final_score", 0.0) or 0.0) >= 50.0:
                demand_correlated += 1

        demand_ratio = round(demand_correlated / len(scenarios), 4)
        alignment_index = round(min(100.0, max(0.0, (avg_score * 0.7) + (demand_ratio * 30.0))), 2)

        return PrioritizationAlignmentMetrics(
            status="available",
            totalScenarios=len(scenarios),
            avgPriorityScore=avg_score,
            criticalCount=critical_count,
            highCount=high_count,
            mediumCount=medium_count,
            demandCorrelation=demand_ratio,
            alignmentIndex=alignment_index,
        )

    # -------------------------------------------------------------------------
    # 5. Dynamic Product Health Score & Reweighting Engine
    # -------------------------------------------------------------------------
    def compute_product_health_score(
        self,
        sentiment: CustomerSentimentMetrics,
        adoption: FeatureAdoptionMetrics,
        delivery: DeliveryPredictabilityMetrics,
        alignment: PrioritizationAlignmentMetrics,
    ) -> ProductHealthScore:
        """
        Dynamically reweights available health dimensions:
        Nominal weights: Sentiment=0.30, Adoption=0.25, Delivery=0.25, Alignment=0.20
        If any dimension is unavailable, available weights are normalized to sum to 1.0.
        If all dimensions are unavailable, returns score=None, status='unavailable'.
        """
        dimension_map = {
            "sentiment": sentiment.sentiment_index if sentiment.status == "available" else None,
            "adoption": adoption.adoption_index if adoption.status == "available" else None,
            "delivery": delivery.predictability_index if delivery.status == "available" else None,
            "alignment": alignment.alignment_index if alignment.status == "available" else None,
        }

        available = [dim for dim, val in dimension_map.items() if val is not None]
        missing = [dim for dim, val in dimension_map.items() if val is None]

        if not available:
            return ProductHealthScore(
                score=None,
                status="unavailable",
                nominalWeights=NOMINAL_WEIGHTS,
                effectiveWeights={k: 0.0 for k in NOMINAL_WEIGHTS},
                availableDimensions=[],
                missingDimensions=list(NOMINAL_WEIGHTS.keys()),
                coverageState="unavailable",
                summaryVerdict="Insufficient workspace data across all intelligence dimensions to calculate Product Health Score.",
            )

        available_weight_sum = sum(NOMINAL_WEIGHTS[dim] for dim in available)
        effective_weights = {
            dim: (round(NOMINAL_WEIGHTS[dim] / available_weight_sum, 4) if dim in available else 0.0)
            for dim in NOMINAL_WEIGHTS
        }

        composite_score = round(
            sum(effective_weights[dim] * dimension_map[dim] for dim in available),
            2,
        )
        coverage_state = "complete" if len(available) == 4 else "partial"

        if composite_score >= 75.0:
            health_status = "healthy"
            verdict = f"Product portfolio is performing strongly at {composite_score}/100 across {len(available)} available dimensions."
        elif composite_score >= 50.0:
            health_status = "needs_attention"
            verdict = f"Product health is moderate at {composite_score}/100; attention required on identified friction areas."
        else:
            health_status = "at_risk"
            verdict = f"Product health is at risk at {composite_score}/100 with critical delivery or sentiment drag."

        return ProductHealthScore(
            score=composite_score,
            status=health_status,
            nominalWeights=NOMINAL_WEIGHTS,
            effectiveWeights=effective_weights,
            availableDimensions=available,
            missingDimensions=missing,
            coverageState=coverage_state,
            summaryVerdict=verdict,
        )

    # -------------------------------------------------------------------------
    # 6. Delivery Risk Score & Item-Level Bottleneck Identification
    # -------------------------------------------------------------------------
    def compute_delivery_risk_report(
        self,
        roadmap_items: List[RoadmapItem],
        today_date: Optional[date] = None,
    ) -> DeliveryRiskReport:
        """
        Analyzes individual roadmap items for:
        - Overdue milestones
        - Approaching deadlines (< 14 days) with insufficient progress (< 50%)
        - Blocked deliverables
        - Dependency bottlenecks (blocking >= 2 other items)
        """
        today = today_date or datetime.now(timezone.utc).date()
        today_str = today.isoformat()

        items_at_risk: List[DeliveryRiskItem] = []
        overdue_count = 0
        blocked_count = 0
        approaching_count = 0

        # Build reverse dependency map to detect bottlenecks
        blocked_by_map: Dict[str, List[str]] = {}
        for item in roadmap_items:
            item_id = str(item.id)
            deps = [str(d) for d in (getattr(item, "dependencies", []) or [])]
            for dep_id in deps:
                blocked_by_map.setdefault(dep_id, []).append(item_id)

        bottlenecks_count = sum(1 for dep_id, dependents in blocked_by_map.items() if len(dependents) >= 2)

        for item in roadmap_items:
            item_id = str(item.id)
            title = getattr(item, "title", "Untitled")
            status_obj = getattr(item, "status", "")
            status_val = (getattr(status_obj, "value", str(status_obj)) or "").lower()
            target_str = str(getattr(item, "target_date", "")).strip()
            progress = float(getattr(item, "progress", 0.0) or 0.0)
            is_completed = status_val in ("shipped", "completed", "done")

            if is_completed:
                continue

            target_d = None
            if target_str:
                try:
                    target_d = date.fromisoformat(target_str)
                except ValueError:
                    target_d = None

            # 1. Overdue risk
            if target_d and target_d < today:
                overdue_count += 1
                days_overdue = (today - target_d).days
                items_at_risk.append(
                    DeliveryRiskItem(
                        itemId=item_id,
                        title=title,
                        status=status_val.title(),
                        targetDate=target_str,
                        progress=progress,
                        daysOverdueOrRemaining=-days_overdue,
                        riskType="overdue",
                        severity="critical" if days_overdue >= 14 else "high",
                        reason=f"Target date was {days_overdue} days ago but deliverable is only {progress}% complete.",
                        blockedBy=[],
                    )
                )
                continue

            # 2. Blocked risk
            is_blocked = status_val in ("blocked", "deferred") or bool(getattr(item, "blocked_by", None))
            if is_blocked:
                blocked_count += 1
                items_at_risk.append(
                    DeliveryRiskItem(
                        itemId=item_id,
                        title=title,
                        status="Blocked",
                        targetDate=target_str or today_str,
                        progress=progress,
                        daysOverdueOrRemaining=(target_d - today).days if target_d else 0,
                        riskType="blocked",
                        severity="high",
                        reason=f"Deliverable is marked blocked with progress stalled at {progress}%.",
                        blockedBy=[str(d) for d in (getattr(item, "dependencies", []) or [])],
                    )
                )
                continue

            # 3. Approaching deadline risk
            if target_d and 0 <= (target_d - today).days <= 14 and progress < 50.0:
                approaching_count += 1
                days_remaining = (target_d - today).days
                items_at_risk.append(
                    DeliveryRiskItem(
                        itemId=item_id,
                        title=title,
                        status=status_val.title(),
                        targetDate=target_str,
                        progress=progress,
                        daysOverdueOrRemaining=days_remaining,
                        riskType="approaching_deadline",
                        severity="medium",
                        reason=f"Target date is in {days_remaining} days but deliverable progress is only {progress}%.",
                        blockedBy=[],
                    )
                )
                continue

            # 4. Dependency bottleneck risk
            dependents = blocked_by_map.get(item_id, [])
            if len(dependents) >= 2 and progress < 60.0:
                items_at_risk.append(
                    DeliveryRiskItem(
                        itemId=item_id,
                        title=title,
                        status=status_val.title(),
                        targetDate=target_str or today_str,
                        progress=progress,
                        daysOverdueOrRemaining=(target_d - today).days if target_d else 0,
                        riskType="dependency_bottleneck",
                        severity="high",
                        reason=f"Bottleneck: This deliverable directly blocks {len(dependents)} downstream initiatives.",
                        blockedBy=[],
                    )
                )

        total_items = max(1, len(roadmap_items))
        risk_score = round(
            min(
                100.0,
                (overdue_count * 30.0)
                + (blocked_count * 25.0)
                + (approaching_count * 15.0)
                + (bottlenecks_count * 20.0),
            ),
            2,
        )

        if not roadmap_items or risk_score < 25.0:
            risk_level = "low"
        elif risk_score < 50.0:
            risk_level = "medium"
        elif risk_score < 75.0:
            risk_level = "high"
        else:
            risk_level = "critical"

        return DeliveryRiskReport(
            overallRiskScore=risk_score,
            riskLevel=risk_level,
            overdueCount=overdue_count,
            blockedCount=blocked_count,
            approachingDeadlineCount=approaching_count,
            bottlenecksCount=bottlenecks_count,
            itemsAtRisk=items_at_risk,
        )

    # -------------------------------------------------------------------------
    # 7. Feature Opportunity Index
    # -------------------------------------------------------------------------
    def compute_feature_opportunities(
        self,
        feature_groups: List[FeatureGroup],
        feedback_items: List[FeedbackItem],
        adoption_metrics: FeatureAdoptionMetrics,
    ) -> List[FeatureOpportunityItem]:
        """
        Identifies high-opportunity features: high customer demand + high urgency + low adoption or high negative sentiment.
        """
        top_features_map = {f.name.lower(): f for f in adoption_metrics.top_features}
        opportunities: List[FeatureOpportunityItem] = []

        for fg in feature_groups:
            title = getattr(fg, "title", "Untitled")
            fg_id = str(fg.id) if fg.id else None
            demand = int(getattr(fg, "feedback_count", 0) or 0)
            if demand < 1:
                continue

            sentiment_dist = getattr(fg, "sentiment_distribution", None)
            neg_count = getattr(sentiment_dist, "negative", 0) if sentiment_dist else 0
            pos_count = getattr(sentiment_dist, "positive", 0) if sentiment_dist else 0

            # Find matching adoption data
            adoption_val = None
            for feat_name, metric in top_features_map.items():
                if feat_name in title.lower() or title.lower() in feat_name:
                    adoption_val = metric.adoption_percent
                    break

            urgency_dist = getattr(fg, "urgency_distribution", {}) or {}
            has_urgent = urgency_dist.get("Critical", 0) > 0 or urgency_dist.get("High", 0) > 0
            urgency_str = "Critical" if urgency_dist.get("Critical", 0) > 0 else "High" if has_urgent else "Medium"

            # Score opportunity
            score = min(60.0, demand * 10.0)
            if has_urgent:
                score += 20.0
            if neg_count > pos_count:
                score += 15.0
            if adoption_val is not None and adoption_val < 20.0:
                score += 15.0

            opportunity_score = round(min(100.0, score), 2)
            if opportunity_score >= 35.0:
                reason = f"High customer demand ({demand} requests) combined with {urgency_str.lower()} urgency"
                if neg_count > pos_count:
                    reason += " and elevated customer dissatisfaction."
                elif adoption_val is not None and adoption_val < 20.0:
                    reason += f" and low adoption ({adoption_val}%)."
                else:
                    reason += "."

                opportunities.append(
                    FeatureOpportunityItem(
                        featureGroupId=fg_id,
                        title=title,
                        category=str(getattr(fg, "category", "Feature Request")),
                        demandCount=demand,
                        urgencyLevel=urgency_str,
                        currentAdoptionPercent=adoption_val,
                        negativeSentimentCount=neg_count,
                        opportunityScore=opportunity_score,
                        reason=reason,
                        keyPainPoints=list(getattr(fg, "pain_points", []) or [])[:3],
                    )
                )

        opportunities.sort(key=lambda o: o.opportunity_score, reverse=True)
        return opportunities[:10]

    # -------------------------------------------------------------------------
    # 8. Customer Pain Points Aggregation
    # -------------------------------------------------------------------------
    def extract_top_pain_points(
        self,
        feedback_items: List[FeedbackItem],
        feature_groups: List[FeatureGroup],
    ) -> List[CustomerPainPointItem]:
        """Synthesizes recurring customer pain points across feedback items and feature groups."""
        pain_point_clusters: Dict[str, Dict[str, Any]] = {}

        # 1. Pain points from feature groups
        for fg in feature_groups:
            theme = getattr(fg, "title", "General")
            for pp in (getattr(fg, "pain_points", []) or []):
                cleaned = str(pp).strip()
                if cleaned:
                    key = cleaned.lower()
                    if key not in pain_point_clusters:
                        pain_point_clusters[key] = {
                            "theme": theme,
                            "pain_point": cleaned,
                            "severity": "High",
                            "frequency": getattr(fg, "feedback_count", 1) or 1,
                            "samples": [str(fid) for fid in (getattr(fg, "related_feedback_ids", []) or [])[:3]],
                        }
                    else:
                        pain_point_clusters[key]["frequency"] += 1

        # 2. Urgent negative feedback items
        for f in feedback_items:
            sent_obj = getattr(f, "sentiment", None)
            sentiment = (getattr(sent_obj, "value", str(sent_obj)) or "").lower() if sent_obj else ""
            prio_obj = getattr(f, "source_priority", None) or getattr(f, "ai_predicted_priority", None)
            priority = (getattr(prio_obj, "value", str(prio_obj)) or "").lower() if prio_obj else ""

            if sentiment in ("negative", "neg") and priority in ("urgent", "critical", "high"):
                desc = str(getattr(f, "title", "")).strip()
                if desc and len(desc) >= 8:
                    key = desc.lower()
                    if key not in pain_point_clusters:
                        pain_point_clusters[key] = {
                            "theme": str(getattr(f, "category", "Feedback")),
                            "pain_point": desc,
                            "severity": "Critical" if priority in ("urgent", "critical") else "High",
                            "frequency": 1,
                            "samples": [str(f.id)] if f.id else [],
                        }
                    else:
                        pain_point_clusters[key]["frequency"] += 1

        sorted_clusters = sorted(
            pain_point_clusters.values(),
            key=lambda c: (1 if c["severity"] == "Critical" else 0, c["frequency"]),
            reverse=True,
        )

        return [
            CustomerPainPointItem(
                theme=c["theme"],
                customerPainPoint=c["pain_point"],
                severity=c["severity"],
                frequency=c["frequency"],
                sampleFeedbackIds=c["samples"],
            )
            for c in sorted_clusters[:8]
        ]

    # -------------------------------------------------------------------------
    # 9. Main Orchestration: Unified Product Intelligence Summary
    # -------------------------------------------------------------------------
    async def get_product_intelligence(
        self,
        workspace_id: str,
        user: User,
        time_range: str = "30d",
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> ProductIntelligenceSummary:
        """
        Gathers workspace data across all 5 Atlas domains, verifies access,
        and computes deterministic cross-domain product intelligence metrics.
        """
        workspace = await self.authorize_workspace(workspace_id, user)
        ws_oid = workspace.id

        start_d, end_d, start_dt, end_dt_exclusive = self._resolve_date_window(
            time_range, start_date, end_date
        )

        # 1. Fetch live Atlas records
        feedback_items = await self.feedback_repo.find_by_workspace(ws_oid, limit=500)
        roadmap_items = await self.roadmap_repo.find_items_by_workspace(ws_oid)
        feature_groups = await self.feature_group_repo.find_by_workspace(ws_oid)
        scenarios = await self.prioritization_scenario_repo.find_by_workspace(ws_oid)

        # 2. Compute dimension metrics
        sentiment_metrics = self.compute_sentiment_metrics(feedback_items)
        adoption_metrics = await self.compute_adoption_metrics(
            ws_oid, start_d, end_d, start_dt, end_dt_exclusive
        )
        delivery_metrics = self.compute_delivery_metrics(roadmap_items, today_date=end_d)
        alignment_metrics = self.compute_alignment_metrics(scenarios, feature_groups)

        # 3. Dynamic Product Health Score
        health_score = self.compute_product_health_score(
            sentiment_metrics, adoption_metrics, delivery_metrics, alignment_metrics
        )

        # 4. Delivery Risk Report
        delivery_risk = self.compute_delivery_risk_report(roadmap_items, today_date=end_d)

        # 5. Feature Opportunities & Top Pain Points
        feature_opportunities = self.compute_feature_opportunities(
            feature_groups, feedback_items, adoption_metrics
        )
        top_pain_points = self.extract_top_pain_points(feedback_items, feature_groups)

        # 6. Diagnostics & Limitations
        diagnostics: List[str] = []
        if sentiment_metrics.status != "available":
            diagnostics.append("Customer sentiment data is insufficient (no analyzed feedback items found).")
        if adoption_metrics.status != "available":
            diagnostics.append("Product telemetry is unavailable for the selected date window.")
        if delivery_metrics.status != "available":
            diagnostics.append("Roadmap deliverables are empty; delivery predictability cannot be assessed.")
        if alignment_metrics.status != "available":
            diagnostics.append("No saved prioritization scenarios found in this workspace.")

        data_coverage = {
            "totalFeedbackItems": len(feedback_items),
            "analyzedFeedbackItems": sentiment_metrics.total_analyzed,
            "totalTelemetryEvents": adoption_metrics.total_events,
            "trackedFeatures": adoption_metrics.total_features_tracked,
            "totalRoadmapDeliverables": len(roadmap_items),
            "totalPrioritizationScenarios": len(scenarios),
            "totalFeatureGroups": len(feature_groups),
            "dateRange": {
                "startDate": start_d.isoformat(),
                "endDate": end_d.isoformat(),
                "timeRange": time_range,
            },
        }

        return ProductIntelligenceSummary(
            workspaceId=str(ws_oid),
            timeRange=time_range,
            calculatedAt=datetime.now(timezone.utc),
            healthScore=health_score,
            sentimentMetrics=sentiment_metrics,
            adoptionMetrics=adoption_metrics,
            deliveryMetrics=delivery_metrics,
            alignmentMetrics=alignment_metrics,
            deliveryRisk=delivery_risk,
            featureOpportunities=feature_opportunities,
            topCustomerPainPoints=top_pain_points,
            dataCoverage=data_coverage,
            missingDataDiagnostics=diagnostics,
        )
