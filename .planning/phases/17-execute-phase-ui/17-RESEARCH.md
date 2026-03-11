# Phase 17: Execute Phase UI - Research

**Researched:** 2026-03-11
**Domain:** Real-time execution visualization with streaming, tool cards, checkpoints, diffs, and TDD workflow
**Confidence:** HIGH

## Summary

This phase implements the real-time execution interface for GSD, building on the frontend foundation from Phase 15 and the backend orchestrator from Phase 14. The execute phase UI displays wave-based pipeline visualization (horizontal left-to-right layout like GitHub Actions), streaming logs per plan, collapsible tool call cards with syntax highlighting, checkpoint modals with countdown warnings, Monaco DiffEditor for file changes, and a git commit timeline. Users can pause/resume/abort execution with graceful controls.

The backend infrastructure is already complete: the orchestrator emits typed Socket.IO events (`agent:start`, `agent:token`, `agent:tool_start`, `agent:tool_end`, `checkpoint:request`, `agent:end`), and the `@gsd/events` package provides TypeScript types for all events. The frontend connects via `createSocketClient` from `@gsd/events` and subscribes to agent rooms.

The TDD workflow visualization (QUAL-01 through QUAL-04) shows a 3-step progress indicator in the execution header: Red > Green > Refactor. This requires the backend to emit TDD phase information, which may need enhancement.

**Primary recommendation:** Use `@monaco-editor/react` for diff visualization, `react-resizable-panels` for the resizable diff sidebar, and build custom pipeline visualization using CSS Grid/Flexbox (simpler than React Flow for this linear wave-based layout). Leverage existing `@gsd/events` types and `createTokenBuffer` for RAF-based token streaming.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Horizontal pipeline visualization: waves flow left-to-right like CI, each wave is a column with plans stacked vertically
- Inline expandable logs: click a plan card to expand and see live streaming logs below it
- Auto-expand active plans, auto-collapse completed plans
- Plan cards show: name, status indicator, and elapsed time (live timer while running, "completed in Xs" when done)
- Collapsible tool call cards with icons for each tool type (Read, Write, Bash, etc.)
- Syntax-highlighted code preview for file operations (Read/Write/Edit), truncated with "show more"
- Live streaming with auto-scroll for Bash output - user can scroll up to pause auto-scroll
- Live elapsed timer while tool runs, final duration shown on completion
- Modal overlay for checkpoint dialogs - blocks interaction until answered, shows timeout countdown
- Fixed header bar for pause/resume/abort controls - always visible at top of execution panel
- Confirmation dialog for abort - shows files modified and commits made, offers rollback option
- Visual countdown with color change for timeouts: normal, yellow at 30s, red/pulsing at 10s
- Toggle between unified and side-by-side (Monaco) diff views - default to unified
- Right sidebar for diff panel - updates based on selected file from tool cards
- Collapsible section for commits: "X commits made [View]", hidden by default
- Files grouped by directory tree in diff panel
- TDD phase shown in execution header as 3-step progress: Red > Green > Refactor

### Claude's Discretion
- Exact spacing, typography, and color values within the design system
- Loading skeleton design for initial state
- Error state handling beyond what's specified
- Exact icons for each tool type

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXEC-01 | User can see wave-based execution progress with real-time log streaming per plan | Pipeline component with CSS Grid columns for waves; Socket.IO `agent:token` events; `createTokenBuffer` for RAF batching |
| EXEC-02 | User can see tool calls visualized as collapsible cards (Read, Write, Bash, etc.) | Accordion/collapsible component; `agent:tool_start`/`agent:tool_end` events; lucide-react icons |
| EXEC-03 | User can respond to checkpoint dialogs with timeout warning display | Modal component with `checkpoint:request` event; countdown timer with color transitions |
| EXEC-04 | User can view file changes in Monaco DiffEditor with syntax highlighting | `@monaco-editor/react` DiffEditor; resizable right sidebar with `react-resizable-panels` |
| EXEC-05 | User can see git commit timeline showing commits created during execution | Collapsible commit list; parse git log or receive via new event; directory tree grouping |
| EXEC-06 | User can pause execution and resume from the paused state | REST API PATCH to orchestrator; UI state toggle; disable tool calls while paused |
| EXEC-07 | User can abort execution gracefully with rollback option | Confirmation modal; DELETE /api/agents/:id; optional git rollback |
| EXEC-08 | User can recover from errors with retry options and context preservation | `agent:error` event handling; retry button triggering new agent start with preserved context |
| QUAL-01 | Execution follows Red-Green-Refactor TDD workflow for code development tasks | TDD phase indicator in header; backend emits TDD phase state |
| QUAL-02 | Tests are written before implementation and must fail initially (Red) | Visual indicator showing Red phase active |
| QUAL-03 | Implementation makes tests pass without shortcuts (Green) | Visual indicator showing Green phase active |
| QUAL-04 | Code is refactored for clarity after tests pass (Refactor) | Visual indicator showing Refactor phase active |
</phase_requirements>

