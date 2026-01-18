"""
DQ Recommender Agent using Strands Agents SDK.

This agent generates data quality rules from natural language with:
- AI-powered DQDL rule generation using Bedrock Claude
- AWS Glue Data Quality ML recommendations
- Industry-standard rule templates
- Remediation suggestions for quality issues

Usage:
    from agents.dq_recommender.agent import dq_recommender_agent

    response = dq_recommender_agent(
        "Generate a rule to ensure the email column contains valid email addresses"
    )
"""

# Import tools - support both package and direct execution
try:
    from .tools.rule_generator import generate_dqdl_rule
    from .tools.glue_recommender import get_glue_recommendations, check_recommendation_status
    from .tools.template_library import apply_rule_template, list_templates
    from .tools.remediation import suggest_remediation
    from .prompts import SYSTEM_PROMPT
except ImportError:
    from agents.dq_recommender.tools.rule_generator import generate_dqdl_rule
    from agents.dq_recommender.tools.glue_recommender import get_glue_recommendations, check_recommendation_status
    from agents.dq_recommender.tools.template_library import apply_rule_template, list_templates
    from agents.dq_recommender.tools.remediation import suggest_remediation
    from agents.dq_recommender.prompts import SYSTEM_PROMPT


def create_dq_recommender_agent():
    """
    Create and return the DQ Recommender agent instance.

    Returns:
        Strands Agent configured for data quality rule recommendation

    Raises:
        ImportError: If strands-agents is not installed
    """
    try:
        from strands import Agent
        from strands.models.bedrock import BedrockModel
    except ImportError as e:
        raise ImportError(
            "strands-agents not installed. Run: pip install strands-agents>=1.0.0"
        ) from e

    # Configure Bedrock model with low temperature for consistent output
    model = BedrockModel(
        model_id="anthropic.claude-sonnet-4-20250514",
        region_name="us-east-1",
        temperature=0.2,  # Low temperature for consistent rule generation
    )

    # Create agent with all DQ recommendation tools
    agent = Agent(
        model=model,
        system_prompt=SYSTEM_PROMPT,
        tools=[
            generate_dqdl_rule,
            get_glue_recommendations,
            check_recommendation_status,
            apply_rule_template,
            list_templates,
            suggest_remediation,
        ],
    )

    return agent


# Lazy loading support
_agent_instance = None


def get_dq_recommender_agent():
    """Get or create the DQ Recommender agent instance (lazy loading)."""
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = create_dq_recommender_agent()
    return _agent_instance


class DQRecommenderAgentProxy:
    """
    Proxy class that lazily loads the agent on first call.

    This allows the module to be imported even if strands is not installed,
    failing only when the agent is actually used.
    """

    def __init__(self):
        self._agent = None

    def _get_agent(self):
        if self._agent is None:
            self._agent = create_dq_recommender_agent()
        return self._agent

    def __call__(self, prompt: str, **kwargs):
        """Run the agent with a prompt."""
        return self._get_agent()(prompt, **kwargs)

    @property
    def tools(self):
        """Access agent's tools."""
        return self._get_agent().tools

    def __getattr__(self, name):
        """Delegate attribute access to the underlying agent."""
        return getattr(self._get_agent(), name)


# Export the proxy as the agent
dq_recommender_agent = DQRecommenderAgentProxy()

__all__ = [
    "dq_recommender_agent",
    "create_dq_recommender_agent",
    "get_dq_recommender_agent",
]
