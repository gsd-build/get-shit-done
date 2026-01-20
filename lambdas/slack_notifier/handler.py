"""
Slack Notifier Lambda: Sends alert notifications to Slack via webhook.

Subscribes to AlertCreated events from EventBridge and sends formatted
Slack Block Kit messages to a configured webhook URL.

Environment Variables:
    SLACK_WEBHOOK_URL: Slack incoming webhook URL
    POWERTOOLS_SERVICE_NAME: Service name for logging
    POWERTOOLS_LOG_LEVEL: Log level (DEBUG, INFO, WARNING, ERROR)

Input (EventBridge event):
    {
        "source": "data-quality.alerts",
        "detail-type": "AlertCreated",
        "detail": {
            "alert_id": "uuid",
            "dataset_id": "uuid",
            "severity": "critical|warning|info",
            "title": "Alert title",
            "message": "Alert message",
            "timestamp": "ISO 8601"
        }
    }

Output:
    {
        "status": "sent",
        "channel": "slack"
    }
"""

import json
import os
import urllib.request
import urllib.error
from typing import Any

from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

# Initialize AWS Lambda Powertools
logger = Logger()
tracer = Tracer()

# Severity emoji mapping
SEVERITY_EMOJI = {
    "critical": ":rotating_light:",
    "warning": ":warning:",
    "info": ":information_source:",
}

# Severity color mapping (for attachment fallback)
SEVERITY_COLOR = {
    "critical": "#FF0000",
    "warning": "#FFA500",
    "info": "#0066FF",
}


@tracer.capture_method
def build_slack_blocks(event_detail: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Build Slack Block Kit message blocks from alert detail.

    Args:
        event_detail: Alert detail from EventBridge event

    Returns:
        List of Slack Block Kit blocks
    """
    severity = event_detail.get("severity", "info")
    emoji = SEVERITY_EMOJI.get(severity, ":bell:")
    alert_id = event_detail.get("alert_id", "unknown")
    title = event_detail.get("title", "Data Quality Alert")
    message = event_detail.get("message", "No additional details")
    timestamp = event_detail.get("timestamp", "")
    dataset_id = event_detail.get("dataset_id", "unknown")

    blocks = [
        # Header block with severity emoji
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{emoji} {title}",
                "emoji": True,
            },
        },
        # Severity and Alert ID fields
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": f"*Severity:*\n{severity.upper()}",
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Alert ID:*\n`{alert_id[:8]}...`",
                },
            ],
        },
        # Dataset ID field
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": f"*Dataset:*\n`{dataset_id[:8]}...`" if dataset_id else "*Dataset:*\nN/A",
                },
            ],
        },
        # Message text
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Message:*\n{message}",
            },
        },
        # Divider
        {"type": "divider"},
        # Context block with timestamp
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f":clock1: {timestamp}" if timestamp else ":clock1: No timestamp",
                },
            ],
        },
    ]

    return blocks


@tracer.capture_method
def send_slack_notification(webhook_url: str, blocks: list[dict[str, Any]],
                            event_detail: dict[str, Any]) -> bool:
    """
    Send notification to Slack webhook.

    Args:
        webhook_url: Slack incoming webhook URL
        blocks: Slack Block Kit blocks
        event_detail: Original event detail for fallback text

    Returns:
        True if sent successfully, False otherwise
    """
    severity = event_detail.get("severity", "info")
    title = event_detail.get("title", "Data Quality Alert")

    payload = {
        "blocks": blocks,
        "text": f"[{severity.upper()}] {title}",  # Fallback for notifications
    }

    data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            response_body = response.read().decode("utf-8")
            logger.info(f"Slack response: {response.status} - {response_body}")
            return response.status == 200
    except urllib.error.HTTPError as e:
        logger.error(f"Slack HTTP error: {e.code} - {e.reason}")
        return False
    except urllib.error.URLError as e:
        logger.error(f"Slack URL error: {e.reason}")
        return False


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict[str, Any], context: LambdaContext) -> dict[str, Any]:
    """
    Lambda handler for Slack notifications.

    Args:
        event: EventBridge event with AlertCreated detail
        context: Lambda context

    Returns:
        Dictionary with status and channel
    """
    logger.info(f"Processing Slack notification: {json.dumps(event)}")

    # Get webhook URL from environment
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL")

    if not webhook_url:
        logger.warning("SLACK_WEBHOOK_URL not configured - notification skipped")
        return {
            "status": "skipped",
            "channel": "slack",
            "reason": "webhook_not_configured",
        }

    # Extract event detail
    detail = event.get("detail", {})

    if not detail:
        logger.warning("No detail in event - notification skipped")
        return {
            "status": "skipped",
            "channel": "slack",
            "reason": "no_event_detail",
        }

    # Build Slack blocks
    blocks = build_slack_blocks(detail)

    # Send notification
    success = send_slack_notification(webhook_url, blocks, detail)

    if success:
        logger.info(f"Slack notification sent for alert {detail.get('alert_id')}")
        return {
            "status": "sent",
            "channel": "slack",
        }
    else:
        # Log error but don't fail the Lambda - notification delivery is best-effort
        logger.error(f"Failed to send Slack notification for alert {detail.get('alert_id')}")
        return {
            "status": "error",
            "channel": "slack",
            "reason": "send_failed",
        }
