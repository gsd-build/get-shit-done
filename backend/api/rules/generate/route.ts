/**
 * DQ Rule Generation API Routes
 *
 * POST /api/rules/generate - Generate DQDL rule using DQ Recommender agent
 */

import { z } from 'zod';
import { supabase } from '../../../lib/supabase';

// Response types
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface GeneratedRule {
  rule: string;
  reasoning: string;
  false_positive_scenarios: string[];
  severity: 'critical' | 'warning' | 'info';
  suggested_rule_type: string;
}

// Validation schemas
const generateRuleSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters'),
  column_name: z.string().min(1, 'Column name is required'),
  dataset_id: z.string().uuid('Invalid dataset ID'),
  profile_summary: z.record(z.unknown()).optional(),
});

type GenerateRuleInput = z.infer<typeof generateRuleSchema>;

/**
 * Load profile summary from database if not provided
 */
async function loadProfileSummary(datasetId: string, columnName: string): Promise<Record<string, unknown> | null> {
  try {
    // Get latest profile run for dataset
    const { data: profileRun } = await supabase
      .from('profile_runs')
      .select('id')
      .eq('dataset_id', datasetId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (!profileRun) {
      return null;
    }

    // Get profile result
    const { data: profileResult } = await supabase
      .from('profile_results')
      .select('id')
      .eq('run_id', profileRun.id)
      .single();

    if (!profileResult) {
      return null;
    }

    // Get column profile
    const { data: columnProfile } = await supabase
      .from('column_profiles')
      .select('*')
      .eq('result_id', profileResult.id)
      .eq('column_name', columnName)
      .single();

    if (!columnProfile) {
      return null;
    }

    return {
      column_name: columnProfile.column_name,
      data_type: columnProfile.data_type,
      null_count: columnProfile.null_count,
      null_pct: columnProfile.null_pct,
      distinct_count: columnProfile.distinct_count,
      distinct_pct: columnProfile.distinct_pct,
      min_value: columnProfile.min_value,
      max_value: columnProfile.max_value,
      mean_value: columnProfile.mean_value,
      std_value: columnProfile.std_value,
    };
  } catch (err) {
    console.error('Error loading profile summary:', err);
    return null;
  }
}

/**
 * Invoke DQ Recommender agent to generate DQDL rule
 *
 * In production, this would call the actual Strands agent.
 * For now, we implement a direct Bedrock Converse API call
 * following the same pattern as the agent's rule_generator tool.
 */
async function invokeRuleGeneration(
  description: string,
  columnName: string,
  profileSummary: Record<string, unknown> | null
): Promise<GeneratedRule> {
  // Import AWS SDK for Bedrock
  const { BedrockRuntimeClient, ConverseCommand } = await import('@aws-sdk/client-bedrock-runtime');

  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  const systemPrompt = `You are a Data Quality expert. Generate DQDL rules from natural language descriptions.

DQDL Syntax Reference:
- IsComplete "column" - checks for non-null
- IsUnique "column" - checks for unique values
- ColumnValues "column" > X - numeric comparison
- ColumnValues "column" in ["a", "b"] - set membership
- ColumnValues "column" matches "regex" - pattern matching
- ColumnValues "column" between X and Y - range check
- DataFreshness "date_column" <= 24 hours - freshness check
- ReferentialIntegrity "col1" "ref_table.col2" - FK check
- RowCount > X - row count threshold

Always respond with valid JSON in this exact format:
{
  "rule": "DQDL rule syntax",
  "reasoning": "Why this rule is appropriate given the column profile",
  "false_positive_scenarios": ["scenario1", "scenario2"],
  "severity": "critical|warning|info",
  "suggested_rule_type": "completeness|uniqueness|range|pattern|freshness|referential|custom"
}`;

  const userMessage = `Generate a DQDL rule for this requirement:

Description: ${description}
Column: ${columnName}
Profile Data: ${profileSummary ? JSON.stringify(profileSummary, null, 2) : 'Not available'}

Consider the data type and statistics from the profile when crafting the rule.`;

  try {
    const command = new ConverseCommand({
      modelId: 'anthropic.claude-sonnet-4-20250514',
      messages: [
        {
          role: 'user',
          content: [{ text: userMessage }],
        },
      ],
      system: [{ text: systemPrompt }],
      inferenceConfig: {
        maxTokens: 1024,
        temperature: 0.2,
      },
    });

    const response = await client.send(command);

    // Extract response text
    const outputContent = response.output?.message?.content;
    if (!outputContent || outputContent.length === 0) {
      throw new Error('Empty response from Bedrock');
    }

    const responseText = outputContent[0].text;
    if (!responseText) {
      throw new Error('No text in Bedrock response');
    }

    // Parse JSON response
    // Handle potential markdown code blocks
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const result = JSON.parse(jsonText) as GeneratedRule;

    // Validate required fields
    if (!result.rule || !result.reasoning) {
      throw new Error('Invalid response structure from AI');
    }

    return {
      rule: result.rule,
      reasoning: result.reasoning,
      false_positive_scenarios: result.false_positive_scenarios || [],
      severity: result.severity || 'warning',
      suggested_rule_type: result.suggested_rule_type || 'custom',
    };
  } catch (err) {
    console.error('Error invoking Bedrock:', err);
    throw new Error(`Failed to generate rule: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * POST /api/rules/generate
 * Generate DQDL rule using DQ Recommender agent
 */
export async function POST(body: unknown): Promise<ApiResponse<GeneratedRule>> {
  try {
    // Validate input
    const parseResult = generateRuleSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return { error: `Validation error: ${errorMessages}` };
    }

    const input: GenerateRuleInput = parseResult.data;

    // Verify dataset exists
    const { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .select('id, database_name, table_name')
      .eq('id', input.dataset_id)
      .single();

    if (datasetError || !dataset) {
      return { error: 'Dataset not found' };
    }

    // Load profile summary if not provided
    let profileSummary = input.profile_summary || null;
    if (!profileSummary) {
      profileSummary = await loadProfileSummary(input.dataset_id, input.column_name);
    }

    // Invoke DQ Recommender agent
    const generatedRule = await invokeRuleGeneration(
      input.description,
      input.column_name,
      profileSummary
    );

    return { data: generatedRule };
  } catch (err) {
    console.error('Unexpected error in POST /api/rules/generate:', err);
    return { error: err instanceof Error ? err.message : 'Internal server error' };
  }
}
