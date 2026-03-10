# Requirements: GSD v2.0 Web Dashboard

**Created:** 2026-03-10
**Source:** PRD (docs/gsd-dashboard-prd.md) + Research + User scoping

---

## v2.0 Requirements

### Infrastructure (INFRA)

Foundation layer required for all streaming and real-time features.

- [ ] **INFRA-01**: WebSocket server supports bidirectional communication with auto-reconnect and state sync on reconnection
- [ ] **INFRA-02**: Token buffering system batches streaming output using requestAnimationFrame to prevent UI backpressure
- [ ] **INFRA-03**: File locking prevents race conditions when CLI and dashboard access the same .planning/ files concurrently
- [ ] **INFRA-04**: Security layer validates file paths, resolves symlinks, and restricts access to project directories only

### Dashboard (DASH)

Project overview and navigation.

- [ ] **DASH-01**: User can view list of all GSD projects with health status indicators (healthy/degraded/error)
- [ ] **DASH-02**: User can see current phase and progress percentage for each project
- [ ] **DASH-03**: User can view recent activity feed (last 5 actions) for each project
- [ ] **DASH-04**: User can search and filter projects by name or status
- [ ] **DASH-05**: User can navigate to project detail view by clicking a project card

### Discuss Phase UI (DISC)

Context gathering through conversational interface.

- [ ] **DISC-01**: User can have a chat-style conversation with Claude with real-time token streaming
- [ ] **DISC-02**: User can see live preview of CONTEXT.md being generated as conversation progresses
- [ ] **DISC-03**: User can mark individual decisions as locked (must keep) vs discretionary (agent can adjust)
- [ ] **DISC-04**: User can refresh browser and resume discussion session where they left off
- [ ] **DISC-05**: User can manually edit CONTEXT.md with sync back to conversation state

### Plan Phase UI (PLAN)

Research, planning, and verification workflow.

- [ ] **PLAN-01**: User can see real-time progress as researcher agents spawn, run, and complete
- [ ] **PLAN-02**: User can preview generated plans with task breakdown and wave grouping
- [ ] **PLAN-03**: User can see verification feedback with specific issues highlighted per plan
- [ ] **PLAN-04**: User can view requirement coverage matrix showing requirement-to-phase mapping
- [ ] **PLAN-05**: User can edit plan tasks inline before execution

### Execute Phase UI (EXEC)

Real-time execution with streaming and checkpoints.

- [ ] **EXEC-01**: User can see wave-based execution progress with real-time log streaming per plan
- [ ] **EXEC-02**: User can see tool calls visualized as collapsible cards (Read, Write, Bash, etc.)
- [ ] **EXEC-03**: User can respond to checkpoint dialogs with timeout warning display
- [ ] **EXEC-04**: User can view file changes in Monaco DiffEditor with syntax highlighting
- [ ] **EXEC-05**: User can see git commit timeline showing commits created during execution
- [ ] **EXEC-06**: User can pause execution and resume from the paused state
- [ ] **EXEC-07**: User can abort execution gracefully with rollback option
- [ ] **EXEC-08**: User can recover from errors with retry options and context preservation

### Execute Quality (QUAL)

Quality enforcement during code execution.

- [ ] **QUAL-01**: Execution follows Red-Green-Refactor TDD workflow for code development tasks
- [ ] **QUAL-02**: Tests are written before implementation and must fail initially (Red)
- [ ] **QUAL-03**: Implementation makes tests pass without shortcuts (Green)
- [ ] **QUAL-04**: Code is refactored for clarity after tests pass (Refactor)

### Verify Work UI (VERIF)

User acceptance testing and gap closure.

- [ ] **VERIF-01**: User can view verification report with pass/fail status per requirement
- [ ] **VERIF-02**: User can see gaps highlighted with severity levels (blocking, major, minor)
- [ ] **VERIF-03**: Verification executes all tests automatically before displaying results
- [ ] **VERIF-04**: Verification validates that all success criteria are genuinely met (not superficially passed)
- [ ] **VERIF-05**: User can mark manual test items as pass/fail in checklist
- [ ] **VERIF-06**: User can approve completed work or reject with gap selection
- [ ] **VERIF-07**: Rejection routes to plan-phase --gaps to create fix plans automatically

