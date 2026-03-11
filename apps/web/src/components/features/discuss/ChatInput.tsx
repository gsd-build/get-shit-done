'use client';

import { useState, useCallback, type KeyboardEvent, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import clsx from 'clsx';

interface ChatInputProps {
  /** Called when user submits a message */
  onSend: (message: string) => void;
  /** Disable input during streaming */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Fixed bottom chat input with send button.
 *
 * - Sticky at viewport bottom
 * - Enter to send, Shift+Enter for newline
 * - Disabled while streaming
 */
export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Type your message...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const trimmed = message.trim();
      if (trimmed && !disabled) {
        onSend(trimmed);
        setMessage('');
      }
    },
    [message, disabled, onSend]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="sticky bottom-0 bg-background border-t border-border p-4">
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={clsx(
            'flex-1 resize-none rounded-lg border border-border bg-background px-4 py-3',
            'text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'min-h-[48px] max-h-[200px]'
          )}
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className={clsx(
            'flex items-center justify-center w-12 h-12 rounded-lg',
            'bg-primary text-primary-foreground',
            'hover:bg-primary/90 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
