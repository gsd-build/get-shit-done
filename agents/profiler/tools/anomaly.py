"""
Anomaly Detection Tool for the Data Profiler Agent.

Provides statistical anomaly detection for data profiles:
- Z-score outlier detection for numeric columns
- IQR outlier detection for numeric columns
- High null rate detection
- High cardinality detection for categorical columns
- Single value dominance detection
"""

import json
from typing import List, Optional

import numpy as np
import pandas as pd
from scipy import stats


def detect_numeric_anomalies(series: pd.Series, column_name: str) -> List[dict]:
    """
    Detect anomalies in a numeric column.

    Checks for:
    - Z-score outliers (values > 3 std dev from mean, flag if > 5% outliers)
    - IQR outliers (values > 1.5*IQR from quartiles, flag if > 10% outliers)
    - High null rate (flag if > 20% nulls)

    Args:
        series: Pandas Series with numeric data
        column_name: Name of the column for reporting

    Returns:
        List of anomaly dicts with: column, type, method, value, threshold, severity, description
    """
    anomalies = []

    # Skip if no valid data
    non_null = series.dropna()
    if len(non_null) == 0:
        anomalies.append({
            "column": column_name,
            "type": "all_null",
            "method": "null_check",
            "value": 100.0,
            "threshold": 0,
            "severity": "critical",
            "description": f"Column '{column_name}' has no non-null values"
        })
        return anomalies

    total_count = len(series)
    null_count = series.isna().sum()
    null_pct = (null_count / total_count) * 100

    # High null rate check
    if null_pct > 20:
        severity = "critical" if null_pct > 50 else "warning"
        anomalies.append({
            "column": column_name,
            "type": "high_null_rate",
            "method": "null_check",
            "value": round(null_pct, 2),
            "threshold": 20,
            "severity": severity,
            "description": f"Column '{column_name}' has {null_pct:.1f}% null values (threshold: 20%)"
        })

    # Z-score outlier detection
    if len(non_null) >= 10:  # Need enough data for meaningful stats
        try:
            z_scores = np.abs(stats.zscore(non_null))
            outlier_count = np.sum(z_scores > 3)
            outlier_pct = (outlier_count / len(non_null)) * 100

            if outlier_pct > 5:
                severity = "critical" if outlier_pct > 15 else "warning"
                anomalies.append({
                    "column": column_name,
                    "type": "outliers",
                    "method": "z_score",
                    "value": round(outlier_pct, 2),
                    "threshold": 5,
                    "severity": severity,
                    "description": f"Column '{column_name}' has {outlier_pct:.1f}% outliers by z-score (>3 std dev, threshold: 5%)"
                })
        except Exception:
            # Z-score can fail on constant or invalid data
            pass

    # IQR outlier detection
    if len(non_null) >= 4:  # Need enough data for quartiles
        try:
            q1 = non_null.quantile(0.25)
            q3 = non_null.quantile(0.75)
            iqr = q3 - q1

            if iqr > 0:  # Can't detect outliers with zero IQR
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                outlier_count = ((non_null < lower_bound) | (non_null > upper_bound)).sum()
                outlier_pct = (outlier_count / len(non_null)) * 100

                if outlier_pct > 10:
                    severity = "critical" if outlier_pct > 25 else "warning"
                    anomalies.append({
                        "column": column_name,
                        "type": "outliers",
                        "method": "iqr",
                        "value": round(outlier_pct, 2),
                        "threshold": 10,
                        "severity": severity,
                        "description": f"Column '{column_name}' has {outlier_pct:.1f}% outliers by IQR method (threshold: 10%)"
                    })
        except Exception:
            pass

    return anomalies


def detect_categorical_anomalies(series: pd.Series, column_name: str) -> List[dict]:
    """
    Detect anomalies in a categorical column.

    Checks for:
    - High cardinality (> 90% unique values AND > 100 distinct values)
    - Single value dominance (> 95% same value)
    - High null rate (> 20% nulls)

    Args:
        series: Pandas Series with categorical data
        column_name: Name of the column for reporting

    Returns:
        List of anomaly dicts with: column, type, method, value, threshold, severity, description
    """
    anomalies = []

    total_count = len(series)
    if total_count == 0:
        return anomalies

    null_count = series.isna().sum()
    null_pct = (null_count / total_count) * 100

    # High null rate check
    if null_pct > 20:
        severity = "critical" if null_pct > 50 else "warning"
        anomalies.append({
            "column": column_name,
            "type": "high_null_rate",
            "method": "null_check",
            "value": round(null_pct, 2),
            "threshold": 20,
            "severity": severity,
            "description": f"Column '{column_name}' has {null_pct:.1f}% null values (threshold: 20%)"
        })

    non_null = series.dropna()
    if len(non_null) == 0:
        return anomalies

    # Calculate value distribution
    value_counts = non_null.value_counts()
    distinct_count = len(value_counts)
    unique_pct = (distinct_count / len(non_null)) * 100

    # High cardinality check
    if unique_pct > 90 and distinct_count > 100:
        anomalies.append({
            "column": column_name,
            "type": "high_cardinality",
            "method": "cardinality_check",
            "value": distinct_count,
            "threshold": 100,
            "severity": "info",
            "description": f"Column '{column_name}' has very high cardinality ({distinct_count} distinct values, {unique_pct:.1f}% unique) - consider if this should be categorical"
        })

    # Single value dominance check
    if len(value_counts) > 0:
        top_value = value_counts.index[0]
        top_count = value_counts.iloc[0]
        dominance_pct = (top_count / len(non_null)) * 100

        if dominance_pct > 95:
            anomalies.append({
                "column": column_name,
                "type": "single_value_dominance",
                "method": "dominance_check",
                "value": round(dominance_pct, 2),
                "threshold": 95,
                "severity": "warning",
                "description": f"Column '{column_name}' is dominated by single value '{top_value}' ({dominance_pct:.1f}% of non-null values)"
            })

    return anomalies


