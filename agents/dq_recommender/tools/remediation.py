"""
Remediation Suggestions Tool for the DQ Recommender Agent.

Provides actionable remediation suggestions for detected data quality issues.
"""

import json
from typing import Optional

# Remediation suggestions by issue type
REMEDIATION_SUGGESTIONS = {
    "null_values": {
        "high_priority": [
            "Add NOT NULL constraint at source system if field is mandatory",
            "Implement default value in ETL pipeline for optional fields",
            "Configure source system validation to prevent null submissions"
        ],
        "medium_priority": [
            "Flag records with nulls for manual review if business-critical",
            "Exclude nulls from downstream aggregations with COALESCE",
            "Create data quality report for data steward review"
        ],
        "low_priority": [
            "Document acceptable null rate threshold in data contract",
            "Set up monitoring alert when null rate exceeds threshold"
        ]
    },
    "out_of_range": {
        "high_priority": [
            "Validate input at source system with range constraints",
            "Add CHECK constraint in database schema",
            "Implement range validation in ETL transformation"
        ],
        "medium_priority": [
            "Review business rules for valid value ranges",
            "Implement soft/hard bounds (warn vs reject)",
            "Create exception handling for edge cases"
        ],
        "low_priority": [
            "Document expected ranges in data dictionary",
            "Add monitoring for range violations"
        ]
    },
    "format_mismatch": {
        "high_priority": [
            "Standardize format at data ingestion point",
            "Add format validation in source application",
            "Implement format transformation in ETL pipeline"
        ],
        "medium_priority": [
            "Transform to canonical format before storage",
            "Handle multiple formats with regex alternatives",
            "Create data quality report for manual review"
        ],
        "low_priority": [
            "Document accepted formats in data contract",
            "Implement format suggestion/autocorrect at source"
        ]
    },
    "duplicate_values": {
        "high_priority": [
            "Implement unique constraint at database level",
            "Add deduplication logic in ETL pipeline",
            "Configure source system to prevent duplicates"
        ],
        "medium_priority": [
            "Review merge/upsert logic for race conditions",
            "Implement idempotent writes with conflict resolution",
            "Investigate data source for duplicate entries"
        ],
        "low_priority": [
            "Create deduplication cleanup job for historical data",
            "Document acceptable duplicate rate threshold"
        ]
    },
    "referential_integrity": {
        "high_priority": [
            "Add foreign key constraint if database supports it",
            "Validate reference exists before insert",
            "Implement cascade delete/update policy"
        ],
        "medium_priority": [
            "Create orphan record cleanup job",
            "Implement soft delete to preserve references",
            "Add validation step in ETL for reference checks"
        ],
        "low_priority": [
            "Document reference relationships in data model",
            "Create alerts for orphan record detection"
        ]
    },
    "outliers": {
        "high_priority": [
            "Validate input ranges at source system",
            "Implement outlier detection in ETL with rejection",
            "Review business rules for extreme values"
        ],
        "medium_priority": [
            "Flag outliers for manual review instead of rejection",
            "Apply winsorization for statistical analysis",
            "Investigate root cause of extreme values"
        ],
        "low_priority": [
            "Document expected distribution in data dictionary",
            "Set up monitoring for statistical anomalies"
        ]
    },
    "freshness": {
        "high_priority": [
            "Check source system for pipeline failures",
            "Verify scheduled jobs are running correctly",
            "Implement pipeline monitoring with alerts"
        ],
        "medium_priority": [
            "Review SLA requirements and adjust thresholds",
            "Add retry logic for transient failures",
            "Implement dead letter queue for failed records"
        ],
        "low_priority": [
            "Document freshness SLAs in data contract",
            "Create dashboard for data currency monitoring"
        ]
    },
    "high_cardinality": {
        "high_priority": [
            "Review if column should be categorical or free-text",
            "Implement value standardization (e.g., trim, lowercase)",
            "Check for data entry errors causing variations"
        ],
        "medium_priority": [
            "Create lookup table for valid values",
            "Implement fuzzy matching for similar values",
            "Review ETL for inconsistent transformations"
        ],
        "low_priority": [
            "Document expected cardinality in data dictionary",
            "Set up monitoring for cardinality drift"
        ]
    }
}


