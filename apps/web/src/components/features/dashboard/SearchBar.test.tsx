import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from './SearchBar';
import { useFilterStore } from '@/stores/filterStore';

describe('SearchBar', () => {
  beforeEach(() => {
    cleanup();
    useFilterStore.getState().reset();
  });

  it('renders search input', () => {
    render(<SearchBar />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('updates filter store on input', async () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText(/search/i);
    await userEvent.type(input, 'dashboard');
    expect(useFilterStore.getState().searchText).toBe('dashboard');
  });

  it('shows current search value from store', () => {
    useFilterStore.getState().setSearchText('existing');
    render(<SearchBar />);
    expect(screen.getByDisplayValue('existing')).toBeInTheDocument();
  });

  it('has search icon', () => {
    render(<SearchBar />);
    // Lucide Search icon renders as svg
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
