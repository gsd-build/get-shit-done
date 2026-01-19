'use client';

import { useMemo } from 'react';
import { useDownstreamImpact } from '@/hooks/use-lineage';
import type { ImpactNode, NodeType } from '@/lib/lineage-types';
import { cn } from '@/lib/utils';

interface ImpactPanelProps {
  columnId: string;
  columnName: string;
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

// Depth badge
function DepthBadge({ depth }: { depth: number }) {
  if (depth === 0) return null;

  const label = depth === 1 ? 'Direct' : `${depth} hop${depth > 1 ? 's' : ''}`;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        depth === 1 && 'bg-blue-100 text-blue-800',
        depth === 2 && 'bg-purple-100 text-purple-800',
        depth >= 3 && 'bg-orange-100 text-orange-800'
      )}
    >
      {label}
    </span>
  );
}

// Group nodes by depth
function groupByDepth(nodes: ImpactNode[]): Map<number, ImpactNode[]> {
  const groups = new Map<number, ImpactNode[]>();

  for (const node of nodes) {
    if (!groups.has(node.depth)) {
      groups.set(node.depth, []);
    }
    groups.get(node.depth)!.push(node);
  }

  return groups;
}

export function ImpactPanel({
  columnId,
  columnName,
  onClose,
  onNodeClick,
  maxDepth = 10,
}: ImpactPanelProps) {
  const { data: impactNodes, isLoading, error } = useDownstreamImpact(columnId, { maxDepth });

  // Group by depth, excluding the starting node (depth 0)
  const groupedNodes = useMemo(() => {
    if (!impactNodes) return new Map<number, ImpactNode[]>();
    return groupByDepth(impactNodes.filter((n) => n.depth > 0));
  }, [impactNodes]);

  const totalAffected = impactNodes?.filter((n) => n.depth > 0).length || 0;

  return (
    <div className="h-full flex flex-col bg-white border-l shadow-lg w-80">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm">Downstream Impact</h3>
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

      {/* Summary */}
      <div className="px-4 py-3 border-b bg-blue-50">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
          <span className="text-sm font-medium text-blue-800">
            {totalAffected} downstream {totalAffected === 1 ? 'dependency' : 'dependencies'}
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
            Failed to load impact analysis
          </div>
        ) : totalAffected === 0 ? (
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
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <p>No downstream dependencies</p>
            <p className="text-xs mt-1">This column is a leaf node in the lineage graph</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {Array.from(groupedNodes.entries())
              .sort(([a], [b]) => a - b)
              .map(([depth, nodes]) => (
                <div key={depth}>
                  <div className="flex items-center gap-2 mb-2">
                    <DepthBadge depth={depth} />
                    <span className="text-xs text-gray-500">
                      {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {nodes.map((node) => (
                      <button
                        key={node.id}
                        onClick={() => onNodeClick?.(node.id)}
                        className="w-full text-left p-2 rounded hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <NodeIcon type={node.node_type} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{node.name}</p>
                            <p className="text-xs text-gray-500 truncate">{node.namespace}</p>
                          </div>
                        </div>
                        {node.transformation && (
                          <p className="mt-1 text-xs text-gray-600 pl-6">
                            via {node.transformation}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-500">
        Max depth: {maxDepth} hops
      </div>
    </div>
  );
}

export default ImpactPanel;
