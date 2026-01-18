'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useValidations, useTriggerValidation, ValidationFilters } from '@/hooks/use-validations';
import { useSources } from '@/hooks/use-sources';
import { ValidationRun, Dataset } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type StatusFilter = 'all' | 'pending' | 'running' | 'completed' | 'failed';

function getStatusBadge(status: ValidationRun['status']) {
  const styles: Record<ValidationRun['status'], string> = {
    pending: 'bg-gray-100 text-gray-800',
    running: 'bg-blue-100 text-blue-800 animate-pulse',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function getScoreBadge(score: number | null) {
  if (score === null) return '-';

  const percent = Math.round(score * 100);
  let colorClass = 'text-green-600';
  if (score < 0.6) colorClass = 'text-red-600';
  else if (score < 0.8) colorClass = 'text-yellow-600';

  return (
    <span className={`font-medium ${colorClass}`}>
      {percent}%
    </span>
  );
}

function formatDate(dateString: string | null) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '-';

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const durationMs = end - start;

  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`;
  return `${Math.round(durationMs / 60000)}m`;
}

function getTriggeredByLabel(triggeredBy: string | null): string {
  const labels: Record<string, string> = {
    manual: 'Manual',
    scheduled: 'Scheduled',
    pipeline: 'Pipeline',
    event: 'Event',
  };
  return triggeredBy ? labels[triggeredBy] || triggeredBy : '-';
}

interface RunValidationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (datasetId: string) => void;
  isLoading: boolean;
}

function RunValidationDialog({ isOpen, onClose, onConfirm, isLoading }: RunValidationDialogProps) {
  const { data: sources } = useSources();
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');

  if (!isOpen) return null;

  // Get all datasets from all sources
  const datasets: Array<{ id: string; label: string }> = [];
  // Note: In a real implementation, you'd fetch datasets directly
  // For now, we'll show a simplified version

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Run Validation</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select a dataset to validate. All active rules for the dataset will be evaluated.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Dataset ID</label>
          <input
            type="text"
            placeholder="Enter dataset UUID"
            className="w-full px-3 py-2 border rounded-md"
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter the UUID of the dataset to validate
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(selectedDatasetId)}
            disabled={!selectedDatasetId || isLoading}
          >
            {isLoading ? 'Starting...' : 'Run Validation'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ValidationList() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showRunDialog, setShowRunDialog] = useState(false);

  const filters: ValidationFilters = statusFilter !== 'all' ? { status: statusFilter } : {};
  const { data: validations, isLoading, error } = useValidations(filters);
  const triggerValidation = useTriggerValidation();

  const handleRunValidation = async (datasetId: string) => {
    try {
      await triggerValidation.mutateAsync({ dataset_id: datasetId });
      setShowRunDialog(false);
    } catch (err) {
      console.error('Failed to trigger validation:', err);
      alert(err instanceof Error ? err.message : 'Failed to trigger validation');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading validation runs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-destructive">Error loading validations: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'running', 'completed', 'failed', 'pending'] as StatusFilter[]).map(
          (status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          )
        )}
      </div>

      {/* Empty state */}
      {!validations || validations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              {statusFilter === 'all'
                ? 'No validation runs yet. Run your first validation to see results.'
                : `No ${statusFilter} validation runs found.`}
            </p>
            <Button onClick={() => setShowRunDialog(true)}>Run Validation</Button>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dataset</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Passed/Failed</TableHead>
              <TableHead>Triggered By</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {validations.map((validation) => {
              const run = validation as ValidationRun & { datasets: Dataset };
              return (
                <TableRow
                  key={run.id}
                  className="cursor-pointer"
                  onClick={() => {
                    // Navigate on row click (handled by Link in actions)
                  }}
                >
                  <TableCell className="font-medium">
                    <Link
                      href={`/validations/${run.id}`}
                      className="hover:underline"
                    >
                      {run.datasets
                        ? `${run.datasets.database_name}.${run.datasets.table_name}`
                        : run.dataset_id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>{getStatusBadge(run.status)}</TableCell>
                  <TableCell>{getScoreBadge(run.overall_score)}</TableCell>
                  <TableCell>
                    {run.status === 'completed' ? (
                      <span>
                        <span className="text-green-600 font-medium">{run.rules_passed ?? 0}</span>
                        {' / '}
                        <span className="text-red-600 font-medium">{run.rules_failed ?? 0}</span>
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{getTriggeredByLabel(run.triggered_by)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(run.started_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDuration(run.started_at, run.completed_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/validations/${run.id}`}>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Run Validation Dialog */}
      <RunValidationDialog
        isOpen={showRunDialog}
        onClose={() => setShowRunDialog(false)}
        onConfirm={handleRunValidation}
        isLoading={triggerValidation.isPending}
      />
    </div>
  );
}
