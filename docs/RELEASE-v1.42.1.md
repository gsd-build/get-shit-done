# v1.42.1 Release Notes

Stable release. Published to npm under the `latest` tag.

```bash
npx get-shit-done-cc@latest
```

---

## What's in this release

1.42.1 is a safety and control-surface release. The headline additions are the
**package legitimacy gate**, **skill-surface budgeting**, and the **installer migration
framework** — three changes that make GSD safer to install, safer to update, and easier
to run in constrained contexts. The release also ships configurable `/gsd-ship` PR body
sections, `/gsd-review` reviewer defaults, optional fallow structural review, and
quota-aware execution recovery. Underneath that, 30+ correctness fixes cover
`project_code` phase directories, phase completion, nested git detection, Codex
install migration, SDK readiness, and decimal-phase dependencies.

### Added

- **Package legitimacy gate against slopsquatting** — researchers audit external
  packages with `slopcheck`, planners add human verification for unverified packages,
  and executors stop on package install failures instead of trying similarly named
  alternatives. This closes the path where AI-hallucinated package names could flow
  from research into `npm install` / `pip install` / `cargo add`.
  ([#3215](https://github.com/gsd-build/get-shit-done/pull/3215))

- **Skill surface budgeting** — install with `--profile=core`, `--profile=standard`,
  or the default `full`; profiles persist in `.gsd-profile`. Use `/gsd:surface` to
  list, enable, disable, reset, or switch skill clusters without reinstalling.
  `--minimal` and `--core-only` remain aliases for `--profile=core`.
  ([#3408](https://github.com/gsd-build/get-shit-done/pull/3456))

- **Installer migration framework** — install now has explicit migration records,
  baseline scanning, legacy cleanup, user-owned artifact preservation, dry-run
  reporting, rollback protection, and ambiguous stale-file guardrails.
  ([#3398](https://github.com/gsd-build/get-shit-done/pull/3398),
  [#3399](https://github.com/gsd-build/get-shit-done/pull/3399),
  [#3400](https://github.com/gsd-build/get-shit-done/pull/3400),
  [#3402](https://github.com/gsd-build/get-shit-done/pull/3402),
  [#3404](https://github.com/gsd-build/get-shit-done/pull/3404))

- **Configurable `/gsd-ship` PR body sections** — `ship.pr_body_sections` appends
  project-specific PRD-style sections while preserving the required `Summary`,
  `Changes`, `Requirements Addressed`, `Verification`, and `Key Decisions` sections.
  ([#3391](https://github.com/gsd-build/get-shit-done/pull/3391))

- **`review.default_reviewers`** — no-flag `/gsd-review` can default to a configured
  reviewer subset. Explicit reviewer flags and `--all` still take precedence.
  ([#3464](https://github.com/gsd-build/get-shit-done/pull/3464))

- **Optional fallow structural review pre-pass** — `code_quality.fallow.*` runs a
  structural pass before `/gsd-code-review`, writes `FALLOW.json`, and embeds
  structural findings in `REVIEW.md`.
  ([#3424](https://github.com/gsd-build/get-shit-done/pull/3486))

- **Structured CLI error mode** — `gsd-tools --json-errors` returns machine-readable
  error envelopes for automation and SDK callers while preserving human-readable output
  by default.
  ([#3255](https://github.com/gsd-build/get-shit-done/pull/3304))

### Changed

- **Human verification defaults to end-of-phase** — `workflow.human_verify_mode:
  "end-of-phase"` keeps human checks in verification blocks instead of scattering
  mid-flight checkpoint tasks. Set `"mid-flight"` to restore the previous blocking
  checkpoint behavior.
  ([#3309](https://github.com/gsd-build/get-shit-done/pull/3325))

- **Quota and rate-limit failures get a distinct recovery path** — execute-phase
  classifies provider quota failures (`429`, `rate limit`, `usage limit`,
  `RESOURCE_EXHAUSTED`, etc.) and guides wait-and-resume instead of retry-now.
  ([#3095](https://github.com/gsd-build/get-shit-done/pull/3490))

- **Milestone tags can be disabled** — `git.create_tag: false` lets projects with
  external release automation complete milestones without creating local tags.
  Existing tag collisions now fail clearly instead of overwriting tags.
  ([#3086](https://github.com/gsd-build/get-shit-done/pull/3508))

- **Statusline context meter can move to the front** — `statusline.context_position:
  "front"` renders the context meter after the model name so it stays visible in narrow
  terminals.
  ([#2937](https://github.com/gsd-build/get-shit-done/pull/3515))

- **Reasoning effort is transported with resolved model IDs** — runtime-aware model
  resolution now carries `reasoning_effort` where supported, including Codex config
  output and SDK query paths.
  ([#3474](https://github.com/gsd-build/get-shit-done/pull/3483))

- **Shell command projection and SDK architecture seams deepened** — hook commands,
  path actions, subprocess execution, platform file I/O, SDK compatibility policy, and
  runtime skill policy now flow through narrower typed modules.
  ([#3238](https://github.com/gsd-build/get-shit-done/pull/3238),
  [#3316](https://github.com/gsd-build/get-shit-done/pull/3316),
  [#3470](https://github.com/gsd-build/get-shit-done/pull/3470),
  [#3476](https://github.com/gsd-build/get-shit-done/pull/3476),
  [#3481](https://github.com/gsd-build/get-shit-done/pull/3481),
  [#3484](https://github.com/gsd-build/get-shit-done/pull/3484))

### Fixed

- **`project_code` phase directory prefixes apply consistently** — first-touch
  `/gsd-discuss-phase`, `/gsd-plan-phase`, import, gap-planning, and backlog creation
  paths now create prefixed phase directories consistently.
  ([#3287](https://github.com/gsd-build/get-shit-done/pull/3292),
  [#3298](https://github.com/gsd-build/get-shit-done/pull/3306))

- **Phase completion is idempotent and refreshes state** — `state complete-phase` and
  `phase.complete` no longer leave stale `STATE.md` progress, focus, or body
  frontmatter fields behind.
  ([#3489](https://github.com/gsd-build/get-shit-done/pull/3499),
  [#3517](https://github.com/gsd-build/get-shit-done/pull/3520))

- **Nested git worktrees are detected** — `/gsd-new-project` and ingest flows avoid
  creating nested `.git` directories when run inside an existing repository or
  worktree.
  ([#3491](https://github.com/gsd-build/get-shit-done/pull/3502))

- **Codex install and hook migration are safer** — AoT hooks use event-name leaf keys,
  duplicate legacy `hooks.json` entries are removed, user hooks are preserved, and
  unsupported execute-phase worktrees are blocked.
  ([#3346](https://github.com/gsd-build/get-shit-done/pull/3505),
  [#3357](https://github.com/gsd-build/get-shit-done/pull/3380),
  [#3360](https://github.com/gsd-build/get-shit-done/pull/3380))

- **SDK install readiness is durable** — `--sdk` now forces SDK deployment, stale shims
  are detected, Windows PATH probing is hardened, and "GSD SDK ready" only prints when
  the shim is reachable.
  ([#3033](https://github.com/gsd-build/get-shit-done/issues/3033),
  [#3211](https://github.com/gsd-build/get-shit-done/pull/3282),
  [#3231](https://github.com/gsd-build/get-shit-done/pull/3249),
  [#3359](https://github.com/gsd-build/get-shit-done/pull/3380))

- **User custom skills are preserved during update detection** — `detect-custom-files`
  now scans `skills/`, preventing user-added skill files from being missed during
  patch preservation.
  ([#3317](https://github.com/gsd-build/get-shit-done/pull/3318))

- **Decimal-phase `depends_on` references resolve correctly** — SDK phase indexing now
  expands same-phase short forms such as `depends_on: [01]` and warns on unresolved
  references.
  ([#3488](https://github.com/gsd-build/get-shit-done/pull/3501))

- **`gsd-sdk query commit --files --respect-staged` preserves interactive staging** —
  respect-staged mode now avoids restaging pathspecs and commits only the already
  staged hunks within the requested file scope.
  ([#3522](https://github.com/gsd-build/get-shit-done/pull/3528))

---

## What was in 1.41.0

[`RELEASE-v1.41.0.md`](RELEASE-v1.41.0.md) — per-phase-type model selection,
dynamic routing with failure-tier escalation, the optional update banner,
issue-driven orchestration, MVP mode SDK query verbs, graphify commit-based
staleness, and 25+ correctness fixes across Homebrew node paths, milestone archives,
secure-phase audits, cross-runtime installs, and statusline parsing.

---

## Installing

```bash
# npm (global)
npm install -g get-shit-done-cc@latest

# npx (one-shot)
npx get-shit-done-cc@latest

# Pin to this exact version
npm install -g get-shit-done-cc@1.42.1
```

The installer is idempotent — re-running on an existing install updates in-place,
preserving your `.planning/` directory and local patches.
