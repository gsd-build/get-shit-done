'use client';

import { useState } from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import type { ManualTest } from '@/types/verification';

interface ManualTestItemProps {
  test: ManualTest;
  onUpdate: (passed: boolean | null, note?: string) => void;
}

/**
 * ManualTestItem - Single manual test with Radix checkbox and optional note.
 *
 * Per CONTEXT.md: Checkboxes with optional notes for manual test checklist.
 * Uses @radix-ui/react-checkbox for accessible checkbox component.
 */
export function ManualTestItem({ test, onUpdate }: ManualTestItemProps) {
  const [showNote, setShowNote] = useState(!!test.note);
  const [noteValue, setNoteValue] = useState(test.note || '');

  const handleCheckChange = (checked: boolean | 'indeterminate') => {
    if (checked === 'indeterminate') return;
    onUpdate(checked, noteValue || undefined);
  };

  const handleNoteBlur = () => {
    onUpdate(test.passed, noteValue || undefined);
  };

  return (
    <div className="flex items-start gap-3 border border-border rounded-lg p-3">
      <Checkbox.Root
        checked={test.passed === true}
        onCheckedChange={handleCheckChange}
        className="w-5 h-5 border border-border rounded flex items-center justify-center shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        aria-label={`Mark "${test.description}" as complete`}
      >
        <Checkbox.Indicator>
          <Check className="w-3.5 h-3.5 text-primary-foreground" />
        </Checkbox.Indicator>
      </Checkbox.Root>

      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground">{test.description}</span>

        {showNote || test.note ? (
          <textarea
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder="Add a note..."
            rows={2}
            className="mt-2 w-full px-2 py-1 text-sm border border-border rounded resize-none bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            + Add note
          </button>
        )}
      </div>
    </div>
  );
}
