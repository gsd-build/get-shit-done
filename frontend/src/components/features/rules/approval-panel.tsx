'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useApproveRule, useRejectRule, usePendingRules, DQRule } from '@/hooks/use-rules';
import { cn } from '@/lib/utils';

interface ApprovalPanelProps {
  rule: DQRule;
  className?: string;
}

export function ApprovalPanel({ rule, className }: ApprovalPanelProps) {
  const router = useRouter();
  const approveRule = useApproveRule();
  const rejectRule = useRejectRule();
  const { data: pendingData } = usePendingRules();

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [comments, setComments] = useState('');

  // Find current rule index in pending list for navigation
  const pendingRules = pendingData?.rules || [];
  const currentIndex = pendingRules.findIndex((r) => r.id === rule.id);
  const prevRule = currentIndex > 0 ? pendingRules[currentIndex - 1] : null;
  const nextRule = currentIndex < pendingRules.length - 1 ? pendingRules[currentIndex + 1] : null;

  const handleApprove = async () => {
    try {
      await approveRule.mutateAsync({
        id: rule.id,
        comments: comments || undefined,
      });
      // Navigate to next pending rule or back to list
      if (nextRule) {
        router.push(`/rules/${nextRule.id}`);
      } else {
        router.push('/rules?tab=pending');
      }
    } catch (err) {
      console.error('Failed to approve rule:', err);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;

    try {
      await rejectRule.mutateAsync({
        id: rule.id,
        comments: rejectReason,
      });
      setShowRejectDialog(false);
      // Navigate to next pending rule or back to list
      if (nextRule) {
        router.push(`/rules/${nextRule.id}`);
      } else {
        router.push('/rules?tab=pending');
      }
    } catch (err) {
      console.error('Failed to reject rule:', err);
    }
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
    return new Date(dateString).toLocaleString();
  };

  // Parse false positive scenarios from reasoning (if stored in format)
  const parseReasoningData = (reasoning: string | null) => {
    if (!reasoning) return { reasoning: null, falsePositives: [] };

    try {
      // Check if reasoning contains JSON-structured false positives
      const data = JSON.parse(reasoning);
      return {
        reasoning: data.reasoning || reasoning,
        falsePositives: data.false_positive_scenarios || [],
      };
    } catch {
      return { reasoning, falsePositives: [] };
    }
  };

  const { reasoning: displayReasoning } = parseReasoningData(rule.reasoning);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => prevRule && router.push(`/rules/${prevRule.id}`)}
          disabled={!prevRule}
        >
          Previous Pending
        </Button>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} of {pendingRules.length} pending
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => nextRule && router.push(`/rules/${nextRule.id}`)}
          disabled={!nextRule}
        >
          Next Pending
        </Button>
      </div>

      {/* Rule Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Rule Details</CardTitle>
            <div className="flex gap-2">
              {getSourceBadge(rule.generated_by)}
              {getSeverityBadge(rule.severity)}
            </div>
          </div>
          <CardDescription>
            {rule.description || 'No description provided'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* DQDL Expression */}
          <div className="space-y-2">
            <label className="text-sm font-medium">DQDL Expression</label>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-sm">
              {rule.dqdl_expression}
            </pre>
          </div>

          {/* Metadata */}
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <span className="font-medium">Rule Type:</span>{' '}
              <span className="capitalize">{rule.rule_type}</span>
            </div>
            <div>
              <span className="font-medium">Column:</span>{' '}
              <span className="font-mono">{rule.column_name || 'Table-level'}</span>
            </div>
            <div>
              <span className="font-medium">Created:</span>{' '}
              <span>{formatDate(rule.created_at)}</span>
            </div>
            {rule.template_name && (
              <div>
                <span className="font-medium">Template:</span>{' '}
                <span>{rule.template_name}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Reasoning (if AI-generated) */}
      {rule.generated_by === 'ai_recommender' && displayReasoning && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI Reasoning</CardTitle>
            <CardDescription>
              Why the AI recommended this rule based on your data profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-purple-50 p-4 text-sm text-purple-900">
              {displayReasoning}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approval Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Review Comments (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Add any notes about this approval..."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button
          onClick={handleApprove}
          disabled={approveRule.isPending}
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          {approveRule.isPending ? 'Approving...' : 'Approve Rule'}
        </Button>
        <Button
          variant="destructive"
          onClick={() => setShowRejectDialog(true)}
          disabled={rejectRule.isPending}
          className="flex-1"
        >
          Reject Rule
        </Button>
      </div>

      {(approveRule.isError || rejectRule.isError) && (
        <p className="text-sm text-destructive">
          {approveRule.error?.message || rejectRule.error?.message}
        </p>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Reject Rule</CardTitle>
              <CardDescription>
                Please provide a reason for rejecting this rule.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Reason for rejection (required)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || rejectRule.isPending}
                  className="flex-1"
                >
                  {rejectRule.isPending ? 'Rejecting...' : 'Confirm Reject'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectDialog(false);
                    setRejectReason('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
