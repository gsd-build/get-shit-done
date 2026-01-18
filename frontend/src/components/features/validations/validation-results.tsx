'use client';

import { useState } from 'react';
import { ValidationRunDetail, RuleResult } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { QualityScoreGrid } from './quality-score-card';

interface ValidationResultsProps {
  validation: ValidationRunDetail;
}

type ResultFilter = 'all' | 'pass' | 'fail' | 'error';

function getResultBadge(result: RuleResult['result']) {
  const styles: Record<RuleResult['result'], string> = {
    pass: 'bg-green-100 text-green-800',
    fail: 'bg-red-100 text-red-800',
    error: 'bg-orange-100 text-orange-800',
    skip: 'bg-gray-100 text-gray-800',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[result]}`}
    >
      {result.charAt(0).toUpperCase() + result.slice(1)}
    </span>
  );
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-gray-500';
  if (score >= 0.8) return 'text-green-600';
  if (score >= 0.6) return 'text-yellow-600';
  return 'text-red-600';
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return '-';

  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
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
    event: 'Event-driven',
  };
  return triggeredBy ? labels[triggeredBy] || triggeredBy : 'Unknown';
}

export function ValidationResults({ validation }: ValidationResultsProps) {
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const filteredResults =
    resultFilter === 'all'
      ? validation.rule_results
      : validation.rule_results.filter((r) => r.result === resultFilter);

  // Sort failures first
  const sortedResults = [...filteredResults].sort((a, b) => {
    const order = { fail: 0, error: 1, skip: 2, pass: 3 };
    return order[a.result] - order[b.result];
  });

  const toggleRowExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const resultCounts = {
    all: validation.rule_results.length,
    pass: validation.rule_results.filter((r) => r.result === 'pass').length,
    fail: validation.rule_results.filter((r) => r.result === 'fail').length,
    error: validation.rule_results.filter((r) => r.result === 'error').length,
  };

  const overallScorePercent = validation.overall_score !== null
    ? Math.round(validation.overall_score * 100)
    : null;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Validation Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {/* Overall Score */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Overall Score</p>
              <p className={`text-4xl font-bold ${getScoreColor(validation.overall_score)}`}>
                {overallScorePercent !== null ? `${overallScorePercent}%` : '-'}
              </p>
            </div>

            {/* Rules Passed */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Passed</p>
              <p className="text-3xl font-bold text-green-600">
                {validation.rules_passed ?? 0}
              </p>
            </div>

            {/* Rules Failed */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Failed</p>
              <p className="text-3xl font-bold text-red-600">
                {validation.rules_failed ?? 0}
              </p>
            </div>

            {/* Duration */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Duration</p>
              <p className="text-3xl font-bold">
                {formatDuration(validation.started_at, validation.completed_at)}
              </p>
            </div>

            {/* Triggered By */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Triggered By</p>
              <p className="text-lg font-medium">
                {getTriggeredByLabel(validation.triggered_by)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quality Dimension Scores */}
      {validation.quality_scores.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Quality Dimension Scores</h3>
          <QualityScoreGrid scores={validation.quality_scores} />
        </div>
      )}

      {/* Rule Results */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Rule Results</h3>

          {/* S3 Link */}
          {validation.s3_results_uri && (
            <a
              href={validation.s3_results_uri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3"
            >
              View Full Results (S3)
            </a>
          )}
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(['all', 'fail', 'error', 'pass'] as ResultFilter[]).map((filter) => (
            <Button
              key={filter}
              variant={resultFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setResultFilter(filter)}
            >
              {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              <span className="ml-1 text-xs opacity-70">({resultCounts[filter]})</span>
            </Button>
          ))}
        </div>

        {/* Results table */}
        {sortedResults.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">
                {resultFilter === 'all'
                  ? 'No rule results available.'
                  : `No ${resultFilter} rules found.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedResults.map((result) => {
                const isExpanded = expandedRows.has(result.id);
                const hasSampleFailures =
                  result.sample_failures && result.sample_failures.length > 0;

                return (
                  <>
                    <TableRow
                      key={result.id}
                      className={hasSampleFailures ? 'cursor-pointer hover:bg-muted/50' : ''}
                      onClick={() => hasSampleFailures && toggleRowExpand(result.id)}
                    >
                      <TableCell className="text-center">
                        {hasSampleFailures && (
                          <span className="text-muted-foreground">
                            {isExpanded ? '\u25BC' : '\u25B6'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {result.dq_rules?.name || 'Unknown Rule'}
                          </p>
                          {result.dq_rules?.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-xs">
                              {result.dq_rules.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs bg-secondary px-2 py-1 rounded">
                          {result.dq_rules?.rule_type || 'unknown'}
                        </span>
                      </TableCell>
                      <TableCell>{getResultBadge(result.result)}</TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm text-muted-foreground truncate">
                          {result.evaluation_message || '-'}
                        </p>
                      </TableCell>
                    </TableRow>

                    {/* Expandable row for sample failures */}
                    {isExpanded && hasSampleFailures && (
                      <TableRow key={`${result.id}-expanded`}>
                        <TableCell colSpan={5} className="bg-muted/30">
                          <div className="p-4">
                            <p className="text-sm font-medium mb-2">Sample Failures:</p>
                            <pre className="text-xs bg-background p-3 rounded border overflow-auto max-h-48">
                              {JSON.stringify(result.sample_failures, null, 2)}
                            </pre>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
