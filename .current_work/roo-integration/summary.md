# GSD → Roo Slash Command Integration: Summary

## Overview

Adapt the **get-shit-done** framework (originally a Claude Code extension) to also support **Roo Code** (VS Code extension) by extending the existing multi-runtime installer to add a `--roo` target. Roo uses a different slash command format (`~/.roo/commands/*.md`) and different tool/subagent APIs than Claude Code, but shares enough structural commonality that the installer can handle the conversion automatically.

## Key Design Decisions

### 1. Install Architecture
- GSD support files (workflows, templates, references, bin) deploy to `~/.roo/get-shit-done/`
- Slash command files deploy to `~/.roo/commands/gsd-{command-name}.md`
- `gsd-tools.cjs` is called via `node "$HOME/.roo/get-shit-done/bin/gsd-tools.cjs"` 
- The existing `getDirName()` / `getGlobalDir()` installer pattern is extended with a `'roo'` case

### 2. Command Naming
- Claude Code: `/gsd:map-codebase` (colon separator, defined by `name:` frontmatter)
- Roo: `/gsd-map-codebase` (dash separator, defined by filename)
- Installer strips `name:` and `allowed-tools:` from frontmatter for Roo

### 3. Tool Name Mapping
| Claude Code Tool | Roo Equivalent |
|---|---|
| `Read` | `read_file` |
| `Write` | `write_to_file` |
| `Edit` | `apply_diff` |
| `Bash` | `execute_command` |
| `Glob` | `list_files` |
| `Grep` | `search_files` |
| `Task` | `new_task` |
| `AskUserQuestion` | `ask_followup_question` |
| `SlashCommand` | slash command invocation |
| `TodoWrite` | `update_todo_list` |
| `WebFetch` | (MCP fetch or execute_command with curl) |

### 4. Path Replacement
All `~/.claude/get-shit-done/` references → `~/.roo/get-shit-done/`

### 5. Agent Subagent Spawning
GSD spawns subagents via `Task(subagent_type="gsd-executor", model="...")`. In Roo, the equivalent is `new_task` with a mode. The Roo conversion adds an instruction header that maps GSD agent names to appropriate Roo modes.

### 6. `@` File References
`@~/.claude/get-shit-done/workflows/xyz.md` → `@~/.roo/get-shit-done/workflows/xyz.md`  
These are understood by Roo's AI as "read this file into context."

## Implementation Status

Track the completion of each phase as implementation progresses:

- [ ] **Phase 1: Analysis & Mapping** ([1-AnalysisAndMapping.md](1-AnalysisAndMapping.md))
- [ ] **Phase 2: Installer - Roo Runtime Support** ([2-InstallerRooRuntime.md](2-InstallerRooRuntime.md))
- [ ] **Phase 3: Command Frontmatter & Path Conversion** ([3-CommandConversion.md](3-CommandConversion.md))
- [ ] **Phase 4: Agent-to-Mode Mapping & Subagent Instructions** ([4-AgentModeMapping.md](4-AgentModeMapping.md))
- [ ] **Phase 5: Roo-Specific Additions** ([5-RooSpecificAdditions.md](5-RooSpecificAdditions.md))
- [ ] **Phase 6: Testing & Validation** ([6-TestingValidation.md](6-TestingValidation.md))
