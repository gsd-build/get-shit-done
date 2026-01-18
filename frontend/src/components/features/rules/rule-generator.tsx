'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useSources } from '@/hooks/use-sources';
import { useGenerateRule, useCreateRule, RuleGenerationResponse } from '@/hooks/use-rules';
import { cn } from '@/lib/utils';

interface RuleGeneratorProps {
  className?: string;
}

export function RuleGenerator({ className }: RuleGeneratorProps) {
  const router = useRouter();
  const { data: sources, isLoading: sourcesLoading } = useSources();
  const generateRule = useGenerateRule();
  const createRule = useCreateRule();

  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [columnName, setColumnName] = useState('');
  const [description, setDescription] = useState('');
  const [generatedResult, setGeneratedResult] = useState<RuleGenerationResponse | null>(null);

  // Get datasets for selected source
  const selectedSource = sources?.find((s) => s.id === selectedSourceId);

  const handleGenerate = async () => {
    if (!selectedDatasetId || !columnName || !description) return;

    try {
      const result = await generateRule.mutateAsync({
        dataset_id: selectedDatasetId,
        column_name: columnName,
        description,
      });
      setGeneratedResult(result);
    } catch (err) {
      console.error('Failed to generate rule:', err);
    }
  };

  const handleAcceptAndCreate = async () => {
    if (!generatedResult || !selectedDatasetId) return;

    try {
      const rule = await createRule.mutateAsync({
        dataset_id: selectedDatasetId,
        column_name: columnName,
        rule_type: generatedResult.suggested_rule_type as 'completeness' | 'uniqueness' | 'range' | 'pattern' | 'freshness' | 'referential' | 'custom',
        dqdl_expression: generatedResult.rule,
        description: description,
        generated_by: 'ai_recommender',
        reasoning: generatedResult.reasoning,
        severity: generatedResult.severity,
      });
      router.push(`/rules/${rule.id}`);
    } catch (err) {
      console.error('Failed to create rule:', err);
    }
  };

  const handleRegenerate = () => {
    handleGenerate();
  };

  const handleStartOver = () => {
    setSelectedSourceId('');
    setSelectedDatasetId('');
    setColumnName('');
    setDescription('');
    setGeneratedResult(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const sourceOptions = sources?.map((s) => ({ value: s.id, label: s.name })) || [];
  // For now, use source as dataset (1:1 relationship in phase 01)
  const datasetOptions = selectedSource ? [{ value: selectedSource.id, label: `${selectedSource.name}` }] : [];

  return (
    <div className={cn('space-y-6', className)}>
      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle>Describe Your Data Quality Rule</CardTitle>
          <CardDescription>
            Tell us in plain English what you want to validate, and AI will generate the DQDL rule for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Data Source"
              options={sourceOptions}
              value={selectedSourceId}
              onChange={(e) => {
                setSelectedSourceId(e.target.value);
                setSelectedDatasetId(e.target.value); // Auto-select dataset
              }}
              placeholder="Select a data source..."
              disabled={sourcesLoading}
            />

            <Select
              label="Dataset"
              options={datasetOptions}
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              placeholder="Select a dataset..."
              disabled={!selectedSourceId}
            />
          </div>

          <Input
            label="Column Name"
            value={columnName}
            onChange={(e) => setColumnName(e.target.value)}
            placeholder="e.g., email, customer_id, order_date"
          />

          <div className="space-y-2">
            <label className="text-sm font-medium">Rule Description</label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={`Examples:
- "Ensure email addresses are valid and not null"
- "Validate that order_date is within the last 30 days"
- "Check that customer_id is unique across all records"
- "Verify price is between 0 and 10000"`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={!selectedDatasetId || !columnName || !description || generateRule.isPending}
            >
              {generateRule.isPending ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  AI is analyzing...
                </>
              ) : (
                'Generate Rule'
              )}
            </Button>
            {generatedResult && (
              <Button variant="outline" onClick={handleStartOver}>
                Start Over
              </Button>
            )}
          </div>

          {generateRule.isError && (
            <p className="text-sm text-destructive">
              Failed to generate rule: {generateRule.error.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Generated Result */}
      {generatedResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Generated Rule</span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  generatedResult.severity === 'critical' && 'bg-red-100 text-red-800',
                  generatedResult.severity === 'warning' && 'bg-yellow-100 text-yellow-800',
                  generatedResult.severity === 'info' && 'bg-blue-100 text-blue-800'
                )}
              >
                {generatedResult.severity}
              </span>
            </CardTitle>
            <CardDescription>
              Suggested type: {generatedResult.suggested_rule_type}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* DQDL Expression */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">DQDL Expression</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(generatedResult.rule)}
                >
                  Copy
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-sm">
                {generatedResult.rule}
              </pre>
            </div>

            {/* Reasoning */}
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                Why this rule? (click to expand)
              </summary>
              <div className="mt-2 rounded-md bg-muted/50 p-4 text-sm">
                {generatedResult.reasoning}
              </div>
            </details>

            {/* False Positive Warnings */}
            {generatedResult.false_positive_scenarios.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-yellow-700">
                  Potential False Positives
                </label>
                <ul className="list-inside list-disc space-y-1 rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
                  {generatedResult.false_positive_scenarios.map((scenario, i) => (
                    <li key={i}>{scenario}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleAcceptAndCreate} disabled={createRule.isPending}>
                {createRule.isPending ? 'Creating...' : 'Accept and Create'}
              </Button>
              <Button
                variant="outline"
                onClick={handleRegenerate}
                disabled={generateRule.isPending}
              >
                Regenerate
              </Button>
            </div>

            {createRule.isError && (
              <p className="text-sm text-destructive">
                Failed to create rule: {createRule.error.message}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
