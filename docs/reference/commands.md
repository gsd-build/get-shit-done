# Command Reference

Complete reference for all GSD slash commands.

## Project Initialization

### `/gsd:new-project`
Initialize a new project from scratch with deep context gathering.

**Arguments:** None (prompts interactively)

**Creates:**
- `.planning/PROJECT.md` — Project context and vision
- `.planning/config.json` — Workflow preferences
- `.planning/REQUIREMENTS.md` — Scoped requirements
- `.planning/ROADMAP.md` — Phase structure
- `.planning/STATE.md` — Project memory
- `.planning/research/` — Domain research (optional)

**Flow:**
1. Brownfield detection (checks for existing code)
2. Deep questioning about vision and goals
3. Workflow preferences (mode, depth, model profile)
4. Research decision (4 parallel researchers)
5. Requirements gathering and categorization
6. Roadmap creation

**Next:** `/gsd:plan-phase 1` or `/gsd:discuss-phase 1`

---

### `/gsd:map-codebase [area]`
Analyze existing codebase with parallel mapper agents.

**Arguments:** Optional focus area (`api`, `auth`, etc.)

**Creates:** `.planning/codebase/` with:
- `STACK.md` — Technology stack
- `ARCHITECTURE.md` — System architecture
- `STRUCTURE.md` — File organization
- `CONVENTIONS.md` — Coding patterns
- `TESTING.md` — Test framework and patterns
- `CONCERNS.md` — Technical debt and issues

**Use when:** Brownfield projects needing codebase understanding

**Next:** `/gsd:new-project`

---

### `/gsd:new-milestone [name]`
Start a new milestone in an existing project.

**Arguments:** Optional milestone name (prompts if not provided)

**Creates/Updates:**
- Updates `PROJECT.md` with new milestone goals
- Fresh `REQUIREMENTS.md` scoped to this milestone
- Fresh `ROADMAP.md` continuing phase numbering
- Resets `STATE.md` for new milestone

**Flow:** Same as `/gsd:new-project` but for existing projects

**Next:** `/gsd:plan-phase [N]`

---

## Configuration

### `/gsd:settings`
Configure GSD workflow toggles and model profile interactively.

**Modifies:** `.planning/config.json`

**Settings:**
- Model profile (quality/balanced/budget)
- Research agent toggle
- Plan checker toggle
- Verifier agent toggle
- Git branching strategy

---

### `/gsd:set-profile <profile>`
Quickly switch model profile.

**Arguments:** Required — `quality`, `balanced`, or `budget`

**Profiles:**
| Profile | Planning | Execution | Verification |
|---------|----------|-----------|--------------|
| quality | Opus | Opus | Sonnet |
| balanced | Opus | Sonnet | Sonnet |
| budget | Sonnet | Sonnet | Haiku |

---

## Phase Planning

### `/gsd:plan-phase [phase] [flags]`
Create executable phase plans with integrated research and verification.

**Arguments:**
- `[phase]` — Phase number (optional, auto-detects next unplanned)

**Flags:**
- `--research` — Force re-research even if exists
- `--skip-research` — Skip research entirely
- `--gaps` — Gap closure mode (reads VERIFICATION.md)
- `--skip-verify` — Skip plan verification loop

**Creates:** `.planning/phases/{NN}-{name}/{phase}-{plan}-PLAN.md`

**Flow:**
1. Validate phase in ROADMAP.md
2. Research (if enabled and needed)
3. Spawn `gsd-planner` agent
4. Spawn `gsd-plan-checker` for validation
5. Iterate until verified (max 3 revisions)

**Next:** `/gsd:execute-phase [N]`

---

### `/gsd:research-phase [phase]`
Research phase implementation standalone.

**Arguments:** Required — phase number

**Creates:** `.planning/phases/{NN}-{name}/{phase}-RESEARCH.md`

**Use when:** Want research without planning, or need to re-research

**Next:** `/gsd:plan-phase [N]`

---

### `/gsd:discuss-phase [phase]`
Gather context and clarify approach before planning.

**Arguments:** Optional — phase number (prompts if not provided)

**Creates:** `.planning/phases/{NN}-{name}/{phase}-CONTEXT.md`

**Purpose:** Lock decisions before research/planning so they aren't revisited

**Next:** `/gsd:plan-phase [N]`

---

### `/gsd:list-phase-assumptions [phase]`
Surface Claude's assumptions about a phase before planning.

**Arguments:** Required — phase number

**Creates:** Nothing (conversational output only)

**Surfaces:** Technical approach, implementation order, scope, risks, dependencies

**Next:** `/gsd:plan-phase [N]` or continue discussion

---

## Phase Management

### `/gsd:add-phase [name]`
Add new phase to end of current milestone.

**Arguments:** Optional phase name (prompts if not provided)

**Modifies:** `ROADMAP.md` with new phase entry

**Next:** `/gsd:plan-phase [N]`

---

### `/gsd:insert-phase [phase.decimal] [name]`
Insert urgent work as decimal phase between existing phases.

**Arguments:**
- Required — phase number with decimal (e.g., `7.1`)
- Optional — phase name

**Example:** `/gsd:insert-phase 6.1 "Critical auth fix"`

**Creates:** Phase 6.1 executing between Phase 6 and Phase 7

**Next:** `/gsd:plan-phase [N.N]`

