-- Data Foundations Platform: Profile Schema
-- Migration: 001_profile_schema
-- Description: Creates tables for storing data source connections, profile results, and anomalies

-- ============================================================================
-- Table 1: data_sources
-- Stores connection configurations for Iceberg, Redshift, Athena
-- ============================================================================
CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('iceberg', 'redshift', 'athena')),
    connection_config JSONB NOT NULL,  -- Connection parameters (credentials stored in Secrets Manager)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE data_sources IS 'Connection configurations for data sources (Iceberg, Redshift, Athena)';
COMMENT ON COLUMN data_sources.connection_config IS 'JSONB with connection params (e.g., workgroup, database, region). Credentials reference Secrets Manager ARNs.';

-- ============================================================================
-- Table 2: datasets
-- Tables/views within data sources
-- ============================================================================
CREATE TABLE datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    database_name VARCHAR(255) NOT NULL,
    table_name VARCHAR(255) NOT NULL,
    schema_info JSONB,  -- Column names and types from source metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_id, database_name, table_name)
);

COMMENT ON TABLE datasets IS 'Tables/views within data sources that can be profiled';
COMMENT ON COLUMN datasets.schema_info IS 'Column schema from source: {column_name: data_type}';

-- ============================================================================
-- Table 3: profile_runs
-- Job tracking for profiling operations
-- ============================================================================
CREATE TYPE profile_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE profile_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    status profile_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    step_functions_execution_arn VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profile_runs IS 'Tracks profiling job execution status';
COMMENT ON COLUMN profile_runs.step_functions_execution_arn IS 'AWS Step Functions execution ARN for tracking';

-- ============================================================================
-- Table 4: profile_results
-- Summary metrics for completed profile runs
-- ============================================================================
CREATE TABLE profile_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES profile_runs(id) ON DELETE CASCADE,
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    row_count BIGINT,
    column_count INTEGER,
    sampled BOOLEAN NOT NULL DEFAULT FALSE,
    sample_size INTEGER,
    s3_full_profile_uri VARCHAR(500),  -- S3 location for full JSON profile (10-50MB)
    profiled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profile_results IS 'Summary metrics from completed profile runs';
COMMENT ON COLUMN profile_results.s3_full_profile_uri IS 'S3 URI for full ydata-profiling JSON output';

-- ============================================================================
-- Table 5: column_profiles
-- Per-column metrics from profiling
-- ============================================================================
CREATE TABLE column_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES profile_results(id) ON DELETE CASCADE,
    column_name VARCHAR(255) NOT NULL,
    inferred_type VARCHAR(50),  -- numeric, categorical, datetime, text, boolean
    null_count BIGINT,
    null_percentage DECIMAL(5,2),
    distinct_count BIGINT,
    distinct_percentage DECIMAL(5,2),
    -- Numeric statistics (NULL for non-numeric columns)
    min_value DECIMAL(30,10),
    max_value DECIMAL(30,10),
    mean_value DECIMAL(30,10),
    median_value DECIMAL(30,10),
    std_dev DECIMAL(30,10),
    -- Categorical statistics (NULL for numeric columns)
    top_values JSONB,  -- Array of {value: string, count: int, percentage: decimal}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE column_profiles IS 'Per-column statistics from profiling';
COMMENT ON COLUMN column_profiles.top_values IS 'Top N most frequent values with counts';

-- ============================================================================
-- Table 6: profile_anomalies
-- Detected statistical anomalies
-- ============================================================================
CREATE TYPE anomaly_severity AS ENUM ('info', 'warning', 'critical');

CREATE TABLE profile_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES profile_results(id) ON DELETE CASCADE,
    column_name VARCHAR(255),  -- NULL for table-level anomalies
    anomaly_type VARCHAR(100) NOT NULL,  -- high_null_rate, high_outlier_rate, high_cardinality, etc.
    severity anomaly_severity NOT NULL,
    description TEXT,
    value DECIMAL(30,10),
    threshold DECIMAL(30,10),
    metadata JSONB,  -- Additional context (method used, bounds, etc.)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profile_anomalies IS 'Detected anomalies from statistical analysis';
COMMENT ON COLUMN profile_anomalies.anomaly_type IS 'Type: high_null_rate, high_outlier_rate, high_cardinality, single_value_dominance';

-- ============================================================================
-- Indexes for common queries
-- ============================================================================
CREATE INDEX idx_profile_runs_dataset ON profile_runs(dataset_id);
CREATE INDEX idx_profile_runs_status ON profile_runs(status);
CREATE INDEX idx_profile_results_dataset ON profile_results(dataset_id);
CREATE INDEX idx_column_profiles_result ON column_profiles(result_id);
CREATE INDEX idx_anomalies_result ON profile_anomalies(result_id);
CREATE INDEX idx_anomalies_severity ON profile_anomalies(severity);
CREATE INDEX idx_datasets_source ON datasets(source_id);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE column_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_anomalies ENABLE ROW LEVEL SECURITY;

-- SELECT policies: All authenticated users can view (internal platform)
CREATE POLICY "Authenticated users can view data sources"
    ON data_sources FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can view datasets"
    ON datasets FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can view profile runs"
    ON profile_runs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can view profile results"
    ON profile_results FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can view column profiles"
    ON column_profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can view profile anomalies"
    ON profile_anomalies FOR SELECT
    TO authenticated
    USING (true);

-- INSERT/UPDATE/DELETE policies for data_sources (user management)
CREATE POLICY "Authenticated users can insert data sources"
    ON data_sources FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update data sources"
    ON data_sources FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete data sources"
    ON data_sources FOR DELETE
    TO authenticated
    USING (true);

-- INSERT policies for profiler operations (datasets, runs, results, profiles, anomalies)
-- These are typically inserted by the backend service, not directly by users
CREATE POLICY "Authenticated users can insert datasets"
    ON datasets FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can insert profile runs"
    ON profile_runs FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can insert profile results"
    ON profile_results FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can insert column profiles"
    ON column_profiles FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can insert profile anomalies"
    ON profile_anomalies FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE policy for profile_runs (status updates)
CREATE POLICY "Authenticated users can update profile runs"
    ON profile_runs FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- Trigger: Auto-update updated_at on data_sources
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_data_sources_updated_at
    BEFORE UPDATE ON data_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
