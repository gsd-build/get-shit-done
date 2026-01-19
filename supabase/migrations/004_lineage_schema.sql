-- Migration: 004_lineage_schema.sql
-- Description: Schema for column-level lineage graph storage
-- Phase: 03-column-level-lineage
-- Created: 2026-01-19

-- ============================================================================
-- LINEAGE GRAPH SCHEMA
-- Stores lineage as nodes (datasets, columns, jobs) and edges (data flow)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: lineage_nodes
-- Represents datasets, columns, and jobs in the lineage graph
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lineage_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_type VARCHAR(20) NOT NULL CHECK (node_type IN ('dataset', 'column', 'job')),
    namespace VARCHAR(500) NOT NULL,  -- e.g., redshift://analytics, s3://bucket
    name VARCHAR(255) NOT NULL,       -- table name for dataset, column name for column
    parent_id UUID REFERENCES lineage_nodes(id) ON DELETE CASCADE,  -- column -> dataset
    data_type VARCHAR(100),           -- for columns: INT, VARCHAR, etc.
    metadata JSONB DEFAULT '{}',      -- flexible storage for additional properties
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Unique constraint with COALESCE for null parent_id
    CONSTRAINT lineage_nodes_unique_key
        UNIQUE (node_type, namespace, name, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::UUID))
);

-- Add comment describing node_type values
COMMENT ON COLUMN lineage_nodes.node_type IS 'Type of node: dataset (table), column, or job (transformation)';
COMMENT ON COLUMN lineage_nodes.namespace IS 'Namespace URI: redshift://cluster, athena://workgroup, s3://bucket';
COMMENT ON COLUMN lineage_nodes.parent_id IS 'Parent node ID - columns reference their parent dataset';

-- ----------------------------------------------------------------------------
-- Table: lineage_edges
-- Represents data flow between nodes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lineage_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES lineage_nodes(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES lineage_nodes(id) ON DELETE CASCADE,
    edge_type VARCHAR(50) NOT NULL CHECK (edge_type IN ('derives_from', 'transforms_to')),
    transformation_type VARCHAR(50) CHECK (transformation_type IN ('DIRECT', 'INDIRECT')),
    transformation_subtype VARCHAR(50) CHECK (transformation_subtype IN (
        'IDENTITY', 'TRANSFORMATION', 'AGGREGATION',
        'JOIN', 'GROUP_BY', 'FILTER', 'SORT', 'WINDOW', 'CONDITIONAL'
    )),
    transformation_description TEXT,
    job_id UUID REFERENCES lineage_nodes(id) ON DELETE SET NULL,
    sql_hash VARCHAR(64),  -- SHA-256 hash of SQL that created this edge
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Unique constraint on source, target, job combination
    CONSTRAINT lineage_edges_unique_key
        UNIQUE (source_id, target_id, COALESCE(job_id, '00000000-0000-0000-0000-000000000000'::UUID))
);

COMMENT ON COLUMN lineage_edges.edge_type IS 'Edge direction: derives_from (target derives from source) or transforms_to';
COMMENT ON COLUMN lineage_edges.transformation_type IS 'OpenLineage transformation type: DIRECT or INDIRECT';
COMMENT ON COLUMN lineage_edges.transformation_subtype IS 'OpenLineage subtype: IDENTITY, TRANSFORMATION, AGGREGATION, JOIN, etc.';
COMMENT ON COLUMN lineage_edges.sql_hash IS 'SHA-256 hash of the SQL statement that created this lineage edge';

-- ----------------------------------------------------------------------------
-- Table: lineage_runs
-- Tracks lineage extraction jobs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lineage_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('redshift', 'athena', 'glue', 'manual')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    queries_processed INTEGER DEFAULT 0,
    edges_created INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',  -- Additional run metadata
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE lineage_runs IS 'Tracks lineage extraction jobs from various data sources';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- lineage_nodes indexes
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_type
    ON lineage_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_namespace
    ON lineage_nodes(namespace);
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_parent
    ON lineage_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_type_namespace_name
    ON lineage_nodes(node_type, namespace, name);

-- lineage_edges indexes
CREATE INDEX IF NOT EXISTS idx_lineage_edges_source
    ON lineage_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_lineage_edges_target
    ON lineage_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_lineage_edges_source_target
    ON lineage_edges(source_id, target_id);
CREATE INDEX IF NOT EXISTS idx_lineage_edges_job
    ON lineage_edges(job_id);

-- lineage_runs indexes
CREATE INDEX IF NOT EXISTS idx_lineage_runs_status
    ON lineage_runs(status);
CREATE INDEX IF NOT EXISTS idx_lineage_runs_source_type
    ON lineage_runs(source_type);