## Standard Stack

### Core (Inherited from Phase 15)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x | React framework with App Router | Established in Phase 15 |
| React | 19.x | UI library | Bundled with Next.js 15 |
| Tailwind CSS | 4.x | Utility-first CSS | CSS-first config, established in Phase 15 |
| TypeScript | 5.4+ | Type safety | Full monorepo support |
| Zustand | 5.x | Client-side state | UI state, execution state |
| @gsd/events | workspace | Socket.IO client types + utilities | `createSocketClient`, `createTokenBuffer`, typed events |

### Phase 17 Specific
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @monaco-editor/react | 4.6.x | Monaco diff editor | File change visualization (EXEC-04) |
| react-resizable-panels | 4.x | Resizable sidebar | Diff panel width adjustment |
| react-countdown-circle-timer | 3.x | Countdown timer | Checkpoint timeout visualization |
| lucide-react | 0.400+ | Tool type icons | Read/Write/Bash/etc icons |
| @radix-ui/react-dialog | 1.x | Modal primitives | Checkpoint dialogs, abort confirmation |
| @radix-ui/react-accordion | 1.x | Collapsible primitives | Tool cards, commit timeline |
| @radix-ui/react-tabs | 1.x | Tab primitives | Unified/side-by-side diff toggle |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @monaco-editor/react | react-monaco-editor | @monaco-editor/react has 3x more downloads, better maintenance |
| react-resizable-panels | react-split-pane | react-resizable-panels is from Brian Vaughn (React core team), shadcn uses it |
| Custom pipeline viz | React Flow | React Flow overkill for linear wave layout; CSS Grid simpler |
| @radix-ui primitives | Headless UI | Radix has better composition patterns, shadcn compatibility |

**Installation:**
```bash
# In apps/web directory
pnpm add @monaco-editor/react@4 react-resizable-panels react-countdown-circle-timer
pnpm add @radix-ui/react-dialog @radix-ui/react-accordion @radix-ui/react-tabs
# lucide-react and zustand already from Phase 15
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── components/
│   └── features/
│       └── execute/
│           ├── ExecutionPanel.tsx       # Main container with fixed header
│           ├── PipelineView.tsx         # Wave-based horizontal pipeline
│           ├── WaveColumn.tsx           # Single wave column with plans
│           ├── PlanCard.tsx             # Expandable plan card with logs
│           ├── ToolCard.tsx             # Collapsible tool call card
│           ├── LogStream.tsx            # Auto-scrolling log viewer
│           ├── CheckpointModal.tsx      # Blocking checkpoint dialog
│           ├── CountdownTimer.tsx       # Timeout countdown with colors
│           ├── DiffPanel.tsx            # Right sidebar diff viewer
│           ├── DiffEditor.tsx           # Monaco diff editor wrapper
│           ├── CommitTimeline.tsx       # Collapsible commit list
│           ├── TddIndicator.tsx         # Red-Green-Refactor progress
│           ├── ExecutionControls.tsx    # Pause/Resume/Abort buttons
│           └── AbortConfirmDialog.tsx   # Abort confirmation modal
├── hooks/
│   ├── useExecution.ts                  # Execution state management
│   ├── useAgentSubscription.ts          # Socket.IO agent room subscription
│   └── useTokenBuffer.ts                # RAF token buffering wrapper
├── stores/
│   └── executionStore.ts                # Zustand execution state
└── app/
    └── projects/
        └── [id]/
            └── execute/
                └── page.tsx             # Execute phase page
```