def suggest_remediation(
    issue_type: str,
    column_name: str,
    issue_details: str
) -> str:
    """
    Suggest remediation actions for detected data quality issues.

    Provides prioritized, actionable suggestions based on the issue type
    and specific context from the issue details.

    Args:
        issue_type: Type of issue detected
            (null_values, out_of_range, format_mismatch, duplicate_values,
             referential_integrity, outliers, freshness, high_cardinality)
        column_name: Affected column name
        issue_details: JSON string with issue specifics
            (e.g., count, percentage, examples, threshold)

    Returns:
        JSON string with:
        - issue_type: The issue type
        - column: Affected column
        - remediation_suggestions: Prioritized list of actions
        - priority: Overall priority (high, medium, low)
    """
    # Normalize issue type
    issue_type_normalized = issue_type.lower().replace("-", "_").replace(" ", "_")

    # Parse issue details
    try:
        details = json.loads(issue_details) if isinstance(issue_details, str) else issue_details
    except json.JSONDecodeError:
        details = {}

    # Get suggestions for issue type
    if issue_type_normalized not in REMEDIATION_SUGGESTIONS:
        # Try partial matching
        matched = None
        for known_type in REMEDIATION_SUGGESTIONS.keys():
            if known_type in issue_type_normalized or issue_type_normalized in known_type:
                matched = known_type
                break

        if matched:
            issue_type_normalized = matched
        else:
            return json.dumps({
                "success": False,
                "error": f"Unknown issue type: {issue_type}",
                "supported_types": list(REMEDIATION_SUGGESTIONS.keys()),
                "column": column_name
            })

    suggestions = REMEDIATION_SUGGESTIONS[issue_type_normalized]

    # Determine priority based on issue details
    priority = "medium"  # default

    # Check for critical indicators in details
    details_str = str(details).lower()
    if "critical" in details_str:
        priority = "high"
    elif any(word in details_str for word in ["primary key", "unique", "required", "mandatory"]):
        priority = "high"
    elif any(word in details_str for word in ["optional", "nullable", "allowed"]):
        priority = "low"

    # Check severity in details
    if isinstance(details, dict):
        severity = details.get("severity", "").lower()
        if severity == "critical":
            priority = "high"
        elif severity == "info":
            priority = "low"

        # Check percentage-based severity
        percentage = details.get("percentage") or details.get("rate")
        if percentage:
            try:
                pct = float(percentage)
                if pct > 50:
                    priority = "high"
                elif pct < 5:
                    priority = "low"
            except (ValueError, TypeError):
                pass

    # Build combined suggestion list
    all_suggestions = []
    if priority == "high":
        all_suggestions.extend(suggestions["high_priority"])
        all_suggestions.extend(suggestions["medium_priority"][:2])
    elif priority == "medium":
        all_suggestions.extend(suggestions["high_priority"][:2])
        all_suggestions.extend(suggestions["medium_priority"])
        all_suggestions.extend(suggestions["low_priority"][:1])
    else:
        all_suggestions.extend(suggestions["medium_priority"][:2])
        all_suggestions.extend(suggestions["low_priority"])

    return json.dumps({
        "success": True,
        "issue_type": issue_type_normalized,
        "column": column_name,
        "remediation_suggestions": all_suggestions,
        "priority": priority,
        "all_priorities": {
            "high": suggestions["high_priority"],
            "medium": suggestions["medium_priority"],
            "low": suggestions["low_priority"]
        }
    })


# Make function a Strands tool
try:
    from strands import tool
    suggest_remediation = tool(suggest_remediation)
except ImportError:
    # Allow module to work without strands for testing
    pass
