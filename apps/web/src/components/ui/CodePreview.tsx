'use client';

import { useState, useMemo } from 'react';
import clsx from 'clsx';

export interface CodePreviewProps {
  /** The code content to display */
  content: string;
  /** Programming language for syntax hints */
  language?: string;
  /** Maximum lines to show before truncating (default: 10) */
  maxLines?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get language from file extension for display
 */
export function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    py: 'python',
    rs: 'rust',
    go: 'go',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
  };
  return langMap[ext || ''] || 'plaintext';
}

/**
 * CodePreview component for displaying syntax-highlighted code with truncation
 *
 * Uses a simple pre/code display with optional truncation and "show more" expansion.
 */
export function CodePreview({
  content,
  language = 'plaintext',
  maxLines = 10,
  className,
}: CodePreviewProps) {
  const [expanded, setExpanded] = useState(false);

  const lines = useMemo(() => content.split('\n'), [content]);
  const needsTruncation = lines.length > maxLines;
  const displayContent = useMemo(() => {
    if (!needsTruncation || expanded) {
      return content;
    }
    return lines.slice(0, maxLines).join('\n');
  }, [content, lines, maxLines, needsTruncation, expanded]);

  return (
    <div
      data-testid="code-preview"
      className={clsx(
        'relative rounded-md bg-zinc-900 text-zinc-100 text-sm font-mono',
        className
      )}
    >
      {language !== 'plaintext' && (
        <div className="absolute top-2 right-2 text-xs text-zinc-500">
          {language}
        </div>
      )}
      <pre className="overflow-x-auto p-4 whitespace-pre-wrap break-words">
        <code>{displayContent}</code>
      </pre>
      {needsTruncation && (
        <div className="border-t border-zinc-700 p-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-400 hover:text-blue-300 focus:outline-none focus:underline"
          >
            {expanded ? 'Show less' : `Show more (${lines.length - maxLines} more lines)`}
          </button>
        </div>
      )}
    </div>
  );
}

export default CodePreview;
