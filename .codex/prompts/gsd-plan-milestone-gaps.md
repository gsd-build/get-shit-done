---
description: Create phases to close all gaps identified by milestone audit
argument-hint: [none]
---

$ARGUMENTS

## Objective
Create phases to close all gaps identified by milestone audit

## Compatibility
- Use .codex/skills/get-shit-done-codex semantics.
- Treat upstream workflow as the source of truth.
- Replace user-specific paths with workspace-relative paths (.claude/..., .planning/...).
- Use one of these engine paths (prefer local, fallback global):
  node .claude/get-shit-done/bin/gsd-tools.js ...
  node ~/.claude/get-shit-done/bin/gsd-tools.js ...
- If `.js` is unavailable, use the same path with `.cjs`.
- Run engine commands through PowerShell.
- Do not set `node <path> ...` as one string variable and invoke `& <cmd_var>`; run direct `node <path> ...` or `& node <path> ...`.
- Parse JSON with ConvertFrom-Json; parse key/value output when workflow uses KEY=value raw mode.
- No jq / bash-only constructs.
- Accept natural-language command input; do not require an exact literal argument template.
- If a required argument is still missing after extraction, ask one concise clarification question.

## Subagent lifecycle (required)

- Translate each upstream `Task(...)` into `spawn_agent` -> `wait` -> `close_agent`.
- Spawn only when the upstream workflow defines an agent role.
- Use `.claude/agents/gsd-*.md` as role context for each spawned agent.
- Do not advance workflow steps until wait and close complete.

## Execution
1. No positional argument is required. Read flags from command text if present.
2. Run init:
node <gsd-tools-path> init milestone-op --raw

3. Load .claude/get-shit-done/workflows/plan-milestone-gaps.md and execute it step-by-step.
4. Translate each Task(...) in workflow into:
   - spawn_agent with the matching role file context from .claude/agents/.
   - Set `agent_type` to the matching GSD role (gsd-*).
   - wait for each spawned agent and apply returned output before moving forward.
5. Preserve all gates and routing from upstream workflow.
6. Preserve commit behavior using 
node <gsd-tools-path> commit "message" --files ....
7. If commit preflight fails (no git / no commit flag), proceed in read-only mode and report clearly.

## Completion output
- Summarize key artifacts created/updated.
- Next recommended command: use the next user-facing GSD command (`/prompts:gsd-...` for Codex + `/gsd:...` for Claude).
- Never recommend internal `node ... gsd-tools ...` commands to the user.
