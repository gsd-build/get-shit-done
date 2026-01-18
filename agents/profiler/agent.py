"""
Data Profiler Agent using Strands Agents SDK.

This agent profiles data tables and detects anomalies using:
- ydata-profiling for comprehensive statistical analysis
- Custom anomaly detection for outliers, null rates, and cardinality

Usage:
    from agents.profiler.agent import profiler_agent

    response = profiler_agent(
        "Profile the orders table in the analytics database on Redshift"
    )
"""

# Import tools - support both package and direct execution
try:
    from .tools.profiler import profile_table
    from .tools.anomaly import detect_anomalies
except ImportError:
    from agents.profiler.tools.profiler import profile_table
    from agents.profiler.tools.anomaly import detect_anomalies


# Strands agent configuration
SYSTEM_PROMPT = """You are a Data Profiler Agent that analyzes data tables and provides insights.

Your capabilities:
1. **Profile Tables**: Use the profile_table tool to generate statistical profiles of data tables.
   This includes row counts, column types, null rates, distinct values, and distribution statistics.

2. **Detect Anomalies**: Use the detect_anomalies tool to identify data quality issues like:
   - High null rates (>20% missing values)
   - Outliers detected via z-score or IQR methods
   - High cardinality in categorical columns
   - Single value dominance

When asked to profile a table:
1. First use profile_table to get the statistical profile
2. Then use detect_anomalies to identify any data quality issues
3. Summarize your findings with:
   - Key statistics (row count, columns, missing data)
   - Notable anomalies or concerns
   - Recommendations for data quality improvements

Always provide actionable insights, not just raw statistics.

Connection Parameters Format:
- Iceberg: {"region": "us-east-1"}
- Redshift: {"workgroup": "workgroup-name", "region": "us-east-1"}
- Athena: {"output_location": "s3://bucket/path/", "region": "us-east-1"}
"""


def create_profiler_agent():
    """
    Create and return the profiler agent instance.

    Returns:
        Strands Agent configured for data profiling

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

    # Configure Bedrock model
    model = BedrockModel(
        model_id="anthropic.claude-sonnet-4-20250514",
        region_name="us-east-1",
    )

    # Create agent with tools
    agent = Agent(
        model=model,
        system_prompt=SYSTEM_PROMPT,
        tools=[profile_table, detect_anomalies],
    )

    return agent


# Create the agent instance for import
# Lazy loading to avoid import errors when strands is not installed
_agent_instance = None


def get_profiler_agent():
    """Get or create the profiler agent instance (lazy loading)."""
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = create_profiler_agent()
    return _agent_instance


# For backward compatibility and simpler imports
class ProfilerAgentProxy:
    """
    Proxy class that lazily loads the agent on first call.

    This allows the module to be imported even if strands is not installed,
    failing only when the agent is actually used.
    """

    def __init__(self):
        self._agent = None

    def _get_agent(self):
        if self._agent is None:
            self._agent = create_profiler_agent()
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
profiler_agent = ProfilerAgentProxy()

__all__ = ["profiler_agent", "create_profiler_agent", "get_profiler_agent"]
