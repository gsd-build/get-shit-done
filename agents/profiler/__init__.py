"""
Data Profiler Agent Module

Provides data connectors and profiling tools for the Data Foundations platform.
Supports Iceberg, Redshift, and Athena data sources.
"""

from .schemas import DataSourceConfig, ConnectionTestResult

__all__ = ["DataSourceConfig", "ConnectionTestResult"]
