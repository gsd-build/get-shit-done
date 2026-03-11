# Phase 18: Plan & Verify Phase UIs - Research

**Researched:** 2026-03-11
**Domain:** Research streaming visualization, plan preview with Kanban layout, verification reports with heatmaps, and gap approval workflow
**Confidence:** HIGH

## Summary

This phase implements two major UI workflows: **Planning** (research streaming with swimlanes, plan preview with Kanban waves, inline editing) and **Verification** (test results streaming, requirement coverage heatmap, gap severity badges, manual checklist, approval/rejection with automatic gap routing). The phase builds on the frontend foundation from Phase 15 (Next.js 15, Tailwind v4, Zustand, Radix UI) and the execution patterns from Phase 17.

The research streaming visualization uses a swimlane layout inspired by GitHub Actions, where each parallel researcher agent gets a horizontal lane showing status, elapsed time, and current action. This is simpler than Phase 17's wave-based pipeline since researchers run in parallel without wave dependencies. The plan preview uses a Kanban-style column layout (one column per wave) with cards representing tasks and connecting lines showing dependencies. Users can edit task titles and descriptions inline (but not wave assignments or dependencies to prevent breaking the plan structure).

The verification workflow displays live streaming test results as they execute, a pass/fail requirement report with expandable evidence trails, a heatmap grid showing requirement-to-phase coverage, and a manual test checklist with checkboxes and notes. The approval flow uses two-step confirmation (action then modal) to prevent accidents, with rejection auto-routing to gap planning.

**Primary recommendation:** Use CSS Grid for swimlane visualization (simpler than full swimlane libraries), dnd-kit for Kanban drag/drop (established, maintained), react-grid-heatmap for the coverage matrix (lightweight, customizable), and @radix-ui primitives for modals/accordions (consistent with existing codebase).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Swimlanes layout for parallel researcher agents - each agent gets a horizontal lane showing timeline progress
- Medium detail level: show running/complete status, elapsed time, AND current action (e.g., "Reading src/api/...")
- Expandable summary in lane when agent completes - collapsed by default, click to expand full findings
- Red lane with inline error message for failures - immediate visibility, in context
- Kanban columns by wave - tasks grouped in columns (Wave 1, Wave 2, ...) emphasizing parallel execution
- Connecting lines between cards to show dependencies - visual arrows showing which tasks feed into others
- Click card to edit inline - card expands in-place with editable fields, quick edits stay in context
- Title and description only editable - wave assignment and dependencies stay as-is to prevent breaking dependencies
- Header summary + drill-down list - big pass/fail summary at top, expandable list of requirements below
- Evidence trail for failed requirements - show what was checked, expected vs actual, relevant code snippets
- Heatmap grid for requirement coverage matrix - requirements vs phases matrix with color-coded coverage
- Live streaming with incremental results - show tests passing/failing as they run for immediate feedback
- Color-coded severity badges: red (Blocking), orange (Major), yellow (Minor) - instant visual priority
- Checkboxes with optional notes for manual test checklist - simple pass/fail, optional note field for context
- Two-step confirmation for approval/rejection - click action, then confirm in modal to prevent accidents
- Auto-route to gap planning after gap selection - user selects gaps, clicks Reject, automatically spawns planning

