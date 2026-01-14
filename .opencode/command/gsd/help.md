---

description: Show available GSD commands and usage guide
---

<objective>
Display the complete GSD command reference.

Output ONLY the reference content below. Do NOT add:

- Project-specific analysis
- Git status or file context
- Next-step suggestions
- Any commentary beyond the reference
  </objective>

<reference>
# GSD Command Reference

**GSD** (Get Shit Done) creates hierarchical project plans optimized for solo agentic development with Claude Code.

## Quick Start

1. `/gsd/new-project` - Initialize project with brief
2. `/gsd/create-roadmap` - Create roadmap and phases
3. `/gsd/plan-phase <number>` - Create detailed plan for first phase
4. `/gsd/execute-plan <path>` - Execute the plan

## Core Workflow

```
Initialization → Planning → Execution → Milestone Completion
```

### Project Initialization

**`/gsd/new-project`**
Initialize new project with brief and configuration.

- Creates `.planning/PROJECT.md` (vision and requirements)
- Creates `.planning/config.json` (workflow mode)
- Asks for workflow mode (interactive/yolo) upfront
- Commits initialization files to git

Usage: `/gsd/new-project`

**`/gsd/create-roadmap`**
Create roadmap and state tracking for initialized project.

- Creates `.planning/ROADMAP.md` (phase breakdown)
- Creates `.planning/STATE.md` (project memory)
- Creates `.planning/phases/` directories

Usage: `/gsd/create-roadmap`

**`/gsd/map-codebase`**
Map an existing codebase for brownfield projects.

- Analyzes codebase with parallel Explore agents
- Creates `.planning/codebase/` with 7 focused documents
- Covers stack, architecture, structure, conventions, testing, integrations, concerns
- Use before `/gsd/new-project` on existing codebases

Usage: `/gsd/map-codebase`

### Phase Planning

**`/gsd/discuss-phase <number>`**
Help articulate your vision for a phase before planning.

- Captures how you imagine this phase working
- Creates CONTEXT.md with your vision, essentials, and boundaries
- Use when you have ideas about how something should look/feel

Usage: `/gsd/discuss-phase 2`

**`/gsd/research-phase <number>`**
Comprehensive ecosystem research for niche/complex domains.

- Discovers standard stack, architecture patterns, pitfalls
- Creates RESEARCH.md with "how experts build this" knowledge
- Use for 3D, games, audio, shaders, ML, and other specialized domains
- Goes beyond "which library" to ecosystem knowledge

Usage: `/gsd/research-phase 3`

**`/gsd/list-phase-assumptions <number>`**
See what Claude is planning to do before it starts.

- Shows Claude's intended approach for a phase
- Lets you course-correct if Claude misunderstood your vision
- No files created - conversational output only

Usage: `/gsd/list-phase-assumptions 3`

**`/gsd/plan-phase <number>`**
Create detailed execution plan for a specific phase.

- Generates `.planning/phases/XX-phase-name/XX-YY-PLAN.md`
- Breaks phase into concrete, actionable tasks
- Includes verification criteria and success measures
- Multiple plans per phase supported (XX-01, XX-02, etc.)

Usage: `/gsd/plan-phase 1`
Result: Creates `.planning/phases/01-foundation/01-01-PLAN.md`

### Execution

**`/gsd/execute-plan <path>`**
Execute a single PLAN.md file.

- Runs plan tasks sequentially
- Creates SUMMARY.md after completion
- Updates STATE.md with accumulated context
- Use for interactive execution with checkpoints

Usage: `/gsd/execute-plan .planning/phases/01-foundation/01-01-PLAN.md`

**`/gsd/execute-phase <phase-number>`**
Execute all unexecuted plans in a phase with parallel background agents.

- Analyzes plan dependencies and spawns independent plans concurrently
- Use when phase has 2+ plans and you want "walk away" execution
- Respects max_concurrent_agents from config.json

Usage: `/gsd/execute-phase 5`

