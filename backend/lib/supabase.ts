/**
 * Supabase client for backend API.
 *
 * Uses service role key for RLS bypass in server-side operations.
 */

import { createClient } from '@supabase/supabase-js';

// Database types based on schema
export interface DataSource {
  id: string;
  name: string;
  source_type: 'iceberg' | 'redshift' | 'athena';
  connection_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Dataset {
  id: string;
  source_id: string;
  database_name: string;
  table_name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileRun {
  id: string;
  dataset_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  execution_arn: string | null;
  s3_profile_uri: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileResult {
  id: string;
  run_id: string;
  row_count: number | null;
  column_count: number | null;
  missing_cells_pct: number | null;
  duplicate_rows_pct: number | null;
  created_at: string;
}

export interface ColumnProfile {
  id: string;
  result_id: string;
  column_name: string;
  data_type: string | null;
  null_count: number | null;
  null_pct: number | null;
  distinct_count: number | null;
  distinct_pct: number | null;
  min_value: string | null;
  max_value: string | null;
  mean_value: number | null;
  std_value: number | null;
  median_value: number | null;
  created_at: string;
}

export interface ProfileAnomaly {
  id: string;
  run_id: string;
  column_name: string;
  anomaly_type: string;
  detection_method: string;
  severity: 'info' | 'warning' | 'critical';
  value: number | null;
  threshold: number | null;
  description: string | null;
  created_at: string;
}

// Environment validation - only validate when actually creating client
function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

// Lazy-loaded client instance
// Using 'any' for database generic since we don't have auto-generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabase: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabase(): any {
  if (!_supabase) {
    const url = getEnvVar('SUPABASE_URL');
    const key = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

    _supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _supabase;
}

// Convenience export
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = {
  from(table: string) {
    return getSupabase().from(table);
  },
};
