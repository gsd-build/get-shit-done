"""
Rule Generator Tool for the DQ Recommender Agent.

Generates DQDL rules from natural language descriptions using
Amazon Bedrock Converse API with Claude.
"""

import json
import boto3
from typing import Optional

# DQDL syntax reference embedded in prompts
DQDL_SYNTAX_PROMPT = """
DQDL (Data Quality Definition Language) Syntax Reference:

COMPLETENESS:
- IsComplete "column" - All values non-null

UNIQUENESS:
- IsUnique "column" - All values unique

NUMERIC COMPARISONS:
- ColumnValues "col" > X
- ColumnValues "col" >= X
- ColumnValues "col" < X
- ColumnValues "col" <= X
- ColumnValues "col" = X
- ColumnValues "col" between X and Y

SET MEMBERSHIP:
- ColumnValues "col" in ["a", "b", "c"]
- ColumnValues "col" not in ["x", "y"]

PATTERN MATCHING:
- ColumnValues "col" matches "regex"
  (Use double backslash for regex escapes)

FRESHNESS:
- DataFreshness "date_col" <= N hours
- DataFreshness "date_col" <= N days

REFERENTIAL INTEGRITY:
- ReferentialIntegrity "col" "ref_table.ref_col"

AGGREGATE:
- RowCount > X
- RowCount between X and Y
"""


def _get_bedrock_client(region: str = "us-east-1"):
    """Get or create Bedrock runtime client."""
    return boto3.client("bedrock-runtime", region_name=region)


def generate_dqdl_rule(
    description: str,
    column_name: str,
    profile_summary: str
) -> str:
    """
    Generate a DQDL rule from a natural language description.

    Uses Amazon Bedrock Converse API with Claude to generate rules
    based on the user's description and column profile data.

    Args:
        description: Natural language description of the quality rule
        column_name: The column to validate
        profile_summary: JSON string with column statistics from profiling

    Returns:
        JSON string with:
        - rule: DQDL rule syntax
        - reasoning: Explanation of why this rule is appropriate
        - false_positive_scenarios: List of potential false positive cases
        - severity: Recommended severity (critical, warning, info)
    """
    # Parse profile summary
    try:
        profile = json.loads(profile_summary) if isinstance(profile_summary, str) else profile_summary
    except json.JSONDecodeError:
        profile = {"error": "Could not parse profile summary"}

    # System prompt for rule generation
    system_prompt = f"""You are a data quality expert that generates DQDL rules.

{DQDL_SYNTAX_PROMPT}

IMPORTANT:
- Output ONLY valid JSON, no markdown code blocks
- Use double backslashes for regex escapes (e.g., \\\\d instead of \\d)
- The rule must be valid DQDL syntax
- Provide actionable reasoning based on the profile data
- Identify realistic false positive scenarios
"""

    # User message with context
    user_message = f"""Generate a DQDL rule for this requirement:

**Description:** {description}
**Column:** {column_name}
**Profile Data:**
```json
{json.dumps(profile, indent=2)}
```

Respond with a JSON object (no markdown, just raw JSON):
{{
    "rule": "DQDL rule syntax here",
    "reasoning": "Why this rule is appropriate given the profile data",
    "false_positive_scenarios": ["scenario1", "scenario2"],
    "severity": "critical|warning|info"
}}"""

    try:
        client = _get_bedrock_client()

        response = client.converse(
            modelId="anthropic.claude-sonnet-4-20250514",
            messages=[
                {
                    "role": "user",
                    "content": [{"text": user_message}]
                }
            ],
            system=[{"text": system_prompt}],
            inferenceConfig={
                "maxTokens": 1024,
                "temperature": 0.2  # Low temperature for consistent output
            }
        )

        # Extract response text
        result_text = response["output"]["message"]["content"][0]["text"]

        # Parse JSON response
        try:
            result = json.loads(result_text)
            return json.dumps({
                "success": True,
                "rule": result.get("rule", ""),
                "reasoning": result.get("reasoning", ""),
                "false_positive_scenarios": result.get("false_positive_scenarios", []),
                "severity": result.get("severity", "warning"),
                "column": column_name
            })
        except json.JSONDecodeError:
            # If response isn't valid JSON, return as-is with error flag
            return json.dumps({
                "success": False,
                "error": "Failed to parse LLM response as JSON",
                "raw_response": result_text,
                "column": column_name
            })

    except Exception as e:
        return json.dumps({
            "success": False,
            "error": f"Bedrock API error: {str(e)}",
            "column": column_name
        })


# Make generate_dqdl_rule a Strands tool
try:
    from strands import tool
    generate_dqdl_rule = tool(generate_dqdl_rule)
except ImportError:
    # Allow module to work without strands for testing
    pass
