'use client';

import { use } from 'react';
import Link from 'next/link';
import { useAlert } from '@/hooks/use-alerts';
import { Button } from '@/components/ui/button';
import { AlertDetail } from '@/components/features/alerts/alert-detail';

interface AlertDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function AlertDetailPage({ params }: AlertDetailPageProps) {
  const { id } = use(params);
  const { data: alert, isLoading, error } = useAlert(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading alert details...</p>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive mb-4">
          {error ? `Error: ${error.message}` : 'Alert not found'}
        </p>
        <Link href="/alerts">
          <Button variant="outline">Back to Alerts</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/alerts" className="hover:underline">
              Alerts
            </Link>
            <span>/</span>
            <span>Alert #{id.slice(0, 8)}</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Alert Details</h2>
        </div>
        <Link href="/alerts">
          <Button variant="outline">Back to Alerts</Button>
        </Link>
      </div>

      {/* Alert detail content */}
      <AlertDetail alert={alert} />
    </div>
  );
}