Options (via `.planning/config.json` parallelization section):
- `max_concurrent_agents`: Limit parallel agents (default: 3)
- `skip_checkpoints`: Skip human checkpoints in background (default: true)
- `min_plans_for_parallel`: Minimum plans to trigger parallelization (default: 2)

**`/gsd/status [--wait]`**
Check status of background agents from parallel execution.

- Shows running/completed agents from agent-history.json
- Uses TaskOutput to poll agent status
- With `--wait`: blocks until all agents complete

Usage: `/gsd/status` or `/gsd/status --wait`

### Roadmap Management

**`/gsd/add-phase <description>`**
Add new phase to end of current milestone.

- Appends to ROADMAP.md
- Uses next sequential number
- Updates phase directory structure

Usage: `/gsd/add-phase "Add admin dashboard"`

**`/gsd/insert-phase <after> <description>`**
Insert urgent work as decimal phase between existing phases.

- Creates intermediate phase (e.g., 7.1 between 7 and 8)
- Useful for discovered work that must happen mid-milestone
- Maintains phase ordering

Usage: `/gsd/insert-phase 7 "Fix critical auth bug"`
Result: Creates Phase 7.1

**`/gsd/remove-phase <number>`**
Remove a future phase and renumber subsequent phases.

- Deletes phase directory and all references
- Renumbers all subsequent phases to close the gap
- Only works on future (unstarted) phases
- Git commit preserves historical record

Usage: `/gsd/remove-phase 17`
Result: Phase 17 deleted, phases 18-20 become 17-19

### Milestone Management

**`/gsd/discuss-milestone`**
Figure out what you want to build in the next milestone.

- Reviews what shipped in previous milestone
- Helps you identify features to add, improve, or fix
- Routes to /gsd/new-milestone when ready

Usage: `/gsd/discuss-milestone`

**`/gsd/new-milestone <name>`**
Create a new milestone with phases for an existing project.

- Adds milestone section to ROADMAP.md
- Creates phase directories
- Updates STATE.md for new milestone

Usage: `/gsd/new-milestone "v2.0 Features"`

**`/gsd/complete-milestone <version>`**
Archive completed milestone and prepare for next version.

- Creates MILESTONES.md entry with stats
- Archives full details to milestones/ directory
- Creates git tag for the release
- Prepares workspace for next version

Usage: `/gsd/complete-milestone 1.0.0`

### Progress Tracking

**`/gsd/progress`**
Check project status and intelligently route to next action.

- Shows visual progress bar and completion percentage
- Summarizes recent work from SUMMARY files
- Displays current position and what's next
- Lists key decisions and open issues
- Offers to execute next plan or create it if missing
- Detects 100% milestone completion

Usage: `/gsd/progress`

### Session Management

**`/gsd/resume-work`**
Resume work from previous session with full context restoration.

- Reads STATE.md for project context
- Shows current position and recent progress
- Offers next actions based on project state

Usage: `/gsd/resume-work`

**`/gsd/pause-work`**
Create context handoff when pausing work mid-phase.

- Creates .continue-here file with current state
- Updates STATE.md session continuity section
- Captures in-progress work context

Usage: `/gsd/pause-work`

### Issue Management

**`/gsd/consider-issues`**
Review deferred issues with codebase context.

- Analyzes all open issues against current codebase state
- Identifies resolved issues (can close)
- Identifies urgent issues (should address now)
- Identifies natural fits for upcoming phases
- Offers batch actions (close, insert phase, note for planning)

Usage: `/gsd/consider-issues`

### Debugging

**`/gsd/debug [issue description]`**
Systematic debugging with persistent state across context resets.

- Gathers symptoms through adaptive questioning
- Creates `.planning/debug/[slug].md` to track investigation
- Investigates using scientific method (evidence → hypothesis → test)
- Survives `/clear` — run `/gsd/debug` with no args to resume
- Archives resolved issues to `.planning/debug/resolved/`

