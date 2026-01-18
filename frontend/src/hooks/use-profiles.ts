'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, ProfileRun, ProfileResult, ColumnProfile, ProfileAnomaly, Dataset } from '@/lib/supabase';
import { profileApi } from '@/lib/api';

const PROFILES_QUERY_KEY = ['profiles'];

// List profile runs, optionally filtered by dataset
export function useProfiles(datasetId?: string) {
  return useQuery({
    queryKey: datasetId ? [...PROFILES_QUERY_KEY, { datasetId }] : PROFILES_QUERY_KEY,
    queryFn: async () => {
      let query = supabase
        .from('profile_runs')
        .select('*, datasets(*)')
        .order('created_at', { ascending: false });

      if (datasetId) {
        query = query.eq('dataset_id', datasetId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as (ProfileRun & { datasets: Dataset })[];
    },
  });
}

// Get single profile with full results
export interface ProfileDetail {
  run: ProfileRun & { datasets: Dataset };
  result: ProfileResult | null;
  columns: ColumnProfile[];
  anomalies: ProfileAnomaly[];
}

export function useProfile(id: string) {
  return useQuery({
    queryKey: ['profile', id],
    queryFn: async (): Promise<ProfileDetail> => {
      // Fetch the profile run
      const { data: run, error: runError } = await supabase
        .from('profile_runs')
        .select('*, datasets(*)')
        .eq('id', id)
        .single();

      if (runError) throw runError;

      // Fetch related profile result
      const { data: results, error: resultError } = await supabase
        .from('profile_results')
        .select('*')
        .eq('run_id', id)
        .limit(1);

      if (resultError) throw resultError;

      const result = results?.[0] || null;

      // If we have a result, fetch columns and anomalies
      let columns: ColumnProfile[] = [];
      let anomalies: ProfileAnomaly[] = [];

      if (result) {
        const [columnsResult, anomaliesResult] = await Promise.all([
          supabase
            .from('column_profiles')
            .select('*')
            .eq('result_id', result.id)
            .order('column_name'),
          supabase
            .from('profile_anomalies')
            .select('*')
            .eq('result_id', result.id)
            .order('severity', { ascending: false }),
        ]);

        if (columnsResult.error) throw columnsResult.error;
        if (anomaliesResult.error) throw anomaliesResult.error;

        columns = columnsResult.data as ColumnProfile[];
        anomalies = anomaliesResult.data as ProfileAnomaly[];
      }

      return {
        run: run as ProfileRun & { datasets: Dataset },
        result: result as ProfileResult | null,
        columns,
        anomalies,
      };
    },
    enabled: !!id,
    // Poll for status updates when profile is running
    refetchInterval: (query) => {
      const data = query.state.data as ProfileDetail | undefined;
      if (data?.run?.status === 'running' || data?.run?.status === 'pending') {
        return 5000; // Poll every 5 seconds
      }
      return false;
    },
  });
}

// Trigger a new profile run
export function useTriggerProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (datasetId: string) => {
      // First create the profile run in Supabase
      const { data: run, error: runError } = await supabase
        .from('profile_runs')
        .insert({
          dataset_id: datasetId,
          status: 'pending',
        })
        .select()
        .single();

      if (runError) throw runError;

      // Then trigger the backend profiler
      try {
        const response = await profileApi.triggerProfile({ datasetId });

        // Update the run with the execution ARN
        await supabase
          .from('profile_runs')
          .update({
            status: 'running',
            step_functions_execution_arn: response.executionArn,
            started_at: new Date().toISOString(),
          })
          .eq('id', run.id);

        return { ...run, executionArn: response.executionArn };
      } catch (err) {
        // Mark as failed if API call fails
        await supabase
          .from('profile_runs')
          .update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Failed to trigger profile',
          })
          .eq('id', run.id);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILES_QUERY_KEY });
    },
  });
}
