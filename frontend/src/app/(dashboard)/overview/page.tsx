'use client';

import { useDashboardStats, useQualityTrends, useDatasetHealthList } from '@/hooks/use-dashboard';
import { HealthOverview } from '@/components/features/dashboard/health-overview';
import { QualityTrendChart } from '@/components/features/dashboard/quality-trend-chart';
import { AlertSummary } from '@/components/features/dashboard/alert-summary';
import { DatasetHealthTable } from '@/components/features/dashboard/dataset-health-table';

export default function OverviewPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: trends, isLoading: trendsLoading } = useQualityTrends();
  const { data: datasets, isLoading: datasetsLoading } = useDatasetHealthList();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Health Overview</h1>
        <p className="text-muted-foreground">Monitor quality across all connected data sources</p>
      </div>

      {/* Stats cards */}
      <HealthOverview stats={stats} isLoading={statsLoading} />

      {/* Two-column layout for chart and alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <QualityTrendChart data={trends || []} isLoading={trendsLoading} title="Quality Trends (30 days)" />
        </div>
        <div>
          <AlertSummary />
        </div>
      </div>

      {/* Dataset health table */}
      <DatasetHealthTable datasets={datasets || []} isLoading={datasetsLoading} />
    </div>
  );
}
