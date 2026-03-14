'use client';

import { useMemo, useState } from 'react';
import type { ParallelismWorkflowNode } from '@/types/plan';

interface ParallelismWorkflowGraphProps {
  nodes: ParallelismWorkflowNode[];
}

const STATUS_BADGE_CLASS: Record<ParallelismWorkflowNode['status'], string> = {
  assessed: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-300',
  runnable: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  complete: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

export function ParallelismWorkflowGraph({ nodes }: ParallelismWorkflowGraphProps) {
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  const waves = useMemo(() => {
    const map = new Map<number, ParallelismWorkflowNode[]>();
    for (const node of nodes) {
      if (!map.has(node.wave)) {
        map.set(node.wave, []);
      }
      map.get(node.wave)!.push(node);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        No workflow graph data available yet.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="parallelism-workflow-graph">
      {waves.map(([wave, waveNodes]) => (
        <section key={wave} className="rounded-md border border-border p-3">
          <h3 className="text-sm font-semibold mb-2">Wave {wave}</h3>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {waveNodes.map((node) => {
              const hasBlockers = (node.blockerDetails?.length ?? 0) > 0;
              return (
                <article
                  key={node.id}
                  className="rounded-md border border-border bg-card px-3 py-2"
                  data-testid={`workflow-node-${node.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">{node.label}</h4>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide ${STATUS_BADGE_CLASS[node.status]}`}
                    >
                      {node.status}
                    </span>
                  </div>
                  {node.dependsOn.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Depends on: {node.dependsOn.join(', ')}
                    </p>
                  )}
                  {hasBlockers && (
                    <div className="mt-2">
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() =>
                          setExpandedNodeId((current) =>
                            current === node.id ? null : node.id
                          )
                        }
                      >
                        {expandedNodeId === node.id ? 'Hide blocker details' : 'Show blocker details'}
                      </button>

                      {expandedNodeId === node.id && (
                        <ul className="mt-2 list-disc list-inside text-xs text-muted-foreground space-y-1">
                          {node.blockerDetails?.map((blocker) => (
                            <li key={blocker.id}>
                              {blocker.reason}
                              {blocker.resolutionHint ? ` — ${blocker.resolutionHint}` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