### Claude's Discretion
- Exact swimlane animation and timing
- Card hover states and transitions
- Heatmap color gradients and thresholds
- Loading/skeleton states during streaming
- Error boundary and recovery UI

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAN-01 | User can see real-time progress as researcher agents spawn, run, and complete | Swimlane component with CSS Grid rows; Socket.IO `agent:start`/`agent:token`/`agent:end` events; RAF token buffering |
| PLAN-02 | User can preview generated plans with task breakdown and wave grouping | Kanban component with columns per wave; task cards with dependencies; `@dnd-kit/core` for drag interactions |
| PLAN-03 | User can see verification feedback with specific issues highlighted per plan | Accordion with plan issues; severity badges; expandable evidence sections |
| PLAN-04 | User can view requirement coverage matrix showing requirement-to-phase mapping | `react-grid-heatmap` for coverage matrix; color scale from uncovered (red) to covered (green) |
| PLAN-05 | User can edit plan tasks inline before execution | Controlled contenteditable or textarea; save/cancel actions; optimistic UI updates |
| VERIF-01 | User can view verification report with pass/fail status per requirement | Report header with summary stats; expandable requirement list; pass/fail badges |
| VERIF-02 | User can see gaps highlighted with severity levels (blocking, major, minor) | Severity badges with color coding (red/orange/yellow); filter by severity |
| VERIF-03 | Verification executes all tests automatically before displaying results | Test runner integration; streaming results via Socket.IO; progress indicator |
| VERIF-04 | Verification validates that all success criteria are genuinely met | Evidence trail component; expected vs actual display; code snippets |
| VERIF-05 | User can mark manual test items as pass/fail in checklist | Checkbox components with optional note field; state persistence |
| VERIF-06 | User can approve completed work or reject with gap selection | Two-button action bar; gap selection modal; confirmation dialog |
| VERIF-07 | Rejection routes to plan-phase --gaps to create fix plans automatically | API call to spawn gap planning agent; redirect to planning view |
</phase_requirements>

## Standard Stack

### Core (Inherited from Phase 15)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x | React framework with App Router | Established in Phase 15 |
| React | 19.x | UI library | Bundled with Next.js 15 |
| Tailwind CSS | 4.x | Utility-first CSS | CSS-first config, established in Phase 15 |
| TypeScript | 5.4+ | Type safety | Full monorepo support |
| Zustand | 5.x | Client-side state | UI state, planning state, verification state |
| @gsd/events | workspace | Socket.IO client types + utilities | `createSocketClient`, `createTokenBuffer`, typed events |
| @radix-ui/react-* | 1.x | Accessible primitives | Dialog, Accordion, Checkbox - Phase 15 established |
| lucide-react | 0.400+ | Icon library | Consistent with Phase 15/17 |

### Phase 18 Specific
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @dnd-kit/core | 6.3.x | Drag and drop core | Kanban card reordering (if needed) |
| @dnd-kit/sortable | 8.x | Sortable list primitives | Task reordering within waves |
| react-grid-heatmap | 1.x | Grid-based heatmap | Requirement coverage matrix (PLAN-04) |
| @radix-ui/react-checkbox | 1.x | Checkbox primitive | Manual test checklist (VERIF-05) |
| react-contenteditable | 3.x | Contenteditable wrapper | Inline task editing (PLAN-05) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS Grid swimlanes | timelines-chart | timelines-chart is heavier; CSS Grid sufficient for horizontal lanes |
| react-grid-heatmap | MUI X Heatmap | MUI X requires MUI ecosystem; react-grid-heatmap is standalone |
| @dnd-kit | pragmatic-drag-and-drop | Atlassian's library is newer but @dnd-kit has larger ecosystem |
| Custom Kanban | react-kanban-kit | Custom gives more control for dependency lines; library adds overhead |
| contenteditable | Slate/Draft.js | Slate/Draft overkill for single-field editing |

**Installation:**
```bash
# In apps/web directory
pnpm add @dnd-kit/core @dnd-kit/sortable react-grid-heatmap react-contenteditable
pnpm add @radix-ui/react-checkbox
# @radix-ui/react-dialog, @radix-ui/react-accordion already from Phase 17
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── components/
│   └── features/
│       ├── plan/
│       │   ├── ResearchSwimlanes.tsx    # Parallel agent visualization
│       │   ├── AgentLane.tsx            # Single researcher lane
│       │   ├── AgentSummary.tsx         # Expandable findings summary
│       │   ├── PlanKanban.tsx           # Wave-based Kanban board
│       │   ├── WaveColumn.tsx           # Single wave column
│       │   ├── TaskCard.tsx             # Draggable task card
│       │   ├── DependencyLines.tsx      # SVG dependency arrows
│       │   ├── InlineEditor.tsx         # Contenteditable task editor
│       │   └── PlanPreviewHeader.tsx    # Plan actions and metadata
│       └── verify/
│           ├── VerificationPanel.tsx    # Main verification container
│           ├── ReportHeader.tsx         # Pass/fail summary stats
│           ├── RequirementList.tsx      # Expandable requirement items
│           ├── RequirementItem.tsx      # Single requirement with evidence
│           ├── EvidenceTrail.tsx        # Expected vs actual display
│           ├── CoverageHeatmap.tsx      # Requirement-phase matrix
│           ├── ManualChecklist.tsx      # Manual test checkboxes
│           ├── GapList.tsx              # Gaps with severity badges
│           ├── SeverityBadge.tsx        # Blocking/Major/Minor badge
│           ├── ApprovalBar.tsx          # Approve/Reject actions
│           └── GapSelectionModal.tsx    # Gap selection for rejection
├── hooks/
│   ├── useResearchStream.ts             # Research agent subscription
│   ├── usePlanPreview.ts                # Plan loading and editing
│   └── useVerification.ts               # Verification state and results
├── stores/
│   ├── planStore.ts                     # Plan preview state
│   └── verificationStore.ts             # Verification results state
└── app/
    └── projects/
        └── [id]/
            ├── plan/
            │   └── page.tsx             # Plan phase page
            └── verify/
                └── page.tsx             # Verify work page
```

