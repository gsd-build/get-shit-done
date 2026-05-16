# Codex Runtime Corrections PR Notes

## Goal

Make GSD's Codex adapter reflect current Codex desktop capabilities:

- `AskUserQuestion` should map to Codex `request_user_input` when available.
- Multiple GSD questions should be batched into one `request_user_input` call via top-level `questions[]`.
- `workflow.text_mode` should be a deliberate fallback, not the default assumption for Codex.
- `Agent(isolation="worktree")` should map to Codex-managed subagent workspace isolation instead of failing closed solely because `runtime=codex`.

## Current Patch

- Updates `bin/install.js` so generated Codex skill adapters document:
  - `request_user_input({ questions: [...] })`
  - required question and option fields
  - fallback behavior only when the tool is unavailable or rejected
  - Codex-managed subagent workspace handling for worktree isolation
- Updates `get-shit-done/workflows/execute-phase.md` so Codex no longer exits before executor dispatch when `workflow.use_worktrees=true`.
- Updates workflow text-mode guidance so Codex uses `request_user_input` first.
- Updates tests that previously locked in the old fail-closed Codex behavior.

## Validation Targets

Run focused checks:

```bash
node --test \
  tests/bug-3360-codex-execute-phase-worktrees.test.cjs \
  tests/codex-config.test.cjs \
  tests/bug-3018-codex-discuss-fallback.test.cjs
```

Run broader checks before making the PR ready:

```bash
npm test
```

## Follow-Up Questions For A Comprehensive PR

- Should the old issue label remain `#3360`, or should the PR describe this as a capability update after Codex desktop added managed subagent workspaces?
- Should localized configuration docs get the same `workflow.text_mode` wording updates as `docs/CONFIGURATION.md`?
- Should `docs/COMMANDS.md` and `docs/USER-GUIDE.md` replace older "non-Claude runtimes" `--text` language with runtime-specific guidance?
- Should worktree-mode executor artifact checks mention Codex-managed workspaces separately from Claude's `worktree-agent-*` branch convention?
