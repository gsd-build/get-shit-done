---
description: Systematic debugging with persistent state across context resets
argument-hint: [issue description]
---



## Objective
Systematic debugging with persistent state across context resets

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
1. Parse [issue description] from the user input.
2. Run init:
node .claude/get-shit-done/bin/gsd-tools.js state load --raw

3. Execute the debug flow defined in this command (no separate workflow file exists in the gsd commands set).
4. Translate each Task(...) in the debug flow into:
   - spawn_agent with the matching role file context from .claude/agents/.
   - wait for each spawned agent and apply returned output before moving forward.
5. Preserve all gates and routing from upstream workflow.
6. Preserve commit behavior using 
node .claude/get-shit-done/bin/gsd-tools.js commit "message" --files ....
7. Checkpoint handling:
   - If an active debug session exists and no new issue was provided, list open sessions and ask the user which to resume.
   - If a checkpoint is returned by the debugger, summarize the checkpoint and continue only after user confirmation.
8. If commit preflight fails (no git / no commit flag), proceed in read-only mode and report clearly.

## Completion output
- Summarize key artifacts created/updated and next recommended command.


