'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';

interface StreamingMessageProps {
  /** Currently displayed text with typewriter effect */
  displayedText: string;
  /** Whether still receiving tokens */
  isStreaming: boolean;
}

/**
 * Streaming message bubble for assistant responses.
 *
 * Displays text with a blinking cursor at the end while streaming.
 * Uses assistant (left-aligned, muted) styling.
 */
export const StreamingMessage = memo(function StreamingMessage({
  displayedText,
  isStreaming,
}: StreamingMessageProps) {
  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-muted text-foreground">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {displayedText}
          </ReactMarkdown>
          {isStreaming && (
            <span
              className={clsx(
                'inline-block w-2 h-4 bg-foreground ml-0.5 -mb-0.5',
                'animate-pulse'
              )}
              aria-label="Typing cursor"
            />
          )}
        </div>
      </div>
    </div>
  );
});
