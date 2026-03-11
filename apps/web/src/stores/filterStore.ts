import { create } from 'zustand';
import type { HealthStatus } from '@/types';

interface StatusFilters {
  healthy: boolean;
  degraded: boolean;
  error: boolean;
}

interface FilterStore {
  searchText: string;
  statusFilters: StatusFilters;
  setSearchText: (text: string) => void;
  toggleStatusFilter: (status: HealthStatus) => void;
  clearFilters: () => void;
  reset: () => void;
}

const initialState = {
  searchText: '',
  statusFilters: { healthy: false, degraded: false, error: false } as StatusFilters,
};

export const useFilterStore = create<FilterStore>((set) => ({
  ...initialState,
  setSearchText: (searchText) => set({ searchText }),
  toggleStatusFilter: (status) =>
    set((state) => ({
      statusFilters: {
        ...state.statusFilters,
        [status]: !state.statusFilters[status],
      },
    })),
  clearFilters: () => set(initialState),
  reset: () => set(initialState),
}));

// Selectors
export const selectSearchText = (state: FilterStore) => state.searchText;
export const selectStatusFilters = (state: FilterStore) => state.statusFilters;
