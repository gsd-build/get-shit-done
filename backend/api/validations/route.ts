/**
 * Validation Runs API Routes
 *
 * GET /api/validations - List validation runs with filters
 * POST /api/validations - Trigger a new validation run
 */

import { z } from 'zod';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { supabase } from '../../lib/supabase';

// Response types
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface ValidationRun {
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
}

// Validation schemas
const listValidationsSchema = z.object({
  dataset_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const triggerValidationSchema = z.object({
  dataset_id: z.string().uuid('Invalid dataset ID'),
  rule_ids: z.array(z.string().uuid()).optional(), // If not provided, use all active rules
  triggered_by: z.enum(['manual', 'scheduled', 'pipeline', 'event']).default('manual'),
});

type ListValidationsInput = z.infer<typeof listValidationsSchema>;
type TriggerValidationInput = z.infer<typeof triggerValidationSchema>;

// Step Functions client (initialized lazily)
let sfnClient: SFNClient | null = null;

function getSfnClient(): SFNClient {
  if (!sfnClient) {
    sfnClient = new SFNClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return sfnClient;
}

/**
 * GET /api/validations
 * List validation runs with optional filters
 */
export async function GET(query: unknown): Promise<ApiResponse<ValidationRun[]>> {
  try {
    // Validate query params
    const parseResult = listValidationsSchema.safeParse(query);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return { error: `Validation error: ${errorMessages}` };
    }

    const input: ListValidationsInput = parseResult.data;

    // Build query
    let queryBuilder = supabase
      .from('validation_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    // Apply filters
    if (input.dataset_id) {
      queryBuilder = queryBuilder.eq('dataset_id', input.dataset_id);
    }
    if (input.status) {
      queryBuilder = queryBuilder.eq('status', input.status);
    }
    if (input.start_date) {
      queryBuilder = queryBuilder.gte('created_at', input.start_date);
    }
    if (input.end_date) {
      queryBuilder = queryBuilder.lte('created_at', input.end_date);
    }

    const { data: runs, error } = await queryBuilder;

    if (error) {
      console.error('Failed to fetch validation runs:', error);
      return { error: 'Failed to fetch validation runs' };
    }

    return { data: (runs || []) as ValidationRun[] };
  } catch (err) {
    console.error('Unexpected error in GET /api/validations:', err);
    return { error: 'Internal server error' };
  }
}

/**
 * POST /api/validations
 * Trigger a new validation run
 */
export async function POST(body: unknown): Promise<ApiResponse<ValidationRun>> {
  try {
    // Validate input
    const parseResult = triggerValidationSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return { error: `Validation error: ${errorMessages}` };
    }

    const input: TriggerValidationInput = parseResult.data;

    // Verify dataset exists and get info
    const { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .select('*, data_sources(*)')
      .eq('id', input.dataset_id)
      .single();

    if (datasetError || !dataset) {
      return { error: 'Dataset not found' };
    }

    // Rule type for query results
    interface RuleQueryResult {
      id: string;
      dqdl_expression: string;
      rule_type: string;
      status: string;
    }

    // Get active rules for dataset
    let rulesQuery = supabase
      .from('dq_rules')
      .select('id, dqdl_expression, rule_type, status')
      .eq('dataset_id', input.dataset_id)
      .in('status', ['active', 'approved']);

    if (input.rule_ids && input.rule_ids.length > 0) {
      rulesQuery = rulesQuery.in('id', input.rule_ids);
    }

    const { data: rules, error: rulesError } = await rulesQuery;

    if (rulesError) {
      console.error('Failed to fetch rules:', rulesError);
      return { error: 'Failed to fetch rules for dataset' };
    }

    if (!rules || rules.length === 0) {
      return { error: 'No active rules found for dataset' };
    }

    // Cast rules to typed array
    const typedRules = rules as RuleQueryResult[];

    // Create validation run record
    const { data: run, error: createError } = await supabase
      .from('validation_runs')
      .insert({
        dataset_id: input.dataset_id,
        status: 'pending',
        triggered_by: input.triggered_by,
        trigger_details: {
          rule_count: typedRules.length,
          rule_ids: typedRules.map((r) => r.id),
        },
      })
      .select()
      .single();

    if (createError || !run) {
      console.error('Failed to create validation run:', createError);
      return { error: 'Failed to create validation run' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runData = run as any;

    // Start Step Functions execution
    const stateMachineArn = process.env.VALIDATION_STATE_MACHINE_ARN;
    if (!stateMachineArn) {
      // Update run status to failed
      await supabase
        .from('validation_runs')
        .update({
          status: 'failed',
        })
        .eq('id', runData.id);
      return { error: 'Validation service not configured' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasetData = dataset as any;

    try {
      const client = getSfnClient();

      // Build ruleset name from rules (in production, you'd create/use a Glue ruleset)
      const rulesetNames = [`dataset-${input.dataset_id}-rules`];

      // Check if any rules need approval
      const pendingRules = typedRules.filter((r) => r.status === 'pending');
      const ruleStatus = pendingRules.length > 0 ? 'pending' : 'approved';

      const executionInput = {
        datasetId: input.dataset_id,
        datasetRef: `${datasetData.database_name}.${datasetData.table_name}`,
        database: datasetData.database_name,
        table: datasetData.table_name,
        validationRunId: runData.id,
        rulesetNames: rulesetNames,
        ruleStatus: ruleStatus,
        rules: typedRules.map((r) => ({
          id: r.id,
          expression: r.dqdl_expression,
          type: r.rule_type,
        })),
        reasoning: 'Validation triggered via API',
        glueRole: process.env.GLUE_ROLE_ARN || '',
      };

      const command = new StartExecutionCommand({
        stateMachineArn,
        input: JSON.stringify(executionInput),
        name: `validation-${runData.id}`,
      });

      const result = await client.send(command);

      // Update run with execution ARN
      await supabase
        .from('validation_runs')
        .update({
          step_function_execution_arn: result.executionArn,
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .eq('id', runData.id);

      // Fetch updated run
      const { data: updatedRun } = await supabase
        .from('validation_runs')
        .select()
        .eq('id', runData.id)
        .single();

      return { data: (updatedRun || run) as ValidationRun };
    } catch (sfnError) {
      console.error('Failed to start Step Functions execution:', sfnError);

      // Update run status to failed
      await supabase
        .from('validation_runs')
        .update({
          status: 'failed',
        })
        .eq('id', runData.id);

      return { error: 'Failed to start validation execution' };
    }
  } catch (err) {
    console.error('Unexpected error in POST /api/validations:', err);
    return { error: 'Internal server error' };
  }
}
