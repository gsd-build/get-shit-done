"""
Data Connectors for the Data Profiler.

Provides abstract base class and implementations for connecting to:
- Iceberg tables via PyIceberg with Glue catalog
- Redshift via Data API (serverless-friendly, async)
- Athena via boto3

All connectors implement a common interface for sampling, schema retrieval,
and row counting.
"""

from abc import ABC, abstractmethod
import time
from typing import Optional

import boto3
import pandas as pd

# Import schemas - support both package and direct execution
try:
    from ..schemas import DataSourceConfig, ConnectionTestResult
except ImportError:
    from agents.profiler.schemas import DataSourceConfig, ConnectionTestResult


class ConnectorError(Exception):
    """Custom exception for connector errors with helpful messages."""

    def __init__(self, message: str, source_type: str, original_error: Optional[Exception] = None):
        self.message = message
        self.source_type = source_type
        self.original_error = original_error
        super().__init__(f"[{source_type}] {message}")


class DataConnector(ABC):
    """
    Abstract base class for data source connectors.

    All connectors must implement:
    - get_sample: Retrieve a sample of data for profiling
    - get_schema: Get column names and types
    - get_row_count: Get total row count for sampling decisions
    - test_connection: Verify connectivity and return status
    """

    @abstractmethod
    def get_sample(self, limit: int = 10000) -> pd.DataFrame:
        """
        Get a sample of data for profiling.

        Args:
            limit: Maximum number of rows to retrieve (default 10000)

        Returns:
            DataFrame with sampled data

        Raises:
            ConnectorError: If sampling fails
        """
        pass

    @abstractmethod
    def get_schema(self) -> dict[str, str]:
        """
        Get table schema as column name to type mapping.

        Returns:
            Dict mapping column names to their data types

        Raises:
            ConnectorError: If schema retrieval fails
        """
        pass

    @abstractmethod
    def get_row_count(self) -> int:
        """
        Get total row count for the table.

        Returns:
            Total number of rows

        Raises:
            ConnectorError: If count fails
        """
        pass

    @abstractmethod
    def test_connection(self) -> ConnectionTestResult:
        """
        Test the connection and return status.

        Returns:
            ConnectionTestResult with success status, message, and optional row count
        """
        pass


class IcebergConnector(DataConnector):
    """
    Connector for Iceberg tables using PyIceberg with AWS Glue catalog.

    Uses PyIceberg to read Iceberg tables stored in S3, with metadata
    managed by AWS Glue Data Catalog.
    """

    def __init__(self, config: DataSourceConfig):
        """
        Initialize Iceberg connector.

        Args:
            config: DataSourceConfig with connection_params containing:
                - region: AWS region (default: us-east-1)
        """
        self.config = config
        self.region = config.connection_params.get("region", "us-east-1")
        self._catalog = None
        self._table = None

    def _get_catalog(self):
        """Lazy-load the Glue catalog."""
        if self._catalog is None:
            try:
                from pyiceberg.catalog import load_catalog

                self._catalog = load_catalog(
                    "default",
                    type="glue",
                    **{"client.region": self.region}
                )
            except ImportError as e:
                raise ConnectorError(
                    "PyIceberg not installed. Run: pip install 'pyiceberg[glue,pyarrow,pandas]'",
                    "iceberg",
                    e,
                )
            except Exception as e:
                raise ConnectorError(
                    f"Failed to connect to Glue catalog: {str(e)}",
                    "iceberg",
                    e,
                )
        return self._catalog

    def _get_table(self):
        """Lazy-load the Iceberg table."""
        if self._table is None:
            catalog = self._get_catalog()
            table_identifier = f"{self.config.database}.{self.config.table}"
            try:
                self._table = catalog.load_table(table_identifier)
            except Exception as e:
                raise ConnectorError(
                    f"Table not found: {table_identifier}. Error: {str(e)}",
                    "iceberg",
                    e,
                )
        return self._table

    def get_sample(self, limit: int = 10000) -> pd.DataFrame:
        """Get sample data from Iceberg table."""
        try:
            table = self._get_table()
            return table.scan(limit=limit).to_pandas()
        except ConnectorError:
            raise
        except Exception as e:
            raise ConnectorError(
                f"Failed to sample data: {str(e)}",
                "iceberg",
                e,
            )

    def get_schema(self) -> dict[str, str]:
        """Get schema from Iceberg table metadata."""
        try:
            table = self._get_table()
            return {
                field.name: str(field.field_type)
                for field in table.schema().fields
            }
        except ConnectorError:
            raise
        except Exception as e:
            raise ConnectorError(
                f"Failed to get schema: {str(e)}",
                "iceberg",
                e,
            )

    def get_row_count(self) -> int:
        """Get row count from Iceberg snapshot metadata."""
        try:
            table = self._get_table()
            snapshot = table.current_snapshot()
            if snapshot is None:
                return 0
            # Try to get from snapshot summary, fall back to 0
            summary = snapshot.summary or {}
            return int(summary.get("total-records", 0))
        except ConnectorError:
            raise
        except Exception as e:
            raise ConnectorError(
                f"Failed to get row count: {str(e)}",
                "iceberg",
                e,
            )

    def test_connection(self) -> ConnectionTestResult:
        """Test connection to Iceberg table."""
        try:
            schema = self.get_schema()
            row_count = self.get_row_count()
            return ConnectionTestResult(
                success=True,
                message=f"Connected successfully. Table has {row_count:,} rows and {len(schema)} columns.",
                row_count=row_count,
            )
        except ConnectorError as e:
            return ConnectionTestResult(
                success=False,
                message=str(e),
                row_count=None,
            )


