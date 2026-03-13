'use client';

import { useState, useMemo, useCallback } from 'react';
import clsx from 'clsx';
import { ChevronRight, FolderOpen, Folder, FileCode } from 'lucide-react';

export interface FileItem {
  path: string;
  status: 'added' | 'modified' | 'deleted';
}

export interface FileTreeProps {
  /** Array of file items with path and status */
  files: FileItem[];
  /** Callback when a file is selected */
  onSelect: (path: string) => void;
  /** Currently selected file path */
  selectedPath?: string;
  /** Additional CSS classes */
  className?: string;
}

interface TreeNode {
  name: string;
  fullPath: string;
  type: 'directory' | 'file';
  status?: 'added' | 'modified' | 'deleted';
  children?: TreeNode[];
}

/**
 * Status indicator component
 */
function StatusIndicator({ status }: { status: FileItem['status'] }) {
  switch (status) {
    case 'added':
      return (
        <span
          data-testid="status-added"
          className="text-green-500 font-bold ml-auto"
        >
          +
        </span>
      );
    case 'modified':
      return (
        <span
          data-testid="status-modified"
          className="text-yellow-500 font-bold ml-auto"
        >
          ~
        </span>
      );
    case 'deleted':
      return (
        <span
          data-testid="status-deleted"
          className="text-red-500 font-bold ml-auto"
        >
          -
        </span>
      );
    default:
      return null;
  }
}

/**
 * Build tree structure from flat file paths
 */
function buildTree(files: FileItem[]): TreeNode[] {
  const root: TreeNode[] = [];

  // Group files by directory
  const dirMap = new Map<string, FileItem[]>();
  const rootFiles: FileItem[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    if (parts.length === 1) {
      // Root level file
      rootFiles.push(file);
    } else {
      // Group by directory path
      const dirPath = parts.slice(0, -1).join('/');
      if (!dirMap.has(dirPath)) {
        dirMap.set(dirPath, []);
      }
      dirMap.get(dirPath)!.push(file);
    }
  }

  // Add directories
  for (const [dirPath, dirFiles] of dirMap) {
    const children: TreeNode[] = dirFiles.map((f) => ({
      name: f.path.split('/').pop()!,
      fullPath: f.path,
      type: 'file' as const,
      status: f.status,
    }));

    root.push({
      name: dirPath,
      fullPath: dirPath,
      type: 'directory',
      children,
    });
  }

  // Add root files
  for (const file of rootFiles) {
    root.push({
      name: file.path,
      fullPath: file.path,
      type: 'file',
      status: file.status,
    });
  }

  // Sort: directories first, then files
  root.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return root;
}

/**
 * Tree node component (recursive)
 */
function TreeNodeComponent({
  node,
  onSelect,
  selectedPath,
  level = 0,
}: {
  node: TreeNode;
  onSelect: (path: string) => void;
  selectedPath?: string;
  level?: number;
}) {
  const [expanded, setExpanded] = useState(true);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleSelect = useCallback(() => {
    if (node.type === 'file') {
      onSelect(node.fullPath);
    }
  }, [node.type, node.fullPath, onSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (node.type === 'directory') {
          handleToggle();
        } else {
          handleSelect();
        }
      }
    },
    [node.type, handleToggle, handleSelect]
  );

  const isSelected = node.type === 'file' && selectedPath === node.fullPath;
  const indent = level * 16;

  if (node.type === 'directory') {
    return (
      <div data-testid={`directory-${node.fullPath}`}>
        <button
          type="button"
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          aria-label={node.name}
          className={clsx(
            'w-full flex items-center gap-2 px-2 py-1 text-left text-sm',
            'hover:bg-zinc-100 dark:hover:bg-zinc-800',
            'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500'
          )}
          style={{ paddingLeft: `${indent + 8}px` }}
        >
          <ChevronRight
            className={clsx(
              'w-4 h-4 text-zinc-400 transition-transform',
              expanded && 'rotate-90'
            )}
          />
          {expanded ? (
            <FolderOpen className="w-4 h-4 text-yellow-500" />
          ) : (
            <Folder className="w-4 h-4 text-yellow-500" />
          )}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {node.name}
          </span>
        </button>
        {expanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNodeComponent
                key={child.fullPath}
                node={child}
                onSelect={onSelect}
                {...(selectedPath && { selectedPath })}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File node
  return (
    <button
      type="button"
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      data-testid={`file-${node.fullPath}`}
      data-selected={isSelected}
      className={clsx(
        'w-full flex items-center gap-2 px-2 py-1 text-left text-sm',
        'hover:bg-zinc-100 dark:hover:bg-zinc-800',
        'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500',
        isSelected && 'bg-blue-100 dark:bg-blue-900/30'
      )}
      style={{ paddingLeft: `${indent + 8}px` }}
    >
      <FileCode className="w-4 h-4 text-zinc-400" />
      <span
        className={clsx(
          'flex-1 font-mono',
          isSelected
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-zinc-600 dark:text-zinc-400'
        )}
      >
        {node.name}
      </span>
      {node.status && <StatusIndicator status={node.status} />}
    </button>
  );
}

/**
 * FileTree component for displaying modified files grouped by directory.
 *
 * Features:
 * - Groups files by directory
 * - Expandable/collapsible directories
 * - Status indicators (green +, yellow ~, red -)
 * - Keyboard navigation support
 * - Highlights selected file
 */
export function FileTree({
  files,
  onSelect,
  selectedPath,
  className = '',
}: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);

  if (files.length === 0) {
    return (
      <div
        className={clsx(
          'text-sm text-zinc-500 dark:text-zinc-400 p-4 text-center',
          className
        )}
      >
        No files changed
      </div>
    );
  }

  return (
    <div
      data-testid="file-tree"
      className={clsx(
        'border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden',
        className
      )}
    >
      {tree.map((node) => (
        <TreeNodeComponent
          key={node.fullPath}
          node={node}
          onSelect={onSelect}
          {...(selectedPath && { selectedPath })}
        />
      ))}
    </div>
  );
}

export default FileTree;
