# Phase 5: Roo-Specific Additions

## Objective
Create Roo-specific supplemental files and handle behavioral differences between Claude Code and Roo that cannot be solved by simple path/frontmatter conversion. This includes parallel execution adaptation, `gsd-tools.cjs` path update, and the `gsd-help` command update for Roo command naming.

## Files to Create/Modify

- `get-shit-done/references/roo-runtime.md` — new reference file explaining Roo-specific patterns
- `get-shit-done/workflows/roo-notes.md` — Roo behavioral adaptation notes embedded in key workflows
- `bin/install.js` — additional Roo-specific post-processing steps
- `get-shit-done/bin/lib/core.cjs` — update path resolution to support `--roo` runtime

## 5.1 Parallel Execution Adaptation

### The Problem
GSD's `execute-phase` spawns multiple `Task()` calls simultaneously:
```
Task(executor A) ─────────────────────────────────→ commit A
Task(executor B) ─────────────────────────────────→ commit B
(both running concurrently in Claude Code)
```

Roo's `new_task` is **sequential** — it completes one task before returning. Roo does not support true parallelism within a single session.

### The Solution
In the Roo version of `execute-phase`, replace parallel wave execution with **sequential wave execution** with clear ordering and progress tracking. The orchestrator spawns one executor at a time per wave, collecting results before spawning the next.

The workflow file `get-shit-done/workflows/execute-phase.md` needs a Roo-variant comment block:

```markdown
<!-- ROO RUNTIME NOTE:
In Roo, subagents are executed sequentially, not in parallel.
Waves are still honored for dependency ordering, but executors run one at a time.
This ensures correctness at the cost of speed vs. Claude Code's parallel execution.
-->
```

This comment is added during the Roo install conversion step so the workflow instructions are accurate for Roo's model.

### Impact Assessment
- Correctness: ✅ Unchanged — wave ordering still respected
- Speed: ⚠️ Slower for multi-plan phases (sequential vs parallel)
- User Experience: ℹ️ Progress shown per-executor instead of batch

### Implementation in Converter
```js
function addRooParallelismNote(content) {
  if (content.includes('parallel') || content.includes('Wave')) {
    const note = `\n<!-- ROO RUNTIME NOTE: Roo executes subagents sequentially, not in parallel. ` +
                 `Waves are executed in order but plans within a wave run one at a time. -->\n`;
    content = content.replace('<process>', '<process>' + note);
  }
  return content;
}
```

## 5.2 `gsd-tools.cjs` Path Update in `core.cjs`

The `get-shit-done/bin/lib/core.cjs` contains the path resolution for `gsd-tools.cjs`. It currently resolves to `~/.claude/get-shit-done/bin/gsd-tools.cjs`. 

When installed for Roo, the bin files are at `~/.roo/get-shit-done/bin/`. The `gsd-tools.cjs` itself needs to know which runtime it's running under to resolve paths correctly.

### Solution: Runtime Flag in `gsd-tools.cjs`

The tools CJS can detect its own path to determine the runtime:
```js
const selfDir = path.dirname(__filename); // e.g., ~/.roo/get-shit-done/bin
const configDir = path.dirname(path.dirname(selfDir)); // e.g., ~/.roo
const gsdDir = path.join(configDir, 'get-shit-done');
```

This self-referential path detection means the same `gsd-tools.cjs` works correctly regardless of whether it's deployed at `~/.claude/` or `~/.roo/` — no changes needed as long as the file is copied to the correct location.

**Verification:** Confirm `core.cjs` uses `path.dirname(__filename)` for self-resolution rather than hardcoded `~/.claude/` paths.

## 5.3 `gsd-help` Command Roo Variant

The `gsd:help` command in Claude Code outputs a reference to all `/gsd:xxx` commands. For Roo, it should output `/gsd-xxx` command names.

### Conversion in help workflow
During install, the `help.md` workflow file gets a path replacement pass that also replaces command name patterns:
```js
// In convertWorkflowForRoo():
content = content.replace(/\/gsd:([a-z0-9-]+)/g, '/gsd-$1');
```

