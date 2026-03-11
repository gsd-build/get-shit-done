'use client';

import { useEffect } from 'react';

/**
 * Hook to warn users when leaving the page with unsaved changes.
 *
 * Shows the browser's default "Changes you made may not be saved" dialog
 * when the user attempts to close or navigate away from the page.
 *
 * @param hasUnsavedChanges - Whether there are unsaved changes to protect
 */
export function useUnsavedChanges(hasUnsavedChanges: boolean): void {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Modern browsers require returnValue to be set
      event.preventDefault();
      // Chrome requires returnValue to be set (deprecated but still needed)
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
}
