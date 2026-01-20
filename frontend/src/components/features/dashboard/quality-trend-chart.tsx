'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendDataPoint } from '@/hooks/use-dashboard';

interface QualityTrendChartProps {
  data: TrendDataPoint[];
  isLoading: boolean;
  title?: string;
}

// Dimension colors matching the design spec
const dimensionColors: Record<string, string> = {
  completeness: '#22c55e', // green
  validity: '#3b82f6', // blue
  uniqueness: '#8b5cf6', // purple
  consistency: '#f59e0b', // amber
  freshness: '#ec4899', // pink
};

const dimensionLabels: Record<string, string> = {
  completeness: 'Completeness',
  validity: 'Validity',
  uniqueness: 'Uniqueness',
  consistency: 'Consistency',
  freshness: 'Freshness',
};

// Transform row-per-dimension data to Recharts format (row per day with all dimensions)
type DimensionKey = 'completeness' | 'validity' | 'uniqueness' | 'consistency' | 'freshness';

interface ChartDataPoint {
  day: string;
  dayFormatted: string;
  completeness?: number;
  validity?: number;
  uniqueness?: number;
  consistency?: number;
  freshness?: number;
  [key: string]: string | number | undefined; // Index signature for dynamic access
}

function transformData(data: TrendDataPoint[]): ChartDataPoint[] {
  const dayMap = new Map<string, ChartDataPoint>();

  data.forEach((point) => {
    const existing = dayMap.get(point.day) || {
      day: point.day,
      dayFormatted: formatDate(point.day),
    };

    // Use the rolling 7-day average if available, otherwise use avg_score
    const score = point.rolling_7day_avg ?? point.avg_score;
    const dimension = point.dimension as DimensionKey;
    existing[dimension] = score * 100; // Convert to percentage

    dayMap.set(point.day, existing);
  });

  // Sort by date ascending
  return Array.from(dayMap.values()).sort(
    (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime()
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function QualityTrendChart({
  data,
  isLoading,
  title = 'Quality Trends',
}: QualityTrendChartProps) {
  const chartData = transformData(data);

  // Determine which dimensions are present in the data
  const presentDimensions = new Set<string>();
  data.forEach((point) => presentDimensions.add(point.dimension));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No trend data available yet. Run validations to see quality trends.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="dayFormatted"
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${value.toFixed(1)}%`,
                  dimensionLabels[name] || name,
                ]}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '0.5rem',
                }}
              />
              <Legend
                formatter={(value) => dimensionLabels[value] || value}
                wrapperStyle={{ paddingTop: '10px' }}
              />
              {Object.entries(dimensionColors).map(([dimension, color]) =>
                presentDimensions.has(dimension) ? (
                  <Line
                    key={dimension}
                    type="monotone"
                    dataKey={dimension}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
