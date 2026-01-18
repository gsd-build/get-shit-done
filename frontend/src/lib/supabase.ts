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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create untyped client - types are applied at query result level
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
