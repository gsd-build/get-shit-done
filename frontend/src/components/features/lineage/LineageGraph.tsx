'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type OnSelectionChangeFunc,
} from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';
import { TableNode } from './TableNode';
import { ColumnEdge } from './ColumnEdge';
import type { TableNodeData, ColumnEdgeData } from '@/lib/lineage-types';
import '@xyflow/react/dist/style.css';

// ============================================================================
// Types
// ============================================================================

// Using Node and Edge with Record<string, unknown> for React Flow compatibility
export type LineageGraphNode = Node<TableNodeData & Record<string, unknown>> & {
  type: 'table';
};

export type LineageGraphEdge = Edge<ColumnEdgeData> & {
  type: 'column';
};

interface LineageGraphProps {
  initialNodes: LineageGraphNode[];
  initialEdges: LineageGraphEdge[];
  onNodeSelect?: (nodeId: string | null) => void;
  onColumnSelect?: (columnId: string | null) => void;
  onColumnContextMenu?: (columnId: string, x: number, y: number) => void;
  highlightedPath?: string[]; // Array of node/column IDs to highlight
  selectedColumnId?: string;
  className?: string;
}

// ============================================================================
// ELK Layout Configuration
// ============================================================================

const elk = new ELK();

const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.nodeNodeBetweenLayers': '120',
  'elk.spacing.nodeNode': '60',
  'elk.layered.nodePlacement.strategy': 'SIMPLE',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.edgeRouting': 'ORTHOGONAL',
};

// Estimate node dimensions based on content
function getNodeDimensions(node: LineageGraphNode): { width: number; height: number } {
  const columns = node.data.columns?.length || 0;
  const width = 250;
  const headerHeight = 48;
  const columnHeight = 28;
  const padding = 16;
  const height = headerHeight + columns * columnHeight + padding;

  return { width, height };
}

async function getLayoutedElements(
  nodes: LineageGraphNode[],
  edges: LineageGraphEdge[]
): Promise<{ nodes: LineageGraphNode[]; edges: LineageGraphEdge[] }> {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const elkNodes = nodes.map((node) => {
    const { width, height } = getNodeDimensions(node);
    return {
      id: node.id,
      width,
      height,
    };
  });

  const elkEdges = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const graph = {
    id: 'root',
    layoutOptions: elkOptions,
    children: elkNodes,
    edges: elkEdges,
  };

  const layoutedGraph = await elk.layout(graph);

  const layoutedNodes = nodes.map((node) => {
    const layoutedNode = layoutedGraph.children?.find((n) => n.id === node.id);
    return {
      ...node,
      position: {
        x: layoutedNode?.x ?? 0,
        y: layoutedNode?.y ?? 0,
      },
    };
  });

  return {
    nodes: layoutedNodes,
    edges,
  };
}

// ============================================================================
// Custom Node/Edge Types
// ============================================================================

// Cast to NodeTypes/EdgeTypes - React Flow's strict typing requires this
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes = {
  table: TableNode,
} as NodeTypes;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edgeTypes = {
  column: ColumnEdge,
} as EdgeTypes;

// ============================================================================
// Component
// ============================================================================

function LineageGraphInner({
  initialNodes,
  initialEdges,
  onNodeSelect,
  onColumnSelect,
  onColumnContextMenu,
  highlightedPath = [],
  selectedColumnId,
  className,
}: LineageGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([] as LineageGraphNode[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as LineageGraphEdge[]);
  const [isLayouting, setIsLayouting] = useState(false);
  const { fitView } = useReactFlow();

  // Apply layout when initial data changes
  useEffect(() => {
    if (initialNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    setIsLayouting(true);

    getLayoutedElements(initialNodes, initialEdges)
      .then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

        // Fit view after layout with a small delay for rendering
        setTimeout(() => {
          fitView({ padding: 0.2, duration: 500 });
        }, 50);
      })
      .finally(() => {
        setIsLayouting(false);
      });
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

  // Update nodes with column callbacks and selected state
  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          selectedColumnId,
          onColumnClick: onColumnSelect,
          onColumnDoubleClick: (columnId: string) => {
            // Double-click could trigger impact analysis
            onColumnSelect?.(columnId);
          },
          isHighlighted: highlightedPath.includes(node.id),
          columns: node.data.columns?.map((col) => ({
            ...col,
            isHighlighted: highlightedPath.includes(col.id),
          })),
        },
      })) as LineageGraphNode[]
    );
  }, [selectedColumnId, onColumnSelect, highlightedPath, setNodes]);

  // Update edges with highlight state
  useEffect(() => {
    setEdges((currentEdges) =>
      currentEdges.map((edge) => ({
        ...edge,
        data: {
          transformationType: edge.data?.transformationType ?? null,
          transformationSubtype: edge.data?.transformationSubtype ?? null,
          transformationDescription: edge.data?.transformationDescription ?? null,
          isHighlighted:
            highlightedPath.includes(edge.source) ||
            highlightedPath.includes(edge.target),
        },
      })) as LineageGraphEdge[]
    );
  }, [highlightedPath, setEdges]);

  // Handle node selection
  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => {
      if (selectedNodes.length > 0) {
        onNodeSelect?.(selectedNodes[0].id);
      } else {
        onNodeSelect?.(null);
      }
    },
    [onNodeSelect]
  );

  // Handle context menu on nodes
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      // Get the column under the cursor if any
      const target = event.target as HTMLElement;
      const columnRow = target.closest('[data-column-id]');
      if (columnRow) {
        const columnId = columnRow.getAttribute('data-column-id');
        if (columnId) {
          onColumnContextMenu?.(columnId, event.clientX, event.clientY);
        }
      }
    },
    [onColumnContextMenu]
  );

  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      {isLayouting && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={handleSelectionChange}
        onNodeContextMenu={handleNodeContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'column',
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#f0f0f0" gap={16} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            if (highlightedPath.includes(node.id)) return '#FEF08A';
            return '#E5E7EB';
          }}
          maskColor="rgba(255, 255, 255, 0.8)"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

// Wrapper to provide ReactFlow context
export function LineageGraph(props: LineageGraphProps) {
  return (
    <ReactFlowProvider>
      <LineageGraphInner {...props} />
    </ReactFlowProvider>
  );
}

// Export for direct use when ReactFlowProvider is already present
export { LineageGraphInner };

export default LineageGraph;
