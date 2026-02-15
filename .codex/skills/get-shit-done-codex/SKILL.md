---
name: get-shit-done-codex
description: Codex-compatible orchestration for get-shit-done workflows.
metadata:
  short-description: Translation layer from Claude GSD workflows to Codex
---

# Get-shit-done (GSD) Codex Skill

Use this skill to run `gsd-*` prompts under `Codex` while preserving upstream GSD behavior.

## Scope
- Keep `.claude/get-shit-done` as the command engine and workflow source.
- Keep `.claude/agents/gsd-*.md` as role contracts for subagents.
- Keep `.codex/prompts/gsd-*.md` as Codex-native orchestrators.

## Core rules
1. Do not change command semantics.
2. Do not change source workflow logic unless necessary for Codex command compatibility.
3. Use workspace-relative paths.
4. Preserve step ordering and gate behavior from workflow files.

## Mandatory codex translations
- Replace each `Task(...)` with: `spawn_agent` + `wait`.
- Replace Bash/JQ patterns with PowerShell and `ConvertFrom-Json`.
- Replace AskUserQuestion interactions with direct user prompts in chat.

## Subagent lifecycle (required)
- Spawn only when the upstream workflow explicitly defines a `Task(...)` role.
- For each spawned subagent:
  - Start with `spawn_agent` and provide the role source from `.claude/agents/gsd-*.md`.
  - Wait for completion before proceeding: `wait`.
  - Explicitly close the agent after it finishes (`close_agent`) to release resources.
- Keep prompt-level sequencing intact; do not continue to subsequent steps until waiting + closure are complete.
- If an agent fails or exceeds retry policy, stop that phase of workflow and surface a clear remediation step.

## Required GSD roles (must map by name)
- `gsd-project-researcher`
- `gsd-research-synthesizer`
- `gsd-roadmapper`
- `gsd-phase-researcher`
- `gsd-planner`
- `gsd-plan-checker`
- `gsd-executor`
- `gsd-verifier`
- `gsd-debugger`
- `gsd-integration-checker`
- `gsd-codebase-mapper`

## Standard execution order
1. Parse user input from `$ARGUMENTS`.
2. Run required `gsd-tools init ...` if the workflow defines it.
3. Read workflow path in `.claude/get-shit-done/workflows/`.
4. Execute step-by-step, translating subagent calls.
5. Preserve `commit_docs`, state updates, and file contracts.
6. Report outcome and next action.

## Commit discipline
- Validate git first: `git rev-parse --is-inside-work-tree`.
- Use `node .claude/get-shit-done/bin/gsd-tools.js commit ...` for all intended doc/execution writes.
- If commit is not possible, continue execution with explicit warning and no commit.

## Required references
- `.codex/skills/get-shit-done-codex/references/compat.md`
- `.codex/skills/get-shit-done-codex/references/windows.md`
