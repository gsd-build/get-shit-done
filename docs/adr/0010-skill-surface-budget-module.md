# Skill Surface Budget Module owns install-time skill listing curation

- **Status:** Proposed
- **Date:** 2026-05-12

We propose extending the existing install profile seam (`get-shit-done/bin/lib/install-profiles.cjs`) into a **Skill Surface Budget Module** that owns which subset of GSD's 66 skills is written to the runtime config dirs, and that owns the per-skill `requires:` dependency manifest used to keep that subset closed under cross-skill references. GSD currently ships a binary `--minimal` / full toggle; runtimes that enumerate skills (Claude Code, OpenCode, etc.) cap the `<available_skills>` system-prompt block at `skillListingBudgetFraction` of the context window (default 1% = ~2k tokens at 200k), and GSD alone consumes ~60% of that cap (#3408). Further description shrinkage is unavailable — `scripts/lint-descriptions.cjs` already enforces a hard 100-char ceiling and the mean is 72.5 chars. The remaining lever is surfacing fewer skills, which requires a typed profile model plus a dependency manifest, not more ad-hoc allowlists.

## Decision

- Add a **Skill Surface Budget Module** by extending `get-shit-done/bin/lib/install-profiles.cjs` as the single owner for which `commands/gsd/*.md` and `agents/gsd-*.md` files are staged into the per-runtime copy pipeline.
- Replace the single `MINIMAL_SKILL_ALLOWLIST` constant with a typed `PROFILES` map keyed by profile name. Each profile is a *base set* of skills; the module computes the **transitive closure** over each skill's declared `requires:` set before staging.
- Add a `requires:` frontmatter field to every skill whose body references another GSD skill. The dependency graph in the research memo (`docs/research/2026-05-12-skill-surface-budget.md` §3.1) is the migration spec for this pass.
- Extend `bin/install.js` argument parsing to accept `--profile=<name>` and `--profile=<name1>,<name2>` (composable). Preserve `--minimal` / `--core-only` as aliases for `--profile=core`. Default install (no flag) remains `full` for back-compat.
- Persist the active profile to `~/.claude/skills/.gsd-profile` (and runtime-equivalent locations) so `gsd update` re-applies the same profile instead of expanding silently to full.
- Add `scripts/lint-skill-deps.cjs` and wire it into the existing `npm run lint:descriptions` pretest gate. The lint fails if:
  - a skill body references another skill not in its `requires:` set, or
  - any profile would ship a skill whose `requires:` closure is not satisfied.
- Keep the **interactive install picker** behind the same `AskUserQuestion`-style flow already used for runtime/location selection. Non-interactive installs (CI, `npx --yes`) fall back to `--profile=full` unless overridden.

## Initial Scope

First migration slice should land the profile model and one new tier above `core`:

1. Profile map (typed): `core` (current minimal, 7 skills including `phase`), `standard` (~13 skills covering the audit + main-loop + utility floor), `full` (current default, 66 skills).
2. `requires:` frontmatter added to the **hot nodes** of the dependency graph first: `phase` (38 callers), `review` (11), `config` (7), `progress` (5), `update` (5). These are the skills whose absence silently breaks others, so they need explicit `required_by` audit before any profile narrows them out.
3. Confirm-and-lock the latent bug fix surfaced by the audit: **`phase` is referenced by 38 skills and now belongs in `MINIMAL_SKILL_ALLOWLIST` / `PROFILES.core`.** Keep explicit coverage in minimal/core tests so this cannot regress.
4. CLI surface: `--profile=`, comma-composed profiles, `--profile=help` listing each profile's contents and token cost.
5. Profile marker persistence + `gsd update` re-application.

It should **not** in the first pass:

- Build a runtime enable/disable surface (`/gsd:surface`). Track as a follow-up ADR (see "Open questions").
- Split GSD into multiple npm packages. The packaging-level alternative was considered and rejected — see research memo §4 Option F.
- Consolidate further skills (e.g. collapsing `*-phase` into a dispatcher). Track separately as IA cleanup; orthogonal to surface curation.