### Pattern 1: Pipeline Visualization with CSS Grid
**What:** Horizontal wave-based layout using CSS Grid columns
**When to use:** EXEC-01 wave progress visualization
**Example:**
```typescript
// Source: CONTEXT.md requirements + CSS Grid best practices
// components/features/execute/PipelineView.tsx
'use client';

interface Wave {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  plans: Plan[];
}

export function PipelineView({ waves }: { waves: Wave[] }) {
  return (
    <div
      className="grid auto-cols-[280px] grid-flow-col gap-4 overflow-x-auto p-4"
      role="list"
      aria-label="Execution waves"
    >
      {waves.map((wave, index) => (
        <WaveColumn
          key={wave.id}
          wave={wave}
          waveNumber={index + 1}
        />
      ))}
    </div>
  );
}
```

### Pattern 2: Token Buffering with RAF
**What:** Use existing `createTokenBuffer` from @gsd/events for smooth streaming
**When to use:** Real-time log streaming (EXEC-01)
**Example:**
```typescript
// Source: @gsd/events + CONTEXT.md token buffering requirements
// hooks/useTokenBuffer.ts
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createTokenBuffer } from '@gsd/events';

export function useTokenBuffer(onFlush: (tokens: string) => void) {
  const bufferRef = useRef(createTokenBuffer(onFlush));

  const push = useCallback((token: string) => {
    bufferRef.current.push(token);
  }, []);

  useEffect(() => {
    return () => bufferRef.current.dispose();
  }, []);

  return { push };
}
```

### Pattern 3: Checkpoint Modal with Countdown
**What:** Blocking modal with visual countdown timer
**When to use:** EXEC-03 checkpoint dialogs
**Example:**
```typescript
// Source: @radix-ui/react-dialog + react-countdown-circle-timer
// components/features/execute/CheckpointModal.tsx
'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { CountdownCircleTimer } from 'react-countdown-circle-timer';
import type { CheckpointRequestEvent } from '@gsd/events';

interface Props {
  checkpoint: CheckpointRequestEvent | null;
  onRespond: (response: string) => void;
}

export function CheckpointModal({ checkpoint, onRespond }: Props) {
  if (!checkpoint) return null;

  const durationSec = (checkpoint.timeoutMs || 60000) / 1000;

  return (
    <Dialog.Root open={!!checkpoint}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card p-6 rounded-lg shadow-lg max-w-md w-full">
          <Dialog.Title className="text-lg font-semibold mb-4">
            Checkpoint Required
          </Dialog.Title>

          <div className="flex items-center gap-4 mb-4">
            <CountdownCircleTimer
              isPlaying
              duration={durationSec}
              colors={['#22c55e', '#eab308', '#ef4444']}
              colorsTime={[durationSec, 30, 10]}
              size={60}
              strokeWidth={4}
            >
              {({ remainingTime }) => remainingTime}
            </CountdownCircleTimer>
            <p>{checkpoint.prompt}</p>
          </div>

          {checkpoint.options ? (
            <div className="flex flex-wrap gap-2">
              {checkpoint.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onRespond(opt.id)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              autoFocus
              className="w-full px-3 py-2 border rounded-md"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onRespond((e.target as HTMLInputElement).value);
                }
              }}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

### Pattern 4: Monaco DiffEditor with Language Detection
**What:** Monaco diff editor with syntax highlighting and toggle views
**When to use:** EXEC-04 file change visualization
**Example:**
```typescript
// Source: https://github.com/suren-atoyan/monaco-react
// components/features/execute/DiffEditor.tsx
'use client';

import { DiffEditor as MonacoDiffEditor } from '@monaco-editor/react';
import { useState } from 'react';

interface Props {
  original: string;
  modified: string;
  filePath: string;
}

function getLanguageFromPath(path: string): string {
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
  };
  return langMap[ext || ''] || 'plaintext';
}

