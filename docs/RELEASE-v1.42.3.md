# v1.42.3 Release Notes

Hotfix release. Published to npm under the `latest` tag.

```bash
npx get-shit-done-cc@latest
```

---

## What's in this release

1.42.3 is a stability hotfix on top of 1.42.2. The headline is **Codex
CLI 0.130.0 install routability** — after `npx get-shit-done-cc@latest
--codex`, `$gsd-*` skills now resolve correctly under Codex 0.130.0 and
later, where the previous build left users with zero routable
entrypoints. The release also ships **runtime-aware slash formatting**
so emitted commands match the install's routing shape (Claude → `/gsd-*`,
Codex → `$gsd-*`) instead of the deprecated colon form, an **argv-based
subprocess** fix for `check.ship-ready` that closes a shell-injection
class through git refnames, the **`phase_status` field on
init.plan-phase** that gates `/gsd:plan-phase` on closed phases, plus
correctness fixes for archived-phase warnings, future-phase warnings,
canonical Codex hooks, and the SDK bridge load path.

### Fixed

- **Codex CLI 0.130.0 install now materializes routable skills** —
  `bin/install.js` writes `~/.codex/skills/gsd-<name>/SKILL.md` for every
  shipped command so `$gsd-*` skills resolve after install. Codex 0.130.0
  dropped the extra-skills-roots discovery the previous build relied on,
  leaving users with a successful-looking install and zero usable
  commands. Documented minimum Codex CLI version (0.130.0) inline in the
  Codex sections of `USER-GUIDE.md` and `CONFIGURATION.md`.
  ([#3562](https://github.com/gsd-build/get-shit-done/pull/3568),
  [#3582](https://github.com/gsd-build/get-shit-done/pull/3609))

- **Runtime-aware slash formatter for user-facing emissions** —
  `runtime-slash.cjs` produces `/gsd-<cmd>` for skills-based runtimes
  (Claude, Cursor, OpenCode, Kilo, etc.) and `$gsd-<cmd>` for Codex.
  The deprecated colon form `/gsd:<cmd>` is no longer emitted at
  runtime, so the recommendations from `init`, `phase`, `verify`,
  `milestone`, `validate-command-router`, `workstream`, `profile-output`,
  `drift`, `gsd2-import`, and `commands` now paste cleanly into the
  active runtime.
  ([#3584](https://github.com/gsd-build/get-shit-done/pull/3606))

- **Argv-based subprocess for `check.ship-ready`** — every git/gh probe
  in `sdk/src/query/check-ship-ready.ts` now uses `execFileSync` with an
  argv array instead of `execSync` with shell-interpolated strings.
  Closes a shell-injection class where a malicious branch name (e.g.
  `foo;touch INJ;bar`) interpolated into `git config --get
  branch.<name>.merge` triggered arbitrary code execution.
  ([#3587](https://github.com/gsd-build/get-shit-done/pull/3611))

- **`init.plan-phase` surfaces `phase_status`; `/gsd:plan-phase` gates
  on closed phases** — `init.plan-phase` payload now carries the
  authoritative phase status (`Pending` / `Planned` / `Executed` /
  `Complete`) from `determinePhaseStatus`. The plan-phase workflow
  short-circuits on `Complete` (with `--force` override), and
  `--reviews` against a closed phase hard-errors with no override.
  Prevents accidental re-planning over shipped code.
  ([#3569](https://github.com/gsd-build/get-shit-done/pull/3581))

- **Canonical `[features].hooks` for Codex configs, legacy alias
  recognized** — Codex config emission uses the canonical
  `features.hooks` key while still accepting the legacy `codex_hooks`
  shape on read. Fixes the install where the previous key drift left
  Codex unable to find managed hooks.
  ([#3566](https://github.com/gsd-build/get-shit-done/pull/3573))

- **SDK bridge loads via the public package export** — fixes a stale
  internal path that broke SDK dispatch after install on some package
  layouts.
  ([#3567](https://github.com/gsd-build/get-shit-done/pull/3574))

- **W006/W007 health warnings skip archived and future phases** —
  `/gsd:health` no longer flags phases that are intentionally
  unimplemented (future) or archived as missing-on-disk or
  missing-from-roadmap.
  ([#3559](https://github.com/gsd-build/get-shit-done/pull/3565),
  [#3560](https://github.com/gsd-build/get-shit-done/pull/3564))

- **Ultraplan runtime gates on Claude Code markers** — `/gsd:ultraplan`
  detects the runtime via Claude Code markers and fails closed when
  the version is unavailable, instead of running against an unknown
  runtime.
  ([#3561](https://github.com/gsd-build/get-shit-done/pull/3563))

- **Padded phase IDs match unpadded ROADMAP prose** — phase routing
  through `phaseMarkdownRegexSource` handles `02.7` ↔ `2.7` and
  similar padding mismatches so `/gsd:phase complete 02` updates a
  ROADMAP that uses the short `### Phase 2:` form.
  ([#3537](https://github.com/gsd-build/get-shit-done/pull/3538))

- **W007 ignores archived phase directories** — phases under
  `.planning/milestones/v*/` no longer trigger
  "exists on disk but not in roadmap" warnings against the active
  roadmap.
  ([#3560](https://github.com/gsd-build/get-shit-done/pull/3564))

- **Prompt-user migration actions resolve in non-TTY runs** —
  `installer-migration-authoring` flows complete cleanly under CI /
  non-interactive shells; error grouping clarified.
  ([#3541](https://github.com/gsd-build/get-shit-done/pull/3547))

- **Executor agents forbidden from `git stash`** — execution agents
  no longer use shared stash storage, which violated worktree
  isolation when multiple agents ran in parallel.
  ([#3542](https://github.com/gsd-build/get-shit-done/pull/3546))

- **Configuration manifests load from the installed payload** —
  `configuration.generated.cjs` looks in the installed
  `get-shit-done/bin/shared/` path first, then falls back to
  source-checkout `sdk/shared/`. Fixes the install where the manifest
  loader failed on the runtime layout because the source-tree path
  doesn't exist after install.
  ([#3571](https://github.com/gsd-build/get-shit-done/pull/3572))

---

## What was in 1.42.1

[`RELEASE-v1.42.1.md`](RELEASE-v1.42.1.md) — package legitimacy gate
against slopsquatting, skill-surface budgeting (`--profile=core` /
`standard` / `full`), installer migration framework, configurable
`/gsd-ship` PR body sections, `review.default_reviewers`, optional
fallow structural review, structured `--json-errors` CLI mode, plus
30+ correctness fixes across `project_code` phase prefixes, phase
completion idempotency, nested git detection, Codex install migration,
SDK install readiness, and decimal-phase dependencies.

---

## Installing

```bash
# npm (global)
npm install -g get-shit-done-cc@latest

# npx (one-shot)
npx get-shit-done-cc@latest

# Pin to this exact version
npm install -g get-shit-done-cc@1.42.3
```

The installer is idempotent — re-running on an existing install
updates in-place, preserving your `.planning/` directory and local
patches.

### Codex CLI requirement

Codex installs (`--codex`) require **Codex CLI 0.130.0 or later**.
Earlier Codex versions used a discovery mechanism that the current
install layout does not target; upgrade Codex first, then re-run the
GSD installer.