### Pattern 1: Research Swimlane Visualization
**What:** Horizontal lanes for parallel researcher agents using CSS Grid
**When to use:** PLAN-01 research progress visualization
**Example:**
```typescript
// Source: CONTEXT.md + CSS Grid patterns
// components/features/plan/ResearchSwimlanes.tsx
'use client';

import { AgentLane } from './AgentLane';

interface ResearchAgent {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  currentAction?: string;
  elapsedMs: number;
  summary?: string;
  error?: string;
}

interface Props {
  agents: ResearchAgent[];
  onAgentClick?: (agentId: string) => void;
}

export function ResearchSwimlanes({ agents, onAgentClick }: Props) {
  return (
    <div
      className="grid grid-rows-[auto] gap-2 p-4"
      role="list"
      aria-label="Research agents"
    >
      {agents.map((agent) => (
        <AgentLane
          key={agent.id}
          agent={agent}
          onClick={() => onAgentClick?.(agent.id)}
        />
      ))}
    </div>
  );
}
```

### Pattern 2: Kanban with Dependency Lines
**What:** Column-based task layout with SVG arrows for dependencies
**When to use:** PLAN-02 plan preview with wave grouping
**Example:**
```typescript
// Source: CONTEXT.md requirements + SVG patterns
// components/features/plan/PlanKanban.tsx
'use client';

import { useRef, useEffect, useState } from 'react';
import { WaveColumn } from './WaveColumn';
import { DependencyLines } from './DependencyLines';

interface Task {
  id: string;
  title: string;
  description: string;
  wave: number;
  dependsOn: string[];
}

interface Props {
  tasks: Task[];
  onTaskEdit: (taskId: string, updates: Partial<Task>) => void;
}

export function PlanKanban({ tasks, onTaskEdit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardPositions, setCardPositions] = useState<Map<string, DOMRect>>(new Map());

  // Group tasks by wave
  const waves = tasks.reduce((acc, task) => {
    const wave = task.wave;
    if (!acc[wave]) acc[wave] = [];
    acc[wave].push(task);
    return acc;
  }, {} as Record<number, Task[]>);

  const waveNumbers = Object.keys(waves).map(Number).sort((a, b) => a - b);

  // Track card positions for dependency lines
  useEffect(() => {
    const updatePositions = () => {
      const positions = new Map<string, DOMRect>();
      tasks.forEach((task) => {
        const el = document.getElementById(`task-${task.id}`);
        if (el) {
          positions.set(task.id, el.getBoundingClientRect());
        }
      });
      setCardPositions(positions);
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [tasks]);

  return (
    <div ref={containerRef} className="relative">
      {/* SVG overlay for dependency lines */}
      <DependencyLines
        tasks={tasks}
        cardPositions={cardPositions}
        containerRef={containerRef}
      />

      {/* Kanban columns */}
      <div className="grid auto-cols-[300px] grid-flow-col gap-4 overflow-x-auto p-4">
        {waveNumbers.map((waveNum) => (
          <WaveColumn
            key={waveNum}
            waveNumber={waveNum}
            tasks={waves[waveNum]}
            onTaskEdit={onTaskEdit}
          />
        ))}
      </div>
    </div>
  );
}
```

