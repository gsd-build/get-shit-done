---
description: Execute a quick task with GSD guarantees (atomic commits, state tracking) but skip optional agents
argument-hint: [none]
---



## Objective
Execute a quick task with GSD guarantees (atomic commits, state tracking) but skip optional agents

## Compatibility
- Use .codex/skills/get-shit-done-codex semantics.
- Treat upstream workflow as the source of truth.
- Replace user-specific paths with workspace-relative paths (.claude/..., .planning/...).
- Run engine commands through PowerShell: 
node .claude/get-shit-done/bin/gsd-tools.js ...
- Parse JSON with ConvertFrom-Json; parse key/value output when workflow uses KEY=value raw mode.
- No jq / bash-only constructs.

## Subagent lifecycle (required)

- Translate each upstream `Task(...)` into `spawn_agent` -> `wait` -> `close_agent`.
- Spawn only when the upstream workflow defines an agent role.
- Use `.claude/agents/gsd-*.md` as role context for each spawned agent.
- Do not advance workflow steps until wait and close complete.
## Execution
1. Parse [none] from the user input.
2. Run init:
node .claude/get-shit-done/bin/gsd-tools.js init quick "$ARG" --raw

3. Load .claude/get-shit-done/workflows/quick.md and execute it step-by-step.
4. Translate each Task(...) in workflow into:
   - spawn_agent with the matching role file context from .claude/agents/.
   - wait for each spawned agent and apply returned output before moving forward.
5. Preserve all gates and routing from upstream workflow.
6. Preserve commit behavior using 
node .claude/get-shit-done/bin/gsd-tools.js commit "message" --files ....
7. If commit preflight fails (no git / no commit flag), proceed in read-only mode and report clearly.

## Completion output
- Summarize key artifacts created/updated and next recommended command.


