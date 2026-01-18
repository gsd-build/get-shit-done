'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useProfile } from '@/hooks/use-profiles';
import { Button } from '@/components/ui/button';
import { ProfileSummary } from '@/components/features/profiles/profile-summary';
import { ColumnStats } from '@/components/features/profiles/column-stats';
import { AnomalyList } from '@/components/features/profiles/anomaly-list';
import { DistributionChart } from '@/components/features/profiles/distribution-chart';
import { ColumnProfile } from '@/lib/supabase';

interface ProfileDetailPageProps {
  params: Promise<{ id: string }>;
}

type Tab = 'columns' | 'anomalies';

export default function ProfileDetailPage({ params }: ProfileDetailPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useProfile(id);
  const [activeTab, setActiveTab] = useState<Tab>('columns');
  const [selectedColumn, setSelectedColumn] = useState<ColumnProfile | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading profile details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive mb-4">
          {error ? `Error: ${error.message}` : 'Profile not found'}
        </p>
        <Link href="/profiles">
          <Button variant="outline">Back to Profiles</Button>
        </Link>
      </div>
    );
  }

  const { run, result, columns, anomalies } = data;

  // Show loading state for running profiles
  if (run.status === 'running' || run.status === 'pending') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Profile Details</h2>
            <p className="text-muted-foreground">
              Profiling {run.datasets?.database_name}.{run.datasets?.table_name}
            </p>
          </div>
          <Link href="/profiles">
            <Button variant="outline">Back to Profiles</Button>
          </Link>
        </div>

        <ProfileSummary run={run} result={result} />

        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
            <p className="text-lg font-medium">
              {run.status === 'pending' ? 'Waiting to start...' : 'Profiling in progress...'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              This page will automatically update when complete.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state for failed profiles
  if (run.status === 'failed') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Profile Details</h2>
            <p className="text-muted-foreground">
              {run.datasets?.database_name}.{run.datasets?.table_name}
            </p>
          </div>
          <Link href="/profiles">
            <Button variant="outline">Back to Profiles</Button>
          </Link>
        </div>

        <ProfileSummary run={run} result={result} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Profile Details</h2>
          <p className="text-muted-foreground">
            {run.datasets?.database_name}.{run.datasets?.table_name}
          </p>
        </div>
        <Link href="/profiles">
          <Button variant="outline">Back to Profiles</Button>
        </Link>
      </div>

      <ProfileSummary run={run} result={result} />

      {/* Distribution chart (if a column is selected) */}
      {selectedColumn && (
        <DistributionChart
          columnName={selectedColumn.column_name}
          histogramData={[]} // Would come from profile result metadata
          onClose={() => setSelectedColumn(null)}
        />
      )}

      {/* Tab navigation */}
      <div className="border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('columns')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'columns'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Column Statistics ({columns.length})
          </button>
          <button
            onClick={() => setActiveTab('anomalies')}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'anomalies'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Anomalies ({anomalies.length})
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'columns' && (
        <ColumnStats columns={columns} onSelectColumn={setSelectedColumn} />
      )}

      {activeTab === 'anomalies' && <AnomalyList anomalies={anomalies} />}
    </div>
  );
}
