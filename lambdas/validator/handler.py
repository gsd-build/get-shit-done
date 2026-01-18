"""
Validator Lambda: Processes AWS Glue Data Quality validation results.

Retrieves results from Glue DQ runs, calculates scores, and stores
results in Supabase for tracking and alerting.

Environment Variables:
    SUPABASE_URL: Supabase project URL
    SUPABASE_KEY: Supabase service role key
    POWERTOOLS_SERVICE_NAME: Service name for logging

Input (from Step Functions):
    {
        "run_id": "glue-dq-run-id",
        "dataset_id": "uuid",
        "validation_run_id": "uuid",
        "ruleset_names": ["ruleset1", "ruleset2"]
    }

Output:
    {
        "status": "completed|failed",
        "overall_score": 0.95,
        "rules_passed": 9,
        "rules_failed": 1,
        "rule_results": [...]
    }
"""

import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

# Initialize AWS Lambda Powertools
logger = Logger()
tracer = Tracer()

# Initialize AWS clients
glue_client = boto3.client("glue")

# Rule type to dimension mapping
RULE_TYPE_TO_DIMENSION = {
    "completeness": "completeness",
    "IsComplete": "completeness",
    "uniqueness": "uniqueness",
    "IsUnique": "uniqueness",
    "range": "validity",
    "ColumnValues": "validity",
    "pattern": "validity",
    "freshness": "freshness",
    "DataFreshness": "freshness",
    "referential": "consistency",
    "ReferentialIntegrity": "consistency",
    "custom": "validity",
}


def get_supabase_client():
    """
    Create and return Supabase client.

    Returns:
        Supabase client instance

    Raises:
        EnvironmentError: If required environment variables are not set
    """
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_KEY environment variables must be set"
        )

    try:
        from supabase import create_client
        return create_client(supabase_url, supabase_key)
    except ImportError:
        logger.warning("Supabase client not available - database updates disabled")
        return None


@tracer.capture_method
def get_glue_dq_results(run_id: str) -> dict[str, Any]:
    """
    Retrieve Glue Data Quality run results.

    Args:
        run_id: Glue DQ run ID

    Returns:
        Dictionary with run status and results
    """
    # Get run status
    run_response = glue_client.get_data_quality_ruleset_evaluation_run(RunId=run_id)

    results = {
        "run_id": run_id,
        "status": run_response.get("Status", "UNKNOWN"),
        "started_on": run_response.get("StartedOn"),
        "completed_on": run_response.get("CompletedOn"),
        "result_ids": run_response.get("ResultIds", []),
        "rule_results": [],
        "overall_score": 0.0,
    }

    # Get detailed results if available
    if results["result_ids"]:
        try:
            detailed_response = glue_client.batch_get_data_quality_result(
                ResultIds=results["result_ids"]
            )

            for result in detailed_response.get("Results", []):
                results["overall_score"] = result.get("Score", 0.0)

                for rule_result in result.get("RuleResults", []):
                    results["rule_results"].append({
                        "name": rule_result.get("Name", ""),
                        "description": rule_result.get("Description", ""),
                        "result": rule_result.get("Result", "UNKNOWN"),
                        "evaluation_message": rule_result.get("EvaluationMessage", ""),
                        "evaluated_count": rule_result.get("EvaluatedCount"),
                        "passed_count": rule_result.get("PassedCount"),
                        "failed_count": rule_result.get("FailedCount"),
                    })
        except Exception as e:
            logger.warning(f"Failed to get detailed results: {e}")

    return results


@tracer.capture_method
def calculate_dimension_scores(rule_results: list[dict]) -> dict[str, float]:
    """
    Calculate quality dimension scores from rule results.

    Groups rules by dimension and calculates average score.

    Args:
        rule_results: List of rule result dictionaries

    Returns:
        Dictionary mapping dimension to score (0.0 to 1.0)
    """
    dimension_counts: dict[str, dict[str, int]] = {}

    for rule in rule_results:
        # Determine dimension from rule name/type
        rule_name = rule.get("name", "").lower()
        dimension = "validity"  # Default

        for keyword, dim in RULE_TYPE_TO_DIMENSION.items():
            if keyword.lower() in rule_name:
                dimension = dim
                break

        if dimension not in dimension_counts:
            dimension_counts[dimension] = {"passed": 0, "total": 0}

        dimension_counts[dimension]["total"] += 1
        if rule.get("result") == "PASS":
            dimension_counts[dimension]["passed"] += 1

    # Calculate scores
    scores = {}
    for dimension, counts in dimension_counts.items():
        if counts["total"] > 0:
            scores[dimension] = counts["passed"] / counts["total"]
        else:
            scores[dimension] = 1.0

    return scores


