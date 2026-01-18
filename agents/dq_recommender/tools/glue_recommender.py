"""
AWS Glue Data Quality Recommender Tool.

Interfaces with AWS Glue Data Quality to get ML-based rule recommendations.
"""

import json
import boto3
from typing import Optional


def _get_glue_client(region: str = "us-east-1"):
    """Get or create Glue client."""
    return boto3.client("glue", region_name=region)


def get_glue_recommendations(
    database: str,
    table: str,
    catalog_id: Optional[str] = None
) -> str:
    """
    Get ML-based rule recommendations from AWS Glue Data Quality.

    Starts a recommendation run that analyzes the table's data and
    generates appropriate DQDL rules based on detected patterns.

    Note: This is an async operation. The returned run_id can be used
    with check_recommendation_status to get results when complete.

    Args:
        database: Glue catalog database name
        table: Table name to analyze
        catalog_id: Optional AWS account ID for cross-account access

    Returns:
        JSON string with:
        - run_id: ID for tracking the recommendation run
        - status: Initial status (usually RUNNING)
        - message: Status message
    """
    try:
        client = _get_glue_client()

        # Build data source specification
        data_source = {
            "GlueTable": {
                "DatabaseName": database,
                "TableName": table,
            }
        }

        if catalog_id:
            data_source["GlueTable"]["CatalogId"] = catalog_id

        # Start recommendation run
        # Note: Role must be configured in AWS with appropriate permissions
        response = client.start_data_quality_rule_recommendation_run(
            DataSource=data_source,
            Role=f"arn:aws:iam::{boto3.client('sts').get_caller_identity()['Account']}:role/GlueDataQualityRole"
        )

        run_id = response["RunId"]

        return json.dumps({
            "success": True,
            "run_id": run_id,
            "status": "RUNNING",
            "message": f"Started recommendation run for {database}.{table}. Use check_recommendation_status to get results.",
            "database": database,
            "table": table
        })

    except client.exceptions.EntityNotFoundException:
        return json.dumps({
            "success": False,
            "error": f"Table not found: {database}.{table}",
            "database": database,
            "table": table
        })
    except client.exceptions.AccessDeniedException as e:
        return json.dumps({
            "success": False,
            "error": f"Access denied. Ensure GlueDataQualityRole exists with appropriate permissions: {str(e)}",
            "database": database,
            "table": table
        })
    except Exception as e:
        return json.dumps({
            "success": False,
            "error": f"Failed to start recommendation run: {str(e)}",
            "database": database,
            "table": table
        })


def check_recommendation_status(run_id: str) -> str:
    """
    Check the status of a Glue Data Quality recommendation run.

    Args:
        run_id: The run ID returned by get_glue_recommendations

    Returns:
        JSON string with:
        - status: RUNNING, SUCCEEDED, FAILED, or CANCELLED
        - ruleset: Generated DQDL rules (if SUCCEEDED)
        - error: Error message (if FAILED)
    """
    try:
        client = _get_glue_client()

        response = client.get_data_quality_rule_recommendation_run(RunId=run_id)

        status = response.get("Status", "UNKNOWN")

        result = {
            "run_id": run_id,
            "status": status,
        }

        if status == "SUCCEEDED":
            result["success"] = True
            result["ruleset"] = response.get("RecommendedRuleset", "")
            result["started_at"] = response.get("StartedOn", "").isoformat() if response.get("StartedOn") else None
            result["completed_at"] = response.get("CompletedOn", "").isoformat() if response.get("CompletedOn") else None
        elif status == "FAILED":
            result["success"] = False
            result["error"] = response.get("ErrorString", "Unknown error")
        elif status in ("RUNNING", "STARTING"):
            result["success"] = True
            result["message"] = "Recommendation run still in progress"
        else:
            result["success"] = False
            result["error"] = f"Unexpected status: {status}"

        return json.dumps(result)

    except Exception as e:
        return json.dumps({
            "success": False,
            "run_id": run_id,
            "error": f"Failed to check recommendation status: {str(e)}"
        })


# Make functions Strands tools
try:
    from strands import tool
    get_glue_recommendations = tool(get_glue_recommendations)
    check_recommendation_status = tool(check_recommendation_status)
except ImportError:
    # Allow module to work without strands for testing
    pass
