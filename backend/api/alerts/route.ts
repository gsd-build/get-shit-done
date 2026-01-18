/**
 * Alerts API Routes
 *
 * GET /api/alerts - List alerts with filters
 */

import { z } from 'zod';
import { supabase } from '../../lib/supabase';

// Response types
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface Alert {
  id: string;
  dataset_id: string | null;
  rule_id: string | null;
  run_id: string | null;
  alert_type: 'rule_failure' | 'freshness_sla' | 'volume_anomaly';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string | null;
  details: Record<string, unknown> | null;
  status: 'open' | 'acknowledged' | 'resolved' | 'snoozed';
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  notification_sent: boolean;
  notification_channels: string[] | null;
  created_at: string;
}

// Validation schemas
const listAlertsSchema = z.object({
  dataset_id: z.string().uuid().optional(),
  status: z.enum(['open', 'acknowledged', 'resolved', 'snoozed']).optional(),
  severity: z.enum(['critical', 'warning', 'info']).optional(),
  alert_type: z.enum(['rule_failure', 'freshness_sla', 'volume_anomaly']).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

type ListAlertsInput = z.infer<typeof listAlertsSchema>;

/**
 * GET /api/alerts
 * List alerts with optional filters
 */
export async function GET(query: unknown): Promise<ApiResponse<Alert[]>> {
  try {
    // Validate query params
    const parseResult = listAlertsSchema.safeParse(query);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return { error: `Validation error: ${errorMessages}` };
    }

    const input: ListAlertsInput = parseResult.data;

    // Build query - default to open alerts sorted by severity and created_at
    let queryBuilder = supabase
      .from('alerts')
      .select('*')
      .order('severity', { ascending: true }) // critical first (alphabetically)
      .order('created_at', { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    // Apply filters
    if (input.dataset_id) {
      queryBuilder = queryBuilder.eq('dataset_id', input.dataset_id);
    }
    if (input.status) {
      queryBuilder = queryBuilder.eq('status', input.status);
    } else {
      // Default to open alerts
      queryBuilder = queryBuilder.eq('status', 'open');
    }
    if (input.severity) {
      queryBuilder = queryBuilder.eq('severity', input.severity);
    }
    if (input.alert_type) {
      queryBuilder = queryBuilder.eq('alert_type', input.alert_type);
    }
    if (input.start_date) {
      queryBuilder = queryBuilder.gte('created_at', input.start_date);
    }
    if (input.end_date) {
      queryBuilder = queryBuilder.lte('created_at', input.end_date);
    }

    const { data: alerts, error } = await queryBuilder;

    if (error) {
      console.error('Failed to fetch alerts:', error);
      return { error: 'Failed to fetch alerts' };
    }

    return { data: (alerts || []) as Alert[] };
  } catch (err) {
    console.error('Unexpected error in GET /api/alerts:', err);
    return { error: 'Internal server error' };
  }
}