### Pattern 3: Requirement Coverage Heatmap
**What:** Grid-based heatmap showing requirement-to-phase coverage
**When to use:** PLAN-04 coverage matrix
**Example:**
```typescript
// Source: react-grid-heatmap + CONTEXT.md
// components/features/verify/CoverageHeatmap.tsx
'use client';

import HeatMap from 'react-grid-heatmap';

interface Coverage {
  requirementId: string;
  phaseId: string;
  coverage: number; // 0 = uncovered, 1 = partial, 2 = covered
}

interface Props {
  requirements: string[];
  phases: string[];
  coverageData: Coverage[];
}

export function CoverageHeatmap({ requirements, phases, coverageData }: Props) {
  // Build matrix: rows = requirements, cols = phases
  const matrix = requirements.map((reqId) =>
    phases.map((phaseId) => {
      const cell = coverageData.find(
        (c) => c.requirementId === reqId && c.phaseId === phaseId
      );
      return cell?.coverage ?? 0;
    })
  );

  return (
    <div className="overflow-auto">
      <HeatMap
        xLabels={phases}
        yLabels={requirements}
        data={matrix}
        cellStyle={(_, __, value) => ({
          background:
            value === 0
              ? 'rgb(239, 68, 68)' // red - uncovered
              : value === 1
              ? 'rgb(250, 204, 21)' // yellow - partial
              : 'rgb(34, 197, 94)', // green - covered
          fontSize: '0.75rem',
          borderRadius: '4px',
        })}
        cellHeight="32px"
        xLabelsPos="top"
        yLabelsPos="left"
      />
    </div>
  );
}
```

### Pattern 4: Manual Test Checklist
**What:** Checkbox list with optional notes for manual verification
**When to use:** VERIF-05 manual test items
**Example:**
```typescript
// Source: @radix-ui/react-checkbox + CONTEXT.md
// components/features/verify/ManualChecklist.tsx
'use client';

import * as Checkbox from '@radix-ui/react-checkbox';
import { CheckIcon } from 'lucide-react';
import { useState } from 'react';

interface ManualTest {
  id: string;
  description: string;
  passed: boolean | null;
  note?: string;
}

interface Props {
  tests: ManualTest[];
  onTestUpdate: (testId: string, passed: boolean, note?: string) => void;
}

export function ManualChecklist({ tests, onTestUpdate }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground">Manual Test Checklist</h3>
      {tests.map((test) => (
        <ManualTestItem
          key={test.id}
          test={test}
          onUpdate={(passed, note) => onTestUpdate(test.id, passed, note)}
        />
      ))}
    </div>
  );
}

function ManualTestItem({
  test,
  onUpdate,
}: {
  test: ManualTest;
  onUpdate: (passed: boolean, note?: string) => void;
}) {
  const [note, setNote] = useState(test.note || '');
  const [showNote, setShowNote] = useState(!!test.note);

  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-start gap-3">
        <Checkbox.Root
          checked={test.passed === true}
          onCheckedChange={(checked) => onUpdate(!!checked, note)}
          className="w-5 h-5 border border-border rounded flex items-center justify-center data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        >
          <Checkbox.Indicator>
            <CheckIcon className="w-4 h-4 text-primary-foreground" />
          </Checkbox.Indicator>
        </Checkbox.Root>

        <div className="flex-1">
          <p className="text-sm text-foreground">{test.description}</p>
          {showNote ? (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => onUpdate(test.passed ?? false, note)}
              placeholder="Add a note..."
              className="mt-2 w-full px-2 py-1 text-sm border border-border rounded resize-none"
              rows={2}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowNote(true)}
              className="mt-1 text-xs text-muted-foreground hover:text-foreground"
            >
              + Add note
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Pattern 5: Two-Step Approval Flow
**What:** Action bar with confirmation modal for approve/reject
**When to use:** VERIF-06 approval workflow
**Example:**
```typescript
// Source: @radix-ui/react-dialog + CONTEXT.md
// components/features/verify/ApprovalBar.tsx
'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

