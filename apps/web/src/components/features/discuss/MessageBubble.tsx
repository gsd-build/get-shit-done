'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';
import type { MessageRole } from '@/stores/discussStore';

interface MessageBubbleProps {
  /** Message role determines alignment and styling */
  role: MessageRole;
  /** Message content (supports markdown) */
  content: string;
  /** Optional timestamp for display */
  timestamp?: string;
}

/**
 * Chat message bubble with role-based styling.
 *
 * - User messages: right-aligned, blue/primary background
 * - Assistant messages: left-aligned, gray/muted background
 * - System messages: centered, yellow background, italic
 *
 * Renders markdown content with GFM support.
 */
export const MessageBubble = memo(function MessageBubble({
  role,
  content,
  timestamp,
}: MessageBubbleProps) {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  return (
    <div
      className={clsx(
        'flex w-full',
        isUser && 'justify-end',
        isSystem && 'justify-center',
        !isUser && !isSystem && 'justify-start'
      )}
    >
      <div
        className={clsx(
          'max-w-[80%] rounded-2xl px-4 py-3',
          isUser && 'bg-primary text-primary-foreground',
          isSystem && 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 italic',
          !isUser && !isSystem && 'bg-muted text-foreground'
        )}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
        {timestamp && (
          <div
            className={clsx(
              'text-xs mt-1 opacity-60',
              isUser && 'text-primary-foreground',
              isSystem && 'text-yellow-700 dark:text-yellow-300',
              !isUser && !isSystem && 'text-muted-foreground'
            )}
          >
            {new Date(timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
});
