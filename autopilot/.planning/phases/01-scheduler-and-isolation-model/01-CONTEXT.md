# Phase 1: Scheduler and Isolation Model - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the DAG-based dependency scheduler, single-writer state model, and per-worker event files — the concurrency primitives that Phase 2's execution engine will consume. No actual parallel execution happens in this phase; it delivers testable infrastructure.

</domain>

<decisions>
## Implementation Decisions

### DAG Scheduling Behavior
- Use ROADMAP.md `dependsOn` field as the source of truth for phase dependencies
- `dependsOn` is reliably written by the roadmapper and parsed by both autopilot (`extractDependsOn()`) and gsd-tools (`roadmap.cjs`), but never enforced at runtime — this phase adds enforcement
- The raw string format ("Phase 1", "Phase 1, Phase 2", "Nothing") needs structured parsing into phase number arrays
- Phases with no `dependsOn` field are treated as **ready immediately** (no implicit sequential ordering)
- Dependency cycles: Claude's discretion on error vs fallback behavior
- Missing dependency references (e.g., depends on Phase 99 which doesn't exist): **lenient** — warn but treat as satisfied
- Manual mode (`--parallel 2,3,5`): **warn but proceed** if user specifies phases with unmet dependencies

### State Ownership
- Each worker runs in its own git worktree, which naturally isolates `.planning/`
- Workers write state/events to their own worktree's `.planning/autopilot/`
- Orchestrator polls each worktree's `.planning/autopilot/` to track progress
- On merge, worker's `.planning/` contents merge into main branch automatically — no special cleanup needed
- Orchestrator is the only process that maintains the master view of all workers' state

### Event Tagging
- Per-worker events must carry: `phaseNumber`, `workerId`, and `stepName` (discuss/plan/execute/verify) in addition to existing `seq`, `timestamp`, `event`, `data` fields
- Event file naming convention: Claude's discretion
- Backward compatibility with single `events.jsonl`: Claude's discretion based on what existing code depends on

### Module Boundaries
- Scheduler module location: Claude's discretion on new `scheduler/` vs inside `orchestrator/`
- `dependsOn` string parser lives in autopilot only — not shared with gsd-tools (gsd-tools doesn't need structured deps today)
- Whether to use `dependency-graph` npm package or hand-roll Kahn's algorithm: Claude's discretion

### Claude's Discretion
- Cycle detection behavior (error vs fallback)
- Event file naming convention
- Backward compat strategy for events.jsonl
- Module organization (new scheduler/ directory vs extending orchestrator/)
- dependency-graph package vs hand-rolled DAG (~30 lines of Kahn's)
- p-limit and async-lock adoption vs alternatives

</decisions>

<specifics>
## Specific Ideas

- The existing `extractPhasesFromContent()` in `orchestrator/index.ts` already returns `dependsOn` as a raw string — the scheduler parser should consume this output directly rather than re-parsing ROADMAP.md
- Plan-level `depends_on` (wave ordering within a phase) is a separate concept from phase-level `dependsOn` — don't conflate them

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `extractPhasesFromContent()` (`orchestrator/index.ts`): Already parses ROADMAP.md and returns `RoadmapPhase[]` with `dependsOn: string | null`
- `extractDependsOn()` (`orchestrator/index.ts`): Regex extracts `**Depends on:**` value from phase blocks
- `roadmap.cjs` (`get-shit-done/bin/lib/roadmap.cjs`): Same parsing in gsd-tools, returns `depends_on` field
- `EventWriter` (`ipc/event-writer.ts`): Current event writer with `seq/timestamp/event/data` — needs extension for new metadata fields
- `StateStore` (`state/index.ts`): Zod-validated state with `PhaseStateSchema` that already includes `dependsOn` field

### Established Patterns
- File-based IPC: Events via NDJSON append, questions via JSON, heartbeat via JSON
- Atomic writes: `write-file-atomic` for state persistence
- Zod validation: All state schemas validated on restore

### Integration Points
- `orchestrator/index.ts` main loop: Currently sequential — scheduler will feed this (or its parallel replacement in Phase 2)
- `StateStore.phases[]`: Already tracks per-phase status with `dependsOn` field
- `EventWriter.write()`: Needs new fields added to `IPCEvent` type

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-scheduler-and-isolation-model*
*Context gathered: 2026-03-11*
