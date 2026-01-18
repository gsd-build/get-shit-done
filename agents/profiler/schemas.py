"""
Pydantic models for the Data Profiler.

Defines configuration and result schemas for data source connections.
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field


class DataSourceConfig(BaseModel):
    """Configuration for connecting to a data source."""

    source_type: Literal["iceberg", "redshift", "athena"] = Field(
        description="Type of data source"
    )
    connection_params: dict = Field(
        description="Connection parameters (region, workgroup, output_location, etc.)"
    )
    database: str = Field(description="Database name")
    table: str = Field(description="Table name")

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "source_type": "iceberg",
                    "connection_params": {"region": "us-east-1"},
                    "database": "my_database",
                    "table": "my_table",
                },
                {
                    "source_type": "redshift",
                    "connection_params": {
                        "workgroup": "default-workgroup",
                        "region": "us-east-1",
                    },
                    "database": "analytics",
                    "table": "orders",
                },
                {
                    "source_type": "athena",
                    "connection_params": {
                        "output_location": "s3://athena-results/",
                        "region": "us-east-1",
                    },
                    "database": "data_lake",
                    "table": "events",
                },
            ]
        }


class ConnectionTestResult(BaseModel):
    """Result of a connection test."""

    success: bool = Field(description="Whether the connection was successful")
    message: str = Field(description="Human-readable status message")
    row_count: Optional[int] = Field(
        default=None, description="Row count if connection succeeded"
    )

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "success": True,
                    "message": "Connected successfully. Table has 1,234,567 rows.",
                    "row_count": 1234567,
                },
                {
                    "success": False,
                    "message": "Connection failed: Access denied to Glue catalog",
                    "row_count": None,
                },
            ]
        }
