/**
 * Data Sources API Routes
 *
 * GET /api/sources - List all data sources with dataset counts
 * POST /api/sources - Create a new data source
 */

import { z } from 'zod';
import { supabase, DataSource } from '../../lib/supabase';

// Response types
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface DataSourceWithCounts extends DataSource {
  dataset_count: number;
}

// Validation schemas
const createSourceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  source_type: z.enum(['iceberg', 'redshift', 'athena'], {
    errorMap: () => ({ message: 'source_type must be iceberg, redshift, or athena' }),
  }),
  connection_config: z.record(z.unknown()).optional().default({}),
});

type CreateSourceInput = z.infer<typeof createSourceSchema>;

/**
 * GET /api/sources
 * List all data sources with dataset counts
 */
export async function GET(): Promise<ApiResponse<DataSourceWithCounts[]>> {
  try {
    // Fetch sources with dataset count using a subquery
    const { data: sources, error } = await supabase
      .from('data_sources')
      .select(`
        *,
        datasets:datasets(count)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch sources:', error);
      return { error: 'Failed to fetch data sources' };
    }

    // Transform the result to flatten dataset count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sourcesWithCounts: DataSourceWithCounts[] = (sources || []).map((source: any) => ({
      ...source,
      dataset_count: Array.isArray(source.datasets)
        ? source.datasets.length
        : (source.datasets as { count: number })?.count || 0,
    }));

    return { data: sourcesWithCounts };
  } catch (err) {
    console.error('Unexpected error in GET /api/sources:', err);
    return { error: 'Internal server error' };
  }
}

/**
 * POST /api/sources
 * Create a new data source
 */
export async function POST(body: unknown): Promise<ApiResponse<DataSource>> {
  try {
    // Validate input
    const parseResult = createSourceSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return { error: `Validation error: ${errorMessages}` };
    }

    const input: CreateSourceInput = parseResult.data;

    // Check for duplicate name
    const { data: existing } = await supabase
      .from('data_sources')
      .select('id')
      .eq('name', input.name)
      .single();

    if (existing) {
      return { error: `Data source with name '${input.name}' already exists` };
    }

    // Create the data source
    const { data: source, error } = await supabase
      .from('data_sources')
      .insert({
        name: input.name,
        source_type: input.source_type,
        connection_config: input.connection_config,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create source:', error);
      return { error: 'Failed to create data source' };
    }

    return { data: source as DataSource };
  } catch (err) {
    console.error('Unexpected error in POST /api/sources:', err);
    return { error: 'Internal server error' };
  }
}
