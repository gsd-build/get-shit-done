# Phase 1: Analysis & Mapping

## Objective
Produce a complete, documented mapping of every GSD construct to its Roo equivalent. This forms the reference used by all subsequent phases.

## Background

### Roo Slash Command System
- Slash command files live in `~/.roo/commands/` (global) or `.roo/commands/` (project-level)
- File name determines command name: `gsd-map-codebase.md` → `/gsd-map-codebase`
- Frontmatter format:
  ```yaml
  ---
  description: "What this command does"
  ---
  ```
- No `name:`, `allowed-tools:`, or `argument-hint:` frontmatter fields (Roo ignores them or uses only `description`)
- The file body is passed as a system prompt to Roo's active AI model
- `$ARGUMENTS` is substituted with whatever the user typed after the command name
- Roo reads these files in the context of the currently active mode

### GSD Claude Code Command System
- Command files live in `~/.claude/commands/gsd/` 
- File name determines `name:` field: `gsd:map-codebase`
- Frontmatter: `name:`, `description:`, `argument-hint:`, `allowed-tools:`, optionally `agent:`

## Complete Tool Name Mapping

| Claude Code Tool | Roo Tool | Notes |
|---|---|---|
| `Read` | `read_file` | Roo uses structured file reading |
| `Write` | `write_to_file` | Full file write |
| `Edit` | `apply_diff` | Targeted edits |
| `Bash` | `execute_command` | Shell execution |
| `Glob` | `list_files` | Directory listing |
| `Grep` | `search_files` | Regex file search |
| `Task` | `new_task` | Subagent spawning |
| `AskUserQuestion` | `ask_followup_question` | Interactive questions |
| `SlashCommand` | N/A - instruct AI to invoke slash command directly | |
| `TodoWrite` | `update_todo_list` | Task tracking |
| `WebFetch` | `execute_command` with curl, or MCP fetch | |
| `mcp__context7__*` | `mcp__context7__*` (same) | MCP tools pass through |

## Complete GSD Command Inventory (25 commands)

| GSD Command | Roo Command Name | Category | Complexity |
|---|---|---|---|
| `gsd:new-project` | `gsd-new-project` | Core Workflow | High |
| `gsd:discuss-phase` | `gsd-discuss-phase` | Core Workflow | High |
| `gsd:plan-phase` | `gsd-plan-phase` | Core Workflow | High |
| `gsd:execute-phase` | `gsd-execute-phase` | Core Workflow | High |
| `gsd:verify-work` | `gsd-verify-work` | Core Workflow | High |
| `gsd:audit-milestone` | `gsd-audit-milestone` | Milestone | Medium |
| `gsd:complete-milestone` | `gsd-complete-milestone` | Milestone | Medium |
| `gsd:new-milestone` | `gsd-new-milestone` | Milestone | Medium |
| `gsd:progress` | `gsd-progress` | Navigation | Low |
| `gsd:resume-work` | `gsd-resume-work` | Navigation | Low |
| `gsd:pause-work` | `gsd-pause-work` | Navigation | Low |
| `gsd:help` | `gsd-help` | Navigation | Low |
| `gsd:update` | `gsd-update` | Navigation | Low |
| `gsd:join-discord` | `gsd-join-discord` | Navigation | Trivial |
| `gsd:add-phase` | `gsd-add-phase` | Phase Mgmt | Medium |
| `gsd:insert-phase` | `gsd-insert-phase` | Phase Mgmt | Medium |
| `gsd:remove-phase` | `gsd-remove-phase` | Phase Mgmt | Medium |
| `gsd:list-phase-assumptions` | `gsd-list-phase-assumptions` | Phase Mgmt | Low |
| `gsd:plan-milestone-gaps` | `gsd-plan-milestone-gaps` | Phase Mgmt | Medium |
| `gsd:research-phase` | `gsd-research-phase` | Phase Mgmt | Medium |
| `gsd:map-codebase` | `gsd-map-codebase` | Brownfield | Medium |
| `gsd:quick` | `gsd-quick` | Utilities | High |
| `gsd:debug` | `gsd-debug` | Utilities | High |
| `gsd:add-todo` | `gsd-add-todo` | Utilities | Low |
| `gsd:check-todos` | `gsd-check-todos` | Utilities | Low |
| `gsd:settings` | `gsd-settings` | Config | Medium |
| `gsd:set-profile` | `gsd-set-profile` | Config | Low |
| `gsd:add-tests` | `gsd-add-tests` | Utilities | Medium |
| `gsd:reapply-patches` | `gsd-reapply-patches` | Utilities | Low |
| `gsd:cleanup` | `gsd-cleanup` | Utilities | Low |

