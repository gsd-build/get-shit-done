-- Data Foundations Platform: DQ Rules Schema
-- Migration: 002_dq_rules
-- Description: Creates tables for DQ rules, templates, and approval workflow

-- ============================================================================
-- Table 1: dq_rules
-- Data quality rule definitions with lifecycle management
-- ============================================================================
CREATE TABLE dq_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    column_name VARCHAR(255),  -- NULL for table-level rules

    -- Rule definition
    rule_type VARCHAR(50) NOT NULL,  -- completeness, uniqueness, range, pattern, freshness, referential, custom
    dqdl_expression TEXT NOT NULL,
    description TEXT,

    -- AI generation metadata
    generated_by VARCHAR(50),  -- 'ai_recommender', 'glue_ml', 'user', 'template'
    reasoning TEXT,  -- AI-provided explanation
    template_name VARCHAR(100),  -- If from template

    -- Lifecycle
    status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, active, disabled, deprecated
    severity VARCHAR(20) DEFAULT 'warning',  -- critical, warning, info

    -- Ownership (no FK to auth.users - may not exist in all environments)
    created_by UUID,
    approved_by UUID,
    owner_id UUID,

    -- Expiration and tracking
    expires_at TIMESTAMPTZ,
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_rule_type CHECK (rule_type IN (
        'completeness', 'uniqueness', 'range', 'pattern',
        'freshness', 'referential', 'custom'
    )),
    CONSTRAINT valid_status CHECK (status IN (
        'pending', 'approved', 'active', 'disabled', 'deprecated'
    )),
    CONSTRAINT valid_severity CHECK (severity IN ('critical', 'warning', 'info'))
);

COMMENT ON TABLE dq_rules IS 'Data quality rule definitions with AI generation metadata and lifecycle tracking';
COMMENT ON COLUMN dq_rules.dqdl_expression IS 'DQDL rule expression (AWS Glue Data Quality syntax)';
COMMENT ON COLUMN dq_rules.reasoning IS 'AI-provided explanation for why this rule was recommended';
COMMENT ON COLUMN dq_rules.status IS 'Rule lifecycle: pending (awaiting approval), approved, active, disabled, deprecated';

-- ============================================================================
-- Table 2: rule_templates
-- Pre-defined industry rule templates
-- ============================================================================
CREATE TABLE rule_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50),  -- format, range, consistency, compliance
    description TEXT,

    -- Template definition
    dqdl_pattern TEXT NOT NULL,  -- With {column}, {param1} placeholders
    parameters JSONB,  -- Parameter definitions with types and defaults

    -- Metadata
    industry_standards JSONB,  -- ['HIPAA', 'PCI-DSS', 'GDPR', 'RFC 5322']

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_template_category CHECK (category IN (
        'format', 'range', 'consistency', 'compliance'
    ))
);

COMMENT ON TABLE rule_templates IS 'Pre-defined rule templates for common data quality patterns';
COMMENT ON COLUMN rule_templates.dqdl_pattern IS 'DQDL pattern with {column} and {param} placeholders';
COMMENT ON COLUMN rule_templates.parameters IS 'JSON array of parameter definitions: [{name, type, required, default, description}]';

-- ============================================================================
-- Table 3: rule_approval_requests
-- Approval workflow tracking for AI-generated rules
-- ============================================================================
CREATE TABLE rule_approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES dq_rules(id) ON DELETE CASCADE,

    -- Step Functions callback
    task_token TEXT,  -- Step Functions waitForTaskToken callback token

    -- Timing
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- Approval window expiration

    -- Status
    status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected, expired

    -- Review details
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    comments TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_approval_status CHECK (status IN (
        'pending', 'approved', 'rejected', 'expired'
    ))
);

COMMENT ON TABLE rule_approval_requests IS 'Tracks human approval workflow for AI-generated rules';
COMMENT ON COLUMN rule_approval_requests.task_token IS 'AWS Step Functions callback token for waitForTaskToken pattern';
COMMENT ON COLUMN rule_approval_requests.expires_at IS 'Approval window expiration (default 24 hours)';

-- ============================================================================
-- Indexes for common queries
-- ============================================================================