class RedshiftConnector(DataConnector):
    """
    Connector for Redshift using the Data API.

    Uses async query execution with polling for serverless-friendly operation.
    No VPC required - works with Redshift Serverless workgroups.
    """

    DEFAULT_TIMEOUT = 300  # 5 minutes max query time

    def __init__(self, config: DataSourceConfig):
        """
        Initialize Redshift connector.

        Args:
            config: DataSourceConfig with connection_params containing:
                - workgroup: Redshift Serverless workgroup name
                - region: AWS region (default: us-east-1)
        """
        self.config = config
        self.region = config.connection_params.get("region", "us-east-1")
        self.workgroup = config.connection_params.get("workgroup")
        self.database = config.database
        self.table = config.table
        self._client = None

        if not self.workgroup:
            raise ConnectorError(
                "Missing required connection_param: workgroup",
                "redshift",
            )

    def _get_client(self):
        """Lazy-load the Redshift Data API client."""
        if self._client is None:
            try:
                self._client = boto3.client(
                    "redshift-data",
                    region_name=self.region,
                )
            except Exception as e:
                raise ConnectorError(
                    f"Failed to create Redshift Data API client: {str(e)}",
                    "redshift",
                    e,
                )
        return self._client

    def _execute_query(self, sql: str, timeout: int = DEFAULT_TIMEOUT) -> list:
        """
        Execute a query and wait for results.

        Args:
            sql: SQL query to execute
            timeout: Maximum seconds to wait for completion

        Returns:
            List of result records

        Raises:
            ConnectorError: If query fails or times out
        """
        client = self._get_client()

        try:
            # Execute the query
            response = client.execute_statement(
                WorkgroupName=self.workgroup,
                Database=self.database,
                Sql=sql,
            )
            query_id = response["Id"]
        except Exception as e:
            raise ConnectorError(
                f"Failed to execute query: {str(e)}",
                "redshift",
                e,
            )

        # Poll for completion
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                status = client.describe_statement(Id=query_id)
                state = status["Status"]

                if state == "FINISHED":
                    break
                elif state == "FAILED":
                    error_msg = status.get("Error", "Unknown error")
                    raise ConnectorError(
                        f"Query failed: {error_msg}",
                        "redshift",
                    )
                elif state == "ABORTED":
                    raise ConnectorError(
                        "Query was aborted",
                        "redshift",
                    )

                time.sleep(2)  # Poll every 2 seconds

            except ConnectorError:
                raise
            except Exception as e:
                raise ConnectorError(
                    f"Failed to check query status: {str(e)}",
                    "redshift",
                    e,
                )
        else:
            raise ConnectorError(
                f"Query timed out after {timeout} seconds",
                "redshift",
            )

        # Fetch results
        try:
            result = client.get_statement_result(Id=query_id)
            return result.get("Records", [])
        except Exception as e:
            raise ConnectorError(
                f"Failed to fetch query results: {str(e)}",
                "redshift",
                e,
            )

    def _records_to_dataframe(self, records: list, columns: list[str]) -> pd.DataFrame:
        """Convert Redshift Data API records to DataFrame."""
        rows = []
        for record in records:
            row = []
            for field in record:
                # Extract value from the typed field dict
                if "stringValue" in field:
                    row.append(field["stringValue"])
                elif "longValue" in field:
                    row.append(field["longValue"])
                elif "doubleValue" in field:
                    row.append(field["doubleValue"])
                elif "booleanValue" in field:
                    row.append(field["booleanValue"])
                elif "isNull" in field and field["isNull"]:
                    row.append(None)
                else:
                    row.append(None)
            rows.append(row)

        return pd.DataFrame(rows, columns=columns)

    def get_sample(self, limit: int = 10000) -> pd.DataFrame:
        """Get sample data from Redshift table."""
        sql = f"SELECT * FROM {self.table} LIMIT {limit}"
        records = self._execute_query(sql)

        # Get column names for DataFrame
        schema = self.get_schema()
        columns = list(schema.keys())

        return self._records_to_dataframe(records, columns)

    def get_schema(self) -> dict[str, str]:
        """Get schema from Redshift information_schema."""
        sql = f"""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = '{self.table}'
            ORDER BY ordinal_position
        """
        records = self._execute_query(sql)

        schema = {}
        for record in records:
            col_name = record[0].get("stringValue", "")
            col_type = record[1].get("stringValue", "")
            schema[col_name] = col_type

        return schema

    def get_row_count(self) -> int:
        """Get row count from Redshift table."""
        sql = f"SELECT COUNT(*) FROM {self.table}"
        records = self._execute_query(sql)

        if records and records[0]:
            return int(records[0][0].get("longValue", 0))
        return 0

    def test_connection(self) -> ConnectionTestResult:
        """Test connection to Redshift table."""
        try:
            schema = self.get_schema()
            row_count = self.get_row_count()
            return ConnectionTestResult(
                success=True,
                message=f"Connected successfully. Table has {row_count:,} rows and {len(schema)} columns.",
                row_count=row_count,
            )
        except ConnectorError as e:
            return ConnectionTestResult(
                success=False,
                message=str(e),
                row_count=None,
            )


