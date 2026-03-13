# Phase 19: Roadmap Visualization - Research

**Researched:** 2026-03-11
**Domain:** React Flow (@xyflow/react), Gantt visualization, dependency graphs
**Confidence:** HIGH

## Summary

Phase 19 delivers interactive roadmap visualization with three core components: a dependency graph showing phase relationships, a Gantt-style timeline showing phase schedules, and progress tracking with milestone grouping. The primary library choice is React Flow (@xyflow/react) v12.x for the dependency graph, which provides built-in support for hierarchical layouts via dagre, zoom/pan with minimap, keyboard accessibility, and TypeScript-first design. The visualization is read-only (no editing) per scope constraints.

For the timeline/Gantt view, a custom implementation using native React with SVG or CSS grid is recommended over dedicated Gantt libraries. This avoids licensing costs (most full-featured Gantt libraries are commercial) and provides better integration with the existing design system. The timeline can share data structures with the dependency graph and render phases as horizontal bars with progress indicators.

**Primary recommendation:** Use @xyflow/react with @dagrejs/dagre for the dependency graph. Build the Gantt timeline as a custom React component using CSS grid for layout and the existing ProgressBar component for phase bars. Both views share a RoadmapStore (Zustand) for phase data, layout preferences, and view state.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All 3 graph orientations available as user preference: left-to-right, top-to-bottom, force-directed
- Phase nodes displayed as cards with details (name, progress %, plan count)
- Both edge styles available: smooth bezier curves and straight lines with elbows (user can toggle)
- Completed phases shown with muted styling (reduced opacity) to focus on active work
- Both time scales available: phase-based sequence and calendar dates (toggle between them)
- Calendar view only shown when time estimates exist for phases
- Parallel phases (same wave) displayed as stacked rows, aligned vertically
- Gantt bars are rich cards showing phase name, plan count, status badge
- Current phase highlighted with vertical "today" line and glow/accent border
- Fill progress bar for phase completion (plans completed / total plans)
- 4 distinct phase states: Not started (gray), In progress (blue), Complete (green), Blocked (red/orange)
- Milestone-level progress shown as aggregate bar (combined progress of child phases)
- Plan-level detail available via expandable section on phase cards
- Clicking a phase navigates to full phase detail page
- Large roadmaps (20+ phases) handled with zoom + pan, minimap in corner, fit-to-screen button
- Full keyboard navigation: arrow keys traverse phases, Enter opens detail, Tab cycles views
- Tab bar toggle between Graph and Timeline views at top of visualization

### Claude's Discretion
- Specific graph library choice (React Flow suggested in roadmap) - CONFIRMED: @xyflow/react v12.x
- Exact color palette for phase states
- Animation and transition timing
- Responsive breakpoints and mobile adaptation

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROAD-01 | User can view dependency graph showing phase-to-phase relationships | React Flow (@xyflow/react) v12.x with custom PhaseNode component; dagre for hierarchical layout; d3-force for force-directed option |
| ROAD-02 | User can view Gantt-style timeline showing phase schedule | Custom React component with CSS grid; horizontal bars per phase; phase-sequence or calendar-based x-axis |
| ROAD-03 | User can see progress tracking per phase with visual indicators | Reuse ProgressBar component; 4-state Badge (not_started/in_progress/completed/blocked); PhaseNode embeds progress |
| ROAD-04 | User can see phases grouped by milestone | Group phases by milestone in both views; collapsible milestone headers; aggregate progress bar per milestone |
| ROAD-05 | User can click phase in visualization to navigate to phase detail | React Flow node click handler + Next.js router.push; Timeline bar click handler; shared navigation utility |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xyflow/react | 12.10.x | Interactive node-based graph | Industry standard for React graphs; built-in zoom/pan/minimap; TypeScript-first; SSR support |
| @dagrejs/dagre | 2.0.x | Hierarchical graph layout | Simple API; fast; supports TB (top-bottom) and LR (left-right) directions |
| d3-force | 3.x | Force-directed layout | Physics-based positioning; built-in collision detection; works with React Flow |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @xyflow/react (MiniMap) | 12.10.x | Minimap navigation | Built-in component for large graphs per CONTEXT.md requirement |
| @xyflow/react (Controls) | 12.10.x | Zoom controls | Built-in fit-to-screen and zoom buttons |
| date-fns | 4.x | Date formatting for timeline | Already in @gsd/web; calendar x-axis labels |
| clsx | 2.x | Conditional classes | Already in @gsd/web; state-based styling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @xyflow/react | vis.js / Cytoscape.js | React Flow better React integration; smaller bundle; better TypeScript |
| Custom Gantt | gantt-task-react | gantt-task-react adds 40KB+ gzipped; custom allows exact design match; no license concerns |
| Custom Gantt | SVAR Gantt PRO | PRO features (export, MS Project) not needed; MIT base sufficient but custom still lighter |
| @dagrejs/dagre | elkjs | elkjs more configurable but complex; dagre sufficient for simple hierarchy |
| d3-force | cola.js | d3-force better documented; React Flow has example integration |

