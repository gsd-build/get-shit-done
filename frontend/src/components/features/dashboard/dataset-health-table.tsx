'use client';

import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatasetHealth } from '@/hooks/use-dashboard';

interface DatasetHealthTableProps {
  datasets: DatasetHealth[];
  isLoading: boolean;
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 0.8) return 'text-green-600';
  if (score >= 0.6) return 'text-yellow-600';
  return 'text-red-600';
}

function getStatusBadge(score: number | null): { text: string; className: string } {
  if (score === null) {
    return {
      text: 'Unknown',
      className: 'bg-gray-100 text-gray-800',
    };
  }
  if (score >= 0.8) {
    return {
      text: 'Healthy',
      className: 'bg-green-100 text-green-800',
    };
  }
  return {
    text: 'At Risk',
    className: 'bg-red-100 text-red-800',
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DatasetHealthTable({ datasets, isLoading }: DatasetHealthTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dataset Health</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No datasets registered yet.{' '}
            <Link href="/sources" className="text-primary hover:underline">
              Add a data source
            </Link>{' '}
            to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dataset</TableHead>
                <TableHead>Database</TableHead>
                <TableHead>Quality Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Validation</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datasets.map((dataset) => {
                const scorePercent = dataset.composite_score !== null
                  ? `${Math.round(dataset.composite_score * 100)}%`
                  : 'N/A';
                const status = getStatusBadge(dataset.composite_score);

                return (
                  <TableRow key={dataset.id}>
                    <TableCell className="font-medium">
                      {dataset.table_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {dataset.database_name}
                    </TableCell>
                    <TableCell className={getScoreColor(dataset.composite_score)}>
                      {scorePercent}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                      >
                        {status.text}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(dataset.last_validation_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/validations?dataset_id=${dataset.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
