# Claude Code to OpenCode Mapping

**Research Date:** 2026-01-14
**Status:** Based on OpenCode documentation and sst/opencode repository

> **Note:** OpenCode (opencode-ai/opencode) was archived September 2025 and continued as "Crush" by Charmbracelet. The sst/opencode fork is the active version referenced in this document.

---

## Structure Mapping

| Claude Code | OpenCode | Notes |
|-------------|----------|-------|
| `~/.claude/commands/` | `~/.config/opencode/command/` | Global commands |
| `./.claude/commands/` | `.opencode/command/` | Project-local commands |
| `~/.claude/get-shit-done/` | `~/.config/opencode/gsd/` | Framework files (global) |
| `./.claude/get-shit-done/` | `.opencode/gsd/` | Framework files (local) |
| N/A | `~/.config/opencode/agent/` | Global agent definitions |
| N/A | `.opencode/agent/` | Project-local agents |
| `CLAUDE.md` (rules) | `AGENTS.md` | Project-level rules |
| (none - per-command) | `opencode.json` | Global configuration |

---

## Frontmatter Mapping

### Command Frontmatter

| Claude Code Field | OpenCode Field | Transform |
|-------------------|----------------|-----------|
| `name: gsd:command-name` | (filename becomes command) | Remove; use directory/filename |
| `description: ...` | `description: ...` | Same |
| `argument-hint: "[optional]"` | (not needed) | Remove; use `$ARGUMENTS` in body |
| `allowed-tools: [...]` | `tools: {...}` OR agent permissions | Different format - see below |

**Claude Code Format:**
```yaml
---
name: gsd:new-project
description: Initialize a new project
argument-hint: "[optional]"
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---
```

**OpenCode Format:**
```yaml
---
description: Initialize a new project
# Tools controlled via:
# 1. Agent permissions (if using subtask agent)
# 2. Global opencode.json config
# 3. Inline tools: { read: true, write: true }
---
```

### Agent Frontmatter (OpenCode-specific)

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | One-line description |
| `mode` | `primary` \| `subagent` | Agent type |
| `model` | string | Model ID (e.g., `claude-sonnet-4-20250514`) |
| `temperature` | number | 0.0-1.0 |
| `edit` | `allow` \| `deny` \| `ask` | File edit permission |
| `bash` | `allow` \| `deny` \| `ask` | Shell permission |
| `webfetch` | `allow` \| `deny` \| `ask` | Web fetch permission |
| `tools` | object | Tool-specific overrides |

**Example Agent:**
```yaml
---
description: Execute a single plan with full context
mode: subagent
model: claude-sonnet-4-20250514
temperature: 0
edit: allow
bash: allow
webfetch: deny
---
[System prompt / workflow content here]
```

---

## Tool Name Mapping

| Claude Code Tool | OpenCode Tool | Notes |
|------------------|---------------|-------|
| `Read` | `read` | Same - file reading |
| `Write` | `write` | Same - file writing |
| `Edit` | `edit` | Same - file editing |
| `Bash` | `bash` | Same - shell execution |
| `Glob` | `glob` | Same - file pattern matching |
| `Grep` | `grep` | Same - content search |
| `WebFetch` | `webfetch` | Same - URL fetching |
| `WebSearch` | `websearch` | Same - web search |
| `Task` | `task` | Subagent spawning |
| `TodoWrite` | `todowrite` | Todo list management |
| `TodoRead` | `todoread` | Todo list reading |
| `AskUserQuestion` | (natural conversation) | No explicit tool - just ask |
| `NotebookEdit` | ? | May not exist in OpenCode |
| `KillShell` | ? | May not exist in OpenCode |
| `BashOutput` | ? | May not exist in OpenCode |
| N/A | `list` | Directory listing (OpenCode-specific) |
| N/A | `skill` | Skill loading (OpenCode-specific) |
| N/A | `codesearch` | Code search (OpenCode-specific) |
| N/A | `patch` | Apply patches (OpenCode-specific) |

---

## Placeholder/Variable Mapping

