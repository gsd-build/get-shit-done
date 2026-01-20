"""
Email Notifier Lambda: Sends alert notifications via AWS SES.

Subscribes to AlertCreated events from EventBridge and sends formatted
HTML/text emails to configured recipients.

Environment Variables:
    SES_SENDER_EMAIL: Verified sender email address
    ALERT_EMAIL_RECIPIENTS: Comma-separated list of recipient emails
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
        "channel": "email",
        "recipient_count": N
    }
"""

import json
import os
from typing import Any

import boto3
from botocore.exceptions import ClientError
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

# Initialize AWS Lambda Powertools
logger = Logger()
tracer = Tracer()

# Initialize SES client
ses_client = boto3.client("ses")

# Severity color mapping for HTML emails
SEVERITY_COLORS = {
    "critical": "#FF0000",
    "warning": "#FFA500",
    "info": "#0066FF",
}


@tracer.capture_method
def build_html_email(event_detail: dict[str, Any]) -> str:
    """
    Build HTML email body from alert detail.

    Args:
        event_detail: Alert detail from EventBridge event

    Returns:
        HTML email body string
    """
    severity = event_detail.get("severity", "info")
    color = SEVERITY_COLORS.get(severity, "#0066FF")
    alert_id = event_detail.get("alert_id", "unknown")
    title = event_detail.get("title", "Data Quality Alert")
    message = event_detail.get("message", "No additional details")
    timestamp = event_detail.get("timestamp", "N/A")
    dataset_id = event_detail.get("dataset_id", "N/A")

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{title}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background-color: {color};
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
        }}
        .header h1 {{
            margin: 0;
            font-size: 20px;
        }}
        .content {{
            background-color: #f9f9f9;
            padding: 20px;
            border: 1px solid #e0e0e0;
            border-top: none;
            border-radius: 0 0 8px 8px;
        }}
        .detail-table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }}
        .detail-table th, .detail-table td {{
            text-align: left;
            padding: 10px;
            border-bottom: 1px solid #e0e0e0;
        }}
        .detail-table th {{
            color: #666;
            font-weight: 600;
            width: 120px;
        }}
        .severity-badge {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 12px;
            color: white;
            background-color: {color};
        }}
        .message-box {{
            background-color: white;
            padding: 15px;
            border-radius: 4px;
            margin-top: 15px;
            border-left: 4px solid {color};
        }}
        .footer {{
            margin-top: 20px;
            font-size: 12px;
            color: #666;
            text-align: center;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{title}</h1>
    </div>
    <div class="content">
        <table class="detail-table">
            <tr>
                <th>Severity</th>
                <td><span class="severity-badge">{severity.upper()}</span></td>
            </tr>
            <tr>
                <th>Alert ID</th>
                <td><code>{alert_id}</code></td>
            </tr>
            <tr>
                <th>Dataset ID</th>
                <td><code>{dataset_id}</code></td>
            </tr>
            <tr>
                <th>Time</th>
                <td>{timestamp}</td>
            </tr>
        </table>

        <div class="message-box">
            <strong>Details:</strong><br>
            {message}
        </div>
    </div>
    <div class="footer">
        <p>This is an automated alert from Data Foundations Platform.</p>
    </div>
</body>
</html>
"""
    return html


@tracer.capture_method
def build_text_email(event_detail: dict[str, Any]) -> str:
    """
    Build plain text email body from alert detail.

    Args:
        event_detail: Alert detail from EventBridge event

    Returns:
        Plain text email body string
    """
    severity = event_detail.get("severity", "info")
    alert_id = event_detail.get("alert_id", "unknown")
    title = event_detail.get("title", "Data Quality Alert")
    message = event_detail.get("message", "No additional details")
    timestamp = event_detail.get("timestamp", "N/A")
    dataset_id = event_detail.get("dataset_id", "N/A")

    text = f"""
Data Quality Alert: {title}

Severity: {severity.upper()}
Alert ID: {alert_id}
Dataset ID: {dataset_id}
Time: {timestamp}

Details:
{message}

---
This is an automated alert from Data Foundations Platform.
"""
    return text.strip()


@tracer.capture_method
def send_email(
    sender: str,
    recipients: list[str],
    subject: str,
    html_body: str,
    text_body: str,
) -> dict[str, Any]:
    """
    Send email via AWS SES.

    Args:
        sender: Sender email address
        recipients: List of recipient email addresses
        subject: Email subject
        html_body: HTML email body
        text_body: Plain text email body

    Returns:
        SES response or error dict
    """
    try:
        response = ses_client.send_email(
            Source=sender,
            Destination={
                "ToAddresses": recipients,
            },
            Message={
                "Subject": {
                    "Data": subject,
                    "Charset": "UTF-8",
                },
                "Body": {
                    "Text": {
                        "Data": text_body,
                        "Charset": "UTF-8",
                    },
                    "Html": {
                        "Data": html_body,
                        "Charset": "UTF-8",
                    },
                },
            },
        )
        logger.info(f"Email sent successfully. Message ID: {response['MessageId']}")
        return {"success": True, "message_id": response["MessageId"]}
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        error_message = e.response["Error"]["Message"]
        logger.error(f"SES error: {error_code} - {error_message}")
        return {"success": False, "error": error_message}


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict[str, Any], context: LambdaContext) -> dict[str, Any]:
    """
    Lambda handler for email notifications.

    Args:
        event: EventBridge event with AlertCreated detail
        context: Lambda context

    Returns:
        Dictionary with status, channel, and recipient count
    """
    logger.info(f"Processing email notification: {json.dumps(event)}")

    # Get configuration from environment
    sender_email = os.environ.get("SES_SENDER_EMAIL")
    recipients_str = os.environ.get("ALERT_EMAIL_RECIPIENTS", "")

    if not sender_email:
        logger.warning("SES_SENDER_EMAIL not configured - notification skipped")
        return {
            "status": "skipped",
            "channel": "email",
            "reason": "sender_not_configured",
            "recipient_count": 0,
        }

    recipients = [r.strip() for r in recipients_str.split(",") if r.strip()]

    if not recipients:
        logger.warning("ALERT_EMAIL_RECIPIENTS not configured - notification skipped")
        return {
            "status": "skipped",
            "channel": "email",
            "reason": "recipients_not_configured",
            "recipient_count": 0,
        }

    # Extract event detail
    detail = event.get("detail", {})

    if not detail:
        logger.warning("No detail in event - notification skipped")
        return {
            "status": "skipped",
            "channel": "email",
            "reason": "no_event_detail",
            "recipient_count": 0,
        }

    # Build email content
    severity = detail.get("severity", "info")
    title = detail.get("title", "Data Quality Alert")
    subject = f"[{severity.upper()}] {title}"
    html_body = build_html_email(detail)
    text_body = build_text_email(detail)

    # Send email
    result = send_email(sender_email, recipients, subject, html_body, text_body)

    if result.get("success"):
        logger.info(f"Email notification sent for alert {detail.get('alert_id')} to {len(recipients)} recipients")
        return {
            "status": "sent",
            "channel": "email",
            "recipient_count": len(recipients),
            "message_id": result.get("message_id"),
        }
    else:
        # Log error but don't fail the Lambda - notification delivery is best-effort
        logger.error(f"Failed to send email notification for alert {detail.get('alert_id')}: {result.get('error')}")
        return {
            "status": "error",
            "channel": "email",
            "reason": result.get("error"),
            "recipient_count": 0,
        }