**Installation:**
```bash
# In apps/web directory
pnpm add @xyflow/react @dagrejs/dagre d3-force
pnpm add -D @types/d3-force
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── components/
│   └── features/
│       └── roadmap/
│           ├── index.ts              # Barrel export
│           ├── RoadmapPage.tsx       # Main page with tab toggle
│           ├── DependencyGraph.tsx   # React Flow wrapper
│           ├── PhaseNode.tsx         # Custom node component
│           ├── PhaseEdge.tsx         # Custom edge component (optional)
│           ├── Timeline.tsx          # Gantt-style component
│           ├── TimelineBar.tsx       # Individual phase bar
│           ├── MilestoneGroup.tsx    # Milestone header + children
│           ├── ViewToggle.tsx        # Graph/Timeline tab bar
│           ├── LayoutControls.tsx    # Direction/edge style toggles
│           └── hooks/
│               ├── useLayoutedNodes.ts    # Dagre/d3-force layout
│               └── useRoadmapData.ts      # Fetch + transform phases
├── stores/
│   └── roadmapStore.ts               # Zustand: layout prefs, view state
└── types/
    └── roadmap.ts                    # Phase node/edge types
```

### Pattern 1: Custom Phase Node with React Flow
**What:** Type-safe custom node displaying phase details with progress
**When to use:** All nodes in the dependency graph
**Example:**
```typescript
// Source: https://reactflow.dev/learn/customization/custom-nodes
// components/features/roadmap/PhaseNode.tsx
'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { clsx } from 'clsx';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';

type PhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';

type PhaseNodeData = {
  name: string;
  number: number;
  status: PhaseStatus;
  plans: number;
  completedPlans: number;
  milestone?: string;
};

type PhaseNode = Node<PhaseNodeData, 'phase'>;

const statusColors: Record<PhaseStatus, string> = {
  not_started: 'bg-gray-100 border-gray-300 dark:bg-gray-800',
  in_progress: 'bg-blue-50 border-blue-400 dark:bg-blue-900/30',
  completed: 'bg-green-50 border-green-400 opacity-60 dark:bg-green-900/30',
  blocked: 'bg-red-50 border-red-400 dark:bg-red-900/30',
};

export const PhaseNodeComponent = memo(function PhaseNode({
  data,
  selected,
}: NodeProps<PhaseNode>) {
  const progress = data.plans > 0
    ? Math.round((data.completedPlans / data.plans) * 100)
    : 0;

  return (
    <div
      className={clsx(
        'px-4 py-3 rounded-lg border-2 shadow-sm min-w-[180px] cursor-pointer',
        statusColors[data.status],
        selected && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted" />

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-muted-foreground">
          Phase {data.number}
        </span>
        <Badge variant={data.status}>{data.status.replace('_', ' ')}</Badge>
      </div>

      <h3 className="font-semibold text-sm mb-2 line-clamp-2">{data.name}</h3>

      <ProgressBar value={progress} className="mb-1" />

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{data.completedPlans}/{data.plans} plans</span>
        <span>{progress}%</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-muted" />
    </div>
  );
});
```

### Pattern 2: Dagre Layout with Multiple Directions
**What:** Compute node positions using dagre with configurable direction
**When to use:** TB (top-bottom) and LR (left-right) layouts
**Example:**
```typescript
// Source: https://reactflow.dev/examples/layout/dagre
// components/features/roadmap/hooks/useLayoutedNodes.ts
import { useMemo } from 'react';
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

type LayoutDirection = 'TB' | 'LR';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 100;

export function useLayoutedNodes(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = 'TB'
) {
  return useMemo(() => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
      rankdir: direction,
      nodesep: 50,
      ranksep: 80,
    });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, {
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - NODE_WIDTH / 2,
          y: nodeWithPosition.y - NODE_HEIGHT / 2,
        },
      };
    });

    // Update edge target/source handles based on direction
    const layoutedEdges = edges.map((edge) => ({
      ...edge,
      type: 'smoothstep', // or 'default' for bezier
    }));

    return { nodes: layoutedNodes, edges: layoutedEdges };
  }, [nodes, edges, direction]);
}
```

