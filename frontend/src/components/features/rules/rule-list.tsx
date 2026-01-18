'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRules, useDeleteRule, DQRule, RuleFilters } from '@/hooks/use-rules';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'deprecated', label: 'Deprecated' },
];

const RULE_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'completeness', label: 'Completeness' },
  { value: 'uniqueness', label: 'Uniqueness' },
  { value: 'range', label: 'Range' },
  { value: 'pattern', label: 'Pattern' },
  { value: 'freshness', label: 'Freshness' },
  { value: 'referential', label: 'Referential' },
  { value: 'custom', label: 'Custom' },
];

const SEVERITY_OPTIONS = [
  { value: '', label: 'All Severity' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

interface RuleListProps {
  className?: string;
  showFilters?: boolean;
  initialFilters?: RuleFilters;
}

export function RuleList({ className, showFilters = true, initialFilters }: RuleListProps) {
  const router = useRouter();
  const deleteRule = useDeleteRule();

  const [filters, setFilters] = useState<RuleFilters>(initialFilters || {});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Build query filters
  const queryFilters: RuleFilters = {};
  if (filters.status) queryFilters.status = filters.status;
  if (filters.rule_type) queryFilters.rule_type = filters.rule_type;
  if (filters.severity) queryFilters.severity = filters.severity;

  const { data: rules, isLoading, error } = useRules(
    Object.keys(queryFilters).length > 0 ? queryFilters : undefined
  );

  const handleDelete = async (id: string) => {
    try {
      await deleteRule.mutateAsync(id);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const updateFilter = (key: keyof RuleFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const getStatusBadge = (status: DQRule['status']) => {
    const styles: Record<DQRule['status'], string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      disabled: 'bg-gray-100 text-gray-800',
      deprecated: 'bg-gray-100 text-gray-500 line-through',
    };

    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          styles[status]
        )}
      >
        {status}
      </span>
    );
  };

  const getSeverityBadge = (severity: DQRule['severity']) => {
    const styles: Record<DQRule['severity'], string> = {
      critical: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      info: 'bg-blue-100 text-blue-800',
    };

    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          styles[severity]
        )}
      >
        {severity}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center text-destructive">
          Failed to load rules: {error.message}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showFilters && (
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                value={filters.status || ''}
                onChange={(e) => updateFilter('status', e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Select
                label="Rule Type"
                options={RULE_TYPE_OPTIONS}
                value={filters.rule_type || ''}
                onChange={(e) => updateFilter('rule_type', e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Select
                label="Severity"
                options={SEVERITY_OPTIONS}
                value={filters.severity || ''}
                onChange={(e) => updateFilter('severity', e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className={showFilters ? 'pt-0' : ''}>
        {rules && rules.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Column</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow
                  key={rule.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/rules/${rule.id}`)}
                >
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {rule.description || rule.dqdl_expression}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {rule.column_name || '-'}
                  </TableCell>
                  <TableCell className="capitalize">{rule.rule_type}</TableCell>
                  <TableCell>{getSeverityBadge(rule.severity)}</TableCell>
                  <TableCell>{getStatusBadge(rule.status)}</TableCell>
                  <TableCell>{formatDate(rule.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {deleteConfirm === rule.id ? (
                        <>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(rule.id)}
                            disabled={deleteRule.isPending}
                          >
                            Confirm
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(rule.id)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="py-12 text-center">
            <h3 className="text-lg font-medium">No rules yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first rule with AI assistance.
            </p>
            <Button
              className="mt-4"
              onClick={() => router.push('/rules/new?mode=ai')}
            >
              Create Rule with AI
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
