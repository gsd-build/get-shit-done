'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApprovalPanel } from '@/components/features/rules/approval-panel';
import { RuleForm } from '@/components/features/rules/rule-form';
import { useRule, useUpdateRule } from '@/hooks/use-rules';
import { cn } from '@/lib/utils';

interface RuleDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function RuleDetailPage({ params }: RuleDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: rule, isLoading, error } = useRule(id);
  const updateRule = useUpdateRule();

  const handleToggleStatus = async () => {
    if (!rule) return;

    const newStatus = rule.status === 'active' ? 'disabled' : 'active';
    try {
      await updateRule.mutateAsync({
        id: rule.id,
        status: newStatus,
      });
    } catch (err) {
      console.error('Failed to update rule status:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
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
          styles[status] || styles.pending
        )}
      >
        {status}
      </span>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const styles: Record<string, string> = {
      critical: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      info: 'bg-blue-100 text-blue-800',
    };

    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          styles[severity] || styles.warning
        )}
      >
        {severity}
      </span>
    );
  };

  const getSourceBadge = (generated_by: string | null) => {
    const styles: Record<string, string> = {
      ai_recommender: 'bg-purple-100 text-purple-800',
      template: 'bg-blue-100 text-blue-800',
      user: 'bg-gray-100 text-gray-800',
      glue_ml: 'bg-green-100 text-green-800',
    };

    const labels: Record<string, string> = {
      ai_recommender: 'AI Generated',
      template: 'From Template',
      user: 'Manual',
      glue_ml: 'Glue ML',
    };

    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          styles[generated_by || 'user'] || styles.user
        )}
      >
        {labels[generated_by || 'user'] || 'Manual'}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !rule) {
    return (
      <div className="space-y-4">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link href="/rules" className="hover:text-foreground">
            Rules
          </Link>
          <span>/</span>
          <span className="text-foreground">Rule Details</span>
        </nav>
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {error ? `Failed to load rule: ${error.message}` : 'Rule not found'}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show approval panel for pending rules
  if (rule.status === 'pending') {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link href="/rules" className="hover:text-foreground">
            Rules
          </Link>
          <span>/</span>
          <span className="text-foreground">Pending Approval</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Review Rule</h1>
            <p className="text-muted-foreground">
              Review and approve or reject this pending rule
            </p>
          </div>
          <Link href="/rules">
            <Button variant="outline">Back to Rules</Button>
          </Link>
        </div>

        <ApprovalPanel rule={rule} />
      </div>
    );
  }

  // Show detail view for approved/active/disabled rules
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Link href="/rules" className="hover:text-foreground">
          Rules
        </Link>
        <span>/</span>
        <span className="text-foreground">Rule Details</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">
              {rule.description || rule.dqdl_expression.slice(0, 50)}
            </h1>
            {getStatusBadge(rule.status)}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {getSourceBadge(rule.generated_by)}
            {getSeverityBadge(rule.severity)}
            <span className="capitalize">{rule.rule_type}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleToggleStatus}
            disabled={updateRule.isPending}
          >
            {rule.status === 'active' ? 'Disable' : 'Enable'}
          </Button>
          <Button onClick={() => router.push(`/rules/new?mode=manual`)}>
            Edit
          </Button>
        </div>
      </div>

      {/* Rule Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>DQDL Expression</CardTitle>
          <CardDescription>The data quality rule definition</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-sm">
            {rule.dqdl_expression}
          </pre>
        </CardContent>
      </Card>

      {/* AI Reasoning (if applicable) */}
      {rule.generated_by === 'ai_recommender' && rule.reasoning && (
        <Card>
          <CardHeader>
            <CardTitle>AI Reasoning</CardTitle>
            <CardDescription>
              Why this rule was recommended based on your data profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-purple-50 p-4 text-sm text-purple-900">
              {rule.reasoning}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Rule Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 md:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Rule Type</dt>
              <dd className="mt-1 capitalize">{rule.rule_type}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Column</dt>
              <dd className="mt-1 font-mono">{rule.column_name || 'Table-level'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Severity</dt>
              <dd className="mt-1">{getSeverityBadge(rule.severity)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Status</dt>
              <dd className="mt-1">{getStatusBadge(rule.status)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Created</dt>
              <dd className="mt-1">{formatDate(rule.created_at)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Last Updated</dt>
              <dd className="mt-1">{formatDate(rule.updated_at)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Trigger Count</dt>
              <dd className="mt-1">{rule.trigger_count}</dd>
            </div>
            {rule.last_triggered_at && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Last Triggered</dt>
                <dd className="mt-1">{formatDate(rule.last_triggered_at)}</dd>
              </div>
            )}
            {rule.template_name && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Template</dt>
                <dd className="mt-1">{rule.template_name}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/rules')}>
          Back to Rules
        </Button>
        <Button variant="outline">Run Validation</Button>
      </div>
    </div>
  );
}