This ensures the help text shown to users uses correct Roo command names.

## 5.4 `gsd-update` Command Roo Variant

The `gsd:update` command in Claude Code uses the GSD npm package update mechanism. For Roo, the update flow should:
1. Check the installed GSD version
2. Run `npm install -g get-shit-done-cc` (or equivalent) — same as Claude Code
3. Re-run the Roo installer: `node ~/.roo/get-shit-done/bin/install.js --roo --global`

The `update.md` workflow is updated with these Roo-specific steps during conversion.

## 5.5 New `gsd-reapply-patches` for Roo

When a user runs `gsd-update` in Roo, their custom Roo command file modifications (if any) need to be preserved. The existing `reapply-patches` workflow handles the Claude Code case (`~/.claude/commands/gsd/`). The Roo version points to `~/.roo/commands/gsd-*.md`.

The installer's patch backup path for Roo is `~/.roo/gsd-local-patches/` (mirrors Claude's `~/.claude/gsd-local-patches/`).

## 5.6 New Reference File: `get-shit-done/references/roo-runtime.md`

This file is deployed to `~/.roo/get-shit-done/references/roo-runtime.md` and provides guidance to GSD agents running in Roo context:

```markdown
# GSD Roo Runtime Reference

## Tool Name Equivalents
When executing tasks in Roo, use these tool equivalents:

| Intent | Roo Tool |
|--------|----------|
| Read a file | `read_file` |
| Write/create a file | `write_to_file` |
| Make targeted edits | `apply_diff` |
| Run shell commands | `execute_command` |
| List directory contents | `list_files` |
| Search files with regex | `search_files` |
| Spawn a subagent | `new_task` with mode slug |
| Ask the user a question | `ask_followup_question` |
| Update task tracking | `update_todo_list` |

## Spawning Subagents in Roo
Use `new_task` with the appropriate GSD mode slug:
- Executor: `gsd-executor`
- Planner: `gsd-planner`
- Phase Researcher: `gsd-phase-researcher`
- Project Researcher: `gsd-project-researcher`
- Codebase Mapper: `gsd-codebase-mapper`
- Roadmapper: `gsd-roadmapper`
- Debugger: `gsd-debugger`
- Verifier: `gsd-verifier`
- Plan Checker: `gsd-plan-checker`
- Integration Checker: `gsd-integration-checker`

## Sequential Execution
Roo executes subagents sequentially. Wave-based parallel plans are honored for
dependency ordering but run one at a time. Progress is tracked in STATE.md.

## Project Context Files
Roo uses `.roo/rules/*.md` for project instructions (equivalent to `CLAUDE.md`).
GSD agents check both `.roo/rules/` and `CLAUDE.md` for compatibility.

## GSD Tools Path
`node "$HOME/.roo/get-shit-done/bin/gsd-tools.cjs" [command]`
```

## 5.7 `gsd-tools.cjs` WebSearch Fallback

`gsd-tools.cjs` includes a `websearch` command used by `gsd-phase-researcher`. In Roo, web search can be done via:
- MCP tools (if a fetch/search MCP server is configured)
- `execute_command` with `curl` for simple HTTP fetches

The `websearch` subcommand of `gsd-tools.cjs` outputs a list of URLs/snippets. Since this is a Node.js script using system tools, it should work in Roo as-is when called via `execute_command`. No changes needed.

## Progress Checklist
- [ ] Parallel execution note added to execute-phase workflow conversion
- [ ] `addRooParallelismNote()` converter function implemented
- [ ] `core.cjs` path self-resolution verified (no hardcoded `~/.claude`)
- [ ] Help workflow command name replacement (`/gsd:xxx` → `/gsd-xxx`)
- [ ] Update workflow Roo reinstall step documented
- [ ] `reapply-patches` Roo path handling
- [ ] `get-shit-done/references/roo-runtime.md` file created
- [ ] Workflow conversion pass applied to all workflow files during Roo install
