"""
Profiler Tool for the Data Profiler Agent.

Provides ydata-profiling wrapper functionality for generating
statistical profiles of data tables.
"""

import json
from typing import Optional

import pandas as pd

# Import connectors - support both package and direct execution
try:
    from .connectors import get_connector, ConnectorError
    from ..schemas import DataSourceConfig
except ImportError:
    from agents.profiler.tools.connectors import get_connector, ConnectorError
    from agents.profiler.schemas import DataSourceConfig


def generate_profile(df: pd.DataFrame, table_name: str, sample_threshold: int = 100000) -> dict:
    """
    Generate a profile report for a DataFrame using ydata-profiling.

    Args:
        df: DataFrame to profile
        table_name: Name of the table (for report title)
        sample_threshold: If df has more rows, sample down to this size

    Returns:
        Dict with 'summary' (key stats for Supabase) and 'full_profile' (complete JSON for S3)
    """
    try:
        from ydata_profiling import ProfileReport
    except ImportError as e:
        raise ImportError(
            "ydata-profiling not installed. Run: pip install ydata-profiling>=4.18.0"
        ) from e

    # Sample if too large
    original_row_count = len(df)
    if original_row_count > sample_threshold:
        df = df.sample(n=sample_threshold, random_state=42)
        sampled = True
    else:
        sampled = False

    # Generate profile with minimal=True for performance
    profile = ProfileReport(
        df,
        title=f"Profile: {table_name}",
        minimal=True,  # Critical for performance
        explorative=False,
        correlations={
            "pearson": {"calculate": True},
            "spearman": {"calculate": False},  # Skip for performance
            "kendall": {"calculate": False},
            "phi_k": {"calculate": False},
        },
        interactions={"continuous": False},  # Skip interaction plots
        missing_diagrams={"bar": False, "matrix": False, "heatmap": False},
    )

    # Get profile as JSON
    full_profile = json.loads(profile.to_json())

    # Extract summary statistics for database storage
    variables = full_profile.get("variables", {})
    table_info = full_profile.get("table", {})

    # Build summary
    summary = {
        "table_name": table_name,
        "row_count": original_row_count,
        "sampled_row_count": len(df) if sampled else original_row_count,
        "was_sampled": sampled,
        "column_count": table_info.get("n_var", len(df.columns)),
        "missing_cells": table_info.get("n_cells_missing", 0),
        "missing_cells_pct": table_info.get("p_cells_missing", 0),
        "duplicate_rows": table_info.get("n_duplicates", 0),
        "duplicate_rows_pct": table_info.get("p_duplicates", 0),
        "columns": {},
    }

    # Extract per-column stats
    for col_name, col_stats in variables.items():
        col_type = col_stats.get("type", "unknown")
        col_summary = {
            "type": col_type,
            "missing_count": col_stats.get("n_missing", 0),
            "missing_pct": col_stats.get("p_missing", 0),
            "distinct_count": col_stats.get("n_distinct", 0),
            "distinct_pct": col_stats.get("p_distinct", 0),
        }

        # Add numeric stats if applicable
        if col_type in ("Numeric", "num"):
            col_summary.update({
                "min": col_stats.get("min"),
                "max": col_stats.get("max"),
                "mean": col_stats.get("mean"),
                "std": col_stats.get("std"),
                "median": col_stats.get("median"),
                "p25": col_stats.get("25%"),
                "p75": col_stats.get("75%"),
            })

        # Add categorical stats if applicable
        if col_type in ("Categorical", "cat"):
            col_summary.update({
                "top_value": col_stats.get("top"),
                "top_freq": col_stats.get("freq"),
            })

        summary["columns"][col_name] = col_summary

    return {
        "summary": summary,
        "full_profile": full_profile,
    }


def profile_table(
    source_type: str,
    connection_params_json: str,
    database: str,
    table: str,
    sample_size: int = 10000
) -> str:
    """
    Profile a data table from a connected data source.

    This is a Strands agent tool that connects to data sources,
    retrieves sample data, and generates statistical profiles.

    Args:
        source_type: Type of data source ('iceberg', 'redshift', 'athena')
        connection_params_json: JSON string with connection parameters
        database: Database name
        table: Table name
        sample_size: Number of rows to sample (default 10000)

    Returns:
        JSON string with profile statistics including:
        - Table-level metrics (row count, column count, missing cells)
        - Per-column metrics (type, nulls, distinct, distribution stats)
    """
    # Parse connection params
    try:
        connection_params = json.loads(connection_params_json)
    except json.JSONDecodeError as e:
        return json.dumps({
            "error": f"Invalid connection_params JSON: {str(e)}",
            "success": False,
        })

    # Create config and get connector
    try:
        config = DataSourceConfig(
            source_type=source_type,
            connection_params=connection_params,
            database=database,
            table=table,
        )
        connector = get_connector(config)
    except Exception as e:
        return json.dumps({
            "error": f"Failed to create connector: {str(e)}",
            "success": False,
        })

    # Get sample data
    try:
        df = connector.get_sample(limit=sample_size)
    except ConnectorError as e:
        return json.dumps({
            "error": f"Failed to get sample data: {str(e)}",
            "success": False,
        })

    # Generate profile
    try:
        profile_result = generate_profile(df, f"{database}.{table}")
    except ImportError as e:
        return json.dumps({
            "error": str(e),
            "success": False,
        })
    except Exception as e:
        return json.dumps({
            "error": f"Failed to generate profile: {str(e)}",
            "success": False,
        })

    # Return summary (full_profile stored separately)
    return json.dumps({
        "success": True,
        "profile": profile_result["summary"],
        "full_profile_available": True,
    })


# Make profile_table a Strands tool
try:
    from strands import tool
    profile_table = tool(profile_table)
except ImportError:
    # Allow module to work without strands for testing
    pass
