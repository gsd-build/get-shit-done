"""
DQ Recommender Agent Package.

Provides AI-powered data quality rule recommendations using:
- Natural language to DQDL rule generation
- AWS Glue Data Quality ML recommendations
- Industry-standard rule templates
- Remediation suggestions for quality issues
"""

from .agent import dq_recommender_agent, create_dq_recommender_agent, get_dq_recommender_agent
from .schemas import (
    RuleType,
    Severity,
    RuleStatus,
    DQRule,
    RuleGenerationRequest,
    RuleGenerationResponse,
    RuleTemplate,
    RemediationSuggestion,
)

__all__ = [
    # Agent
    "dq_recommender_agent",
    "create_dq_recommender_agent",
    "get_dq_recommender_agent",
    # Schemas
    "RuleType",
    "Severity",
    "RuleStatus",
    "DQRule",
    "RuleGenerationRequest",
    "RuleGenerationResponse",
    "RuleTemplate",
    "RemediationSuggestion",
]
