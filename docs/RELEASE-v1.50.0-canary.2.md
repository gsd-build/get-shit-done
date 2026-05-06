# v1.50.0-canary.2 Release Notes

Second canary cut for the **1.50.0** train. Published to npm under the `canary` dist-tag.

```bash
npx get-shit-done-cc@canary
# or pin exact:
npm install -g get-shit-done-cc@1.50.0-canary.2
```

> **Canary stream caveat.** Canary builds come from the long-lived `dev` integration branch and may carry rough edges that the `next` (RC) and `latest` (stable) channels never see. Use canary when you want to exercise in-flight features early and report findings; do NOT pin production projects to it. See [CANARY.md](CANARY.md) for the stream policy and rollback path.

---

## Headline: MVP umbrella stabilization + first user-facing docs

`canary.1` shipped the [Vertical MVP planning track](RELEASE-v1.50.0-canary.1.md) (umbrella PRD [#2826](https://github.com/gsd-build/get-shit-done/issues/2826)) — five phases of new code spanning planner, executor, verifier, and discovery surfaces. `canary.2` is the *stabilization* cut: bug fix for a silent SDK parity gap that was breaking the most common MVP activation path, three centralized query verbs that collapse architectural duplication, and the first end-to-end user-facing docs for the feature.

### What's new since canary.1

#### Bug fix: SDK roadmap mode-extraction parity gap ([#3178](https://github.com/gsd-build/get-shit-done/pull/3178))

The SDK port of `roadmap.get-phase` silently omitted the `mode` field that the CJS implementation already extracted (`get-shit-done/bin/lib/roadmap.cjs:120-123`). On the native dispatch path, `gsd-sdk query roadmap.get-phase 1 --pick mode` returned `null` even when ROADMAP.md had `**Mode:** mvp` set — causing `MVP_MODE` to silently fall through to the config/false branch in every consuming workflow.

In other words: the canonical authoring path established by `/gsd-mvp-phase` (write `**Mode:** mvp` to ROADMAP) did not actually activate MVP mode through the SDK. The feature only worked when users passed `--mvp` on the CLI or set `workflow.mvp_mode` in config.

Fix in `sdk/src/query/roadmap.ts`: `searchPhaseInContent` now extracts the `mode` field, restoring CJS parity. Covered by regression tests; consumers of the unchanged response shape are unaffected (additive field).

#### Three centralized MVP query verbs ([#3178](https://github.com/gsd-build/get-shit-done/pull/3178))

The architecture review against the MVP umbrella surfaced three duplications. New verbs collapse them into single canonical seams. Full reference: [docs/CLI-TOOLS.md → MVP Commands](CLI-TOOLS.md#mvp-commands).

- **`gsd-sdk query phase.mvp-mode <N> [--cli-flag]`** — single canonical precedence resolver (CLI flag → ROADMAP `**Mode:** mvp` → `workflow.mvp_mode` config → false). Replaces 4–8 lines of nearly-identical bash that was duplicated across `plan-phase.md`, `execute-phase.md`, `verify-work.md`, and `progress.md`. Returns `{active, source, roadmap_mode, config_mvp_mode, cli_flag_present}` so callers can both decide *and* diagnose.
- **`gsd-sdk query task.is-behavior-adding <plan-file> | --task-content <xml>`** — Behavior-Adding Task predicate (tdd="true" + `<behavior>` block + non-test source files in `<files>`). Replaces the prose-only specification in `references/execute-mvp-tdd.md`; the gsd-executor agent now invokes the verb instead of re-inlining the three checks at runtime.
- **`gsd-sdk query user-story.validate "<text>"`** — owns the canonical User Story regex `/^As a .+, I want to .+, so that .+\.$/`. Consumed by gsd-verifier (phase-goal guard) and `/gsd-mvp-phase` (interactive-prompt validation) — single source of truth, so the validator users see during interactive prompting matches what the verifier applies later.

#### CONTEXT.md gains seven MVP domain terms ([#3176](https://github.com/gsd-build/get-shit-done/pull/3176))

`CONTEXT.md` previously had eleven SDK/dispatch domain modules and zero MVP terms despite the umbrella having shipped in canary.1. Now adds canonical definitions for: **MVP Mode**, **User Story**, **Walking Skeleton**, **Vertical Slice**, **Behavior-Adding Task**, **MVP+TDD Gate**, **SPIDR Splitting**.

New file [`get-shit-done/references/mvp-concepts.md`](../get-shit-done/references/mvp-concepts.md) indexes the six MVP reference files (planner-mvp-mode, skeleton-template, user-story-template, spidr-splitting, execute-mvp-tdd, verify-mvp-mode) with file map + concept-to-file map + interaction notes (how `--mvp` and `--prd` compose on Phase 1).

#### First user-facing MVP docs (this PR)

The canary.1 release shipped the feature with no entries in `USER-GUIDE.md`, `COMMANDS.md`, or `CLI-TOOLS.md`. canary.2 closes that gap so users testing the canary can actually find their way around:

- **[USER-GUIDE.md → MVP Mode](USER-GUIDE.md#mvp-mode)** — when to pick MVP, how the loop differs from standard mode (5-row diff table), worked walkthrough using the same webhook-validator example as the standard walkthrough, "how to confirm MVP mode is actually on" recipe, configuration knobs, links to all reference docs.
- **[COMMANDS.md → /gsd-mvp-phase](COMMANDS.md#gsd-mvp-phase)** — full command entry: arguments table, flags table (`--force`), four-step behavior breakdown, prerequisites, what it produces, examples.
- **[COMMANDS.md → /gsd-plan-phase](COMMANDS.md#gsd-plan-phase)** — `--mvp` flag row added to the existing flags table; example added to the examples block.
- **[COMMANDS.md → /gsd-new-project](COMMANDS.md#gsd-new-project)** — Vertical MVP / Horizontal Layers mode prompt documented inline.
- **[CLI-TOOLS.md → MVP Commands](CLI-TOOLS.md#mvp-commands)** — full reference for the three new query verbs (input forms, return shapes, per-field tables).

---

## How to test the headline features

If you're trialing canary.2 and want to exercise the MVP path end-to-end, the recommended sequence:

```bash
# 1. Install canary
npx get-shit-done-cc@canary

# 2. Bootstrap a fresh project — pick "Vertical MVP" at the mode prompt
/gsd-new-project

# 3. Frame Phase 1 as a user story
/gsd-mvp-phase 1

# 4. Confirm MVP mode is actually active
gsd-sdk query phase.mvp-mode 1
# expect: {"active": true, "source": "roadmap", ...}

# 5. Plan, execute, verify — the planner now sees MVP mode automatically
/gsd-plan-phase 1
/gsd-execute-phase 1
/gsd-verify-work 1
```

Walkthrough with expected output and what gets created at each step: **[USER-GUIDE.md → MVP Mode → MVP walkthrough (the diff vs. standard)](USER-GUIDE.md#mvp-walkthrough-the-diff-vs-standard)**.

---

## Bonus: dev synced with main

The merge that prepared this canary brought in **50 main-stream commits** that had accumulated since canary.1 — including the recent SDK runtime bridge work, graphify staleness improvements, hotfix release flow, and the prerelease-editions install guidance. See `git log v1.50.0-canary.1..v1.50.0-canary.2 --first-parent` for the full integration list.

---

## Install / upgrade

```bash
# Try the canary
npx get-shit-done-cc@canary

# Or pin exact
npm install -g get-shit-done-cc@1.50.0-canary.2
```

The installer's defensive purge will rewrite stale config blocks left by older GSD versions on first run. No manual cleanup needed.

## Reporting issues

If something breaks on canary, file against [the issue tracker](https://github.com/gsd-build/get-shit-done/issues) with the `bug` template and mention `1.50.0-canary.2` so it gets routed back into the dev stream rather than the stable stream.

For MVP-mode-specific issues, please include the output of `gsd-sdk query phase.mvp-mode <N>` for the affected phase — the `source` field tells maintainers which signal in the precedence chain decided, which speeds triage.

## What ships next in this train

Pending dev-stream items that should land before promotion to `next`:
- Implement the documented `--force-mvp-gate` escape hatch in the executor's argument parser (referenced in the user-facing error message but parser support is canary-bake from canary.1).
- Tighten the few remaining workflow variables in the MVP+TDD gate snippet (`${PLAN_ID}`, `${TASK_TDD}` wiring — also canary-bake from canary.1).
- Ride a few canary cycles for real-user MVP/TDD/UAT feedback now that the docs surface exists.

When the dev stream stabilizes, the train promotes to `main` as `v1.50.0-rc.1` (the `next` channel).