export function DiffEditor({ original, modified, filePath }: Props) {
  const [sideBySide, setSideBySide] = useState(false); // Default unified per CONTEXT.md
  const language = getLanguageFromPath(filePath);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 border-b">
        <span className="text-sm font-mono">{filePath}</span>
        <button
          onClick={() => setSideBySide(!sideBySide)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {sideBySide ? 'Unified' : 'Side-by-side'}
        </button>
      </div>
      <div className="flex-1">
        <MonacoDiffEditor
          original={original}
          modified={modified}
          language={language}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide: sideBySide,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
```

### Pattern 5: Auto-Scroll Log Stream with Pause
**What:** Auto-scrolling log viewer that pauses when user scrolls up
**When to use:** EXEC-01 live streaming logs, EXEC-02 Bash output
**Example:**
```typescript
// Source: Community patterns + CONTEXT.md requirements
// components/features/execute/LogStream.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface Props {
  logs: string;
  isStreaming: boolean;
}

export function LogStream({ logs, isStreaming }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const lastScrollTopRef = useRef(0);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // User scrolled up - pause auto-scroll
    if (el.scrollTop < lastScrollTopRef.current) {
      setAutoScroll(false);
    }

    // User scrolled to bottom - resume auto-scroll
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10;
    if (atBottom) {
      setAutoScroll(true);
    }

    lastScrollTopRef.current = el.scrollTop;
  }, []);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-auto font-mono text-sm bg-zinc-900 text-zinc-100 p-4"
      >
        <pre className="whitespace-pre-wrap">{logs}</pre>
      </div>
      {!autoScroll && isStreaming && (
        <button
          onClick={() => setAutoScroll(true)}
          className="absolute bottom-4 right-4 px-3 py-1 bg-primary text-primary-foreground text-sm rounded-full shadow-lg"
        >
          Resume auto-scroll
        </button>
      )}
    </div>
  );
}
```

### Pattern 6: Execution State with Zustand
**What:** Centralized execution state management
**When to use:** All execution UI state
**Example:**
```typescript
// Source: Zustand patterns + @gsd/events types
// stores/executionStore.ts
import { create } from 'zustand';
import type {
  AgentStartEvent,
  ToolStartEvent,
  ToolEndEvent,
  CheckpointRequestEvent,
} from '@gsd/events';

interface ToolCall {
  toolId: string;
  toolName: string;
  input: unknown;
  output?: string;
  success?: boolean;
  duration?: number;
  startTime: number;
}

interface PlanExecution {
  planId: string;
  taskName: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  logs: string;
  toolCalls: ToolCall[];
  startTime?: number;
  endTime?: number;
}

interface ExecutionState {
  agentId: string | null;
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  tddPhase: 'red' | 'green' | 'refactor' | null;
  plans: Map<string, PlanExecution>;
  pendingCheckpoint: CheckpointRequestEvent | null;
  selectedFile: { path: string; original: string; modified: string } | null;
  commits: Array<{ sha: string; message: string; timestamp: string }>;

  // Actions
  startExecution: (agentId: string, planId: string, taskName: string) => void;
  appendLog: (planId: string, token: string) => void;
  startTool: (planId: string, event: ToolStartEvent) => void;
  endTool: (planId: string, event: ToolEndEvent) => void;
  setCheckpoint: (checkpoint: CheckpointRequestEvent | null) => void;
  setTddPhase: (phase: ExecutionState['tddPhase']) => void;
  selectFile: (file: ExecutionState['selectedFile']) => void;
  addCommit: (commit: ExecutionState['commits'][0]) => void;
  setPaused: (paused: boolean) => void;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  agentId: null,
  status: 'idle',
  tddPhase: null,
  plans: new Map(),
  pendingCheckpoint: null,
  selectedFile: null,
  commits: [],

  startExecution: (agentId, planId, taskName) =>
    set((state) => {
      const plans = new Map(state.plans);
      plans.set(planId, {
        planId,
        taskName,
        status: 'running',
        logs: '',
        toolCalls: [],
        startTime: Date.now(),
      });
      return { agentId, status: 'running', plans };
    }),

  appendLog: (planId, token) =>
    set((state) => {
      const plans = new Map(state.plans);
      const plan = plans.get(planId);
      if (plan) {
        plans.set(planId, { ...plan, logs: plan.logs + token });
      }
      return { plans };
    }),

  startTool: (planId, event) =>
    set((state) => {
      const plans = new Map(state.plans);
      const plan = plans.get(planId);
      if (plan) {
        const toolCalls = [
          ...plan.toolCalls,
          {
            toolId: event.toolId,
            toolName: event.toolName,
            input: event.input,
            startTime: Date.now(),
          },
        ];
        plans.set(planId, { ...plan, toolCalls });
      }
      return { plans };
    }),

  endTool: (planId, event) =>
    set((state) => {
      const plans = new Map(state.plans);
      const plan = plans.get(planId);
      if (plan) {
        const toolCalls = plan.toolCalls.map((tc) =>
          tc.toolId === event.toolId
            ? { ...tc, output: event.output, success: event.success, duration: event.duration }
            : tc
        );
        plans.set(planId, { ...plan, toolCalls });
      }
      return { plans };
    }),