## GSD Agent → Roo Mode Mapping

GSD uses Claude's `Task()` with a `subagent_type` (the agent markdown file name). Roo uses `new_task` with a `mode` slug. Since GSD agent definitions are rich role-based system prompts, they need to be deployed as Roo custom modes OR the spawned `new_task` passes the agent prompt inline.

**Recommended Approach:** Deploy GSD agents as Roo custom modes registered in `custom_modes.yaml`. The installer adds the required mode entries. The `new_task` call specifies the mode slug.

| GSD Agent | Roo Mode Slug | Description |
|---|---|---|
| `gsd-executor` | `gsd-executor` | Executes plans with atomic commits |
| `gsd-planner` | `gsd-planner` | Creates PLAN.md files |
| `gsd-phase-researcher` | `gsd-phase-researcher` | Domain research for phases |
| `gsd-project-researcher` | `gsd-project-researcher` | Project-level research |
| `gsd-research-synthesizer` | `gsd-research-synthesizer` | Synthesizes research findings |
| `gsd-codebase-mapper` | `gsd-codebase-mapper` | Maps existing codebases |
| `gsd-roadmapper` | `gsd-roadmapper` | Generates ROADMAP.md |
| `gsd-debugger` | `gsd-debugger` | Systematic debugging |
| `gsd-verifier` | `gsd-verifier` | Post-execution verification |
| `gsd-plan-checker` | `gsd-plan-checker` | Plan quality verification |
| `gsd-integration-checker` | `gsd-integration-checker` | Integration validation |

## Path Replacement Map

| Old Path (Claude) | New Path (Roo) |
|---|---|
| `~/.claude/get-shit-done/` | `~/.roo/get-shit-done/` |
| `$HOME/.claude/get-shit-done/` | `$HOME/.roo/get-shit-done/` |
| `"$HOME/.claude/get-shit-done/bin/gsd-tools.cjs"` | `"$HOME/.roo/get-shit-done/bin/gsd-tools.cjs"` |
| `.claude/skills/` | `.roo/skills/` (or `.agents/skills/` - keep both) |

## Roo-Specific Frontmatter Format

```markdown
---
description: "Brief description for the /gsd-xxx command palette entry"
---

[command body content]
```

## Key Differences from Claude Code

1. **No parallel subagents in same session**: Roo's `new_task` is sequential unless an orchestrator manages multiple tasks. GSD's parallel wave execution (`execute-phase` spawning multiple simultaneous executors) needs to be adapted to sequential with clear sequencing notes.

2. **Mode context**: In Roo, each `new_task` runs in a specific mode with its own tool restrictions. Agent mode definitions must be configured to allow appropriate tools.

3. **No `CLAUDE.md`**: GSD agents check for `./CLAUDE.md` for project instructions. The Roo equivalent is `.roo/rules/` directory files. Agent instructions should check both for compatibility.

4. **`$ARGUMENTS` substitution**: Roo supports `$ARGUMENTS` in slash command files (same as Claude Code).

## Progress Checklist
- [ ] Complete tool name mapping verified against Roo documentation
- [ ] All 25+ commands inventoried
- [ ] Agent-to-mode mapping finalized
- [ ] Path replacement map complete
- [ ] Roo frontmatter format confirmed
- [ ] Key behavioral differences documented
