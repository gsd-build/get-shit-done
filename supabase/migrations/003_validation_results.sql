-- Data Foundations Platform: Validation Results Schema
-- Migration: 003_validation_results
-- Description: Creates tables for validation runs, results, quality scores, alerts, and freshness SLAs

-- ============================================================================
-- Table 1: validation_runs
-- Job execution tracking for data quality validations
-- ============================================================================
CREATE TABLE validation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,

    -- Execution details
    glue_run_id VARCHAR(255),
    step_function_execution_arn VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Trigger info
    triggered_by VARCHAR(50),  -- scheduled, manual, pipeline, event
    trigger_details JSONB,

    -- Results summary
    overall_score DECIMAL(5,4),  -- 0.0000 to 1.0000
    rules_evaluated INTEGER,
    rules_passed INTEGER,
    rules_failed INTEGER,

    -- Storage reference
    s3_results_uri VARCHAR(500),  -- Full results in S3

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_validation_status CHECK (status IN (
        'pending', 'running', 'completed', 'failed'
    )),
    CONSTRAINT valid_triggered_by CHECK (triggered_by IN (
        'scheduled', 'manual', 'pipeline', 'event'
    ) OR triggered_by IS NULL)
);

COMMENT ON TABLE validation_runs IS 'Tracks data quality validation job executions';
COMMENT ON COLUMN validation_runs.glue_run_id IS 'AWS Glue Data Quality run ID';
COMMENT ON COLUMN validation_runs.overall_score IS 'Ratio of passed rules (0.0 to 1.0)';
COMMENT ON COLUMN validation_runs.s3_results_uri IS 'S3 URI for detailed validation results';

-- ============================================================================
-- Table 2: rule_results
-- Per-rule execution results from validation runs
-- ============================================================================
CREATE TABLE rule_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES dq_rules(id) ON DELETE SET NULL,

    -- Result
    result VARCHAR(20) NOT NULL,  -- pass, fail, error, skip
    evaluation_message TEXT,

    -- Metrics
    evaluated_count BIGINT,
    passed_count BIGINT,
    failed_count BIGINT,

    -- Row-level details (for debugging)
    sample_failures JSONB,  -- Sample of failed rows

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_rule_result CHECK (result IN ('pass', 'fail', 'error', 'skip'))
);

COMMENT ON TABLE rule_results IS 'Individual rule evaluation results from validation runs';
COMMENT ON COLUMN rule_results.sample_failures IS 'Sample of rows that failed the rule (for debugging)';
COMMENT ON COLUMN rule_results.evaluation_message IS 'Glue DQ evaluation message';

-- ============================================================================
-- Table 3: quality_scores
-- Time series metrics for data quality dimensions
-- ============================================================================
CREATE TABLE quality_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,

    -- Dimension scores
    dimension VARCHAR(50) NOT NULL,  -- completeness, validity, uniqueness, consistency, freshness
    score DECIMAL(5,4) NOT NULL,  -- 0.0000 to 1.0000

    -- Reference
    run_id UUID REFERENCES validation_runs(id) ON DELETE CASCADE,

    measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_dimension CHECK (dimension IN (
        'completeness', 'validity', 'uniqueness', 'consistency', 'freshness'
    )),
    CONSTRAINT valid_score_range CHECK (score >= 0 AND score <= 1)
);

COMMENT ON TABLE quality_scores IS 'Time series of data quality dimension scores';
COMMENT ON COLUMN quality_scores.dimension IS 'Quality dimension: completeness, validity, uniqueness, consistency, freshness';
COMMENT ON COLUMN quality_scores.score IS 'Score from 0.0 (worst) to 1.0 (best)';

-- ============================================================================
-- Table 4: alerts
-- Alert records for quality issues, freshness violations, volume anomalies
-- ============================================================================
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source (nullable FKs - alert may outlive related records)
    dataset_id UUID REFERENCES datasets(id) ON DELETE SET NULL,
    rule_id UUID REFERENCES dq_rules(id) ON DELETE SET NULL,
    run_id UUID REFERENCES validation_runs(id) ON DELETE SET NULL,

    -- Alert details
    alert_type VARCHAR(50) NOT NULL,  -- rule_failure, freshness_sla, volume_anomaly
    severity VARCHAR(20) NOT NULL,  -- critical, warning, info
    title VARCHAR(255) NOT NULL,
    message TEXT,
    details JSONB,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'open',  -- open, acknowledged, resolved, snoozed
    acknowledged_by UUID,  -- No FK to auth.users (environment flexibility)
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,

    -- Notification
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_channels JSONB,  -- ['slack', 'email']

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_alert_type CHECK (alert_type IN (
        'rule_failure', 'freshness_sla', 'volume_anomaly'
    )),
    CONSTRAINT valid_alert_severity CHECK (severity IN ('critical', 'warning', 'info')),
    CONSTRAINT valid_alert_status CHECK (status IN (
        'open', 'acknowledged', 'resolved', 'snoozed'
    ))
);