## Migration Inventory

### `get-shit-done/bin/lib/install-profiles.cjs`

- Replace `MINIMAL_SKILL_ALLOWLIST` Object.freeze constant with `PROFILES` Object.freeze map of profile-name → base skill set.
- Replace `isMinimalMode(mode)` with `resolveProfile(mode)` returning a typed `{name, skills: Set, agents: Set}` after transitive-closure computation.
- Replace `shouldInstallSkill(name, mode)` with `shouldInstallSkill(name, resolvedProfile)`.
- Replace `stageSkillsForMode(srcDir, mode)` with `stageSkillsForProfile(srcDir, resolvedProfile)`. Add a sibling `stageAgentsForProfile` since this module now owns agent staging too (current `--minimal` skips agents wholesale; tiered profiles need finer control).
- Keep the existing exit-cleanup machinery (`STAGED_DIRS`, `ensureExitCleanup`) unchanged — the bug surface it covers is the same.

### `bin/install.js`

These call sites should migrate behind the Skill Surface Budget Module:

- `--minimal` / `--core-only` flag parsing — `bin/install.js:123-124`
- `_effectiveInstallMode` plumbing + `isMinimalMode()` checks — `bin/install.js:7634-8465` (passes through to per-runtime copy fns)
- minimal-agent skip block — `bin/install.js:8167-8207` (becomes "skip agents not in profile")
- runtime-specific copy entry points that consume `stageSkillsForMode` — 13 sites per the existing comment in `install-profiles.cjs`
- usage help block — `bin/install.js:508` (add `--profile=` documentation)

### Frontmatter changes

- Add `requires:` field to every skill in `commands/gsd/*.md` whose body references another GSD skill. Audit data lists the full set (`docs/research/2026-05-12-skill-surface-budget.md` §3.1). Estimate: 25-30 files touched in Phase 1.
- Field is optional. Absence = "no GSD-skill dependencies." `lint-skill-deps.cjs` enforces consistency, not presence.

### New: `scripts/lint-skill-deps.cjs`

