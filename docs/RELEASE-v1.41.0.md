# v1.41.0 Release Notes

Stable release. Published to npm under the `latest` tag.

```bash
npx get-shit-done-cc@latest
```

---

## What's in this release

1.41.0 is a quality and infrastructure release. The headline additions are **per-phase-type model selection** and **dynamic routing** — two new config blocks that give you granular cost control without learning the agent taxonomy. The release also ships the **MVP mode SDK resolution layer** (three canonical query verbs replacing per-workflow bash duplication), the **optional update banner** for non-statusline users, and the **issue-driven orchestration guide**. Underneath that, 25+ correctness fixes cover Homebrew node path stability, planner directive fidelity, secure-phase retroactive audit, cross-runtime installs, and statusline parsing.

### Added

- **Per-phase-type model selection (`models` block)** — express "Opus for planning,
  Sonnet for the rest" in two config lines without learning the agent taxonomy. Six
  named slots (`planning` / `discuss` / `research` / `execution` / `verification` /
  `completion`) accept tier aliases (`opus` / `sonnet` / `haiku` / `inherit`). Fully
  backward compatible.
  ([#3023](https://github.com/gsd-build/get-shit-done/pull/3030))

- **Dynamic routing with failure-tier escalation (`dynamic_routing` block)** — start
  cheap, escalate only when the orchestrator detects a soft failure (inconclusive
  verification, plan-check FLAG). Disabled by default; composes with `model_overrides`
  and `models.<phase_type>` via the same precedence chain.
  ([#3024](https://github.com/gsd-build/get-shit-done/pull/3031))

- **Optional update banner for non-GSD statusline users** — when the installer detects
  no GSD statusline, it offers an opt-in `SessionStart` hook that surfaces update
  availability via the existing `~/.cache/gsd/gsd-update-check.json` cache. Silent when
  up-to-date; removed cleanly by `--uninstall`.
  ([#2795](https://github.com/gsd-build/get-shit-done/pull/2795))

- **Issue-driven orchestration guide** — new
  [`docs/issue-driven-orchestration.md`](issue-driven-orchestration.md) recipe that maps
  tracker issues (GitHub / Linear / Jira) onto existing GSD primitives: workspace →
  discuss → plan → execute → verify → review → ship.
  ([#2840](https://github.com/gsd-build/get-shit-done/pull/2840))

### Changed

- **MVP mode SDK resolution layer — three canonical query verbs** — three new verbs
  centralize the MVP-mode predicates previously duplicated across workflows:
  `gsd-sdk query phase.mvp-mode <N>` (precedence resolver), `task.is-behavior-adding`
  (Behavior-Adding Task predicate), and `user-story.validate` (User Story regex). All
  consuming workflows now call the verb instead of inlining 4–8 bash lines each. Also
  fixes a silent SDK bug where `roadmap.get-phase --pick mode` returned `null` for
  phases with `**Mode:** mvp` set.
  ([#3178](https://github.com/gsd-build/get-shit-done/pull/3178))

- **`/gsd-graphify status` surfaces commit-based staleness** — reads `built_at_commit`
  from graphify v0.7+ graphs, compares against `git HEAD`, and adds four new fields
  (`built_at_commit`, `current_commit`, `commits_behind`, `commit_stale`). Pre-v0.7
  graphs return `commit_stale: null` and fall back to the existing mtime-based signal.
  ([#3170](https://github.com/gsd-build/get-shit-done/issues/3170))

- **MVP concept index and domain glossary** — seven MVP-related terms added to
  `CONTEXT.md`; new `references/mvp-concepts.md` indexes the six MVP reference files.
  No behavior change.
  ([#3176](https://github.com/gsd-build/get-shit-done/pull/3176))

### Fixed

- **Stable node path on Homebrew** — `resolveNodeRunner()` now maps versioned Cellar
  paths to the stable Homebrew symlinks. Prevents `dyld: Library not loaded` errors
  after `brew upgrade node`.
  ([#3181](https://github.com/gsd-build/get-shit-done/issues/3181))

- **Milestone-archive layout support** — `validate consistency`, `validate health`, and
  `find-phase` now scan `.planning/milestones/v*-phases/` in addition to the flat
  `.planning/phases/` layout, eliminating spurious W006 warnings.
  ([#3164](https://github.com/gsd-build/get-shit-done/issues/3164))

- **`/gsd-graphify build` runs inline instead of spawning a sub-agent** — the
  post-extraction clustering phase was SIGTERM'd when the sub-agent exited, leaving no
  `graph.json` / `graph.html` / `GRAPH_REPORT.md` artifacts.
  ([#3166](https://github.com/gsd-build/get-shit-done/issues/3166))

- **Planner directive language restored** — 10 `CRITICAL`/`MANDATORY`/`MUST` emphasis
  markers were silently removed from `gsd-planner.md` in v1.38.4, weakening planner
  adherence to user decisions and requirement coverage. All restored.
  ([#3138](https://github.com/gsd-build/get-shit-done/issues/3087))

- **`secure-phase` retroactive-STRIDE mode for legacy phases** — phases with no
  `<threat_model>` blocks no longer rubber-stamp a clean `SECURITY.md`; the auditor
  now builds a register from implementation files before verifying mitigations.
  ([#3142](https://github.com/gsd-build/get-shit-done/issues/3120))

- **Global skills resolution now uses the correct runtime home directory** —
  `buildAgentSkillsBlock()` hardcoded `~/.claude/skills` for all runtimes. The new
  `runtime-homes.cjs` module maps all 15 supported runtimes to their canonical skills
  directory.
  ([#3126](https://github.com/gsd-build/get-shit-done/issues/3126))

- **`state.begin-phase` is now idempotent** — wave-resume calls no longer overwrite
  `Current Plan`, `stopped_at`, or `Last Activity Description` with stale values from
  the last `plan-phase` run.
  ([#3127](https://github.com/gsd-build/get-shit-done/issues/3127))

- **`gsd-validate-commit.sh` hook catches all git commit forms** — the previous bash
  regex missed `git -C /path commit`, `GIT_AUTHOR_NAME=x git commit`, and
  `/usr/bin/git commit`. New `hooks/lib/git-cmd.js` token-walk classifier handles all
  forms correctly.
  ([#3141](https://github.com/gsd-build/get-shit-done/issues/3129))

- **`/gsd-plan-phase` no longer auto-dispatches to a subagent on OpenCode** — the
  `agent: gsd-planner` frontmatter directive caused OpenCode to run the orchestrator in
  a context where the `Agent` tool is unavailable. Directive removed.
  ([#3156](https://github.com/gsd-build/get-shit-done/issues/3156))

- **`/gsd-quick` worktree-merge resurrection guard** — the inverted `PRE_MERGE_FILES`
  grep that deleted freshly-created files (including `SUMMARY.md`) is replaced with the
  git-history check used by `execute-phase.md`.
  ([#3195](https://github.com/gsd-build/get-shit-done/issues/3195))

- **`gsd-health` no longer raises W019 for `RETROSPECTIVE.md`** — registered in
  `CANONICAL_EXACT` in `artifacts.cjs` to match its established status as a milestone
  completion artifact.
  ([#3200](https://github.com/gsd-build/get-shit-done/issues/3198))

- **`--sdk` flag now wired into SDK deployment** — `hasSdk` was parsed but never
  passed to `installSdkIfNeeded`, so `--sdk` silently skipped deployment.
  ([#3033](https://github.com/gsd-build/get-shit-done/issues/3033))

- **Installer shell-path probe for SDK shim** — no longer prints "✓ GSD SDK ready"
  when the shim is unreachable from the user's interactive shells; probes
  `$SHELL -lc 'printf %s "$PATH"'` instead of the installer subprocess PATH.
  ([#3028](https://github.com/gsd-build/get-shit-done/issues/3020))

- **Windows update-check no longer silently fails** — passes `shell: true` on Windows
  so `npm.cmd` resolves via PATHEXT; without this the statusline "⬆ /gsd-update"
  indicator never rendered on Windows.
  ([#3102](https://github.com/gsd-build/get-shit-done/issues/3103))

- **Community `.sh` hooks use `#!/usr/bin/env bash`** — the previous `#!/bin/bash`
  shebang fails on NixOS, minimal Alpine images, and some container runtimes.
  ([#3194](https://github.com/gsd-build/get-shit-done/issues/3194))

- **Gemini local install no longer duplicates `/gsd:*` commands** — when GSD is
  already installed at user scope, a subsequent `--gemini --local` install skips the
  workspace scope. Previously both scopes received all 65 command files and Gemini's
  conflict detector renamed everything.
  ([#3037](https://github.com/gsd-build/get-shit-done/issues/3037))

- **Workstream resolution in `init.milestone-op` and `roadmap.analyze`** — both
  handlers now respect `--ws`, `GSD_WORKSTREAM`, and `.planning/active-workstream`.
  Workstream-scoped repos no longer exit with "Nothing left to do" from reading the
  root `.planning/` directory.
  ([#3196](https://github.com/gsd-build/get-shit-done/issues/3196),
  [#3207](https://github.com/gsd-build/get-shit-done/pull/3207))

- **`gsd-tools config-set workflow._auto_chain_active` no longer rejected** — the key
  was added to the SDK schema but not mirrored to `config-schema.cjs`; users routed
  through `gsd-tools` saw "Unknown config key."
  ([#3197](https://github.com/gsd-build/get-shit-done/issues/3197))

- **Statusline state rendering is type-robust and YAML-list compatible** — milestone
  completion renders for numeric and string `percent` values; `next_phases` parses both
  flow-array and block-list YAML.
  ([#3153](https://github.com/gsd-build/get-shit-done/issues/3153))

- **Codex SessionStart hook uses absolute Node binary path** — bare `node` in
  `config.toml` failed with exit 127 under GUI/minimal-PATH runtimes.
  ([#3022](https://github.com/gsd-build/get-shit-done/issues/3017))

- **`config-set resolve_model_ids` and `workflow._auto_chain_active` accepted** — both
  keys were documented or written by internal workflows but missing from the allowlists.
  ([#3162](https://github.com/gsd-build/get-shit-done/issues/3162))

---

## What was in 1.40.0

[`RELEASE-v1.40.0-rc.1.md`](RELEASE-v1.40.0-rc.1.md) — skill-surface consolidation
(86 → 59, [#2790](https://github.com/gsd-build/get-shit-done/issues/2790)), six
namespace meta-skills ([#2792](https://github.com/gsd-build/get-shit-done/issues/2792)),
`/gsd-health --context` utilization guard, phase-lifecycle status-line read-side
([#2833](https://github.com/gsd-build/get-shit-done/issues/2833)), and Gemini
colon-form slash-command conversion.

---

## Installing

```bash
# npm (global)
npm install -g get-shit-done-cc@latest

# npx (one-shot)
npx get-shit-done-cc@latest

# Pin to this exact version
npm install -g get-shit-done-cc@1.41.0
```

The installer is idempotent — re-running on an existing install updates in-place,
preserving your `.planning/` directory and local patches.
