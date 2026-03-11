# GSD Autopilot Parallel Phase Execution

## What This Is

An enhancement to GSD Autopilot that enables parallel phase execution via a `--parallel` parameter. Instead of executing phases sequentially, multiple Claude Code instances run independent phases simultaneously while sharing a single unified dashboard for monitoring and interaction.

## Core Value

Multiple phases execute concurrently without conflicts, cutting total project build time while maintaining the same correctness guarantees as sequential execution.

## Requirements

### Validated

- ✓ Sequential phase execution with discuss → plan → execute → verify lifecycle — existing
- ✓ Dashboard with SSE-based live updates and question answering — existing
- ✓ IPC coordination via event files, heartbeat, and answer polling — existing
- ✓ State persistence via write-file-atomic with Zod validation — existing
- ✓ Phase dependency tracking in ROADMAP.md — existing
- ✓ Claude Code process spawning via ClaudeService — existing
- ✓ Notification system (Console, Teams, Slack, Webhook, System) — existing

### Active

- [ ] `--parallel` CLI parameter to enable concurrent phase execution
- [ ] Dependency-aware phase scheduling (only run phases whose dependencies are complete)
- [ ] Multiple ClaudeService instances running simultaneously
- [ ] Shared dashboard showing all active parallel phases with per-phase status
- [ ] Conflict-free state management across concurrent phase workers
- [ ] Consolidated event stream merging events from all parallel workers
- [ ] Per-phase question routing in dashboard (questions tagged to their phase worker)
- [ ] Graceful handling when a parallel phase fails (other phases continue)

### Out of Scope

- Distributed execution across multiple machines — local-only for now
- Dynamic scaling (adding/removing workers mid-run) — start with static parallelism
- Cross-phase file locking — phases should be independent by design (dependency graph enforces this)

## Context

The autopilot orchestrator (`autopilot/src/orchestrator/index.ts`) currently runs phases in a sequential loop. The IPC system uses file-based coordination (events.jsonl, questions.json, heartbeat.json) which is already atomic via write-file-atomic. The dashboard server (`autopilot/src/server/`) uses SSE to push live updates to a React frontend with Zustand state management.

Key architectural considerations:
- The existing IPC file format (JSONL events) naturally supports multiple writers if events are tagged with a phase/worker ID
- StateStore uses atomic writes but currently assumes single-writer — needs concurrency strategy
- The dashboard already renders phase-level status; parallel execution needs per-worker tracking
- ROADMAP.md already encodes phase dependencies via "Depends on" fields

## Constraints

- **Concurrency model**: Must work within Node.js single-process event loop for the orchestrator; worker phases spawn as child processes via ClaudeService
- **File system**: IPC relies on atomic file writes — concurrent writes to same file need coordination
- **State consistency**: STATE.md and state.json must remain consistent across parallel workers
- **Backward compatibility**: `--parallel` is opt-in; default behavior remains sequential

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| File-based IPC over sockets | Existing system uses file-based IPC; extending it avoids rewrite | — Pending |
| Worker-per-phase model | Each phase gets its own ClaudeService child process | — Pending |
| Dependency graph determines parallelism | Phases without unmet dependencies can run concurrently | — Pending |

---
*Last updated: 2026-03-11 after initialization*