| Claude Code | OpenCode | Notes |
|-------------|----------|-------|
| `$ARGUMENTS` | `$ARGUMENTS` | **Same!** Command arguments |
| `@path/to/file` | `@path/to/file` | **Same!** File inclusion |
| `<execution_context>` | (just use @-refs) | Semantic tag - optional in OpenCode |
| N/A | `!command` | Inject bash output (OpenCode-specific) |
| N/A | `$NAME` | Named arguments (uppercase, starts with letter) |

---

## Command-by-Command Mapping

### Core Workflow Commands (6)

| Command | Claude Code Frontmatter | OpenCode Changes |
|---------|------------------------|------------------|
| `new-project` | `name: gsd:new-project`<br>`allowed-tools: [Read, Write, Bash, AskUserQuestion]` | Remove `name`, `allowed-tools`<br>Keep `description` |
| `create-roadmap` | `name: gsd:create-roadmap`<br>`allowed-tools: [Read, Write, Bash, Glob, AskUserQuestion]` | Same transformation |
| `plan-phase` | `name: gsd:plan-phase`<br>`argument-hint: "[phase]"` | Remove `name`, `argument-hint`<br>Use `$ARGUMENTS` in body |
| `execute-phase` | `name: gsd:execute-phase`<br>`allowed-tools: [..., Task]` | Task → OpenCode subagent syntax |
| `execute-plan` | `name: gsd:execute-plan`<br>`allowed-tools: [...]` | Same transformation |
| `verify-work` | `name: gsd:verify-work` | Same transformation |

### Planning Commands (4)

| Command | Claude Code Frontmatter | OpenCode Changes |
|---------|------------------------|------------------|
| `discuss-phase` | `argument-hint: "<number>"` | Use `$ARGUMENTS` |
| `research-phase` | `argument-hint: "<number>"` | Use `$ARGUMENTS` |
| `list-phase-assumptions` | `argument-hint: "<number>"` | Use `$ARGUMENTS` |
| `map-codebase` | `allowed-tools: [..., Task]` | Task → subagent |

### Roadmap Management (3)

| Command | Claude Code Frontmatter | OpenCode Changes |
|---------|------------------------|------------------|
| `add-phase` | `argument-hint: "<description>"` | Use `$ARGUMENTS` |
| `insert-phase` | `argument-hint: "<after> <description>"` | Use `$ARGUMENTS` |
| `remove-phase` | `argument-hint: "<number>"` | Use `$ARGUMENTS` |

### Milestone Commands (3)

| Command | Claude Code Frontmatter | OpenCode Changes |
|---------|------------------------|------------------|
| `discuss-milestone` | No special fields | Minimal changes |
| `new-milestone` | `argument-hint: "[name]"` | Use `$ARGUMENTS` |
| `complete-milestone` | `argument-hint: "<version>"` | Use `$ARGUMENTS` |

### Session/Utility Commands (6)

| Command | Claude Code Frontmatter | OpenCode Changes |
|---------|------------------------|------------------|
| `progress` | No special fields | Minimal changes |
| `resume-work` | No special fields | Minimal changes |
| `pause-work` | No special fields | Minimal changes |
| `status` | `argument-hint: "[--wait]"` | Use `$ARGUMENTS` |
| `debug` | `argument-hint: "[issue]"` | Use `$ARGUMENTS` |
| `help` | No special fields | Minimal changes |

### Issue/Todo Commands (4)

| Command | Claude Code Frontmatter | OpenCode Changes |
|---------|------------------------|------------------|
| `consider-issues` | No special fields | Minimal changes |
| `plan-fix` | `argument-hint: "[plan]"` | Use `$ARGUMENTS` |
| `add-todo` | `argument-hint: "[description]"` | Use `$ARGUMENTS` |
| `check-todos` | `argument-hint: "[area]"` | Use `$ARGUMENTS` |

---

## Agent System Comparison

### Claude Code Subagent Model

