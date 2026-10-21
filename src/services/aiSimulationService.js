import { calculatePriorityScore, FACTOR_WEIGHTS } from '../data/scoringFormulas'

const POSITIVE_KEYWORDS = [
  'love', 'great', 'fast', 'smooth', 'sleek', 'impressive', 'remarkable', 'lifesaver',
  'helpful', 'spot on', 'outstanding', 'excellent', 'clean', 'intuitive', 'saved', 'perfect', 'awesome'
]

const NEGATIVE_KEYWORDS = [
  'slow', 'lag', 'stutter', 'latency', 'broken', 'timeout', 'freeze', 'crash', 'fail',
  'steep', 'bug', 'error', 'confusing', 'expensive', 'hurts', 'lacks', 'fear', 'accidental', 'loss'
]

const CATEGORY_MAP = {
  Performance: ['slow', 'lag', 'stutter', 'latency', 'speed', 'fast', 'virtual', 'render', 'memory', 'freeze'],
  Integrations: ['jira', 'linear', 'slack', 'webhook', 'api', 'sync', 'export', 'github', 'sso', 'saml'],
  Usability: ['confusing', 'ui', 'ux', 'drag', 'layout', 'intuitive', 'navigation', 'color', 'contrast', 'touchpoint'],
  Reliability: ['crash', 'timeout', 'bug', 'lost', 'save', 'auto-save', 'error', 'fail', 'outage', 'security', 'gate'],
  Pricing: ['price', 'pricing', 'tier', 'freemium', 'cost', 'expensive', 'license', 'seat', 'bill'],
  Satisfaction: ['love', 'impressive', 'lifesaver', 'remarkable', 'great', 'awesome', 'spot on'],
}

export function analyzeSentiment(text = '') {
  const lower = text.toLowerCase()
  let posCount = 0
  let negCount = 0

  POSITIVE_KEYWORDS.forEach(kw => {
    if (lower.includes(kw)) posCount++
  })

  NEGATIVE_KEYWORDS.forEach(kw => {
    if (lower.includes(kw)) negCount++
  })

  if (negCount > posCount) return 'Negative'
  if (posCount > negCount) return 'Positive'
  return 'Neutral'
}

export function predictCategory(text = '') {
  const lower = text.toLowerCase()
  let bestCategory = 'Feature Requests'
  let highestMatch = 0

  Object.entries(CATEGORY_MAP).forEach(([category, keywords]) => {
    let matches = 0
    keywords.forEach(kw => {
      if (lower.includes(kw)) matches++
    })
    if (matches > highestMatch) {
      highestMatch = matches
      bestCategory = category
    }
  })

  return bestCategory
}

export function generateSmartTags(title = '', desc = '') {
  const text = `${title} ${desc}`.toLowerCase()
  const detected = new Set()

  const tagRules = [
    { tag: 'performance', keywords: ['slow', 'lag', 'render', 'latency', 'virtual'] },
    { tag: 'integrations', keywords: ['jira', 'linear', 'slack', 'webhook', 'sync'] },
    { tag: 'ui-ux', keywords: ['contrast', 'drag', 'layout', 'dark-mode', 'modal', 'table'] },
    { tag: 'scalability', keywords: ['5k', '10k', 'dataset', 'volume', 'enterprise'] },
    { tag: 'reliability', keywords: ['timeout', 'loss', 'auto-save', 'backup', 'crash'] },
    { tag: 'pricing', keywords: ['tier', 'license', 'viewer', 'seat', 'price'] },
    { tag: 'ai-nlp', keywords: ['ai', 'tagging', 'smart', 'copilot', 'nlp', 'prediction'] },
    { tag: 'roadmap', keywords: ['timeline', 'gantt', 'schedule', 'milestone'] },
    { tag: 'security', keywords: ['sso', 'saml', 'compliance', 'gate', 'audit'] },
  ]

  tagRules.forEach(rule => {
    if (rule.keywords.some(kw => text.includes(kw))) {
      detected.add(rule.tag)
    }
  })

  if (detected.size === 0) {
    detected.add('product-feedback')
    detected.add('general')
  }

  return Array.from(detected).slice(0, 4)
}

/**
 * Tokenize and compute Jaccard similarity for duplicate detection
 */
