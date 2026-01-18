# Phase 1: Foundation & Data Profiling - Research

**Researched:** 2026-01-18
**Domain:** Data source connectivity, automated profiling, anomaly detection
**Confidence:** HIGH (verified with official AWS docs, ydata-profiling docs, Strands SDK)

## Summary

Phase 1 establishes the foundational infrastructure for the Data Reply Agentic Platform, enabling users to connect data sources (S3/Iceberg, Athena, Redshift) and view automated profiling insights. The core challenge is building reliable data connectors and a profiling pipeline that can handle varied dataset sizes efficiently.

The standard approach uses:
- **PyIceberg** for S3/Iceberg tables with AWS Glue catalog
- **Redshift Data API** for Redshift connectivity (async, serverless-friendly)
- **Athena via boto3** for ad-hoc queries and Iceberg table access
- **ydata-profiling** for automated statistics generation with minimal mode for large datasets
- **AWS Fargate** for profiler compute (120GB RAM vs Lambda's 10GB limit)
- **Strands Agents SDK** for the profiler agent structure
- **Supabase PostgreSQL** for storing profile metadata and results

**Primary recommendation:** Start with a Fargate-based profiler agent that uses ydata-profiling in minimal mode, stores results in Supabase, and orchestrates via Step Functions. Use sampling for large datasets (>1M rows).

---

## Standard Stack

The established libraries and tools for Phase 1 implementation.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **PyIceberg** | 0.10.x+ | S3/Iceberg table access | Official Python Iceberg client, no JVM, native Glue catalog support |
| **ydata-profiling** | 4.18.x+ | Data profiling & statistics | Industry standard for EDA, supports pandas/Spark, JSON output |
| **Strands Agents SDK** | 1.x | Agent framework | AWS-native, Bedrock-optimized, simple tool decorator pattern |
| **boto3** | 1.35.x+ | AWS SDK | Required for Athena, Redshift Data API, S3 access |
| **Supabase-py** | 2.x | Database client | For storing profile results in PostgreSQL |
| **Next.js** | 15.x | Frontend framework | App Router, React Server Components |
| **TanStack Query** | 5.x | Server state management | Caching, SSR support for profile data |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **pyarrow** | 18.x+ | Columnar data processing | Reading Iceberg/Parquet efficiently |
| **pandas** | 2.x | DataFrame operations | Data manipulation for profiling |
| **scipy** | 1.x | Statistical functions | Z-score, IQR for anomaly detection |
| **numpy** | 2.x | Numerical computing | Statistical calculations |
| **aws-lambda-powertools** | 3.x | Lambda observability | Logging, tracing, metrics |
| **shadcn/ui** | Latest | UI components | Dashboard components |
| **Recharts** | 2.x | Charts | Profile visualizations |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ydata-profiling | Great Expectations | GE is more for validation than profiling; ydata generates better EDA reports |
| ydata-profiling | Custom pandas stats | Reinventing the wheel; ydata handles edge cases |
| Fargate | Lambda | Lambda has 15min/10GB limits; Fargate handles larger datasets |
| PyIceberg | Spark/EMR | Overkill for profiling; PyIceberg is lighter weight |
| Strands Agents | LangChain | LangChain over-abstracted; Strands is simpler, AWS-native |

**Installation:**

```bash
# Python (Lambda/Fargate layer)
pip install "pyiceberg[glue,pyarrow,pandas]>=0.10.0"
pip install ydata-profiling>=4.18.0
pip install strands-agents>=1.0.0
pip install boto3>=1.35.0
pip install scipy numpy pandas

# Frontend
npm install next@15 @tanstack/react-query@5 zod recharts @supabase/supabase-js
npx shadcn@latest init
```

---

## Architecture Patterns

### Recommended Project Structure

```
/
├── infra/                      # AWS CDK infrastructure
│   ├── lib/
│   │   ├── profiler-stack.ts   # Fargate + Step Functions
│   │   └── data-stack.ts       # Supabase, S3 config
│   └── bin/
│       └── app.ts
├── agents/                     # Python agent code
│   └── profiler/
│       ├── agent.py            # Strands agent definition
│       ├── tools/
│       │   ├── connectors.py   # Data source connectors
│       │   ├── profiler.py     # ydata-profiling wrapper
│       │   └── anomaly.py      # Statistical anomaly detection
│       ├── schemas.py          # Pydantic models
│       └── Dockerfile
├── frontend/                   # Next.js app
│   ├── src/
│   │   ├── app/               # App Router routes
│   │   │   ├── (dashboard)/
│   │   │   │   ├── sources/   # Data source management
│   │   │   │   └── profiles/  # Profile results views
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/            # shadcn components
│   │   │   └── features/
│   │   │       └── profiles/  # Profile-specific components
│   │   ├── lib/
│   │   │   ├── supabase.ts    # Supabase client
│   │   │   └── api.ts         # API helpers
│   │   └── hooks/             # TanStack Query hooks
│   └── next.config.js
└── supabase/
    └── migrations/            # Database schema
```

### Pattern 1: Data Source Connector Abstraction

**What:** Abstract data source connections behind a common interface.
**When to use:** Always - enables consistent profiling across Iceberg, Redshift, Athena.

```python
# Source: AWS Prescriptive Guidance - PyIceberg patterns
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
import pandas as pd

@dataclass
class DataSourceConfig:
    source_type: str  # 'iceberg', 'redshift', 'athena'
    connection_params: dict
    database: str
    table: str

class DataConnector(ABC):
    @abstractmethod
    def get_sample(self, limit: int = 10000) -> pd.DataFrame:
        """Get sample data for profiling"""
        pass

    @abstractmethod
    def get_schema(self) -> dict:
        """Get table schema/column metadata"""
        pass

    @abstractmethod
    def get_row_count(self) -> int:
        """Get total row count for sampling decisions"""
        pass

class IcebergConnector(DataConnector):
    def __init__(self, config: DataSourceConfig):
        from pyiceberg.catalog import load_catalog
        self.catalog = load_catalog(
            'default',
            type='glue',
            **{'client.region': config.connection_params.get('region', 'us-east-1')}
        )
        self.table = self.catalog.load_table(f"{config.database}.{config.table}")

    def get_sample(self, limit: int = 10000) -> pd.DataFrame:
        return self.table.scan(limit=limit).to_pandas()

    def get_schema(self) -> dict:
        return {field.name: str(field.field_type) for field in self.table.schema().fields}

    def get_row_count(self) -> int:
        # Use snapshot metadata for approximate count
        return self.table.current_snapshot().summary.get('total-records', 0)
```

### Pattern 2: Profiler Agent with Strands

**What:** Define the Data Profiler as a Strands agent with tools.
**When to use:** For orchestrated profiling workflows.

```python
# Source: Strands Agents SDK documentation
from strands import Agent, tool
from strands.models.bedrock import BedrockModel
from ydata_profiling import ProfileReport
import json

@tool
def profile_table(
    source_type: str,
    connection_params: str,  # JSON string
    database: str,
    table: str,
    sample_size: int = 10000
) -> str:
    """
    Profile a data table and return statistics.

    Args:
        source_type: One of 'iceberg', 'redshift', 'athena'
        connection_params: JSON string with connection details
        database: Database name
        table: Table name
        sample_size: Number of rows to sample (default 10000)

    Returns:
        JSON string with profile statistics
    """
    config = DataSourceConfig(
        source_type=source_type,
        connection_params=json.loads(connection_params),
        database=database,
        table=table
    )

    connector = get_connector(config)  # Factory function
    df = connector.get_sample(limit=sample_size)

    # Use minimal mode for performance
    profile = ProfileReport(df, minimal=True, title=f"{database}.{table}")
    return profile.to_json()

@tool
def detect_anomalies(profile_json: str) -> str:
    """
    Analyze profile results and flag statistical anomalies.

    Args:
        profile_json: JSON string from profile_table tool

    Returns:
        JSON string with detected anomalies
    """
    # Parse and analyze for anomalies
    profile = json.loads(profile_json)
    anomalies = analyze_for_anomalies(profile)
    return json.dumps(anomalies)

# Agent definition
model = BedrockModel(
    model_id="anthropic.claude-sonnet-4-20250514",
    region_name="us-east-1"
)

profiler_agent = Agent(
    model=model,
    system_prompt="""You are a Data Profiler agent. Your job is to:
1. Connect to data sources and profile tables
2. Generate statistics including nulls, distinct counts, distributions
3. Detect and flag statistical anomalies
4. Provide clear summaries of data quality findings

Always use the profile_table tool first, then detect_anomalies to analyze results.""",
    tools=[profile_table, detect_anomalies]
)
```

### Pattern 3: Step Functions Orchestration for Profiling

**What:** Use Step Functions to orchestrate Fargate profiler tasks.
**When to use:** Production profiling workflows with retry/error handling.

```yaml
# State machine definition (ASL)
Comment: "Data Profiler Workflow"
StartAt: ValidateInput
States:
  ValidateInput:
    Type: Choice
    Choices:
      - Variable: "$.sourceType"
        IsPresent: true
        Next: RunProfiler
    Default: FailInvalidInput

  RunProfiler:
    Type: Task
    Resource: "arn:aws:states:::ecs:runTask.sync"
    Parameters:
      Cluster: "${EcsCluster}"
      TaskDefinition: "${ProfilerTaskDef}"
      LaunchType: FARGATE
      NetworkConfiguration:
        AwsvpcConfiguration:
          Subnets: ["${SubnetA}", "${SubnetB}"]
          SecurityGroups: ["${SecurityGroup}"]
      Overrides:
        ContainerOverrides:
          - Name: profiler
            Environment:
              - Name: SOURCE_TYPE
                Value.$: "$.sourceType"
              - Name: DATABASE
                Value.$: "$.database"
              - Name: TABLE
                Value.$: "$.table"
    ResultPath: "$.profileResult"
    Retry:
      - ErrorEquals: ["States.TaskFailed"]
        MaxAttempts: 2
        IntervalSeconds: 30
        BackoffRate: 2
    Catch:
      - ErrorEquals: ["States.ALL"]
        Next: HandleError
    Next: StoreResults

  StoreResults:
    Type: Task
    Resource: "arn:aws:lambda:invoke"
    Parameters:
      FunctionName: "${StoreProfileFunction}"
      Payload.$: "$"
    End: true

  HandleError:
    Type: Task
    Resource: "arn:aws:states:::sns:publish"
    Parameters:
      TopicArn: "${AlertTopic}"
      Message.$: "States.Format('Profile failed: {}', $.Error)"
    Next: FailState

  FailInvalidInput:
    Type: Fail
    Error: "InvalidInput"

  FailState:
    Type: Fail
```

### Anti-Patterns to Avoid

- **Running ydata-profiling on full datasets:** Always sample large datasets (>100K rows) or use minimal mode
- **Lambda for profiling:** Lambda's 10GB memory limit is insufficient for moderate datasets; use Fargate
- **Synchronous profiling API:** Profiling takes minutes; use async job pattern with polling
- **Storing raw profiles in PostgreSQL:** Store summary metrics; use S3 for full JSON profiles

---

## Don't Hand-Roll

Problems that look simple but have existing solutions.

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data profiling statistics | Custom pandas aggregations | ydata-profiling | Handles edge cases (nulls, mixed types, distributions) automatically |
| Iceberg table reading | Custom S3/Parquet parsing | PyIceberg | Schema evolution, time travel, metadata handled correctly |
| Redshift queries from Lambda | Direct psycopg2 connections | Redshift Data API | Connection pooling, async execution, no VPC required |
| Statistical anomaly detection | Custom outlier detection | scipy.stats z-score + IQR | Battle-tested, handles edge cases |
| Agent tool orchestration | Custom async/await loops | Strands Agents SDK | Tool calling, model abstraction, error handling built-in |
| Frontend data fetching | Raw fetch + useState | TanStack Query | Caching, deduplication, SSR hydration |

**Key insight:** ydata-profiling handles dozens of edge cases in data profiling (null handling, categorical vs numeric detection, histogram binning, correlation computation) that would take weeks to build correctly.

---

## Common Pitfalls

### Pitfall 1: Lambda Memory Exhaustion During Profiling

**What goes wrong:** Teams try to run ydata-profiling in Lambda, hit 10GB memory limit on moderate datasets.
**Why it happens:** A 1M row DataFrame with 50 columns can easily exceed 10GB when computing correlations.
**How to avoid:**
- Use AWS Fargate (up to 120GB RAM) for profiler compute
- Always use `minimal=True` mode in ydata-profiling
- Sample datasets >100K rows to 10K-50K for profiling
**Warning signs:** Lambda timeout errors, out-of-memory exceptions

### Pitfall 2: Synchronous Profiling API Timeouts

**What goes wrong:** Frontend calls profiling API, waits, times out after 30 seconds.
**Why it happens:** Profiling takes 1-10 minutes depending on dataset size.
**How to avoid:**
- Implement async job pattern: POST returns job_id, client polls for completion
- Use Step Functions to manage workflow state
- Consider WebSocket/Supabase Realtime for status updates
**Warning signs:** 504 Gateway Timeout errors, users refreshing page repeatedly

### Pitfall 3: Athena Query Costs Spiral

**What goes wrong:** Profiling queries scan full tables repeatedly, generating large Athena bills.
**Why it happens:** Athena charges per data scanned; profiling queries are expensive.
**How to avoid:**
- Use LIMIT clauses and sampling
- Cache profile results aggressively
- Prefer PyIceberg direct reads over Athena for Iceberg tables
- Set up Athena workgroup cost limits
**Warning signs:** Unexpected AWS bills, slow query performance

### Pitfall 4: Redshift Connection Pool Exhaustion

**What goes wrong:** Multiple concurrent profiles exhaust Redshift connection limits.
**Why it happens:** Direct psycopg2 connections don't pool, each profile opens new connection.
**How to avoid:**
- Use Redshift Data API (manages connections internally)
- Limit concurrent profiling jobs via Step Functions
- Use connection pooling if direct connections required
**Warning signs:** "too many connections" errors, Redshift performance degradation

### Pitfall 5: Profile Results Too Large for PostgreSQL

**What goes wrong:** Full ydata-profiling JSON stored in Supabase, queries slow, storage explodes.
**Why it happens:** Full profiles can be 10-50MB JSON per table.
**How to avoid:**
- Store summary metrics in PostgreSQL (see schema below)
- Store full JSON profiles in S3
- Keep S3 reference in PostgreSQL for retrieval
**Warning signs:** Slow dashboard queries, PostgreSQL storage alerts

---

## Code Examples

### Redshift Data API Connector

```python
# Source: AWS Documentation - Redshift Data API
import boto3
import time
from typing import Optional

class RedshiftConnector(DataConnector):
    def __init__(self, config: DataSourceConfig):
        self.client = boto3.client('redshift-data')
        self.workgroup = config.connection_params.get('workgroup')
        self.database = config.database
        self.table = config.table

    def _execute_query(self, sql: str, timeout: int = 300) -> list:
        """Execute query and wait for results"""
        response = self.client.execute_statement(
            WorkgroupName=self.workgroup,
            Database=self.database,
            Sql=sql
        )
        query_id = response['Id']

        # Poll for completion
        start = time.time()
        while time.time() - start < timeout:
            status = self.client.describe_statement(Id=query_id)
            if status['Status'] == 'FINISHED':
                break
            elif status['Status'] == 'FAILED':
                raise Exception(f"Query failed: {status.get('Error')}")
            time.sleep(2)

        # Fetch results
        results = self.client.get_statement_result(Id=query_id)
        return results['Records']

    def get_sample(self, limit: int = 10000) -> pd.DataFrame:
        sql = f"SELECT * FROM {self.table} LIMIT {limit}"
        records = self._execute_query(sql)
        # Convert to DataFrame (simplified)
        return self._records_to_dataframe(records)

    def get_schema(self) -> dict:
        sql = f"""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = '{self.table}'
        """
        records = self._execute_query(sql)
        return {r[0]['stringValue']: r[1]['stringValue'] for r in records}

    def get_row_count(self) -> int:
        sql = f"SELECT COUNT(*) FROM {self.table}"
        records = self._execute_query(sql)
        return int(records[0][0]['longValue'])
```

### Athena Connector via boto3

```python
# Source: boto3 Athena documentation
import boto3
import time
import pandas as pd

class AthenaConnector(DataConnector):
    def __init__(self, config: DataSourceConfig):
        self.client = boto3.client('athena')
        self.database = config.database
        self.table = config.table
        self.output_location = config.connection_params.get(
            'output_location',
            's3://athena-results-bucket/'
        )

    def _execute_query(self, sql: str, timeout: int = 300) -> str:
        """Execute query, return S3 results location"""
        response = self.client.start_query_execution(
            QueryString=sql,
            QueryExecutionContext={'Database': self.database},
            ResultConfiguration={'OutputLocation': self.output_location}
        )
        execution_id = response['QueryExecutionId']

        # Poll for completion
        start = time.time()
        while time.time() - start < timeout:
            status = self.client.get_query_execution(
                QueryExecutionId=execution_id
            )
            state = status['QueryExecution']['Status']['State']
            if state == 'SUCCEEDED':
                return status['QueryExecution']['ResultConfiguration']['OutputLocation']
            elif state in ['FAILED', 'CANCELLED']:
                raise Exception(f"Query {state}: {status['QueryExecution']['Status'].get('StateChangeReason')}")
            time.sleep(2)

        raise TimeoutError("Query execution timed out")

    def get_sample(self, limit: int = 10000) -> pd.DataFrame:
        sql = f"SELECT * FROM {self.table} LIMIT {limit}"
        result_location = self._execute_query(sql)
        # Read CSV results from S3
        return pd.read_csv(result_location)
```

### Statistical Anomaly Detection

```python
# Source: scipy documentation, statistical best practices
import numpy as np
from scipy import stats
from typing import List, Dict, Any

def detect_numeric_anomalies(series: pd.Series, column_name: str) -> List[Dict[str, Any]]:
    """Detect anomalies in numeric column using Z-score and IQR"""
    anomalies = []

    # Skip if too few values
    if len(series.dropna()) < 10:
        return anomalies

    clean_series = series.dropna()

    # Z-score method (good for normal distributions)
    z_scores = np.abs(stats.zscore(clean_series))
    z_outlier_pct = (z_scores > 3).sum() / len(z_scores) * 100

    if z_outlier_pct > 5:  # More than 5% outliers
        anomalies.append({
            'column': column_name,
            'type': 'high_outlier_rate',
            'method': 'z-score',
            'value': round(z_outlier_pct, 2),
            'threshold': 5,
            'severity': 'warning' if z_outlier_pct < 10 else 'critical',
            'description': f'{z_outlier_pct:.1f}% of values are statistical outliers (>3 std dev)'
        })

    # IQR method (robust to non-normal distributions)
    Q1 = clean_series.quantile(0.25)
    Q3 = clean_series.quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR

    iqr_outliers = ((clean_series < lower_bound) | (clean_series > upper_bound)).sum()
    iqr_outlier_pct = iqr_outliers / len(clean_series) * 100

    if iqr_outlier_pct > 10:
        anomalies.append({
            'column': column_name,
            'type': 'high_outlier_rate',
            'method': 'IQR',
            'value': round(iqr_outlier_pct, 2),
            'threshold': 10,
            'severity': 'warning',
            'description': f'{iqr_outlier_pct:.1f}% of values outside IQR bounds'
        })

    # High null rate
    null_pct = series.isna().sum() / len(series) * 100
    if null_pct > 20:
        anomalies.append({
            'column': column_name,
            'type': 'high_null_rate',
            'value': round(null_pct, 2),
            'threshold': 20,
            'severity': 'warning' if null_pct < 50 else 'critical',
            'description': f'{null_pct:.1f}% null values detected'
        })

    return anomalies

def detect_categorical_anomalies(series: pd.Series, column_name: str) -> List[Dict[str, Any]]:
    """Detect anomalies in categorical column"""
    anomalies = []

    # High cardinality
    cardinality = series.nunique()
    cardinality_ratio = cardinality / len(series)

    if cardinality_ratio > 0.9 and cardinality > 100:
        anomalies.append({
            'column': column_name,
            'type': 'high_cardinality',
            'value': cardinality,
            'ratio': round(cardinality_ratio, 3),
            'severity': 'info',
            'description': f'Very high cardinality ({cardinality} unique values) - may be an ID column'
        })

    # Single value dominance
    value_counts = series.value_counts(normalize=True)
    if len(value_counts) > 0 and value_counts.iloc[0] > 0.95:
        anomalies.append({
            'column': column_name,
            'type': 'single_value_dominance',
            'value': round(value_counts.iloc[0] * 100, 2),
            'dominant_value': str(value_counts.index[0]),
            'severity': 'warning',
            'description': f'{value_counts.iloc[0]*100:.1f}% of values are "{value_counts.index[0]}"'
        })

    return anomalies
```

### ydata-profiling Wrapper with Minimal Mode

```python
# Source: ydata-profiling documentation
from ydata_profiling import ProfileReport
import json
from typing import Dict, Any

def generate_profile(
    df: pd.DataFrame,
    table_name: str,
    sample_threshold: int = 100000
) -> Dict[str, Any]:
    """
    Generate profile with appropriate settings based on dataset size.

    Returns dict with:
    - summary: Key metrics for storage in PostgreSQL
    - full_profile: Complete profile JSON for S3
    """
    row_count = len(df)

    # Sample if needed
    if row_count > sample_threshold:
        df = df.sample(n=sample_threshold, random_state=42)
        sampled = True
    else:
        sampled = False

    # Always use minimal mode for performance
    profile = ProfileReport(
        df,
        minimal=True,
        title=table_name,
        explorative=False,
        correlations={
            "auto": {"calculate": False},
            "pearson": {"calculate": True},
            "spearman": {"calculate": False}
        }
    )

    # Get full JSON
    full_profile_json = profile.to_json()
    full_profile = json.loads(full_profile_json)

    # Extract summary for PostgreSQL storage
    summary = {
        'table_name': table_name,
        'row_count': row_count,
        'sampled': sampled,
        'sample_size': len(df) if sampled else None,
        'column_count': len(df.columns),
        'variables': {}
    }

    # Extract per-column metrics
    for var_name, var_data in full_profile.get('variables', {}).items():
        summary['variables'][var_name] = {
            'type': var_data.get('type'),
            'n_missing': var_data.get('n_missing', 0),
            'p_missing': var_data.get('p_missing', 0),
            'n_distinct': var_data.get('n_distinct', 0),
            'p_distinct': var_data.get('p_distinct', 0),
            # Numeric columns
            'mean': var_data.get('mean'),
            'std': var_data.get('std'),
            'min': var_data.get('min'),
            'max': var_data.get('max'),
            'median': var_data.get('50%'),
        }

    return {
        'summary': summary,
        'full_profile': full_profile
    }
```

---

## Database Schema for Profile Results

```sql
-- Supabase PostgreSQL schema for profile metadata

-- Data sources (connections)
CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL,  -- 'iceberg', 'redshift', 'athena'
    connection_config JSONB NOT NULL,  -- Encrypted connection params
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Datasets (tables within sources)
CREATE TABLE datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
    database_name VARCHAR(255) NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    schema_info JSONB,  -- Column names and types
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_id, database_name, table_name)
);

-- Profile runs (job tracking)
CREATE TABLE profile_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    step_functions_execution_arn VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profile results (summary metrics)
CREATE TABLE profile_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES profile_runs(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
    row_count BIGINT,
    column_count INTEGER,
    sampled BOOLEAN DEFAULT FALSE,
    sample_size INTEGER,
    s3_full_profile_uri VARCHAR(500),  -- S3 location for full JSON
    profiled_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column-level profile metrics
CREATE TABLE column_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID REFERENCES profile_results(id) ON DELETE CASCADE,
    column_name VARCHAR(255) NOT NULL,
    inferred_type VARCHAR(50),  -- numeric, categorical, datetime, text, etc.
    null_count BIGINT,
    null_percentage DECIMAL(5,2),
    distinct_count BIGINT,
    distinct_percentage DECIMAL(5,2),
    -- Numeric stats (null for non-numeric)
    min_value DECIMAL(30,10),
    max_value DECIMAL(30,10),
    mean_value DECIMAL(30,10),
    median_value DECIMAL(30,10),
    std_dev DECIMAL(30,10),
    -- Categorical stats (null for numeric)
    top_values JSONB,  -- [{value, count, percentage}]
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Detected anomalies
CREATE TABLE profile_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID REFERENCES profile_results(id) ON DELETE CASCADE,
    column_name VARCHAR(255),
    anomaly_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,  -- info, warning, critical
    description TEXT,
    value DECIMAL(30,10),
    threshold DECIMAL(30,10),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_profile_runs_dataset ON profile_runs(dataset_id);
CREATE INDEX idx_profile_runs_status ON profile_runs(status);
CREATE INDEX idx_profile_results_dataset ON profile_results(dataset_id);
CREATE INDEX idx_column_profiles_result ON column_profiles(result_id);
CREATE INDEX idx_anomalies_result ON profile_anomalies(result_id);
CREATE INDEX idx_anomalies_severity ON profile_anomalies(severity);

-- RLS policies
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE column_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_anomalies ENABLE ROW LEVEL SECURITY;

-- Example policy (adjust based on auth strategy)
CREATE POLICY "Users can view all sources" ON data_sources
    FOR SELECT USING (true);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pandas-profiling | ydata-profiling | 2023 | Same package, renamed |
| Direct database connections | Data APIs (Redshift, Athena) | 2022-2023 | No VPC required, better for Lambda/Fargate |
| Custom profiling code | ydata-profiling with minimal mode | 2024 | Standardized statistics, JSON output |
| Lambda for profiling | Fargate for memory-intensive | Ongoing | 10GB vs 120GB RAM limit |
| Synchronous profiling | Async job pattern | Best practice | Better UX for long-running tasks |

**Deprecated/outdated:**
- **pandas-profiling** package name: Use `ydata-profiling` instead (same library, renamed)
- **Direct Redshift connections from Lambda**: Use Data API instead
- **Custom correlation computation**: ydata-profiling handles this correctly

---

## Open Questions

1. **Authentication Flow for Internal Users**
   - What we know: AWS IAM/SSO is the requirement, Cognito can federate
   - What's unclear: Exact integration pattern between Next.js on Vercel and AWS IAM
   - Recommendation: Use Cognito as identity broker, configure SAML with IAM Identity Center

2. **Profiler Compute Sizing**
   - What we know: Fargate supports up to 120GB RAM
   - What's unclear: Exact memory requirements for typical Data Reply datasets
   - Recommendation: Start with 8GB RAM, 2 vCPU; monitor and scale based on actual usage

3. **Profile Freshness Strategy**
   - What we know: Profiles become stale as data changes
   - What's unclear: How often to re-profile, manual vs automatic triggers
   - Recommendation: Start with manual triggers; add scheduled re-profiling in later phase

---

## Sources

### Primary (HIGH confidence)
- [ydata-profiling Official Documentation](https://docs.profiling.ydata.ai/latest/) - Features, configuration, big data handling
- [ydata-profiling Minimal Config](https://github.com/ydataai/ydata-profiling/blob/master/src/ydata_profiling/config_minimal.yaml) - Exact minimal mode settings
- [AWS Prescriptive Guidance - PyIceberg](https://docs.aws.amazon.com/prescriptive-guidance/latest/apache-iceberg-on-aws/iceberg-pyiceberg.html) - PyIceberg connection patterns
- [AWS Redshift Data API](https://docs.aws.amazon.com/redshift/latest/mgmt/data-api.html) - Async query execution
- [Strands Agents SDK GitHub](https://github.com/strands-agents/sdk-python) - Agent and tool patterns
- [AWS Step Functions ECS Integration](https://docs.aws.amazon.com/step-functions/latest/dg/connect-ecs.html) - Fargate orchestration

### Secondary (MEDIUM confidence)
- [AWS Blog - PyIceberg with Lambda](https://aws.amazon.com/blogs/big-data/accelerate-lightweight-analytics-using-pyiceberg-with-aws-lambda-and-an-aws-glue-iceberg-rest-endpoint/) - Lambda integration patterns
- [AWS Decision Guide - Fargate vs Lambda](https://docs.aws.amazon.com/decision-guides/latest/fargate-or-lambda/fargate-or-lambda.html) - Memory/compute comparison
- [Next.js Project Structure](https://nextjs.org/docs/app/getting-started/project-structure) - App Router patterns
- [Strands Agents Blog](https://aws.amazon.com/blogs/opensource/introducing-strands-agents-an-open-source-ai-agents-sdk/) - SDK introduction

### Tertiary (LOW confidence)
- WebSearch results for statistical anomaly detection patterns - validated against scipy documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified with official documentation, widely adopted
- Architecture patterns: HIGH - AWS best practices, documented integration patterns
- Database schema: MEDIUM - Based on data quality platform patterns, may need adjustment
- Anomaly detection: MEDIUM - Statistical methods verified, thresholds may need tuning

**Research date:** 2026-01-18
**Valid until:** 60 days (stable domain, slow-moving)
