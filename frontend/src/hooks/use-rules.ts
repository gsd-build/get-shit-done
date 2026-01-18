'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';

// ============================================================================
// Types
// ============================================================================

export interface DQRule {
  id: string;
  dataset_id: string;
  column_name: string | null;
  rule_type: 'completeness' | 'uniqueness' | 'range' | 'pattern' | 'freshness' | 'referential' | 'custom';
  dqdl_expression: string;
  description: string | null;
  generated_by: 'ai_recommender' | 'glue_ml' | 'user' | 'template' | null;
  reasoning: string | null;
  template_name: string | null;
  status: 'pending' | 'approved' | 'active' | 'disabled' | 'deprecated';
  severity: 'critical' | 'warning' | 'info';
  created_by: string | null;
  approved_by: string | null;
  owner_id: string | null;
  expires_at: string | null;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

export interface RuleFilters {
  dataset_id?: string;
  status?: DQRule['status'];
  rule_type?: DQRule['rule_type'];
  severity?: DQRule['severity'];
}

export interface CreateRuleInput {
  dataset_id: string;
  column_name?: string | null;
  rule_type: DQRule['rule_type'];
  dqdl_expression: string;
  description?: string | null;
  generated_by?: DQRule['generated_by'];
  reasoning?: string | null;
  template_name?: string | null;
  severity?: DQRule['severity'];
  skip_approval?: boolean;
}

export interface UpdateRuleInput {
  column_name?: string | null;
  dqdl_expression?: string;
  description?: string | null;
  severity?: DQRule['severity'];
  status?: 'active' | 'disabled';
}

export interface RuleGenerationRequest {
  description: string;
  column_name: string;
  dataset_id: string;
  profile_summary?: Record<string, unknown>;
}

export interface RuleGenerationResponse {
  rule: string;
  reasoning: string;
  false_positive_scenarios: string[];
  severity: 'critical' | 'warning' | 'info';
  suggested_rule_type: string;
}

export interface ApproveRejectInput {
  reviewer_id?: string;
  comments?: string;
}

// ============================================================================
// Query Keys
// ============================================================================

const RULES_QUERY_KEY = ['rules'];

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * List DQ rules with optional filters
 */
export function useRules(filters?: RuleFilters) {
  return useQuery({
    queryKey: filters ? [...RULES_QUERY_KEY, filters] : RULES_QUERY_KEY,
    queryFn: async () => {
      let query = supabase
        .from('dq_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.dataset_id) {
        query = query.eq('dataset_id', filters.dataset_id);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.rule_type) {
        query = query.eq('rule_type', filters.rule_type);
      }
      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DQRule[];
    },
  });
}

/**
 * Get single rule with full details
 */
export function useRule(id: string) {
  return useQuery({
    queryKey: ['rules', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dq_rules')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as DQRule;
    },
    enabled: !!id,
  });
}

/**
 * Get pending rules for approval queue
 * Includes count for badge display
 */
export function usePendingRules() {
  return useQuery({
    queryKey: [...RULES_QUERY_KEY, { status: 'pending' }],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('dq_rules')
        .select('*', { count: 'exact' })
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return {
        rules: data as DQRule[],
        count: count || 0,
      };
    },
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Create a new DQ rule
 */
export function useCreateRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRuleInput) => {
      const response = await api.post<{ data?: DQRule; error?: string }>(
        '/api/rules',
        input
      );

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RULES_QUERY_KEY });
    },
  });
}

/**
 * Update an existing rule
 */
export function useUpdateRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateRuleInput & { id: string }) => {
      const response = await api.put<{ data?: DQRule; error?: string }>(
        `/api/rules/${id}`,
        input
      );

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: RULES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['rules', data.id] });
    },
  });
}

/**
 * Approve a pending rule
 */
export function useApproveRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: ApproveRejectInput & { id: string }) => {
      const response = await api.post<{ data?: DQRule; error?: string }>(
        `/api/rules/${id}/approve`,
        input
      );

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: RULES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['rules', data.id] });
    },
  });
}

/**
 * Reject a pending rule
 */
export function useRejectRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: ApproveRejectInput & { id: string }) => {
      const response = await api.post<{ data?: DQRule; error?: string }>(
        `/api/rules/${id}/reject`,
        input
      );

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: RULES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['rules', data.id] });
    },
  });
}

/**
 * Delete (deprecate) a rule
 */
export function useDeleteRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<{ data?: { deprecated: boolean }; error?: string }>(
        `/api/rules/${id}`
      );

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RULES_QUERY_KEY });
    },
  });
}

/**
 * Generate a DQDL rule using AI
 * Note: This doesn't create the rule - it returns a generated suggestion
 * Use useCreateRule to actually create the rule after generation
 */
export function useGenerateRule() {
  return useMutation({
    mutationFn: async (input: RuleGenerationRequest) => {
      const response = await api.post<{ data?: RuleGenerationResponse; error?: string }>(
        '/api/rules/generate',
        input
      );

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data!;
    },
    // No cache invalidation - generation doesn't create a rule
  });
}
