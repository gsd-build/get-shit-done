"""
Freshness Monitor Lambda: Scheduled checks for data freshness and volume anomalies.

Runs on EventBridge schedule to check freshness SLAs and detect volume anomalies.
Emits events for violations that trigger the alert handler.

Environment Variables:
    SUPABASE_URL: Supabase project URL
    SUPABASE_KEY: Supabase service role key
    EVENT_BUS_NAME: EventBridge bus name (optional, defaults to 'default')
    POWERTOOLS_SERVICE_NAME: Service name for logging

Input (EventBridge scheduled event):
    Standard EventBridge scheduled event format

Output:
    {
        "datasets_checked": 5,
        "violations_detected": 2,
        "volume_anomalies": 1
    }
"""

import json
import os
from datetime import datetime, timezone, timedelta
from typing import Any

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

# Initialize AWS Lambda Powertools
logger = Logger()
tracer = Tracer()

# Initialize AWS clients
events_client = boto3.client("events")
glue_client = boto3.client("glue")

# Volume anomaly thresholds
VOLUME_LOW_THRESHOLD = 0.5   # Alert if < 50% of average
VOLUME_HIGH_THRESHOLD = 2.0  # Alert if > 200% of average
VOLUME_HISTORY_RUNS = 7      # Number of historical runs to compare


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
        logger.warning("Supabase client not available - monitoring disabled")
        return None


@tracer.capture_method
def get_enabled_slas(supabase) -> list[dict[str, Any]]:
    """
    Get all enabled freshness SLAs with dataset info.

    Args:
        supabase: Supabase client

    Returns:
        List of SLA configurations with dataset info
    """
    result = supabase.table("freshness_slas").select(
        "*, datasets(id, database_name, table_name, data_sources(source_type, connection_config))"
    ).eq("enabled", True).execute()

    return result.data or []


@tracer.capture_method
def get_table_metadata(database: str, table: str) -> dict[str, Any] | None:
    """
    Get table metadata from Glue catalog.

    Args:
        database: Glue catalog database name
        table: Table name

    Returns:
        Table metadata dict or None if not found
    """
    try:
        response = glue_client.get_table(DatabaseName=database, Name=table)
        return response.get("Table")
    except glue_client.exceptions.EntityNotFoundException:
        logger.warning(f"Table {database}.{table} not found in Glue catalog")
        return None
    except Exception as e:
        logger.error(f"Error getting table metadata: {e}")
        return None


@tracer.capture_method
def check_freshness_sla(
    sla: dict[str, Any],
    dataset: dict[str, Any],
) -> dict[str, Any] | None:
    """
    Check if dataset violates freshness SLA.

    Args:
        sla: SLA configuration
        dataset: Dataset info

    Returns:
        Violation details dict or None if compliant
    """
    database = dataset.get("database_name")
    table = dataset.get("table_name")

    if not database or not table:
        logger.warning(f"Missing database/table for dataset {dataset.get('id')}")
        return None

    # Get table metadata from Glue
    table_metadata = get_table_metadata(database, table)
    if not table_metadata:
        return None

    # Get last update time
    update_time = table_metadata.get("UpdateTime")
    if not update_time:
        # Try parameters for partitioned tables
        params = table_metadata.get("Parameters", {})
        last_modified = params.get("transient_lastDdlTime")
        if last_modified:
            update_time = datetime.fromtimestamp(int(last_modified), tz=timezone.utc)

    if not update_time:
        logger.warning(f"No update time found for {database}.{table}")
        return None

    # Ensure timezone-aware
    if update_time.tzinfo is None:
        update_time = update_time.replace(tzinfo=timezone.utc)

    # Calculate age in hours
    now = datetime.now(timezone.utc)
    age_hours = (now - update_time).total_seconds() / 3600

    max_age_hours = sla.get("max_age_hours", 24)

    if age_hours > max_age_hours:
        return {
            "dataset_id": dataset.get("id"),
            "table": f"{database}.{table}",
            "max_age_hours": max_age_hours,
            "actual_age_hours": round(age_hours, 2),
            "last_updated": update_time.isoformat(),
            "severity": sla.get("severity", "warning"),
        }

    return None