```
Task tool spawns subagents:
- Uses Task(prompt="...", subagent_type="...")
- subagent_type: "general-purpose", "Explore", "Plan", etc.
- Fresh context per subagent (200k tokens)
- Orchestrator coordinates via Task tool

Parallel execution:
- Multiple Task calls in single message
- Task results collected when complete
```

### OpenCode Agent Model

```
Two types of agents:
1. Primary agents - Tab to switch (build, plan)
2. Subagents - Invoked via @-syntax (@general)

Built-in agents:
- build: Full access for development
- plan: Read-only for analysis
- general: Subagent for complex tasks

Custom agents:
- Define in .opencode/agent/*.md
- YAML frontmatter + system prompt as body
- mode: "primary" or "subagent"

Parallel execution:
- Use task tool with multiple subagents
- OpenCode handles via internal scheduling
```

### Mapping Strategy for GSD

| GSD Concept | Claude Code | OpenCode Approach |
|-------------|-------------|-------------------|
| Plan execution | Task tool | Custom subagent in `.opencode/agent/gsd/execute-plan.md` |
| Parallel plans | Multiple Task calls | task tool with custom subagents |
| Explore agents | `subagent_type="Explore"` | Custom `gsd/explore` agent |
| Wave execution | Orchestrator pattern | Same - orchestrator spawns subagents |

---

## Path Reference Updates

All `@` references in commands must update:

| Claude Code Path | OpenCode Path |
|------------------|---------------|
| `@~/.claude/get-shit-done/workflows/` | `@~/.config/opencode/gsd/workflows/` |
| `@~/.claude/get-shit-done/templates/` | `@~/.config/opencode/gsd/templates/` |
| `@~/.claude/get-shit-done/references/` | `@~/.config/opencode/gsd/references/` |
| `@./.claude/get-shit-done/...` | `@.opencode/gsd/...` |

**Installer must perform path substitution at install time.**

---

## Configuration File Mapping

### Claude Code: Per-project `.planning/config.json`

```json
{
  "mode": "yolo",
  "depth": "quick",
  "parallelization": {
    "enabled": true,
    "max_concurrent_agents": 3
  }
}
```

### OpenCode: `opencode.json` (project or global)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "agents": {
    "build": {
      "model": "claude-sonnet-4-20250514"
    },
    "gsd/execute-plan": {
      "model": "claude-sonnet-4-20250514",
      "edit": "allow",
      "bash": "allow"
    }
  },
  "permissions": {
    "edit": "allow",
    "bash": "allow"
  }
}
```

**GSD config.json remains unchanged** - it's project state, not platform config.

---

## Shared Source Architecture

### Recommendation: Option A - Claude Code as Source, Transform at Install

**Decision:** Maintain Claude Code format as the source of truth, with install-time transformation for OpenCode.

**Rationale:**
1. Claude Code version already works - minimal risk to existing users
2. Single source of truth - no divergence between versions
3. Transformation is mechanical - regex path substitution + frontmatter adjustment
4. Most content is identical between platforms (workflows, templates, references)

### Source Organization

```
get-shit-done/                    # SOURCE OF TRUTH (Claude Code format)
├── commands/gsd/                 # 26 command files (Claude Code frontmatter)
│   ├── new-project.md
│   └── ...
├── get-shit-done/
│   ├── workflows/                # 16 workflows (no changes needed)
│   ├── templates/                # 21 templates (no changes needed)
│   └── references/               # 14 references (no changes needed)
└── bin/
    └── install.js                # Multi-platform installer
```

### Install-Time Transformation

The installer (`bin/install.js`) performs platform-specific transformations:

**1. Directory Structure**
```javascript
if (platform === 'claude-code') {
  targetDir = '~/.claude/commands/gsd/';
  frameworkDir = '~/.claude/get-shit-done/';
} else if (platform === 'opencode') {
  targetDir = '~/.config/opencode/command/gsd/';
  frameworkDir = '~/.config/opencode/gsd/';
  agentDir = '~/.config/opencode/agent/gsd/';
}
```

**2. Frontmatter Transformation (OpenCode only)**
```javascript
// Remove Claude Code-specific fields
content = content.replace(/^name:\s+gsd:.+$/m, '');
content = content.replace(/^argument-hint:.+$/m, '');
content = content.replace(/^allowed-tools:[\s\S]*?(?=^---|\n\n)/m, '');