### Pattern 3: Timeline Bar with Progress
**What:** Horizontal bar representing a phase in the Gantt view
**When to use:** Timeline visualization
**Example:**
```typescript
// components/features/roadmap/TimelineBar.tsx
'use client';

import { clsx } from 'clsx';
import { useRouter } from 'next/navigation';
import type { Phase } from '@/types/roadmap';

interface TimelineBarProps {
  phase: Phase;
  startOffset: number;  // CSS grid column start (1-indexed)
  span: number;         // Number of columns to span
  isCurrent?: boolean;
}

const statusColors: Record<string, string> = {
  not_started: 'bg-gray-200 dark:bg-gray-700',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500 opacity-60',
  blocked: 'bg-red-500',
};

export function TimelineBar({ phase, startOffset, span, isCurrent }: TimelineBarProps) {
  const router = useRouter();
  const progress = phase.plans > 0
    ? (phase.completedPlans / phase.plans) * 100
    : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/projects/${phase.projectId}/phases/${phase.number}`)}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/projects/${phase.projectId}/phases/${phase.number}`)}
      className={clsx(
        'relative h-12 rounded-md cursor-pointer transition-shadow hover:shadow-md',
        'flex items-center px-3 gap-2',
        statusColors[phase.status],
        isCurrent && 'ring-2 ring-primary ring-offset-2'
      )}
      style={{
        gridColumnStart: startOffset,
        gridColumnEnd: `span ${span}`,
      }}
    >
      {/* Progress fill overlay */}
      <div
        className="absolute inset-0 bg-white/20 rounded-md"
        style={{ width: `${progress}%` }}
      />

      <span className="relative z-10 text-sm font-medium text-white truncate">
        {phase.number}. {phase.name}
      </span>

      <span className="relative z-10 text-xs text-white/80 ml-auto">
        {phase.completedPlans}/{phase.plans}
      </span>
    </div>
  );
}
```

### Pattern 4: Roadmap Store with Layout Preferences
**What:** Zustand store for view state and user preferences
**When to use:** Persist layout direction, edge style, and active view
**Example:**
```typescript
// Source: Zustand patterns from Phase 15
// stores/roadmapStore.ts
import { create } from 'zustand';

type LayoutDirection = 'TB' | 'LR' | 'force';
type EdgeStyle = 'bezier' | 'smoothstep';
type ViewMode = 'graph' | 'timeline';
type TimeScale = 'sequence' | 'calendar';

interface RoadmapStore {
  // View state
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Graph preferences
  layoutDirection: LayoutDirection;
  setLayoutDirection: (direction: LayoutDirection) => void;
  edgeStyle: EdgeStyle;
  setEdgeStyle: (style: EdgeStyle) => void;

  // Timeline preferences
  timeScale: TimeScale;
  setTimeScale: (scale: TimeScale) => void;

  // Expanded milestones (for grouping)
  expandedMilestones: Set<string>;
  toggleMilestone: (id: string) => void;
}

export const useRoadmapStore = create<RoadmapStore>((set) => ({
  viewMode: 'graph',
  setViewMode: (viewMode) => set({ viewMode }),

  layoutDirection: 'TB',
  setLayoutDirection: (layoutDirection) => set({ layoutDirection }),
  edgeStyle: 'bezier',
  setEdgeStyle: (edgeStyle) => set({ edgeStyle }),

  timeScale: 'sequence',
  setTimeScale: (timeScale) => set({ timeScale }),

  expandedMilestones: new Set(),
  toggleMilestone: (id) => set((state) => {
    const next = new Set(state.expandedMilestones);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return { expandedMilestones: next };
  }),
}));

// Selectors
export const selectViewMode = (s: RoadmapStore) => s.viewMode;
export const selectLayoutDirection = (s: RoadmapStore) => s.layoutDirection;
export const selectEdgeStyle = (s: RoadmapStore) => s.edgeStyle;
export const selectTimeScale = (s: RoadmapStore) => s.timeScale;
```

