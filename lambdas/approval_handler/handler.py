"""
Approval Handler Lambda for DQ Rule Human Approval Workflow.

Processes human approval/rejection of AI-generated data quality rules
and signals Step Functions to continue workflow execution.

Environment Variables:
    SUPABASE_URL: Supabase project URL
    SUPABASE_KEY: Supabase service role key

API:
    POST /approvals
    Body: {
        "taskToken": "Step Functions callback token",
        "ruleId": "UUID of the rule",
        "approved": true/false,
        "reviewer": "reviewer-user-id",
        "comments": "optional comments"
    }
"""

import json
import os
from datetime import datetime, timezone
from typing import Any

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver
from aws_lambda_powertools.event_handler.exceptions import BadRequestError

# Initialize AWS Lambda Powertools
logger = Logger()
tracer = Tracer()

# Initialize API resolver for HTTP events
app = APIGatewayHttpResolver()

# Initialize AWS clients
sfn_client = boto3.client("stepfunctions")


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


@app.post("/approvals")
@tracer.capture_method
def handle_approval() -> dict[str, Any]:
    """
    Process rule approval or rejection.

    Expected body:
        taskToken: Step Functions callback token
        ruleId: UUID of the rule being approved/rejected
        approved: boolean - true for approval, false for rejection
        reviewer: User ID of the reviewer
        comments: Optional comments about the decision
    """
    body = app.current_event.json_body

    # Validate required fields
    task_token = body.get("taskToken")
    rule_id = body.get("ruleId")
    approved = body.get("approved")
    reviewer = body.get("reviewer", "unknown")
    comments = body.get("comments", "")

    if not task_token:
        raise BadRequestError("taskToken is required")
    if not rule_id:
        raise BadRequestError("ruleId is required")
    if approved is None:
        raise BadRequestError("approved (boolean) is required")

    timestamp = datetime.now(timezone.utc).isoformat()

    # Try to update Supabase (non-blocking if unavailable)
    try:
        supabase = get_supabase_client()
        if supabase:
            _update_database(supabase, rule_id, approved, reviewer, comments, timestamp)
    except Exception as e:
        logger.warning(f"Database update failed (non-blocking): {e}")

    # Signal Step Functions
    try:
        if approved:
            _send_task_success(task_token, rule_id, reviewer, comments, timestamp)
            logger.info(f"Rule {rule_id} approved by {reviewer}")
        else:
            _send_task_failure(task_token, rule_id, reviewer, comments, timestamp)
            logger.info(f"Rule {rule_id} rejected by {reviewer}")
    except sfn_client.exceptions.TaskDoesNotExist:
        logger.error(f"Task token expired or invalid for rule {rule_id}")
        raise BadRequestError("Task token is expired or invalid")
    except sfn_client.exceptions.InvalidToken:
        logger.error(f"Invalid task token for rule {rule_id}")
        raise BadRequestError("Invalid task token")
    except Exception as e:
        logger.error(f"Step Functions error: {e}")
        raise

    return {
        "status": "processed",
        "ruleId": rule_id,
        "approved": approved,
        "reviewer": reviewer,
        "processedAt": timestamp
    }


def _update_database(
    supabase,
    rule_id: str,
    approved: bool,
    reviewer: str,
    comments: str,
    timestamp: str
) -> None:
    """
    Update Supabase database with approval decision.

    Updates both dq_rules table (status, approved_by) and
    rule_approval_requests table (status, reviewed_by, reviewed_at, comments).
    """
    new_status = "approved" if approved else "disabled"

    # Update rule status
    supabase.table("dq_rules").update({
        "status": new_status,
        "approved_by": reviewer if approved else None,
        "updated_at": timestamp
    }).eq("id", rule_id).execute()

    # Update approval request
    supabase.table("rule_approval_requests").update({
        "status": "approved" if approved else "rejected",
        "reviewed_by": reviewer,
        "reviewed_at": timestamp,
        "comments": comments
    }).eq("rule_id", rule_id).eq("status", "pending").execute()

    logger.info(f"Database updated for rule {rule_id}: status={new_status}")


def _send_task_success(
    task_token: str,
    rule_id: str,
    reviewer: str,
    comments: str,
    timestamp: str
) -> None:
    """
    Send success signal to Step Functions.

    Called when a rule is approved. The workflow will continue to
    activate the rule for validation.
    """
    output = json.dumps({
        "approved": True,
        "ruleId": rule_id,
        "reviewer": reviewer,
        "comments": comments,
        "approvedAt": timestamp
    })

    sfn_client.send_task_success(
        taskToken=task_token,
        output=output
    )


def _send_task_failure(
    task_token: str,
    rule_id: str,
    reviewer: str,
    comments: str,
    timestamp: str
) -> None:
    """
    Send failure signal to Step Functions.

    Called when a rule is rejected. The workflow will handle the
    rejection (e.g., mark rule as disabled, notify creator).
    """
    sfn_client.send_task_failure(
        taskToken=task_token,
        error="RuleRejected",
        cause=json.dumps({
            "ruleId": rule_id,
            "reviewer": reviewer,
            "comments": comments,
            "rejectedAt": timestamp
        })
    )


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    Lambda handler entry point.

    Processes API Gateway HTTP events for rule approvals.
    """
    return app.resolve(event, context)
