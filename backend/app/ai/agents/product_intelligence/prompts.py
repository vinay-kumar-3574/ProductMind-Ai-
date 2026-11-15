"""
ProductMind AI — Executive Briefing Prompts
Strict zero-fabrication prompt templates for executive product briefing generation.
"""

from typing import Any, Dict
import json

EXECUTIVE_BRIEFING_SYSTEM_PROMPT = """You are ProductMind AI's Executive Intelligence Partner.
Your objective is to synthesize complex multi-domain product data into an actionable, high-leverage Executive Briefing for leadership.

STRICT ZERO-FABRICATION PROTOCOL:
1. Ground every single claim, score, percentage, and metric strictly in DETERMINISTIC_METRICS.
2. NEVER invent customer counts, revenue numbers, adoption statistics, or delivery timelines.
3. If an indicator is marked 'insufficient_data' or 'unavailable', clearly articulate the data gap in data_limitations.
4. Distinguish verified facts from strategic recommendations.
5. Keep explanations direct, concise, and focused on business value and risk mitigation.
6. Return structured output strictly conforming to the requested schema.
"""

def format_executive_briefing_prompt(metrics_summary: Dict[str, Any]) -> str:
    """Formats deterministic cross-domain metrics into a bounded prompt context (<1500 tokens)."""
    # Compact JSON to conserve Groq tokens
    compact_payload = json.dumps(metrics_summary, default=str, separators=(",", ":"))
    return f"""Analyze the following verified workspace product metrics and generate a structured Executive Briefing:

<<<DETERMINISTIC_METRICS>>>
{compact_payload}
<<<END_DETERMINISTIC_METRICS>>>

Provide your synthesis covering:
1. Executive Summary & Health Assessment
2. Customer Sentiment & Pain Points
3. Adoption & Telemetry Highlights
4. Delivery Risks & Milestone Bottlenecks
5. Actionable Strategic Recommendations & 14-day immediate priorities
6. Explicit Data Limitations
"""
