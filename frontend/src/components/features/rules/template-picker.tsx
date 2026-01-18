'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useSources } from '@/hooks/use-sources';
import { useCreateRule } from '@/hooks/use-rules';
import { cn } from '@/lib/utils';

// Industry-standard rule templates
const RULE_TEMPLATES = [
  // Format category
  {
    id: 'email_validity',
    category: 'format',
    name: 'Email Validity',
    description: 'Validates email address format',
    dqdl_template: 'ColumnValues "{column}" matches "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}$"',
    parameters: [],
    rule_type: 'pattern' as const,
    severity: 'warning' as const,
  },
  {
    id: 'phone_format',
    category: 'format',
    name: 'Phone Number Format',
    description: 'Validates US phone number format',
    dqdl_template: 'ColumnValues "{column}" matches "^\\\\+?1?[-.]?\\\\(?\\\\d{3}\\\\)?[-.]?\\\\d{3}[-.]?\\\\d{4}$"',
    parameters: [],
    rule_type: 'pattern' as const,
    severity: 'warning' as const,
  },
  {
    id: 'uuid_format',
    category: 'format',
    name: 'UUID Format',
    description: 'Validates UUID v4 format',
    dqdl_template: 'ColumnValues "{column}" matches "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"',
    parameters: [],
    rule_type: 'pattern' as const,
    severity: 'critical' as const,
  },
  {
    id: 'date_iso8601',
    category: 'format',
    name: 'ISO 8601 Date',
    description: 'Validates ISO 8601 date format (YYYY-MM-DD)',
    dqdl_template: 'ColumnValues "{column}" matches "^\\\\d{4}-\\\\d{2}-\\\\d{2}$"',
    parameters: [],
    rule_type: 'pattern' as const,
    severity: 'warning' as const,
  },
  // Range category
  {
    id: 'numeric_range',
    category: 'range',
    name: 'Numeric Range',
    description: 'Validates values are within a specified range',
    dqdl_template: 'ColumnValues "{column}" between {min} and {max}',
    parameters: [
      { name: 'min', label: 'Minimum Value', type: 'number' },
      { name: 'max', label: 'Maximum Value', type: 'number' },
    ],
    rule_type: 'range' as const,
    severity: 'warning' as const,
  },
  {
    id: 'positive_values',
    category: 'range',
    name: 'Positive Values Only',
    description: 'Ensures all values are positive',
    dqdl_template: 'ColumnValues "{column}" > 0',
    parameters: [],
    rule_type: 'range' as const,
    severity: 'warning' as const,
  },
  {
    id: 'percentage_range',
    category: 'range',
    name: 'Percentage (0-100)',
    description: 'Validates percentage values are between 0 and 100',
    dqdl_template: 'ColumnValues "{column}" between 0 and 100',
    parameters: [],
    rule_type: 'range' as const,
    severity: 'warning' as const,
  },
  // Consistency category
  {
    id: 'non_null',
    category: 'consistency',
    name: 'Non-Null',
    description: 'Ensures column has no null values',
    dqdl_template: 'IsComplete "{column}"',
    parameters: [],
    rule_type: 'completeness' as const,
    severity: 'critical' as const,
  },
  {
    id: 'unique_values',
    category: 'consistency',
    name: 'Unique Values',
    description: 'Ensures all values in column are unique',
    dqdl_template: 'IsUnique "{column}"',
    parameters: [],
    rule_type: 'uniqueness' as const,
    severity: 'critical' as const,
  },
  {
    id: 'enum_values',
    category: 'consistency',
    name: 'Enum/Set Membership',
    description: 'Validates values are from a specific set',
    dqdl_template: 'ColumnValues "{column}" in [{values}]',
    parameters: [
      { name: 'values', label: 'Allowed Values (comma-separated)', type: 'text' },
    ],
    rule_type: 'pattern' as const,
    severity: 'warning' as const,
  },
  // Compliance category
  {
    id: 'ssn_format',
    category: 'compliance',
    name: 'SSN Format',
    description: 'Validates US Social Security Number format',
    dqdl_template: 'ColumnValues "{column}" matches "^\\\\d{3}-\\\\d{2}-\\\\d{4}$"',
    parameters: [],
    rule_type: 'pattern' as const,
    severity: 'critical' as const,
  },
  {
    id: 'credit_card_format',
    category: 'compliance',
    name: 'Credit Card Format',
    description: 'Validates credit card number format (16 digits)',
    dqdl_template: 'ColumnValues "{column}" matches "^\\\\d{4}[- ]?\\\\d{4}[- ]?\\\\d{4}[- ]?\\\\d{4}$"',
    parameters: [],
    rule_type: 'pattern' as const,
    severity: 'critical' as const,
  },
  {
    id: 'data_freshness',
    category: 'compliance',
    name: 'Data Freshness',
    description: 'Ensures data is not older than specified hours',
    dqdl_template: 'DataFreshness "{column}" <= {hours} hours',
    parameters: [
      { name: 'hours', label: 'Maximum Age (hours)', type: 'number' },
    ],
    rule_type: 'freshness' as const,
    severity: 'warning' as const,
  },
];

