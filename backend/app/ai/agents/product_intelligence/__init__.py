"""
ProductMind AI — Executive Briefing Agent Module
"""

from app.ai.agents.product_intelligence.agent import ProductIntelligenceAgent
from app.ai.agents.product_intelligence.schemas import (
    ExecutiveBriefingRequest,
    ExecutiveBriefingResponse,
    ExecutiveBriefingResult,
    StrategicRecommendation,
)

__all__ = [
    "ProductIntelligenceAgent",
    "ExecutiveBriefingRequest",
    "ExecutiveBriefingResponse",
    "ExecutiveBriefingResult",
    "StrategicRecommendation",
]
