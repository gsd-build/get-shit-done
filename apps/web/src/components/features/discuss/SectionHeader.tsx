/**
 * SectionHeader - Collapsible section header with bulk lock/unlock
 */

'use client';

import { ChevronRight, Lock, LockOpen } from 'lucide-react';
import clsx from 'clsx';

interface SectionHeaderProps {
  title: string;
  section: 'decisions' | 'specifics' | 'deferred';
  count: number;
  expanded: boolean;
  hasLockedItems: boolean;
  onToggle: () => void;
  onBulkLock: (section: 'decisions' | 'specifics' | 'deferred', locked: boolean) => void;
}

export function SectionHeader({
  title,
  section,
  count,
  expanded,
  hasLockedItems,
  onToggle,
  onBulkLock,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md">
      {/* Collapsible trigger */}
      <button
        type="button"
        onClick={onToggle}
        className={clsx(
          'flex items-center gap-2 flex-1',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded'
        )}
        aria-expanded={expanded}
      >
        <ChevronRight
          className={clsx(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-90'
          )}
        />
        <span className="font-medium text-sm">{title}</span>
        <span className="text-xs text-muted-foreground ml-2">
          {count} {count === 1 ? 'decision' : 'decisions'}
        </span>
      </button>

      {/* Bulk lock/unlock button */}
      {count > 0 && (
        <button
          type="button"
          onClick={() => onBulkLock(section, !hasLockedItems)}
          className={clsx(
            'flex items-center gap-1.5 px-2 py-1 rounded text-xs',
            'hover:bg-muted transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            hasLockedItems
              ? 'text-primary'
              : 'text-muted-foreground'
          )}
          title={hasLockedItems ? 'Unlock all' : 'Lock all'}
        >
          {hasLockedItems ? (
            <>
              <LockOpen className="h-3 w-3" />
              <span>Unlock all</span>
            </>
          ) : (
            <>
              <Lock className="h-3 w-3" />
              <span>Lock all</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
