/**
 * Profile Runs API Routes
 *
 * GET /api/profiles - List profile runs with filters
 * POST /api/profiles - Trigger a new profile run
 */

import { z } from 'zod';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { supabase, ProfileRun, ProfileResult } from '../../lib/supabase';

// Response types
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface ProfileRunWithResult extends ProfileRun {
  latest_result?: ProfileResult | null;
}

// Validation schemas
const listProfilesSchema = z.object({
  dataset_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const triggerProfileSchema = z.object({
  dataset_id: z.string().uuid('Invalid dataset ID'),
});

type ListProfilesInput = z.infer<typeof listProfilesSchema>;
type TriggerProfileInput = z.infer<typeof triggerProfileSchema>;

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
 * GET /api/profiles
 * List profile runs with optional filters
 */
export async function GET(query: unknown): Promise<ApiResponse<ProfileRunWithResult[]>> {
  try {
    // Validate query params
    const parseResult = listProfilesSchema.safeParse(query);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return { error: `Validation error: ${errorMessages}` };
    }

    const input: ListProfilesInput = parseResult.data;

    // Build query
    let queryBuilder = supabase
      .from('profile_runs')
      .select(`
        *,
        profile_results(*)
      `)
      .order('created_at', { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    // Apply filters
    if (input.dataset_id) {
      queryBuilder = queryBuilder.eq('dataset_id', input.dataset_id);
    }
    if (input.status) {
      queryBuilder = queryBuilder.eq('status', input.status);
    }

    const { data: runs, error } = await queryBuilder;

    if (error) {
      console.error('Failed to fetch profile runs:', error);
      return { error: 'Failed to fetch profile runs' };
    }

    // Transform to include latest result summary
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runsWithResults: ProfileRunWithResult[] = (runs || []).map((run: any) => {
      const results = run.profile_results as ProfileResult[] | null;
      const { profile_results: _unused, ...runWithoutResults } = run;
      return {
        ...runWithoutResults,
        latest_result: results && results.length > 0 ? results[0] : null,
      };
    });

    return { data: runsWithResults };
  } catch (err) {
    console.error('Unexpected error in GET /api/profiles:', err);
    return { error: 'Internal server error' };
  }
}

/**
 * POST /api/profiles
 * Trigger a new profile run
 */
export async function POST(body: unknown): Promise<ApiResponse<ProfileRun>> {
  try {
    // Validate input
    const parseResult = triggerProfileSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return { error: `Validation error: ${errorMessages}` };
    }

    const input: TriggerProfileInput = parseResult.data;

    // Verify dataset exists and get source info
    const { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .select(`
        *,
        data_sources(*)
      `)
      .eq('id', input.dataset_id)
      .single();

    if (datasetError || !dataset) {
      return { error: 'Dataset not found' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source = (dataset as any).data_sources as {
      source_type: string;
      connection_config: Record<string, unknown>;
    } | null;

    if (!source) {
      return { error: 'Data source not found for dataset' };
    }

    // Create profile run record
    const { data: run, error: createError } = await supabase
      .from('profile_runs')
      .insert({
        dataset_id: input.dataset_id,
        status: 'pending',
      })
      .select()
      .single();

    if (createError || !run) {
      console.error('Failed to create profile run:', createError);
      return { error: 'Failed to create profile run' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runData = run as any;

    // Start Step Functions execution
    const stateMachineArn = process.env.PROFILER_STATE_MACHINE_ARN;
    if (!stateMachineArn) {
      // Update run status to failed
      await supabase
        .from('profile_runs')
        .update({
          status: 'failed',
          error_message: 'State machine ARN not configured',
        })
        .eq('id', runData.id);
      return { error: 'Profiler service not configured' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasetData = dataset as any;

    try {
      const client = getSfnClient();
      const executionInput = {
        sourceType: source.source_type,
        database: datasetData.database_name,
        table: datasetData.table_name,
        connectionParams: JSON.stringify(source.connection_config),
        runId: runData.id,
      };

      const command = new StartExecutionCommand({
        stateMachineArn,
        input: JSON.stringify(executionInput),
        name: `profile-${runData.id}`,
      });

      const result = await client.send(command);

      // Update run with execution ARN
      await supabase
        .from('profile_runs')
        .update({
          execution_arn: result.executionArn,
          started_at: new Date().toISOString(),
        })
        .eq('id', runData.id);

      // Fetch updated run
      const { data: updatedRun } = await supabase
        .from('profile_runs')
        .select()
        .eq('id', runData.id)
        .single();

      return { data: (updatedRun || run) as ProfileRun };
    } catch (sfnError) {
      console.error('Failed to start Step Functions execution:', sfnError);

      // Update run status to failed
      await supabase
        .from('profile_runs')
        .update({
          status: 'failed',
          error_message: `Failed to start profiler: ${sfnError instanceof Error ? sfnError.message : 'Unknown error'}`,
        })
        .eq('id', runData.id);

      return { error: 'Failed to start profile execution' };
    }
  } catch (err) {
    console.error('Unexpected error in POST /api/profiles:', err);
    return { error: 'Internal server error' };
  }
}