CREATE INDEX IF NOT EXISTS idx_lineage_runs_created
    ON lineage_runs(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE lineage_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineage_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineage_runs ENABLE ROW LEVEL SECURITY;

-- Policies for lineage_nodes
CREATE POLICY "lineage_nodes_select" ON lineage_nodes
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "lineage_nodes_insert" ON lineage_nodes
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "lineage_nodes_update" ON lineage_nodes
    FOR UPDATE TO authenticated USING (true);
CREATE POLICY "lineage_nodes_delete" ON lineage_nodes
    FOR DELETE TO authenticated USING (true);

-- Policies for lineage_edges
CREATE POLICY "lineage_edges_select" ON lineage_edges
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "lineage_edges_insert" ON lineage_edges
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "lineage_edges_update" ON lineage_edges
    FOR UPDATE TO authenticated USING (true);
CREATE POLICY "lineage_edges_delete" ON lineage_edges
    FOR DELETE TO authenticated USING (true);

-- Policies for lineage_runs
CREATE POLICY "lineage_runs_select" ON lineage_runs
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "lineage_runs_insert" ON lineage_runs
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "lineage_runs_update" ON lineage_runs
    FOR UPDATE TO authenticated USING (true);
CREATE POLICY "lineage_runs_delete" ON lineage_runs
    FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- HELPER FUNCTIONS FOR GRAPH TRAVERSAL
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: get_downstream_nodes
-- Find all nodes that depend on the given node (forward traversal)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_downstream_nodes(
    start_node_id UUID,
    max_depth INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    node_type VARCHAR(20),
    namespace VARCHAR(500),
    name VARCHAR(255),
    parent_id UUID,
    depth INT,
    path UUID[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE downstream AS (
        -- Base case: start from the given node
        SELECT
            n.id,
            n.node_type,
            n.namespace,
            n.name,
            n.parent_id,
            0 AS depth,
            ARRAY[n.id] AS path
        FROM lineage_nodes n
        WHERE n.id = start_node_id

        UNION ALL

        -- Recursive case: find nodes that derive from current nodes
        SELECT
            n.id,
            n.node_type,
            n.namespace,
            n.name,
            n.parent_id,
            d.depth + 1,
            d.path || n.id
        FROM lineage_nodes n
        JOIN lineage_edges e ON e.target_id = n.id
        JOIN downstream d ON e.source_id = d.id
        WHERE d.depth < max_depth
          AND NOT n.id = ANY(d.path)  -- Cycle detection
    )
    SELECT DISTINCT ON (downstream.id)
        downstream.id,
        downstream.node_type,
        downstream.namespace,
        downstream.name,
        downstream.parent_id,
        downstream.depth,
        downstream.path
    FROM downstream
    ORDER BY downstream.id, downstream.depth;
END;
$$;

COMMENT ON FUNCTION get_downstream_nodes IS 'Find all downstream nodes affected by changes to the given node (impact analysis)';

-- ----------------------------------------------------------------------------
-- Function: get_upstream_nodes
-- Find all source nodes that the given node depends on (backward traversal)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_upstream_nodes(
    start_node_id UUID,
    max_depth INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    node_type VARCHAR(20),
    namespace VARCHAR(500),
    name VARCHAR(255),
    parent_id UUID,
    depth INT,
    path UUID[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE upstream AS (
        -- Base case: start from the given node
        SELECT
            n.id,
            n.node_type,
            n.namespace,
            n.name,
            n.parent_id,
            0 AS depth,
            ARRAY[n.id] AS path
        FROM lineage_nodes n
        WHERE n.id = start_node_id

        UNION ALL

        -- Recursive case: find source nodes (traverse edges in reverse)
        SELECT
            n.id,
            n.node_type,
            n.namespace,
            n.name,
            n.parent_id,
            u.depth + 1,
            u.path || n.id
        FROM lineage_nodes n
        JOIN lineage_edges e ON e.source_id = n.id
        JOIN upstream u ON e.target_id = u.id
        WHERE u.depth < max_depth
          AND NOT n.id = ANY(u.path)  -- Cycle detection
    )
    SELECT DISTINCT ON (upstream.id)
        upstream.id,
        upstream.node_type,
        upstream.namespace,
        upstream.name,
        upstream.parent_id,
        upstream.depth,
        upstream.path
    FROM upstream
    ORDER BY upstream.id, upstream.depth;
END;
$$;

COMMENT ON FUNCTION get_upstream_nodes IS 'Find all upstream source nodes that the given node depends on (root cause analysis)';

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lineage_node_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to lineage_nodes
CREATE TRIGGER lineage_nodes_updated_at
    BEFORE UPDATE ON lineage_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_lineage_node_timestamp();
