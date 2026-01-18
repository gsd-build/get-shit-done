'use client';

import { useState } from 'react';
import { ProfileAnomaly } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AnomalyListProps {
  anomalies: ProfileAnomaly[];
}

type SeverityFilter = 'all' | 'info' | 'warning' | 'critical';

export function AnomalyList({ anomalies }: AnomalyListProps) {
  const [filter, setFilter] = useState<SeverityFilter>('all');

  const filteredAnomalies =
    filter === 'all'
      ? anomalies
      : anomalies.filter((a) => a.severity === filter);

  const getSeverityBadge = (severity: ProfileAnomaly['severity']) => {
    const styles: Record<ProfileAnomaly['severity'], string> = {
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800',
    };

    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[severity]}`}
      >
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </span>
    );
  };

  const counts = {
    all: anomalies.length,
    info: anomalies.filter((a) => a.severity === 'info').length,
    warning: anomalies.filter((a) => a.severity === 'warning').length,
    critical: anomalies.filter((a) => a.severity === 'critical').length,
  };

  if (anomalies.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-lg font-medium text-green-600">No Anomalies Detected</p>
            <p className="text-sm text-muted-foreground mt-1">
              All column statistics are within expected ranges.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'critical', 'warning', 'info'] as SeverityFilter[]).map(
          (severity) => (
            <Button
              key={severity}
              variant={filter === severity ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(severity)}
            >
              {severity === 'all' ? 'All' : severity.charAt(0).toUpperCase() + severity.slice(1)}
              <span className="ml-1 text-xs opacity-70">({counts[severity]})</span>
            </Button>
          )
        )}
      </div>

      {/* Anomaly list */}
      <div className="space-y-3">
        {filteredAnomalies.map((anomaly) => (
          <Card key={anomaly.id}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getSeverityBadge(anomaly.severity)}
                    {anomaly.column_name && (
                      <span className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">
                        {anomaly.column_name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium">{anomaly.anomaly_type}</p>
                  {anomaly.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {anomaly.description}
                    </p>
                  )}
                  {(anomaly.value != null || anomaly.threshold != null) && (
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      {anomaly.value != null && (
                        <span>
                          Value: <span className="font-mono">{anomaly.value}</span>
                        </span>
                      )}
                      {anomaly.threshold != null && (
                        <span>
                          Threshold: <span className="font-mono">{anomaly.threshold}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAnomalies.length === 0 && filter !== 'all' && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            No {filter} anomalies found.
          </p>
        </div>
      )}
    </div>
  );
}
