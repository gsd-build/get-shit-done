'use client';

import { ProfileRun, ProfileResult, Dataset } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

interface ProfileSummaryProps {
  run: ProfileRun & { datasets: Dataset };
  result: ProfileResult | null;
}

export function ProfileSummary({ run, result }: ProfileSummaryProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: ProfileRun['status']) => {
    const styles: Record<ProfileRun['status'], string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      running: 'bg-blue-100 text-blue-800',
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
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num == null) return '-';
    return num.toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              {run.datasets?.database_name}.{run.datasets?.table_name}
            </CardTitle>
            <CardDescription>Profile run from {formatDate(run.created_at)}</CardDescription>
          </div>
          {getStatusBadge(run.status)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Row Count</p>
            <p className="text-2xl font-bold">{formatNumber(result?.row_count)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Column Count</p>
            <p className="text-2xl font-bold">{formatNumber(result?.column_count)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Sampled</p>
            <p className="text-2xl font-bold">
              {result?.sampled ? `Yes (${formatNumber(result.sample_size)})` : 'No'}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Profiled At</p>
            <p className="text-lg font-medium">{formatDate(result?.profiled_at || null)}</p>
          </div>
        </div>

        {result?.s3_full_profile_uri && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Full profile available at:{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">
                {result.s3_full_profile_uri}
              </code>
            </p>
          </div>
        )}

        {run.error_message && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="text-sm text-muted-foreground">{run.error_message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
