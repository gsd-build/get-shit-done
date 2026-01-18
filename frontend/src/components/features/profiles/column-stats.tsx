'use client';

import { useState } from 'react';
import { ColumnProfile } from '@/lib/supabase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

interface ColumnStatsProps {
  columns: ColumnProfile[];
  onSelectColumn?: (column: ColumnProfile) => void;
}

type SortField = 'column_name' | 'null_percentage';
type SortDirection = 'asc' | 'desc';

export function ColumnStats({ columns, onSelectColumn }: ColumnStatsProps) {
  const [sortField, setSortField] = useState<SortField>('column_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedColumns = [...columns].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const getNullPercentageColor = (pct: number | null) => {
    if (pct == null) return 'text-muted-foreground';
    if (pct < 5) return 'text-green-600';
    if (pct < 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatNumber = (num: number | null | undefined, decimals = 2) => {
    if (num == null) return '-';
    if (Number.isInteger(num)) return num.toLocaleString();
    return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatPercentage = (pct: number | null) => {
    if (pct == null) return '-';
    return `${pct.toFixed(1)}%`;
  };

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">No column statistics available.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <button
              onClick={() => handleSort('column_name')}
              className="flex items-center gap-1 hover:text-foreground"
            >
              Column
              {sortField === 'column_name' && (
                <span>{sortDirection === 'asc' ? '\u2191' : '\u2193'}</span>
              )}
            </button>
          </TableHead>
          <TableHead>Type</TableHead>
          <TableHead>
            <button
              onClick={() => handleSort('null_percentage')}
              className="flex items-center gap-1 hover:text-foreground"
            >
              Nulls
              {sortField === 'null_percentage' && (
                <span>{sortDirection === 'asc' ? '\u2191' : '\u2193'}</span>
              )}
            </button>
          </TableHead>
          <TableHead>Distinct</TableHead>
          <TableHead>Min</TableHead>
          <TableHead>Max</TableHead>
          <TableHead>Mean</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedColumns.map((col) => (
          <>
            <TableRow key={col.id}>
              <TableCell className="font-medium">{col.column_name}</TableCell>
              <TableCell>
                <span className="inline-flex items-center rounded bg-secondary px-2 py-0.5 text-xs">
                  {col.inferred_type || 'unknown'}
                </span>
              </TableCell>
              <TableCell>
                <span className={getNullPercentageColor(col.null_percentage)}>
                  {formatPercentage(col.null_percentage)}
                </span>
                <span className="text-muted-foreground text-xs ml-1">
                  ({formatNumber(col.null_count, 0)})
                </span>
              </TableCell>
              <TableCell>
                {formatNumber(col.distinct_count, 0)}
                <span className="text-muted-foreground text-xs ml-1">
                  ({formatPercentage(col.distinct_percentage)})
                </span>
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatNumber(col.min_value)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatNumber(col.max_value)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatNumber(col.mean_value)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExpandedRow(expandedRow === col.id ? null : col.id)
                    }
                  >
                    {expandedRow === col.id ? 'Less' : 'More'}
                  </Button>
                  {col.inferred_type === 'numeric' && onSelectColumn && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectColumn(col)}
                    >
                      Chart
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
            {expandedRow === col.id && (
              <TableRow key={`${col.id}-expanded`}>
                <TableCell colSpan={8} className="bg-muted/30">
                  <div className="grid grid-cols-2 gap-4 py-2 md:grid-cols-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Median
                      </p>
                      <p className="text-sm font-mono">
                        {formatNumber(col.median_value)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Std Dev
                      </p>
                      <p className="text-sm font-mono">
                        {formatNumber(col.std_dev)}
                      </p>
                    </div>
                    {col.top_values && col.top_values.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Top Values
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {col.top_values.slice(0, 3).map((tv, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded bg-secondary px-2 py-0.5 text-xs"
                            >
                              {tv.value}: {tv.percentage.toFixed(1)}%
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </>
        ))}
      </TableBody>
    </Table>
  );
}
