'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert, AlertSeverity, AlertType, AlertStatus } from '@/lib/supabase';
import { useAcknowledgeAlert, useResolveAlert, useSnoozeAlert, SnoozeAlertInput } from '@/hooks/use-alerts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AlertDetailProps {
  alert: Alert;
}

function getSeverityBadge(severity: AlertSeverity) {
  const styles: Record<AlertSeverity, string> = {
    critical: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${styles[severity]}`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}

function getAlertTypeBadge(alertType: AlertType) {
  const labels: Record<AlertType, string> = {
    rule_failure: 'Rule Failure',
    freshness_sla: 'Freshness SLA',
    volume_anomaly: 'Volume Anomaly',
  };
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-gray-100 text-gray-800">
      {labels[alertType]}
    </span>
  );
}

function getStatusBadge(status: AlertStatus) {
  const styles: Record<AlertStatus, string> = {
    open: 'bg-red-100 text-red-800',
    acknowledged: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
    snoozed: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface TimelineEvent {
  label: string;
  timestamp: string | null;
  by?: string | null;
  notes?: string | null;
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  const filteredEvents = events.filter((e) => e.timestamp);

  if (filteredEvents.length === 0) {
    return <p className="text-sm text-muted-foreground">No events yet.</p>;
  }

  return (
    <div className="space-y-4">
      {filteredEvents.map((event, index) => (
        <div key={index} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="h-3 w-3 rounded-full bg-primary" />
            {index < filteredEvents.length - 1 && (
              <div className="w-0.5 flex-1 bg-border" />
            )}
          </div>
          <div className="pb-4">
            <p className="font-medium text-sm">{event.label}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(event.timestamp)}
            </p>
            {event.by && (
              <p className="text-xs text-muted-foreground">
                By: {event.by.slice(0, 8)}...
              </p>
            )}
            {event.notes && (
              <p className="text-sm mt-1 bg-muted p-2 rounded">{event.notes}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AlertDetail({ alert }: AlertDetailProps) {
  const [acknowledgmentNote, setAcknowledgmentNote] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showDetailsJson, setShowDetailsJson] = useState(false);

  const acknowledgeAlert = useAcknowledgeAlert();
  const resolveAlert = useResolveAlert();
  const snoozeAlert = useSnoozeAlert();

  const handleAcknowledge = async () => {
    try {
      await acknowledgeAlert.mutateAsync({
        id: alert.id,
        acknowledgment_note: acknowledgmentNote || undefined,
      });
      setAcknowledgmentNote('');
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
      window.alert(err instanceof Error ? err.message : 'Failed to acknowledge alert');
    }
  };

  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      window.alert('Resolution notes are required');
      return;
    }
    try {
      await resolveAlert.mutateAsync({
        id: alert.id,
        resolution_notes: resolutionNotes,
      });
      setResolutionNotes('');
    } catch (err) {
      console.error('Failed to resolve alert:', err);
      window.alert(err instanceof Error ? err.message : 'Failed to resolve alert');
    }
  };

  const handleSnooze = async (duration: SnoozeAlertInput['duration']) => {
    try {
      await snoozeAlert.mutateAsync({ id: alert.id, duration });
    } catch (err) {
      console.error('Failed to snooze alert:', err);
      window.alert(err instanceof Error ? err.message : 'Failed to snooze alert');
    }
  };

  const timelineEvents: TimelineEvent[] = [
    { label: 'Created', timestamp: alert.created_at },
    {
      label: 'Acknowledged',
      timestamp: alert.acknowledged_at,
      by: alert.acknowledged_by,
    },
    {
      label: 'Resolved',
      timestamp: alert.resolved_at,
      by: alert.resolved_by,
      notes: alert.resolution_notes,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            {getSeverityBadge(alert.severity)}
            {getAlertTypeBadge(alert.alert_type)}
            {getStatusBadge(alert.status)}
          </div>
          <CardTitle className="mt-4">{alert.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {alert.message && (
            <p className="text-muted-foreground">{alert.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Details Section */}
      {alert.details && Object.keys(alert.details).length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Details</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetailsJson(!showDetailsJson)}
              >
                {showDetailsJson ? 'Hide JSON' : 'Show JSON'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showDetailsJson ? (
              <pre className="bg-muted p-4 rounded overflow-auto max-h-64 text-xs">
                {JSON.stringify(alert.details, null, 2)}
              </pre>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(alert.details).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground capitalize">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className="font-medium text-sm">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Related Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Related Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {alert.datasets && (
              <div>
                <span className="text-sm text-muted-foreground">Dataset: </span>
                <Link
                  href={`/sources`}
                  className="text-sm text-primary hover:underline"
                >
                  {alert.datasets.database_name}.{alert.datasets.table_name}
                </Link>
              </div>
            )}
            {alert.rule_id && (
              <div>
                <span className="text-sm text-muted-foreground">Rule: </span>
                <span className="text-sm font-mono">{alert.rule_id.slice(0, 8)}...</span>
              </div>
            )}
            {alert.run_id && (
              <div>
                <span className="text-sm text-muted-foreground">Validation Run: </span>
                <Link
                  href={`/validations/${alert.run_id}`}
                  className="text-sm text-primary hover:underline"
                >
                  {alert.run_id.slice(0, 8)}...
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Workflow */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Current Status:</span>
              {getStatusBadge(alert.status)}
            </div>

            {/* Open -> Acknowledge */}
            {alert.status === 'open' && (
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium">Acknowledge this alert</p>
                <textarea
                  placeholder="Optional acknowledgment note..."
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  rows={2}
                  value={acknowledgmentNote}
                  onChange={(e) => setAcknowledgmentNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleAcknowledge}
                    disabled={acknowledgeAlert.isPending}
                  >
                    {acknowledgeAlert.isPending ? 'Acknowledging...' : 'Acknowledge'}
                  </Button>
                </div>
              </div>
            )}

            {/* Acknowledged -> Resolve */}
            {alert.status === 'acknowledged' && (
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium">Resolve this alert</p>
                <textarea
                  placeholder="Resolution notes (required)..."
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleResolve}
                    disabled={resolveAlert.isPending || !resolutionNotes.trim()}
                  >
                    {resolveAlert.isPending ? 'Resolving...' : 'Resolve'}
                  </Button>
                </div>
              </div>
            )}

            {/* Snooze option for open/acknowledged */}
            {(alert.status === 'open' || alert.status === 'acknowledged') && (
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium">Snooze this alert</p>
                <div className="flex flex-wrap gap-2">
                  {(['1h', '4h', '1d', '1w'] as const).map((duration) => (
                    <Button
                      key={duration}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSnooze(duration)}
                      disabled={snoozeAlert.isPending}
                    >
                      {duration === '1h' && '1 Hour'}
                      {duration === '4h' && '4 Hours'}
                      {duration === '1d' && '1 Day'}
                      {duration === '1w' && '1 Week'}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Resolved state */}
            {alert.status === 'resolved' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 font-medium">
                  This alert has been resolved.
                </p>
                {alert.resolution_notes && (
                  <p className="text-sm text-green-700 mt-2">
                    Notes: {alert.resolution_notes}
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline events={timelineEvents} />
        </CardContent>
      </Card>
    </div>
  );
}
