'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface HistogramBin {
  bin_start: number;
  bin_end: number;
  count: number;
}

interface DistributionChartProps {
  columnName: string;
  histogramData: HistogramBin[];
  onClose?: () => void;
}

export function DistributionChart({
  columnName,
  histogramData,
  onClose,
}: DistributionChartProps) {
  if (!histogramData || histogramData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Distribution: {columnName}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No distribution data available for this column.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Format the data for Recharts
  const chartData = histogramData.map((bin) => ({
    name: `${bin.bin_start.toFixed(2)} - ${bin.bin_end.toFixed(2)}`,
    value: bin.count,
    binStart: bin.bin_start,
    binEnd: bin.bin_end,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Distribution: {columnName}</CardTitle>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                tickFormatter={(value) => {
                  // Shorten long labels
                  if (value.length > 15) {
                    return value.substring(0, 12) + '...';
                  }
                  return value;
                }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip
                formatter={(value: number) => [value.toLocaleString(), 'Count']}
                labelFormatter={(label) => `Range: ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '0.5rem',
                }}
              />
              <Bar
                dataKey="value"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
