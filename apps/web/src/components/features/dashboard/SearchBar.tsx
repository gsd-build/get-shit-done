'use client';

import { Search } from 'lucide-react';
import { useFilterStore, selectSearchText } from '@/stores/filterStore';

export function SearchBar() {
  const searchText = useFilterStore(selectSearchText);
  const setSearchText = useFilterStore((s) => s.setSearchText);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Search projects..."
        className="w-full min-h-11 pl-10 pr-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