### Anti-Patterns to Avoid
- **Computing layout in render:** Dagre layout is expensive; memoize with useMemo or compute once on data change
- **Force layout every frame:** D3-force is iterative; stop simulation after convergence or on user interaction
- **Inline nodeTypes definition:** Define nodeTypes outside component to prevent re-mounting nodes on every render
- **Missing Handle components:** Custom nodes must include Handle components for edges to connect
- **Direct DOM manipulation in React Flow:** Use controlled nodes/edges state; don't manipulate DOM directly

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Node positioning | Manual x/y calculation | dagre or d3-force | Graph layout is NP-hard; libraries handle edge cases |
| Zoom/pan | Touch/mouse event handling | React Flow built-in | Pinch zoom, scroll zoom, keyboard shortcuts included |
| Minimap | Canvas thumbnail rendering | React Flow MiniMap | Handles viewport sync, node rendering, click-to-pan |
| Fit-to-screen | Bounds calculation | useReactFlow().fitView() | Accounts for padding, animation, node sizes |
| Keyboard navigation | Manual focus management | React Flow a11y props | Built-in Tab/Enter/Escape/Arrow handling |

**Key insight:** React Flow provides zoom, pan, minimap, controls, and keyboard navigation out of the box. The main implementation work is custom node components and layout integration.

## Common Pitfalls

### Pitfall 1: Node Types Redefinition Causes Remounts
**What goes wrong:** Custom nodes re-mount on every render, losing internal state
**Why it happens:** nodeTypes object created inside component causes React Flow to detect "new" types
**How to avoid:** Define nodeTypes outside component or useMemo with empty deps
**Warning signs:** Flickering nodes; lost hover/selection state; performance issues

### Pitfall 2: React Flow Styles Not Loaded
**What goes wrong:** Nodes/edges invisible or unstyled; controls don't appear
**Why it happens:** Missing CSS import for React Flow default styles
**How to avoid:** Import `@xyflow/react/dist/style.css` in root layout or component
**Warning signs:** Blank canvas; edges with no stroke; controls with no icons

### Pitfall 3: D3-Force Layout Never Stops
**What goes wrong:** High CPU usage; nodes keep moving after interaction
**Why it happens:** Force simulation runs indefinitely; no alpha decay
**How to avoid:** Call simulation.stop() on user interaction; check simulation.alpha() < 0.001
**Warning signs:** Continuous layout animations; hot CPU; sluggish interactions

### Pitfall 4: SSR Hydration Mismatch with React Flow
**What goes wrong:** Console errors about hydration; layout jumps on load
**Why it happens:** Server renders without node positions; client computes layout
**How to avoid:** Use `suppressHydrationWarning` on wrapper; or compute initial positions server-side
**Warning signs:** Layout flash on page load; "Text content does not match" errors

### Pitfall 5: Handle Position Wrong for Layout Direction
**What goes wrong:** Edges connect to wrong side of nodes after direction change
**Why it happens:** Handle positions (Top/Bottom/Left/Right) hardcoded for one direction
**How to avoid:** Dynamically set Handle positions based on layout direction (TB: Top/Bottom, LR: Left/Right)
**Warning signs:** Edges crossing nodes; curved edges with odd angles

### Pitfall 6: Gantt Timeline Overflow with Many Phases
**What goes wrong:** Horizontal scroll doesn't work; bars overlap; layout breaks
**Why it happens:** Fixed grid columns don't accommodate variable phase counts
**How to avoid:** Use dynamic grid-template-columns; ensure overflow-x-auto on container; test with 20+ phases
**Warning signs:** Truncated timeline; overlapping bars; horizontal scrollbar missing

## Code Examples

Verified patterns from official sources:

