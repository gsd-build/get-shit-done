# GSD to OpenCode Conversion Plan

## Executive Summary

This document outlines the conversion of Get Shit Done (GSD) from Claude Code to [OpenCode](https://opencode.ai/), the open-source AI coding agent.

**Key Finding:** GSD is 99% markdown prompts with minimal code. The conversion is primarily a **restructuring exercise** to match OpenCode's file conventions.

---

## Platform Comparison

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLAUDE CODE vs OPENCODE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  FEATURE              CLAUDE CODE              OPENCODE                 │
│  ───────────────────────────────────────────────────────────────────   │
│  Custom Commands      ~/.claude/commands/      .opencode/command/       │
│  Command Format       YAML frontmatter MD      YAML frontmatter MD      │
│  Rules/Instructions   CLAUDE.md                AGENTS.md                │
│  Agents               Task tool (built-in)     .opencode/agent/         │
│  Config File          (none - in commands)     opencode.json            │
│  File References      @path/to/file            @path/to/file (same!)    │
│  Tool Access          allowed-tools in YAML    permissions in YAML      │
│                                                                          │
│  KEY SIMILARITIES:                                                      │
│  ✓ Both use markdown with YAML frontmatter                             │
│  ✓ Both support @-references for file inclusion                        │
│  ✓ Both support custom commands via markdown files                     │
│  ✓ Both have built-in tools (bash, file ops, etc.)                     │
│                                                                          │
│  KEY DIFFERENCES:                                                       │
│  ✗ Different directory structure                                       │
│  ✗ Different frontmatter schema                                        │
│  ✗ OpenCode has explicit agent system (primary/subagent)               │
│  ✗ OpenCode uses opencode.json for config (not per-command)            │
│  ✗ Different tool permission syntax                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Mapping

### 1. Commands (26 files)

**Source:** `commands/gsd/*.md`
**Target:** `.opencode/command/gsd/*.md`

| Claude Code | OpenCode |
|-------------|----------|
| `~/.claude/commands/gsd/` | `~/.config/opencode/command/gsd/` (global) |
| `./.claude/commands/gsd/` | `.opencode/command/gsd/` (local) |

**Frontmatter Conversion:**

```yaml
# CLAUDE CODE FORMAT
---
name: gsd:new-project
description: Initialize a new project
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

# OPENCODE FORMAT
---
description: Initialize a new project
# Tools controlled via agent permissions or inline
---
```

### 2. Agents/Workflows (16 files)

**Source:** `get-shit-done/workflows/*.md`
**Target:** `.opencode/agent/gsd/*.md` OR keep as reference files

OpenCode has a native agent system. GSD's workflows could become:

**Option A: Convert to OpenCode Agents**
```yaml
# .opencode/agent/gsd/execute-plan.md
---
description: Execute a single PLAN.md file with full context
mode: subagent
model: claude-sonnet-4-20250514
edit: allow
bash: allow
---
[workflow content as system prompt]
```

**Option B: Keep as Reference Files**
Commands reference workflows via `@` syntax (works in both platforms).

**Recommendation:** Option B initially - simpler, maintains GSD's architecture.

### 3. Templates (21 files)

**Source:** `get-shit-done/templates/*.md`
**Target:** `.opencode/gsd/templates/*.md` (no change needed)

Templates are referenced via `@` paths - format identical in both platforms.

### 4. References (14 files)

**Source:** `get-shit-done/references/*.md`
**Target:** `.opencode/gsd/references/*.md` (no change needed)

### 5. Rules/Instructions

**Source:** GSD principles embedded in commands
**Target:** `AGENTS.md` in project root + `.opencode/gsd/references/`

Create global rules file:
```markdown
# AGENTS.md

## GSD Principles

[Content from get-shit-done/references/principles.md]

## Context Management

[Key rules about context rot, plan sizing, etc.]
```

### 6. Configuration

**Source:** `.planning/config.json` (created per-project)
**Target:** `opencode.json` (project or global)

```json
// opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "agents": {
    "build": {
      "model": "claude-sonnet-4-20250514"
    }
  }
}
```

---

## Directory Structure Mapping

```
CLAUDE CODE STRUCTURE              OPENCODE STRUCTURE
───────────────────────           ──────────────────

~/.claude/                        ~/.config/opencode/
├── commands/                     ├── command/
│   └── gsd/                     │   └── gsd/
│       ├── new-project.md       │       ├── new-project.md
│       ├── create-roadmap.md    │       ├── create-roadmap.md
│       └── [24 more...]         │       └── [24 more...]
│                                │
└── get-shit-done/               ├── agent/
    ├── workflows/               │   └── gsd/              (optional)
    │   └── *.md                 │       └── *.md
    ├── templates/               │
    │   └── *.md                 └── gsd/                  (reference files)
    └── references/                  ├── workflows/
        └── *.md                     │   └── *.md
                                     ├── templates/
                                     │   └── *.md
                                     └── references/
                                         └── *.md

PROJECT-LEVEL:                    PROJECT-LEVEL:

.planning/                        .planning/               (unchanged)
├── PROJECT.md                   ├── PROJECT.md
├── ROADMAP.md                   ├── ROADMAP.md
├── STATE.md                     ├── STATE.md
└── config.json                  └── config.json

                                 .opencode/               (new, optional)
                                 ├── command/gsd/         (local commands)
                                 └── agent/gsd/           (local agents)

                                 AGENTS.md                (GSD rules)
                                 opencode.json            (tool config)
```

---

## Conversion Phases

### Phase 1: Foundation (Core Infrastructure)

**Goal:** Set up OpenCode project structure and installer

**Plans:**

1. **01-01: Create OpenCode directory structure**
   - Create `.opencode/` structure template
   - Create `opencode.json` schema for GSD
   - Update `bin/install.js` for OpenCode paths

2. **01-02: Convert path references**
   - Replace `~/.claude/` with `~/.config/opencode/`
   - Replace `./.claude/` with `.opencode/`
   - Update all `@` references in markdown files

3. **01-03: Create AGENTS.md template**
   - Extract core principles from references
   - Create project-level rules file
   - Document GSD conventions for OpenCode

### Phase 2: Command Conversion (26 commands)

**Goal:** Convert all slash commands to OpenCode format

**Plans:**

1. **02-01: Convert core workflow commands (6)**
   - `new-project.md`
   - `create-roadmap.md`
   - `plan-phase.md`
   - `execute-phase.md`
   - `execute-plan.md`
   - `verify-work.md`

2. **02-02: Convert planning commands (4)**
   - `discuss-phase.md`
   - `research-phase.md`
   - `list-phase-assumptions.md`
   - `map-codebase.md`

3. **02-03: Convert roadmap management commands (3)**
   - `add-phase.md`
   - `insert-phase.md`
   - `remove-phase.md`

4. **02-04: Convert milestone commands (3)**
   - `discuss-milestone.md`
   - `new-milestone.md`
   - `complete-milestone.md`

5. **02-05: Convert session/utility commands (6)**
   - `pause-work.md`
   - `resume-work.md`
   - `progress.md`
   - `status.md`
   - `debug.md`
   - `help.md`

6. **02-06: Convert issue/todo commands (4)**
   - `consider-issues.md`
   - `plan-fix.md`
   - `add-todo.md`
   - `check-todos.md`

### Phase 3: Workflow/Agent Migration

**Goal:** Adapt workflows to OpenCode's agent system

**Plans:**

1. **03-01: Evaluate agent conversion candidates**
   - Analyze which workflows benefit from agent conversion
   - Document OpenCode agent limitations
   - Decide per-workflow strategy

2. **03-02: Convert execution workflows (if beneficial)**
   - `execute-phase.md` → agent or keep as reference
   - `execute-plan.md` → agent or keep as reference

3. **03-03: Update subagent spawning**
   - Replace Claude Code `Task` tool references
   - Adapt to OpenCode's `@general` subagent syntax
   - Test parallel execution capabilities

### Phase 4: Testing & Documentation

**Goal:** Validate conversion and update docs

**Plans:**

1. **04-01: Create test project**
   - Run through full GSD workflow on OpenCode
   - Document any behavioral differences
   - Fix compatibility issues

2. **04-02: Update documentation**
   - Update README for OpenCode
   - Update installation instructions
   - Create OpenCode-specific troubleshooting

3. **04-03: Dual-platform support (optional)**
   - Consider maintaining both Claude Code and OpenCode versions
   - Create platform detection in installer
   - Abstract platform-specific paths

---

## Frontmatter Conversion Reference

### Command Frontmatter

```yaml
# BEFORE (Claude Code)
---
name: gsd:execute-phase
description: Execute all plans in a phase
argument-hint: "<phase-number>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - TodoWrite
  - AskUserQuestion
---

# AFTER (OpenCode)
---
description: Execute all plans in a phase with wave-based parallelization
# Note: Tools controlled via agent permissions or global config
# $ARGUMENTS receives the phase number
---
```

### Agent Frontmatter (if converting workflows)

```yaml
# OpenCode Agent Format
---
description: Execute a single plan with full context
mode: subagent
model: claude-sonnet-4-20250514
temperature: 0
edit: allow
bash: allow
webfetch: deny
---
```

---

## Key Technical Challenges

### 1. Task Tool Replacement

**Claude Code:**
```
Task(prompt="...", subagent_type="general-purpose")
```

**OpenCode:**
- Use `@general` subagent syntax
- Or create custom subagents in `.opencode/agent/`
- Parallel execution may require different approach

### 2. Tool Permissions

**Claude Code:** Per-command `allowed-tools` list

**OpenCode:**
- Global permissions in `opencode.json`
- Per-agent permissions in frontmatter
- Built-in modes (build vs plan)

### 3. AskUserQuestion Replacement

**Claude Code:** Explicit `AskUserQuestion` tool

**OpenCode:** Natural conversation flow (no explicit tool needed)

### 4. Path Abstraction

Both platforms use `@` for file references, but base paths differ:
- Need to update all hardcoded paths
- Consider using relative paths where possible
- Installer must handle path substitution

---

## Effort Estimate

| Phase | Description | Files | Complexity |
|-------|-------------|-------|------------|
| 1 | Foundation | 3-5 | Medium |
| 2 | Command Conversion | 26 | Low (mostly search/replace) |
| 3 | Workflow/Agent | 16 | High (architecture decisions) |
| 4 | Testing & Docs | 5-10 | Medium |

**Total: ~50-60 files, primarily text transformations**

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenCode subagent behavior differs | High | Test early, adapt workflows |
| Tool permission model incompatible | Medium | Use permissive global config |
| Parallel execution not supported | High | Fall back to sequential |
| Path substitution edge cases | Low | Comprehensive testing |

---

## Sources

- [OpenCode Official Site](https://opencode.ai/)
- [OpenCode GitHub](https://github.com/opencode-ai/opencode)
- [OpenCode Docs - Config](https://opencode.ai/docs/config/)
- [OpenCode Docs - Commands](https://opencode.ai/docs/commands/)
- [OpenCode Docs - Agents](https://opencode.ai/docs/agents/)
- [OpenCode Docs - Rules](https://opencode.ai/docs/rules/)
