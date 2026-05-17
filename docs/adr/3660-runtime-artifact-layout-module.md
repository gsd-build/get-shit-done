# Runtime Artifact Layout Module owns per-runtime artifact placement

- **Status:** Proposed
- **Date:** 2026-05-17
- **Issue:** #3660

The **Runtime Surface Module** (`get-shit-done/bin/lib/surface.cjs`, introduced by ADR-0011 Phase 2) re-materializes a resolved Skill Surface profile to disk via `applySurface`. It currently hardcodes two artifact kinds (`commands`, `agents`) and re-derives their source directories via `_findInstallSource` / `_findAgentsSource` walk-up heuristics. The install and uninstall pipelines in `bin/install.js` each encode the same per-runtime artifact layout independently across ~14 install sites and ~6 uninstall sites. Bug #3659 surfaced the resulting drift: `applySurface` omits the `skills` kind for runtimes whose canonical layout is `skills/gsd-<stem>/SKILL.md`, so `gsd-surface profile <name>` leaves ~67 skill directories on disk under the install-time profile's footprint when the resolved profile should have pruned them — roughly 2.7k tokens per session on a measured workstation.

The root problem is the absence of a typed seam for "where does runtime R put artifact kind K." Three lifecycle sites (install, uninstall, surface) each independently encode this knowledge and drift independently.

## Decision

- Add a **Runtime Artifact Layout Module** at `get-shit-done/bin/lib/runtime-artifact-layout.cjs` as the single owner of the per-runtime artifact-placement table.
- The module requires `runtime-homes.cjs` for the canonical runtime enum and global config-dir resolution. It adds the artifact-kind axis on top.
- Expose `resolveRuntimeArtifactLayout(runtime, configDir) → Layout`. The returned `Layout` is a plain typed object — `{ runtime, configDir, kinds: ArtifactKind[] }` — with no I/O on resolution.
- Each `ArtifactKind` is `{ kind: 'commands'|'agents'|'skills', destSubpath, prefix, stage }`. `stage` is a function `(resolvedProfile) → stagedDir` that closes over the per-runtime converter where one is needed (e.g. `convertClaudeCommandToClaudeSkill` for the `skills` kind on Claude global).
- The `kinds` array is empty for runtimes with no GSD surface (a hypothetical future runtime with no integration). The `skills` kind is **absent** for runtimes that don't materialize skill directories (Cline; Gemini today). The `commands` kind is **absent** for runtimes that consume only the skills/agents layout (Claude global, Codex, etc.).
- Per-runtime quirks live in the layout's record fields, not in caller branches:
  - **Hermes**: `{ kind: 'skills', destSubpath: 'skills/gsd', prefix: '' }` — preserves the nested namespace from #2841.
  - **Cline**: `kinds: [ { kind: 'commands', … } ]` — no skills kind in the array.
  - **Gemini**: `kinds: [ { kind: 'commands', destSubpath: 'commands/gsd', prefix: 'gsd-' } ]` — no agents, no skills.