### Roadmap Visualization (ROAD)

Visual representation of project progress and dependencies.

- [ ] **ROAD-01**: User can view dependency graph showing phase-to-phase relationships
- [ ] **ROAD-02**: User can view Gantt-style timeline showing phase schedule
- [ ] **ROAD-03**: User can see progress tracking per phase with visual indicators
- [ ] **ROAD-04**: User can see phases grouped by milestone
- [ ] **ROAD-05**: User can click phase in visualization to navigate to phase detail

### Debug Session UI (DEBUG)

Visual debugging workflow.

- [ ] **DEBUG-01**: User can create a new debug session from dashboard
- [ ] **DEBUG-02**: User can track hypotheses with evidence for/against
- [ ] **DEBUG-03**: User can collect evidence via UI (logs, screenshots, reproduction steps)
- [ ] **DEBUG-04**: User can view session history with timeline of investigations

---

## Deferred to v2.1

### Settings & Configuration (SETTINGS)

- [ ] **SETTINGS-01**: User can select model profile (quality/balanced/budget)
- [ ] **SETTINGS-02**: User can toggle workflow options (research, verification, etc.)
- [ ] **SETTINGS-03**: User can manage API keys securely
- [ ] **SETTINGS-04**: User can switch between light and dark theme
- [ ] **SETTINGS-05**: User can customize keyboard shortcuts

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user collaboration | GSD is single-developer workflow by design |
| Real-time shared sessions | Adds complexity without proportional value |
| Mobile native apps | Responsive web is sufficient |
| Offline mode | Dashboard requires server connection for agent execution |
| Plugin/extension system | Premature; validate core workflow first |
| Git provider integrations | GitHub/GitLab UI not needed for local workflow |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | TBD | - |
| INFRA-02 | TBD | - |
| INFRA-03 | TBD | - |
| INFRA-04 | TBD | - |
| DASH-01 | TBD | - |
| DASH-02 | TBD | - |
| DASH-03 | TBD | - |
| DASH-04 | TBD | - |
| DASH-05 | TBD | - |
| DISC-01 | TBD | - |
| DISC-02 | TBD | - |
| DISC-03 | TBD | - |
| DISC-04 | TBD | - |
| DISC-05 | TBD | - |
| PLAN-01 | TBD | - |
| PLAN-02 | TBD | - |
| PLAN-03 | TBD | - |
| PLAN-04 | TBD | - |
| PLAN-05 | TBD | - |
| EXEC-01 | TBD | - |
| EXEC-02 | TBD | - |
| EXEC-03 | TBD | - |
| EXEC-04 | TBD | - |
| EXEC-05 | TBD | - |
| EXEC-06 | TBD | - |
| EXEC-07 | TBD | - |
| EXEC-08 | TBD | - |
| QUAL-01 | TBD | - |
| QUAL-02 | TBD | - |
| QUAL-03 | TBD | - |
| QUAL-04 | TBD | - |
| VERIF-01 | TBD | - |
| VERIF-02 | TBD | - |
| VERIF-03 | TBD | - |
| VERIF-04 | TBD | - |
| VERIF-05 | TBD | - |
| VERIF-06 | TBD | - |
| VERIF-07 | TBD | - |
| ROAD-01 | TBD | - |
| ROAD-02 | TBD | - |
| ROAD-03 | TBD | - |
| ROAD-04 | TBD | - |
| ROAD-05 | TBD | - |
| DEBUG-01 | TBD | - |
| DEBUG-02 | TBD | - |
| DEBUG-03 | TBD | - |
| DEBUG-04 | TBD | - |

**Coverage:**
- v2.0 requirements: 45 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 45

---

## Previous Milestones

### v1.1 Upstream Sync (Complete)

| Category | Count | Status |
|----------|-------|--------|
| Core Operations (SYNC) | 4 | Complete |
| Notification (NOTIF) | 3 | Complete |
| Analysis (ANAL) | 4 | Complete |
| Merge Operations (MERGE) | 4 | Complete |
| Interactive (INTER) | 3 | Complete |
| Integration (INTEG) | 2 | Complete |
| Documentation (DOC) | 4 | Complete |
| **Total** | **24** | **Complete** |

---
*Requirements defined: 2026-03-10*
