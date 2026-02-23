---
description: Execute all plans in a phase with wave-based parallelization
argument-hint: "<phase-number> [--gaps-only]"
---

$ARGUMENTS

## Objective
Execute all plans in a phase with wave-based parallelization

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

## Input contract
- The command argument is authoritative.
- If user runs `gsd-execute-phase 28`, execute phase `28`. Do not auto-discover a different phase.
- Parse phase from either:
  - the explicit command argument tail, or
  - the latest user message (for example: "execute phase 28").
- Accept the first numeric token as phase number (integer or decimal, e.g., 30 or 30.1).
- Parse flags `--gaps-only` and `--auto` from the same input text when present.
- Do not claim "phase missing" when the latest user input already contains a valid phase token.
- Only ask for input if no valid phase token is found anywhere in the latest user request.

## Execution
1. Parse "<phase-number> [--gaps-only] [--auto]" from command argument text, or extract from the latest user message.
2. Treat parsed phase as the execution target and keep it unchanged for all downstream steps.
3. Run init with the parsed phase:
node <gsd-tools-path> init execute-phase <phase> --raw
4. If `--gaps-only` is present, apply gap-closure filtering exactly as defined in the upstream workflow.
5. If `--auto` is present, preserve auto-advance behavior from the upstream workflow.
6. Load .claude/get-shit-done/workflows/execute-phase.md and execute it step-by-step.
7. Translate each Task(...) in workflow into:
   - spawn_agent with the matching role file context from .claude/agents/.
   - Set `agent_type` to the matching GSD role (gsd-*).
   - wait for each spawned agent and apply returned output before moving forward.
8. Preserve all gates and routing from upstream workflow.
9. Preserve commit behavior using
node <gsd-tools-path> commit "message" --files ....
10. If commit preflight fails (no git / no commit flag), proceed in read-only mode and report clearly.

## Completion output
- Summarize key artifacts created/updated.
- Next recommended command: `/prompts:gsd-verify-work <phase>` (Codex) / `/gsd:verify-work <phase>` (Claude)
- Never recommend internal `node ... gsd-tools ...` commands to the user.