  setCheckpoint: (checkpoint) => set({ pendingCheckpoint: checkpoint }),
  setTddPhase: (tddPhase) => set({ tddPhase }),
  selectFile: (selectedFile) => set({ selectedFile }),
  addCommit: (commit) => set((state) => ({ commits: [...state.commits, commit] })),
  setPaused: (paused) => set({ status: paused ? 'paused' : 'running' }),
  reset: () =>
    set({
      agentId: null,
      status: 'idle',
      tddPhase: null,
      plans: new Map(),
      pendingCheckpoint: null,
      selectedFile: null,
      commits: [],
    }),
}));
```

### Anti-Patterns to Avoid
- **Creating new socket connections per component:** Use single socket from context/hook; subscribe to agent rooms
- **Not buffering tokens:** Direct DOM updates per token cause jank; use `createTokenBuffer` with RAF
- **Monaco editor re-renders:** Use `key` prop or memoization to prevent editor recreation on content change
- **Blocking main thread with large diffs:** Load Monaco lazily; show loading skeleton while initializing
- **Checkbox input for pause:** Use button that clearly communicates state; avoid ambiguous controls

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diff editor | Custom line-by-line diff | @monaco-editor/react DiffEditor | Syntax highlighting, side-by-side, minimap |
| Countdown timer | Custom setInterval timer | react-countdown-circle-timer | Visual progress, color transitions, cleanup |
| Resizable panels | Custom resize observers | react-resizable-panels | Keyboard support, persistence, constraints |
| Modal dialogs | Custom overlay + focus trap | @radix-ui/react-dialog | Focus management, escape handling, portal |
| Collapsible sections | Custom height animation | @radix-ui/react-accordion | Keyboard nav, ARIA, smooth animation |
| Token buffering | Custom RAF implementation | createTokenBuffer from @gsd/events | Already implemented, tested, 1000 cap |

**Key insight:** The `@gsd/events` package already provides `createTokenBuffer` that uses RAF batching with a 1000 token cap. Use it directly rather than reimplementing.

## Common Pitfalls

### Pitfall 1: Monaco Editor Bundle Size
**What goes wrong:** Massive initial bundle (>1MB) slows first load
**Why it happens:** Monaco includes all languages by default
**How to avoid:** Use `@monaco-editor/react` which loads Monaco from CDN by default; configure language subset if bundling
**Warning signs:** Long initial page load; large JS chunks in build output

### Pitfall 2: Socket Event Memory Leaks
**What goes wrong:** Listeners accumulate; events fire multiple times
**Why it happens:** Not cleaning up event listeners on unmount or re-subscribe
**How to avoid:** Return cleanup function from useEffect; use `.off()` in cleanup
**Warning signs:** Duplicate log entries; increasing memory usage

### Pitfall 3: Auto-scroll Jank
**What goes wrong:** Page stutters during log streaming; scroll position jumps
**Why it happens:** Forcing scroll on every token; layout thrashing
**How to avoid:** Batch tokens with RAF; only scroll when autoScroll is true; use `scrollIntoView` sparingly
**Warning signs:** Visible stutter; scroll bar jumping

### Pitfall 4: Checkpoint Response Race Condition
**What goes wrong:** User responds but UI doesn't update; duplicate responses
**Why it happens:** Checkpoint cleared before response confirmed; no idempotency
**How to avoid:** Wait for server acknowledgment before clearing modal; backend handles idempotency
**Warning signs:** Modal reopens; error about duplicate response

### Pitfall 5: Monaco Theme Mismatch
**What goes wrong:** Editor shows light theme when page is dark mode
**Why it happens:** Monaco theme not synced with app theme
**How to avoid:** Use `theme={isDark ? 'vs-dark' : 'vs'}` with next-themes; sync on theme change
**Warning signs:** Jarring white editor in dark mode

### Pitfall 6: Execution State Not Persisted on Reconnect
**What goes wrong:** User loses execution context after refresh
**Why it happens:** Zustand state is ephemeral; no session recovery
**How to avoid:** Store executionId in URL; backend returns current state on reconnect; use `getPendingCheckpointsForAgent`
**Warning signs:** Blank page after refresh; lost progress

## Code Examples

Verified patterns from official sources:

### Agent Subscription Hook
```typescript
// Source: Socket.IO React patterns + @gsd/events
// hooks/useAgentSubscription.ts
'use client';

