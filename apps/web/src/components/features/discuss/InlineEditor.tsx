/**
 * InlineEditor - Contenteditable wrapper for inline editing of decision text
 *
 * Uses react-contenteditable for controlled contentEditable elements.
 * Preserves cursor position across React renders and tracks original value
 * for change detection on blur.
 */

'use client';

import ContentEditable, { type ContentEditableEvent } from 'react-contenteditable';
import { useRef, useCallback, KeyboardEvent } from 'react';
import clsx from 'clsx';

interface InlineEditorProps {
  /** Current value to display */
  value: string;
  /** Called on blur when value has changed */
  onChange: (newValue: string, oldValue: string) => void;
  /** Called when editing begins (focus) */
  onEditStart?: () => void;
  /** Disable editing */
  disabled?: boolean;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Additional className */
  className?: string;
}

/**
 * Sanitize HTML to plain text (strip tags) for storage
 */
function htmlToPlainText(html: string): string {
  // Create a temporary div to parse HTML
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Escape plain text for safe HTML display
 */
function plainTextToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

export function InlineEditor({
  value,
  onChange,
  onEditStart,
  disabled = false,
  placeholder = 'Click to edit...',
  className,
}: InlineEditorProps) {
  // Track the current content as HTML
  const contentRef = useRef(plainTextToHtml(value));
  // Track the original value when editing started (for change detection)
  const originalRef = useRef(value);

  // Handle content changes during typing
  const handleChange = useCallback((evt: ContentEditableEvent) => {
    contentRef.current = evt.target.value;
  }, []);

  // Handle focus - record original value and notify parent
  const handleFocus = useCallback(() => {
    originalRef.current = value;
    onEditStart?.();
  }, [value, onEditStart]);

  // Handle blur - check for changes and notify parent
  const handleBlur = useCallback(() => {
    const newText = htmlToPlainText(contentRef.current);
    const oldText = originalRef.current;

    if (newText !== oldText) {
      onChange(newText, oldText);
    }
    // Update refs to match new state
    originalRef.current = newText;
  }, [onChange]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (evt: KeyboardEvent<HTMLDivElement>) => {
      // Escape key: revert to original value and blur
      if (evt.key === 'Escape') {
        evt.preventDefault();
        contentRef.current = plainTextToHtml(originalRef.current);
        // Blur the element (lose focus)
        (evt.target as HTMLElement).blur();
      }

      // Enter key (without Shift): confirm edit by blurring
      if (evt.key === 'Enter' && !evt.shiftKey) {
        evt.preventDefault();
        (evt.target as HTMLElement).blur();
      }
    },
    []
  );

  // Keep contentRef in sync when value prop changes (e.g., from conflict resolution)
  // Only update if we're not currently editing (to avoid overwriting user input)
  if (!document.activeElement?.closest('[contenteditable="true"]')) {
    contentRef.current = plainTextToHtml(value);
  }

  return (
    <ContentEditable
      html={contentRef.current}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={clsx(
        'outline-none rounded px-1 -mx-1 py-0.5 -my-0.5',
        'transition-colors duration-150',
        // Focus ring
        'focus:ring-2 focus:ring-primary/50 focus:bg-muted/50',
        // Disabled state
        disabled && 'text-muted-foreground cursor-not-allowed',
        // Hover state when editable
        !disabled && 'hover:bg-muted/30 cursor-text',
        // Empty placeholder styling
        !value && 'text-muted-foreground italic',
        className
      )}
      data-placeholder={placeholder}
    />
  );
}
