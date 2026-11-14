"""
ProductMind AI — Product Planning Service
Orchestrates feature group and prioritization retrieval, workspace authorization,
LLM plan generation, human review lifecycle, and MongoDB PRD persistence.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status

from app.ai.agents.product_planning.agent import ProductPlanningAgent
from app.ai.agents.product_planning.schemas import (
    GenerateProductPlanRequest,
    GeneratePRDRequest,
    GenerateUserStoriesRequest,
    ProductPlanResponse,
    ProductPlanningAgentOutput,
    ProductRequirementsDocument,
    ProductRequirement,
    RequirementOrigin,
    infer_expected_direction,
    ProductStrategicContext,
    ReviewPlanRequest,
    UpdatePRDSectionsRequest,
    RegenerateSectionRequest,
    UserStory,
    AcceptanceCriterion,
    TechnicalRequirement,
    SuccessMetric,
    RiskItem,
    RoadmapPhase,
)
from app.core.enums import PlatformRole, MembershipStatus, PRDStatus
from app.models.auth import User
from app.models.planning import PRD, PRDSections
from app.repositories import (
    PRDRepository,
    FeatureGroupRepository,
    PrioritizationScenarioRepository,
    FeedbackRepository,
    WorkspaceRepository,
    WorkspaceMembershipRepository,
)

logger = logging.getLogger("productmind.ai.service.product_planning")


def build_prd_sections(
    prd: ProductRequirementsDocument,
    user_stories: List[UserStory],
    technical_requirements: List[TechnicalRequirement],
    roadmap_phases: List[RoadmapPhase],
) -> PRDSections:
    """Builds backward-compatible PRDSections for legacy UI/reports."""
    return PRDSections(
        overview=prd.executive_summary or "",
        problem_statement=prd.problem_statement or "",
        target_users="\n".join(f"- {u}" for u in prd.target_users) if prd.target_users else "",
        customer_pain_points="\n".join(f"- {p}" for p in prd.customer_pain_points) if prd.customer_pain_points else "",
        proposed_solution=prd.proposed_solution or "",
        goals_and_success_metrics="\n".join(
            ["Business Objectives:"]
            + [f"- {b}" for b in prd.business_objectives]
            + ["Success Metrics:"]
            + [f"- {m}" for m in prd.success_metrics]
        ),
        functional_requirements="\n".join(
            f"- [{r.requirement_id}] ({r.origin}) {r.title}: {r.description}" + (f' (Ref: "{r.source_reference}")' if r.source_reference else "")
            if hasattr(r, "requirement_id") else f"- {r}"
            for r in prd.functional_requirements
        ) if prd.functional_requirements else "",
        non_functional_requirements="\n".join(
            f"- [{r.requirement_id}] ({r.origin}) {r.title}: {r.description}" + (f' (Threshold: {r.numerical_threshold})' if r.numerical_threshold else " [Requires Confirmation]")
            if hasattr(r, "requirement_id") else f"- {r}"
            for r in prd.non_functional_requirements
        ) if prd.non_functional_requirements else "",
        user_stories="\n\n".join(f"[{s.story_id}] {s.title}\n{s.description}" for s in user_stories) if user_stories else "",
        acceptance_criteria="\n\n".join(
            f"{s.story_id} Acceptance Criteria:\n"
            + "\n".join(f"  - [{ac.criterion_id}] ({ac.scenario_type}) {ac.description}" for ac in s.acceptance_criteria)
            for s in user_stories
            if s.acceptance_criteria
        ),
        dependencies_and_constraints="\n".join(
            ["Dependencies:"]
            + [f"- {d}" for d in prd.dependencies]
            + ["Technical Suggestions:"]
            + [f"- [{t.category}] {t.title}: {t.description}" for t in technical_requirements]
        ),
        risks_and_mitigations="\n".join(f"- {r}" for r in prd.risks_and_assumptions) if prd.risks_and_assumptions else "",
        release_plan="\n\n".join(
            f"{p.phase_name}: {p.objective}\nTasks:\n"
            + "\n".join(f"  - {t}" for t in p.tasks)
            + "\nDeliverables:\n"
            + "\n".join(f"  - {d}" for d in p.deliverables)
            for p in roadmap_phases
        ),
    )


def bump_semver(current_version: Optional[str], bump_type: str = "patch") -> str:
    """
    Safely increments a semantic version string.
    Supported bump_type: 'patch' (1.0.0 -> 1.0.1), 'minor' (1.0.0 -> 1.1.0), 'major' (1.0.0 -> 2.0.0), 'none'.
    Handles non-standard versions gracefully.
    """
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
        else:  # default patch
            return f"{major}.{minor}.{patch + 1}"
    except (ValueError, IndexError):
        return f"{v_str}.1"


CANONICAL_SECTION_KEYS = {
    "overview",
    "problem_statement",
    "target_users",
    "customer_pain_points",
    "proposed_solution",
    "goals_and_success_metrics",
    "functional_requirements",
    "non_functional_requirements",
    "user_stories",
    "acceptance_criteria",
    "dependencies_and_constraints",
    "risks_and_mitigations",
    "release_plan",
}

SECTION_KEY_MAP = {
    "overview": "overview",
    "executive_summary": "overview",
    "executivesummary": "overview",
    "problem_statement": "problem_statement",
    "problemstatement": "problem_statement",
    "target_users": "target_users",
    "targetusers": "target_users",
    "customer_pain_points": "customer_pain_points",
    "customerpainpoints": "customer_pain_points",
    "proposed_solution": "proposed_solution",
    "proposedsolution": "proposed_solution",
    "goals_and_success_metrics": "goals_and_success_metrics",
    "goalsandsuccessmetrics": "goals_and_success_metrics",
    "success_metrics": "goals_and_success_metrics",
    "successmetrics": "goals_and_success_metrics",
    "functional_requirements": "functional_requirements",
    "functionalrequirements": "functional_requirements",
    "non_functional_requirements": "non_functional_requirements",
    "nonfunctionalrequirements": "non_functional_requirements",
    "user_stories": "user_stories",
    "userstories": "user_stories",
    "acceptance_criteria": "acceptance_criteria",
    "acceptancecriteria": "acceptance_criteria",
    "dependencies_and_constraints": "dependencies_and_constraints",
    "dependenciesandconstraints": "dependencies_and_constraints",
    "dependencies": "dependencies_and_constraints",
    "technical_requirements": "dependencies_and_constraints",
    "technicalrequirements": "dependencies_and_constraints",
    "risks_and_mitigations": "risks_and_mitigations",
    "risksandmitigations": "risks_and_mitigations",
    "risk_analysis": "risks_and_mitigations",
    "riskanalysis": "risks_and_mitigations",
    "release_plan": "release_plan",
    "releaseplan": "release_plan",
    "roadmap_recommendations": "release_plan",
    "roadmaprecommendations": "release_plan",
}


class ProductPlanningService:
    """
    Coordinates Product Planning Agent executions with MongoDB repositories,
    workspace authorization, human review controls, and backward-compatible PRD storage.
    """

    def __init__(
        self,
        agent: Optional[ProductPlanningAgent] = None,
        prd_repo: Optional[PRDRepository] = None,
        feature_group_repo: Optional[FeatureGroupRepository] = None,
        prioritization_repo: Optional[PrioritizationScenarioRepository] = None,
        feedback_repo: Optional[FeedbackRepository] = None,
        workspace_repo: Optional[WorkspaceRepository] = None,
        membership_repo: Optional[WorkspaceMembershipRepository] = None,
    ):
        self.agent = agent or ProductPlanningAgent()
        self.prd_repo = prd_repo
        self.feature_group_repo = feature_group_repo
        self.prioritization_repo = prioritization_repo
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
        if workspace.owner_id == user.id:
            return

        # Active membership check
        membership = await self.membership_repo.find_by_workspace_and_user(
            workspace_id=ws_oid,
            user_id=user.id,
        )
        if not membership or membership.status != MembershipStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: user is not an active member of this workspace",
            )

    async def generate_plan(
        self,
        request: GenerateProductPlanRequest,
        user: User,
    ) -> ProductPlanResponse:
        """
        Generates a complete product plan: PRD, user stories, acceptance criteria,
        technical recommendations, success metrics, risk analysis, and roadmap.
        Persists to MongoDB 'prds' collection with 'draft' or 'pending_review' status.
        """
        await self.verify_workspace_access(user, request.workspace_id)

        ws_oid = ObjectId(request.workspace_id)
        if not ObjectId.is_valid(request.feature_group_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid feature_group_id format: '{request.feature_group_id}'",
            )
        fg_oid = ObjectId(request.feature_group_id)

        # 1. Retrieve FeatureGroup
        if not self.feature_group_repo:
            raise HTTPException(status_code=500, detail="Feature group repository uninitialized")

        feature_group = await self.feature_group_repo.find_by_id(fg_oid, workspace_id=ws_oid)
        if not feature_group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"FeatureGroup '{request.feature_group_id}' not found in workspace",
            )

        # 2. Retrieve Prioritization Scenario (if available)
        prioritization_data: Optional[Dict[str, Any]] = None
        p_scenario = None
        if self.prioritization_repo:
            if request.prioritization_result_id and ObjectId.is_valid(request.prioritization_result_id):
                p_scenario = await self.prioritization_repo.find_by_id(
                    ObjectId(request.prioritization_result_id),
                    workspace_id=ws_oid,
                )
            if not p_scenario:
                # Look up latest prioritization for this feature group
                p_scenario = await self.prioritization_repo.find_by_workspace_and_feature_group(
                    workspace_id=ws_oid,
                    feature_group_id=fg_oid,
                )
            if p_scenario:
                prioritization_data = {
                    "final_score": p_scenario.final_score,
                    "priority_level": p_scenario.priority_level,
                    "factor_scores": p_scenario.factor_scores,
                    "factor_weights": p_scenario.factor_weights,
                    "explanation": p_scenario.explanation,
                    "implementation_benefits": p_scenario.implementation_benefits,
                    "delay_risks": p_scenario.delay_risks,
                    "missing_data": p_scenario.missing_data,
                    "recommendation": p_scenario.recommendation,
                }

        # 3. Check for existing PRD and Approved Protection
        existing_prd: Optional[PRD] = None
        if self.prd_repo:
            existing_prd = await self.prd_repo.find_by_feature_group(ws_oid, fg_oid)
            if existing_prd and existing_prd.status == PRDStatus.APPROVED:
                if not request.force_approved_overwrite:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Cannot overwrite an already approved PRD without explicit authorization (force_approved_overwrite=True).",
                    )

        # 4. Execute Planning Agent
        urgency_dict = (
            dict(feature_group.urgency_distribution)
            if hasattr(feature_group, "urgency_distribution") and feature_group.urgency_distribution
            else {}
        )
        sentiment_dict = {}
        if hasattr(feature_group, "sentiment_distribution") and feature_group.sentiment_distribution:
            s_dist = feature_group.sentiment_distribution
            if hasattr(s_dist, "model_dump"):
                sentiment_dict = s_dist.model_dump()
            elif isinstance(s_dist, dict):
                sentiment_dict = s_dist

        exec_result = await self.agent.agenerate_plan(
            group_id=str(feature_group.id),
            title=feature_group.title,
            description=feature_group.description or getattr(feature_group, "feature_summary", "") or "",
            feedback_count=feature_group.feedback_count,
            unique_customer_count=getattr(feature_group, "unique_customer_count", 1),
            pain_points=feature_group.pain_points,
            evidence=getattr(feature_group, "evidence", []),
            themes=getattr(feature_group, "common_themes", []),
            urgency_dist=urgency_dict,
            sentiment_dist=sentiment_dict,
            prioritization_data=prioritization_data,
            strategic_context=request.strategic_context,
            max_retries=1,
        )

        plan_output: ProductPlanningAgentOutput = exec_result.data

        # Fallback enrichment to guarantee comprehensive grounding
        if not plan_output.prd.functional_requirements:
            first_pain = feature_group.pain_points[0] if feature_group.pain_points else "Customer feature request"
            quote_ref = getattr(feature_group, "evidence", [])[0] if getattr(feature_group, "evidence", []) else None
            plan_output.prd.functional_requirements = [
                ProductRequirement(
                    requirement_id="REQ-001",
                    title=f"Core {feature_group.title} Functionality",
                    description=f"Provide end-to-end user capability for {feature_group.title.lower()} directly resolving customer pain: {first_pain}.",
                    origin=RequirementOrigin.SOURCE_SUPPORTED,
                    is_confirmed=True,
                    requires_confirmation=False,
                    source_reference=quote_ref or first_pain,
                ),
                ProductRequirement(
                    requirement_id="REQ-002",
                    title="Workspace Security & Role Permissions",
                    description="Enforce workspace boundary validation and role-based permissions on all related actions.",
                    origin=RequirementOrigin.USER_PROVIDED if (request.strategic_context and request.strategic_context.additional_planning_instructions) else RequirementOrigin.AI_RECOMMENDATION,
                    is_confirmed=bool(request.strategic_context and request.strategic_context.additional_planning_instructions),
                    requires_confirmation=not bool(request.strategic_context and request.strategic_context.additional_planning_instructions),
                    source_reference=request.strategic_context.additional_planning_instructions if (request.strategic_context and request.strategic_context.additional_planning_instructions) else None,
                ),
            ]

        if not plan_output.prd.non_functional_requirements:
            plan_output.prd.non_functional_requirements = [
                ProductRequirement(
                    requirement_id="NFR-001",
                    title="Response Latency & Execution Speed",
                    description="Execution latency target for operations to be benchmarked and finalized by engineering review.",
                    origin=RequirementOrigin.AI_RECOMMENDATION,
                    is_confirmed=False,
                    requires_confirmation=True,
                    numerical_threshold=None,  # Zero-fabrication: ungrounded thresholds MUST be None!
                    source_reference=None,
                ),
                ProductRequirement(
                    requirement_id="NFR-002",
                    title="Service Availability & Uptime Target",
                    description="Service availability SLA to be defined according to corporate infrastructure tiers.",
                    origin=RequirementOrigin.AI_RECOMMENDATION,
                    is_confirmed=False,
                    requires_confirmation=True,
                    numerical_threshold=None,  # Zero-fabrication: ungrounded SLA MUST be None!
                    source_reference=None,
                ),
            ]

        if not plan_output.user_stories:
            first_pain = feature_group.pain_points[0] if feature_group.pain_points else "address customer requests"
            quote_ref = getattr(feature_group, "evidence", [])[0] if getattr(feature_group, "evidence", []) else None
            req_ids = [r.requirement_id if hasattr(r, "requirement_id") else str(r) for r in plan_output.prd.functional_requirements[:2]]
            plan_output.user_stories = [
                UserStory(
                    story_id="US-001",
                    title=f"Core Workflow for {feature_group.title}",
                    description=f"As a platform user, I want {feature_group.title.lower()}, so that I can {first_pain.lower()}.",
                    persona="Platform User",
                    business_value=f"Directly resolves key customer pain point: {first_pain}",
                    priority="High",
                    origin=RequirementOrigin.SOURCE_SUPPORTED,
                    is_confirmed=True,
                    requires_confirmation=False,
                    source_reference=quote_ref or first_pain,
                    related_requirements=req_ids,
                    acceptance_criteria=[
                        AcceptanceCriterion(
                            criterion_id="AC-001",
                            description=f"Given authenticated user on {feature_group.title} view, When action is triggered, Then operation completes successfully",
                            scenario_type="positive",
                            testable=True,
                            origin=RequirementOrigin.SOURCE_SUPPORTED,
                            is_confirmed=True,
                            requires_confirmation=False,
                            related_story_id="US-001",
                        ),
                        AcceptanceCriterion(
                            criterion_id="AC-002",
                            description=f"Given invalid request inputs, When submitted, Then system displays clear error validation message",
                            scenario_type="negative",
                            testable=True,
                            origin=RequirementOrigin.AI_RECOMMENDATION,
                            is_confirmed=False,
                            requires_confirmation=True,
                            related_story_id="US-001",
                        ),
                    ],
                    supporting_feedback_ids=[str(fid) for fid in getattr(feature_group, "related_feedback_ids", [])[:3]],
                ),
                UserStory(
                    story_id="US-002",
                    title=f"Configuration & Permissions for {feature_group.title}",
                    description=f"As a team administrator, I want to manage access settings for {feature_group.title.lower()}, so that data access conforms to company policy.",
                    persona="Workspace Administrator",
                    business_value="Ensures governance, compliance, and enterprise access control",
                    priority="Medium",
                    origin=RequirementOrigin.USER_PROVIDED if (request.strategic_context and request.strategic_context.additional_planning_instructions) else RequirementOrigin.AI_RECOMMENDATION,
                    is_confirmed=bool(request.strategic_context and request.strategic_context.additional_planning_instructions),
                    requires_confirmation=not bool(request.strategic_context and request.strategic_context.additional_planning_instructions),
                    source_reference=request.strategic_context.additional_planning_instructions if (request.strategic_context and request.strategic_context.additional_planning_instructions) else None,
                    acceptance_criteria=[
                        AcceptanceCriterion(
                            criterion_id="AC-003",
                            description="Given admin user, When permissions are updated, Then changes take effect immediately across workspace members",
                            scenario_type="positive",
                            testable=True,
                            origin=RequirementOrigin.AI_RECOMMENDATION,
                            is_confirmed=False,
                            requires_confirmation=True,
                            related_story_id="US-002",
                        )
                    ],
                ),
            ]

        if not plan_output.technical_requirements:
            tech_items = []
            if request.strategic_context and request.strategic_context.technical_constraints:
                for idx, c in enumerate(request.strategic_context.technical_constraints, 1):
                    tech_items.append(
                        TechnicalRequirement(
                            title=f"User Constraint: {c}",
                            description=f"System implementation must adhere to user-specified constraint: {c}.",
                            category="architecture",
                            rationale="Mandated by organizational strategic context.",
                            confidence=1.0,
                            requires_engineering_review=False,
                            origin=RequirementOrigin.USER_PROVIDED,
                            is_confirmed=True,
                            source_reference=f"User technical constraint: {c}",
                        )
                    )
            tech_items.extend([
                TechnicalRequirement(
                    title=f"API Service Integration for {feature_group.title}",
                    description=f"Develop secure REST endpoints supporting pagination, rate limiting, and serialization for {feature_group.title}.",
                    category="api",
                    rationale="Enables frontend and integration consumers with resilient access.",
                    confidence=0.9,
                    requires_engineering_review=True,
                    origin=RequirementOrigin.AI_RECOMMENDATION,
                    is_confirmed=False,
                ),
                TechnicalRequirement(
                    title="Data Validation and RBAC Enforcement",
                    description="Implement server-side validation and ensure workspace tenant isolation on all operations.",
                    category="security",
                    rationale="Protects workspace boundary and prevents unauthorized access.",
                    confidence=0.95,
                    requires_engineering_review=True,
                    origin=RequirementOrigin.AI_RECOMMENDATION,
                    is_confirmed=False,
                ),
            ])
            plan_output.technical_requirements = tech_items

        if not plan_output.supporting_evidence:
            plan_output.supporting_evidence = getattr(feature_group, "evidence", [])[:5] or ["Direct customer feedback recorded in feature group."]

        if not plan_output.success_metrics:
            metrics = []
            # Check if user provided explicit business goals with measurable targets in strategic_context
            if request.strategic_context and request.strategic_context.business_goals:
                for bg in request.strategic_context.business_goals:
                    if any(term in bg.lower() for term in ["target", "%", "increase", "reduce", "metric", "adoption", "kpi"]):
                        metrics.append(
                            SuccessMetric(
                                metric_name=f"Strategic Objective: {bg[:40]}",
                                description=f"Organizational business goal: {bg}",
                                measurement_method="Business analytics tracking",
                                expected_direction=infer_expected_direction(metric_name=bg, description=bg),
                                baseline=None,
                                suggested_target=bg,
                                target_origin=RequirementOrigin.USER_PROVIDED,
                                is_target_confirmed=True,
                                requires_target_confirmation=False,
                                is_period_confirmed=False,
                                period_requires_confirmation=False,
                                origin=RequirementOrigin.USER_PROVIDED,
                                is_confirmed=True,
                                requires_confirmation=False,
                                source_reference=f"User business goal: {bg}",
                            )
                        )
                        break

            # AI Recommendations (clearly categorized as unconfirmed proposals)
            metrics.extend([
                SuccessMetric(
                    metric_name=f"{feature_group.title} Feature Adoption Rate",
                    description=f"Percentage of active workspace accounts utilizing {feature_group.title} monthly",
                    measurement_method="Analytics event tracking rollup",
                    expected_direction="increase",
                    baseline=None,
                    suggested_target="30% of active accounts (Proposed target awaiting product & business confirmation)",
                    measurement_period="60 days post-launch (Proposed timeframe awaiting PM confirmation)",
                    target_origin=RequirementOrigin.AI_RECOMMENDATION,
                    is_target_confirmed=False,
                    requires_target_confirmation=True,
                    is_period_confirmed=False,
                    period_requires_confirmation=True,
                    origin=RequirementOrigin.AI_RECOMMENDATION,
                    is_confirmed=False,
                    requires_confirmation=True,
                ),
                SuccessMetric(
                    metric_name="Customer Satisfaction / NPS Impact",
                    description="CSAT score for workflows involving this capability",
                    measurement_method="In-app micro-survey post-interaction",
                    expected_direction="increase",
                    baseline=None,
                    suggested_target=None,  # Null when no target is recommended or established
                    measurement_period=None,
                    target_origin=None,
                    is_target_confirmed=False,
                    requires_target_confirmation=False,
                    origin=RequirementOrigin.AI_RECOMMENDATION,
                    is_confirmed=False,
                    requires_confirmation=True,
                ),
            ])
            plan_output.success_metrics = metrics

        if not plan_output.risk_analysis:
            plan_output.risk_analysis = [
                RiskItem(
                    description=f"User onboarding friction or discovery challenges for {feature_group.title}",
                    category="adoption",
                    impact="Medium",
                    likelihood="Medium",
                    mitigation="Provide contextual product walkthrough and clear documentation.",
                    requires_human_review=True,
                ),
                RiskItem(
                    description="Performance degradation during peak concurrent usage",
                    category="technical",
                    impact="Medium",
                    likelihood="Low",
                    mitigation="Enforce database indexing, caching, and async job queues.",
                    requires_human_review=True,
                ),
            ]

        if not plan_output.roadmap_recommendations:
            plan_output.roadmap_recommendations = [
                RoadmapPhase(
                    phase_name="Phase 1 – Foundation & Core API",
                    objective=f"Deliver backend service, database models, and security checks for {feature_group.title}",
                    tasks=["Implement data repository", "Build API routes", "Unit test coverage"],
                    deliverables=["Core API endpoints", "RBAC security verification"],
                    suggested_sequencing=1,
                ),
                RoadmapPhase(
                    phase_name="Phase 2 – UI Integration & Beta Release",
                    objective="Deliver user-facing workflows and gather customer feedback",
                    tasks=["Frontend UI components", "Telemetry instrumentation", "Pilot beta testing"],
                    deliverables=["Interactive UI", "Beta customer release"],
                    suggested_sequencing=2,
                ),
            ]

        # Enrich PRD with cross-section outputs if empty
        if not plan_output.prd.success_metrics and plan_output.success_metrics:
            plan_output.prd.success_metrics = [f"{m.metric_name}: {m.description}" for m in plan_output.success_metrics]
        if not plan_output.prd.supporting_evidence and plan_output.supporting_evidence:
            plan_output.prd.supporting_evidence = plan_output.supporting_evidence
        if not plan_output.prd.risks_and_assumptions and plan_output.risk_analysis:
            plan_output.prd.risks_and_assumptions = [f"[{r.category}] {r.description} (Mitigation: {r.mitigation})" for r in plan_output.risk_analysis]

        # 5. Service-side validation: verify all claimed origins against actual sources & enforce direction
        self.validate_and_sanitize_requirement_origins(
            plan_output=plan_output,
            feature_group=feature_group,
            strategic_context=request.strategic_context,
            prioritization_data=prioritization_data,
        )

        # 6. Persist to MongoDB PRD collection
        sections_obj = build_prd_sections(
            prd=plan_output.prd,
            user_stories=plan_output.user_stories,
            technical_requirements=plan_output.technical_requirements,
            roadmap_phases=plan_output.roadmap_recommendations,
        )

        prd_update_dict = {
            "title": plan_output.prd.title or feature_group.title,
            "version": "1.0.0",
            "status": PRDStatus.PENDING_REVIEW.value,
            "author": user.name,
            "authorId": user.id,
            "sections": sections_obj.model_dump(by_alias=True),
            "aiGenerated": True,
            "featureGroupId": fg_oid,
            "prioritizationScenarioId": p_scenario.id if p_scenario else None,
            "structuredPrd": plan_output.prd.model_dump(),
            "userStories": [s.model_dump() for s in plan_output.user_stories],
            "technicalRequirements": [t.model_dump() for t in plan_output.technical_requirements],
            "successMetrics": [m.model_dump() for m in plan_output.success_metrics],
            "riskAnalysis": [r.model_dump() for r in plan_output.risk_analysis],
            "roadmapRecommendations": [rp.model_dump() for rp in plan_output.roadmap_recommendations],
            "supportingEvidence": plan_output.supporting_evidence,
            "aiMetadata": exec_result.metadata.model_dump(),
        }

        saved_prd: Optional[PRD] = None
        if self.prd_repo:
            if existing_prd and existing_prd.id:
                saved_prd = await self.prd_repo.update(
                    entity_id=existing_prd.id,
                    update_data=prd_update_dict,
                    workspace_id=ws_oid,
                )
            else:
                new_prd = PRD(
                    workspace_id=ws_oid,
                    title=plan_output.prd.title or feature_group.title,
                    version="1.0.0",
                    status=PRDStatus.PENDING_REVIEW,
                    author=user.name,
                    author_id=user.id,
                    sections=sections_obj,
                    ai_generated=True,
                    feature_group_id=fg_oid,
                    prioritization_scenario_id=p_scenario.id if p_scenario else None,
                    structured_prd=plan_output.prd.model_dump(),
                    user_stories=[s.model_dump() for s in plan_output.user_stories],
                    technical_requirements=[t.model_dump() for t in plan_output.technical_requirements],
                    success_metrics=[m.model_dump() for m in plan_output.success_metrics],
                    risk_analysis=[r.model_dump() for r in plan_output.risk_analysis],
                    roadmap_recommendations=[rp.model_dump() for rp in plan_output.roadmap_recommendations],
                    supporting_evidence=plan_output.supporting_evidence,
                    ai_metadata=exec_result.metadata.model_dump(),
                )
                saved_prd = await self.prd_repo.create(new_prd)

        if not saved_prd:
            raise HTTPException(status_code=500, detail="Failed to persist generated product plan")

        return self._prd_to_response(saved_prd)

    async def generate_prd_only(
        self,
        request: GeneratePRDRequest,
        user: User,
    ) -> ProductPlanResponse:
        """Generates or regenerates specifically the PRD portion."""
        await self.verify_workspace_access(user, request.workspace_id)
        ws_oid = ObjectId(request.workspace_id)
        fg_oid = ObjectId(request.feature_group_id)

        if not self.feature_group_repo or not self.prd_repo:
            raise HTTPException(status_code=500, detail="Repositories uninitialized")

        feature_group = await self.feature_group_repo.find_by_id(fg_oid, workspace_id=ws_oid)
        if not feature_group:
            raise HTTPException(status_code=404, detail="FeatureGroup not found")

        # Check existing PRD
        existing_prd = None
        if request.planning_id and ObjectId.is_valid(request.planning_id):
            existing_prd = await self.prd_repo.find_by_id(ObjectId(request.planning_id), workspace_id=ws_oid)
        if not existing_prd:
            existing_prd = await self.prd_repo.find_by_feature_group(ws_oid, fg_oid)

        if existing_prd and existing_prd.status == PRDStatus.APPROVED and not request.force_approved_overwrite:
            raise HTTPException(
                status_code=400,
                detail="Cannot overwrite an already approved PRD without explicit authorization.",
            )

        # Retrieve prioritization if available
        prioritization_data = None
        p_scenario = None
        if self.prioritization_repo:
            p_scenario = await self.prioritization_repo.find_by_workspace_and_feature_group(ws_oid, fg_oid)
            if p_scenario:
                prioritization_data = {
                    "final_score": p_scenario.final_score,
                    "priority_level": p_scenario.priority_level,
                    "factor_scores": p_scenario.factor_scores,
                    "explanation": p_scenario.explanation,
                }

        urgency_dict = getattr(feature_group, "urgency_distribution", {}) or {}
        sentiment_dict = {}
        s_dist = getattr(feature_group, "sentiment_distribution", None)
        if s_dist:
            sentiment_dict = s_dist.model_dump() if hasattr(s_dist, "model_dump") else s_dist

        prd_obj = await self.agent.agenerate_prd(
            group_id=str(feature_group.id),
            title=feature_group.title,
            description=feature_group.description or getattr(feature_group, "feature_summary", "") or "",
            feedback_count=feature_group.feedback_count,
            unique_customer_count=getattr(feature_group, "unique_customer_count", 1),
            pain_points=feature_group.pain_points,
            evidence=getattr(feature_group, "evidence", []),
            themes=getattr(feature_group, "common_themes", []),
            urgency_dist=urgency_dict,
            sentiment_dist=sentiment_dict,
            prioritization_data=prioritization_data,
            strategic_context=request.strategic_context,
            max_retries=1,
        )

        user_stories = [UserStory(**s) for s in existing_prd.user_stories] if existing_prd and existing_prd.user_stories else []
        tech_reqs = [TechnicalRequirement(**t) for t in existing_prd.technical_requirements] if existing_prd and existing_prd.technical_requirements else []
        phases = [RoadmapPhase(**p) for p in existing_prd.roadmap_recommendations] if existing_prd and existing_prd.roadmap_recommendations else []

        sections_obj = build_prd_sections(prd_obj, user_stories, tech_reqs, phases)

        update_dict = {
            "title": prd_obj.title or feature_group.title,
            "sections": sections_obj.model_dump(by_alias=True),
            "structuredPrd": prd_obj.model_dump(),
            "status": PRDStatus.PENDING_REVIEW.value,
        }

        if existing_prd and existing_prd.id:
            saved = await self.prd_repo.update(existing_prd.id, update_dict, workspace_id=ws_oid)
        else:
            new_prd = PRD(
                workspace_id=ws_oid,
                title=prd_obj.title or feature_group.title,
                feature_group_id=fg_oid,
                status=PRDStatus.PENDING_REVIEW,
                author=user.name,
                author_id=user.id,
                sections=sections_obj,
                ai_generated=True,
                structured_prd=prd_obj.model_dump(),
            )
            saved = await self.prd_repo.create(new_prd)

        return self._prd_to_response(saved)

    async def generate_user_stories_only(
        self,
        request: GenerateUserStoriesRequest,
        user: User,
    ) -> ProductPlanResponse:
        """Generates or regenerates specifically user stories and acceptance criteria."""
        await self.verify_workspace_access(user, request.workspace_id)
        ws_oid = ObjectId(request.workspace_id)
        fg_oid = ObjectId(request.feature_group_id)

        if not self.feature_group_repo or not self.prd_repo:
            raise HTTPException(status_code=500, detail="Repositories uninitialized")

        feature_group = await self.feature_group_repo.find_by_id(fg_oid, workspace_id=ws_oid)
        if not feature_group:
            raise HTTPException(status_code=404, detail="FeatureGroup not found")

        # Check existing PRD
        existing_prd = None
        if request.planning_id and ObjectId.is_valid(request.planning_id):
            existing_prd = await self.prd_repo.find_by_id(ObjectId(request.planning_id), workspace_id=ws_oid)
        if not existing_prd:
            existing_prd = await self.prd_repo.find_by_feature_group(ws_oid, fg_oid)

        if existing_prd and existing_prd.status == PRDStatus.APPROVED and not request.force_approved_overwrite:
            raise HTTPException(
                status_code=400,
                detail="Cannot overwrite an already approved PRD without explicit authorization.",
            )

        stories = await self.agent.agenerate_user_stories(
            group_id=str(feature_group.id),
            title=feature_group.title,
            description=feature_group.description or getattr(feature_group, "feature_summary", "") or "",
            feedback_count=feature_group.feedback_count,
            unique_customer_count=getattr(feature_group, "unique_customer_count", 1),
            pain_points=feature_group.pain_points,
            evidence=getattr(feature_group, "evidence", []),
            themes=getattr(feature_group, "common_themes", []),
            strategic_context=request.strategic_context,
            max_retries=1,
        )

        stories_dict = [s.model_dump() for s in stories]

        if existing_prd and existing_prd.id:
            # Rebuild sections with new user stories
            prd_obj = ProductRequirementsDocument(**existing_prd.structured_prd) if existing_prd.structured_prd else None
            if prd_obj:
                tech_reqs = [TechnicalRequirement(**t) for t in existing_prd.technical_requirements]
                phases = [RoadmapPhase(**p) for p in existing_prd.roadmap_recommendations]
                sections_obj = build_prd_sections(prd_obj, stories, tech_reqs, phases)
                update_dict = {
                    "userStories": stories_dict,
                    "sections": sections_obj.model_dump(by_alias=True),
                }
            else:
                update_dict = {"userStories": stories_dict}

            saved = await self.prd_repo.update(existing_prd.id, update_dict, workspace_id=ws_oid)
        else:
            new_prd = PRD(
                workspace_id=ws_oid,
                title=f"{feature_group.title} — Stories",
                feature_group_id=fg_oid,
                status=PRDStatus.PENDING_REVIEW,
                author=user.name,
                author_id=user.id,
                ai_generated=True,
                user_stories=stories_dict,
            )
            saved = await self.prd_repo.create(new_prd)

        return self._prd_to_response(saved)

    async def get_plan_by_id(
        self,
        planning_id: str,
        user: User,
        workspace_id: Optional[str] = None,
    ) -> ProductPlanResponse:
        """Retrieves a single product plan by its ID."""
        if not ObjectId.is_valid(planning_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid planning_id format: '{planning_id}'",
            )
        if not self.prd_repo:
            raise HTTPException(status_code=500, detail="PRD repository uninitialized")

        plan = await self.prd_repo.find_by_id(ObjectId(planning_id))
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product plan '{planning_id}' not found",
            )

        await self.verify_workspace_access(user, plan.workspace_id)
        if workspace_id and str(plan.workspace_id) != str(workspace_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product plan not found in specified workspace",
            )

        return self._prd_to_response(plan)

    async def list_plans(
        self,
        workspace_id: str,
        user: User,
        status_filter: Optional[str] = None,
        limit: int = 100,
        skip: int = 0,
    ) -> List[ProductPlanResponse]:
        """Lists paginated product plans for a workspace."""
        await self.verify_workspace_access(user, workspace_id)
        ws_oid = ObjectId(workspace_id)

        if not self.prd_repo:
            raise HTTPException(status_code=500, detail="PRD repository uninitialized")

        # Map status string if provided
        mapped_status = None
        if status_filter:
            norm = status_filter.strip().lower()
            if norm in ("draft",):
                mapped_status = PRDStatus.DRAFT.value
            elif norm in ("pending_review", "in_review", "pending review", "in review"):
                mapped_status = PRDStatus.PENDING_REVIEW.value
            elif norm in ("approved",):
                mapped_status = PRDStatus.APPROVED.value
            elif norm in ("rejected",):
                mapped_status = PRDStatus.REJECTED.value
            else:
                mapped_status = status_filter

        prds = await self.prd_repo.find_by_workspace_and_filters(
            workspace_id=ws_oid,
            status=mapped_status,
            limit=limit,
            skip=skip,
        )

        return [self._prd_to_response(p) for p in prds]

    async def update_review_status(
        self,
        planning_id: str,
        request: ReviewPlanRequest,
        user: User,
    ) -> ProductPlanResponse:
        """
        Updates the human review status of a PRD/Planning document.
        Supported statuses: 'pending_review', 'approved', 'rejected', 'draft'.
        """
        if not ObjectId.is_valid(planning_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid planning_id format: '{planning_id}'",
            )
        if not self.prd_repo:
            raise HTTPException(status_code=500, detail="PRD repository uninitialized")

        plan = await self.prd_repo.find_by_id(ObjectId(planning_id))
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product plan '{planning_id}' not found",
            )

        await self.verify_workspace_access(user, plan.workspace_id)

        # Normalize status string
        norm_status = request.review_status.strip().lower()
        if norm_status in ("pending_review", "pending review", "in_review", "in review"):
            new_status = PRDStatus.PENDING_REVIEW
        elif norm_status == "approved":
            new_status = PRDStatus.APPROVED
        elif norm_status == "rejected":
            new_status = PRDStatus.REJECTED
        elif norm_status == "draft":
            new_status = PRDStatus.DRAFT
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid review status: '{request.review_status}'. Allowed: 'pending_review', 'approved', 'rejected', 'draft'.",
            )

        now = datetime.now(timezone.utc)
        update_data: Dict[str, Any] = {
            "status": new_status.value,
            "reviewedBy": user.id,
            "reviewedAt": now,
        }
        if request.review_notes is not None:
            update_data["reviewNotes"] = request.review_notes

        updated = await self.prd_repo.update(
            entity_id=plan.id,
            update_data=update_data,
            workspace_id=plan.workspace_id,
        )
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update PRD review status")

        return self._prd_to_response(updated)

    async def update_sections(
        self,
        planning_id: str,
        request: UpdatePRDSectionsRequest,
        user: User,
        workspace_id: Optional[str] = None,
    ) -> ProductPlanResponse:
        """
        Updates individual or multiple PRD sections directly in MongoDB Atlas.
        - Enforces workspace isolation and role checks.
        - Validates section keys and rejects unrecognized names.
        - Maintains consistency between the legacy 13 sections and structured_prd.
        - Preserves user stories, acceptance criteria, technical specs, and evidence references.
        - Enforces approved-document overwrite protection.
        - Supports optimistic concurrency control via expected_version.
        - Bumps version (patch/minor/major/none) and updates updatedAt.
        """
        if not ObjectId.is_valid(planning_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid planning_id format: '{planning_id}'",
            )
        if not self.prd_repo:
            raise HTTPException(status_code=500, detail="PRD repository uninitialized")

        plan = await self.prd_repo.find_by_id(ObjectId(planning_id))
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product plan '{planning_id}' not found",
            )

        await self.verify_workspace_access(user, plan.workspace_id)
        if workspace_id and str(plan.workspace_id) != str(workspace_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product plan not found in specified workspace",
            )

        # 1. Enforce Approved Document Protection
        if plan.status == PRDStatus.APPROVED and not request.force_approved_overwrite:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot modify an already approved PRD without explicit authorization (force_approved_overwrite=True).",
            )

        # 2. Enforce Optimistic Concurrency Control
        if request.expected_version and plan.version != request.expected_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Concurrent update conflict: PRD version is '{plan.version}', expected '{request.expected_version}'.",
            )

        # 3. Validate Section Keys
        has_updates = (
            bool(request.sections)
            or bool(request.structured_prd)
            or request.user_stories is not None
            or request.technical_requirements is not None
            or request.success_metrics is not None
            or request.risk_analysis is not None
            or request.roadmap_recommendations is not None
            or bool(request.title)
        )
        if not has_updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No section updates provided.",
            )

        invalid_keys = []
        for raw_k in request.sections.keys():
            norm_k = raw_k.lower().replace("-", "_")
            if norm_k not in SECTION_KEY_MAP and raw_k not in CANONICAL_SECTION_KEYS:
                invalid_keys.append(raw_k)

        if invalid_keys:
            allowed_list = sorted(list(CANONICAL_SECTION_KEYS))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid section key(s): {invalid_keys}. Allowed section keys: {allowed_list}",
            )

        # 4. Prepare Section Update Dict
        current_sections_dict = plan.sections.model_dump(by_alias=False)
        current_structured = dict(plan.structured_prd) if plan.structured_prd else {}

        for raw_k, val in request.sections.items():
            norm_k = raw_k.lower().replace("-", "_")
            canon_k = SECTION_KEY_MAP.get(norm_k, norm_k)
            val_str = str(val) if val is not None else ""
            current_sections_dict[canon_k] = val_str

            # Maintain consistency with structured_prd
            if current_structured:
                if canon_k == "overview":
                    current_structured["executive_summary"] = val_str
                elif canon_k == "problem_statement":
                    current_structured["problem_statement"] = val_str
                elif canon_k == "proposed_solution":
                    current_structured["proposed_solution"] = val_str
                elif canon_k == "target_users":
                    lines = [line.strip().lstrip("-•* ") for line in val_str.split("\n") if line.strip().lstrip("-•* ")]
                    current_structured["target_users"] = lines if lines else ([val_str] if val_str else [])
                elif canon_k == "customer_pain_points":
                    lines = [line.strip().lstrip("-•* ") for line in val_str.split("\n") if line.strip().lstrip("-•* ")]
                    current_structured["customer_pain_points"] = lines if lines else ([val_str] if val_str else [])
                elif canon_k == "goals_and_success_metrics":
                    lines = [line.strip().lstrip("-•* ") for line in val_str.split("\n") if line.strip().lstrip("-•* ")]
                    current_structured["success_metrics"] = lines if lines else ([val_str] if val_str else [])

        # Merge explicit structured_prd updates if provided
        if request.structured_prd:
            current_structured.update(request.structured_prd)

        # Merge structured child arrays if provided (with validation)
        updated_stories = list(plan.user_stories) if plan.user_stories else []
        if request.user_stories is not None:
            updated_stories = []
            for idx, s in enumerate(request.user_stories):
                try:
                    story_obj = UserStory(**s)
                    updated_stories.append(story_obj.model_dump())
                except Exception as exc:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Invalid UserStory schema at index {idx}: {exc}",
                    )
            # Synchronize text user_stories section
            if updated_stories:
                current_sections_dict["user_stories"] = "\n\n".join(
                    f"[{s.get('story_id', 'US')}] {s.get('title', '')}\n{s.get('description', '')}"
                    for s in updated_stories
                )
                current_sections_dict["acceptance_criteria"] = "\n\n".join(
                    f"{s.get('story_id', 'US')} Acceptance Criteria:\n"
                    + "\n".join(f"  - [{ac.get('criterion_id', 'AC')}] ({ac.get('scenario_type', 'positive')}) {ac.get('description', '')}"
                               for ac in s.get("acceptance_criteria", []))
                    for s in updated_stories
                    if s.get("acceptance_criteria")
                )

        updated_tech = list(plan.technical_requirements) if plan.technical_requirements else []
        if request.technical_requirements is not None:
            updated_tech = []
            for idx, t in enumerate(request.technical_requirements):
                try:
                    tech_obj = TechnicalRequirement(**t)
                    updated_tech.append(tech_obj.model_dump())
                except Exception as exc:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Invalid TechnicalRequirement schema at index {idx}: {exc}",
                    )

        updated_metrics = list(plan.success_metrics) if plan.success_metrics else []
        if request.success_metrics is not None:
            updated_metrics = []
            for idx, m in enumerate(request.success_metrics):
                try:
                    metric_obj = SuccessMetric(**m)
                    updated_metrics.append(metric_obj.model_dump())
                except Exception as exc:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Invalid SuccessMetric schema at index {idx}: {exc}",
                    )

        updated_risks = list(plan.risk_analysis) if plan.risk_analysis else []
        if request.risk_analysis is not None:
            updated_risks = []
            for idx, r in enumerate(request.risk_analysis):
                try:
                    risk_obj = RiskItem(**r)
                    updated_risks.append(risk_obj.model_dump())
                except Exception as exc:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Invalid RiskItem schema at index {idx}: {exc}",
                    )

        updated_roadmap = list(plan.roadmap_recommendations) if plan.roadmap_recommendations else []
        if request.roadmap_recommendations is not None:
            updated_roadmap = []
            for idx, rp in enumerate(request.roadmap_recommendations):
                try:
                    rp_obj = RoadmapPhase(**rp)
                    updated_roadmap.append(rp_obj.model_dump())
                except Exception as exc:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Invalid RoadmapPhase schema at index {idx}: {exc}",
                    )

        # 5. Versioning
        new_version = bump_semver(plan.version, request.version_bump or "patch")

        # 6. Build Atlas update payload
        update_data: Dict[str, Any] = {
            "sections": PRDSections(**current_sections_dict).model_dump(by_alias=True),
            "version": new_version,
            "userStories": updated_stories,
            "technicalRequirements": updated_tech,
            "successMetrics": updated_metrics,
            "riskAnalysis": updated_risks,
            "roadmapRecommendations": updated_roadmap,
            "updatedAt": datetime.now(timezone.utc),
        }
        if request.title:
            update_data["title"] = request.title
        if current_structured:
            update_data["structuredPrd"] = current_structured

        # 7. Persist to Atlas
        updated_doc = await self.prd_repo.update(
            entity_id=plan.id,
            update_data=update_data,
            workspace_id=plan.workspace_id,
        )
        if not updated_doc:
            raise HTTPException(status_code=500, detail="Failed to persist PRD section updates to MongoDB Atlas")

        return self._prd_to_response(updated_doc)

    async def regenerate_section(
        self,
        planning_id: str,
        request: RegenerateSectionRequest,
        user: User,
        workspace_id: Optional[str] = None,
    ) -> ProductPlanResponse:
        """
        Regenerates a single specific PRD section using bounded Groq inference.
        - Preserves all other unrelated sections.
        - Strictly maintains zero-fabrication and origin-verification policies.
        - Persists regenerated section directly to MongoDB Atlas.
        - Respects approved PRD protection.
        """
        if not ObjectId.is_valid(planning_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid planning_id format: '{planning_id}'",
            )
        if not self.prd_repo:
            raise HTTPException(status_code=500, detail="PRD repository uninitialized")

        plan = await self.prd_repo.find_by_id(ObjectId(planning_id))
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product plan '{planning_id}' not found",
            )

        await self.verify_workspace_access(user, plan.workspace_id)
        if workspace_id and str(plan.workspace_id) != str(workspace_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product plan not found in specified workspace",
            )

        # 1. Enforce Approved Document Protection
        if plan.status == PRDStatus.APPROVED and not request.force_approved_overwrite:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot regenerate a section of an already approved PRD without explicit authorization (force_approved_overwrite=True).",
            )

        # 2. Validate section key
        norm_key = request.section_key.lower().replace("-", "_")
        if norm_key not in SECTION_KEY_MAP and request.section_key not in CANONICAL_SECTION_KEYS:
            allowed = sorted(list(CANONICAL_SECTION_KEYS))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid section key: '{request.section_key}'. Allowed section keys: {allowed}",
            )
        canon_key = SECTION_KEY_MAP.get(norm_key, norm_key)

        # 3. Retrieve grounding context (FeatureGroup, Prioritization)
        feature_group = None
        if self.feature_group_repo and plan.feature_group_id:
            feature_group = await self.feature_group_repo.find_by_id(
                plan.feature_group_id,
                workspace_id=plan.workspace_id,
            )

        prioritization_data = None
        if self.prioritization_repo and plan.feature_group_id:
            p_scenario = None
            if plan.prioritization_scenario_id:
                p_scenario = await self.prioritization_repo.find_by_id(
                    plan.prioritization_scenario_id,
                    workspace_id=plan.workspace_id,
                )
            if not p_scenario:
                p_scenario = await self.prioritization_repo.find_by_workspace_and_feature_group(
                    workspace_id=plan.workspace_id,
                    feature_group_id=plan.feature_group_id,
                )
            if p_scenario:
                prioritization_data = {
                    "final_score": p_scenario.final_score,
                    "priority_level": p_scenario.priority_level,
                    "factor_scores": p_scenario.factor_scores,
                    "explanation": p_scenario.explanation,
                }

        # Build prompt inputs
        fg_id_str = str(feature_group.id) if feature_group else str(plan.feature_group_id or plan.id)
        fg_title = feature_group.title if feature_group else plan.title
        fg_desc = (feature_group.description or getattr(feature_group, "feature_summary", "") or "") if feature_group else (plan.sections.overview or plan.title)
        fg_count = feature_group.feedback_count if feature_group else 10
        fg_cust_count = getattr(feature_group, "unique_customer_count", 5) if feature_group else 5
        fg_pains = feature_group.pain_points if feature_group else ([plan.sections.customer_pain_points] if plan.sections.customer_pain_points else ["Address user feedback"])
        fg_evidence = getattr(feature_group, "evidence", []) if feature_group else plan.supporting_evidence
        fg_themes = getattr(feature_group, "common_themes", []) if feature_group else ["Product Improvement"]
        fg_urgency = dict(feature_group.urgency_distribution) if feature_group and hasattr(feature_group, "urgency_distribution") and feature_group.urgency_distribution else {}
        fg_sentiment = {}
        if feature_group and hasattr(feature_group, "sentiment_distribution") and feature_group.sentiment_distribution:
            s_d = feature_group.sentiment_distribution
            fg_sentiment = s_d.model_dump() if hasattr(s_d, "model_dump") else s_d

        strategic_ctx = None
        if request.custom_instructions:
            strategic_ctx = ProductStrategicContext(additional_planning_instructions=request.custom_instructions)

        # 4. Execute targeted single-stage generation
        current_sections_dict = plan.sections.model_dump(by_alias=False)
        current_structured = dict(plan.structured_prd) if plan.structured_prd else {}
        updated_stories = list(plan.user_stories) if plan.user_stories else []
        updated_tech = list(plan.technical_requirements) if plan.technical_requirements else []
        updated_metrics = list(plan.success_metrics) if plan.success_metrics else []
        updated_risks = list(plan.risk_analysis) if plan.risk_analysis else []
        updated_roadmap = list(plan.roadmap_recommendations) if plan.roadmap_recommendations else []

        if canon_key in ("user_stories", "acceptance_criteria"):
            new_stories = await self.agent.agenerate_user_stories(
                group_id=fg_id_str,
                title=fg_title,
                description=fg_desc,
                feedback_count=fg_count,
                unique_customer_count=fg_cust_count,
                pain_points=fg_pains,
                evidence=fg_evidence,
                themes=fg_themes,
                urgency_dist=fg_urgency,
                sentiment_dist=fg_sentiment,
                prioritization_data=prioritization_data,
                strategic_context=strategic_ctx,
                max_retries=1,
            )
            updated_stories = [s.model_dump() for s in new_stories]
            current_sections_dict["user_stories"] = "\n\n".join(
                f"[{s.story_id}] {s.title}\n{s.description}" for s in new_stories
            )
            current_sections_dict["acceptance_criteria"] = "\n\n".join(
                f"{s.story_id} Acceptance Criteria:\n"
                + "\n".join(f"  - [{ac.criterion_id}] ({ac.scenario_type}) {ac.description}" for ac in s.acceptance_criteria)
                for s in new_stories
                if s.acceptance_criteria
            )

        elif canon_key in ("dependencies_and_constraints", "technical_requirements"):
            specs = await self.agent.agenerate_technical_specs(
                group_id=fg_id_str,
                title=fg_title,
                description=fg_desc,
                feedback_count=fg_count,
                unique_customer_count=fg_cust_count,
                pain_points=fg_pains,
                evidence=fg_evidence,
                themes=fg_themes,
                urgency_dist=fg_urgency,
                sentiment_dist=fg_sentiment,
                prioritization_data=prioritization_data,
                strategic_context=strategic_ctx,
                max_retries=1,
            )
            updated_tech = [t.model_dump() for t in specs.technical_requirements]
            dep_lines = [f"- [{t.category}] {t.title}: {t.description}" for t in specs.technical_requirements]
            current_sections_dict["dependencies_and_constraints"] = "Technical Requirements:\n" + "\n".join(dep_lines)

        elif canon_key in ("goals_and_success_metrics", "success_metrics"):
            specs = await self.agent.agenerate_technical_specs(
                group_id=fg_id_str,
                title=fg_title,
                description=fg_desc,
                feedback_count=fg_count,
                unique_customer_count=fg_cust_count,
                pain_points=fg_pains,
                evidence=fg_evidence,
                themes=fg_themes,
                urgency_dist=fg_urgency,
                sentiment_dist=fg_sentiment,
                prioritization_data=prioritization_data,
                strategic_context=strategic_ctx,
                max_retries=1,
            )
            updated_metrics = [m.model_dump() for m in specs.success_metrics]
            current_sections_dict["goals_and_success_metrics"] = "\n".join(
                f"• {m.metric_name}: {m.description} (Target: {m.suggested_target or 'Pending PM confirmation'}, Baseline: {m.baseline or 'unmeasured'})"
                for m in specs.success_metrics
            )
            if current_structured:
                current_structured["success_metrics"] = [f"{m.metric_name}: {m.description}" for m in specs.success_metrics]

        elif canon_key in ("risks_and_mitigations", "risk_analysis"):
            specs = await self.agent.agenerate_technical_specs(
                group_id=fg_id_str,
                title=fg_title,
                description=fg_desc,
                feedback_count=fg_count,
                unique_customer_count=fg_cust_count,
                pain_points=fg_pains,
                evidence=fg_evidence,
                themes=fg_themes,
                urgency_dist=fg_urgency,
                sentiment_dist=fg_sentiment,
                prioritization_data=prioritization_data,
                strategic_context=strategic_ctx,
                max_retries=1,
            )
            updated_risks = [r.model_dump() for r in specs.risk_analysis]
            current_sections_dict["risks_and_mitigations"] = "\n".join(
                f"• [{r.category}] {r.description} (Mitigation: {r.mitigation})"
                for r in specs.risk_analysis
            )

        elif canon_key in ("release_plan", "roadmap_recommendations"):
            specs = await self.agent.agenerate_technical_specs(
                group_id=fg_id_str,
                title=fg_title,
                description=fg_desc,
                feedback_count=fg_count,
                unique_customer_count=fg_cust_count,
                pain_points=fg_pains,
                evidence=fg_evidence,
                themes=fg_themes,
                urgency_dist=fg_urgency,
                sentiment_dist=fg_sentiment,
                prioritization_data=prioritization_data,
                strategic_context=strategic_ctx,
                max_retries=1,
            )
            updated_roadmap = [rp.model_dump() for rp in specs.roadmap_recommendations]
            current_sections_dict["release_plan"] = "\n\n".join(
                f"{p.phase_name}: {p.objective}\nTasks:\n"
                + "\n".join(f"  - {t}" for t in p.tasks)
                + "\nDeliverables:\n"
                + "\n".join(f"  - {d}" for d in p.deliverables)
                for p in specs.roadmap_recommendations
            )

        elif canon_key in ("functional_requirements", "non_functional_requirements"):
            reqs = await self.agent.agenerate_requirements(
                group_id=fg_id_str,
                title=fg_title,
                description=fg_desc,
                feedback_count=fg_count,
                unique_customer_count=fg_cust_count,
                pain_points=fg_pains,
                evidence=fg_evidence,
                themes=fg_themes,
                urgency_dist=fg_urgency,
                sentiment_dist=fg_sentiment,
                prioritization_data=prioritization_data,
                strategic_context=strategic_ctx,
                max_retries=1,
            )
            if canon_key == "functional_requirements":
                current_sections_dict["functional_requirements"] = "\n".join(
                    f"- [{r.requirement_id}] ({r.origin}) {r.title}: {r.description}" + (f' (Ref: "{r.source_reference}")' if r.source_reference else "")
                    for r in reqs.functional_requirements
                )
                if current_structured:
                    current_structured["functional_requirements"] = [r.model_dump() for r in reqs.functional_requirements]
            else:
                current_sections_dict["non_functional_requirements"] = "\n".join(
                    f"- [{r.requirement_id}] ({r.origin}) {r.title}: {r.description}" + (f' (Threshold: {r.numerical_threshold})' if r.numerical_threshold else " [Requires Confirmation]")
                    for r in reqs.non_functional_requirements
                )
                if current_structured:
                    current_structured["non_functional_requirements"] = [r.model_dump() for r in reqs.non_functional_requirements]

        else:
            # Narrative sections (overview, problem_statement, proposed_solution, customer_pain_points, target_users)
            narrative = await self.agent.agenerate_narrative(
                group_id=fg_id_str,
                title=fg_title,
                description=fg_desc,
                feedback_count=fg_count,
                unique_customer_count=fg_cust_count,
                pain_points=fg_pains,
                evidence=fg_evidence,
                themes=fg_themes,
                urgency_dist=fg_urgency,
                sentiment_dist=fg_sentiment,
                prioritization_data=prioritization_data,
                strategic_context=strategic_ctx,
                max_retries=1,
            )
            if canon_key == "overview":
                current_sections_dict["overview"] = narrative.executive_summary
                if current_structured:
                    current_structured["executive_summary"] = narrative.executive_summary
            elif canon_key == "problem_statement":
                current_sections_dict["problem_statement"] = narrative.problem_statement
                if current_structured:
                    current_structured["problem_statement"] = narrative.problem_statement
            elif canon_key == "proposed_solution":
                current_sections_dict["proposed_solution"] = narrative.proposed_solution
                if current_structured:
                    current_structured["proposed_solution"] = narrative.proposed_solution
            elif canon_key == "target_users":
                current_sections_dict["target_users"] = "\n".join(f"- {u}" for u in narrative.target_users)
                if current_structured:
                    current_structured["target_users"] = narrative.target_users
            elif canon_key == "customer_pain_points":
                current_sections_dict["customer_pain_points"] = "\n".join(f"- {p}" for p in narrative.customer_pain_points)
                if current_structured:
                    current_structured["customer_pain_points"] = narrative.customer_pain_points

        # 5. Versioning
        new_version = bump_semver(plan.version, "patch")

        # 6. Build Atlas update payload
        update_data: Dict[str, Any] = {
            "sections": PRDSections(**current_sections_dict).model_dump(by_alias=True),
            "version": new_version,
            "userStories": updated_stories,
            "technicalRequirements": updated_tech,
            "successMetrics": updated_metrics,
            "riskAnalysis": updated_risks,
            "roadmapRecommendations": updated_roadmap,
            "updatedAt": datetime.now(timezone.utc),
        }
        if current_structured:
            update_data["structuredPrd"] = current_structured

        # 7. Persist to Atlas
        updated_doc = await self.prd_repo.update(
            entity_id=plan.id,
            update_data=update_data,
            workspace_id=plan.workspace_id,
        )
        if not updated_doc:
            raise HTTPException(status_code=500, detail="Failed to persist regenerated section to MongoDB Atlas")

        return self._prd_to_response(updated_doc)

    def _prd_to_response(self, prd: PRD) -> ProductPlanResponse:
        """Converts internal PRD MongoDB document to external ProductPlanResponse."""
        prd_model: Optional[ProductRequirementsDocument] = None
        if prd.structured_prd:
            try:
                prd_model = ProductRequirementsDocument(**prd.structured_prd)
            except Exception as e:
                logger.warning("Failed to deserialize structured_prd for PRD '%s': %s", prd.id, e)

        user_stories = []
        if prd.user_stories:
            for s in prd.user_stories:
                try:
                    user_stories.append(UserStory(**s))
                except Exception as e:
                    logger.warning("Failed to parse user story in PRD '%s': %s", prd.id, e)

        tech_reqs = []
        if prd.technical_requirements:
            for t in prd.technical_requirements:
                try:
                    tech_reqs.append(TechnicalRequirement(**t))
                except Exception:
                    pass

        metrics = []
        if prd.success_metrics:
            for m in prd.success_metrics:
                try:
                    metrics.append(SuccessMetric(**m))
                except Exception:
                    pass

        risks = []
        if prd.risk_analysis:
            for r in prd.risk_analysis:
                try:
                    risks.append(RiskItem(**r))
                except Exception:
                    pass

        roadmap = []
        if prd.roadmap_recommendations:
            for rp in prd.roadmap_recommendations:
                try:
                    roadmap.append(RoadmapPhase(**rp))
                except Exception:
                    pass

        status_val = prd.status.value if hasattr(prd.status, "value") else str(prd.status)

        return ProductPlanResponse(
            planning_id=str(prd.id),
            workspace_id=str(prd.workspace_id),
            feature_group_id=str(prd.feature_group_id) if prd.feature_group_id else "",
            prioritization_result_id=str(prd.prioritization_scenario_id) if prd.prioritization_scenario_id else None,
            title=prd.title,
            version=prd.version or "1.0.0",
            status=status_val,
            prd=prd_model,
            user_stories=user_stories,
            technical_requirements=tech_reqs,
            success_metrics=metrics,
            risk_analysis=risks,
            roadmap_recommendations=roadmap,
            supporting_evidence=prd.supporting_evidence or [],
            ai_metadata=prd.ai_metadata,
            review_notes=prd.review_notes,
            reviewed_by=str(prd.reviewed_by) if prd.reviewed_by else None,
            reviewed_at=prd.reviewed_at,
            created_at=prd.created_at,
            updated_at=prd.updated_at,
        )

    @classmethod
    def validate_and_sanitize_requirement_origins(
        cls,
        plan_output: ProductPlanningAgentOutput,
        feature_group: Any,
        strategic_context: Optional[ProductStrategicContext] = None,
        prioritization_data: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Validates requirement and metric origins against actual source evidence and user strategic context.
        Ensures an LLM cannot mark an invented requirement or target as confirmed merely by returning
        a USER_PROVIDED or SOURCE_SUPPORTED origin label.
        - USER_PROVIDED: verified against strategic_context (business_goals, constraints, objectives, etc.)
        - SOURCE_SUPPORTED: verified against feature_group evidence quotes, pain points, themes, analytics
        - AI_RECOMMENDATION: strictly unconfirmed (is_confirmed=False, requires_confirmation=True)
        - Unverifiable/unsupported: downgraded to AI_RECOMMENDATION
        - Expected direction: validated and corrected against metric name and objectives
        """
        # 1. Compile user context corpus
        user_texts: List[str] = []
        if strategic_context:
            for bg in (strategic_context.business_goals or []):
                if bg and isinstance(bg, str):
                    user_texts.append(bg.strip().lower())
            for tc in (strategic_context.technical_constraints or []):
                if tc and isinstance(tc, str):
                    user_texts.append(tc.strip().lower())
            for obj in (strategic_context.current_quarter_objectives or []):
                if obj and isinstance(obj, str):
                    user_texts.append(obj.strip().lower())
            for dep in (strategic_context.known_dependencies or []):
                if dep and isinstance(dep, str):
                    user_texts.append(dep.strip().lower())
            for seg in (strategic_context.target_customer_segments or []):
                if seg and isinstance(seg, str):
                    user_texts.append(seg.strip().lower())
            if strategic_context.additional_planning_instructions and isinstance(strategic_context.additional_planning_instructions, str):
                user_texts.append(strategic_context.additional_planning_instructions.strip().lower())
            if strategic_context.product_name and isinstance(strategic_context.product_name, str):
                user_texts.append(strategic_context.product_name.strip().lower())
            if strategic_context.product_description and isinstance(strategic_context.product_description, str):
                user_texts.append(strategic_context.product_description.strip().lower())

        # 2. Compile source data corpus (customer feedback quotes, pain points, themes, analytics)
        source_texts: List[str] = []
        if feature_group:
            for ev in (getattr(feature_group, "evidence", []) or []):
                if ev and isinstance(ev, str):
                    source_texts.append(ev.strip().lower())
            for pp in (getattr(feature_group, "pain_points", []) or []):
                if pp and isinstance(pp, str):
                    source_texts.append(pp.strip().lower())
            for th in (getattr(feature_group, "themes", []) or []):
                if th and isinstance(th, str):
                    source_texts.append(th.strip().lower())
            title_val = getattr(feature_group, "title", None)
            if title_val and isinstance(title_val, str):
                source_texts.append(title_val.strip().lower())
            desc_val = getattr(feature_group, "description", None)
            if desc_val and isinstance(desc_val, str):
                source_texts.append(desc_val.strip().lower())
        if prioritization_data:
            for k, v in prioritization_data.items():
                if v and isinstance(v, (str, int, float)):
                    source_texts.append(f"{k} {v}".strip().lower())

        def text_matches_corpus(query: Optional[str], corpus: List[str], min_overlap: float = 0.5) -> bool:
            if not query or not corpus:
                return False
            q = str(query).strip().lower()
            for prefix in [
                "user technical constraint:", "user business goal:", "user constraint:",
                "customer quote:", "feedback:", "[customer quote]", "[pain point]", "[user-provided]"
            ]:
                if q.startswith(prefix):
                    q = q[len(prefix):].strip()

            # Direct substring match
            for item in corpus:
                item_str = str(item)
                if q in item_str or item_str in q:
                    return True

            # Token overlap match
            q_words = set(w for w in q.replace(".", " ").replace(",", " ").replace(":", " ").replace("-", " ").split() if len(w) > 3)
            if not q_words:
                return False
            for item in corpus:
                item_str = str(item)
                i_words = set(w for w in item_str.replace(".", " ").replace(",", " ").replace(":", " ").replace("-", " ").split() if len(w) > 3)
                if i_words:
                    overlap = len(q_words.intersection(i_words)) / len(q_words)
                    if overlap >= min_overlap:
                        return True
            return False

        # 3. Validate & sanitize Success Metrics
        for m in (plan_output.success_metrics or []):
            # A) Direction consistency
            inferred_dir = infer_expected_direction(
                metric_name=m.metric_name,
                description=m.description,
                suggested_target=m.suggested_target,
                current_direction=m.expected_direction,
            )
            if inferred_dir is not None:
                m.expected_direction = inferred_dir
                m.direction_requires_confirmation = False
            else:
                m.expected_direction = None
                m.direction_requires_confirmation = True

            # B) Validate USER_PROVIDED origin
            if m.origin == RequirementOrigin.USER_PROVIDED or m.target_origin == RequirementOrigin.USER_PROVIDED:
                is_valid = (
                    text_matches_corpus(m.suggested_target, user_texts) or
                    text_matches_corpus(m.source_reference, user_texts) or
                    text_matches_corpus(m.metric_name, user_texts)
                )
                if not is_valid:
                    # Downgrade unverified origin
                    m.origin = RequirementOrigin.AI_RECOMMENDATION
                    m.is_confirmed = False
                    m.requires_confirmation = True
                    if m.suggested_target:
                        m.target_origin = RequirementOrigin.AI_RECOMMENDATION
                        m.is_target_confirmed = False
                        m.requires_target_confirmation = True
                else:
                    m.is_confirmed = True
                    m.requires_confirmation = False
                    if m.suggested_target:
                        m.is_target_confirmed = True
                        m.requires_target_confirmation = False

            # C) Validate SOURCE_SUPPORTED origin
            elif m.origin == RequirementOrigin.SOURCE_SUPPORTED or m.target_origin == RequirementOrigin.SOURCE_SUPPORTED:
                is_valid = (
                    text_matches_corpus(m.source_reference, source_texts) or
                    text_matches_corpus(m.suggested_target, source_texts) or
                    text_matches_corpus(m.baseline, source_texts)
                )
                if not is_valid:
                    # Downgrade unverified origin
                    m.origin = RequirementOrigin.AI_RECOMMENDATION
                    m.is_confirmed = False
                    m.requires_confirmation = True
                    if m.suggested_target:
                        m.target_origin = RequirementOrigin.AI_RECOMMENDATION
                        m.is_target_confirmed = False
                        m.requires_target_confirmation = True
                else:
                    m.is_confirmed = True
                    m.requires_confirmation = False
                    if m.suggested_target:
                        m.is_target_confirmed = True
                        m.requires_target_confirmation = False

            # D) AI_RECOMMENDATION is always unconfirmed
            if m.origin == RequirementOrigin.AI_RECOMMENDATION:
                m.is_confirmed = False
                m.requires_confirmation = True
            if m.target_origin == RequirementOrigin.AI_RECOMMENDATION:
                m.is_target_confirmed = False
                m.requires_target_confirmation = bool(m.suggested_target)

        # 4. Validate & sanitize Functional & Non-Functional Requirements
        all_reqs = []
        if plan_output.prd:
            all_reqs.extend(plan_output.prd.functional_requirements or [])
            all_reqs.extend(plan_output.prd.non_functional_requirements or [])
        for req in all_reqs:
            if hasattr(req, "origin"):
                if req.origin == RequirementOrigin.USER_PROVIDED:
                    is_valid = (
                        text_matches_corpus(req.source_reference, user_texts) or
                        text_matches_corpus(req.title, user_texts) or
                        text_matches_corpus(req.description, user_texts)
                    )
                    if not is_valid:
                        req.origin = RequirementOrigin.AI_RECOMMENDATION
                        req.is_confirmed = False
                        req.requires_confirmation = True
                    else:
                        req.is_confirmed = True
                        req.requires_confirmation = False
                elif req.origin == RequirementOrigin.SOURCE_SUPPORTED:
                    is_valid = (
                        text_matches_corpus(req.source_reference, source_texts) or
                        text_matches_corpus(req.title, source_texts) or
                        text_matches_corpus(req.description, source_texts)
                    )
                    if not is_valid:
                        req.origin = RequirementOrigin.AI_RECOMMENDATION
                        req.is_confirmed = False
                        req.requires_confirmation = True
                    else:
                        req.is_confirmed = True
                        req.requires_confirmation = False
                elif req.origin == RequirementOrigin.AI_RECOMMENDATION:
                    req.is_confirmed = False
                    req.requires_confirmation = True

        # 5. Validate & sanitize Technical Requirements
        for tech in (plan_output.technical_requirements or []):
            if hasattr(tech, "origin"):
                if tech.origin == RequirementOrigin.USER_PROVIDED:
                    is_valid = (
                        text_matches_corpus(tech.source_reference, user_texts) or
                        text_matches_corpus(tech.title, user_texts) or
                        text_matches_corpus(tech.description, user_texts)
                    )
                    if not is_valid:
                        tech.origin = RequirementOrigin.AI_RECOMMENDATION
                        tech.is_confirmed = False
                        tech.requires_engineering_review = True
                    else:
                        tech.is_confirmed = True
                        tech.requires_engineering_review = False
                elif tech.origin == RequirementOrigin.AI_RECOMMENDATION:
                    tech.is_confirmed = False
                    tech.requires_engineering_review = True

        # 6. Validate & sanitize User Stories
        for us in (plan_output.user_stories or []):
            if hasattr(us, "origin"):
                if us.origin == RequirementOrigin.USER_PROVIDED:
                    is_valid = text_matches_corpus(us.source_reference, user_texts) or text_matches_corpus(us.description, user_texts)
                    if not is_valid:
                        us.origin = RequirementOrigin.AI_RECOMMENDATION
                        us.is_confirmed = False
                        us.requires_confirmation = True
                    else:
                        us.is_confirmed = True
                        us.requires_confirmation = False
                elif us.origin == RequirementOrigin.SOURCE_SUPPORTED:
                    is_valid = text_matches_corpus(us.source_reference, source_texts) or text_matches_corpus(us.description, source_texts)
                    if not is_valid:
                        us.origin = RequirementOrigin.AI_RECOMMENDATION
                        us.is_confirmed = False
                        us.requires_confirmation = True
                    else:
                        us.is_confirmed = True
                        us.requires_confirmation = False
                elif us.origin == RequirementOrigin.AI_RECOMMENDATION:
                    us.is_confirmed = False
                    us.requires_confirmation = True