---

### `/gsd:remove-phase <phase>`
Remove unstarted future phase and renumber subsequent phases.

**Arguments:** Required — phase number to remove

**Validates:** Phase is future (not current/completed)

**Action:** Deletes directory, renumbers subsequent phases, updates ROADMAP.md

---

## Execution

### `/gsd:execute-phase [phase]`
Execute all plans in a phase with wave-based parallelization.

**Arguments:** Required — phase number

**Creates:**
- `.planning/phases/{NN}-{name}/{phase}-{plan}-SUMMARY.md` per plan
- `.planning/phases/{NN}-{name}/{phase}-VERIFICATION.md` after all plans

**Execution model:**
- Wave 1 plans run in parallel
- Wave 2 waits for Wave 1, then runs in parallel
- Each task commits atomically

**Next:** `/gsd:verify-work [N]` or `/gsd:progress`

---

### `/gsd:verify-work [phase]`
Validate built features through conversational user acceptance testing.

**Arguments:** Optional — phase number (auto-detects if not provided)

**Creates:** `.planning/phases/{NN}-{name}/{phase}-UAT.md`

**Interaction:**
- Claude: "User can X. Does this work?"
- User: "yes" / "no, because..." / "next"

**If issues found:**
- Spawns parallel debug agents
- Creates fix plans
- Ready for `/gsd:execute-phase [N] --gaps`

---

## Milestone Completion

### `/gsd:audit-milestone`
Audit milestone completion against original intent.

**Creates:** `.planning/{version}-MILESTONE-AUDIT.md`

**Checks:**
- All requirements satisfied
- Cross-phase integration working
- End-to-end flows complete

**Statuses:**
- `passed` — Ready for `/gsd:complete-milestone`
- `gaps_found` — Run `/gsd:plan-milestone-gaps` first
- `tech_debt` — Can proceed, debt tracked

---

### `/gsd:plan-milestone-gaps`
Create phases to close gaps found by audit.

**Reads:** Most recent `MILESTONE-AUDIT.md`

**Creates:** New phase entries in `ROADMAP.md` for gap closure

**Next:** `/gsd:plan-phase [N]` for first gap closure phase

---

### `/gsd:complete-milestone`
Archive completed milestone and prepare for next version.

**Creates:**
- `.planning/MILESTONES.md` entry
- `.planning/milestones/v{X.Y}-ROADMAP.md`
- `.planning/milestones/v{X.Y}-REQUIREMENTS.md`
- Git tag `v{X.Y}`

**Actions:**
- Move requirements to Validated in PROJECT.md
- Archive ROADMAP.md and REQUIREMENTS.md
- Full PROJECT.md evolution review

**Next:** `/gsd:new-milestone`

---

## Session Management

### `/gsd:progress`
Check project progress and route to next action.

**Shows:** Recent work, current position, blockers, what's next

**Routes to:**
- `/gsd:execute-phase` if plans exist
- `/gsd:plan-phase` if not planned
- `/gsd:discuss-phase` if no CONTEXT.md

---

### `/gsd:pause-work`
Create context handoff when pausing mid-phase.

**Creates:** `.planning/phases/{NN}-{name}/.continue-here.md`

**Contents:** Current position, completed work, remaining work, decisions, blockers, next action

**Next:** `/gsd:resume-work` in new session

---

### `/gsd:resume-work`
Resume work from previous session with full context restoration.

**Reads:** `.continue-here.md` if exists, reconstructs STATE.md if needed

**Routes:** Context-aware routing to appropriate command

---

### `/gsd:quick [description]`
Execute small ad-hoc tasks with GSD guarantees but skip optional agents.

**Creates:** `.planning/quick/{NNN}-{slug}/` with PLAN.md and SUMMARY.md

**Skips:** Research, plan-checker, verifier agents

**Use for:** Small, focused tasks that don't need full workflow

---

## Utilities

### `/gsd:add-todo [description]`
Capture idea or task as todo.

**Creates:** `.planning/todos/pending/{NNN}-{slug}.md`

---

### `/gsd:check-todos`
List pending todos and select one to work on.

---

### `/gsd:debug [description]`
Systematic debugging and root cause analysis.

**Creates:** `.planning/debug/{session-id}/DEBUG.md`

**Methodology:** Hypothesis-driven investigation with persistent state

---

### `/gsd:help`
Show available commands and usage guide.

---

### `/gsd:update`
Update GSD to latest version with changelog display.

---

### `/gsd:join-discord`
Join the GSD Discord community.

---

## Command Patterns

### Typical Flow
```
/gsd:new-project
/gsd:plan-phase 1
/gsd:execute-phase 1
/gsd:verify-work 1
/gsd:progress        → routes to next phase
...
/gsd:audit-milestone
/gsd:complete-milestone
/gsd:new-milestone
```

### Mid-Session Pause
```
/gsd:pause-work      → saves context
(new session)
/gsd:resume-work     → restores context
```

### Gap Closure
```
/gsd:verify-work 2   → finds issues
/gsd:plan-phase 2 --gaps
/gsd:execute-phase 2 --gaps-only
/gsd:verify-work 2   → validates fixes
```

### Urgent Work
```
/gsd:insert-phase 3.1 "Critical fix"
/gsd:plan-phase 3.1
/gsd:execute-phase 3.1
```
