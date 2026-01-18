'use client';

import { AlertList } from '@/components/features/alerts/alert-list';
import { useOpenAlertCount } from '@/hooks/use-alerts';

export default function AlertsPage() {
  const { data: openCount } = useOpenAlertCount();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Alerts
            {openCount !== undefined && openCount > 0 && (
              <span className="ml-3 inline-flex items-center justify-center h-7 min-w-7 px-2 rounded-full bg-red-100 text-red-800 text-sm font-medium">
                {openCount}
              </span>
            )}
          </h2>
          <p className="text-muted-foreground">
            Data quality alerts for rule failures, freshness violations, and volume anomalies
          </p>
        </div>
      </div>

      <AlertList />
    </div>
  );
}