const CATEGORIES = [
  { id: 'format', label: 'Format Validation' },
  { id: 'range', label: 'Range Checks' },
  { id: 'consistency', label: 'Data Consistency' },
  { id: 'compliance', label: 'Compliance & Freshness' },
];

interface TemplatePickerProps {
  className?: string;
}

export function TemplatePicker({ className }: TemplatePickerProps) {
  const router = useRouter();
  const { data: sources, isLoading: sourcesLoading } = useSources();
  const createRule = useCreateRule();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof RULE_TEMPLATES[0] | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [columnName, setColumnName] = useState('');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const filteredTemplates = selectedCategory
    ? RULE_TEMPLATES.filter((t) => t.category === selectedCategory)
    : RULE_TEMPLATES;

  const generateDqdl = () => {
    if (!selectedTemplate || !columnName) return '';

    let dqdl = selectedTemplate.dqdl_template.replace('{column}', columnName);

    for (const param of selectedTemplate.parameters) {
      const value = paramValues[param.name] || '';
      dqdl = dqdl.replace(`{${param.name}}`, value);
    }

    return dqdl;
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate || !selectedSourceId || !columnName) return;

    const dqdl = generateDqdl();
    if (!dqdl) return;

    try {
      const rule = await createRule.mutateAsync({
        dataset_id: selectedSourceId,
        column_name: columnName,
        rule_type: selectedTemplate.rule_type,
        dqdl_expression: dqdl,
        description: selectedTemplate.description,
        generated_by: 'template',
        template_name: selectedTemplate.name,
        severity: selectedTemplate.severity,
      });
      router.push(`/rules/${rule.id}`);
    } catch (err) {
      console.error('Failed to create rule:', err);
    }
  };

  const handleTemplateSelect = (template: typeof RULE_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setParamValues({});
  };

  const sourceOptions = sources?.map((s) => ({ value: s.id, label: s.name })) || [];
  const previewDqdl = selectedTemplate && columnName ? generateDqdl() : '';

  return (
    <div className={cn('space-y-6', className)}>
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          All Templates
        </Button>
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <Card
            key={template.id}
            className={cn(
              'cursor-pointer transition-colors hover:border-primary',
              selectedTemplate?.id === template.id && 'border-primary bg-primary/5'
            )}
            onClick={() => handleTemplateSelect(template)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{template.name}</CardTitle>
              <CardDescription className="text-xs">
                {template.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                {template.dqdl_template}
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Configuration Panel */}
      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle>Configure Template: {selectedTemplate.name}</CardTitle>
            <CardDescription>
              Fill in the required parameters to generate the DQDL rule.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Data Source"
                options={sourceOptions}
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                placeholder="Select a data source..."
                disabled={sourcesLoading}
              />

              <Input
                label="Column Name"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                placeholder="Enter column name"
              />
            </div>

            {selectedTemplate.parameters.map((param) => (
              <Input
                key={param.name}
                label={param.label}
                type={param.type === 'number' ? 'number' : 'text'}
                value={paramValues[param.name] || ''}
                onChange={(e) =>
                  setParamValues((prev) => ({ ...prev, [param.name]: e.target.value }))
                }
                placeholder={`Enter ${param.label.toLowerCase()}`}
              />
            ))}

            {/* Preview */}
            {previewDqdl && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Generated DQDL Preview</label>
                <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-sm">
                  {previewDqdl}
                </pre>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleApplyTemplate}
                disabled={!selectedSourceId || !columnName || createRule.isPending}
              >
                {createRule.isPending ? 'Creating...' : 'Apply Template'}
              </Button>
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                Cancel
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