COMMENT ON TABLE alerts IS 'Data quality alerts for rule failures, freshness violations, and volume anomalies';
COMMENT ON COLUMN alerts.alert_type IS 'Type: rule_failure, freshness_sla, volume_anomaly';
COMMENT ON COLUMN alerts.details IS 'Alert-specific details (score, threshold, affected rows, etc.)';
COMMENT ON COLUMN alerts.notification_channels IS 'Array of notification channels: ["slack", "email"]';

-- ============================================================================
-- Table 5: freshness_slas
-- SLA configuration for data freshness monitoring
-- ============================================================================
CREATE TABLE freshness_slas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE UNIQUE,

    -- SLA definition
    max_age_hours INTEGER NOT NULL,
    check_schedule VARCHAR(100),  -- Cron expression
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',

    -- Status
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_check_at TIMESTAMPTZ,
    last_violation_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_freshness_severity CHECK (severity IN ('critical', 'warning', 'info')),
    CONSTRAINT valid_max_age CHECK (max_age_hours > 0)
);

COMMENT ON TABLE freshness_slas IS 'Freshness SLA configuration for datasets';
COMMENT ON COLUMN freshness_slas.max_age_hours IS 'Maximum allowed age in hours before SLA violation';
COMMENT ON COLUMN freshness_slas.check_schedule IS 'Cron expression for check schedule (optional)';

-- ============================================================================
-- Indexes for common queries
-- ============================================================================

-- Validation runs indexes
CREATE INDEX idx_validation_runs_dataset ON validation_runs(dataset_id);
CREATE INDEX idx_validation_runs_status ON validation_runs(status);
CREATE INDEX idx_validation_runs_dataset_status ON validation_runs(dataset_id, status);
CREATE INDEX idx_validation_runs_created ON validation_runs(created_at DESC);

-- Rule results indexes
CREATE INDEX idx_rule_results_run ON rule_results(run_id);
CREATE INDEX idx_rule_results_rule ON rule_results(rule_id);
CREATE INDEX idx_rule_results_result ON rule_results(result);

-- Quality scores indexes
CREATE INDEX idx_quality_scores_dataset ON quality_scores(dataset_id);
CREATE INDEX idx_quality_scores_dataset_time ON quality_scores(dataset_id, measured_at DESC);
CREATE INDEX idx_quality_scores_dimension ON quality_scores(dimension);

-- Alerts indexes
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity, created_at DESC);
CREATE INDEX idx_alerts_dataset ON alerts(dataset_id);
CREATE INDEX idx_alerts_open ON alerts(status, severity, created_at DESC) WHERE status = 'open';
CREATE INDEX idx_alerts_type ON alerts(alert_type);

-- Freshness SLAs indexes
CREATE INDEX idx_freshness_slas_dataset ON freshness_slas(dataset_id);
CREATE INDEX idx_freshness_slas_enabled ON freshness_slas(enabled) WHERE enabled = TRUE;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE validation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE freshness_slas ENABLE ROW LEVEL SECURITY;

-- SELECT policies: All authenticated users can view
CREATE POLICY "Authenticated users can view validation runs"
    ON validation_runs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can view rule results"
    ON rule_results FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can view quality scores"
    ON quality_scores FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can view alerts"
    ON alerts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can view freshness SLAs"
    ON freshness_slas FOR SELECT
    TO authenticated
    USING (true);

-- INSERT policies
CREATE POLICY "Authenticated users can insert validation runs"
    ON validation_runs FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can insert rule results"
    ON rule_results FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can insert quality scores"
    ON quality_scores FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can insert alerts"
    ON alerts FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can insert freshness SLAs"
    ON freshness_slas FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE policies
CREATE POLICY "Authenticated users can update validation runs"
    ON validation_runs FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update alerts"
    ON alerts FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update freshness SLAs"
    ON freshness_slas FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- DELETE policies
CREATE POLICY "Authenticated users can delete validation runs"
    ON validation_runs FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can delete alerts"
    ON alerts FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can delete freshness SLAs"
    ON freshness_slas FOR DELETE
    TO authenticated
    USING (true);