interface Gap {
  id: string;
  description: string;
  severity: 'blocking' | 'major' | 'minor';
}

interface Props {
  gaps: Gap[];
  onApprove: () => void;
  onReject: (selectedGapIds: string[]) => void;
}

export function ApprovalBar({ gaps, onApprove, onReject }: Props) {
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedGaps, setSelectedGaps] = useState<string[]>([]);

  const hasBlockingGaps = gaps.some((g) => g.severity === 'blocking');

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 flex justify-end gap-4">
      {/* Reject Button */}
      <button
        type="button"
        onClick={() => setShowRejectModal(true)}
        className="px-4 py-2 bg-error text-white rounded-md hover:bg-error/90"
      >
        Reject with Gaps
      </button>

      {/* Approve Button */}
      <button
        type="button"
        onClick={() => setShowApproveConfirm(true)}
        disabled={hasBlockingGaps}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Approve
      </button>

      {/* Approve Confirmation Modal */}
      <Dialog.Root open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card p-6 rounded-lg shadow-lg max-w-md w-full">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Confirm Approval
            </Dialog.Title>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to approve this phase? This will mark all requirements as completed.
            </p>
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="px-4 py-2 text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => { onApprove(); setShowApproveConfirm(false); }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
              >
                Confirm Approval
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Gap Selection Modal */}
      <GapSelectionModal
        open={showRejectModal}
        gaps={gaps}
        selectedGaps={selectedGaps}
        onSelectionChange={setSelectedGaps}
        onConfirm={() => { onReject(selectedGaps); setShowRejectModal(false); }}
        onCancel={() => setShowRejectModal(false)}
      />
    </div>
  );
}
```

### Pattern 6: Live Streaming Test Results
**What:** Incremental test result display as tests execute
**When to use:** VERIF-03 automatic test execution
**Example:**
```typescript
// Source: Socket.IO patterns + CONTEXT.md
// hooks/useVerification.ts
'use client';

import { useEffect, useCallback } from 'react';
import { EVENTS } from '@gsd/events';
import type { TypedSocket } from '@gsd/events';
import { useVerificationStore } from '@/stores/verificationStore';

interface TestResult {
  requirementId: string;
  testName: string;
  passed: boolean;
  message?: string;
  duration: number;
}

