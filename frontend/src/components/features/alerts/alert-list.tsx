'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAlerts, useAlertCounts, useAcknowledgeAlert, AlertFilters } from '@/hooks/use-alerts';
import { Alert, AlertStatus, AlertSeverity, AlertType } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type StatusTab = 'all' | AlertStatus;

function getSeverityIcon(severity: AlertSeverity) {
  const icons: Record<AlertSeverity, { symbol: string; color: string }> = {
    critical: { symbol: '!', color: 'bg-red-100 text-red-600' },
    warning: { symbol: '\u26A0', color: 'bg-yellow-100 text-yellow-600' },
    info: { symbol: 'i', color: 'bg-blue-100 text-blue-600' },
  };
  const { symbol, color } = icons[severity];
  return (
    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-bold ${color}`}>
      {symbol}
    </span>
  );
}

function getAlertTypeBadge(alertType: AlertType) {
  const labels: Record<AlertType, string> = {
    rule_failure: 'Rule Failure',
    freshness_sla: 'Freshness SLA',
    volume_anomaly: 'Volume Anomaly',
  };
  const colors: Record<AlertType, string> = {
    rule_failure: 'bg-purple-100 text-purple-800',
    freshness_sla: 'bg-orange-100 text-orange-800',
    volume_anomaly: 'bg-pink-100 text-pink-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[alertType]}`}>
      {labels[alertType]}
    </span>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface AlertCardProps {
  alert: Alert;
  onAcknowledge?: (id: string) => void;
  isAcknowledging?: boolean;
}

function AlertCard({ alert, onAcknowledge, isAcknowledging }: AlertCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Severity icon */}
          {getSeverityIcon(alert.severity)}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {getAlertTypeBadge(alert.alert_type)}
              {alert.datasets && (
                <span className="text-xs text-muted-foreground">
                  {alert.datasets.database_name}.{alert.datasets.table_name}
                </span>
              )}
            </div>

            <Link href={`/alerts/${alert.id}`} className="hover:underline">
              <h4 className="font-semibold text-sm line-clamp-1">{alert.title}</h4>
            </Link>

            {alert.message && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {alert.message}
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-2">
              {formatRelativeTime(alert.created_at)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Link href={`/alerts/${alert.id}`}>
              <Button variant="outline" size="sm">
                View
              </Button>
            </Link>
            {alert.status === 'open' && onAcknowledge && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAcknowledge(alert.id);
                }}
                disabled={isAcknowledging}
              >
                {isAcknowledging ? 'Ack...' : 'Acknowledge'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AlertList() {
  const [statusTab, setStatusTab] = useState<StatusTab>('open');
  const acknowledgeAlert = useAcknowledgeAlert();

  // Build filters based on tab
  const filters: AlertFilters | undefined =
    statusTab === 'all'
      ? undefined
      : { status: statusTab as AlertStatus };

  const { data: alerts, isLoading, error } = useAlerts(filters);
  const { data: counts } = useAlertCounts();

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeAlert.mutateAsync({ id });
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
      alert(err instanceof Error ? err.message : 'Failed to acknowledge alert');
    }
  };

  const tabs: Array<{ value: StatusTab; label: string; count?: number }> = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open', count: counts?.open },
    { value: 'acknowledged', label: 'Acknowledged', count: counts?.acknowledged },
    { value: 'resolved', label: 'Resolved', count: counts?.resolved },
  ];

  return (
    <div className="space-y-6">
      {/* Stats row */}
      {counts && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold">{counts.open}</p>
              <p className="text-sm text-muted-foreground">Open Alerts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{counts.critical}</p>
              <p className="text-sm text-muted-foreground">Critical</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-yellow-600">{counts.warning}</p>
              <p className="text-sm text-muted-foreground">Warning</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                statusTab === tab.value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 text-xs opacity-70">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading alerts...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center justify-center py-12">
          <p className="text-destructive">Error loading alerts: {error.message}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && (!alerts || alerts.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              {statusTab === 'all'
                ? 'No alerts found.'
                : statusTab === 'open'
                ? 'No open alerts. Great job!'
                : `No ${statusTab} alerts found.`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Alert cards */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alertItem) => (
            <AlertCard
              key={alertItem.id}
              alert={alertItem}
              onAcknowledge={alertItem.status === 'open' ? handleAcknowledge : undefined}
              isAcknowledging={acknowledgeAlert.isPending && acknowledgeAlert.variables?.id === alertItem.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
