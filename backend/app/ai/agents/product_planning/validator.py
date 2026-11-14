"""
ProductMind AI — PRD Quality & Validation Engine
Deterministic verification of PRD completeness, requirement quality, evidence traceability,
Given-When-Then acceptance criteria, success metric integrity, and risk mitigations.
"""

from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from app.ai.agents.product_planning.schemas import (
    ValidationSeverity,
    ValidationCategory,
    ValidationIssue,
    ValidationSummary,
    PRDValidationResult,
    RequirementOrigin,
)


CANONICAL_SECTIONS = [
    ("overview", "1. Overview / Executive Summary"),
    ("problem_statement", "2. Problem Statement"),
    ("target_users", "3. Target Users"),
    ("customer_pain_points", "4. Customer Pain Points"),
    ("proposed_solution", "5. Proposed Solution"),
    ("goals_and_success_metrics", "6. Goals and Success Metrics"),
    ("functional_requirements", "7. Functional Requirements"),
    ("non_functional_requirements", "8. Non-Functional Requirements"),
    ("user_stories", "9. User Stories"),
    ("acceptance_criteria", "10. Acceptance Criteria"),
    ("dependencies_and_constraints", "11. Dependencies and Constraints"),
    ("risks_and_mitigations", "12. Risks and Mitigations"),
    ("release_plan", "13. Release Plan"),
]

# Section key alias mapping for camelCase vs snake_case
SECTION_KEY_ALIASES: Dict[str, str] = {
    "overview": "overview",
    "executive_summary": "overview",
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
    "risks_and_mitigations": "risks_and_mitigations",
    "risksandmitigations": "risks_and_mitigations",
    "release_plan": "release_plan",
    "releaseplan": "release_plan",
}

AMBIGUOUS_KEYWORDS = [
    "user-friendly",
    "user friendly",
    "seamless",
    "seamlessly",
    "fast",
    "robust",
    "easy to use",
    "flexible ui",
    "good performance",
    "high speed",
    "as soon as possible",
    "scalable enough",
    "intuitive",
    "clean architecture",
]

CONTRADICTORY_PATTERNS: List[Tuple[str, str, str]] = [
    (
        r"\b(?:synchronous|real-?time|instant|under \d+ms)\b",
        r"\b(?:offline|asynchronous|background batch|delayed queue|nightly)\b",
        "Conflicting architectural commitments: synchronous/real-time vs. offline/background asynchronous processing.",
    ),
    (
        r"\b(?:read-?only|view only|immutable|cannot modify|prohibit edit)\b",
        r"\b(?:inline edit|allow modification|update direct|editable|write access)\b",
        "Conflicting permission constraints: read-only/immutable vs. inline editable/write access.",
    ),
    (
        r"\b(?:unauthenticated|anonymous access|publicly accessible|no login)\b",
        r"\b(?:mandatory mfa|authenticated only|strict rbac|require login)\b",
        "Conflicting security requirements: unauthenticated/public access vs. mandatory authenticated/MFA access.",
    ),
    (
        r"\b(?:stateless|no cache|bypass cache|never store)\b",
        r"\b(?:persistent redis cache|local storage cache|session affinity|stateful cache)\b",
        "Conflicting data caching strategies: stateless/no-cache vs. persistent session/cache storage.",
    ),
]


