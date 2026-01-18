/**
 * Validation Run Detail API Routes
 *
 * GET /api/validations/[id] - Get validation run by ID with full results
 * DELETE /api/validations/[id] - Cancel running validation (if supported)
 */

import { z } from 'zod';
import { supabase } from '../../../lib/supabase';

// Response types
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface RuleResult {
  id: string;
  run_id: string;
  rule_id: string | null;
  result: 'pass' | 'fail' | 'error' | 'skip';
  evaluation_message: string | null;
  evaluated_count: number | null;
  passed_count: number | null;
  failed_count: number | null;
  sample_failures: Record<string, unknown>[] | null;
  created_at: string;
}

interface QualityScore {
  id: string;
  dataset_id: string;
  dimension: string;
  score: number;
  run_id: string;
  measured_at: string;
}

interface ValidationRunDetail {
  id: string;
  dataset_id: string;
  glue_run_id: string | null;
  step_function_execution_arn: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  triggered_by: string | null;
  trigger_details: Record<string, unknown> | null;
  overall_score: number | null;
  rules_evaluated: number | null;
  rules_passed: number | null;
  rules_failed: number | null;
  s3_results_uri: string | null;
  created_at: string;
  rule_results?: RuleResult[];
  quality_scores?: QualityScore[];
}

// Validation schemas
const idParamSchema = z.object({
  id: z.string().uuid('Invalid validation run ID'),
});

/**
 * GET /api/validations/[id]
 * Get validation run by ID with full results
 */
export async function GET(params: unknown): Promise<ApiResponse<ValidationRunDetail>> {
  try {
    // Validate ID
    const parseResult = idParamSchema.safeParse(params);
    if (!parseResult.success) {
      return { error: 'Invalid validation run ID' };
    }

    const { id } = parseResult.data;

    // Fetch validation run with relations
    const { data: run, error: runError } = await supabase
      .from('validation_runs')
      .select(`
        *,
        rule_results(*),
        quality_scores(*)
      `)
      .eq('id', id)
      .single();

    if (runError || !run) {
      if (runError?.code === 'PGRST116') {
        return { error: 'Validation run not found' };
      }
      console.error('Failed to fetch validation run:', runError);
      return { error: 'Failed to fetch validation run' };
    }

    // Transform response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runData = run as any;
    const result: ValidationRunDetail = {
      id: runData.id,
      dataset_id: runData.dataset_id,
      glue_run_id: runData.glue_run_id,
      step_function_execution_arn: runData.step_function_execution_arn,
      status: runData.status,
      started_at: runData.started_at,
      completed_at: runData.completed_at,
      triggered_by: runData.triggered_by,
      trigger_details: runData.trigger_details,
      overall_score: runData.overall_score,
      rules_evaluated: runData.rules_evaluated,
      rules_passed: runData.rules_passed,
      rules_failed: runData.rules_failed,
      s3_results_uri: runData.s3_results_uri,
      created_at: runData.created_at,
      rule_results: runData.rule_results || [],
      quality_scores: runData.quality_scores || [],
    };

    return { data: result };
  } catch (err) {
    console.error('Unexpected error in GET /api/validations/[id]:', err);
    return { error: 'Internal server error' };
  }
}

/**
 * DELETE /api/validations/[id]
 * Cancel running validation (marks as failed, does not stop Glue job)
 */
export async function DELETE(params: unknown): Promise<ApiResponse<{ cancelled: boolean }>> {
  try {
    // Validate ID
    const parseResult = idParamSchema.safeParse(params);
    if (!parseResult.success) {
      return { error: 'Invalid validation run ID' };
    }

    const { id } = parseResult.data;

    // Fetch current run status
    const { data: run, error: fetchError } = await supabase
      .from('validation_runs')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !run) {
      return { error: 'Validation run not found' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runData = run as any;

    // Only allow cancellation of pending/running runs
    if (!['pending', 'running'].includes(runData.status)) {
      return { error: 'Can only cancel pending or running validations' };
    }

    // Update status to failed (cancellation)
    const { error: updateError } = await supabase
      .from('validation_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to cancel validation:', updateError);
      return { error: 'Failed to cancel validation' };
    }

    // Note: In production, you might also want to stop the Step Functions
    // execution using sfn.stopExecution()

    return { data: { cancelled: true } };
  } catch (err) {
    console.error('Unexpected error in DELETE /api/validations/[id]:', err);
    return { error: 'Internal server error' };
  }
}
