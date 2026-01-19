// Lineage types matching database schema and React Flow requirements

// ============================================================================
// Database Types
// ============================================================================

export type NodeType = 'dataset' | 'column' | 'job';
export type EdgeType = 'derives_from' | 'transforms_to';
export type TransformationType = 'DIRECT' | 'INDIRECT';
export type TransformationSubtype =
  | 'IDENTITY'
  | 'TRANSFORMATION'
  | 'AGGREGATION'
  | 'JOIN'
  | 'GROUP_BY'
  | 'FILTER'
  | 'SORT'
  | 'WINDOW'
  | 'CONDITIONAL';

export interface LineageNode {
  id: string;
  node_type: NodeType;
  namespace: string;
  name: string;
  parent_id: string | null;
  data_type: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface LineageEdge {
  id: string;
  source_id: string;
  target_id: string;
  edge_type: EdgeType;
  transformation_type: TransformationType | null;
  transformation_subtype: TransformationSubtype | null;
  transformation_description: string | null;
  job_id: string | null;
  created_at: string;
}

export interface LineageRun {
  id: string;
  run_type: 'extract' | 'import' | 'manual';
  status: 'pending' | 'running' | 'completed' | 'failed';
  source_type: string | null;
  nodes_created: number | null;
  edges_created: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

// ============================================================================
// React Flow Types
// ============================================================================

export interface ColumnData {
  id: string;
  name: string;
  type: string | null;
  isHighlighted?: boolean;
  hasUpstream?: boolean;
  hasDownstream?: boolean;
}

export interface TableNodeData {
  label: string;
  namespace: string;
  columns: ColumnData[];
  isHighlighted?: boolean;
  isExpanded?: boolean;
  // Index signature for React Flow compatibility
  [key: string]: unknown;
}

export interface ColumnEdgeData {
  transformationType: TransformationType | null;
  transformationSubtype: TransformationSubtype | null;
  transformationDescription: string | null;
  isHighlighted?: boolean;
  // Index signature for React Flow compatibility
  [key: string]: unknown;
}

// ============================================================================
// Analysis Types
// ============================================================================

export interface ImpactNode {
  id: string;
  node_type: NodeType;
  namespace: string;
  name: string;
  parent_id: string | null;
  depth: number;
  path: string[];
  transformation?: string;
}

export interface LineageGraphData {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

// ============================================================================
// Search and Filter Types
// ============================================================================

export interface LineageSearchResult {
  id: string;
  node_type: NodeType;
  namespace: string;
  name: string;
  parent_name?: string;
}

export interface LineageFilters {
  namespace?: string;
  nodeType?: NodeType;
  search?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface TriggerExtractionRequest {
  source_type?: string;
  namespace?: string;
}

export interface TriggerExtractionResponse {
  run_id: string;
  status: string;
}
