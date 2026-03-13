'use client';

import { FilterChip } from '@/components/ui/FilterChip';
import { useFilterStore, selectStatusFilters, selectSearchText } from '@/stores/filterStore';
import type { HealthStatus } from '@/types';

const statusLabels: Record<HealthStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  error: 'Error',
};

export function FilterBar() {
  const statusFilters = useFilterStore(selectStatusFilters);
  const searchText = useFilterStore(selectSearchText);
  const toggleStatusFilter = useFilterStore((s) => s.toggleStatusFilter);
  const clearFilters = useFilterStore((s) => s.clearFilters);

  const hasActiveFilters = searchText || Object.values(statusFilters).some(Boolean);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {(Object.entries(statusFilters) as [HealthStatus, boolean][]).map(([status, active]) => (
        <FilterChip
          key={status}
          label={statusLabels[status]}
          active={active}
          onClick={() => toggleStatusFilter(status)}
        />
      ))}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="text-sm min-h-11 px-2 rounded-md text-muted-foreground hover:text-foreground underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
