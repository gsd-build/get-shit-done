/**
 * DQ Rule Detail API Routes
 *
 * GET /api/rules/[id] - Get rule by ID
 * PUT /api/rules/[id] - Update rule
 * DELETE /api/rules/[id] - Delete (deprecate) rule
 * POST /api/rules/[id]/approve - Approve pending rule
 * POST /api/rules/[id]/reject - Reject pending rule
 */

import { z } from 'zod';
import { supabase } from '../../../lib/supabase';

// Response types
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface DQRule {
  id: string;
  dataset_id: string;
  column_name: string | null;
  rule_type: string;
  dqdl_expression: string;
  description: string | null;
  generated_by: string | null;
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

// Validation schemas
const idParamSchema = z.object({
  id: z.string().uuid('Invalid rule ID'),
});

const updateRuleSchema = z.object({
  column_name: z.string().optional().nullable(),
  dqdl_expression: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  severity: z.enum(['critical', 'warning', 'info']).optional(),
  status: z.enum(['active', 'disabled']).optional(), // Limited status changes
});

const approveRejectSchema = z.object({
  reviewer_id: z.string().uuid().optional(),
  comments: z.string().optional(),
});

type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
type ApproveRejectInput = z.infer<typeof approveRejectSchema>;

/**
 * GET /api/rules/[id]
 * Get rule by ID
 */
export async function GET(params: unknown): Promise<ApiResponse<DQRule>> {
  try {
    // Validate ID
    const parseResult = idParamSchema.safeParse(params);
    if (!parseResult.success) {
      return { error: 'Invalid rule ID' };
    }

    const { id } = parseResult.data;

    // Fetch rule
    const { data: rule, error } = await supabase
      .from('dq_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !rule) {
      if (error?.code === 'PGRST116') {
        return { error: 'Rule not found' };
      }
      console.error('Failed to fetch rule:', error);
      return { error: 'Failed to fetch rule' };
    }

    return { data: rule as DQRule };
  } catch (err) {
    console.error('Unexpected error in GET /api/rules/[id]:', err);
    return { error: 'Internal server error' };
  }
}

/**
 * PUT /api/rules/[id]
 * Update rule (only if status is pending or active)
 */
export async function PUT(params: unknown, body: unknown): Promise<ApiResponse<DQRule>> {
  try {
    // Validate ID
    const parseIdResult = idParamSchema.safeParse(params);
    if (!parseIdResult.success) {
      return { error: 'Invalid rule ID' };
    }

    const { id } = parseIdResult.data;

    // Validate body
    const parseBodyResult = updateRuleSchema.safeParse(body);
    if (!parseBodyResult.success) {
      const errorMessages = parseBodyResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return { error: `Validation error: ${errorMessages}` };
    }

    const input: UpdateRuleInput = parseBodyResult.data;

    // Fetch current rule
    const { data: currentRule, error: fetchError } = await supabase
      .from('dq_rules')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !currentRule) {
      return { error: 'Rule not found' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ruleData = currentRule as any;

    // Only allow updates to pending or active rules
    if (!['pending', 'active', 'approved'].includes(ruleData.status)) {
      return { error: 'Can only update pending, approved, or active rules' };
    }

    // Build update object (only include provided fields)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};
    if (input.column_name !== undefined) updateData.column_name = input.column_name;
    if (input.dqdl_expression !== undefined) updateData.dqdl_expression = input.dqdl_expression;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.severity !== undefined) updateData.severity = input.severity;
    if (input.status !== undefined) updateData.status = input.status;

    // Update rule
    const { data: updatedRule, error: updateError } = await supabase
      .from('dq_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updatedRule) {
      console.error('Failed to update rule:', updateError);
      return { error: 'Failed to update rule' };
    }

    return { data: updatedRule as DQRule };
  } catch (err) {
    console.error('Unexpected error in PUT /api/rules/[id]:', err);
    return { error: 'Internal server error' };
  }
}

/**
 * DELETE /api/rules/[id]
 * Delete rule (soft delete: set status to deprecated)
 */
export async function DELETE(params: unknown): Promise<ApiResponse<{ deprecated: boolean }>> {
  try {
    // Validate ID
    const parseResult = idParamSchema.safeParse(params);
    if (!parseResult.success) {
      return { error: 'Invalid rule ID' };
    }

    const { id } = parseResult.data;

    // Soft delete by setting status to deprecated
    const { error } = await supabase
      .from('dq_rules')
      .update({ status: 'deprecated' })
      .eq('id', id);

    if (error) {
      console.error('Failed to deprecate rule:', error);
      return { error: 'Failed to delete rule' };
    }

    return { data: { deprecated: true } };
  } catch (err) {
    console.error('Unexpected error in DELETE /api/rules/[id]:', err);
    return { error: 'Internal server error' };
  }
}

/**
 * POST /api/rules/[id]/approve
 * Approve a pending rule
 */
export async function approve(params: unknown, body: unknown): Promise<ApiResponse<DQRule>> {
  try {
    // Validate ID
    const parseIdResult = idParamSchema.safeParse(params);
    if (!parseIdResult.success) {
      return { error: 'Invalid rule ID' };
    }

    const { id } = parseIdResult.data;

    // Validate body
    const parseBodyResult = approveRejectSchema.safeParse(body);
    const input: ApproveRejectInput = parseBodyResult.success ? parseBodyResult.data : {};

    // Fetch current rule
    const { data: currentRule, error: fetchError } = await supabase
      .from('dq_rules')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !currentRule) {
      return { error: 'Rule not found' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ruleData = currentRule as any;

    if (ruleData.status !== 'pending') {
      return { error: 'Can only approve pending rules' };
    }

    // Approve rule
    const { data: approvedRule, error: approveError } = await supabase
      .from('dq_rules')
      .update({
        status: 'approved',
        approved_by: input.reviewer_id || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (approveError || !approvedRule) {
      console.error('Failed to approve rule:', approveError);
      return { error: 'Failed to approve rule' };
    }

    // Update approval request if exists
    await supabase
      .from('rule_approval_requests')
      .update({
        status: 'approved',
        reviewed_by: input.reviewer_id || null,
        reviewed_at: new Date().toISOString(),
        comments: input.comments || null,
      })
      .eq('rule_id', id)
      .eq('status', 'pending');

    return { data: approvedRule as DQRule };
  } catch (err) {
    console.error('Unexpected error in POST /api/rules/[id]/approve:', err);
    return { error: 'Internal server error' };
  }
}

/**
 * POST /api/rules/[id]/reject
 * Reject a pending rule
 */
export async function reject(params: unknown, body: unknown): Promise<ApiResponse<DQRule>> {
  try {
    // Validate ID
    const parseIdResult = idParamSchema.safeParse(params);
    if (!parseIdResult.success) {
      return { error: 'Invalid rule ID' };
    }

    const { id } = parseIdResult.data;

    // Validate body
    const parseBodyResult = approveRejectSchema.safeParse(body);
    const input: ApproveRejectInput = parseBodyResult.success ? parseBodyResult.data : {};

    // Fetch current rule
    const { data: currentRule, error: fetchError } = await supabase
      .from('dq_rules')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !currentRule) {
      return { error: 'Rule not found' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ruleData = currentRule as any;

    if (ruleData.status !== 'pending') {
      return { error: 'Can only reject pending rules' };
    }

    // Reject rule (set to disabled)
    const { data: rejectedRule, error: rejectError } = await supabase
      .from('dq_rules')
      .update({
        status: 'disabled',
      })
      .eq('id', id)
      .select()
      .single();

    if (rejectError || !rejectedRule) {
      console.error('Failed to reject rule:', rejectError);
      return { error: 'Failed to reject rule' };
    }

    // Update approval request if exists
    await supabase
      .from('rule_approval_requests')
      .update({
        status: 'rejected',
        reviewed_by: input.reviewer_id || null,
        reviewed_at: new Date().toISOString(),
        comments: input.comments || null,
      })
      .eq('rule_id', id)
      .eq('status', 'pending');

    return { data: rejectedRule as DQRule };
  } catch (err) {
    console.error('Unexpected error in POST /api/rules/[id]/reject:', err);
    return { error: 'Internal server error' };
  }
}
