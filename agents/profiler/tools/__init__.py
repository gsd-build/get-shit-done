"""
Profiler Tools Module

Data connectors, profiling utilities, and anomaly detection.
"""

from .connectors import (
    DataConnector,
    IcebergConnector,
    RedshiftConnector,
    AthenaConnector,
    get_connector,
    ConnectorError,
)
from .profiler import profile_table, generate_profile
from .anomaly import (
    detect_anomalies,
    detect_numeric_anomalies,
    detect_categorical_anomalies,
)

__all__ = [
    # Connectors
    "DataConnector",
    "IcebergConnector",
    "RedshiftConnector",
    "AthenaConnector",
    "get_connector",
    "ConnectorError",
    # Profiler
    "profile_table",
    "generate_profile",
    # Anomaly detection
    "detect_anomalies",
    "detect_numeric_anomalies",
    "detect_categorical_anomalies",
]
