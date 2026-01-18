# Secondary Commands Reference

Supporting commands for roadmap management, sessions, debugging, milestones, and utilities.

---

## Phase Planning & Context

| Command | Purpose | Key Args | Spawns | Output |
|---------|---------|----------|--------|--------|
| `discuss-phase` | Gather phase context through questioning | `<phase>` | None | `{phase}-CONTEXT.md` |
| `research-phase` | Standalone research for a phase | `[phase]` | gsd-phase-researcher | `{phase}-RESEARCH.md` |
| `list-phase-assumptions` | Surface Claude's assumptions before planning | `[phase]` | None | Conversational (no file) |

### /gsd:discuss-phase

Extract implementation decisions before planning. Identifies gray areas (UI, UX, behavior) based on phase domain, lets user select which to discuss, deep-dives each area with 4 questions, creates CONTEXT.md with decisions.

**Key behaviors:**
- Domain-aware gray areas (visual → layout/density, API → responses/errors, etc.)
- Scope guardrail: clarifies HOW, not WHETHER to add more
- Deferred ideas captured but not acted on
- 4 questions per area before checking satisfaction

**Output sections:** Decisions, Boundaries, Deferred Ideas

---

### /gsd:research-phase

Standalone research command (usually use `/gsd:plan-phase` which integrates research). Use when researching without planning, re-researching after planning, or investigating feasibility.

**Research modes:** ecosystem (default), feasibility, implementation, comparison

**Key question:** "What do I not know that I don't know?"

---

### /gsd:research-phase vs --skip-research

**When to use /gsd:research-phase (dedicated research):**
- Complex/unfamiliar domains (3D, audio, ML, games)
- Phase requires ecosystem knowledge beyond "which library"
- You want deep research BEFORE planning starts
- Research output will be reused across multiple plans

**When to use /gsd:plan-phase (includes research):**
- Standard development (web apps, APIs, CRUD)
- Domain is familiar, just need implementation patterns
- Quick research sufficient during planning

**When to use /gsd:plan-phase --skip-research:**
- Research already done via /gsd:research-phase
- Returning to plan after interruption
- Phase is simple/mechanical (no research needed)

**Decision Matrix:**

| Domain Familiarity | Phase Complexity | Recommended Approach |
|--------------------|------------------|----------------------|
| High | Low | `plan-phase --skip-research` |
| High | High | `plan-phase` (auto-research) |
| Low | Any | `research-phase` then `plan-phase --skip-research` |
| Unknown | Any | `research-phase` first |

**Research Output Comparison:**

| Command | Output | Depth | Duration |
|---------|--------|-------|----------|
| plan-phase (auto) | {phase}-RESEARCH.md | Standard | 5-10 min |
| research-phase | {phase}-RESEARCH.md | Deep | 15-30 min |
| discovery (during planning) | DISCOVERY.md | Shallow | 2-5 min |

---

### /gsd:list-phase-assumptions

Surface Claude's intended approach BEFORE planning begins. Shows assumptions about:
- Technical approach
- Implementation order
- Scope boundaries
- Risk areas
- Dependencies

Ends with "What do you think?" for course correction. No files created.

---

## Roadmap Management

| Command | Purpose | Key Args | Spawns | Output |
|---------|---------|----------|--------|--------|
| `add-phase` | Append phase to end of milestone | `<description>` | None | ROADMAP.md updated |
| `insert-phase` | Insert decimal phase between existing | `<after> <description>` | None | ROADMAP.md updated |
| `remove-phase` | Delete future phase and renumber | `<number>` | None | ROADMAP.md updated |

### /gsd:add-phase

Add new integer phase to end of current milestone. Automatically calculates next phase number.

```
/gsd:add-phase Add authentication system
→ Creates Phase 7: Add authentication system
→ Creates .planning/phases/07-add-authentication/
→ Updates ROADMAP.md, STATE.md
```

**Use for:** Planned work discovered during execution.

---

### /gsd:insert-phase

Insert urgent work as decimal phase (e.g., 7.1) between existing phases.

```
/gsd:insert-phase 7 Fix critical auth bug
→ Creates Phase 7.1: Fix critical auth bug (INSERTED)
→ Preserves existing phase numbering
```

**Use for:** Urgent work that must happen mid-milestone without renumbering.

**Marker:** `(INSERTED)` identifies decimal phases as urgent insertions.

---

### /gsd:remove-phase

Remove unstarted future phase and renumber all subsequent phases.

```
/gsd:remove-phase 17
→ Deletes Phase 17
→ Phase 18 → 17, Phase 19 → 18, etc.
→ Updates all file references
→ Git commit preserves historical record
```

**Restrictions:**
- Only future phases (not started)
- No SUMMARY.md files (no completed work)
- Cannot remove current or past phases

---

## Milestone Management