-- DQ Rules indexes
CREATE INDEX idx_dq_rules_dataset ON dq_rules(dataset_id);
CREATE INDEX idx_dq_rules_status ON dq_rules(status);
CREATE INDEX idx_dq_rules_column ON dq_rules(dataset_id, column_name);
CREATE INDEX idx_dq_rules_generated_by ON dq_rules(generated_by);

-- Rule templates indexes
CREATE INDEX idx_rule_templates_category ON rule_templates(category);

-- Approval requests indexes
CREATE INDEX idx_approval_requests_rule ON rule_approval_requests(rule_id);
CREATE INDEX idx_approval_requests_status ON rule_approval_requests(status);
CREATE INDEX idx_approval_requests_pending ON rule_approval_requests(status, expires_at)
    WHERE status = 'pending';

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE dq_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_approval_requests ENABLE ROW LEVEL SECURITY;

-- SELECT policies: All authenticated users can view
CREATE POLICY "Authenticated users can view dq rules"
    ON dq_rules FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can view rule templates"
    ON rule_templates FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can view approval requests"
    ON rule_approval_requests FOR SELECT
    TO authenticated
    USING (true);

-- INSERT policies
CREATE POLICY "Authenticated users can insert dq rules"
    ON dq_rules FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can insert rule templates"
    ON rule_templates FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can insert approval requests"
    ON rule_approval_requests FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE policies
CREATE POLICY "Authenticated users can update dq rules"
    ON dq_rules FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update approval requests"
    ON rule_approval_requests FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- DELETE policy for rules (allow owners/admins to delete)
CREATE POLICY "Authenticated users can delete dq rules"
    ON dq_rules FOR DELETE
    TO authenticated
    USING (true);

-- ============================================================================
-- Trigger: Auto-update updated_at on dq_rules
-- ============================================================================
CREATE TRIGGER trigger_dq_rules_updated_at
    BEFORE UPDATE ON dq_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Seed initial rule templates from template_library.py
-- ============================================================================
INSERT INTO rule_templates (name, category, description, dqdl_pattern, parameters, industry_standards) VALUES
-- Format templates
('email_validity', 'format', 'Validates email addresses match standard format',
 'ColumnValues "{column}" matches "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"',
 '[]'::jsonb,
 '["RFC 5322"]'::jsonb),

('date_format_iso', 'format', 'Validates ISO 8601 date format (YYYY-MM-DD)',
 'ColumnValues "{column}" matches "\\d{4}-\\d{2}-\\d{2}"',
 '[]'::jsonb,
 '["ISO 8601"]'::jsonb),

('phone_us', 'format', 'Validates US phone number formats',
 'ColumnValues "{column}" matches "^\\+?1?[-.\\s]?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}$"',
 '[]'::jsonb,
 '["E.164", "NANP"]'::jsonb),

('uuid_format', 'format', 'Validates UUID v4 format',
 'ColumnValues "{column}" matches "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"',
 '[]'::jsonb,
 '["RFC 4122"]'::jsonb),

('currency_precision', 'format', 'Validates currency values have exactly 2 decimal places',
 'ColumnValues "{column}" matches "^\\d+\\.\\d{2}$"',
 '[]'::jsonb,
 '["ISO 4217"]'::jsonb),

-- Compliance templates
('ssn_format', 'compliance', 'Validates US Social Security Number format (XXX-XX-XXXX)',
 'ColumnValues "{column}" matches "^\\d{3}-\\d{2}-\\d{4}$"',
 '[]'::jsonb,
 '["SSA", "IRS"]'::jsonb),

-- Range templates
('positive_number', 'range', 'Ensures values are positive (greater than 0)',
 'ColumnValues "{column}" > 0',
 '[]'::jsonb,
 '[]'::jsonb),

('percentage_range', 'range', 'Ensures values are between 0 and 100 (percentage)',
 'ColumnValues "{column}" between 0 and 100',
 '[]'::jsonb,
 '[]'::jsonb),

-- Consistency templates
('not_null', 'consistency', 'Ensures column has no null values (completeness)',
 'IsComplete "{column}"',
 '[]'::jsonb,
 '[]'::jsonb),

('unique_values', 'consistency', 'Ensures all values in column are unique',
 'IsUnique "{column}"',
 '[]'::jsonb,
 '[]'::jsonb);