class AthenaConnector(DataConnector):
    """
    Connector for Athena using boto3.

    Executes queries and reads results from S3 output location.
    """

    DEFAULT_TIMEOUT = 300  # 5 minutes max query time
    DEFAULT_OUTPUT_LOCATION = "s3://athena-results/"

    def __init__(self, config: DataSourceConfig):
        """
        Initialize Athena connector.

        Args:
            config: DataSourceConfig with connection_params containing:
                - output_location: S3 location for query results
                - region: AWS region (default: us-east-1)
        """
        self.config = config
        self.region = config.connection_params.get("region", "us-east-1")
        self.output_location = config.connection_params.get(
            "output_location",
            self.DEFAULT_OUTPUT_LOCATION,
        )
        self.database = config.database
        self.table = config.table
        self._client = None
        self._s3_client = None

    def _get_client(self):
        """Lazy-load the Athena client."""
        if self._client is None:
            try:
                self._client = boto3.client(
                    "athena",
                    region_name=self.region,
                )
            except Exception as e:
                raise ConnectorError(
                    f"Failed to create Athena client: {str(e)}",
                    "athena",
                    e,
                )
        return self._client

    def _get_s3_client(self):
        """Lazy-load the S3 client for reading results."""
        if self._s3_client is None:
            try:
                self._s3_client = boto3.client(
                    "s3",
                    region_name=self.region,
                )
            except Exception as e:
                raise ConnectorError(
                    f"Failed to create S3 client: {str(e)}",
                    "athena",
                    e,
                )
        return self._s3_client

    def _execute_query(self, sql: str, timeout: int = DEFAULT_TIMEOUT) -> str:
        """
        Execute a query and return the S3 results location.

        Args:
            sql: SQL query to execute
            timeout: Maximum seconds to wait for completion

        Returns:
            S3 URI of the results CSV

        Raises:
            ConnectorError: If query fails or times out
        """
        client = self._get_client()

        try:
            response = client.start_query_execution(
                QueryString=sql,
                QueryExecutionContext={"Database": self.database},
                ResultConfiguration={"OutputLocation": self.output_location},
            )
            execution_id = response["QueryExecutionId"]
        except Exception as e:
            raise ConnectorError(
                f"Failed to start query: {str(e)}",
                "athena",
                e,
            )

        # Poll for completion
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                status = client.get_query_execution(QueryExecutionId=execution_id)
                state = status["QueryExecution"]["Status"]["State"]

                if state == "SUCCEEDED":
                    return status["QueryExecution"]["ResultConfiguration"]["OutputLocation"]
                elif state == "FAILED":
                    reason = status["QueryExecution"]["Status"].get(
                        "StateChangeReason", "Unknown error"
                    )
                    raise ConnectorError(
                        f"Query failed: {reason}",
                        "athena",
                    )
                elif state == "CANCELLED":
                    raise ConnectorError(
                        "Query was cancelled",
                        "athena",
                    )

                time.sleep(2)  # Poll every 2 seconds

            except ConnectorError:
                raise
            except Exception as e:
                raise ConnectorError(
                    f"Failed to check query status: {str(e)}",
                    "athena",
                    e,
                )

        raise ConnectorError(
            f"Query timed out after {timeout} seconds",
            "athena",
        )

    def _read_s3_csv(self, s3_uri: str) -> pd.DataFrame:
        """Read CSV results from S3."""
        try:
            # Parse S3 URI
            if s3_uri.startswith("s3://"):
                path = s3_uri[5:]
                bucket = path.split("/")[0]
                key = "/".join(path.split("/")[1:])
            else:
                raise ConnectorError(
                    f"Invalid S3 URI: {s3_uri}",
                    "athena",
                )

            client = self._get_s3_client()
            response = client.get_object(Bucket=bucket, Key=key)
            return pd.read_csv(response["Body"])

        except ConnectorError:
            raise
        except Exception as e:
            raise ConnectorError(
                f"Failed to read results from S3: {str(e)}",
                "athena",
                e,
            )

    def get_sample(self, limit: int = 10000) -> pd.DataFrame:
        """Get sample data from Athena table."""
        sql = f'SELECT * FROM "{self.table}" LIMIT {limit}'
        result_location = self._execute_query(sql)
        return self._read_s3_csv(result_location)

    def get_schema(self) -> dict[str, str]:
        """Get schema from Athena information_schema."""
        sql = f"""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = '{self.database}'
            AND table_name = '{self.table}'
            ORDER BY ordinal_position
        """
        result_location = self._execute_query(sql)
        df = self._read_s3_csv(result_location)

        schema = {}
        for _, row in df.iterrows():
            schema[row["column_name"]] = row["data_type"]

        return schema

    def get_row_count(self) -> int:
        """Get row count from Athena table."""
        sql = f'SELECT COUNT(*) as cnt FROM "{self.table}"'
        result_location = self._execute_query(sql)
        df = self._read_s3_csv(result_location)

        if not df.empty:
            return int(df.iloc[0]["cnt"])
        return 0

    def test_connection(self) -> ConnectionTestResult:
        """Test connection to Athena table."""
        try:
            schema = self.get_schema()
            row_count = self.get_row_count()
            return ConnectionTestResult(
                success=True,
                message=f"Connected successfully. Table has {row_count:,} rows and {len(schema)} columns.",
                row_count=row_count,
            )
        except ConnectorError as e:
            return ConnectionTestResult(
                success=False,
                message=str(e),
                row_count=None,
            )


def get_connector(config: DataSourceConfig) -> DataConnector:
    """
    Factory function to get the appropriate connector for a data source.

    Args:
        config: DataSourceConfig specifying the source type and connection params

    Returns:
        Appropriate DataConnector implementation

    Raises:
        ValueError: If source_type is not supported
    """
    connectors = {
        "iceberg": IcebergConnector,
        "redshift": RedshiftConnector,
        "athena": AthenaConnector,
    }

    connector_class = connectors.get(config.source_type)
    if connector_class is None:
        raise ValueError(
            f"Unsupported source type: {config.source_type}. "
            f"Supported types: {list(connectors.keys())}"
        )

    return connector_class(config)
