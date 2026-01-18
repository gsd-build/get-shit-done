'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useSources } from '@/hooks/use-sources';
import { useCreateRule, useUpdateRule, DQRule } from '@/hooks/use-rules';
import { cn } from '@/lib/utils';

const RULE_TYPE_OPTIONS = [
  { value: 'completeness', label: 'Completeness' },
  { value: 'uniqueness', label: 'Uniqueness' },
  { value: 'range', label: 'Range' },
  { value: 'pattern', label: 'Pattern' },
  { value: 'freshness', label: 'Freshness' },
  { value: 'referential', label: 'Referential Integrity' },
  { value: 'custom', label: 'Custom' },
];

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

interface RuleFormProps {
  rule?: DQRule;
  className?: string;
}

export function RuleForm({ rule, className }: RuleFormProps) {
  const router = useRouter();
  const { data: sources, isLoading: sourcesLoading } = useSources();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();

  const isEditMode = !!rule;
  const isReadOnly = rule && ['active', 'approved'].includes(rule.status);

  const [formData, setFormData] = useState({
    dataset_id: rule?.dataset_id || '',
    column_name: rule?.column_name || '',
    rule_type: rule?.rule_type || 'completeness',
    dqdl_expression: rule?.dqdl_expression || '',
    description: rule?.description || '',
    severity: rule?.severity || 'warning',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when rule changes
  useEffect(() => {
    if (rule) {
      setFormData({
        dataset_id: rule.dataset_id,
        column_name: rule.column_name || '',
        rule_type: rule.rule_type,
        dqdl_expression: rule.dqdl_expression,
        description: rule.description || '',
        severity: rule.severity,
      });
    }
  }, [rule]);

  const validateDqdlSyntax = (expression: string): boolean => {
    // Basic DQDL syntax validation
    const patterns = [
      /^IsComplete\s+"[^"]+"/i,
      /^IsUnique\s+"[^"]+"/i,
      /^ColumnValues\s+"[^"]+"\s*(>|<|>=|<=|=|!=|between|in|matches)/i,
      /^DataFreshness\s+"[^"]+"/i,
      /^ReferentialIntegrity\s+"[^"]+"/i,
      /^RowCount\s*(>|<|>=|<=|=)/i,
    ];

    return patterns.some((pattern) => pattern.test(expression.trim()));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.dataset_id) {
      newErrors.dataset_id = 'Data source is required';
    }

    if (!formData.dqdl_expression.trim()) {
      newErrors.dqdl_expression = 'DQDL expression is required';
    } else if (!validateDqdlSyntax(formData.dqdl_expression)) {
      newErrors.dqdl_expression = 'Invalid DQDL syntax. Check the expression format.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      if (isEditMode && rule) {
        await updateRule.mutateAsync({
          id: rule.id,
          column_name: formData.column_name || null,
          dqdl_expression: formData.dqdl_expression,
          description: formData.description || null,
          severity: formData.severity as 'critical' | 'warning' | 'info',
        });
        router.push(`/rules/${rule.id}`);
      } else {
        const newRule = await createRule.mutateAsync({
          dataset_id: formData.dataset_id,
          column_name: formData.column_name || null,
          rule_type: formData.rule_type as DQRule['rule_type'],
          dqdl_expression: formData.dqdl_expression,
          description: formData.description || null,
          generated_by: 'user',
          severity: formData.severity as 'critical' | 'warning' | 'info',
          skip_approval: false, // User rules still need approval by default
        });
        router.push(`/rules/${newRule.id}`);
      }
    } catch (err) {
      console.error('Failed to save rule:', err);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const sourceOptions = sources?.map((s) => ({ value: s.id, label: s.name })) || [];
  const isPending = createRule.isPending || updateRule.isPending;
  const error = createRule.error || updateRule.error;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{isEditMode ? 'Edit Rule' : 'Create Manual Rule'}</CardTitle>
        <CardDescription>
          {isEditMode
            ? 'Update the rule configuration'
            : 'Manually define a DQDL rule for data quality validation'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Data Source"
            options={sourceOptions}
            value={formData.dataset_id}
            onChange={(e) => updateField('dataset_id', e.target.value)}
            placeholder="Select a data source..."
            disabled={sourcesLoading || isEditMode}
            error={errors.dataset_id}
          />

          <Input
            label="Column Name (optional for table-level rules)"
            value={formData.column_name}
            onChange={(e) => updateField('column_name', e.target.value)}
            placeholder="e.g., email, customer_id"
            disabled={isReadOnly}
          />

          <Select
            label="Rule Type"
            options={RULE_TYPE_OPTIONS}
            value={formData.rule_type}
            onChange={(e) => updateField('rule_type', e.target.value)}
            disabled={isEditMode}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium">DQDL Expression</label>
            <textarea
              className={cn(
                'flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                errors.dqdl_expression && 'border-destructive'
              )}
              placeholder={`Examples:
IsComplete "email"
IsUnique "customer_id"
ColumnValues "price" between 0 and 1000
ColumnValues "status" in ["active", "pending", "closed"]
ColumnValues "email" matches "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
DataFreshness "updated_at" <= 24 hours`}
              value={formData.dqdl_expression}
              onChange={(e) => updateField('dqdl_expression', e.target.value)}
              disabled={isReadOnly}
            />
            {errors.dqdl_expression && (
              <p className="text-sm text-destructive">{errors.dqdl_expression}</p>
            )}
          </div>

          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="What does this rule check?"
            disabled={isReadOnly}
          />

          <Select
            label="Severity"
            options={SEVERITY_OPTIONS}
            value={formData.severity}
            onChange={(e) => updateField('severity', e.target.value)}
            disabled={isReadOnly}
          />

          {isReadOnly && (
            <p className="text-sm text-muted-foreground">
              This rule is currently {rule?.status}. Only pending rules can be edited.
            </p>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isPending || isReadOnly}>
              {isPending ? 'Saving...' : isEditMode ? 'Update Rule' : 'Create Rule'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/rules')}
            >
              Cancel
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive">
              Failed to save rule: {error.message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
