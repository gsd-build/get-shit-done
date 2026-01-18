import { createClient } from '@supabase/supabase-js';

// Entity types - used for type-safe data handling
// In production, generate these with: npx supabase gen types typescript

export interface DataSource {
  id: string;
  name: string;
  source_type: 'iceberg' | 'redshift' | 'athena';
  connection_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Dataset {
  id: string;
  source_id: string;
  database_name: string;
  table_name: string;
  schema_info: Record<string, unknown> | null;
  created_at: string;
}

export interface ProfileRun {
  id: string;
  dataset_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  step_functions_execution_arn: string | null;
  created_at: string;
}

export interface ProfileResult {
  id: string;
  run_id: string;
  dataset_id: string;
  row_count: number | null;
  column_count: number | null;
  sampled: boolean;
  sample_size: number | null;
  s3_full_profile_uri: string | null;
  profiled_at: string;
}

export interface ColumnProfile {
  id: string;
  result_id: string;
  column_name: string;
  inferred_type: string | null;
  null_count: number | null;
  null_percentage: number | null;
  distinct_count: number | null;
  distinct_percentage: number | null;
  min_value: number | null;
  max_value: number | null;
  mean_value: number | null;
  median_value: number | null;
  std_dev: number | null;
  top_values: Array<{ value: string; count: number; percentage: number }> | null;
  created_at: string;
}

export interface ProfileAnomaly {
  id: string;
  result_id: string;
  column_name: string | null;
  anomaly_type: string;
  severity: 'info' | 'warning' | 'critical';
  description: string | null;
  value: number | null;
  threshold: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Validation run types
export interface ValidationRun {
  id: string;
  dataset_id: string;
  glue_run_id: string | null;
  step_function_execution_arn: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  triggered_by: 'scheduled' | 'manual' | 'pipeline' | 'event' | null;
  trigger_details: Record<string, unknown> | null;
  overall_score: number | null;
  rules_evaluated: number | null;
  rules_passed: number | null;
  rules_failed: number | null;
  s3_results_uri: string | null;
  created_at: string;
}

export interface RuleResult {
  id: string;
  run_id: string;
  rule_id: string | null;
  result: 'pass' | 'fail' | 'error' | 'skip';
  evaluation_message: string | null;
  evaluated_count: number | null;
  passed_count: number | null;
  failed_count: number | null;
  sample_failures: Array<Record<string, unknown>> | null;
  created_at: string;
  // Joined data
  dq_rules?: {
    id: string;
    name: string;
    description: string | null;
    rule_type: string;
    dqdl_expression: string;
  };
}

export interface QualityScore {
  id: string;
  dataset_id: string;
  dimension: 'completeness' | 'validity' | 'uniqueness' | 'consistency' | 'freshness';
  score: number;
  run_id: string | null;
  measured_at: string;
}

export interface ValidationRunDetail extends ValidationRun {
  rule_results: RuleResult[];
  quality_scores: QualityScore[];
  datasets?: Dataset;
}

// Alert types
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'snoozed';
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType = 'rule_failure' | 'freshness_sla' | 'volume_anomaly';

export interface Alert {
  id: string;
  dataset_id: string | null;
  rule_id: string | null;
  run_id: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string | null;
  details: Record<string, unknown> | null;
  status: AlertStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  notification_sent: boolean;
  notification_channels: string[] | null;
  created_at: string;
  // Joined data
  datasets?: {
    id: string;
    database_name: string;
    table_name: string;
  };
  dq_rules?: {
    id: string;
    dqdl_expression: string;
    description: string | null;
  };
  validation_runs?: {
    id: string;
    overall_score: number | null;
    rules_passed: number | null;
    rules_failed: number | null;
  };
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create untyped client - types are applied at query result level
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
