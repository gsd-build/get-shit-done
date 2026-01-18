"""
Alert Handler Lambda: Processes data quality alerts from EventBridge.

Creates alert records in Supabase and emits events for downstream
notification handlers (Slack, email, etc.).

Environment Variables:
    SUPABASE_URL: Supabase project URL
    SUPABASE_KEY: Supabase service role key
    EVENT_BUS_NAME: EventBridge bus name (optional, defaults to 'default')
    POWERTOOLS_SERVICE_NAME: Service name for logging

Input (EventBridge event):
    {
        "source": "data-quality.validator|data-quality.freshness",
        "detail-type": "QualityCheckFailed|FreshnessSLAViolation|VolumeAnomaly",
        "detail": {
            "dataset_id": "uuid",
            "title": "Alert title",
            "message": "Alert message",
            "severity": "critical|warning|info",
            "details": {...}
        }
    }

Output:
    {
        "alert_id": "uuid",
        "status": "created",
        "notification_sent": false
    }
"""

import json
import os
from datetime import datetime, timezone
from typing import Any

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

# Initialize AWS Lambda Powertools
logger = Logger()
tracer = Tracer()

# Initialize AWS clients
events_client = boto3.client("events")

# Alert type mapping from detail-type
DETAIL_TYPE_TO_ALERT_TYPE = {
    "QualityCheckFailed": "rule_failure",
    "FreshnessSLAViolation": "freshness_sla",
    "VolumeAnomaly": "volume_anomaly",
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
def create_alert_record(supabase, event_detail: dict[str, Any], alert_type: str) -> str:
    """
    Create alert record in Supabase.

    Args:
        supabase: Supabase client
        event_detail: Event detail from EventBridge
        alert_type: Type of alert (rule_failure, freshness_sla, volume_anomaly)

    Returns:
        UUID of created alert
    """
    # Extract fields from event detail
    dataset_id = event_detail.get("dataset_id")
    rule_id = event_detail.get("rule_id")
    run_id = event_detail.get("run_id")

    # Build alert record
    alert_data = {
        "alert_type": alert_type,
        "severity": event_detail.get("severity", "warning"),
        "title": event_detail.get("title", f"{alert_type} detected"),
        "message": event_detail.get("message"),
        "details": event_detail.get("details"),
        "status": "open",
        "notification_sent": False,
    }

    # Add optional foreign keys if provided
    if dataset_id:
        alert_data["dataset_id"] = dataset_id
    if rule_id:
        alert_data["rule_id"] = rule_id
    if run_id:
        alert_data["run_id"] = run_id

    # Insert alert
    result = supabase.table("alerts").insert(alert_data).execute()

    if result.data and len(result.data) > 0:
        alert_id = result.data[0]["id"]
        logger.info(f"Created alert {alert_id}: {alert_data['title']}")
        return alert_id
    else:
        raise Exception("Failed to create alert record")


@tracer.capture_method
def emit_notification_event(alert_id: str, event_detail: dict[str, Any]) -> None:
    """
    Emit notification event to EventBridge for downstream handlers.

    This allows Slack, email, and other notification handlers to subscribe
    to alert events without tight coupling.

    Args:
        alert_id: UUID of the created alert
        event_detail: Original event detail
    """
    event_bus_name = os.environ.get("EVENT_BUS_NAME", "default")

    notification_detail = {
        "alert_id": alert_id,
        "dataset_id": event_detail.get("dataset_id"),
        "severity": event_detail.get("severity", "warning"),
        "title": event_detail.get("title"),
        "message": event_detail.get("message"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    events_client.put_events(
        Entries=[
            {
                "Source": "data-quality.alerts",
                "DetailType": "AlertCreated",
                "Detail": json.dumps(notification_detail),
                "EventBusName": event_bus_name,
            }
        ]
    )

    logger.info(f"Emitted notification event for alert {alert_id}")


@tracer.capture_method
def update_notification_status(supabase, alert_id: str) -> None:
    """
    Update alert record to indicate notification was sent.

    Args:
        supabase: Supabase client
        alert_id: UUID of the alert
    """
    supabase.table("alerts").update({
        "notification_sent": True,
        "notification_channels": ["eventbridge"],
    }).eq("id", alert_id).execute()


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict[str, Any], context: LambdaContext) -> dict[str, Any]:
    """
    Lambda handler for processing alert events.

    Args:
        event: EventBridge event
        context: Lambda context

    Returns:
        Dictionary with alert_id and status
    """
    logger.info(f"Processing alert event: {json.dumps(event)}")

    # Extract event fields
    detail_type = event.get("detail-type", "")
    detail = event.get("detail", {})
    source = event.get("source", "")

    # Determine alert type
    alert_type = DETAIL_TYPE_TO_ALERT_TYPE.get(detail_type, "rule_failure")

    logger.info(f"Alert type: {alert_type}, source: {source}")

    # Initialize Supabase client
    try:
        supabase = get_supabase_client()
    except Exception as e:
        logger.error(f"Failed to initialize Supabase: {e}")
        return {
            "status": "error",
            "error": str(e),
        }

    alert_id = None
    notification_sent = False

    # Create alert record
    if supabase:
        try:
            alert_id = create_alert_record(supabase, detail, alert_type)

            # Emit notification event
            emit_notification_event(alert_id, detail)

            # Update notification status
            update_notification_status(supabase, alert_id)
            notification_sent = True

        except Exception as e:
            logger.error(f"Error processing alert: {e}")
            return {
                "status": "error",
                "error": str(e),
            }
    else:
        # Log-only mode when Supabase is unavailable
        logger.warning("Supabase unavailable - alert not persisted")
        alert_id = "log-only"

    return {
        "alert_id": alert_id,
        "status": "created",
        "notification_sent": notification_sent,
    }
