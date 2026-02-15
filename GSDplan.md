# Plan: Port get-shit-done (GSD) to Codex (Windows-first)

## Scope and Command Policy

- Port GSD command orchestrators from `\.claude/commands/gsd/*.md` into `.codex/prompts/gsd-*.md`.
- Exclude two commands per request:
  - `join-discord` (static invitation link)
  - `reapply-patches` (local patch-recovery utility)
- Keep `.claude/get-shit-done/...` as unchanged source of truth.
- Preserve the same user outcomes and file contracts for the remaining commands.

## Summary

Create a Codex-native command surface in `.codex/prompts` and a translation skill in `.codex/skills` so Codex can execute GSD workflows with:

- PowerShell-safe command execution
- JSON parsing via `ConvertFrom-Json`
- `spawn_agent` + `wait` replacement for `Task(...)`
- Path normalization from hardcoded user-specific Windows paths to workspace-relative paths
- Existing gsd-tools command flow, especially `commit`, `verify`, and workflow `init` operations

## Success Criteria

- New prompts exist for each active GSD command in this repo except the two skipped commands.
- Running prompts drives the same artifacts as upstream workflows:
  - `.planning/PROJECT.md`
  - `.planning/REQUIREMENTS.md`
  - `.planning/ROADMAP.md`
  - `.planning/STATE.md`
  - Phase planning: `.planning/phases/<phase>/...-PLAN.md`
  - Execution and verification: `*-SUMMARY.md`, `*-VERIFICATION.md`, `*-UAT.md`
- Commits and session behavior are preserved where upstream uses `node .claude/get-shit-done/bin/gsd-tools.js commit ...`.
- Codex prompts explicitly map all task spawning to codex-compatible role files and subagent contracts.
- Clear handling when Git is unavailable or unconfigured.

## Commands to Port (V1, full parity)

- `add-phase`
- `add-todo`
- `audit-milestone`
- `check-todos`
- `complete-milestone`
- `debug`
- `discuss-phase`
- `execute-phase`
- `help`
- `insert-phase`
- `list-phase-assumptions`
- `map-codebase`
- `new-milestone`
- `new-project`
- `pause-work`
- `plan-milestone-gaps`
- `plan-phase`
- `progress`
- `quick`
- `remove-phase`
- `research-phase`
- `resume-work`
- `set-profile`
- `settings`
- `update`
- `verify-work`

## Files to add

### Skill Layer

- `.codex/skills/get-shit-done-codex/SKILL.md`
- `.codex/skills/get-shit-done-codex/references/compat.md`
- `.codex/skills/get-shit-done-codex/references/windows.md`

### Prompts

- `.codex/prompts/gsd-*.md` for each command above.

## Mapping Rules (apply to every prompt)

- Replace hardcoded:
  - `C:/Users/Ahmed/.claude/get-shit-done/` -> `.claude/get-shit-done/`
  - `C:/Users/Ahmed/.claude/agents/` -> `.claude/agents/`
- Prefer root-relative command invocation from repo root:
  - `node .claude/get-shit-done/bin/gsd-tools.js ...`
- Replace `jq` usage with PowerShell parsing:
  - `ConvertFrom-Json` for JSON responses
  - string extraction for line-based output
- Keep workflow sequencing and gate order unchanged.
- Keep user-facing confirmations and routing steps as gates.

## Subagent Mapping Contract

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

Each Codex prompt must translate each `Task(...)`/agent handoff into:

1. `spawn_agent(...)` with `agent_type` and role prompt context
2. `functions.wait(...)` with agent id for completion
3. Parse and route the returned result before continuing

## Phased Implementation

### Phase 1 — Prompt and Skill skeleton

1. Add `.codex/skills/get-shit-done-codex/SKILL.md` with clear orchestration rules and mandatory defaults.
2. Add compatibility matrix files:
   - `.codex/skills/get-shit-done-codex/references/compat.md`
   - `.codex/skills/get-shit-done-codex/references/windows.md`
3. Include path translation, raw/JSON conventions, and commit gating in these references.

### Phase 2 — Prompt generation and coverage

1. Add `gsd-*.md` prompts for each non-skipped command.
2. For each prompt:
   - Include argument contract from upstream command frontmatter.
   - State canonical workflow reference under `.claude/get-shit-done/workflows/<command>.md`.
   - Provide explicit PowerShell-safe execution block.
   - Include subagent spawn/continuation contract.
   - Include failure behavior and fallback messaging.

### Phase 3 — Command-specific contracts

- `debug`, `research-phase`, `new-project`, `new-milestone`, `plan-phase`, `execute-phase`, `verify-work`
  - include full orchestration and loop/routing behavior (agent outputs, checkpoint handling, reroute logic).
- `map-codebase`, `help`, `progress`, `pause-work`, `resume-work`
  - preserve interactive branching/routing behavior.
- `complete-milestone`, `audit-milestone`, `plan-milestone-gaps`
  - preserve preflight gates and completion conditions.

## Completion Gate (manual acceptance)

- `node .claude/get-shit-done/bin/gsd-tools.js validate consistency`
- `gsd-new-project` produces all initial planning artifacts.
- `gsd-plan-phase <phase>` creates `...-PLAN.md` with required frontmatter.
- `gsd-execute-phase <phase>` produces `*-SUMMARY.md` and advances state.
- Commit + continuity checks continue to use `gsd-tools commit`.
