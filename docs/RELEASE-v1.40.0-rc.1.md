# v1.40.0-rc.1 Release Notes

Pre-release candidate. Published to npm under the `next` tag.

```bash
npx get-shit-done-cc@next
```

---

## What's in this release

rc.1 opens the 1.40.0 train. The headline change is the **skill-surface
consolidation** ([#2790](https://github.com/gsd-build/get-shit-done/issues/2790))
and the new **two-stage hierarchical namespace routing** that sits on top of it
([#2792](https://github.com/gsd-build/get-shit-done/issues/2792)) — together
they drop the cold-start system-prompt overhead from ~2,150 tokens (86 flat skills)
to ~120 tokens (6 namespace routers). The release also adds the read-side of the
phase-lifecycle status-line, hardens multi-runtime installs, and clears a backlog of
correctness fixes for Gemini, Copilot, Codex, and the canary publish workflow.

### Added

- **Six namespace meta-skills with keyword-tag descriptions** — replace the flat
  86-skill listing with a two-stage hierarchical routing layer. The model sees 6
  namespace routers (`gsd:workflow`, `gsd:project`, `gsd:review`, `gsd:context`,
  `gsd:manage`, `gsd:ideate`) instead of 86 entries; selects a namespace, then routes
  to the sub-skill. Existing sub-skills are unchanged and still invocable directly.
  ([#2792](https://github.com/gsd-build/get-shit-done/issues/2792))

- **`/gsd-health --context` utilization guard** — context-window quality guard with
  two thresholds: 60 % warns ("consider `/gsd-thread`"), 70 % is critical ("reasoning
  quality may degrade"). Also exposed as `gsd-tools validate context`.
  ([#2792](https://github.com/gsd-build/get-shit-done/issues/2792))

- **Phase-lifecycle status-line — read-side** — `parseStateMd()` now reads four new
  STATE.md frontmatter fields: `active_phase`, `next_action`, `next_phases`, and
  `progress`. `formatGsdState()` gains scenes for in-flight, idle, and progress
  display. Write-side wiring follows in a later RC.
  ([#2833](https://github.com/gsd-build/get-shit-done/issues/2833))

- **`--minimal` install flag** (alias `--core-only`) — writes only the six core
  skills needed for the main workflow loop; no `gsd-*` subagents. Drops cold-start
  overhead from ~12k tokens to ~700. Useful for local LLMs with 32K–128K context.
  ([#2762](https://github.com/gsd-build/get-shit-done/issues/2762))

### Changed

- **Skill surface consolidated 86 → 59 `commands/gsd/*.md` entries** — four new
  grouped skills replace clusters of micro-skills (`capture`, `phase`, `config`,
  `workspace`); six existing parents absorb wrap-up and sub-operations as flags
  (`update --sync/--reapply`, `sketch --wrap-up`, `spike --wrap-up`,
  `map-codebase --fast/--query`, `code-review --fix`, `progress --do/--next`).
  Zero functional loss — 31 micro-skills deleted, all behavior preserved via flags.
  ([#2790](https://github.com/gsd-build/get-shit-done/issues/2790))

- **Canary release workflow now publishes from `dev` branch only** — aligns with
  the branch→dist-tag policy (`dev` → `@canary`, `main` → `@next`/`@latest`).
  `workflow_dispatch` on `main` now completes build/test/dry-run validation but
  skips publish and tag.
  ([#2868](https://github.com/gsd-build/get-shit-done/issues/2868))

- **PRs missing `Closes #NNN` are auto-closed** — the `Issue link required`
  workflow now auto-closes any PR opened without a closing keyword, posting a
  comment that points to the contribution guide.
  ([#2872](https://github.com/gsd-build/get-shit-done/issues/2872))

### Fixed

- **Gemini slash commands now namespaced as `/gsd:<cmd>` instead of `/gsd-<cmd>`** —
  Gemini CLI namespaces commands under `gsd:` so `/gsd-plan-phase` was unexecutable.
  The install path now converts every body-text reference via a roster-checked regex,
  consistently rewriting command files, agent bodies, and banners.
  ([#2768](https://github.com/gsd-build/get-shit-done/issues/2768),
  [#2783](https://github.com/gsd-build/get-shit-done/issues/2783))

- **GSD slash-command namespace drift cleaned up across docs, workflows, and
  autocomplete** — remaining stale `/gsd:<cmd>` references now use canonical
  `/gsd-<cmd>`; `scripts/fix-slash-commands.cjs` rewrites retired colon syntax.
  ([#2858](https://github.com/gsd-build/get-shit-done/pull/2858))

- **`SKILL.md` description quoted for Copilot / Antigravity / Trae / CodeBuddy** —
  descriptions starting with a YAML 1.2 flow indicator crashed gh-copilot's strict
  YAML loader. Six emission sites now wrap descriptions in `yamlQuote(...)`.
  ([#2876](https://github.com/gsd-build/get-shit-done/issues/2876))

- **`gsd-tools` invocations use the absolute installed path** — bare `gsd-tools …`
  calls inside skill bodies relied on PATH resolution not guaranteed in every runtime;
  replaced with the absolute path emitted at install time.
  ([#2851](https://github.com/gsd-build/get-shit-done/issues/2851))

- **Codex installer preserves trailing newline when stripping legacy hooks** — the
  legacy-hook strip ran against files with no terminating newline at EOF, breaking
  downstream parsers.
  ([#2866](https://github.com/gsd-build/get-shit-done/issues/2866))

---

## What was in rc.7

[`RELEASE-v1.39.0-rc.7.md`](RELEASE-v1.39.0-rc.7.md) — first 1.39.0 RC to roll in
post-rc.5 fixes from `main`. Includes the `extractCurrentMilestone` fenced-code-block
fix ([#2787](https://github.com/gsd-build/get-shit-done/issues/2787)), `audit-uat`
frontmatter parse fix ([#2788](https://github.com/gsd-build/get-shit-done/issues/2788)),
skill description budget + lint gate ([#2789](https://github.com/gsd-build/get-shit-done/issues/2789)),
`gsd-sdk` workstream + binary-collision fixes ([#2791](https://github.com/gsd-build/get-shit-done/issues/2791)),
and nine additional correctness fixes across OpenCode, Codex, and Gemini runtimes.

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
npm install -g get-shit-done-cc@1.40.0-rc.1
```

---

## What's next

- Soak rc.1 against real installs across Claude Code, Codex, Copilot, Gemini,
  OpenCode, and Antigravity runtimes.
- Wire write-side phase-lifecycle status-line on top of the
  [#2833](https://github.com/gsd-build/get-shit-done/issues/2833) read-side.
- Run `finalize` on the release workflow to promote `1.40.0` to `latest` once
  the train has soaked.
