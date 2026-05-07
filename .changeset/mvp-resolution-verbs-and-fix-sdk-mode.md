---
type: Changed
pr: 3178
---
**MVP umbrella structural cleanup + SDK roadmap mode-extraction fix** — three new query verbs centralize the MVP-mode resolution surfaces previously duplicated across workflows and prose-only references; one bug fix in the SDK roadmap port restores parity with `roadmap.cjs`.

- **`gsd-sdk query phase.mvp-mode <N> [--cli-flag] [--pick active]`** — single canonical precedence resolver (CLI flag → ROADMAP `**Mode:** mvp` → `workflow.mvp_mode` config → false). `plan-phase.md`, `execute-phase.md`, `verify-work.md`, `progress.md` now call the verb instead of inlining 4–8 lines of bash each. Returns `{active, source, roadmap_mode, config_mvp_mode, cli_flag_present}`.
- **`gsd-sdk query task.is-behavior-adding <plan-file> | --task-content <xml>`** — replaces the prose-only Behavior-Adding Task predicate from `references/execute-mvp-tdd.md`. Three checks (tdd="true" frontmatter + non-empty `<behavior>` block + at least one non-test source file in `<files>`). The gsd-executor agent now invokes the verb instead of re-inlining the checks. Returns `{is_behavior_adding, checks: {tdd_true, has_behavior_block, has_source_files}, reason}`.
- **`gsd-sdk query user-story.validate "<text>" | --story <text>`** — owns the canonical User Story regex `/^As a .+, I want to .+, so that .+\.$/` (was hardcoded in `verify-work.md` prose). Consumed by gsd-verifier (phase-goal guard) and `/gsd-mvp-phase` (interactive-prompt validation). Returns `{valid, slots: {role, capability, outcome}, errors[]}`.
- **Bug fix: SDK `roadmap.get-phase` now extracts `mode` from `**Mode:**`** — the SDK port at `sdk/src/query/roadmap.ts` had silently omitted the `mode` field that the CJS implementation already extracted (`get-shit-done/bin/lib/roadmap.cjs:120-123`). On the native dispatch path, `roadmap.get-phase --pick mode` returned `null` even when the phase had `**Mode:** mvp` set, causing MVP_MODE to silently fall through to the config/false branch in every consuming workflow. Restores parity; covered by regression test.

24 new vitest tests cover all three verbs + the regression. All existing MVP contract tests updated to assert the new verb shape (no behavior change to the user-facing workflows). Closes #3177.
