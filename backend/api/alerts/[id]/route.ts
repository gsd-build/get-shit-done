/**
 * Alert Detail API Routes
 *
 * GET /api/alerts/[id] - Get alert by ID with full details
 * PUT /api/alerts/[id] - Update alert status (acknowledge, resolve, snooze)
 */

import { z } from 'zod';
import { supabase } from '../../../lib/supabase';

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
const idParamSchema = z.object({
  id: z.string().uuid('Invalid alert ID'),
});

const updateAlertSchema = z.object({
  status: z.enum(['acknowledged', 'resolved', 'snoozed']),
  user_id: z.string().uuid().optional(), // Who is making the change
  resolution_notes: z.string().optional(), // Required for resolve
});

type UpdateAlertInput = z.infer<typeof updateAlertSchema>;

/**
 * GET /api/alerts/[id]
 * Get alert by ID with full details
 */
export async function GET(params: unknown): Promise<ApiResponse<Alert>> {
  try {
    // Validate ID
    const parseResult = idParamSchema.safeParse(params);
    if (!parseResult.success) {
      return { error: 'Invalid alert ID' };
    }

    const { id } = parseResult.data;

    // Fetch alert with related dataset and rule info
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

    if (error || !alert) {
      if (error?.code === 'PGRST116') {
        return { error: 'Alert not found' };
      }
      console.error('Failed to fetch alert:', error);
      return { error: 'Failed to fetch alert' };
    }

    return { data: alert as Alert };
  } catch (err) {
    console.error('Unexpected error in GET /api/alerts/[id]:', err);
    return { error: 'Internal server error' };
  }
}

/**
 * PUT /api/alerts/[id]
 * Update alert status (acknowledge, resolve, snooze)
 */
export async function PUT(params: unknown, body: unknown): Promise<ApiResponse<Alert>> {
  try {
    // Validate ID
    const parseIdResult = idParamSchema.safeParse(params);
    if (!parseIdResult.success) {
      return { error: 'Invalid alert ID' };
    }

    const { id } = parseIdResult.data;

    // Validate body
    const parseBodyResult = updateAlertSchema.safeParse(body);
    if (!parseBodyResult.success) {
      const errorMessages = parseBodyResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return { error: `Validation error: ${errorMessages}` };
    }

    const input: UpdateAlertInput = parseBodyResult.data;

    // Fetch current alert
    const { data: currentAlert, error: fetchError } = await supabase
      .from('alerts')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !currentAlert) {
      return { error: 'Alert not found' };
    }

    // Validate resolution_notes for resolve status
    if (input.status === 'resolved' && !input.resolution_notes) {
      return { error: 'Resolution notes are required when resolving an alert' };
    }

    // Build update object
    const timestamp = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      status: input.status,
    };

    // Set appropriate timestamps and user references based on status
    if (input.status === 'acknowledged') {
      updateData.acknowledged_at = timestamp;
      if (input.user_id) {
        updateData.acknowledged_by = input.user_id;
      }
    } else if (input.status === 'resolved') {
      updateData.resolved_at = timestamp;
      updateData.resolution_notes = input.resolution_notes;
      if (input.user_id) {
        updateData.resolved_by = input.user_id;
      }
    }

    // Update alert
    const { data: updatedAlert, error: updateError } = await supabase
      .from('alerts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updatedAlert) {
      console.error('Failed to update alert:', updateError);
      return { error: 'Failed to update alert' };
    }

    return { data: updatedAlert as Alert };
  } catch (err) {
    console.error('Unexpected error in PUT /api/alerts/[id]:', err);
    return { error: 'Internal server error' };
  }
}