### React Flow with Custom Nodes and Controls
```typescript
// Source: https://reactflow.dev/learn/customization/custom-nodes
// components/features/roadmap/DependencyGraph.tsx
'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { PhaseNodeComponent } from './PhaseNode';
import { useLayoutedNodes } from './hooks/useLayoutedNodes';
import { useRoadmapStore, selectLayoutDirection, selectEdgeStyle } from '@/stores/roadmapStore';
import type { Phase } from '@/types/roadmap';

// Define outside component to prevent remounts
const nodeTypes: NodeTypes = {
  phase: PhaseNodeComponent,
};

interface DependencyGraphProps {
  phases: Phase[];
  onPhaseClick: (phaseNumber: number) => void;
}

export function DependencyGraph({ phases, onPhaseClick }: DependencyGraphProps) {
  const layoutDirection = useRoadmapStore(selectLayoutDirection);
  const edgeStyle = useRoadmapStore(selectEdgeStyle);

  // Transform phases to nodes/edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes = phases.map((phase) => ({
      id: `phase-${phase.number}`,
      type: 'phase',
      data: {
        name: phase.name,
        number: phase.number,
        status: phase.status,
        plans: phase.plans,
        completedPlans: phase.completedPlans,
        milestone: phase.milestone,
      },
      position: { x: 0, y: 0 }, // Will be computed by layout
    }));

    const edges = phases.flatMap((phase) =>
      (phase.dependsOn ?? []).map((depNum) => ({
        id: `e${depNum}-${phase.number}`,
        source: `phase-${depNum}`,
        target: `phase-${phase.number}`,
        type: edgeStyle === 'bezier' ? 'default' : 'smoothstep',
        animated: phase.status === 'in_progress',
      }))
    );

    return { initialNodes: nodes, initialEdges: edges };
  }, [phases, edgeStyle]);

  // Apply layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useLayoutedNodes(
    initialNodes,
    initialEdges,
    layoutDirection === 'force' ? 'TB' : layoutDirection
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      const phaseNum = parseInt(node.id.replace('phase-', ''), 10);
      onPhaseClick(phaseNum);
    },
    [onPhaseClick]
  );

  return (
    <div className="h-[600px] w-full border rounded-lg bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={2}
        colorMode="system"
      >
        <Background />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
```

### Timeline Component with CSS Grid
```typescript
// components/features/roadmap/Timeline.tsx
'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { TimelineBar } from './TimelineBar';
import { MilestoneGroup } from './MilestoneGroup';
import { useRoadmapStore, selectTimeScale } from '@/stores/roadmapStore';
import type { Phase } from '@/types/roadmap';

interface TimelineProps {
  phases: Phase[];
  projectId: string;
  currentPhaseNumber?: number;
}

export function Timeline({ phases, projectId, currentPhaseNumber }: TimelineProps) {
  const timeScale = useRoadmapStore(selectTimeScale);
  const router = useRouter();

  // Group phases by milestone
  const milestones = useMemo(() => {
    const groups = new Map<string, Phase[]>();
    phases.forEach((phase) => {
      const key = phase.milestone ?? 'Ungrouped';
      const existing = groups.get(key) ?? [];
      groups.set(key, [...existing, phase]);
    });
    return groups;
  }, [phases]);

  // For sequence view, each phase gets 1 column
  // For calendar view, would need date-based column calculations
  const columnCount = phases.length;

  const handlePhaseClick = (phaseNumber: number) => {
    router.push(`/projects/${projectId}/phases/${phaseNumber}`);
  };

  return (
    <div className="overflow-x-auto">
      {/* Column headers */}
      <div
        className="grid gap-1 mb-2 min-w-max"
        style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(100px, 1fr))` }}
      >
        {phases.map((phase) => (
          <div key={phase.number} className="text-xs text-muted-foreground text-center px-2">
            P{phase.number}
          </div>
        ))}
      </div>

      {/* Phase bars grouped by milestone */}
      <div className="space-y-4">
        {Array.from(milestones.entries()).map(([milestone, milestonePhases]) => (
          <MilestoneGroup
            key={milestone}
            name={milestone}
            phases={milestonePhases}
            columnCount={columnCount}
            currentPhaseNumber={currentPhaseNumber}
            onPhaseClick={handlePhaseClick}
          />
        ))}
      </div>

      {/* Current phase indicator (vertical line) */}
      {currentPhaseNumber && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
          style={{
            left: `calc(${(currentPhaseNumber - 1) / columnCount * 100}% + 50px)`,
          }}
        />
      )}
    </div>
  );
}
```

### Keyboard Navigation for Custom Nodes
```typescript
// Source: https://reactflow.dev/learn/advanced-use/accessibility
// React Flow automatically handles Tab navigation and Enter/Space for selection
// Add custom keyboard handling for arrow key traversal:

