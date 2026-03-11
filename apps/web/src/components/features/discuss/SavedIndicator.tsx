'use client';

import { memo, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import clsx from 'clsx';

interface SavedIndicatorProps {
  /** Whether to show the indicator */
  show: boolean;
}

/**
 * Subtle "Saved" indicator that appears briefly after state persists.
 *
 * - Animated fade in/out with 300ms transition
 * - Auto-hides after 2 seconds when shown
 * - Small, non-intrusive inline or corner positioning
 */
export const SavedIndicator = memo(function SavedIndicator({
  show,
}: SavedIndicatorProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1 text-xs text-muted-foreground transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0'
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      <Check className="w-3 h-3 text-green-500" />
      <span>Saved</span>
    </div>
  );
});
