# get-shit-done-codex (GSD) - Agent Instructions

A meta-prompting, context engineering and spec-driven development system for Codex CLI and Desktop.

## Overview

This system helps you build software projects by:

1. **Deep context gathering** - Understanding what you want to build through structured questioning
2. **Roadmap creation** - Breaking work into phases and plans
3. **Autonomous execution** - Running atomic tasks with fresh context each time
4. **State tracking** - Maintaining project state across sessions

## Core Principles

### Solo Developer Model

- You are planning for ONE person (the user) and ONE implementer (the AI)
- No teams, stakeholders, ceremonies, or coordination overhead
- User is the visionary/product owner
- AI is the builder
- Estimate effort in AI execution time, not human dev time

### Plans Are Prompts

- PLAN.md IS the prompt that executes work
- Contains: Objective, Context, Tasks, Success Criteria
- When planning a phase, you are writing the prompt that will execute it

### Scope Control

**Quality degradation curve:**

- 0-30% context: Peak quality
- 30-50% context: Good quality
- 50-70% context: Degrading quality
- 70%+ context: Poor quality

**Solution:** Aggressive atomicity - 2-3 tasks per plan maximum

### Deviation Rules

During execution:

1. **Auto-fix bugs** - Fix immediately, document
2. **Auto-add critical** - Security/correctness gaps, add immediately
3. **Auto-fix blockers** - Can't proceed, fix immediately
4. **Ask about architectural** - Major changes, stop and ask
5. **Log enhancements** - Nice-to-haves, log to ISSUES.md, continue

### Atomic Git Commits

Each task gets its own commit immediately after completion:

- Format: `{type}({phase}-{plan}): {task-description}`
- Types: feat, fix, test, refactor, perf, chore, docs
- One final metadata commit per plan

## Directory Structure

```
.planning/
├── PROJECT.md          # Project vision and requirements
├── ROADMAP.md          # Phases from start to finish
├── STATE.md            # Living memory across sessions
├── ISSUES.md           # Deferred enhancements
├── config.json         # Workflow mode and settings
├── codebase/           # (brownfield) Codebase analysis
│   ├── STACK.md
│   ├── ARCHITECTURE.md
│   ├── STRUCTURE.md
│   ├── CONVENTIONS.md
│   ├── TESTING.md
│   ├── INTEGRATIONS.md
│   └── CONCERNS.md
└── phases/
    └── XX-name/
        ├── XX-NN-PLAN.md
        └── XX-NN-SUMMARY.md
```

## Commands

The following commands are available. Invoke them with `$gsd-command-name`:

| Command                           | Description                                 |
| --------------------------------- | ------------------------------------------- |
| `$gsd-new-project`                | Initialize project through deep questioning |
| `$gsd-create-roadmap`             | Create roadmap and state tracking           |
| `$gsd-map-codebase`               | Map existing codebase (brownfield projects) |
| `$gsd-plan-phase [N]`             | Generate task plans for phase N             |
| `$gsd-execute-plan [path]`        | Execute a PLAN.md file                      |
| `$gsd-progress`                   | Show current position and what's next       |
| `$gsd-verify-work [N]`            | User acceptance testing                     |
| `$gsd-plan-fix [plan]`            | Plan fixes for UAT issues                   |
| `$gsd-complete-milestone`         | Archive milestone, prep next version        |
| `$gsd-discuss-milestone`          | Gather context for next milestone           |
| `$gsd-new-milestone [name]`       | Create new milestone with phases            |
| `$gsd-add-phase`                  | Append phase to roadmap                     |
| `$gsd-insert-phase [N]`           | Insert urgent work                          |
| `$gsd-remove-phase [N]`           | Remove future phase                         |
| `$gsd-discuss-phase [N]`          | Gather context before planning              |
| `$gsd-research-phase [N]`         | Deep ecosystem research                     |
| `$gsd-list-phase-assumptions [N]` | Review assumptions before planning          |
| `$gsd-pause-work`                 | Create handoff when stopping mid-phase      |
| `$gsd-resume-work`                | Restore from last session                   |
| `$gsd-consider-issues`            | Review deferred issues                      |
| `$gsd-help`                       | Show all commands                           |

## Workflow

### New Projects (Greenfield)

```bash
$gsd-new-project       # Deep questioning → PROJECT.md
$gsd-create-roadmap    # Create ROADMAP.md and STATE.md
$gsd-plan-phase 1      # Create atomic task plans
$gsd-execute-plan      # Subagent executes autonomously
```

### Existing Projects (Brownfield)

```bash
$gsd-map-codebase      # Analyze existing code → codebase/
$gsd-new-project       # Questioning with codebase context
$gsd-create-roadmap    # Continue as normal
```

## File References

When executing commands, reference these files for detailed instructions:

- **Workflows:** `get-shit-done/workflows/*.md`
- **Templates:** `get-shit-done/templates/*.md`
- **References:** `get-shit-done/references/*.md`
- **Commands:** `commands/gsd/*.md`

## Anti-Patterns

NEVER include:

- Team structures, RACI matrices
- Stakeholder management
- Sprint ceremonies
- Human dev time estimates
- Change management processes
- Documentation for documentation's sake

If it sounds like corporate PM theater, delete it.

## Context Engineering

Always load relevant context files:

- `.planning/PROJECT.md` - Project vision
- `.planning/STATE.md` - Current position and decisions
- `.planning/ROADMAP.md` - Phase structure
- `.planning/config.json` - Mode settings

For brownfield projects, also load:

- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/STACK.md`

## Test-Driven Development

Use TDD when beneficial:

- Business logic with defined inputs/outputs
- API endpoints and handlers
- Data transformations and parsing
- Validation rules
- State machines and workflows

Skip TDD for:

- UI layout and styling
- Exploratory prototyping
- One-off scripts and migrations
- Configuration changes

See `get-shit-done/references/tdd.md` for detailed TDD workflow.