| Command | Purpose | Key Args | Spawns | Output |
|---------|---------|----------|--------|--------|
| `new-milestone` | Start new milestone cycle | `[name]` | researchers, roadmapper | PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md |
| `complete-milestone` | Archive milestone and tag | `<version>` | None | Archive files, git tag |
| `audit-milestone` | Verify milestone completion | `[version]` | gsd-integration-checker | MILESTONE-AUDIT.md |
| `plan-milestone-gaps` | Create phases for audit gaps | None | None | ROADMAP.md updated |

### /gsd:new-milestone

Brownfield equivalent of `new-project`. Starts new milestone through unified flow:
questioning → research (optional) → requirements → roadmap.

**Key difference from new-project:** PROJECT.md exists with history, focuses on "what's next."

**Flow:** Present last milestone → Deep questioning → Version decision → Update PROJECT.md → Research → Requirements → Roadmap → Update STATE.md

---

### /gsd:complete-milestone

Archive completed milestone:
1. Check for audit (recommend `/gsd:audit-milestone` first)
2. Verify all phases complete (SUMMARY.md exists)
3. Gather stats (phases, plans, tasks, LOC, timeline)
4. Archive to `.planning/milestones/v{X}-ROADMAP.md` and `v{X}-REQUIREMENTS.md`
5. Update PROJECT.md with current state
6. Commit and create git tag `v{version}`

**Creates:** Archive files, git tag. **Deletes:** REQUIREMENTS.md (fresh for next milestone).

---

### /gsd:audit-milestone

Verify milestone achieved its definition of done before archiving.

**Purpose:** Catches issues that pass phase-level verification but fail at system level — cross-phase wiring gaps, broken E2E flows, unmet requirements.

**Execution Flow:**
1. Determine milestone scope from ROADMAP.md
2. Read all phase VERIFICATION.md files
3. Aggregate tech debt and deferred gaps
4. Spawn gsd-integration-checker for cross-phase verification
5. Check requirements coverage from REQUIREMENTS.md
6. Generate v{version}-MILESTONE-AUDIT.md
7. Route based on status

**What Integration Checker Verifies:**

| Check | What It Catches |
|-------|-----------------|
| Export/Import wiring | Phase 1 exports function, Phase 3 never imports it |
| API coverage | Route exists but nothing calls it |
| Auth protection | Dashboard accessible without login |
| E2E flows | User signup works but login broken |

**Output:** `.planning/v{version}-MILESTONE-AUDIT.md`

**Status Values:**
- `passed` — All requirements met, integration verified, E2E flows complete
- `gaps_found` — Critical blockers exist, run `/gsd:plan-milestone-gaps`
- `tech_debt` — No blockers but accumulated deferred items need review

**Routing:**

| Status | Next Command |
|--------|--------------|
| passed | `/gsd:complete-milestone` |
| gaps_found | `/gsd:plan-milestone-gaps` |
| tech_debt | Review debt, then `/gsd:complete-milestone` or plan cleanup |

**Usage:** `/gsd:audit-milestone` or `/gsd:audit-milestone 1.0`

---

### /gsd:plan-milestone-gaps

Create phases to close all gaps identified by milestone audit.

**Purpose:** Automates gap closure planning — reads MILESTONE-AUDIT.md, groups gaps into logical phases, updates ROADMAP.md.

**Prerequisites:**
- `/gsd:audit-milestone` must have run
- v{version}-MILESTONE-AUDIT.md must exist with gaps_found or tech_debt status

**Execution Flow:**
1. Load most recent MILESTONE-AUDIT.md
2. Parse gaps from YAML frontmatter
3. Prioritize by requirement priority (must > should > nice)
4. Group related gaps into logical phases
5. Determine phase numbers (continue from highest existing)
6. Present gap closure plan for approval
7. On approval, update ROADMAP.md with new phases
8. Route to planning first gap phase

**Gap Grouping Rules:**
- Same affected phase → combine into one fix phase
- Same subsystem (auth, API, UI) → combine
- Dependency order (fix stubs before wiring)
- Keep phases focused: 2-4 tasks each

**Example:**
```
Gaps identified:
- REQ-05 (Dashboard) unsatisfied
- Integration: Auth → Dashboard missing
- Flow: "View dashboard" broken

→ Creates Phase 6: "Wire Dashboard to API"
```

**Output:** Updated ROADMAP.md with gap closure phases

**Usage:** `/gsd:plan-milestone-gaps`

---

## Session Management

| Command | Purpose | Key Args | Spawns | Output |
|---------|---------|----------|--------|--------|
| `progress` | Show status and route to next action | None | None | Visual status display |
| `resume-work` | Restore context from previous session | None | None | Status + routing |
| `pause-work` | Create handoff for pausing mid-phase | None | None | `.continue-here.md` |

### /gsd:progress

Check project progress and intelligently route:
- Visual progress bar and completion percentage
- Recent work from SUMMARY files
- Current position and what's next
- Key decisions, blockers, pending todos
- Smart routing based on state

**Routes:**
- Unexecuted plan exists → `/gsd:execute-phase`
- Phase needs planning + CONTEXT exists → `/gsd:plan-phase`
- Phase needs planning + no CONTEXT → `/gsd:discuss-phase`
- UAT gaps found → `/gsd:plan-phase --gaps`
- Phase complete → next phase or milestone complete
- Between milestones → `/gsd:new-milestone`

