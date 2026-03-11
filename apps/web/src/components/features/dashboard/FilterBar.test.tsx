import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';
import { useFilterStore } from '@/stores/filterStore';

describe('FilterBar', () => {
  beforeEach(() => {
    cleanup();
    useFilterStore.getState().reset();
  });

  it('renders filter chips for each status', () => {
    render(<FilterBar />);
    expect(screen.getByRole('button', { name: /healthy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /degraded/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /error/i })).toBeInTheDocument();
  });

  it('toggles filter when chip clicked', async () => {
    render(<FilterBar />);
    await userEvent.click(screen.getByRole('button', { name: /healthy/i }));
    expect(useFilterStore.getState().statusFilters.healthy).toBe(true);
  });

  it('shows clear all button when filters active', () => {
    useFilterStore.getState().toggleStatusFilter('healthy');
    render(<FilterBar />);
    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
  });

  it('hides clear all button when no filters active', () => {
    render(<FilterBar />);
    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
  });

  it('clears all filters when clear button clicked', async () => {
    useFilterStore.getState().setSearchText('test');
    useFilterStore.getState().toggleStatusFilter('healthy');
    render(<FilterBar />);
    await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(useFilterStore.getState().searchText).toBe('');
    expect(useFilterStore.getState().statusFilters.healthy).toBe(false);
  });

  it('shows active state on selected chips', async () => {
    render(<FilterBar />);
    const healthyChip = screen.getByRole('button', { name: /healthy/i });
    expect(healthyChip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(healthyChip);
    expect(healthyChip).toHaveAttribute('aria-pressed', 'true');
  });
});