// In DependencyGraph.tsx
const onKeyDown = useCallback(
  (event: React.KeyboardEvent) => {
    const selectedNode = nodes.find((n) => n.selected);
    if (!selectedNode) return;

    const currentNum = parseInt(selectedNode.id.replace('phase-', ''), 10);
    let targetNum: number | null = null;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight': {
        // Find next phase that depends on current
        const next = phases.find((p) => p.dependsOn?.includes(currentNum));
        targetNum = next?.number ?? null;
        break;
      }
      case 'ArrowUp':
      case 'ArrowLeft': {
        // Find parent phase
        const current = phases.find((p) => p.number === currentNum);
        targetNum = current?.dependsOn?.[0] ?? null;
        break;
      }
      case 'Enter':
        onPhaseClick(currentNum);
        return;
    }

    if (targetNum) {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          selected: n.id === `phase-${targetNum}`,
        }))
      );
    }
  },
  [nodes, phases, setNodes, onPhaseClick]
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| reactflow package | @xyflow/react | React Flow 12 (2024) | New npm scope; better TypeScript |
| dagre (unmaintained) | @dagrejs/dagre | 2024 | Active maintenance; v2.0 updates |
| Manual zoom/pan | React Flow built-in | Always | Handles touch, mouse wheel, keyboard |
| Custom minimap | MiniMap component | React Flow 11+ | pannable/zoomable props added |
| Light mode only | colorMode="system" | React Flow 12 (2024) | Built-in dark mode support |

**Deprecated/outdated:**
- `reactflow` npm package: Use `@xyflow/react` instead
- `dagre` npm package: Use `@dagrejs/dagre` for maintained version
- Manual dark mode CSS: Use React Flow's built-in colorMode prop
- useNodes/useEdges without state: Use useNodesState/useEdgesState for controlled flow

## Open Questions

1. **Phase Dependency Data Source**
   - What we know: PhaseSchema has `dependsOn: z.array(z.number().int()).optional()` but current listPhases doesn't populate it
   - What's unclear: Where does dependency data come from? ROADMAP.md parsing? Manual configuration?
   - Recommendation: Parse "Depends on" from ROADMAP.md phase details; add to gsd-wrapper listPhases; or require backend enhancement

2. **Milestone Assignment**
   - What we know: ROADMAP.md groups phases under milestone headers (v1.0, v1.1, v2.0)
   - What's unclear: Is milestone exposed in current API?
   - Recommendation: Extend Phase type with milestone field; parse from ROADMAP.md structure

3. **Calendar Time Scale Data**
   - What we know: CONTEXT.md says "Calendar view only shown when time estimates exist"
   - What's unclear: Where do time estimates come from? No startDate/endDate in current schema
   - Recommendation: For MVP, implement sequence-only timeline; calendar scale deferred until time estimate feature exists

4. **Force-Directed Layout Stopping**
   - What we know: D3-force runs iteratively; needs explicit stop
   - What's unclear: Best UX - stop on drag? On click? On alpha threshold?
   - Recommendation: Stop simulation when alpha < 0.001; also stop on any user interaction with nodes

## Sources

### Primary (HIGH confidence)
- [React Flow Official Documentation](https://reactflow.dev/) - v12 API reference, custom nodes, accessibility
- [React Flow Dagre Example](https://reactflow.dev/examples/layout/dagre) - Layout integration
- [React Flow MiniMap API](https://reactflow.dev/api-reference/components/minimap) - Minimap configuration
- [@dagrejs/dagre npm](https://www.npmjs.com/package/@dagrejs/dagre) - v2.0.4 current version
- [React Flow TypeScript Guide](https://reactflow.dev/learn/advanced-use/typescript) - Type-safe patterns

### Secondary (MEDIUM confidence)
- [React Flow Force Layout Example](https://reactflow.dev/examples/layout/force-layout) - D3-force integration (Pro example)
- [gantt-task-react GitHub](https://github.com/MaTeMaTuK/gantt-task-react) - Reference for Gantt API patterns
- [SVAR Gantt Blog](https://svar.dev/blog/top-react-gantt-charts/) - Gantt library comparison 2026

### Tertiary (LOW confidence)
- Community patterns for React Flow with Next.js App Router - Still evolving
- D3-force stopping strategies - Various approaches, no official best practice

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @xyflow/react v12 well-documented; dagre stable
- Architecture: HIGH - Follows existing Phase 15 patterns; extends proven structures
- Pitfalls: HIGH - React Flow docs cover common issues
- Dependency data: MEDIUM - Requires backend enhancement for full dependency graph

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (30 days - stable technologies)