---

### /gsd:resume-work

Restore complete project context from previous session:
- Load STATE.md (or reconstruct if missing)
- Detect checkpoints (`.continue-here` files)
- Detect incomplete work (PLAN without SUMMARY)
- Present visual status
- Route to appropriate next command

---

### /gsd:pause-work

Create handoff when pausing mid-phase (written to `.planning/phases/XX-name/.continue-here.md`, committed as WIP):
```markdown
## .continue-here.md
- Current position (phase, plan, task)
- Work completed / remaining
- Decisions made
- Blockers
- Mental context
- Next action to start with
```

Committed as WIP. Resume with `/gsd:resume-work`.

---

## Debugging & Analysis

| Command | Purpose | Key Args | Spawns | Output |
|---------|---------|----------|--------|--------|
| `debug` | Scientific debugging with persistent state | `[issue]` | gsd-debugger | `.planning/debug/{slug}.md` |
| `map-codebase` | Analyze existing codebase | `[area]` | gsd-codebase-mapper (×4) | `.planning/codebase/*` |

### /gsd:debug

Systematic debugging using scientific method:
1. Check for active sessions (resume or new)
2. Gather symptoms (expected, actual, errors, timeline, reproduction)
3. Spawn gsd-debugger agent
4. Handle returns: ROOT CAUSE FOUND, CHECKPOINT REACHED, INCONCLUSIVE

**Key feature:** Survives `/clear` — debug file persists state. Run `/gsd:debug` with no args to resume.

**Output:** `.planning/debug/{slug}.md` for active sessions.

---

### /gsd:map-codebase

Analyze existing codebase with parallel mapper agents:
- Agent 1: tech focus → STACK.md, INTEGRATIONS.md
- Agent 2: arch focus → ARCHITECTURE.md, STRUCTURE.md
- Agent 3: quality focus → CONVENTIONS.md, TESTING.md
- Agent 4: concerns focus → CONCERNS.md

**Use before:** `/gsd:new-project` on brownfield codebases.

**Creates:** `.planning/codebase/` with 7 documents (committed after generation).

---

## Todo Management

| Command | Purpose | Key Args | Spawns | Output |
|---------|---------|----------|--------|--------|
| `add-todo` | Capture idea/task from conversation | `[description]` | None | `.planning/todos/pending/`, updates STATE.md + commit |
| `check-todos` | List and select todo to work on | `[area]` | None | Move to `.planning/todos/done/` (updates STATE.md + commit) |

### /gsd:add-todo

Capture idea during work without derailing:
- With args: Use as title (`/gsd:add-todo Add auth refresh`)
- Without args: Infer from conversation

**Extracts:** Title, problem, solution hints, relevant files, area (api/ui/auth/database/testing/docs/tooling/general).

**Checks for duplicates** before creating. Updates STATE.md (pending count) and commits the todo.

---

### /gsd:check-todos

Review and select todo to work on:
1. List all pending todos (title, area, age)
2. Optional area filter
3. Load full context for selection
4. Check roadmap for phase match
5. Offer actions: work now, add to phase, create phase, brainstorm, put back

**Moves to done/** when "Work on it now" selected, updates STATE.md, and commits the move.

---

## Utility Commands

| Command | Purpose | Key Args | Spawns | Output |
|---------|---------|----------|--------|--------|
| `help` | Show command reference | None | None | Display only |
| `whats-new` | Show changelog since installed version | None | None | Display only |
| `update` | Update GSD to latest version | None | None | Install + changelog |

### /gsd:help

Display complete GSD command reference. Output only — no project analysis, git status, or commentary.

---

### /gsd:whats-new

Show changes between installed and latest version:
1. Read `~/.claude/get-shit-done/VERSION`
2. Fetch changelog from GitHub (fallback to local)
3. Extract entries between installed and latest
4. Surface breaking changes with **BREAKING:** prefix

Provides update instructions when behind.

---

### /gsd:update

Check for updates, show changelog, install if available:
1. Compare installed vs npm latest
2. Show what's new BEFORE updating
3. Warn about clean install (GSD folders replaced)
4. Confirm with user
5. Run `npx get-shit-done-cc --global`
6. Remind to restart Claude Code

---

## Command Categories Quick Reference

### Project Lifecycle
```
new-project → [plan/execute/verify loop] → audit-milestone → complete-milestone → new-milestone
```

### Phase Lifecycle
```
discuss-phase → plan-phase → execute-phase → [verify-work] → [plan-phase --gaps] → next phase
```

### Support Commands
```
progress     — Where am I? What's next?
resume-work  — Restore context after break
pause-work   — Create handoff for later
debug        — Scientific debugging
map-codebase — Analyze existing code
```

### Roadmap Modification
```
add-phase    — Append to end
insert-phase — Decimal between existing
remove-phase — Delete future + renumber
```

### Todo Flow
```
add-todo     — Capture idea
check-todos  — Review and act
```