- Walks `commands/gsd/*.md`, parses `requires:`, walks the body for `gsd:<name>` or `\b<stem>\b` references to other skills (same matching rules documented in `docs/research/2026-05-12-skill-surface-budget.md` §3.1).
- Fails CI if `requires:` set ≠ actual references (modulo ignore-list for prose mentions that aren't actual dispatches).
- Walks `PROFILES` from `install-profiles.cjs`, fails if any profile's transitive closure references a skill not in the profile.
- Wires into `npm run lint:descriptions` (or as a sibling `lint:skill-deps`) and `pretest`.

### Profile marker

- New `~/.claude/skills/.gsd-profile` (and per-runtime equivalents under `.codex/`, `.cursor/`, etc. as enumerated in `install.js`) containing the active profile name.
- Installer Migration Module (ADR-0008) gains a one-shot migration: if marker absent and skills dir matches `core` exactly, write `core`; otherwise write `full`. Migrations are idempotent per existing module contract.

### Tests expected to move with the seam

- `tests/install-profiles-*.test.cjs` (any existing) — extend to assert profile resolution, transitive closure, and `--profile=core,standard` composition.
- New `tests/skill-surface-budget-*.test.cjs` covering:
  - profile closure: a profile that lists `discuss-phase` must transitively include `phase` if `discuss-phase` requires it
  - lint failures: a skill body that references an un-required skill makes `lint:skill-deps` fail
  - marker persistence: `gsd install --profile=standard` followed by `gsd update` preserves `standard`
  - minimal back-compat: `--minimal` resolves to `--profile=core` and emits the same file set as today (modulo the `phase`-inclusion bug fix)

## Interface sketch

The module should accept typed profile intent and return a typed resolved profile:

```js
// install-profiles.cjs (extended)
resolveProfile({
  modes: ['core' | 'standard' | 'full'],
  skillsManifest: ManifestMap,   // parsed `requires:` graph
})
// → { name: 'standard', skills: Set<string>, agents: Set<string> }
```

Profile composition: `--profile=core,standard` resolves to `union(closure(core), closure(standard))`. `--profile=full` is the identity profile (every skill).

```js
stageSkillsForProfile(srcDir, resolvedProfile)  // returns staged dir path
stageAgentsForProfile(srcAgentsDir, resolvedProfile)  // new
```

Profile marker IO is typed too, not stringly:

```js
readActiveProfile(runtimeConfigDir) // → 'core' | 'standard' | 'full' | null
writeActiveProfile(runtimeConfigDir, profileName)
```

Per-skill frontmatter contract:

```yaml
---
name: gsd:plan-phase
description: ...
requires: [phase, discuss-phase]   # GSD skills only; not Claude Code primitives
---
```

`requires:` lists *GSD* skills (file stems). It does not include Claude Code built-ins (`Read`, `Bash`, etc.) — those continue to live in `allowed-tools:` per existing convention.

## Consequences

- The skill-set written by the installer becomes a typed first-class artifact, not a side effect of file copies + an allowlist constant. ADR-0008 (Installer Migration Module) gains a clean handle for safe profile migrations on upgrade.
- `gsd update` stops silently re-expanding a `--minimal` install to full — a current foot-gun documented inline in `install-profiles.cjs` (its module-level comment recommends `gsd update` without `--minimal` to "expand to the full surface"; that path remains available, but the default `gsd update` now respects the recorded profile).
- The `requires:` manifest creates a new authoring obligation (~30 files in Phase 1), enforced by CI. Skill authors who add a `/gsd:phase` reference in a new skill body have to update `requires:`. The lint script keeps drift low-cost.
- The `phase`-in-minimal latent gap (research memo §3.1) gets resolved as a side effect of adopting closure-based profile resolution — `phase` is auto-included whenever any minimal-loop skill `requires:` it.
- First-time install UX gains a profile picker. The default remains `full` for non-interactive (`npx --yes`) installs, so back-compat for CI scripts is preserved.
- The module becomes the canonical place to land future Anthropic platform features (lazy descriptions, per-plugin budgets, `.disabled` toggles — see Open Questions). It does not, in this ADR, *use* those features.
- If accepted, `CONTEXT.md` should gain a canonical **Skill Surface Budget Module** entry alongside the existing seam entries, and future architecture reviews should treat ad-hoc `commands/gsd/` filtering outside this seam as drift.

## Open questions

- Whether the Phase-2 runtime `/gsd:surface` command (research memo §4 Option B) should be its own ADR or an amendment to this one. Leaning **separate ADR** because it introduces persistent runtime state outside the install pipeline.
- Profile naming bikeshed. `core / standard / full` is the working proposal. Alternatives surveyed: `minimal / recommended / everything`, functional names (`planning, audit, research`). Settle in the implementation PR after a contributor poll.
- Whether the `requires:` field should also be consumed by `/gsd:help` to render a "skills you have installed and what depends on what" graph. Likely yes, but out of scope for this ADR.
- Whether to keep `phase` explicitly listed in `core` forever vs relying purely on closure semantics. Current recommendation: keep explicit listing because minimal mode has a back-compat allowlist path.
- Whether telemetry (opt-in) is worth proposing to inform where the `standard` profile line goes. Without it, the cut points are author-intuition. Track separately; not a blocker.
- Whether the Anthropic platform asks (research memo §6 — lazy descriptions, per-plugin budgets, dependency-aware listing, `.disabled` toggles) should be filed before or after this ADR ships. Recommendation: file as a feedback bundle when ADR is accepted, so we ship Phase 1 unilaterally and platform improvements compose on top.

## References

- Feature issue: `#3408`
- Research input: `docs/research/2026-05-12-skill-surface-budget.md`
- Existing seam being extended: `get-shit-done/bin/lib/install-profiles.cjs`
- Description budget enforcement: `scripts/lint-descriptions.cjs`
- Installer dispatch site: `bin/install.js:123-124`, `:8167-8207`
- See `0008-installer-migration-module.md` (the migration that records the profile marker lives here)
- See `0005-sdk-architecture-seam-map.md` (the seam map this module joins)