export function useVerification(socket: TypedSocket | null, phaseId: string) {
  const store = useVerificationStore();

  useEffect(() => {
    if (!socket || !phaseId) return;

    // Subscribe to verification events
    socket.emit('verification:subscribe', phaseId);

    const onTestStart = (event: { testName: string }) => {
      store.setRunningTest(event.testName);
    };

    const onTestResult = (result: TestResult) => {
      store.addTestResult(result);
    };

    const onVerificationComplete = (event: { passed: boolean; summary: string }) => {
      store.setComplete(event.passed, event.summary);
    };

    socket.on('verification:test_start', onTestStart);
    socket.on('verification:test_result', onTestResult);
    socket.on('verification:complete', onVerificationComplete);

    return () => {
      socket.emit('verification:unsubscribe', phaseId);
      socket.off('verification:test_start', onTestStart);
      socket.off('verification:test_result', onTestResult);
      socket.off('verification:complete', onVerificationComplete);
    };
  }, [socket, phaseId, store]);

  const startVerification = useCallback(async () => {
    const response = await fetch(`/api/phases/${phaseId}/verify`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to start verification');
    store.setRunning();
  }, [phaseId, store]);

  return {
    ...store,
    startVerification,
  };
}
```

### Anti-Patterns to Avoid
- **Editing dependencies via Kanban drag:** Users can drag cards but dependencies should NOT be auto-updated; per CONTEXT.md, wave assignment and dependencies stay fixed
- **Blocking UI during test execution:** Show incremental results as they stream; don't wait for all tests to complete
- **Inline editing with uncontrolled contenteditable:** Use controlled state with react-contenteditable; uncontrolled causes React warnings and sync issues
- **Single-step critical actions:** Approval and rejection MUST have confirmation step per CONTEXT.md
- **Heatmap without legend:** Always show what colors mean (uncovered/partial/covered)
- **Lost edits on navigation:** Persist inline edits immediately or warn before navigation

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag and drop | Custom pointer events | @dnd-kit/core + sortable | Accessibility, touch support, keyboard nav |
| Heatmap grid | Manual cell rendering | react-grid-heatmap | Color scales, responsive, accessibility |
| Checkbox with label | Custom checkbox div | @radix-ui/react-checkbox | ARIA, keyboard, focus states |
| Modal dialogs | Custom overlay + focus trap | @radix-ui/react-dialog | Portal, focus management, escape handling |
| Contenteditable wrapper | Raw contentEditable | react-contenteditable | Controlled updates, event normalization |
| SVG arrow paths | Manual path calculation | Consider react-xarrows | Bezier curves, anchor points (evaluate first) |

**Key insight:** For dependency lines between Kanban cards, a simple SVG approach with straight lines may suffice initially. Libraries like react-xarrows add complexity; evaluate whether simple paths work before adding a dependency.

## Common Pitfalls

### Pitfall 1: Swimlane Layout Overflow
**What goes wrong:** Agent lanes overflow container when many agents run
**Why it happens:** Fixed heights or no scroll container
**How to avoid:** Use `overflow-auto` on container; consider virtualization for >10 agents
**Warning signs:** Lanes push footer off-screen; horizontal scrollbar when not expected

### Pitfall 2: Dependency Line Position Drift
**What goes wrong:** SVG arrows don't point to correct cards after resize/scroll
**Why it happens:** Card positions cached and not updated
**How to avoid:** Recalculate positions on resize, scroll, and task reorder; use ResizeObserver
**Warning signs:** Lines pointing to wrong cards; lines outside visible area

### Pitfall 3: Inline Edit Focus Loss
**What goes wrong:** User loses cursor position when typing; changes not saved
**Why it happens:** React re-renders reset contenteditable; blur events not handled
**How to avoid:** Use react-contenteditable with onChange; save on blur; debounce updates
**Warning signs:** Cursor jumps to end; typed text disappears

### Pitfall 4: Heatmap Color Accessibility
**What goes wrong:** Color-blind users can't distinguish coverage levels
**Why it happens:** Relying only on red/yellow/green
**How to avoid:** Add icons or patterns in addition to colors; use colorblind-safe palette
**Warning signs:** User feedback about confusion; accessibility audit failures

### Pitfall 5: Approval Without Test Completion
**What goes wrong:** User approves while tests still running
**Why it happens:** No guard for in-progress verification
**How to avoid:** Disable approval button while tests running; show progress indicator
**Warning signs:** Approval submitted with incomplete results

### Pitfall 6: Gap Selection State Loss
**What goes wrong:** User selects gaps, modal closes, selections lost
**Why it happens:** State lives only in modal component
**How to avoid:** Lift selection state to parent; persist to store; restore on modal reopen
**Warning signs:** Empty selection after modal close/reopen

## Code Examples

Verified patterns from official sources:

### Severity Badge Component
```typescript
// Source: CONTEXT.md requirements + Tailwind patterns
// components/features/verify/SeverityBadge.tsx
'use client';

import { clsx } from 'clsx';

type Severity = 'blocking' | 'major' | 'minor';

interface Props {
  severity: Severity;
  className?: string;
}

const severityConfig: Record<Severity, { bg: string; text: string; label: string }> = {
  blocking: { bg: 'bg-red-500', text: 'text-white', label: 'Blocking' },
  major: { bg: 'bg-orange-500', text: 'text-white', label: 'Major' },
  minor: { bg: 'bg-yellow-400', text: 'text-black', label: 'Minor' },
};

export function SeverityBadge({ severity, className }: Props) {
  const config = severityConfig[severity];

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      {config.label}
    </span>
  );
}
```

### Agent Lane Component
```typescript
// Source: CONTEXT.md swimlane requirements
// components/features/plan/AgentLane.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface ResearchAgent {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  currentAction?: string;
  elapsedMs: number;
  summary?: string;
  error?: string;
}