- `applySurface` migrates from `(runtimeConfigDir, commandsDir, agentsDir, manifest, clusterMap)` to `(runtimeConfigDir, layout, manifest, clusterMap)`. Body collapses to `for (const kind of layout.kinds) _syncGsdDir(kind.stage(resolved), path.join(layout.configDir, kind.destSubpath), kind.kind)`.
- `_findInstallSource` and `_findAgentsSource` in `surface.cjs` are removed. The layout owns source resolution.
- Phase 2 (separate PR): install and uninstall paths in `bin/install.js` migrate to iterate `layout.kinds`. Per-runtime if/else branches for skill-directory creation/removal collapse to one layout-driven loop per pipeline.
- Legacy-layout migrations (`bin/install.js:6710`/`:8402` for the pre-nested `skills/gsd-*/` flat layout; `migrateLegacyDevPreferencesToSkill` for #2973) remain inside the Installer Migration Module (ADR-0008) and run **before** layout-driven copy. The layout module describes only the current canonical target — no historical kinds.

## Initial Scope

Phase 1 should land the module and one consumer (the bug-#3659 fix):

1. New `get-shit-done/bin/lib/runtime-artifact-layout.cjs` — `resolveRuntimeArtifactLayout`, the typed `Layout`/`ArtifactKind` shapes, and the runtime table covering every runtime currently enumerated in `runtime-homes.cjs`.
2. `surface.cjs:applySurface` migrates to layout-driven iteration. `_findInstallSource` and `_findAgentsSource` deleted. The `skills` kind is now iterated alongside `commands` and `agents` — bug #3659 closed.
3. `commands/gsd/surface.md` and `tests/surface-apply.test.cjs` updated to construct + pass `Layout` values.
4. New `tests/runtime-artifact-layout-*.test.cjs` covering:
   - Per-runtime fixture table: each runtime maps to the expected `kinds[]` shape.
   - Hermes `skills/gsd` nested case.
   - Cline / Gemini "kind absent" cases.
   - Source-root resolution (replacing the existing `surface.cjs` walk-up tests).
5. Address the adjacent `readSurface` partial-field silent-null bug noted in #3659 — out of scope here; track as a separate `confirmed-bug` ticket.

Phase 1 should **not**:

- Migrate the install/uninstall pipelines in `bin/install.js` in the same PR. That's a separate enhancement issue — same seam, larger blast radius. The layout module is dual-consumable from the start; converting `bin/install.js` is a sequenced follow-up.
- Move the per-runtime skill converters (`convertClaudeCommandToClaudeSkill`, etc.). They survive at their current file location as the stage adapters; the layout module references them. A future ADR may consolidate them into a Skill Conversion Module if a second consumer emerges.

## Migration Inventory

### New file
- `get-shit-done/bin/lib/runtime-artifact-layout.cjs` — module body + runtime layout table.

### Files modified (Phase 1)
- `get-shit-done/bin/lib/surface.cjs` — `applySurface` signature change; `_findInstallSource` + `_findAgentsSource` removal.
- `commands/gsd/surface.md` — runbook updates the 3 sites that call `applySurface` to first call `resolveRuntimeArtifactLayout`.
- `tests/surface-apply.test.cjs` — 5 call sites pass `layout` instead of `commandsDir, agentsDir`.

### Files modified (Phase 2 — separate PR / separate issue)
- `bin/install.js` — install path: 4 per-runtime skill-stage blocks collapse to one layout-driven loop.
- `bin/install.js` — uninstall path: 6 per-runtime skill-removal blocks collapse to one layout-driven loop.
- Estimated reduction: ~250 lines.

### Files not touched
- `runtime-homes.cjs` — its narrow contract (runtime → global config dir / skills base) stays. The layout module is its sibling.
- `install-profiles.cjs` — `stageSkillsForProfile`, `stageAgentsForProfile` remain. The layout module's `kinds[i].stage` closures call them.
- The four skill converters at `bin/install.js:1622/1681/1792/2534` — remain in place; layout closures reference them.

## Interface sketch

```js
// runtime-artifact-layout.cjs

/**
 * @typedef {Object} ArtifactKind
 * @property {'commands'|'agents'|'skills'} kind
 * @property {string} destSubpath              joined to layout.configDir
 * @property {string} prefix                   'gsd-' or '' (Hermes nested case)
 * @property {(resolved) => string} stage      returns staged dir path
 */

/**
 * @typedef {Object} Layout
 * @property {string} runtime                  canonical enum from runtime-homes.cjs
 * @property {string} configDir                caller-supplied (local or global scope)
 * @property {ArtifactKind[]} kinds            empty array = runtime has no gsd-* surface
 */

function resolveRuntimeArtifactLayout(runtime, configDir) { … }
```

Call-site shape:

```js
// commands/gsd/surface.md (runbook), tests/surface-apply.test.cjs, future install/uninstall
const layout = resolveRuntimeArtifactLayout(runtime, runtimeConfigDir);
applySurface(runtimeConfigDir, layout, manifest, CLUSTERS);
```

`applySurface` body after migration:

```js
function applySurface(runtimeConfigDir, layout, manifest, clusterMap) {
  const resolved = resolveSurface(runtimeConfigDir, manifest, clusterMap);
  for (const kind of layout.kinds) {
    const staged = kind.stage(resolved);
    const dest = path.join(layout.configDir, kind.destSubpath);
    if (fs.existsSync(dest)) _syncGsdDir(staged, dest, kind.kind);
  }
}
```

## Consequences

- Bug #3659 becomes a fixture-table omission, not a forgotten if/else block. The layout-table test asserts every runtime's `kinds[]` shape — forgetting the `skills` kind on Claude global would fail there.
- The cross-runtime test matrix collapses from `N runtimes × 3 lifecycle verbs × 3 kinds` (today: ~120 implicit assertion pairs) to `N (layout table) + 3 (one per lifecycle verb iterating layout.kinds)`.
- Adding a new runtime (recent example: Grok via commit `05316369`) becomes one row in the layout table plus one fixture row in the test. The three lifecycle verbs pick it up automatically.
- The four per-runtime skill converters become canonical **adapters** at the artifact-kind seam. Their existence is no longer accidental — they're the seam's content.
- `surface.cjs` shrinks (`_findInstallSource` + `_findAgentsSource` removed). The walk-up heuristics — which were only ever-incidentally correct — are replaced by an explicit table.
- Phase 2 (install/uninstall migration) shrinks `bin/install.js` by ~250 lines and removes a recurring class of bug: a new runtime added by a contributor who forgets to wire it through every install/uninstall branch.
- Future architecture reviews should treat per-runtime artifact-placement knowledge added outside `runtime-artifact-layout.cjs` as drift, parallel to how ADR-0011 made out-of-seam skill staging drift.
- The Skill Surface Budget Module's leverage (typed sets of `{ skills, agents }`) now extends all the way to disk through one seam rather than three independent re-materializations.

## Open questions

- Whether the `skills` kind's `stage` closure should accept the per-runtime converter as a parameter (preserving converter-as-pure-function purity) or import it directly. Implementation detail — settle in the PR.
- Whether the layout module should expose a `listKinds(runtime)` introspection helper for status/diagnostics surfaces, or keep `Layout` as the only public type. Lean toward a single public type; add helpers only when a second consumer needs them.
- Whether Phase 2 (install/uninstall migration in `bin/install.js`) should land as a single follow-up PR or be split per pipeline. Lean toward single PR — the install and uninstall sides share the runtime branch structure and migrating only one introduces a temporary asymmetry inverse to today's.
- The adjacent `readSurface` partial-field silent-null fallback in `surface.cjs:55-75` (also flagged in #3659) is **out of scope here** — track separately. It's an independent shallow interface in the same module, not a runtime-layout concern.

## References

- Confirmed bug: `#3659` — `applySurface` doesn't prune `~/.claude/skills/gsd-*/` dirs
- See `0011-skill-surface-budget-module.md` — the Runtime Surface Module this seam serves
- See `0008-installer-migration-module.md` — legacy-layout migrations stay there
- See `0005-sdk-architecture-seam-map.md` — the seam map this module joins
- Existing canonical sibling: `get-shit-done/bin/lib/runtime-homes.cjs`
- Per-runtime skill converters this module references: `bin/install.js:1622` (Copilot), `:1681` (Claude), `:1792` (Antigravity), `:2534` (Codex)
- Hermes nested-skills layout rationale: `#2841`