class PRDValidator:
    """Deterministic validation engine for Product Requirements Documents."""

    def __init__(
        self,
        prd_data: Dict[str, Any],
        feature_group: Optional[Any] = None,
        workspace_feedback_ids: Optional[Set[str]] = None,
        workspace_id: Optional[str] = None,
    ):
        self.prd = prd_data or {}
        self.feature_group = feature_group
        self.workspace_feedback_ids = workspace_feedback_ids or set()
        self.workspace_id = workspace_id or str(self.prd.get("workspace_id") or self.prd.get("workspaceId") or "")
        self.issues: List[ValidationIssue] = []
        self.issue_counter = 0
        self.total_checks = 0
        self.passed_checks = 0

    def _add_issue(
        self,
        category: ValidationCategory,
        severity: ValidationSeverity,
        section_key: str,
        title: str,
        message: str,
        suggestion: Optional[str] = None,
        related_id: Optional[str] = None,
    ) -> None:
        self.issue_counter += 1
        issue_id = f"VAL-{self.issue_counter:03d}"
        self.issues.append(
            ValidationIssue(
                id=issue_id,
                category=category,
                severity=severity,
                section_key=section_key,
                title=title,
                message=message,
                suggestion=suggestion,
                related_id=related_id,
            )
        )

    def _check(self, condition: bool, **issue_kwargs) -> bool:
        """Helper to track total and passed checks deterministically."""
        self.total_checks += 1
        if condition:
            self.passed_checks += 1
            return True
        self._add_issue(**issue_kwargs)
        return False

    def validate_all(self) -> PRDValidationResult:
        """Executes full diagnostic suite across all 6 validation categories."""
        self.issues.clear()
        self.issue_counter = 0
        self.total_checks = 0
        self.passed_checks = 0

        # Execute 6 validation suites
        self._validate_completeness()
        self._validate_requirement_quality()
        self._validate_evidence_traceability()
        self._validate_acceptance_criteria()
        self._validate_success_metrics()
        self._validate_risks_and_mitigations()

        # Compute counts by severity
        crit_count = sum(1 for i in self.issues if i.severity == ValidationSeverity.CRITICAL)
        high_count = sum(1 for i in self.issues if i.severity == ValidationSeverity.HIGH)
        med_count = sum(1 for i in self.issues if i.severity == ValidationSeverity.MEDIUM)
        low_count = sum(1 for i in self.issues if i.severity == ValidationSeverity.LOW)
        failed_checks = len(self.issues)
        warnings_count = med_count + low_count

        # Deterministic Quality Score calculation [0..100]
        # Deductions: Critical: 25, High: 15, Medium: 5, Low: 2
        total_deduction = (crit_count * 25) + (high_count * 15) + (med_count * 5) + (low_count * 2)
        score = max(0, min(100, 100 - total_deduction))
        calc_explanation = (
            f"Base: 100 - ({crit_count} critical * 25) - ({high_count} high * 15) "
            f"- ({med_count} medium * 5) - ({low_count} low * 2) = {score}/100"
        )

        # Section health status map
        section_status: Dict[str, str] = {}
        for canonical_key, _ in CANONICAL_SECTIONS:
            section_issues = [i for i in self.issues if i.section_key == canonical_key]
            if any(i.severity == ValidationSeverity.CRITICAL for i in section_issues):
                section_status[canonical_key] = "error"
            elif any(i.severity == ValidationSeverity.HIGH for i in section_issues):
                section_status[canonical_key] = "error"
            elif any(i.severity in (ValidationSeverity.MEDIUM, ValidationSeverity.LOW) for i in section_issues):
                section_status[canonical_key] = "warning"
            else:
                section_status[canonical_key] = "valid"

        summary = ValidationSummary(
            total_checks=self.total_checks,
            passed_checks=self.passed_checks,
            failed_checks=failed_checks,
            warnings=warnings_count,
            critical_issues=crit_count,
            high_severity_issues=high_count,
            medium_severity_issues=med_count,
            low_severity_issues=low_count,
            quality_score=score,
            quality_score_calculation=calc_explanation,
            is_valid_for_review=(crit_count == 0),
            has_blocking_issues=(crit_count > 0 or high_count > 0),
        )

        planning_id = str(self.prd.get("id") or self.prd.get("planning_id") or self.prd.get("_id") or "unpersisted")
        title = str(self.prd.get("title") or "Untitled Specification")
        version = str(self.prd.get("version") or "1.0.0")
        status_val = str(self.prd.get("status") or "draft")

        return PRDValidationResult(
            planning_id=planning_id,
            title=title,
            version=version,
            status=status_val,
            summary=summary,
            issues=self.issues,
            section_status=section_status,
            validated_at=datetime.now(timezone.utc),
        )

    # -------------------------------------------------------------------------
    # 1. PRD Completeness Validation
    # -------------------------------------------------------------------------
    def _validate_completeness(self) -> None:
        raw_sections = self.prd.get("sections") or {}
        if hasattr(raw_sections, "model_dump"):
            sections_dict = raw_sections.model_dump()
        elif isinstance(raw_sections, dict):
            sections_dict = raw_sections
        else:
            sections_dict = {}

        # Normalize keys in sections_dict to canonical snake_case
        normalized_sections: Dict[str, str] = {}
        for k, v in sections_dict.items():
            canonical_name = SECTION_KEY_ALIASES.get(k.lower(), k.lower())
            if isinstance(v, str):
                normalized_sections[canonical_name] = v.strip()
            elif v is not None:
                normalized_sections[canonical_name] = str(v).strip()

        # Check each of the 13 canonical sections
        for canonical_key, human_name in CANONICAL_SECTIONS:
            # 1. Section presence
            has_section = canonical_key in normalized_sections
            core_sections = {"overview", "problem_statement", "functional_requirements", "user_stories"}
            sev = ValidationSeverity.CRITICAL if canonical_key in core_sections else ValidationSeverity.HIGH
            self._check(
                has_section,
                category=ValidationCategory.COMPLETENESS,
                severity=sev,
                section_key=canonical_key,
                title=f"Missing Canonical Section: {human_name}",
                message=f"The PRD is missing section '{human_name}'. All 13 canonical sections must be present.",
                suggestion=f"Provide content for {human_name} or trigger single-section generation.",
            )
            if not has_section:
                continue

            content = normalized_sections.get(canonical_key, "")

            # 2. Non-empty check
            self._check(
                len(content) > 0,
                category=ValidationCategory.COMPLETENESS,
                severity=ValidationSeverity.HIGH,
                section_key=canonical_key,
                title=f"Empty Section Content: {human_name}",
                message=f"Section '{human_name}' exists in the PRD but contains empty or whitespace-only text.",
                suggestion=f"Populate {human_name} with specific domain requirements and rationale.",
            )

            # 3. Truncated or incomplete description check for narrative sections
            if canonical_key in {"overview", "problem_statement", "proposed_solution"} and len(content) > 0:
                self._check(
                    len(content) >= 40,
                    category=ValidationCategory.COMPLETENESS,
                    severity=ValidationSeverity.MEDIUM,
                    section_key=canonical_key,
                    title=f"Incomplete Section Description: {human_name}",
                    message=f"Section '{human_name}' description is unusually brief ({len(content)} characters). Detailed background is required for team alignment.",
                    suggestion="Expand on the business context, problem drivers, and proposed solution architecture.",
                )

        # 4. Structured child entity presence
        func_reqs = self._get_functional_requirements()
        self._check(
            len(func_reqs) > 0,
            category=ValidationCategory.COMPLETENESS,
            severity=ValidationSeverity.CRITICAL,
            section_key="functional_requirements",
            title="Missing Functional Requirements",
            message="The specification contains 0 functional requirements. A valid PRD must define core capabilities.",
            suggestion="Add at least one functional requirement specifying system behavior.",
        )

        non_func_reqs = self._get_non_functional_requirements()
        self._check(
            len(non_func_reqs) > 0,
            category=ValidationCategory.COMPLETENESS,
            severity=ValidationSeverity.HIGH,
            section_key="non_functional_requirements",
            title="Missing Non-Functional Requirements",
            message="No non-functional requirements (performance, security, reliability) are defined.",
            suggestion="Define operational constraints such as latency SLAs, security encryption, or availability standards.",
        )

        metrics = self.prd.get("success_metrics") or self.prd.get("successMetrics") or []
        self._check(
            len(metrics) > 0,
            category=ValidationCategory.COMPLETENESS,
            severity=ValidationSeverity.HIGH,
            section_key="goals_and_success_metrics",
            title="Missing Success Metrics",
            message="No quantifiable success metrics or KPIs are defined for this initiative.",
            suggestion="Define target KPIs (adoption rate, conversion, churn reduction) to evaluate release success.",
        )

        risks = self.prd.get("risk_analysis") or self.prd.get("riskAnalysis") or []
        self._check(
            len(risks) > 0,
            category=ValidationCategory.COMPLETENESS,
            severity=ValidationSeverity.HIGH,
            section_key="risks_and_mitigations",
            title="Missing Risks and Mitigations",
            message="No technical, adoption, or project risks have been documented.",
            suggestion="Document anticipated delivery or operational risks and actionable mitigation plans.",
        )

        roadmap = self.prd.get("roadmap_recommendations") or self.prd.get("roadmapRecommendations") or []
        self._check(
            len(roadmap) > 0,
            category=ValidationCategory.COMPLETENESS,
            severity=ValidationSeverity.MEDIUM,
            section_key="release_plan",
            title="Missing Release Delivery Roadmap",
            message="No progressive delivery milestones or roadmap phases are defined.",
            suggestion="Outline phased delivery (e.g., Phase 1 – Alpha, Phase 2 – GA) with tasks and deliverables.",
        )

    # -------------------------------------------------------------------------
    # 2. Requirement Quality Validation
    # -------------------------------------------------------------------------
    def _validate_requirement_quality(self) -> None:
        all_reqs = self._get_all_requirements()
        seen_titles: Dict[str, str] = {}
        seen_ids: Dict[str, str] = {}
        all_descriptions: List[Tuple[str, str]] = []

        for req in all_reqs:
            req_id = str(req.get("requirement_id") or req.get("id") or "").strip()
            title = str(req.get("title") or "").strip()
            desc = str(req.get("description") or "").strip()
            origin = str(req.get("origin") or RequirementOrigin.AI_RECOMMENDATION.value).lower()
            num_threshold = req.get("numerical_threshold")
            source_ref = req.get("source_reference")

            # 1. Identifier checks
            self._check(
                len(req_id) > 0 and req_id != "REQ-000",
                category=ValidationCategory.REQUIREMENT_QUALITY,
                severity=ValidationSeverity.MEDIUM,
                section_key="functional_requirements",
                title="Missing Requirement Identifier",
                message=f"Requirement '{title or 'Untitled'}' has no unique ID assigned.",
                suggestion="Assign a deterministic ID such as 'REQ-001' or 'NFR-001'.",
                related_id=req_id or None,
            )

            if req_id:
                if req_id in seen_ids:
                    self._add_issue(
                        category=ValidationCategory.REQUIREMENT_QUALITY,
                        severity=ValidationSeverity.HIGH,
                        section_key="functional_requirements",
                        title=f"Duplicate Requirement ID: {req_id}",
                        message=f"Requirement ID '{req_id}' is assigned to multiple requirements ('{seen_ids[req_id]}' and '{title}').",
                        suggestion=f"Ensure every requirement in the specification has a globally unique ID.",
                        related_id=req_id,
                    )
                else:
                    seen_ids[req_id] = title

            # 2. Duplicate titles
            normalized_title = title.lower()
            if normalized_title:
                if normalized_title in seen_titles:
                    self._add_issue(
                        category=ValidationCategory.REQUIREMENT_QUALITY,
                        severity=ValidationSeverity.HIGH,
                        section_key="functional_requirements",
                        title=f"Duplicate Requirement Title: '{title}'",
                        message=f"Requirement '{title}' is duplicated ({req_id} and {seen_titles[normalized_title]}).",
                        suggestion="Consolidate duplicate requirements or clarify their distinct scopes.",
                        related_id=req_id,
                    )
                else:
                    seen_titles[normalized_title] = req_id

            # 3. Expected outcome check
            self._check(
                len(desc) >= 20,
                category=ValidationCategory.REQUIREMENT_QUALITY,
                severity=ValidationSeverity.MEDIUM,
                section_key="functional_requirements",
                title=f"Requirement Lacks Clear Expected Outcome: {req_id}",
                message=f"Requirement '{title}' has an incomplete description ({len(desc)} characters). It must specify expected system behavior.",
                suggestion="Specify the exact capability, inputs, trigger conditions, and observable outcome.",
                related_id=req_id,
            )

            # 4. Ambiguous words check
            desc_lower = desc.lower()
            matched_ambiguous = [w for w in AMBIGUOUS_KEYWORDS if f" {w} " in f" {desc_lower} " or desc_lower.startswith(w)]
            if matched_ambiguous:
                self._add_issue(
                    category=ValidationCategory.REQUIREMENT_QUALITY,
                    severity=ValidationSeverity.MEDIUM,
                    section_key="functional_requirements",
                    title=f"Ambiguous Language in Requirement: {req_id}",
                    message=f"Requirement '{title}' uses vague, non-quantifiable language: '{', '.join(matched_ambiguous)}'.",
                    suggestion="Replace subjective phrasing with measurable engineering criteria (e.g. latency, throughput, error rates).",
                    related_id=req_id,
                )

            # 5. Unsupported numerical thresholds (Zero-Fabrication Policy)
            has_numerical = False
            threshold_val = str(num_threshold or "")
            if threshold_val:
                has_numerical = True
            elif re.search(r"\b(?:\d+(?:\.\d+)?%|\d+\s*(?:ms|sec|seconds|s|req/s|rps|rpm|users|mb|gb|tb))\b", desc_lower):
                has_numerical = True

            if has_numerical:
                # Must be user_provided or source_supported with source_reference
                is_grounded = (
                    origin in (RequirementOrigin.USER_PROVIDED.value, RequirementOrigin.SOURCE_SUPPORTED.value)
                    and bool(source_ref and str(source_ref).strip())
                )
                self._check(
                    is_grounded,
                    category=ValidationCategory.REQUIREMENT_QUALITY,
                    severity=ValidationSeverity.HIGH,
                    section_key="non_functional_requirements",
                    title=f"Unsupported Numerical Threshold: {req_id}",
                    message=f"Requirement '{title}' specifies numerical threshold '{threshold_val or desc[:40]}...' without supporting customer quote or user constraint.",
                    suggestion="Set numerical_threshold to null or ground the target in customer feedback or strategic constraints.",
                    related_id=req_id,
                )

            all_descriptions.append((req_id, desc))

        # 6. Near-duplicate descriptions (Jaccard similarity > 0.85)
        for i in range(len(all_descriptions)):
            for j in range(i + 1, len(all_descriptions)):
                id_a, text_a = all_descriptions[i]
                id_b, text_b = all_descriptions[j]
                tokens_a = set(re.findall(r"\w+", text_a.lower()))
                tokens_b = set(re.findall(r"\w+", text_b.lower()))
                if tokens_a and tokens_b:
                    overlap = len(tokens_a & tokens_b) / len(tokens_a | tokens_b)
                    if overlap >= 0.85:
                        self._add_issue(
                            category=ValidationCategory.REQUIREMENT_QUALITY,
                            severity=ValidationSeverity.MEDIUM,
                            section_key="functional_requirements",
                            title=f"Near-Duplicate Requirements Detected: {id_a} and {id_b}",
                            message=f"Requirements {id_a} and {id_b} share {int(overlap * 100)}% vocabulary similarity and may be redundant.",
                            suggestion=f"Review {id_a} and {id_b} to merge them or differentiate their functionality.",
                            related_id=id_a,
                        )

        # 7. Contradictory Requirements
        full_req_text = " ".join(d for _, d in all_descriptions).lower()
        for pat_a, pat_b, explanation in CONTRADICTORY_PATTERNS:
            match_a = re.search(pat_a, full_req_text, re.IGNORECASE)
            match_b = re.search(pat_b, full_req_text, re.IGNORECASE)
            if match_a and match_b:
                self._add_issue(
                    category=ValidationCategory.REQUIREMENT_QUALITY,
                    severity=ValidationSeverity.HIGH,
                    section_key="functional_requirements",
                    title="Contradictory Requirements Detected",
                    message=f"{explanation} (Found '{match_a.group(0)}' vs. '{match_b.group(0)}')",
                    suggestion="Align requirements to a single consistent operational and architectural paradigm.",
                )

    # -------------------------------------------------------------------------
    # 3. Evidence Traceability Validation
    # -------------------------------------------------------------------------
    def _validate_evidence_traceability(self) -> None:
        feature_group_evidence: List[str] = []
        if self.feature_group:
            for ev in (getattr(self.feature_group, "evidence", []) or []):
                if ev:
                    feature_group_evidence.append(str(ev).strip().lower())
            for pp in (getattr(self.feature_group, "pain_points", []) or []):
                if pp:
                    feature_group_evidence.append(str(pp).strip().lower())

        # Inspect requirements
        for req in self._get_all_requirements():
            req_id = str(req.get("requirement_id") or req.get("id") or "").strip()
            origin = str(req.get("origin") or "").lower()
            source_ref = str(req.get("source_reference") or "").strip()
            is_confirmed = bool(req.get("is_confirmed", False))
            requires_confirmation = bool(req.get("requires_confirmation", True))

            if origin == RequirementOrigin.SOURCE_SUPPORTED.value:
                # 1. Must have source reference
                self._check(
                    len(source_ref) > 0,
                    category=ValidationCategory.EVIDENCE_TRACEABILITY,
                    severity=ValidationSeverity.HIGH,
                    section_key="functional_requirements",
                    title=f"Missing Evidence Reference: {req_id}",
                    message=f"Requirement {req_id} is labeled 'source_supported' but does not reference any customer feedback quote or ID.",
                    suggestion="Attach the source customer quote or change origin to 'ai_recommendation'.",
                    related_id=req_id,
                )

            if origin == RequirementOrigin.AI_RECOMMENDATION.value:
                # 2. AI recommendations cannot be confirmed commitments without PM signoff
                self._check(
                    not is_confirmed or requires_confirmation,
                    category=ValidationCategory.EVIDENCE_TRACEABILITY,
                    severity=ValidationSeverity.HIGH,
                    section_key="functional_requirements",
                    title=f"AI Recommendation Incorrectly Confirmed: {req_id}",
                    message=f"Requirement {req_id} is an AI recommendation but is marked as confirmed without human PM approval.",
                    suggestion="Set is_confirmed to false and requires_confirmation to true.",
                    related_id=req_id,
                )

        # Inspect user stories & feedback IDs
        stories = self.prd.get("user_stories") or self.prd.get("userStories") or []
        for story in stories:
            if not isinstance(story, dict):
                continue
            s_id = str(story.get("story_id") or "US-???")
            s_origin = str(story.get("origin") or "").lower()
            s_ref = str(story.get("source_reference") or "").strip()
            feedback_ids = story.get("supporting_feedback_ids") or []

            if s_origin == RequirementOrigin.SOURCE_SUPPORTED.value:
                self._check(
                    len(s_ref) > 0 or len(feedback_ids) > 0,
                    category=ValidationCategory.EVIDENCE_TRACEABILITY,
                    severity=ValidationSeverity.HIGH,
                    section_key="user_stories",
                    title=f"Missing Evidence for User Story: {s_id}",
                    message=f"Story {s_id} is marked 'source_supported' but references no feedback ID or customer quote.",
                    suggestion="Provide the feedback ID or customer quote supporting this story.",
                    related_id=s_id,
                )

            # Check validity of feedback IDs against workspace database
            if self.workspace_feedback_ids:
                for f_id in feedback_ids:
                    clean_f_id = str(f_id).strip()
                    if clean_f_id:
                        is_valid_feedback = clean_f_id in self.workspace_feedback_ids
                        self._check(
                            is_valid_feedback,
                            category=ValidationCategory.EVIDENCE_TRACEABILITY,
                            severity=ValidationSeverity.HIGH,
                            section_key="user_stories",
                            title=f"Invalid Feedback Reference: {clean_f_id}",
                            message=f"Story {s_id} references feedback ID '{clean_f_id}' which does not exist in workspace '{self.workspace_id}'.",
                            suggestion=f"Reference feedback items belonging to workspace '{self.workspace_id}'.",
                            related_id=s_id,
                        )

    # -------------------------------------------------------------------------
    # 4. Acceptance Criteria Validation
    # -------------------------------------------------------------------------
    def _validate_acceptance_criteria(self) -> None:
        stories = self.prd.get("user_stories") or self.prd.get("userStories") or []
        all_criterion_ids: Dict[str, str] = {}
        all_criterion_descriptions: Dict[str, str] = {}

        for story in stories:
            if not isinstance(story, dict):
                continue
            s_id = str(story.get("story_id") or "US-???")
            criteria = story.get("acceptance_criteria") or []

            self._check(
                len(criteria) > 0,
                category=ValidationCategory.ACCEPTANCE_CRITERIA,
                severity=ValidationSeverity.HIGH,
                section_key="user_stories",
                title=f"User Story Lacks Acceptance Criteria: {s_id}",
                message=f"User story {s_id} ('{story.get('title', '')}') contains 0 acceptance criteria.",
                suggestion="Define at least one Given-When-Then behavioral acceptance criterion.",
                related_id=s_id,
            )

            for ac in criteria:
                if not isinstance(ac, dict):
                    continue
                c_id = str(ac.get("criterion_id") or "").strip()
                desc = str(ac.get("description") or "").strip()
                scenario_type = str(ac.get("scenario_type") or "positive").lower()
                testable = bool(ac.get("testable", True))
                parent_story_id = str(ac.get("related_story_id") or s_id)

                # 1. Criterion ID presence
                self._check(
                    len(c_id) > 0,
                    category=ValidationCategory.ACCEPTANCE_CRITERIA,
                    severity=ValidationSeverity.MEDIUM,
                    section_key="acceptance_criteria",
                    title="Missing Acceptance Criterion ID",
                    message=f"An acceptance criterion under story {s_id} has no ID assigned.",
                    suggestion="Assign sequential criterion ID (e.g. AC-001).",
                    related_id=s_id,
                )

                # 2. Duplicate criterion ID across all stories
                if c_id:
                    if c_id in all_criterion_ids:
                        self._add_issue(
                            category=ValidationCategory.ACCEPTANCE_CRITERIA,
                            severity=ValidationSeverity.CRITICAL,
                            section_key="acceptance_criteria",
                            title=f"Duplicate Criterion ID: {c_id}",
                            message=f"Criterion ID '{c_id}' appears in multiple user stories ({all_criterion_ids[c_id]} and {s_id}).",
                            suggestion=f"Ensure every criterion ID is unique across the entire PRD.",
                            related_id=c_id,
                        )
                    else:
                        all_criterion_ids[c_id] = s_id

                # 3. Given-When-Then completeness
                has_given = bool(re.search(r"\bgiven\b", desc, re.IGNORECASE))
                has_when = bool(re.search(r"\bwhen\b", desc, re.IGNORECASE))
                has_then = bool(re.search(r"\bthen\b", desc, re.IGNORECASE))

                self._check(
                    has_given,
                    category=ValidationCategory.ACCEPTANCE_CRITERIA,
                    severity=ValidationSeverity.HIGH,
                    section_key="acceptance_criteria",
                    title=f"Missing 'Given' Precondition: {c_id or s_id}",
                    message=f"Acceptance criterion {c_id or ''} under story {s_id} is missing a 'Given [precondition]' clause.",
                    suggestion="Add a precondition: 'Given [authenticated user state / database state]...'",
                    related_id=c_id or s_id,
                )
                self._check(
                    has_when,
                    category=ValidationCategory.ACCEPTANCE_CRITERIA,
                    severity=ValidationSeverity.HIGH,
                    section_key="acceptance_criteria",
                    title=f"Missing 'When' Trigger: {c_id or s_id}",
                    message=f"Acceptance criterion {c_id or ''} under story {s_id} is missing a 'When [action]' trigger.",
                    suggestion="Add a trigger action: 'When [user initiates action / event occurs]...'",
                    related_id=c_id or s_id,
                )
                self._check(
                    has_then,
                    category=ValidationCategory.ACCEPTANCE_CRITERIA,
                    severity=ValidationSeverity.HIGH,
                    section_key="acceptance_criteria",
                    title=f"Missing 'Then' Expected Outcome: {c_id or s_id}",
                    message=f"Acceptance criterion {c_id or ''} under story {s_id} is missing a 'Then [expected outcome]' clause.",
                    suggestion="Add an expected result: 'Then [system responds with observable output]...'",
                    related_id=c_id or s_id,
                )

                # 4. Scenario type validation
                valid_scenarios = {"positive", "negative", "edge_case"}
                self._check(
                    scenario_type in valid_scenarios,
                    category=ValidationCategory.ACCEPTANCE_CRITERIA,
                    severity=ValidationSeverity.MEDIUM,
                    section_key="acceptance_criteria",
                    title=f"Invalid Scenario Type: {c_id or s_id}",
                    message=f"Criterion {c_id or ''} specifies invalid scenario type '{scenario_type}'. Must be one of: positive, negative, edge_case.",
                    suggestion="Change scenario_type to 'positive', 'negative', or 'edge_case'.",
                    related_id=c_id or s_id,
                )

                # 5. Non-testable criteria warning
                if not testable:
                    self._add_issue(
                        category=ValidationCategory.ACCEPTANCE_CRITERIA,
                        severity=ValidationSeverity.LOW,
                        section_key="acceptance_criteria",
                        title=f"Non-Testable Criterion: {c_id or s_id}",
                        message=f"Criterion {c_id or ''} is flagged as non-testable manual verification.",
                        suggestion="Consider refactoring into an automated assertable behavioral condition if possible.",
                        related_id=c_id or s_id,
                    )

                # 6. Duplicate criterion descriptions
                norm_desc = desc.lower().strip()
                if norm_desc:
                    if norm_desc in all_criterion_descriptions:
                        self._add_issue(
                            category=ValidationCategory.ACCEPTANCE_CRITERIA,
                            severity=ValidationSeverity.MEDIUM,
                            section_key="acceptance_criteria",
                            title=f"Duplicate Acceptance Criterion Description: {c_id}",
                            message=f"Criterion {c_id} has identical text to {all_criterion_descriptions[norm_desc]}.",
                            suggestion="Consolidate duplicate criteria or specify different scenario parameters.",
                            related_id=c_id,
                        )
                    else:
                        all_criterion_descriptions[norm_desc] = c_id

    # -------------------------------------------------------------------------
    # 5. Success Metrics Validation
    # -------------------------------------------------------------------------
    def _validate_success_metrics(self) -> None:
        metrics = self.prd.get("success_metrics") or self.prd.get("successMetrics") or []
        for metric in metrics:
            if not isinstance(metric, dict):
                continue
            name = str(metric.get("metric_name") or metric.get("name") or "").strip()
            desc = str(metric.get("description") or "").strip()
            method = str(metric.get("measurement_method") or "").strip()
            direction = metric.get("expected_direction")
            target = metric.get("suggested_target")
            target_origin = str(metric.get("target_origin") or "").lower()
            is_target_confirmed = bool(metric.get("is_target_confirmed", False))
            source_ref = metric.get("source_reference")

            # 1. Mandatory metric name & description
            self._check(
                len(name) > 0,
                category=ValidationCategory.SUCCESS_METRICS,
                severity=ValidationSeverity.HIGH,
                section_key="goals_and_success_metrics",
                title="Unnamed Success Metric",
                message="A success metric is missing a name/identifier.",
                suggestion="Specify the KPI name (e.g. '30-Day Active User Adoption Rate').",
            )
            self._check(
                len(desc) >= 15,
                category=ValidationCategory.SUCCESS_METRICS,
                severity=ValidationSeverity.HIGH,
                section_key="goals_and_success_metrics",
                title=f"Incomplete Metric Description: {name or 'Metric'}",
                message=f"Metric '{name}' lacks a comprehensive explanation of what is measured and why.",
                suggestion="Explain the commercial or customer value reflected by this KPI.",
            )

            # 2. Measurement method
            self._check(
                len(method) >= 10,
                category=ValidationCategory.SUCCESS_METRICS,
                severity=ValidationSeverity.MEDIUM,
                section_key="goals_and_success_metrics",
                title=f"Missing Measurement Method: {name or 'Metric'}",
                message=f"Metric '{name}' has no concrete measurement or computation method defined.",
                suggestion="Specify the telemetry query, database column, or analytics event computing this metric.",
            )

            # 3. Expected direction
            dir_str = str(direction or "").lower() if direction else ""
            self._check(
                dir_str in ("increase", "decrease", "maintain"),
                category=ValidationCategory.SUCCESS_METRICS,
                severity=ValidationSeverity.MEDIUM,
                section_key="goals_and_success_metrics",
                title=f"Unclassified Metric Direction: {name or 'Metric'}",
                message=f"Metric '{name}' direction is undefined or unclassified. PM confirmation is required.",
                suggestion="Confirm expected direction: 'increase', 'decrease', or 'maintain'.",
            )

            # Direction contradiction check
            combined = f"{name} {desc}".lower()
            reduction_keywords = ["churn", "error rate", "latency", "downtime", "failure", "defect", "cost reduction", "bounce"]
            if any(k in combined for k in reduction_keywords):
                if dir_str == "increase":
                    self._add_issue(
                        category=ValidationCategory.SUCCESS_METRICS,
                        severity=ValidationSeverity.HIGH,
                        section_key="goals_and_success_metrics",
                        title=f"Contradictory Metric Direction: {name}",
                        message=f"Metric '{name}' is set to 'increase', but represents a defect/cost/failure metric that should decrease.",
                        suggestion="Change expected_direction to 'decrease'.",
                    )

            # 4. Zero-Fabrication Target Validation
            if target:
                if target_origin == RequirementOrigin.AI_RECOMMENDATION.value and is_target_confirmed:
                    self._add_issue(
                        category=ValidationCategory.SUCCESS_METRICS,
                        severity=ValidationSeverity.HIGH,
                        section_key="goals_and_success_metrics",
                        title=f"Zero-Fabrication Violation in Metric Target: {name}",
                        message=f"Metric '{name}' target '{target}' is an AI recommendation but is marked as confirmed commitment.",
                        suggestion="Leave is_target_confirmed as false until officially ratified by product management.",
                    )
                if target_origin in (RequirementOrigin.SOURCE_SUPPORTED.value, RequirementOrigin.USER_PROVIDED.value):
                    if not source_ref or not str(source_ref).strip():
                        self._add_issue(
                            category=ValidationCategory.SUCCESS_METRICS,
                            severity=ValidationSeverity.HIGH,
                            section_key="goals_and_success_metrics",
                            title=f"Unbacked Metric Target Claim: {name}",
                            message=f"Metric '{name}' claims {target_origin} target '{target}' without supporting evidence reference.",
                            suggestion="Provide the source reference or downgrade target_origin to ai_recommendation.",
                        )

    # -------------------------------------------------------------------------
    # 6. Risks & Mitigations Validation
    # -------------------------------------------------------------------------
    def _validate_risks_and_mitigations(self) -> None:
        risks = self.prd.get("risk_analysis") or self.prd.get("riskAnalysis") or []
        vague_mitigations = ["tbd", "monitor", "investigate", "mitigate later", "to be determined", "n/a", "none"]

        for idx, risk in enumerate(risks):
            if not isinstance(risk, dict):
                continue
            desc = str(risk.get("description") or "").strip()
            cat = str(risk.get("category") or "").strip().lower()
            impact = str(risk.get("impact") or "").strip()
            mitigation = str(risk.get("mitigation") or "").strip()
            risk_label = f"Risk #{idx + 1}" if not desc else f"'{desc[:30]}...'"

            # 1. Actionable mitigation presence
            self._check(
                len(mitigation) > 0,
                category=ValidationCategory.RISKS_AND_MITIGATIONS,
                severity=ValidationSeverity.HIGH,
                section_key="risks_and_mitigations",
                title=f"Risk Lacks Mitigation Plan: {risk_label}",
                message=f"Risk {risk_label} has no actionable mitigation strategy.",
                suggestion="Define a concrete mitigation plan to reduce or eliminate this risk.",
            )

            # 2. Vague mitigation check
            if mitigation and mitigation.lower() in vague_mitigations:
                self._add_issue(
                    category=ValidationCategory.RISKS_AND_MITIGATIONS,
                    severity=ValidationSeverity.MEDIUM,
                    section_key="risks_and_mitigations",
                    title=f"Vague Mitigation Strategy: {risk_label}",
                    message=f"Risk {risk_label} mitigation is placeholder text ('{mitigation}').",
                    suggestion="Replace placeholder with a real engineering or operational fallback procedure.",
                )

            # 3. Category validation
            valid_categories = {"technical", "product", "external", "adoption", "data"}
            self._check(
                cat in valid_categories,
                category=ValidationCategory.RISKS_AND_MITIGATIONS,
                severity=ValidationSeverity.MEDIUM,
                section_key="risks_and_mitigations",
                title=f"Invalid Risk Category: {risk_label}",
                message=f"Risk {risk_label} specifies category '{cat}'. Valid categories: {', '.join(sorted(valid_categories))}.",
                suggestion="Assign one of the recognized risk categories.",
            )

            # 4. Impact description
            self._check(
                len(impact) > 0,
                category=ValidationCategory.RISKS_AND_MITIGATIONS,
                severity=ValidationSeverity.LOW,
                section_key="risks_and_mitigations",
                title=f"Missing Risk Impact Level: {risk_label}",
                message=f"Risk {risk_label} has no severity/impact rating.",
                suggestion="Assign impact level: Critical, High, Medium, or Low.",
            )

    # -------------------------------------------------------------------------
    # Requirement Retrieval Helpers
    # -------------------------------------------------------------------------
    def _get_functional_requirements(self) -> List[Dict[str, Any]]:
        structured_prd = self.prd.get("structured_prd") or self.prd.get("structuredPrd") or {}
        if isinstance(structured_prd, dict) and "functional_requirements" in structured_prd:
            reqs = structured_prd["functional_requirements"]
            if isinstance(reqs, list):
                return [r if isinstance(r, dict) else {"description": str(r)} for r in reqs]

        # Check raw markdown sections
        sections = self.prd.get("sections") or {}
        if isinstance(sections, dict):
            text = sections.get("functionalRequirements") or sections.get("functional_requirements") or ""
            if text and isinstance(text, str):
                lines = [l.strip() for l in text.split("\n") if l.strip().startswith("-") or l.strip().startswith("[")]
                return [{"description": l, "title": l[:50]} for l in lines]
        return []

    def _get_non_functional_requirements(self) -> List[Dict[str, Any]]:
        structured_prd = self.prd.get("structured_prd") or self.prd.get("structuredPrd") or {}
        if isinstance(structured_prd, dict) and "non_functional_requirements" in structured_prd:
            reqs = structured_prd["non_functional_requirements"]
            if isinstance(reqs, list):
                return [r if isinstance(r, dict) else {"description": str(r)} for r in reqs]

        sections = self.prd.get("sections") or {}
        if isinstance(sections, dict):
            text = sections.get("nonFunctionalRequirements") or sections.get("non_functional_requirements") or ""
            if text and isinstance(text, str):
                lines = [l.strip() for l in text.split("\n") if l.strip().startswith("-") or l.strip().startswith("[")]
                return [{"description": l, "title": l[:50]} for l in lines]
        return []

    def _get_all_requirements(self) -> List[Dict[str, Any]]:
        return self._get_functional_requirements() + self._get_non_functional_requirements()


def validate_product_plan(
    prd_data: Dict[str, Any],
    feature_group: Optional[Any] = None,
    workspace_feedback_ids: Optional[Set[str]] = None,
    workspace_id: Optional[str] = None,
) -> PRDValidationResult:
    """Convenience function running PRDValidator and returning structured report."""
    validator = PRDValidator(
        prd_data=prd_data,
        feature_group=feature_group,
        workspace_feedback_ids=workspace_feedback_ids,
        workspace_id=workspace_id,
    )
    return validator.validate_all()