import { useEffect } from 'react';
import { EVENTS } from '@gsd/events';
import type { TypedSocket } from '@gsd/events';
import { useExecutionStore } from '@/stores/executionStore';
import { useTokenBuffer } from './useTokenBuffer';

export function useAgentSubscription(socket: TypedSocket | null, agentId: string | null) {
  const store = useExecutionStore();

  // Buffer for token streaming
  const { push: pushToken } = useTokenBuffer((tokens) => {
    if (agentId) {
      // Find the active plan and append
      const plans = Array.from(store.plans.values());
      const activePlan = plans.find((p) => p.status === 'running');
      if (activePlan) {
        store.appendLog(activePlan.planId, tokens);
      }
    }
  });

  useEffect(() => {
    if (!socket || !agentId) return;

    // Subscribe to agent room
    socket.emit('agent:subscribe', agentId);

    // Event handlers
    const onToken = (event: { token: string }) => pushToken(event.token);
    const onStart = (event: { planId: string; taskName: string }) =>
      store.startExecution(agentId, event.planId, event.taskName);
    const onToolStart = (event: { toolId: string; toolName: string; input: unknown }) => {
      const plans = Array.from(store.plans.values());
      const activePlan = plans.find((p) => p.status === 'running');
      if (activePlan) {
        store.startTool(activePlan.planId, event as any);
      }
    };
    const onToolEnd = (event: { toolId: string; success: boolean; output: string; duration: number }) => {
      const plans = Array.from(store.plans.values());
      const activePlan = plans.find((p) => p.status === 'running');
      if (activePlan) {
        store.endTool(activePlan.planId, event as any);
      }
    };
    const onCheckpoint = store.setCheckpoint;

    socket.on(EVENTS.AGENT_TOKEN, onToken);
    socket.on(EVENTS.AGENT_START, onStart);
    socket.on(EVENTS.TOOL_START, onToolStart);
    socket.on(EVENTS.TOOL_END, onToolEnd);
    socket.on(EVENTS.CHECKPOINT_REQUEST, onCheckpoint);

    return () => {
      socket.emit('agent:unsubscribe', agentId);
      socket.off(EVENTS.AGENT_TOKEN, onToken);
      socket.off(EVENTS.AGENT_START, onStart);
      socket.off(EVENTS.TOOL_START, onToolStart);
      socket.off(EVENTS.TOOL_END, onToolEnd);
      socket.off(EVENTS.CHECKPOINT_REQUEST, onCheckpoint);
    };
  }, [socket, agentId, pushToken, store]);
}
```

### TDD Progress Indicator
```typescript
// Source: CONTEXT.md requirements + Tailwind patterns
// components/features/execute/TddIndicator.tsx
'use client';

interface Props {
  phase: 'red' | 'green' | 'refactor' | null;
}

const phases = [
  { id: 'red', label: 'Red', color: 'bg-red-500', activeColor: 'bg-red-600 ring-2 ring-red-400' },
  { id: 'green', label: 'Green', color: 'bg-green-500', activeColor: 'bg-green-600 ring-2 ring-green-400' },
  { id: 'refactor', label: 'Refactor', color: 'bg-blue-500', activeColor: 'bg-blue-600 ring-2 ring-blue-400' },
] as const;

