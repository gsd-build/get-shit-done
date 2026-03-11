'use client';

import { memo } from 'react';

/**
 * Typing indicator with three animated bouncing dots.
 *
 * Shown while waiting for Claude's first token (isStreaming && displayedText === '').
 */
export const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div className="flex w-full justify-start">
      <div className="rounded-2xl px-4 py-3 bg-muted">
        <div className="flex gap-1 items-center h-4">
          <span
            className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
});
