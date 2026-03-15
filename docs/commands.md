---
layout: default
title: Commands
---

# Commands Reference

All GSD commands start with `/gsd:`. Here's the complete reference.

---

## Core Workflow

### `/gsd:new-project`

Start a new project. Initiates deep questioning about your goals, constraints, and technology choices.

**Creates:**
- `.planning/PROJECT.md` — Project vision
- `.planning/REQUIREMENTS.md` — Scoped features
- `.planning/ROADMAP.md` — Phase breakdown
- `.planning/STATE.md` — Current position

**Options:**
- `--research` — Enable domain research with parallel agents
- `--skip-research` — Skip research phase

---

### `/gsd:discuss-phase [N]`

Capture implementation decisions before planning a phase. Use this when you have specific preferences about how something should be built.

**Creates:**
- `.planning/phases/{N}-{name}/CONTEXT.md`

**Example:**
```
/gsd:discuss-phase 03
```

---

### `/gsd:list-phase-assumptions [N]`

See what Claude is planning to do before it starts. Shows Claude's intended approach for a phase so you can course-correct if needed.

**Output:** Conversational only (no files created)

**Example:**
```
/gsd:list-phase-assumptions 03
```

---

### `/gsd:research-phase [N]`

Comprehensive ecosystem research for niche or complex domains. Use for 3D, games, audio, shaders, ML, and other specialized domains.

**Creates:**
- `.planning/phases/{N}-{name}/RESEARCH.md`

**Note:** Usually use `/gsd:plan-phase` instead, which includes research automatically.

**Example:**
```
/gsd:research-phase 03
```

---

### `/gsd:plan-phase [N]`

Research and create an executable plan for a phase.

**Process:**
1. Spawns research agents for implementation analysis
2. Synthesizes findings
3. Creates 2-3 atomic tasks
4. Generates executable PLAN.md

**Creates:**
- `.planning/phases/{N}-{name}/RESEARCH.md`
- `.planning/phases/{N}-{name}/{N}-PLAN.md`

**Example:**
```
/gsd:plan-phase 01
```

---

### `/gsd:execute-phase [N]`

Execute all plans for a phase.

**Process:**
1. Loads phase artifacts into fresh context
2. Executes each task atomically
3. Commits after each task
4. Verifies success criteria

**Creates:**
- `.planning/phases/{N}-{name}/SUMMARY.md`
- `.planning/phases/{N}-{name}/VERIFICATION.md`

**Options:**
- `--plan [M]` — Execute specific plan only
- `--yolo` — Skip checkpoints (use with caution)

**Example:**
```
/gsd:execute-phase 02 --plan 01
```

---

### `/gsd:verify-work [N]`

Run user acceptance testing for a phase.

**Process:**
1. Presents what was built
2. Guides manual verification steps
3. Runs automated checks
4. Creates fix plans if issues found

**Creates:**
- `.planning/phases/{N}-{name}/UAT.md`

**Example:**
```
/gsd:verify-work 03
```

---

### `/gsd:complete-milestone`

Ship the current milestone and prepare for the next.

**Process:**
1. Verifies all phases complete
2. Tags release in git
3. Archives phase artifacts
4. Updates STATE.md

---

### `/gsd:audit-milestone [version]`

Audit milestone completion against original intent before archiving.

**Process:**
1. Reads all phase VERIFICATION.md files
2. Aggregates tech debt and deferred gaps
3. Checks cross-phase integration
4. Verifies E2E user flows

**Creates:**
- `.planning/v{version}-MILESTONE-AUDIT.md`

---

### `/gsd:plan-milestone-gaps`

Create phases to close all gaps identified by `/gsd:audit-milestone`.

**Process:**
1. Reads MILESTONE-AUDIT.md
2. Groups gaps into logical phases
3. Creates phase entries in ROADMAP.md

---

### `/gsd:new-milestone`

Start a new milestone after completing one.

---

## Progress & Status

### `/gsd:progress`

Check current project status. Shows:
- Current phase and plan
- Completed vs remaining work
- Any blockers or decisions needed

---

### `/gsd:check-todos`

Review captured ideas and todos.

---

## Roadmap Management

### `/gsd:add-phase`

Add a new phase to the end of the roadmap.

---

### `/gsd:insert-phase [N]`

Insert a new phase at position N, shifting others down.

**Example:**
```
/gsd:insert-phase 02
```

---

### `/gsd:remove-phase [N]`

Remove phase N from the roadmap.

---

## Session Management

### `/gsd:pause-work`

Save current session state for later resumption.

**Creates:**
- `.planning/SESSION.md`

---

### `/gsd:resume-work`

Resume from a paused session.

---

## Debugging

### `/gsd:debug`

Start systematic debugging analysis.

**Process:**
1. Collects error information
2. Analyzes potential causes
3. Tests hypotheses
4. Creates fix plan

**Creates:**
- `.planning/DEBUG.md`

---

## Codebase Analysis

### `/gsd:map-codebase`

Analyze existing codebase structure. Use for brownfield projects.

**Creates:**
- `.planning/CODEBASE.md`

---

## Idea Capture

### `/gsd:add-todo [description]`

Capture an idea or task for later.

**Example:**
```
/gsd:add-todo Add dark mode support
```

---

## Task Type Reference

Plans use XML task definitions:

### Auto Task
```xml
<task type="auto">
  <name>Task 1: Create component</name>
  <files>src/components/Button.tsx</files>
  <action>Create Button component with variants</action>
  <verify>npm run typecheck</verify>
  <done>Button renders with primary/secondary variants</done>
</task>
```

### Human Verification Checkpoint
```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Login form with validation</what-built>
  <how-to-verify>
    1. Go to /login
    2. Submit empty form
    3. Verify error messages appear
  </how-to-verify>
  <resume-signal>Type 'continue' when verified</resume-signal>
</task>
```

### Decision Checkpoint
```xml
<task type="checkpoint:decision">
  <question>Which database should we use?</question>
  <options>
    - PostgreSQL (recommended for relational data)
    - MongoDB (better for flexible schemas)
  </options>
</task>
```

---

## Commit Convention

GSD uses structured commits:

```
{type}({phase}-{plan}): {description}
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `test` — Tests
- `refactor` — Code restructuring
- `docs` — Documentation
- `chore` — Maintenance

**Examples:**
```
feat(01-01): add user registration endpoint
test(01-01): add registration validation tests
fix(01-02): handle duplicate email error
```

---

## Utilities

### `/gsd:help`

Show all available GSD commands and usage guide.

---

### `/gsd:whats-new`

See what's changed since your installed version. Shows changelog entries for versions you've missed and highlights breaking changes.

---

### `/gsd:update`

Update GSD to the latest version with changelog display. Shows what's new before updating and asks for confirmation.

---

## Next Steps

- [Getting Started](/getting-started) — Quick start guide
- [How It Works](/how-it-works) — Architecture deep dive
- [Philosophy](/philosophy) — Design principles