export function TddIndicator({ phase }: Props) {
  if (!phase) return null;

  return (
    <div className="flex items-center gap-2" role="group" aria-label="TDD Phase Progress">
      {phases.map((p, index) => {
        const isActive = p.id === phase;
        const isPast = phases.findIndex((x) => x.id === phase) > index;

        return (
          <div key={p.id} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold
                ${isActive ? p.activeColor : isPast ? p.color : 'bg-zinc-300 dark:bg-zinc-700'}`}
              aria-current={isActive ? 'step' : undefined}
            >
              {index + 1}
            </div>
            <span className={`text-sm ${isActive ? 'font-bold' : 'text-muted-foreground'}`}>
              {p.label}
            </span>
            {index < phases.length - 1 && (
              <div className={`w-8 h-0.5 ${isPast ? 'bg-zinc-400' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

### Resizable Diff Panel
```typescript
// Source: https://github.com/bvaughn/react-resizable-panels
// components/features/execute/ExecutionPanel.tsx (partial)
'use client';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { PipelineView } from './PipelineView';
import { DiffPanel } from './DiffPanel';

export function ExecutionPanel() {
  return (
    <PanelGroup direction="horizontal" className="h-full">
      <Panel defaultSize={70} minSize={50}>
        <PipelineView waves={[]} />
      </Panel>

      <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />

      <Panel defaultSize={30} minSize={20}>
        <DiffPanel />
      </Panel>
    </PanelGroup>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-monaco-editor | @monaco-editor/react | 2022 | CDN loading, no webpack config needed |
| Custom resize observers | react-resizable-panels | 2023 | Better DX, keyboard support, shadcn compatible |
| setInterval for timers | react-countdown-circle-timer | 2021+ | Cleaner API, visual progress, color transitions |
| Redux for UI state | Zustand | 2022+ | Smaller bundle, simpler API |
| Manual token batching | createTokenBuffer (@gsd/events) | Phase 13 | Already implemented, tested |

**Deprecated/outdated:**
- `react-diff-viewer`: Monaco DiffEditor is more powerful
- `react-json-view`: For tool input display, use plain syntax-highlighted code
- Manual focus traps: Use @radix-ui/react-dialog

## Open Questions

1. **TDD Phase Detection**
   - What we know: QUAL-01 requires showing Red/Green/Refactor phases; backend doesn't currently emit TDD state
   - What's unclear: How does backend determine TDD phase? From test output parsing? From plan metadata?
   - Recommendation: Add optional `tddPhase` field to `agent:phase` event; or emit separate `tdd:phase` event. May require backend enhancement in separate task.

2. **Commit Timeline Data Source**
   - What we know: CONTEXT.md says show "X commits made [View]"; backend doesn't emit commit events
   - What's unclear: Should commits be fetched via git log after file writes, or emitted as events?
   - Recommendation: Add `git:commit` event to backend when tool executes git commit; or poll git log periodically. Event-based is cleaner.

3. **Pause/Resume API**
   - What we know: EXEC-06 requires pause and resume
   - What's unclear: Current orchestrator has `cancelAgent` but no pause API
   - Recommendation: Add `PATCH /api/agents/:id` with `{ status: 'paused' | 'running' }` body. Backend pauses before next Claude call.

4. **Rollback on Abort**
   - What we know: CONTEXT.md says abort should "offer rollback option"
   - What's unclear: How to implement rollback? Git reset? To which commit?
   - Recommendation: Track commit SHAs created during execution; rollback = `git reset --hard <sha-before-execution>`. Show confirmation with file/commit list.

## Sources

### Primary (HIGH confidence)
- [@monaco-editor/react GitHub](https://github.com/suren-atoyan/monaco-react) - DiffEditor API, configuration
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) - Panel layout API
- [react-countdown-circle-timer npm](https://www.npmjs.com/package/react-countdown-circle-timer) - Timer configuration
- [@radix-ui/react-dialog](https://www.radix-ui.com/primitives/docs/components/dialog) - Modal primitives
- [@gsd/events source](/Users/mauricevandermerwe/Projects/get-shit-done/packages/events/src) - Socket.IO types, createTokenBuffer
- [Existing orchestrator source](/Users/mauricevandermerwe/Projects/get-shit-done/apps/server/src/orchestrator) - Backend event emission

### Secondary (MEDIUM confidence)
- [Socket.IO React patterns](https://socket.io/how-to/use-with-react) - Connection management
- [LogRocket Monaco tutorial](https://blog.logrocket.com/build-web-editor-with-react-monaco-editor/) - Monaco best practices
- [Phase 15 Research](/Users/mauricevandermerwe/Projects/get-shit-done/.planning/phases/15-frontend-foundation-dashboard/15-RESEARCH.md) - Established frontend patterns

### Tertiary (LOW confidence)
- TDD phase detection approach - Needs backend confirmation
- Git commit event approach - Needs backend confirmation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Extends Phase 15 patterns; verified library docs
- Architecture: HIGH - Follows established monorepo structure; leverages existing packages
- Component patterns: HIGH - Based on official library docs and CONTEXT.md requirements
- Backend extensions: MEDIUM - May need orchestrator enhancements for TDD phases, pause, commits

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (30 days - stable technologies)
