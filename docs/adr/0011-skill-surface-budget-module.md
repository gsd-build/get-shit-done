# Skill Surface Budget Module owns install-time profile staging and runtime surface control

- **Status:** Accepted
- **Date:** 2026-05-12
- **Decision date:** 2026-05-12
- **Implementation:** feat/3408-skills-description-dropped-due-to-size, PR <TBD>

Every installed `gsd-*` skill costs eager system-prompt tokens: runtimes (Claude Code, opencode, and others) enumerate all skill descriptions in `<available_skills>` on every turn. With 66 skills and 33 agents, GSD alone consumes roughly 60% of the default 1%-of-context skill-listing budget, causing descriptions to drop when users stack multiple plugins (#3408).

The root problem is an absence of a profile/surface seam: the installer wrote every skill unconditionally, and no runtime-side control existed for enabling or disabling a cohesive group of skills without a full reinstall.

## Decision

- Add a **Skill Surface Budget Module** under `get-shit-done/bin/lib/install-profiles.cjs` as the single owner for which skills and agents are written to runtime config directories.
- Define three named profiles: `core` (six skills covering the main loop), `standard` (core + phase management and workspace skills), and `full` (all skills — the previous default).
- Compute each profile's effective skill set as the transitive closure over the `requires:` dependency graph extracted from skill frontmatter, so partial installs never break cross-skill dependencies.
- Persist the chosen profile in a `.gsd-profile` marker file in each runtime config directory; `gsd update` reads the marker to honor the profile on re-install.
- When multiple runtimes are configured, resolve disagreement to the most-restrictive profile (smallest effective skill set).
- Allow profile composition: `--profile=core,audit` resolves to `union(closure(core), closure(audit))`.
- Preserve back-compat aliases: `--minimal` and `--core-only` map to `--profile=core`; `MINIMAL_SKILL_ALLOWLIST`, `isMinimalMode`, `shouldInstallSkill`, and `stageSkillsForMode` remain exported for existing callers.
- Add a CI gate (`scripts/lint-skill-deps.cjs`, wired into `pretest`) that verifies every skill's `requires:` entries resolve against real skill stems — prevents the profile closure from silently over-installing or breaking.

## Phase 2 — Runtime Surface Module

The Phase 2 decision, previously listed as an open question, is recorded here as an amendment to this ADR.

### Decision

- Add a `/gsd:surface` slash command with the following sub-commands:
  - `list` — show all clusters and their enabled/disabled status for the active runtime
  - `status` — show the active profile, effective skill count, and any dropped-description warnings
  - `profile <name>` — switch the active profile and re-stage skills/agents for the current runtime
  - `disable <cluster>` — mark a cluster disabled; re-stage to remove its skills from the runtime config dir
  - `enable <cluster>` — mark a cluster enabled; re-stage to add its skills back
  - `reset` — clear surface state and re-apply the active profile from `.gsd-profile`
- Implement the runtime surface engine in `get-shit-done/bin/lib/surface.cjs`, consuming `stageSkillsForProfile` and `stageAgentsForProfile` from the Phase 1 module without duplicating staging logic.
- Persist per-runtime surface state in `<runtimeConfigDir>/.gsd-surface.json`, independent from `.gsd-profile`. The profile marker owns install-time identity; the surface JSON owns session-scope cluster toggles.
- Source cluster taxonomy from the research memo §3.2 (2026-05-12-skill-surface-budget.md). Define clusters in `get-shit-done/bin/lib/clusters.cjs` — a separate module so the surface engine and future SDK callers can import cluster definitions without loading the full profile module.
- Cluster taxonomy: `core_loop`, `audit_review`, `milestone`, `research_ideate`, `workspace_state`, `docs`, `ui`, `ai_eval`, `ns_meta`, `utility`. Membership may overlap; every installed skill stem must appear in at least one cluster (enforced by `tests/surface-clusters.test.cjs`).
- Relationship to Anthropic platform asks: Asks D (native per-skill toggle API) and E (budget-fraction negotiation) remain filed separately. The `/gsd:surface` command is a unilateral GSD-side workaround that does not depend on those platform changes.

## Status — Phase 1 shipped

Phase 1 artifacts landed on `feat/3408-skills-description-dropped-due-to-size`:

- `get-shit-done/bin/lib/install-profiles.cjs` — `PROFILES` map, `resolveProfile`, `loadSkillsManifest`, `stageSkillsForProfile`, `stageAgentsForProfile`, `readActiveProfile`, `writeActiveProfile`, `mostRestrictiveProfile`, `resolveEffectiveProfile`
- `requires:` frontmatter added to 64 skills in `commands/gsd/*.md`
- `scripts/lint-skill-deps.cjs` — CI gate for `requires:` integrity, wired into `pretest`
- `bin/install.js` — `--profile=<name>` flag (composable); `--minimal`/`--core-only` as aliases; `.gsd-profile` marker write on install; `gsd update` re-reads marker
- Tests: `tests/install-profiles-manifest.test.cjs`, `tests/install-profiles-marker.test.cjs`, `tests/install-profiles-resolve.test.cjs`, `tests/install-profiles-stage.test.cjs`, `tests/lint-skill-deps.test.cjs`

Phase 2 shipped on the same branch:

- `commands/gsd/surface.md` — `/gsd:surface` slash command runbook (sub-commands: `list`, `status`, `profile <name>`, `disable <cluster>`, `enable <cluster>`, `reset`)
- `get-shit-done/bin/lib/surface.cjs` — runtime engine (`readSurface`, `writeSurface`, `resolveSurface`, `applySurface`, `listSurface`); reuses `stageSkillsForProfile` / `stageAgentsForProfile` from Phase 1
- `get-shit-done/bin/lib/clusters.cjs` — 10-cluster taxonomy covering all installed skill stems
- Tests: `tests/surface-state.test.cjs`, `tests/surface-clusters.test.cjs`, `tests/surface-resolve.test.cjs`, `tests/surface-apply.test.cjs`, `tests/surface-list.test.cjs`
- Persistent surface state: `<runtimeConfigDir>/.gsd-surface.json` (independent from `.gsd-profile`)

## Open questions

- Whether the `requires:` field should also be consumed by `/gsd:help` to annotate dependency chains in help output (follow-up).
- Whether telemetry (per-profile install counts, cluster-disable events) should be added to the surface engine or deferred.
- Whether Anthropic platform asks D and E (native skill toggle API, budget-fraction negotiation) should block any future work in this module.

## Consequences

- Users with constrained context budgets can install `--profile=core` and expand incrementally via `/gsd:surface enable <cluster>` without a full reinstall.
- The `requires:` closure ensures partial installs never silently break skill cross-references.
- Future skills must declare `requires:` dependencies to participate in profile resolution; the lint gate enforces this at CI time.
- `CONTEXT.md` gains a canonical **Skill Surface Budget Module** entry; future architecture reviews should treat out-of-seam skill staging as drift.
- Cluster definitions in `clusters.cjs` are the authoritative taxonomy for runtime surface control; additions must be reflected there and in tests.

## References

- Feature issue: `#3408`
- Research memo: `docs/research/2026-05-12-skill-surface-budget.md` (§3.2 cluster taxonomy)
- See `0008-installer-migration-module.md`
- See `0009-shell-command-projection-module.md`
- See `0010-file-operation-engine-module.md`