def detect_anomalies(profile_json: str) -> str:
    """
    Detect anomalies from a profile result.

    Analyzes the profile summary and runs anomaly detection
    on each column based on its type.

    Args:
        profile_json: JSON string with profile data containing 'profile' key
                     which has 'columns' with per-column statistics

    Returns:
        JSON string with detected anomalies grouped by column and severity
    """
    # Parse profile JSON
    try:
        profile_data = json.loads(profile_json)
    except json.JSONDecodeError as e:
        return json.dumps({
            "error": f"Invalid profile JSON: {str(e)}",
            "success": False,
        })

    # Handle both direct profile and wrapped profile
    if "profile" in profile_data:
        profile = profile_data["profile"]
    else:
        profile = profile_data

    columns = profile.get("columns", {})
    if not columns:
        return json.dumps({
            "success": True,
            "anomalies": [],
            "summary": {
                "total_anomalies": 0,
                "critical": 0,
                "warning": 0,
                "info": 0,
            }
        })

    all_anomalies = []

    for col_name, col_stats in columns.items():
        col_type = col_stats.get("type", "unknown")

        # Build a mock series from the stats for anomaly detection
        # In practice, we'd pass the actual data, but here we use stats

        # For null rate, we can detect from stats directly
        missing_pct = col_stats.get("missing_pct", 0) * 100  # Convert from ratio to %
        if missing_pct > 20:
            severity = "critical" if missing_pct > 50 else "warning"
            all_anomalies.append({
                "column": col_name,
                "type": "high_null_rate",
                "method": "profile_stats",
                "value": round(missing_pct, 2),
                "threshold": 20,
                "severity": severity,
                "description": f"Column '{col_name}' has {missing_pct:.1f}% null values (threshold: 20%)"
            })

        # For numeric columns, check distribution stats
        if col_type in ("Numeric", "num"):
            std = col_stats.get("std")
            mean = col_stats.get("mean")
            min_val = col_stats.get("min")
            max_val = col_stats.get("max")

            # Check for potential outliers using range vs std
            if std is not None and std > 0 and mean is not None:
                # If range is >> 6 std devs, likely has outliers
                if min_val is not None and max_val is not None:
                    range_in_stds = (max_val - min_val) / std
                    if range_in_stds > 10:
                        all_anomalies.append({
                            "column": col_name,
                            "type": "potential_outliers",
                            "method": "range_check",
                            "value": round(range_in_stds, 2),
                            "threshold": 10,
                            "severity": "info",
                            "description": f"Column '{col_name}' has range spanning {range_in_stds:.1f} std devs - may have outliers"
                        })

        # For categorical columns, check cardinality
        if col_type in ("Categorical", "cat"):
            distinct_count = col_stats.get("distinct_count", 0)
            distinct_pct = col_stats.get("distinct_pct", 0) * 100

            if distinct_pct > 90 and distinct_count > 100:
                all_anomalies.append({
                    "column": col_name,
                    "type": "high_cardinality",
                    "method": "profile_stats",
                    "value": distinct_count,
                    "threshold": 100,
                    "severity": "info",
                    "description": f"Column '{col_name}' has high cardinality ({distinct_count} distinct, {distinct_pct:.1f}% unique)"
                })

    # Summarize anomalies
    summary = {
        "total_anomalies": len(all_anomalies),
        "critical": sum(1 for a in all_anomalies if a["severity"] == "critical"),
        "warning": sum(1 for a in all_anomalies if a["severity"] == "warning"),
        "info": sum(1 for a in all_anomalies if a["severity"] == "info"),
    }

    return json.dumps({
        "success": True,
        "anomalies": all_anomalies,
        "summary": summary,
    })


# Make detect_anomalies a Strands tool
try:
    from strands import tool
    detect_anomalies = tool(detect_anomalies)
except ImportError:
    # Allow module to work without strands for testing
    pass
