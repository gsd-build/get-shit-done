'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Alert, AlertStatus, AlertSeverity, AlertType } from '@/lib/supabase';
import { api } from '@/lib/api';

const ALERTS_QUERY_KEY = ['alerts'];

// Filter types
export interface AlertFilters {
  dataset_id?: string;
  status?: AlertStatus;
  severity?: AlertSeverity;
  alert_type?: AlertType;
  start_date?: string;
  end_date?: string;
}

/**
 * List alerts with optional filters
 * Default filter: open alerts
 */
export function useAlerts(filters?: AlertFilters) {
  // Default to open status if no status filter provided
  const effectiveFilters = filters || { status: 'open' as AlertStatus };

  return useQuery({
    queryKey: [...ALERTS_QUERY_KEY, effectiveFilters],
    queryFn: async () => {
      let query = supabase
        .from('alerts')
        .select('*, datasets(id, database_name, table_name)')
        .order('severity', { ascending: true }) // critical first (alphabetically)
        .order('created_at', { ascending: false });

      if (effectiveFilters.dataset_id) {
        query = query.eq('dataset_id', effectiveFilters.dataset_id);
      }
      if (effectiveFilters.status) {
        query = query.eq('status', effectiveFilters.status);
      }
      if (effectiveFilters.severity) {
        query = query.eq('severity', effectiveFilters.severity);
      }
      if (effectiveFilters.alert_type) {
        query = query.eq('alert_type', effectiveFilters.alert_type);
      }
      if (effectiveFilters.start_date) {
        query = query.gte('created_at', effectiveFilters.start_date);
      }
      if (effectiveFilters.end_date) {
        query = query.lte('created_at', effectiveFilters.end_date);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Alert[];
    },
    // Refetch on window focus for near-realtime feel
    refetchOnWindowFocus: true,
  });
}

/**
 * Get single alert with full details including related dataset, rule, and validation run
 */
export function useAlert(id: string) {
  return useQuery({
    queryKey: ['alerts', id],
    queryFn: async (): Promise<Alert> => {
      const { data: alert, error } = await supabase
        .from('alerts')
        .select(`
          *,
          datasets(id, database_name, table_name),
          dq_rules(id, dqdl_expression, description),
          validation_runs(id, overall_score, rules_passed, rules_failed)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return alert as Alert;
    },
    enabled: !!id,
  });
}

/**
 * Get count of open alerts for navigation badge
 * Polls every 30 seconds for near-realtime badge
 */
export function useOpenAlertCount() {
  return useQuery({
    queryKey: ['alerts', 'count', 'open'],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Get alert counts by status for dashboard stats
 */
export function useAlertCounts() {
  return useQuery({
    queryKey: ['alerts', 'counts'],
    queryFn: async () => {
      // Get counts for different statuses and severities
      const [openResult, criticalResult, warningResult, acknowledgedResult, resolvedResult] = await Promise.all([
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'critical'),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'warning'),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'acknowledged'),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
      ]);

      return {
        open: openResult.count || 0,
        critical: criticalResult.count || 0,
        warning: warningResult.count || 0,
        acknowledged: acknowledgedResult.count || 0,
        resolved: resolvedResult.count || 0,
      };
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });
}

// Acknowledge alert input type
export interface AcknowledgeAlertInput {
  id: string;
  acknowledgment_note?: string;
  user_id?: string;
}

/**
 * Mutation to acknowledge an alert
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AcknowledgeAlertInput): Promise<Alert> => {
      const response = await api.put<{ data?: Alert; error?: string }>(
        `/api/alerts/${input.id}`,
        {
          status: 'acknowledged',
          user_id: input.user_id,
          resolution_notes: input.acknowledgment_note, // API uses resolution_notes for both
        }
      );

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.data) {
        throw new Error('No data returned from acknowledge alert');
      }

      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['alerts', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['alerts', 'count', 'open'] });
      queryClient.invalidateQueries({ queryKey: ['alerts', 'counts'] });
    },
  });
}

// Resolve alert input type
export interface ResolveAlertInput {
  id: string;
  resolution_notes: string;
  user_id?: string;
}

/**
 * Mutation to resolve an alert
 * Requires resolution_notes
 */
export function useResolveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ResolveAlertInput): Promise<Alert> => {
      if (!input.resolution_notes) {
        throw new Error('Resolution notes are required');
      }

      const response = await api.put<{ data?: Alert; error?: string }>(
        `/api/alerts/${input.id}`,
        {
          status: 'resolved',
          user_id: input.user_id,
          resolution_notes: input.resolution_notes,
        }
      );

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.data) {
        throw new Error('No data returned from resolve alert');
      }

      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['alerts', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['alerts', 'count', 'open'] });
      queryClient.invalidateQueries({ queryKey: ['alerts', 'counts'] });
    },
  });
}

// Snooze alert input type
export interface SnoozeAlertInput {
  id: string;
  duration: '1h' | '4h' | '1d' | '1w';
  user_id?: string;
}

/**
 * Mutation to snooze an alert
 */
export function useSnoozeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SnoozeAlertInput): Promise<Alert> => {
      const response = await api.put<{ data?: Alert; error?: string }>(
        `/api/alerts/${input.id}`,
        {
          status: 'snoozed',
          user_id: input.user_id,
          // Note: Backend would need to handle snooze duration tracking
          // For MVP, we just set status to snoozed
        }
      );

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.data) {
        throw new Error('No data returned from snooze alert');
      }

      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['alerts', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['alerts', 'count', 'open'] });
      queryClient.invalidateQueries({ queryKey: ['alerts', 'counts'] });
    },
  });
}