interface Props {
  agent: ResearchAgent;
  onClick?: () => void;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function AgentLane({ agent, onClick }: Props) {
  const [expanded, setExpanded] = useState(false);

  const isError = agent.status === 'error';
  const isComplete = agent.status === 'complete';
  const isRunning = agent.status === 'running';

  return (
    <div
      className={clsx(
        'border rounded-lg p-3 transition-colors',
        isError && 'border-red-500 bg-red-50 dark:bg-red-900/20',
        isComplete && 'border-green-500/50 bg-green-50/50 dark:bg-green-900/10',
        isRunning && 'border-primary bg-primary/5',
        !isError && !isComplete && !isRunning && 'border-border'
      )}
      role="listitem"
    >
      <div className="flex items-center gap-3">
        {/* Status Icon */}
        {isComplete && <CheckCircle className="w-5 h-5 text-green-500" />}
        {isError && <XCircle className="w-5 h-5 text-red-500" />}
        {isRunning && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
        {agent.status === 'pending' && <div className="w-5 h-5 border-2 border-muted rounded-full" />}

        {/* Agent Name */}
        <span className="font-medium text-foreground flex-1">{agent.name}</span>

        {/* Current Action / Error */}
        {isRunning && agent.currentAction && (
          <span className="text-sm text-muted-foreground truncate max-w-xs">
            {agent.currentAction}
          </span>
        )}
        {isError && (
          <span className="text-sm text-red-600 dark:text-red-400 truncate max-w-xs">
            {agent.error}
          </span>
        )}

        {/* Elapsed Time */}
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatElapsed(agent.elapsedMs)}
        </span>

        {/* Expand Button (for complete) */}
        {isComplete && agent.summary && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-1 hover:bg-muted rounded"
            aria-label={expanded ? 'Collapse summary' : 'Expand summary'}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Expandable Summary */}
      {expanded && agent.summary && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{agent.summary}</p>
        </div>
      )}
    </div>
  );
}
```

### Verification Store
```typescript
// Source: Zustand patterns + CONTEXT.md requirements
// stores/verificationStore.ts
import { create } from 'zustand';

interface TestResult {
  requirementId: string;
  testName: string;
  passed: boolean;
  message?: string;
  duration: number;
}

interface Gap {
  id: string;
  requirementId: string;
  description: string;
  severity: 'blocking' | 'major' | 'minor';
}

interface ManualTest {
  id: string;
  description: string;
  passed: boolean | null;
  note?: string;
}

interface VerificationState {
  status: 'idle' | 'running' | 'complete';
  runningTest: string | null;
  results: TestResult[];
  gaps: Gap[];
  manualTests: ManualTest[];
  overallPassed: boolean | null;
  summary: string | null;

  // Actions
  setRunning: () => void;
  setRunningTest: (testName: string | null) => void;
  addTestResult: (result: TestResult) => void;
  setComplete: (passed: boolean, summary: string) => void;
  setGaps: (gaps: Gap[]) => void;
  setManualTests: (tests: ManualTest[]) => void;
  updateManualTest: (testId: string, passed: boolean, note?: string) => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as const,
  runningTest: null,
  results: [] as TestResult[],
  gaps: [] as Gap[],
  manualTests: [] as ManualTest[],
  overallPassed: null,
  summary: null,
};

export const useVerificationStore = create<VerificationState>((set) => ({
  ...initialState,

  setRunning: () => set({ status: 'running', results: [], runningTest: null }),

  setRunningTest: (testName) => set({ runningTest: testName }),

  addTestResult: (result) =>
    set((state) => ({ results: [...state.results, result] })),

  setComplete: (passed, summary) =>
    set({ status: 'complete', overallPassed: passed, summary, runningTest: null }),

  setGaps: (gaps) => set({ gaps }),

  setManualTests: (tests) => set({ manualTests: tests }),

  updateManualTest: (testId, passed, note) =>
    set((state) => ({
      manualTests: state.manualTests.map((t) =>
        t.id === testId ? { ...t, passed, note } : t
      ),
    })),

  reset: () => set(initialState),
}));

