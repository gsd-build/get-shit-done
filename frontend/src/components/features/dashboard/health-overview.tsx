'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardStats } from '@/hooks/use-dashboard';

interface HealthOverviewProps {
  stats: DashboardStats | undefined;
  isLoading: boolean;
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 0.8) return 'text-green-600';
  if (score >= 0.6) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBgColor(score: number | null): string {
  if (score === null) return 'bg-muted/50';
  if (score >= 0.8) return 'bg-green-50';
  if (score >= 0.6) return 'bg-yellow-50';
  return 'bg-red-50';
}

function StatCard({
  title,
  value,
  subtitle,
  valueColor,
  bgColor,
  isLoading,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  valueColor?: string;
  bgColor?: string;
  isLoading: boolean;
}) {
  return (
    <Card className={bgColor}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        ) : (
          <>
            <p className={`text-2xl font-bold ${valueColor || ''}`}>{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function HealthOverview({ stats, isLoading }: HealthOverviewProps) {
  const avgScore = stats?.avg_composite_score;
  const avgScorePercent = avgScore !== null && avgScore !== undefined
    ? `${Math.round(avgScore * 100)}%`
    : 'N/A';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <StatCard
        title="Total Datasets"
        value={stats?.total_datasets ?? 0}
        isLoading={isLoading}
      />
      <StatCard
        title="Avg Quality Score"
        value={avgScorePercent}
        valueColor={getScoreColor(avgScore ?? null)}
        bgColor={getScoreBgColor(avgScore ?? null)}
        isLoading={isLoading}
      />
      <StatCard
        title="Healthy Datasets"
        value={stats?.datasets_above_threshold ?? 0}
        subtitle="Score >= 80%"
        valueColor="text-green-600"
        isLoading={isLoading}
      />
      <StatCard
        title="At Risk Datasets"
        value={stats?.datasets_below_threshold ?? 0}
        subtitle="Score < 80%"
        valueColor={(stats?.datasets_below_threshold ?? 0) > 0 ? 'text-red-600' : undefined}
        bgColor={(stats?.datasets_below_threshold ?? 0) > 0 ? 'bg-red-50' : undefined}
        isLoading={isLoading}
      />
      <StatCard
        title="Open Alerts"
        value={stats?.open_alerts ?? 0}
        subtitle={`${stats?.critical_alerts ?? 0} critical`}
        valueColor={(stats?.critical_alerts ?? 0) > 0 ? 'text-red-600' : undefined}
        isLoading={isLoading}
      />
    </div>
  );
}
