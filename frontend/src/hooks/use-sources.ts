'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, DataSource, Dataset } from '@/lib/supabase';

const SOURCES_QUERY_KEY = ['sources'];

// List all data sources
export function useSources() {
  return useQuery({
    queryKey: SOURCES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DataSource[];
    },
  });
}

// Get single source with its datasets
export function useSource(id: string) {
  return useQuery({
    queryKey: ['source', id],
    queryFn: async () => {
      const [sourceResult, datasetsResult] = await Promise.all([
        supabase.from('data_sources').select('*').eq('id', id).single(),
        supabase.from('datasets').select('*').eq('source_id', id),
      ]);

      if (sourceResult.error) throw sourceResult.error;
      if (datasetsResult.error) throw datasetsResult.error;

      return {
        source: sourceResult.data as DataSource,
        datasets: datasetsResult.data as Dataset[],
      };
    },
    enabled: !!id,
  });
}

export interface CreateSourceInput {
  name: string;
  source_type: 'iceberg' | 'redshift' | 'athena';
  connection_config: Record<string, unknown>;
  database_name: string;
  table_name: string;
}

// Create new source and associated dataset
export function useCreateSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSourceInput) => {
      const { name, source_type, connection_config, database_name, table_name } =
        input;

      // Create source
      const { data: source, error: sourceError } = await supabase
        .from('data_sources')
        .insert({
          name,
          source_type,
          connection_config,
        })
        .select()
        .single();

      if (sourceError) throw sourceError;

      // Create associated dataset
      const { data: dataset, error: datasetError } = await supabase
        .from('datasets')
        .insert({
          source_id: source.id,
          database_name,
          table_name,
        })
        .select()
        .single();

      if (datasetError) {
        // Rollback source on dataset failure
        await supabase.from('data_sources').delete().eq('id', source.id);
        throw datasetError;
      }

      return { source: source as DataSource, dataset: dataset as Dataset };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SOURCES_QUERY_KEY });
    },
  });
}

// Delete source (cascades to datasets)
export function useDeleteSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('data_sources').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SOURCES_QUERY_KEY });
    },
  });
}
