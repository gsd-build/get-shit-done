'use client';

import { useMemo } from 'react';
import { DiffEditor as MonacoDiffEditor } from '@monaco-editor/react';
import { useTheme } from 'next-themes';

export interface DiffEditorProps {
  /** Original file content (before changes) */
  original: string;
  /** Modified file content (after changes) */
  modified: string;
  /** File path for language detection */
  filePath: string;
  /** Side-by-side view (true) or inline/unified view (false) */
  sideBySide?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Language mapping from file extensions to Monaco language IDs
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  md: 'markdown',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  sql: 'sql',
  graphql: 'graphql',
  vue: 'vue',
  svelte: 'svelte',
};

/**
 * Get Monaco language from file path
 */
function getLanguageFromFilePath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_TO_LANGUAGE[extension] || 'plaintext';
}

/**
 * Monaco DiffEditor wrapper with theme sync and language detection.
 *
 * Features:
 * - Auto-detects language from file extension
 * - Syncs theme with app dark/light mode via next-themes
 * - Supports unified (inline) and side-by-side diff views
 * - Read-only mode for viewing changes
 */
export function DiffEditor({
  original,
  modified,
  filePath,
  sideBySide = false,
  className = '',
}: DiffEditorProps) {
  const { resolvedTheme } = useTheme();

  // Determine Monaco theme based on app theme
  const monacoTheme = resolvedTheme === 'dark' ? 'vs-dark' : 'light';

  // Detect language from file path
  const language = useMemo(() => getLanguageFromFilePath(filePath), [filePath]);

  return (
    <div
      data-testid="diff-editor-container"
      className={`h-[400px] border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden ${className}`}
    >
      <MonacoDiffEditor
        original={original}
        modified={modified}
        language={language}
        theme={monacoTheme}
        options={{
          readOnly: true,
          renderSideBySide: sideBySide,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          fontSize: 13,
          lineNumbers: 'on',
          folding: true,
          contextmenu: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
}

export default DiffEditor;
