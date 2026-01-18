/**
 * Single Data Source API Routes
 *
 * GET /api/sources/:id - Get data source by ID with its datasets
 * PUT /api/sources/:id - Update data source
 * DELETE /api/sources/:id - Delete data source (cascades to datasets)
 */

import { z } from 'zod';
import { supabase, DataSource, Dataset } from '../../../lib/supabase';

// Response types
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface DataSourceWithDatasets extends DataSource {
  datasets: Dataset[];
}

// Validation schemas
const updateSourceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  connection_config: z.record(z.unknown()).optional(),
});

type UpdateSourceInput = z.infer<typeof updateSourceSchema>;

/**
 * GET /api/sources/:id
 * Get data source by ID with its datasets
 */
export async function GET(id: string): Promise<ApiResponse<DataSourceWithDatasets>> {
  try {
    // Validate UUID format
    if (!isValidUUID(id)) {
      return { error: 'Invalid source ID format' };
    }

    // Fetch source with datasets
    const { data: source, error } = await supabase
      .from('data_sources')
      .select(`
        *,
        datasets(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { error: 'Data source not found' };
      }
      console.error('Failed to fetch source:', error);
      return { error: 'Failed to fetch data source' };
    }

    return { data: source as DataSourceWithDatasets };
  } catch (err) {
    console.error('Unexpected error in GET /api/sources/:id:', err);
    return { error: 'Internal server error' };
  }
}

/**
 * PUT /api/sources/:id
 * Update data source (name, connection_config)
 */
export async function PUT(id: string, body: unknown): Promise<ApiResponse<DataSource>> {
  try {
    // Validate UUID format
    if (!isValidUUID(id)) {
      return { error: 'Invalid source ID format' };
    }

    // Validate input
    const parseResult = updateSourceSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return { error: `Validation error: ${errorMessages}` };
    }

    const input: UpdateSourceInput = parseResult.data;

    // Check if anything to update
    if (!input.name && !input.connection_config) {
      return { error: 'No fields to update' };
    }

    // Check if source exists
    const { data: existing, error: fetchError } = await supabase
      .from('data_sources')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return { error: 'Data source not found' };
    }

    // Check for duplicate name if updating name
    if (input.name) {
      const { data: duplicate } = await supabase
        .from('data_sources')
        .select('id')
        .eq('name', input.name)
        .neq('id', id)
        .single();

      if (duplicate) {
        return { error: `Data source with name '${input.name}' already exists` };
      }
    }

    // Update the source
    const updateData: Record<string, unknown> = {};
    if (input.name) updateData.name = input.name;
    if (input.connection_config) updateData.connection_config = input.connection_config;

    const { data: source, error } = await supabase
      .from('data_sources')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update source:', error);
      return { error: 'Failed to update data source' };
    }

    return { data: source as DataSource };
  } catch (err) {
    console.error('Unexpected error in PUT /api/sources/:id:', err);
    return { error: 'Internal server error' };
  }
}

/**
 * DELETE /api/sources/:id
 * Delete data source (cascades to datasets, runs, results)
 */
export async function DELETE(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  try {
    // Validate UUID format
    if (!isValidUUID(id)) {
      return { error: 'Invalid source ID format' };
    }

    // Check if source exists
    const { data: existing, error: fetchError } = await supabase
      .from('data_sources')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return { error: 'Data source not found' };
    }

    // Delete source (cascades via foreign keys)
    const { error } = await supabase
      .from('data_sources')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete source:', error);
      return { error: 'Failed to delete data source' };
    }

    return { data: { deleted: true } };
  } catch (err) {
    console.error('Unexpected error in DELETE /api/sources/:id:', err);
    return { error: 'Internal server error' };
  }
}

// Helper to validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
