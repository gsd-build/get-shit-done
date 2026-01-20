'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAlertCounts } from '@/hooks/use-alerts';

export function AlertSummary() {
  const { data: counts, isLoading } = useAlertCounts();

  const openCount = counts?.open ?? 0;
  const criticalCount = counts?.critical ?? 0;
  const warningCount = counts?.warning ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Alert Summary</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${openCount > 0 ? 'text-red-600' : ''}`}>
                {openCount}
              </span>
              <span className="text-muted-foreground">open alerts</span>
            </div>

            {openCount > 0 && (
              <div className="flex flex-wrap gap-2 text-sm">
                {criticalCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-red-800">
                    {criticalCount} critical
                  </span>
                )}
                {warningCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-yellow-800">
                    {warningCount} warning
                  </span>
                )}
              </div>
            )}

            <Link
              href="/alerts"
              className="inline-flex items-center text-sm text-primary hover:underline"
            >
              View all alerts
              <svg
                className="ml-1 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
