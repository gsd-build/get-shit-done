'use client';

import { useState, useCallback } from 'react';
import clsx from 'clsx';
import { GitCompare, Columns, Rows } from 'lucide-react';
import { useExecutionStore, selectSelectedFile } from '@/stores/executionStore';
import { DiffEditor } from './DiffEditor';
import { FileTree, type FileItem } from './FileTree';

export interface DiffPanelProps {
  /** Modified files for the file tree */
  files?: FileItem[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * DiffPanel component for viewing file changes.
 *
 * Features:
 * - Monaco DiffEditor for syntax-highlighted diffs
 * - Toggle between unified and side-by-side views (default: unified per CONTEXT.md)
 * - FileTree for navigating modified files
 * - Shows file path in header
 * - Empty state when no file selected
 */
export function DiffPanel({ files = [], className = '' }: DiffPanelProps) {
  const selectedFile = useExecutionStore(selectSelectedFile);
  const selectFile = useExecutionStore((state) => state.selectFile);

  // Default to unified view per CONTEXT.md
  const [sideBySide, setSideBySide] = useState(false);

  const handleToggleView = useCallback(() => {
    setSideBySide((prev) => !prev);
  }, []);

  const handleFileSelect = useCallback(
    (path: string) => {
      // Find the file in the files array
      const file = files.find((f) => f.path === path);
      if (file) {
        // For now, set empty original/modified - would be populated by actual file content
        selectFile({
          path,
          original: '',
          modified: '',
        });
      }
    },
    [files, selectFile]
  );

  // Empty state when no file is selected
  if (!selectedFile) {
    return (
      <div
        data-testid="diff-panel-empty"
        className={clsx(
          'flex flex-col items-center justify-center h-full',
          'text-zinc-500 dark:text-zinc-400',
          className
        )}
      >
        <GitCompare className="w-12 h-12 mb-4 text-zinc-400" />
        <p className="text-lg font-medium">No file selected</p>
        <p className="text-sm mt-2">Select a file from a tool card to view changes</p>
      </div>
    );
  }

  return (
    <div
      data-testid="diff-panel"
      className={clsx('flex flex-col h-full', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-zinc-500" />
          <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
            {selectedFile.path}
          </span>
        </div>
        <button
          type="button"
          onClick={handleToggleView}
          className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm',
            'border border-zinc-200 dark:border-zinc-700',
            'hover:bg-zinc-100 dark:hover:bg-zinc-800',
            'focus:outline-none focus:ring-2 focus:ring-blue-500'
          )}
          aria-label={sideBySide ? 'Side-by-side' : 'Unified'}
        >
          {sideBySide ? (
            <>
              <Columns className="w-4 h-4" />
              <span>Side-by-side</span>
            </>
          ) : (
            <>
              <Rows className="w-4 h-4" />
              <span>Unified</span>
            </>
          )}
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* File tree sidebar (if files provided) */}
        {files.length > 0 && (
          <div className="w-64 border-r border-zinc-200 dark:border-zinc-700 overflow-y-auto">
            <FileTree
              files={files}
              onSelect={handleFileSelect}
              selectedPath={selectedFile.path}
            />
          </div>
        )}

        {/* Diff editor */}
        <div className="flex-1 p-4 overflow-hidden">
          <DiffEditor
            original={selectedFile.original}
            modified={selectedFile.modified}
            filePath={selectedFile.path}
            sideBySide={sideBySide}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}

export default DiffPanel;