Usage: `/gsd/debug "login button doesn't work"`
Usage: `/gsd/debug` (resume active session)

### Todo Management

**`/gsd/add-todo [description]`**
Capture idea or task as todo from current conversation.

- Extracts context from conversation (or uses provided description)
- Creates structured todo file in `.planning/todos/pending/`
- Infers area from file paths for grouping
- Checks for duplicates before creating
- Updates STATE.md todo count

Usage: `/gsd/add-todo` (infers from conversation)
Usage: `/gsd/add-todo Add auth token refresh`

**`/gsd/check-todos [area]`**
List pending todos and select one to work on.

- Lists all pending todos with title, area, age
- Optional area filter (e.g., `/gsd/check-todos api`)
- Loads full context for selected todo
- Routes to appropriate action (work now, add to phase, brainstorm)
- Moves todo to done/ when work begins

Usage: `/gsd/check-todos`
Usage: `/gsd/check-todos api`

### Utility Commands

**`/gsd/help`**
Show this command reference.

## Files & Structure

```
.planning/
├── PROJECT.md            # Project vision
├── ROADMAP.md            # Current phase breakdown
├── STATE.md              # Project memory & context
├── ISSUES.md             # Deferred enhancements (created when needed)
├── config.json           # Workflow mode & gates
├── todos/                # Captured ideas and tasks
│   ├── pending/          # Todos waiting to be worked on
│   └── done/             # Completed todos
├── debug/                # Active debug sessions
│   └── resolved/         # Archived resolved issues
├── codebase/             # Codebase map (brownfield projects)
│   ├── STACK.md          # Languages, frameworks, dependencies
│   ├── ARCHITECTURE.md   # Patterns, layers, data flow
│   ├── STRUCTURE.md      # Directory layout, key files
│   ├── CONVENTIONS.md    # Coding standards, naming
│   ├── TESTING.md        # Test setup, patterns
│   ├── INTEGRATIONS.md   # External services, APIs
│   └── CONCERNS.md       # Tech debt, known issues
└── phases/
    ├── 01-foundation/
    │   ├── 01-01-PLAN.md
    │   └── 01-01-SUMMARY.md
    └── 02-core-features/
        ├── 02-01-PLAN.md
        └── 02-01-SUMMARY.md
```

## Workflow Modes

Set during `/gsd/new-project`:

**Interactive Mode**

- Confirms each major decision
- Pauses at checkpoints for approval
- More guidance throughout

**YOLO Mode**

- Auto-approves most decisions
- Executes plans without confirmation
- Only stops for critical checkpoints

Change anytime by editing `.planning/config.json`

## Common Workflows

**Starting a new project:**

```
/gsd/new-project
/gsd/create-roadmap
/gsd/plan-phase 1
/gsd/execute-plan .planning/phases/01-foundation/01-01-PLAN.md
```

**Resuming work after a break:**

```
/gsd/progress  # See where you left off and continue
```

**Adding urgent mid-milestone work:**

```
/gsd/insert-phase 5 "Critical security fix"
/gsd/plan-phase 5.1
/gsd/execute-plan .planning/phases/05.1-critical-security-fix/05.1-01-PLAN.md
```

**Completing a milestone:**

```
/gsd/complete-milestone 1.0.0
/gsd/new-project  # Start next milestone
```

**Capturing ideas during work:**

```
/gsd/add-todo                    # Capture from conversation context
/gsd/add-todo Fix modal z-index  # Capture with explicit description
/gsd/check-todos                 # Review and work on todos
/gsd/check-todos api             # Filter by area
```

**Debugging an issue:**

```
/gsd/debug "form submission fails silently"  # Start debug session
# ... investigation happens, context fills up ...
/clear
/gsd/debug                                    # Resume from where you left off
```

## Getting Help

- Read `.planning/PROJECT.md` for project vision
- Read `.planning/STATE.md` for current context
- Check `.planning/ROADMAP.md` for phase status
- Run `/gsd/progress` to check where you're up to
  </reference>