// Selectors
export const selectVerificationStatus = (state: VerificationState) => state.status;
export const selectResults = (state: VerificationState) => state.results;
export const selectGaps = (state: VerificationState) => state.gaps;
export const selectManualTests = (state: VerificationState) => state.manualTests;
export const selectOverallPassed = (state: VerificationState) => state.overallPassed;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit or pragmatic-drag-and-drop | 2023+ | react-beautiful-dnd unmaintained |
| Custom heatmaps with divs | react-grid-heatmap | 2022+ | Simpler API, consistent rendering |
| Draft.js for rich editing | Contenteditable or Lexical | 2024+ | Draft.js deprecated; Lexical is Meta's replacement |
| Redux for forms | Zustand + local state | 2023+ | Less boilerplate, better performance |
| Polling for test results | WebSocket streaming | Standard | Real-time UX, less server load |

**Deprecated/outdated:**
- react-beautiful-dnd: Unmaintained since 2023; use @dnd-kit or pragmatic-drag-and-drop
- Draft.js: Deprecated by Meta; use Lexical for rich text (but not needed here)
- Manual drag events: Use drag library for accessibility and cross-browser support

## Open Questions

1. **Backend Events for Verification**
   - What we know: Phase 17 established Socket.IO event patterns; verification needs similar streaming
   - What's unclear: Are `verification:test_start`, `verification:test_result`, `verification:complete` events implemented in backend?
   - Recommendation: Add verification event types to `@gsd/events` package; backend emits during test execution

2. **Gap Planning API**
   - What we know: VERIF-07 requires auto-routing to `plan-phase --gaps`
   - What's unclear: What API endpoint triggers gap planning? Does orchestrator need new route?
   - Recommendation: Add `POST /api/phases/:id/plan-gaps` endpoint that accepts gap IDs and spawns planning agent

3. **Dependency Line Library**
   - What we know: CONTEXT.md specifies connecting lines between cards for dependencies
   - What's unclear: Should we use react-xarrows or simple SVG paths?
   - Recommendation: Start with simple SVG straight lines; evaluate react-xarrows if curved paths needed

4. **Research Agent Events**
   - What we know: Research runs as parallel agents
   - What's unclear: Do research agents emit the same events as execution agents, or need new event types?
   - Recommendation: Reuse `agent:start`, `agent:token`, `agent:end` events; add optional `agentType: 'researcher' | 'executor'` field

## Sources

### Primary (HIGH confidence)
- [@dnd-kit documentation](https://dndkit.com/) - Drag and drop API, sortable presets
- [react-grid-heatmap GitHub](https://github.com/arunghosh/react-grid-heatmap) - Heatmap component API
- [@radix-ui/react-checkbox](https://www.radix-ui.com/primitives/docs/components/checkbox) - Checkbox primitive
- [@radix-ui/react-dialog](https://www.radix-ui.com/primitives/docs/components/dialog) - Modal primitive
- [react-contenteditable npm](https://www.npmjs.com/package/react-contenteditable) - Contenteditable wrapper
- [@gsd/events source](/Users/mauricevandermerwe/Projects/get-shit-done/packages/events/src) - Socket.IO types, event names
- [Phase 17 Research](/Users/mauricevandermerwe/Projects/get-shit-done/.planning/phases/17-execute-phase-ui/17-RESEARCH.md) - Established frontend patterns

### Secondary (MEDIUM confidence)
- [Marmelab: Building Kanban with shadcn](https://marmelab.com/blog/2026/01/15/building-a-kanban-board-with-shadcn.html) - Kanban patterns with dnd-kit
- [LogRocket: Inline editable UI in React](https://blog.logrocket.com/build-inline-editable-ui-react/) - Contenteditable best practices
- [Atlassian: pragmatic-drag-and-drop](https://atlassian.design/components/pragmatic-drag-and-drop/) - Alternative drag library

### Tertiary (LOW confidence)
- Verification event structure - Needs backend confirmation
- Gap planning API endpoint - Needs backend confirmation
- Research agent event types - Needs backend confirmation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Extends Phase 15/17 patterns; verified library docs
- Architecture: HIGH - Follows established monorepo structure; consistent with existing phases
- Component patterns: HIGH - Based on CONTEXT.md requirements and official library docs
- Backend events: MEDIUM - May need new event types for verification and research streaming

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (30 days - stable technologies)
