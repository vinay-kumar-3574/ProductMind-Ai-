"""
ProductMind AI — Executive Briefing Agent Implementation
Specialist agent synthesizing cross-domain deterministic metrics into an executive briefing.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional, Type
from langchain_core.messages import HumanMessage, SystemMessage

from app.ai.agents.base import BaseAgent
from app.ai.agents.product_intelligence.prompts import (
    EXECUTIVE_BRIEFING_SYSTEM_PROMPT,
    format_executive_briefing_prompt,
)
from app.ai.agents.product_intelligence.schemas import ExecutiveBriefingResult
from app.ai.llm_service import LLMService

logger = logging.getLogger("productmind.ai.agent.executive_briefing")


class ProductIntelligenceAgent(BaseAgent[ExecutiveBriefingResult]):
    """
    Product Intelligence Executive Briefing Agent.
    Transforms deterministic cross-domain indicators into an actionable executive summary.
    """

    def __init__(self, llm_service: Optional[LLMService] = None):
        super().__init__(llm_service=llm_service)

    @property
    def agent_id(self) -> str:
        return "product_intelligence_agent"

    @property
    def agent_name(self) -> str:
        return "Executive Product Intelligence Briefing Agent"

    @property
    def agent_version(self) -> str:
        return "1.0.0"

    @property
    def description(self) -> str:
        return (
            "Synthesizes deterministic cross-domain metrics into an evidence-backed "
            "executive product briefing with strategic recommendations."
        )

    @property
    def prompt_template(self):
        return None

    @property
    def output_schema(self) -> Type[ExecutiveBriefingResult]:
        return ExecutiveBriefingResult

    def _build_messages(self, prompt_context: Dict[str, Any]) -> list:
        user_prompt = format_executive_briefing_prompt(prompt_context)
        return [
            SystemMessage(content=EXECUTIVE_BRIEFING_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ]

    async def generate_briefing(self, metrics_summary: Dict[str, Any]) -> ExecutiveBriefingResult:
        """Executes bounded briefing synthesis with strict zero-fabrication guarantees."""
        messages = self._build_messages(metrics_summary)
        result = await self.llm_service.generate_structured(
            messages=messages,
            response_schema=ExecutiveBriefingResult,
            temperature=0.2,
            max_output_tokens=600,
        )
        return result
