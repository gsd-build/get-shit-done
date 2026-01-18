'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, ValidationRun, ValidationRunDetail, RuleResult, QualityScore, Dataset } from '@/lib/supabase';
import { api } from '@/lib/api';

const VALIDATIONS_QUERY_KEY = ['validations'];

// Filter types
export interface ValidationFilters {
  dataset_id?: string;
  status?: ValidationRun['status'];
  start_date?: string;
  end_date?: string;
}

/**
 * List validation runs with optional filters
 */
export function useValidations(filters?: ValidationFilters) {
  return useQuery({
    queryKey: filters ? [...VALIDATIONS_QUERY_KEY, filters] : VALIDATIONS_QUERY_KEY,
    queryFn: async () => {
      let query = supabase
        .from('validation_runs')
        .select('*, datasets(*)')
        .order('created_at', { ascending: false });

      if (filters?.dataset_id) {
        query = query.eq('dataset_id', filters.dataset_id);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.start_date) {
        query = query.gte('created_at', filters.start_date);
      }
      if (filters?.end_date) {
        query = query.lte('created_at', filters.end_date);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as (ValidationRun & { datasets: Dataset })[];
    },
  });
}

/**
 * Get single validation run with full details (rule_results and quality_scores)
 */
export function useValidation(id: string) {
  return useQuery({
    queryKey: ['validations', id],
    queryFn: async (): Promise<ValidationRunDetail> => {
      // Fetch the validation run with nested relations
      const { data: run, error: runError } = await supabase
        .from('validation_runs')
        .select('*, datasets(*)')
        .eq('id', id)
        .single();

      if (runError) throw runError;

      // Fetch rule results with rule details
      const { data: ruleResults, error: resultsError } = await supabase
        .from('rule_results')
        .select('*, dq_rules(id, name, description, rule_type, dqdl_expression)')
        .eq('run_id', id)
        .order('result', { ascending: true }); // Failures first

      if (resultsError) throw resultsError;

      // Fetch quality scores for this run
      const { data: qualityScores, error: scoresError } = await supabase
        .from('quality_scores')
        .select('*')
        .eq('run_id', id)
        .order('dimension');

      if (scoresError) throw scoresError;

      return {
        ...(run as ValidationRun),
        datasets: run.datasets as Dataset,
        rule_results: (ruleResults || []) as RuleResult[],
        quality_scores: (qualityScores || []) as QualityScore[],
      };
    },
    enabled: !!id,
  });
}

/**
 * Hook for polling validation status while running
 * Only polls when enabled and status is 'pending' or 'running'
 */
export function useValidationPolling(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['validations', id, 'polling'],
    queryFn: async (): Promise<ValidationRunDetail> => {
      const { data: run, error: runError } = await supabase
        .from('validation_runs')
        .select('*, datasets(*)')
        .eq('id', id)
        .single();

      if (runError) throw runError;

      const { data: ruleResults, error: resultsError } = await supabase
        .from('rule_results')
        .select('*, dq_rules(id, name, description, rule_type, dqdl_expression)')
        .eq('run_id', id)
        .order('result', { ascending: true });

      if (resultsError) throw resultsError;

      const { data: qualityScores, error: scoresError } = await supabase
        .from('quality_scores')
        .select('*')
        .eq('run_id', id)
        .order('dimension');

      if (scoresError) throw scoresError;

      return {
        ...(run as ValidationRun),
        datasets: run.datasets as Dataset,
        rule_results: (ruleResults || []) as RuleResult[],
        quality_scores: (qualityScores || []) as QualityScore[],
      };
    },
    enabled: enabled && !!id,
    refetchInterval: (query) => {
      const data = query.state.data as ValidationRunDetail | undefined;
      // Poll every 5 seconds if pending or running
      if (data?.status === 'pending' || data?.status === 'running') {
        return 5000;
      }
      // Stop polling when completed or failed
      return false;
    },
  });
}

// Trigger validation input type
export interface TriggerValidationInput {
  dataset_id: string;
  rule_ids?: string[];
  triggered_by?: 'manual' | 'scheduled' | 'pipeline' | 'event';
}

// Trigger validation response type
interface TriggerValidationResponse {
  data?: ValidationRun;
  error?: string;
}

/**
 * Mutation to trigger a new validation run
 */
export function useTriggerValidation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TriggerValidationInput): Promise<ValidationRun> => {
      const response = await api.post<TriggerValidationResponse>('/api/validations', {
        dataset_id: input.dataset_id,
        rule_ids: input.rule_ids,
        triggered_by: input.triggered_by || 'manual',
      });

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.data) {
        throw new Error('No data returned from validation trigger');
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VALIDATIONS_QUERY_KEY });
    },
  });
}

/**
 * Mutation to cancel a running validation
 */
export function useCancelValidation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await api.delete<{ data?: { cancelled: boolean }; error?: string }>(
        `/api/validations/${id}`
      );

      if (response.error) {
        throw new Error(response.error);
      }
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: VALIDATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['validations', id] });
    },
  });
}
