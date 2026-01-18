#!/usr/bin/env python3
"""
Entrypoint for the Data Profiler Fargate container.

This script:
1. Reads environment variables for configuration
2. Updates profile run status in Supabase
3. Invokes the profiler agent
4. Stores results in Supabase and S3
5. Handles errors with proper status updates
"""

import json
import os
import sys
from datetime import datetime
from typing import Optional
import traceback

import boto3


def get_env(name: str, default: Optional[str] = None, required: bool = True) -> str:
    """Get environment variable with optional default."""
    value = os.environ.get(name, default)
    if required and not value:
        raise ValueError(f"Required environment variable {name} not set")
    return value


def get_supabase_client():
    """Initialize and return Supabase client."""
    try:
        from supabase import create_client
    except ImportError as e:
        raise ImportError(
            "supabase not installed. Run: pip install supabase>=2.0.0"
        ) from e

    url = get_env("SUPABASE_URL")
    key = get_env("SUPABASE_KEY")
    return create_client(url, key)


def update_run_status(supabase, run_id: str, status: str, error_message: Optional[str] = None):
    """Update profile run status in Supabase."""
    update_data = {
        "status": status,
        "updated_at": datetime.utcnow().isoformat(),
    }
    if status == "completed":
        update_data["completed_at"] = datetime.utcnow().isoformat()
    if error_message:
        update_data["error_message"] = error_message

    supabase.table("profile_runs").update(update_data).eq("id", run_id).execute()


def store_profile_result(supabase, run_id: str, profile_summary: dict):
    """Store profile summary in Supabase."""
    # Store main profile result
    result_data = {
        "run_id": run_id,
        "row_count": profile_summary.get("row_count"),
        "column_count": profile_summary.get("column_count"),
        "missing_cells_pct": profile_summary.get("missing_cells_pct"),
        "duplicate_rows_pct": profile_summary.get("duplicate_rows_pct"),
        "created_at": datetime.utcnow().isoformat(),
    }
    result = supabase.table("profile_results").insert(result_data).execute()
    result_id = result.data[0]["id"]

    # Store per-column profiles
    columns = profile_summary.get("columns", {})
    for col_name, col_stats in columns.items():
        col_data = {
            "result_id": result_id,
            "column_name": col_name,
            "data_type": col_stats.get("type"),
            "null_count": col_stats.get("missing_count"),
            "null_pct": col_stats.get("missing_pct"),
            "distinct_count": col_stats.get("distinct_count"),
            "distinct_pct": col_stats.get("distinct_pct"),
            "min_value": str(col_stats.get("min")) if col_stats.get("min") is not None else None,
            "max_value": str(col_stats.get("max")) if col_stats.get("max") is not None else None,
            "mean_value": col_stats.get("mean"),
            "std_value": col_stats.get("std"),
            "median_value": col_stats.get("median"),
        }
        supabase.table("column_profiles").insert(col_data).execute()

    return result_id


def store_anomalies(supabase, run_id: str, anomalies: list):
    """Store detected anomalies in Supabase."""
    for anomaly in anomalies:
        anomaly_data = {
            "run_id": run_id,
            "column_name": anomaly.get("column"),
            "anomaly_type": anomaly.get("type"),
            "detection_method": anomaly.get("method"),
            "severity": anomaly.get("severity"),
            "value": anomaly.get("value"),
            "threshold": anomaly.get("threshold"),
            "description": anomaly.get("description"),
            "created_at": datetime.utcnow().isoformat(),
        }
        supabase.table("profile_anomalies").insert(anomaly_data).execute()


def upload_full_profile_to_s3(s3_bucket: str, run_id: str, full_profile: dict):
    """Upload the full profile JSON to S3."""
    s3_client = boto3.client("s3")
    key = f"profiles/{run_id}/full_profile.json"

    s3_client.put_object(
        Bucket=s3_bucket,
        Key=key,
        Body=json.dumps(full_profile, default=str),
        ContentType="application/json",
    )

    return f"s3://{s3_bucket}/{key}"


def run_profiler():
    """Main profiler execution logic."""
    # Get configuration from environment
    source_type = get_env("SOURCE_TYPE")
    database = get_env("DATABASE")
    table = get_env("TABLE")
    connection_params_json = get_env("CONNECTION_PARAMS")
    s3_bucket = get_env("S3_BUCKET")
    run_id = get_env("RUN_ID")

    # Initialize Supabase client
    supabase = get_supabase_client()

    try:
        # Update status to running
        update_run_status(supabase, run_id, "running")
        print(f"Starting profiler run {run_id} for {source_type}:{database}.{table}")

        # Import and run the profiler agent
        from agents.profiler.agent import profiler_agent
        from agents.profiler.tools.profiler import profile_table, generate_profile
        from agents.profiler.tools.anomaly import detect_anomalies
        from agents.profiler.tools.connectors import get_connector
        from agents.profiler.schemas import DataSourceConfig

        # Parse connection params
        connection_params = json.loads(connection_params_json)

        # Create config and get connector
        config = DataSourceConfig(
            source_type=source_type,
            connection_params=connection_params,
            database=database,
            table=table,
        )
        connector = get_connector(config)

        # Get sample data
        print("Fetching sample data...")
        df = connector.get_sample(limit=10000)
        print(f"Retrieved {len(df)} rows")

        # Generate profile
        print("Generating profile...")
        profile_result = generate_profile(df, f"{database}.{table}")
        profile_summary = profile_result["summary"]
        full_profile = profile_result["full_profile"]
        print(f"Profile generated: {profile_summary.get('column_count')} columns")

        # Detect anomalies
        print("Detecting anomalies...")
        anomaly_json = detect_anomalies(json.dumps({"profile": profile_summary}))
        anomaly_result = json.loads(anomaly_json)
        anomalies = anomaly_result.get("anomalies", [])
        print(f"Found {len(anomalies)} anomalies")

        # Store results in Supabase
        print("Storing results in Supabase...")
        result_id = store_profile_result(supabase, run_id, profile_summary)
        store_anomalies(supabase, run_id, anomalies)
        print(f"Results stored, result_id: {result_id}")

        # Upload full profile to S3
        print("Uploading full profile to S3...")
        s3_uri = upload_full_profile_to_s3(s3_bucket, run_id, full_profile)
        print(f"Full profile uploaded: {s3_uri}")

        # Update run with S3 URI
        supabase.table("profile_runs").update({
            "s3_profile_uri": s3_uri,
        }).eq("id", run_id).execute()

        # Update status to completed
        update_run_status(supabase, run_id, "completed")
        print(f"Profile run {run_id} completed successfully")

    except Exception as e:
        # Update status to failed with error message
        error_message = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
        print(f"Profile run {run_id} failed: {error_message}", file=sys.stderr)
        update_run_status(supabase, run_id, "failed", error_message[:1000])
        raise


if __name__ == "__main__":
    try:
        run_profiler()
    except Exception as e:
        print(f"FATAL: {e}", file=sys.stderr)
        sys.exit(1)
