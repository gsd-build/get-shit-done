/**
 * DecisionItem - Individual decision with lock toggle and highlight animation
 */

'use client';

import { Lock, LockOpen } from 'lucide-react';
import clsx from 'clsx';
import type { Decision } from '@/lib/contextParser';
import { useContextStore } from '@/stores/contextStore';
import { useCallback } from 'react';

interface DecisionItemProps {
  decision: Decision;
  onToggleLock: (id: string) => void;
}

export function DecisionItem({ decision, onToggleLock }: DecisionItemProps) {
  const clearNewFlags = useContextStore(state => state.clearNewFlags);

  const handleAnimationEnd = useCallback(() => {
    // Clear the isNew flag after highlight animation completes
    if (decision.isNew) {
      clearNewFlags();
    }
  }, [decision.isNew, clearNewFlags]);

  const handleToggle = useCallback(() => {
    onToggleLock(decision.id);
  }, [decision.id, onToggleLock]);

  return (
    <div
      className={clsx(
        'group flex items-start gap-3 py-2 px-3 rounded-md',
        'hover:bg-muted/30 transition-colors',
        decision.isNew && 'animate-highlight'
      )}
      onAnimationEnd={handleAnimationEnd}
    >
      {/* Lock toggle button */}
      <button
        type="button"
        onClick={handleToggle}
        className={clsx(
          'flex-shrink-0 p-1 rounded transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          decision.locked
            ? 'text-primary hover:text-primary/80'
            : 'text-muted-foreground hover:text-foreground'
        )}
        title={decision.locked ? 'Unlock decision' : 'Lock decision'}
        aria-label={decision.locked ? 'Unlock decision' : 'Lock decision'}
      >
        {decision.locked ? (
          <Lock className="h-4 w-4" aria-hidden="true" />
        ) : (
          <LockOpen className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {/* Decision content */}
      <span
        className={clsx(
          'flex-1 text-sm leading-relaxed',
          decision.locked ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {decision.content}
      </span>
    </div>
  );
}