@tracer.capture_method
def store_results(
    supabase,
    validation_run_id: str,
    dataset_id: str,
    glue_results: dict[str, Any],
    dimension_scores: dict[str, float],
) -> None:
    """
    Store validation results in Supabase.

    Updates validation_runs, inserts rule_results, and quality_scores.

    Args:
        supabase: Supabase client
        validation_run_id: UUID of the validation run record
        dataset_id: UUID of the dataset
        glue_results: Results from Glue DQ
        dimension_scores: Calculated dimension scores
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    # Calculate summary metrics
    rules_passed = sum(
        1 for r in glue_results["rule_results"] if r.get("result") == "PASS"
    )
    rules_failed = len(glue_results["rule_results"]) - rules_passed

    # Update validation_runs record
    supabase.table("validation_runs").update({
        "status": "completed" if glue_results["status"] == "SUCCEEDED" else "failed",
        "glue_run_id": glue_results["run_id"],
        "overall_score": glue_results["overall_score"],
        "rules_evaluated": len(glue_results["rule_results"]),
        "rules_passed": rules_passed,
        "rules_failed": rules_failed,
        "completed_at": timestamp,
    }).eq("id", validation_run_id).execute()

    # Insert rule results
    for rule_result in glue_results["rule_results"]:
        result_status = "pass" if rule_result.get("result") == "PASS" else "fail"
        if rule_result.get("result") == "ERROR":
            result_status = "error"
        elif rule_result.get("result") == "SKIP":
            result_status = "skip"

        supabase.table("rule_results").insert({
            "run_id": validation_run_id,
            "result": result_status,
            "evaluation_message": rule_result.get("evaluation_message"),
            "evaluated_count": rule_result.get("evaluated_count"),
            "passed_count": rule_result.get("passed_count"),
            "failed_count": rule_result.get("failed_count"),
        }).execute()

    # Insert quality scores
    for dimension, score in dimension_scores.items():
        supabase.table("quality_scores").insert({
            "dataset_id": dataset_id,
            "dimension": dimension,
            "score": score,
            "run_id": validation_run_id,
            "measured_at": timestamp,
        }).execute()

    # Update dq_rules last_triggered_at for failed rules
    for rule_result in glue_results["rule_results"]:
        if rule_result.get("result") != "PASS":
            # Note: In production, we'd match rule_result to dq_rules by name/expression
            # For now, we log the failure
            logger.info(f"Rule failed: {rule_result.get('name')}")

    logger.info(
        f"Stored results for validation run {validation_run_id}: "
        f"score={glue_results['overall_score']}, "
        f"passed={rules_passed}, failed={rules_failed}"
    )


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict[str, Any], context: LambdaContext) -> dict[str, Any]:
    """
    Lambda handler for processing Glue DQ validation results.

    Args:
        event: Lambda event with run_id, dataset_id, validation_run_id
        context: Lambda context

    Returns:
        Dictionary with processed results summary
    """
    logger.info(f"Processing validation results: {json.dumps(event)}")

    # Extract input parameters
    glue_run_id = event.get("run_id") or event.get("glue_run_id")
    dataset_id = event.get("dataset_id")
    validation_run_id = event.get("validation_run_id")

    if not glue_run_id:
        raise ValueError("run_id or glue_run_id is required")
    if not dataset_id:
        raise ValueError("dataset_id is required")
    if not validation_run_id:
        raise ValueError("validation_run_id is required")

    # Get Glue DQ results
    glue_results = get_glue_dq_results(glue_run_id)
    logger.info(f"Glue DQ run status: {glue_results['status']}")

    # Calculate dimension scores
    dimension_scores = calculate_dimension_scores(glue_results["rule_results"])
    logger.info(f"Dimension scores: {dimension_scores}")

    # Store results in Supabase
    try:
        supabase = get_supabase_client()
        if supabase:
            store_results(
                supabase,
                validation_run_id,
                dataset_id,
                glue_results,
                dimension_scores,
            )
    except Exception as e:
        logger.error(f"Failed to store results: {e}")
        # Continue to return results even if storage fails

    # Calculate summary
    rules_passed = sum(
        1 for r in glue_results["rule_results"] if r.get("result") == "PASS"
    )
    rules_failed = len(glue_results["rule_results"]) - rules_passed

    return {
        "status": "completed" if glue_results["status"] == "SUCCEEDED" else "failed",
        "overall_score": glue_results["overall_score"],
        "rules_passed": rules_passed,
        "rules_failed": rules_failed,
        "dimension_scores": dimension_scores,
        "rule_results": glue_results["rule_results"],
    }