// Normalize empty frontmatter
content = content.replace(/---\n+---/, '---\ndescription: [from original]\n---');
```

**3. Path Substitution**
```javascript
if (platform === 'opencode') {
  content = content.replace(
    /@~\/\.claude\/get-shit-done\//g,
    '@~/.config/opencode/gsd/'
  );
  content = content.replace(
    /@\.\/\.claude\/get-shit-done\//g,
    '@.opencode/gsd/'
  );
}
```

**4. Agent Generation (OpenCode only)**
For workflows that need agent definitions, installer generates:
```markdown
---
description: Execute a single plan with full context
mode: subagent
model: claude-sonnet-4-20250514
edit: allow
bash: allow
---
@~/.config/opencode/gsd/workflows/execute-plan.md
```

### Shared Files (No Transformation Needed)

| Category | Files | Changes |
|----------|-------|---------|
| Workflows | 16 | None - pure prompt content |
| Templates | 21 | None - document structures |
| References | 14 | None - conceptual guidance |

These files use `@` references internally, which work identically on both platforms. Path prefixes are in the commands that load them, not in the files themselves.

### Platform-Specific Files

| Category | Claude Code | OpenCode |
|----------|-------------|----------|
| Commands | 26 files (original format) | 26 files (transformed frontmatter) |
| Agents | N/A | ~5-10 generated agents |
| Config | N/A | `opencode.json` template |

### Installer Flow

```
npx get-shit-done-cc
    │
    ├─► "Which platform?"
    │   ├── Claude Code
    │   └── OpenCode
    │
    ├─► "Global or local install?"
    │   ├── Global (~/.claude/ or ~/.config/opencode/)
    │   └── Local (./.claude/ or .opencode/)
    │
    └─► Install:
        ├── Copy commands (with platform transform)
        ├── Copy framework files (workflows, templates, refs)
        ├── Generate agents (OpenCode only)
        └── Create config template (OpenCode only)
```

### Why Not Option B (Separate Directories)?

**Option B would require:**
- Maintaining two copies of 26 command files
- Risk of divergence as features are added
- Double the testing surface
- Unclear which version to modify

**Option A advantages:**
- Single source of truth
- Transformation is deterministic
- Changes to Claude Code version auto-propagate
- Installer already does path substitution (add frontmatter transform)

### Why Not Option C (Shared Core + Overlays)?

**Option C complexity:**
- Requires abstraction layer
- More code in installer
- Harder to understand file relationships
- Overkill for ~4 frontmatter field differences

---

## Known Limitations & Issues

1. **Agent visibility bug:** Custom agents defined in markdown may not appear in Tab cycle ([Issue #3461](https://github.com/sst/opencode/issues/3461))

2. **YAML parsing crash:** Commands with YAML-like content can crash on startup - must quote values properly ([Issue #3537](https://github.com/sst/opencode/issues/3537))

3. **TodoWrite availability:** Not all models support todowrite/todoread tools ([Issue #1336](https://github.com/sst/opencode/issues/1336))

4. **No AskUserQuestion equivalent:** OpenCode uses natural conversation - may need to adapt GSD's structured questioning approach

---

## Sources

- [OpenCode Commands](https://opencode.ai/docs/commands/)
- [OpenCode Agents](https://opencode.ai/docs/agents/)
- [OpenCode Tools](https://opencode.ai/docs/tools/)
- [OpenCode Config](https://opencode.ai/docs/config/)
- [sst/opencode GitHub](https://github.com/sst/opencode)
- [DeepWiki - Custom Commands](https://deepwiki.com/anomalyco/opencode/8.4-custom-commands)
- [DeepWiki - Agent System](https://deepwiki.com/sst/opencode/3.2-agent-configuration)

---
*Mapping document created: 2026-01-14*