export function detectDuplicates(newTitle = '', newDesc = '', existingList = []) {
  const stopWords = new Set(['the', 'and', 'is', 'in', 'it', 'to', 'for', 'with', 'a', 'on', 'that', 'our', 'this'])
  
  function getTokens(str) {
    return new Set(
      str.toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w))
    )
  }

  const queryTokens = getTokens(`${newTitle} ${newDesc}`)
  if (queryTokens.size === 0) return []

  const matches = []

  existingList.forEach(item => {
    const itemTokens = getTokens(`${item.title} ${item.description}`)
    if (itemTokens.size === 0) return

    let intersection = 0
    queryTokens.forEach(t => {
      if (itemTokens.has(t)) intersection++
    })

    const union = new Set([...queryTokens, ...itemTokens]).size
    const similarity = intersection / union

    if (similarity >= 0.28) {
      matches.push({
        feedback: item,
        similarity: Math.round(similarity * 100)
      })
    }
  })

  return matches.sort((a, b) => b.similarity - a.similarity)
}

/**
 * Synthesizes actionable AI insights from actual local state
 */
export function synthesizeInsights(feedbackList = [], featuresList = []) {
  const insights = []

  // 1. Critical Performance/Reliability check
  const urgentNegative = feedbackList.filter(f => f.priority === 'Urgent' && f.sentiment === 'Negative')
  if (urgentNegative.length > 0) {
    insights.push({
      id: 'ins-urgent-perf',
      title: 'High-Urgency Performance & Scalability Cluster',
      severity: 'critical',
      category: 'Performance',
      summary: `${urgentNegative.length} urgent negative feedback items report table latency and UI stalling on large datasets. Direct customer retention risk identified for enterprise tiers.`,
      evidenceCount: urgentNegative.length,
      supportingFeedbackIds: urgentNegative.map(f => f.id),
      recommendation: 'Prioritize feature "High-Performance Virtualized Data Grid" into current sprint to prevent enterprise customer churn.',
      associatedFeatureId: 'feat-1'
    })
  }

  // 2. Integration Demand Spike
  const integrationFeedback = feedbackList.filter(f => f.category === 'Integrations')
  if (integrationFeedback.length >= 2) {
    insights.push({
      id: 'ins-integrations',
      title: 'Recurring Demand for Bi-directional Engineering Sync',
      severity: 'high',
      category: 'Integrations',
      summary: `Frequent requests for Jira, Linear, and Slack webhooks to prevent double data entry between PRDs and engineering task tracking boards.`,
      evidenceCount: integrationFeedback.length,
      supportingFeedbackIds: integrationFeedback.map(f => f.id),
      recommendation: 'Accelerate "Bi-directional Jira & Linear Integration Engine" design specifications to Q4 delivery.',
      associatedFeatureId: 'feat-2'
    })
  }

  // 3. Positive Feature Adoption Sentiment
  const positiveAITagging = feedbackList.filter(f => f.sentiment === 'Positive' && (f.title.includes('Tagging') || f.title.includes('AI') || f.title.includes('Presentation')))
  if (positiveAITagging.length > 0) {
    insights.push({
      id: 'ins-ai-satisfaction',
      title: 'High Customer Satisfaction with AI Automation Tools',
      severity: 'info',
      category: 'Satisfaction',
      summary: `Customers report saving up to 8 hours per sprint utilizing automated smart tagging and executive presentation slide generators.`,
      evidenceCount: positiveAITagging.length,
      supportingFeedbackIds: positiveAITagging.map(f => f.id),
      recommendation: 'Expand simulated AI capabilities into automatic PRD generation and Copilot conversational summaries.',
      associatedFeatureId: 'feat-3'
    })
  }

  // 4. Release Gating Governance Alert
  const releaseBlockerFeedback = feedbackList.filter(f => f.tags?.includes('release-readiness') || f.title.includes('checklist'))
  if (releaseBlockerFeedback.length > 0) {
    insights.push({
      id: 'ins-release-gating',
      title: 'Governance Risk: Incomplete Release Readiness Quality Gates',
      severity: 'high',
      category: 'Reliability',
      summary: `Enterprise customers require rigorous Go/No-Go release checklists that strictly enforce unresolved bug thresholds before shipping.`,
      evidenceCount: releaseBlockerFeedback.length,
      supportingFeedbackIds: releaseBlockerFeedback.map(f => f.id),
      recommendation: 'Enable hard checklist gates on the Release Readiness center before greenlighting v2.4.0.',
      associatedFeatureId: 'feat-10'
    })
  }

  // 5. Pricing Transparency Opportunity
  const pricingFeedback = feedbackList.filter(f => f.category === 'Pricing')
  if (pricingFeedback.length > 0) {
    insights.push({
      id: 'ins-pricing-tiers',
      title: 'Monetization Friction: Stakeholder Viewer Seat Limits',
      severity: 'medium',
      category: 'Pricing',
      summary: `Prospects and existing customers seek free or low-cost viewer licenses for cross-functional stakeholders (Sales, Support, Execs) to view roadmaps.`,
      evidenceCount: pricingFeedback.length,
      supportingFeedbackIds: pricingFeedback.map(f => f.id),
      recommendation: 'Introduce unlimited read-only viewer roles in v2.5.0 to accelerate virality and bottom-up expansion.',
      associatedFeatureId: 'feat-8'
    })
  }

  return insights
}

