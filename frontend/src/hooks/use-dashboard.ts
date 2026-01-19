'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase, Dataset } from '@/lib/supabase';

// Dashboard stats returned from get_dashboard_stats RPC
export interface DashboardStats {
  total_datasets: number;
  avg_composite_score: number | null;
  datasets_above_threshold: number;
  datasets_below_threshold: number;
  open_alerts: number;
  critical_alerts: number;
}

// Trend data point from get_quality_trends RPC
export interface TrendDataPoint {
  day: string;
  dimension: string;
  avg_score: number;
  rolling_7day_avg: number | null;
}

// Dataset health for the health list
export interface DatasetHealth {
  id: string;
  database_name: string;
  table_name: string;
  composite_score: number | null;
  last_validation_at: string | null;
}

/**
 * Fetch dashboard stats from get_dashboard_stats RPC
 * Returns summary stats for the overview cards
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const { data, error } = await supabase.rpc('get_dashboard_stats');

      if (error) throw error;

      // Handle case where RPC returns array vs single object
      const stats = Array.isArray(data) ? data[0] : data;

      return {
        total_datasets: stats?.total_datasets ?? 0,
        avg_composite_score: stats?.avg_composite_score ?? null,
        datasets_above_threshold: stats?.datasets_above_threshold ?? 0,
        datasets_below_threshold: stats?.datasets_below_threshold ?? 0,
        open_alerts: stats?.open_alerts ?? 0,
        critical_alerts: stats?.critical_alerts ?? 0,
      };
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetch quality trends from get_quality_trends RPC
 * Returns time series data for quality dimensions
 */
export function useQualityTrends(datasetId?: string, days: number = 30) {
  return useQuery({
    queryKey: ['dashboard', 'trends', datasetId, days],
    queryFn: async (): Promise<TrendDataPoint[]> => {
      const { data, error } = await supabase.rpc('get_quality_trends', {
        p_dataset_id: datasetId || null,
        p_days: days,
      });

      if (error) throw error;
      return (data || []) as TrendDataPoint[];
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetch dataset health list with composite scores
 * Queries datasets and their latest composite quality scores
 */
export function useDatasetHealthList() {
  return useQuery({
    queryKey: ['dashboard', 'datasets', 'health'],
    queryFn: async (): Promise<DatasetHealth[]> => {
      // Fetch all datasets
      const { data: datasets, error: datasetsError } = await supabase
        .from('datasets')
        .select('id, database_name, table_name')
        .order('created_at', { ascending: false });

      if (datasetsError) throw datasetsError;
      if (!datasets || datasets.length === 0) return [];

      // For each dataset, get composite score and last validation
      const healthData = await Promise.all(
        (datasets as Dataset[]).map(async (dataset) => {
          // Get composite score from RPC
          const { data: scoreData } = await supabase.rpc(
            'get_composite_quality_score',
            { p_dataset_id: dataset.id }
          );

          // Get last validation date
          const { data: validationData } = await supabase
            .from('validation_runs')
            .select('completed_at')
            .eq('dataset_id', dataset.id)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(1)
            .single();

          const compositeScore = scoreData ?? null;

          return {
            id: dataset.id,
            database_name: dataset.database_name,
            table_name: dataset.table_name,
            composite_score: typeof compositeScore === 'number' ? compositeScore : null,
            last_validation_at: validationData?.completed_at ?? null,
          };
        })
      );

      // Sort by composite_score ascending (worst first), nulls last
      return healthData.sort((a, b) => {
        if (a.composite_score === null && b.composite_score === null) return 0;
        if (a.composite_score === null) return 1;
        if (b.composite_score === null) return -1;
        return a.composite_score - b.composite_score;
      });
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}