@tracer.capture_method
def check_volume_anomaly(
    supabase,
    dataset_id: str,
    database: str,
    table: str,
) -> dict[str, Any] | None:
    """
    Check for volume anomalies by comparing to historical data.

    Args:
        supabase: Supabase client
        dataset_id: Dataset UUID
        database: Database name
        table: Table name

    Returns:
        Anomaly details dict or None if normal
    """
    # Get historical profile results for row counts
    result = supabase.table("profile_results").select(
        "row_count, created_at"
    ).eq(
        "run_id",
        supabase.table("profile_runs").select("id").eq("dataset_id", dataset_id)
    ).order("created_at", desc=True).limit(VOLUME_HISTORY_RUNS + 1).execute()

    history = result.data or []

    if len(history) < 2:
        # Not enough history to compare
        return None

    current_count = history[0].get("row_count")
    if current_count is None:
        return None

    # Calculate average of historical runs (excluding current)
    historical_counts = [
        h.get("row_count") for h in history[1:]
        if h.get("row_count") is not None
    ]

    if not historical_counts:
        return None

    avg_count = sum(historical_counts) / len(historical_counts)

    if avg_count == 0:
        return None

    ratio = current_count / avg_count

    if ratio < VOLUME_LOW_THRESHOLD:
        return {
            "dataset_id": dataset_id,
            "table": f"{database}.{table}",
            "current_count": current_count,
            "average_count": round(avg_count),
            "ratio": round(ratio, 2),
            "anomaly_type": "low_volume",
            "severity": "warning",
            "message": f"Row count ({current_count}) is {round(ratio * 100)}% of average ({round(avg_count)})",
        }
    elif ratio > VOLUME_HIGH_THRESHOLD:
        return {
            "dataset_id": dataset_id,
            "table": f"{database}.{table}",
            "current_count": current_count,
            "average_count": round(avg_count),
            "ratio": round(ratio, 2),
            "anomaly_type": "high_volume",
            "severity": "warning",
            "message": f"Row count ({current_count}) is {round(ratio * 100)}% of average ({round(avg_count)})",
        }

    return None


@tracer.capture_method
def emit_violation_event(violation_type: str, details: dict[str, Any]) -> None:
    """
    Emit violation event to EventBridge.

    Args:
        violation_type: Type of violation (FreshnessSLAViolation, VolumeAnomaly)
        details: Violation details
    """
    event_bus_name = os.environ.get("EVENT_BUS_NAME", "default")

    # Build event detail with required fields
    event_detail = {
        "dataset_id": details.get("dataset_id"),
        "severity": details.get("severity", "warning"),
        "title": f"{violation_type}: {details.get('table', 'Unknown')}",
        "message": details.get("message") or f"{violation_type} detected for {details.get('table')}",
        "details": details,
    }

    events_client.put_events(
        Entries=[
            {
                "Source": "data-quality.freshness",
                "DetailType": violation_type,
                "Detail": json.dumps(event_detail),
                "EventBusName": event_bus_name,
            }
        ]
    )

    logger.info(f"Emitted {violation_type} event for {details.get('table')}")


@tracer.capture_method
def update_sla_check_time(supabase, sla_id: str, had_violation: bool) -> None:
    """
    Update last_check_at (and last_violation_at if applicable) for SLA.

    Args:
        supabase: Supabase client
        sla_id: SLA record UUID
        had_violation: Whether a violation was detected
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    update_data = {"last_check_at": timestamp}
    if had_violation:
        update_data["last_violation_at"] = timestamp

    supabase.table("freshness_slas").update(update_data).eq("id", sla_id).execute()


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: dict[str, Any], context: LambdaContext) -> dict[str, Any]:
    """
    Lambda handler for scheduled freshness monitoring.

    Args:
        event: EventBridge scheduled event
        context: Lambda context

    Returns:
        Dictionary with check summary
    """
    logger.info("Starting freshness and volume monitoring check")

    # Initialize Supabase client
    try:
        supabase = get_supabase_client()
    except Exception as e:
        logger.error(f"Failed to initialize Supabase: {e}")
        return {
            "status": "error",
            "error": str(e),
        }

    if not supabase:
        return {
            "status": "error",
            "error": "Supabase client unavailable",
        }

    # Get enabled SLAs
    slas = get_enabled_slas(supabase)
    logger.info(f"Found {len(slas)} enabled freshness SLAs")

    datasets_checked = 0
    violations_detected = 0
    volume_anomalies = 0

    for sla in slas:
        dataset = sla.get("datasets")
        if not dataset:
            continue

        datasets_checked += 1
        had_violation = False

        # Check freshness SLA
        violation = check_freshness_sla(sla, dataset)
        if violation:
            violations_detected += 1
            had_violation = True
            emit_violation_event("FreshnessSLAViolation", violation)
            logger.warning(
                f"Freshness SLA violation: {violation.get('table')} "
                f"age={violation.get('actual_age_hours')}h "
                f"max={violation.get('max_age_hours')}h"
            )

        # Check volume anomaly
        anomaly = check_volume_anomaly(
            supabase,
            dataset.get("id"),
            dataset.get("database_name"),
            dataset.get("table_name"),
        )
        if anomaly:
            volume_anomalies += 1
            emit_violation_event("VolumeAnomaly", anomaly)
            logger.warning(
                f"Volume anomaly: {anomaly.get('table')} "
                f"ratio={anomaly.get('ratio')}"
            )

        # Update SLA check timestamp
        update_sla_check_time(supabase, sla.get("id"), had_violation)

    logger.info(
        f"Monitoring complete: checked={datasets_checked}, "
        f"freshness_violations={violations_detected}, "
        f"volume_anomalies={volume_anomalies}"
    )

    return {
        "status": "completed",
        "datasets_checked": datasets_checked,
        "violations_detected": violations_detected,
        "volume_anomalies": volume_anomalies,
    }
