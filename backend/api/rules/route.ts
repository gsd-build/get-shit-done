/**
 * DQ Rules API Routes
 *
 * GET /api/rules - List DQ rules with filters
 * POST /api/rules - Create a new DQ rule
 */

import { z } from 'zod';
import { supabase } from '../../lib/supabase';

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
const listRulesSchema = z.object({
  dataset_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'active', 'disabled', 'deprecated']).optional(),
  rule_type: z.enum(['completeness', 'uniqueness', 'range', 'pattern', 'freshness', 'referential', 'custom']).optional(),
  severity: z.enum(['critical', 'warning', 'info']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createRuleSchema = z.object({
  dataset_id: z.string().uuid('Invalid dataset ID'),
  column_name: z.string().optional().nullable(),
  rule_type: z.enum(['completeness', 'uniqueness', 'range', 'pattern', 'freshness', 'referential', 'custom']),
  dqdl_expression: z.string().min(1, 'DQDL expression is required'),
  description: z.string().optional().nullable(),
  generated_by: z.enum(['ai_recommender', 'glue_ml', 'user', 'template']).default('user'),
  reasoning: z.string().optional().nullable(),
  template_name: z.string().optional().nullable(),
  severity: z.enum(['critical', 'warning', 'info']).default('warning'),
  skip_approval: z.boolean().default(false), // Allow user-created rules to skip approval
});

type ListRulesInput = z.infer<typeof listRulesSchema>;
type CreateRuleInput = z.infer<typeof createRuleSchema>;

/**
 * Basic DQDL syntax validation
 */
function validateDqdlSyntax(expression: string): boolean {
  // Check for common DQDL patterns
  const patterns = [
    /^IsComplete\s+"[^"]+"/i,
    /^IsUnique\s+"[^"]+"/i,
    /^ColumnValues\s+"[^"]+"\s*(>|<|>=|<=|=|!=|between|in|matches)/i,
    /^DataFreshness\s+"[^"]+"/i,
    /^ReferentialIntegrity\s+"[^"]+"/i,
    /^RowCount\s*(>|<|>=|<=|=)/i,
  ];

  return patterns.some(pattern => pattern.test(expression.trim()));
}

/**
 * GET /api/rules
 * List DQ rules with optional filters
 */
export async function GET(query: unknown): Promise<ApiResponse<DQRule[]>> {
  try {
    // Validate query params
    const parseResult = listRulesSchema.safeParse(query);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return { error: `Validation error: ${errorMessages}` };
    }

    const input: ListRulesInput = parseResult.data;

    // Build query
    let queryBuilder = supabase
      .from('dq_rules')
      .select('*')
      .order('created_at', { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    // Apply filters
    if (input.dataset_id) {
      queryBuilder = queryBuilder.eq('dataset_id', input.dataset_id);
    }
    if (input.status) {
      queryBuilder = queryBuilder.eq('status', input.status);
    }
    if (input.rule_type) {
      queryBuilder = queryBuilder.eq('rule_type', input.rule_type);
    }
    if (input.severity) {
      queryBuilder = queryBuilder.eq('severity', input.severity);
    }

    const { data: rules, error } = await queryBuilder;

    if (error) {
      console.error('Failed to fetch rules:', error);
      return { error: 'Failed to fetch rules' };
    }

    return { data: (rules || []) as DQRule[] };
  } catch (err) {
    console.error('Unexpected error in GET /api/rules:', err);
    return { error: 'Internal server error' };
  }
}

/**
 * POST /api/rules
 * Create a new DQ rule
 */
export async function POST(body: unknown): Promise<ApiResponse<DQRule>> {
  try {
    // Validate input
    const parseResult = createRuleSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return { error: `Validation error: ${errorMessages}` };
    }

    const input: CreateRuleInput = parseResult.data;

    // Verify dataset exists
    const { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .select('id')
      .eq('id', input.dataset_id)
      .single();

    if (datasetError || !dataset) {
      return { error: 'Dataset not found' };
    }

    // Basic DQDL syntax validation
    if (!validateDqdlSyntax(input.dqdl_expression)) {
      return { error: 'Invalid DQDL expression syntax' };
    }

    // Determine initial status
    // AI-generated rules require approval, user-created can optionally skip
    let initialStatus: 'pending' | 'active' = 'pending';
    if (input.generated_by === 'user' && input.skip_approval) {
      initialStatus = 'active';
    }

    // Create rule record
    const { data: rule, error: createError } = await supabase
      .from('dq_rules')
      .insert({
        dataset_id: input.dataset_id,
        column_name: input.column_name,
        rule_type: input.rule_type,
        dqdl_expression: input.dqdl_expression,
        description: input.description,
        generated_by: input.generated_by,
        reasoning: input.reasoning,
        template_name: input.template_name,
        severity: input.severity,
        status: initialStatus,
      })
      .select()
      .single();

    if (createError || !rule) {
      console.error('Failed to create rule:', createError);
      return { error: 'Failed to create rule' };
    }

    return { data: rule as DQRule };
  } catch (err) {
    console.error('Unexpected error in POST /api/rules:', err);
    return { error: 'Internal server error' };
  }
}
