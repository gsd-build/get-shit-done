# v1.39.0-rc.7 Release Notes

Pre-release candidate. Published to npm under the `next` tag.

```bash
npx get-shit-done-cc@next
```

---

## What's in this release

rc.7 is the first RC in the 1.39.0 train that rolls in the post-rc.5 fixes from
`main`. rc.6 was content-identical to rc.5 (`release/1.39.0` was bumped without
first being merged with `main` — see [#2856](https://github.com/gsd-build/get-shit-done/issues/2856)).
rc.7 syncs the release branch with `main` so all of the work below actually
reaches the registry.

### Added

- **Manual canary release workflow** — `.github/workflows/canary.yml` publishes
  `{base}-canary.{N}` builds of `get-shit-done-cc` under the `canary` dist-tag on
  demand via `workflow_dispatch` (manual trigger only). Optional `dry_run` boolean.
  ([#2828](https://github.com/gsd-build/get-shit-done/issues/2828))

### Fixed

- **`extractCurrentMilestone` no longer truncates ROADMAP.md at heading-like lines
  inside fenced code blocks** — the milestone-end search now scans line-by-line while
  tracking ` ``` ` / `~~~` fence state, so a line like `# Ops runbook (v1.0 compat)`
  inside a code block no longer acts as a milestone boundary.
  ([#2787](https://github.com/gsd-build/get-shit-done/issues/2787))
- **`audit-uat` parser reads `human_verification:` from frontmatter array** — the
  previous body-only regex was too strict and missed valid UAT items declared in
  YAML frontmatter, surfacing false-positive open gaps at every milestone-completion
  audit. ([#2788](https://github.com/gsd-build/get-shit-done/issues/2788))
- **Skill description anti-patterns trimmed; ≤ 100-char budget enforced** — three
  anti-patterns eliminated across `commands/gsd/*.md`: flag documentation already in
  `argument-hint:`, `Triggers:` keyword-stuffing lists, and numbered enumeration. New
  CI lint gate `npm run lint:descriptions` fails if any description exceeds 100
  chars. ([#2789](https://github.com/gsd-build/get-shit-done/issues/2789))
- **`gsd-sdk` binary collision with `@gsd-build/sdk` resolved** — workstream-aware
  query registry now respects the `GSD_WORKSTREAM` env var; `gsd-tools` bin alias
  added. ([#2791](https://github.com/gsd-build/get-shit-done/issues/2791))
- **`OpenCode` agents embed `model_profile_overrides.opencode.<tier>`** — per-tier
  model overrides set via `/gsd-settings-advanced` are now propagated into generated
  agent files. ([#2794](https://github.com/gsd-build/get-shit-done/issues/2794))
- **`roadmap update-plan-progress` accepts `--phase` flag form** — SDK arg-parsing
  regression in v0.1.0 silently dropped `--phase`/`--name`/`--plans` flags, causing
  STATE.md corruption. ([#2796](https://github.com/gsd-build/get-shit-done/issues/2796))
- **`context_window` added to `VALID_CONFIG_KEYS` allowlist** —
  `/gsd-settings-advanced` could not set `context_window` because the key was missing
  from the allowlist used by `config-set` validation.
  ([#2798](https://github.com/gsd-build/get-shit-done/issues/2798))
- **`gsd-tools init` dispatches `ingest-docs` handler** — `/gsd-ingest-docs` was
  broken in v1.38.5 because the workflow called the new tool but no `ingest-docs`
  init handler was registered. ([#2801](https://github.com/gsd-build/get-shit-done/issues/2801))
- **`config-get` honors `--default <value>` flag** — fallback for missing keys
  ported from CJS into the SDK. ([#2803](https://github.com/gsd-build/get-shit-done/issues/2803))
- **`find-phase` returns `null` for archived phases** — when the current-milestone
  phase had no directory yet, `init.plan-phase` / `init.execute-phase` returned the
  archived prior-milestone directory instead of `null`, causing wrong-phase work.
  ([#2805](https://github.com/gsd-build/get-shit-done/issues/2805))
- **SKILL.md frontmatter `name:` migrated to hyphen form** — files that still used
  the deprecated colon form (`gsd:cmd`) caused autocomplete to suggest `/gsd:command`.
  ([#2808](https://github.com/gsd-build/get-shit-done/issues/2808))
- **`gsd-sdk` resolvable in local-mode installs** — the previous `isLocal`
  short-circuit returned before the PATH probe + self-link could run. When
  `sdk/dist/cli.js` is present, local installs now run the same probe-and-link flow
  as global installs. ([#2829](https://github.com/gsd-build/get-shit-done/issues/2829))
- **OpenCode `@file` references use absolute paths on all platforms** — OpenCode
  does not shell-expand `$HOME` in `@file` references on any platform; the
  Windows-only guard from #2376 left macOS/Linux producing literal `@$HOME/...`
  strings. Guard now applies unconditionally for OpenCode.
  ([#2831](https://github.com/gsd-build/get-shit-done/issues/2831))
- **`gsd-sdk auto` detects Codex runtime correctly** — `auto` mode ignored
  `runtime: codex` and routed through `@anthropic-ai/claude-agent-sdk`, producing
  the `[FAILED] $0.00 0.1s` symptom on autonomous runs. New `runtime-gate` raises a
  clear error for non-Claude runtimes; `resolveModel()` honours `GSD_RUNTIME` env
  precedence and never injects a Claude profile id under non-Claude runtimes.
  ([#2832](https://github.com/gsd-build/get-shit-done/issues/2832))
- **CR-INTEGRATION tests aligned with hyphen-form skill names** — tests now parse
  `Skill(skill="...")` invocations structurally and reject the legacy colon form.
  ([#2835](https://github.com/gsd-build/get-shit-done/issues/2835))
- **`audit-open` quick-task scanner accepts `${quick_id}-SUMMARY.md`** — the
  bare-`SUMMARY.md` check produced false-positive `status: missing` for every
  documented quick task. UAT terminal-status enum also adds `resolved` (matches
  `execute-phase.md`'s post-gap-closure terminal).
  ([#2836](https://github.com/gsd-build/get-shit-done/issues/2836))
- **`quick.md` / `execute-phase.md` SUMMARY rescue handles gitignored `.planning/`** —
  rescue blocks used `git ls-files --exclude-standard`, silently no-op'ing when
  `.planning/` was excluded; the worktree was then deleted with the SUMMARY.
  Replaced with filesystem-level `find` + idempotent `cp`.
  ([#2838](https://github.com/gsd-build/get-shit-done/issues/2838))
- **`/gsd-code-review-fix` cleanup tail is transactional** — JSON recovery sentinel
  at `${phase_dir}/.review-fix-recovery-pending.json` is written after `git worktree
  add` succeeds and removed only after `git worktree remove` returns. New runs that
  find a pre-existing sentinel force-remove the orphan worktree, making the agent
  self-healing across crashes. ([#2839](https://github.com/gsd-build/get-shit-done/issues/2839))

---

## What was in rc.6

```bash
$ git log v1.39.0-rc.5..v1.39.0-rc.6 --pretty='%h %s'
388118d8 chore: bump to 1.39.0-rc.6
```

rc.6 was a republish of rc.5 with no new content — `release/1.39.0` was bumped
without first being merged with `main`. See
[`RELEASE-v1.39.0-rc.6.md`](RELEASE-v1.39.0-rc.6.md) for the full context.

---

## What was in rc.5

### Fixed

**Codex hooks migrator correctness hardening** ([#2809](https://github.com/gsd-build/get-shit-done/issues/2809))

Five edge-cases in the `[[hooks.<Event>]]` → `[[hooks.<Event>.hooks]]` two-level
nested schema migration path, discovered across five rounds of code review:

| Finding | Fix |
|---------|-----|
| `parseHooksBody` used a bare regex (`/^([\w.]+)\s*=/`) that silently dropped hyphenated keys such as `status-message` and any quoted TOML key | Replaced with `parseTomlKey()`, the existing full TOML key parser |
| `buildNestedBlock` unconditionally emitted `[[hooks.TYPE.hooks]]` even when no handler fields were present, producing an entry with `type = "command"` but no `command` | Added guard: matcher-only / handler-field-free sections emit only the event-entry block |
| `legacyMapSections` filter used `section.path.startsWith('hooks.')` without checking the segment count, so three-segment tables like `[hooks.SessionStart.hooks]` were misclassified as event entries and re-emitted as bogus nested events | Now uses `section.segments.length === 2` (same fix previously applied to `staleNamespacedAotSections`) |
| No regression test for quoted event names containing dots — `[[hooks."before.tool"]]` has a 2-segment path but 3 dot-parts, and a `split('.')` check would misclassify it | Regression test added; quoted-dot names are correctly treated as a single two-segment namespace |
| Handler command path assertion in install tests used a regex (`/gsd-check-update\.js/`) rather than the exact absolute path | Strengthened to `assert.strictEqual` with `path.join(codexHome, 'hooks', 'gsd-check-update.js')` |

---

## What was in rc.4

### Added

**`--minimal` install flag** (alias `--core-only`) ([#2762](https://github.com/gsd-build/get-shit-done/issues/2762))

Writes only the six core skills needed to run the main workflow loop:
`new-project`, `discuss-phase`, `plan-phase`, `execute-phase`, `help`, `update`.
No `gsd-*` subagents are installed.

| Mode | Cold-start system-prompt overhead |
|------|-----------------------------------|
| full (default) | ~12k tokens |
| minimal | ~700 tokens |

The install manifest records `mode: "minimal" | "full"`. Run `gsd update` without
`--minimal` at any time to expand to the full skill set.

### Fixed (rc.4)

**Codex install no longer corrupts `~/.codex/config.toml`** ([#2760](https://github.com/gsd-build/get-shit-done/issues/2760))

The installer now strips legacy `[agents]` blocks, emits hooks in the user's
existing shape, migrates legacy `[hooks.<Event>]` map format to `[[hooks.<Event>]]`,
writes atomically via temp-file + `renameSync`, and validates post-write bytes
with a strict TOML parser.

---

## Installing the pre-release

```bash
# npm
npm install -g get-shit-done-cc@next

# npx (one-shot)
npx get-shit-done-cc@next
```

To pin to this exact RC:

```bash
npm install -g get-shit-done-cc@1.39.0-rc.7
```

---

## What's next

- Run `finalize` on the release workflow to promote `1.39.0` to `latest` once
  rc.7 has soaked.