/**
 * Generate a complete 13-section PRD from feature inputs
 */
export function generatePRDTemplate(feature, customTitle = null) {
  const name = customTitle || feature?.name || 'Untitled Feature Initiative'
  const desc = feature?.description || 'Implement modern enhancements to drive product engagement.'
  const score = feature?.score || calculatePriorityScore(feature || { customerImpact: 7, urgency: 7, demand: 7, businessValue: 7 })

  return {
    overview: `This Product Requirements Document (PRD) outlines the scope, technical architecture, and validation strategy for "${name}". With a calculated priority score of ${score}/10, this initiative addresses core customer pain points while delivering measurable business value.`,
    problemStatement: `Customers currently experience friction around: "${desc}". This limitation creates operational delays, increased support overhead, and limits adoption among scaling teams.`,
    targetUsers: 'Primary users: Lead Product Managers, Product Operations Specialists, Engineering Leads, and Executive Stakeholders.',
    customerPainPoints: '1. Inefficient manual workflows and redundant copy-pasting.\n2. Lack of transparent data visibility and auditability.\n3. Risk of human error during high-velocity sprint cycles.',
    proposedSolution: `Deliver an intuitive, reliable solution: "${desc}". The implementation prioritizes sub-second responsiveness, resilient local state caching, and seamless cross-module interoperability.`,
    goalsAndSuccessMetrics: '1. Reduce task completion time by at least 45%.\n2. Maintain 99.9% client-side stability without memory leaks.\n3. Achieve >85% positive customer CSAT on feature feedback.',
    functionalRequirements: `1. Implement dedicated UI view and keyboard accessible controls for "${name}".\n2. Provide real-time validation, undo state restoration, and export capabilities.\n3. Integrate status updates with executive roadmap milestones.`,
    nonFunctionalRequirements: '1. Bundle overhead < 20KB gzipped.\n2. Sub-50ms user interaction response time.\n3. Fully compatible with light and dark mode design tokens.',
    userStories: `1. As a user, I want to interact with "${name}" so that I can streamline my day-to-day product operations.\n2. As an executive, I want to view progress on this initiative so that I can accurately forecast release milestones.`,
    acceptanceCriteria: '1. All primary user journeys function with zero unhandled exceptions.\n2. Automated unit and integration tests pass with >90% coverage.\n3. Keyboard shortcuts and screen-reader accessibility verified.',
    dependenciesAndConstraints: 'Requires browser localStorage support and modern flex/grid rendering. Operates completely client-side without external API reliance.',
    risksAndMitigations: 'Risk: User confusion during initial rollout. Mitigation: Provide contextual guided tooltip tour and 1-click sample presets.',
    releasePlan: `Scheduled for targeted rollout in release ${feature?.targetRelease || 'v2.4.0'}. Staged deployment with preview feedback collection.`
  }
}

/**
 * Deterministic AI Copilot conversation engine that draws upon live application data
 */
