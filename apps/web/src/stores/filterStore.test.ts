import { describe, it, expect, beforeEach } from 'vitest';
import { useFilterStore } from './filterStore';

describe('filterStore', () => {
  beforeEach(() => {
    useFilterStore.getState().reset();
  });

  it('starts with empty search text', () => {
    expect(useFilterStore.getState().searchText).toBe('');
  });

  it('starts with no status filters active', () => {
    const { statusFilters } = useFilterStore.getState();
    expect(statusFilters.healthy).toBe(false);
    expect(statusFilters.degraded).toBe(false);
    expect(statusFilters.error).toBe(false);
  });

  it('setSearchText updates search text', () => {
    useFilterStore.getState().setSearchText('dashboard');
    expect(useFilterStore.getState().searchText).toBe('dashboard');
  });

  it('toggleStatusFilter toggles a status filter', () => {
    useFilterStore.getState().toggleStatusFilter('healthy');
    expect(useFilterStore.getState().statusFilters.healthy).toBe(true);
    useFilterStore.getState().toggleStatusFilter('healthy');
    expect(useFilterStore.getState().statusFilters.healthy).toBe(false);
  });

  it('clearFilters resets all filters', () => {
    useFilterStore.getState().setSearchText('test');
    useFilterStore.getState().toggleStatusFilter('healthy');
    useFilterStore.getState().clearFilters();
    expect(useFilterStore.getState().searchText).toBe('');
    expect(useFilterStore.getState().statusFilters.healthy).toBe(false);
  });
});
