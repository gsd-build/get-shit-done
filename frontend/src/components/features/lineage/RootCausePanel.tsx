'use client';

import { useMemo } from 'react';
import { useUpstreamSources } from '@/hooks/use-lineage';
import type { ImpactNode, NodeType } from '@/lib/lineage-types';
import { cn } from '@/lib/utils';

interface RootCausePanelProps {
  columnId: string;
  columnName: string;
  qualityIssue?: {
    title: string;
    severity: 'critical' | 'warning' | 'info';
    description?: string;
  };
  onClose: () => void;
  onNodeClick?: (nodeId: string) => void;
  maxDepth?: number;
}

// Icon by node type
function NodeIcon({ type }: { type: NodeType }) {
  if (type === 'dataset') {
    return (
      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 11h16" />
      </svg>
    );
  }

  return (
    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
      />
    </svg>
  );
}

// Root cause indicator - furthest upstream nodes
function RootCauseIndicator() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      Likely Root Cause
    </span>
  );
}

// Severity badge for quality issue
function SeverityBadge({ severity }: { severity: 'critical' | 'warning' | 'info' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        severity === 'critical' && 'bg-red-100 text-red-800',
        severity === 'warning' && 'bg-yellow-100 text-yellow-800',
        severity === 'info' && 'bg-blue-100 text-blue-800'
      )}
    >
      {severity}
    </span>
  );
}

// Group and sort nodes - sources first (highest depth first)
function sortByDepthDesc(nodes: ImpactNode[]): ImpactNode[] {
  return [...nodes].sort((a, b) => b.depth - a.depth);
}

export function RootCausePanel({
  columnId,
  columnName,
  qualityIssue,
  onClose,
  onNodeClick,
  maxDepth = 10,
}: RootCausePanelProps) {
  const { data: upstreamNodes, isLoading, error } = useUpstreamSources(columnId, { maxDepth });

  // Sort by depth (furthest sources first) and identify root causes
  const { sortedNodes, maxNodeDepth } = useMemo(() => {
    if (!upstreamNodes) return { sortedNodes: [], maxNodeDepth: 0 };
    const filtered = upstreamNodes.filter((n) => n.depth > 0);
    const sorted = sortByDepthDesc(filtered);
    const max = sorted.length > 0 ? sorted[0].depth : 0;
    return { sortedNodes: sorted, maxNodeDepth: max };
  }, [upstreamNodes]);

  const totalSources = sortedNodes.length;

  return (
    <div className="h-full flex flex-col bg-white border-l shadow-lg w-80">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm">Root Cause Analysis</h3>
          <p className="text-xs text-gray-500 truncate" title={columnName}>
            {columnName}
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1 hover:bg-gray-200 rounded"
          aria-label="Close panel"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Quality Issue Context (if provided) */}
      {qualityIssue && (
        <div className="px-4 py-3 border-b bg-red-50">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-red-800">{qualityIssue.title}</span>
                <SeverityBadge severity={qualityIssue.severity} />
              </div>
              {qualityIssue.description && (
                <p className="text-xs text-red-700 mt-1">{qualityIssue.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="px-4 py-3 border-b bg-orange-50">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <span className="text-sm font-medium text-orange-800">
            {totalSources} upstream {totalSources === 1 ? 'source' : 'sources'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-600 text-sm">
            Failed to load root cause analysis
          </div>
        ) : totalSources === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <svg
              className="w-12 h-12 mx-auto mb-2 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <p>No upstream sources</p>
            <p className="text-xs mt-1">This column is a root source in the lineage graph</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {sortedNodes.map((node) => {
              const isRootCause = node.depth === maxNodeDepth;

              return (
                <button
                  key={node.id}
                  onClick={() => onNodeClick?.(node.id)}
                  className={cn(
                    'w-full text-left p-3 rounded border transition-colors',
                    isRootCause
                      ? 'bg-red-50 border-red-200 hover:bg-red-100'
                      : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <NodeIcon type={node.node_type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{node.name}</span>
                        {isRootCause && <RootCauseIndicator />}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{node.namespace}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">
                          {node.depth} hop{node.depth > 1 ? 's' : ''} upstream
                        </span>
                        {node.transformation && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span className="text-xs text-gray-600">{node.transformation}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Max depth: {maxDepth} hops</span>
          {maxNodeDepth > 0 && (
            <span>Deepest source: {maxNodeDepth} hops</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default RootCausePanel;