export function queryCopilot(userPrompt, context) {
  const query = userPrompt.toLowerCase().trim()
  const { feedback = [], features = [], prds = [], roadmap = [], releases = [], experiments = [] } = context

  // 1. Summarize customer feedback
  if (query.includes('summarize') && query.includes('feedback')) {
    const total = feedback.length
    const pos = feedback.filter(f => f.sentiment === 'Positive').length
    const neg = feedback.filter(f => f.sentiment === 'Negative').length
    const neu = feedback.filter(f => f.sentiment === 'Neutral').length
    const urgent = feedback.filter(f => f.priority === 'Urgent').length

    return `### Customer Feedback Executive Summary

Currently analyzing **${total} verified feedback records** from your workspace:

- **Sentiment Breakdown**:
  - Positive: **${pos}** (${Math.round((pos / (total || 1)) * 100)}%)
  - Negative: **${neg}** (${Math.round((neg / (total || 1)) * 100)}%)
  - Neutral: **${neu}** (${Math.round((neu / (total || 1)) * 100)}%)
- **High-Urgency Complaints**: **${urgent} critical items**

**Key Strategic Takeaways:**
1. **Performance Triage**: Top complaint is virtualized table rendering when scrolling large feedback sets.
2. **Integration Momentum**: Strong customer appetite for bi-directional Jira/Linear sync to eliminate manual PRD handoff.
3. **High Feature Satisfaction**: Users praise the AI Smart Tagging engine and Executive Presentation Mode.

*Suggested Action*: Review the **High-Performance Virtual Grid** feature (Score: 8.65) scheduled for the v2.4.0 release.`
  }

  // 2. Identify biggest pain points
  if (query.includes('pain point') || query.includes('biggest problem') || query.includes('complaint')) {
    const negList = feedback.filter(f => f.sentiment === 'Negative').slice(0, 3)
    let details = negList.map((item, idx) => `**${idx + 1}. ${item.title}**\n- *Customer*: ${item.customer} (${item.company})\n- *Category*: ${item.category} | *Priority*: ${item.priority}\n- *Quote*: "${item.description.slice(0, 140)}..."`).join('\n\n')

    return `### Critical Customer Pain Points Identified

Analyzing negative feedback clusters with highest urgency:

${details}

**Recommended Immediate Remediation:**
1. Advance **High-Performance Virtual Grid** (feat-1) to reduce table latency.
2. Enforce strict **Release Readiness Quality Gates** (feat-10) before greenlighting new deployments.`
  }

  // 3. Recommend features to prioritize
  if (query.includes('prioritize') || query.includes('recommend feature') || query.includes('top feature')) {
    const sorted = [...features].sort((a, b) => b.score - a.score).slice(0, 3)
    
    let table = `| Rank | Feature Name | Score | Impact (35%) | Urgency (30%) | Demand (20%) | Value (15%) | Status |\n|---|---|---|---|---|---|---|---|\n`
    sorted.forEach((f, idx) => {
      table += `| #${idx + 1} | ${f.name} | **${f.score.toFixed(2)}** | ${f.customerImpact}/10 | ${f.urgency}/10 | ${f.demand}/10 | ${f.businessValue}/10 | ${f.status} |\n`
    })

    return `### Top Priority Feature Recommendations

Based on the exact formula:
$$\\text{Priority Score} = (0.35 \\times \\text{Impact}) + (0.30 \\times \\text{Urgency}) + (0.20 \\times \\text{Demand}) + (0.15 \\times \\text{Value})$$

Here are your highest-ranked initiatives:

${table}

**Strategic Rationale:**
- **${sorted[0]?.name}** holds the top rank due to its heavy impact and urgency combination.
- Prioritizing these top 3 ensures optimal allocation of engineering velocity against direct customer demand.`
  }

  // 4. Generate PRD outline
  if (query.includes('prd') || query.includes('requirements document')) {
    return `### Standard 13-Section PRD Architecture Outline

Here is the structured template configured in your **PRD Generator**:

1. **Overview**: Executive summary, vision statement, and calculated priority score.
2. **Problem Statement**: Specific friction points and quantified operational drag.
3. **Target Users**: Key personas (e.g., Enterprise IT Director, Lead PM, Staff Engineer).
4. **Customer Pain Points**: Verbatim customer quotes and triage findings.
5. **Proposed Solution**: Architectural blueprint and user flow.
6. **Goals & Success Metrics**: Concrete OKRs and quantifiable KPI targets.
7. **Functional Requirements**: Granular capability breakdown and user inputs.
8. **Non-Functional Requirements**: Latency (<50ms), accessibility (ARIA), security.
9. **User Stories**: Role-based agile stories (As a PM, I want...).
10. **Acceptance Criteria**: Pass/fail criteria for engineering handoff.
11. **Dependencies & Constraints**: Client-side storage boundaries and browser APIs.
12. **Risks & Mitigations**: Edge-case failure modes and contingency plans.
13. **Release Plan**: Staged rollout timeline, feature flags, and Go/No-Go checkpoints.

*Tip*: You can click **PRD Generator** in the sidebar to auto-generate a full draft for any feature in 1 click!`
  }

  // 5. Analyze customer sentiment
  if (query.includes('sentiment')) {
    const total = feedback.length || 1
    const pos = feedback.filter(f => f.sentiment === 'Positive').length
    const neg = feedback.filter(f => f.sentiment === 'Negative').length
    const neu = feedback.filter(f => f.sentiment === 'Neutral').length
    const csat = ((pos + neu * 0.5) / total * 5).toFixed(1)

    return `### Customer Sentiment Intelligence

- **Estimated Customer Satisfaction (CSAT)**: **${csat} / 5.0**
- **Positive Sentiment Ratio**: **${Math.round((pos / total) * 100)}%**
- **Negative Sentiment Ratio**: **${Math.round((neg / total) * 100)}%**
- **Neutral / Informational**: **${Math.round((neu / total) * 100)}%**

**Observation:**
Positive sentiment is driven primarily by modern UI features (AI Smart Tagging, Executive Presentation Mode, What-If Simulator).
Negative sentiment is confined strictly to Performance (table render speed) and Pricing clarity (viewer seat licensing).`
  }

  // 6. Suggest roadmap improvements
  if (query.includes('roadmap')) {
    const inProgress = roadmap.filter(r => r.status === 'In Progress').length
    const planned = roadmap.filter(r => r.status === 'Planned').length
    const shipped = roadmap.filter(r => r.status === 'Shipped').length

    return `### Roadmap Velocity & Strategic Recommendations

- **Active Roadmap Items**: ${roadmap.length} total (${inProgress} In Progress, ${planned} Planned, ${shipped} Shipped)

**Strategic Recommendations:**
1. **Unblock Critical Dependencies**: Ensure *High-Performance Virtual Grid* (rd-1) finishes before *Automated Release Readiness Quality Gates* (rd-4).
2. **Balance Velocity with Technical Debt**: 75% of Q4 platform capacity is tied to performance improvements. Schedule Jira/Linear sync for early Q1 to avoid sprint overcrowding.
3. **Leverage Gantt Timeline**: Utilize drag-to-reschedule to calibrate sprint milestones before executive quarterly reviews.`
  }

  // 7. Explain feature scores
  if (query.includes('formula') || query.includes('score') || query.includes('weights')) {
    return `### Feature Prioritization Formula Explained

Product Mind AI uses a weighted multi-factor scoring model normalized on a 1–10 scale:

$$\\text{Priority Score} = (0.35 \\times \\text{Impact}) + (0.30 \\times \\text{Urgency}) + (0.20 \\times \\text{Demand}) + (0.15 \\times \\text{Business Value})$$

**Factor Weights Breakdown:**
- **Customer Impact (35%)**: Direct positive effect on user productivity, retention, and delight.
- **Urgency (30%)**: Criticality of resolving active blockers, outages, or compliance risks.
- **Customer Demand (20%)**: Volume of independent customer requests and ticket frequency.
- **Business Value (15%)**: Alignment with ARR growth, contract expansion, and enterprise deals.

All factors are rated from 1 to 10. The resulting priority score is also strictly bounded between 1.00 and 10.00.`
  }

  // 8. Identify release risks
  if (query.includes('release') || query.includes('risk') || query.includes('readiness')) {
    const activeRelease = releases[0]
    const incompleteChecks = activeRelease?.checklist?.filter(c => !c.completed) || []
    const requiredIncomplete = incompleteChecks.filter(c => c.required)

    return `### Release Readiness Risk Assessment

**Active Target Release**: ${activeRelease?.name || 'v2.4.0'} (${activeRelease?.version || 'v2.4.0'})
- **Planned Target Date**: ${activeRelease?.plannedDate || 'Upcoming'}
- **Outstanding Checklist Items**: ${incompleteChecks.length} total
- **Critical Gated Blockers**: **${requiredIncomplete.length} required checks remaining**

**Outstanding Required Quality Gates:**
${requiredIncomplete.map(c => `- ⚠️ **${c.title}**`).join('\n')}

**Go/No-Go Recommendation**: **NO-GO**. Gating policy strictly prohibits releasing until all required verification criteria are signed off.`
  }

  // Default helpful response
  return `### Product Intelligence Copilot

I can analyze your workspace data and generate actionable recommendations. Here are some queries you can ask me:

- *"Summarize customer feedback"* — High-level metrics and sentiment ratios.
- *"Identify the biggest customer pain points"* — Urgent issues requiring immediate engineering triage.
- *"Recommend features to prioritize"* — Top algorithmic feature rankings using the exact 4-factor formula.
- *"Generate a PRD outline"* — 13-section specification structure.
- *"Analyze customer sentiment"* — CSAT trends and category breakdowns.
- *"Suggest roadmap improvements"* — Milestone sequencing and dependency risks.
- *"Explain feature scores"* — Weight breakdown (35% Impact, 30% Urgency, 20% Demand, 15% Value).
- *"Identify release risks"* — Outstanding checklist gates on the active release candidate.`
}
