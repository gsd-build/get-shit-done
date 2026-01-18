/**
 * Single Profile Run API Routes
 *
 * GET /api/profiles/:id - Get profile run by ID with full results
 */

import { supabase, ProfileRun, ProfileResult, ColumnProfile, ProfileAnomaly } from '../../../lib/supabase';

// Response types
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface ProfileRunDetails extends ProfileRun {
  result?: ProfileResult | null;
  column_profiles?: ColumnProfile[];
  anomalies?: ProfileAnomaly[];
}

/**
 * GET /api/profiles/:id
 * Get profile run by ID with full results
 *
 * Returns:
 * - If status='running' or 'pending': Just the run status
 * - If status='completed': Full results including column_profiles and anomalies
 * - If status='failed': Run status with error_message
 */
export async function GET(id: string): Promise<ApiResponse<ProfileRunDetails>> {
  try {
    // Validate UUID format
    if (!isValidUUID(id)) {
      return { error: 'Invalid profile run ID format' };
    }

    // Fetch profile run
    const { data: run, error: runError } = await supabase
      .from('profile_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (runError) {
      if (runError.code === 'PGRST116') {
        return { error: 'Profile run not found' };
      }
      console.error('Failed to fetch profile run:', runError);
      return { error: 'Failed to fetch profile run' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runData = run as any;

    // If not completed, return basic status
    if (runData.status === 'pending' || runData.status === 'running') {
      return {
        data: {
          ...runData,
          result: null,
          column_profiles: [],
          anomalies: [],
        } as ProfileRunDetails,
      };
    }

    // For completed or failed runs, fetch results
    const { data: results, error: resultsError } = await supabase
      .from('profile_results')
      .select('*')
      .eq('run_id', id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (resultsError) {
      console.error('Failed to fetch profile results:', resultsError);
      // Continue with run data only
      return {
        data: {
          ...runData,
          result: null,
          column_profiles: [],
          anomalies: [],
        } as ProfileRunDetails,
      };
    }

    const result = results && results.length > 0 ? results[0] as ProfileResult : null;

    // Fetch column profiles if we have a result
    let columnProfiles: ColumnProfile[] = [];
    if (result) {
      const { data: columns, error: columnsError } = await supabase
        .from('column_profiles')
        .select('*')
        .eq('result_id', result.id)
        .order('column_name');

      if (!columnsError && columns) {
        columnProfiles = columns as ColumnProfile[];
      }
    }

    // Fetch anomalies
    const { data: anomalies, error: anomaliesError } = await supabase
      .from('profile_anomalies')
      .select('*')
      .eq('run_id', id)
      .order('severity', { ascending: true }) // critical first
      .order('column_name');

    return {
      data: {
        ...runData,
        result,
        column_profiles: columnProfiles,
        anomalies: !anomaliesError && anomalies ? anomalies as ProfileAnomaly[] : [],
      } as ProfileRunDetails,
    };
  } catch (err) {
    console.error('Unexpected error in GET /api/profiles/:id:', err);
    return { error: 'Internal server error' };
  }
}

// Helper to validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
