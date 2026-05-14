# File Operation Engine Module owns safe runtime/config file mutations

- **Status:** Superseded by ADR-0009 (Shell Command Projection Module expansion, Phases 3–4, `#3467`–`#3468`)
- **Date:** 2026-05-12
- **Superseded:** 2026-05-13

> **Supersession note.** Rather than build a separate File Operation Engine, the file-mutation safety policy this ADR proposed was absorbed into the **Shell Command Projection Module** (ADR-0009). Phase 3 (`#3467`) added `platformWriteSync` / `platformReadSync` / `platformEnsureDir` / `normalizeContent` to that seam, owning atomic write (tmp+rename), `.md` normalization, and directory creation as a single platform-conditional surface. Phase 4 (`#3468`) removed the duplicated `atomicWriteFileSync` / `safeReadFile` / `normalizeMd` wrappers from `core.cjs`. The `applyFileMutationPlan` / typed plan IR design proposed below was not built — the simpler per-call seam proved sufficient for the actual drift sites. Lock-file lifecycle (Track B item 3) remains owned by `withPlanningLock` in `planning-workspace.cjs` because its `{ flag: 'wx' }` exclusive-create semantics differ from atomic-write rename semantics.

---

We propose introducing a File Operation Engine Module that owns policy for managed file reads, writes, deletes, locks, backups, and rollbacks across installer, migration, and planning surfaces. Today, file mutation behavior is duplicated across `bin/install.js`, `get-shit-done/bin/lib/installer-migrations.cjs`, and multiple planning modules, with drift in atomic-write guarantees, path safety checks, and ownership classification.

This ADR also captures where Shell Command Projection Module policy should be consumed or expanded for hook-command-specific file mutations, so shell command drift and file mutation drift do not evolve as separate bug classes.

## Decision

- Add a **File Operation Engine Module** under `get-shit-done/bin/lib/` as the single seam for file mutation safety policy.
- Keep command-text projection in the Shell Command Projection Module (ADR-0009), but route projection-adjacent hook file mutations through shared managed-hook ownership policy.
- Move file operation adapters to the new seam in two tracks:
  - **Track A (projection-adjacent):** runtime config hook-command detection/rewrite/delete paths consume shared managed-hook policy from the projection seam.
  - **Track B (solution-wide):** shared file operation engine owns atomic write, path containment, lock behavior, rollback bookkeeping, and best-effort cleanup policy.
- Keep internal subprocess execution out of this seam (same boundary as ADR-0009): this is a file operation seam, not a command runner.

## Initial Scope

1. Unify managed-hook ownership classification used by install/uninstall/migration hook config rewrites.
2. Unify atomic write behavior currently duplicated in installer/core/migration paths.
3. Unify lock-file lifecycle policy used by planning workspace and installer migration journal flows.
4. Expose typed file mutation plan IR for tests (`rewrite-json`, `rewrite-text` with format (`toml`/`markdown`/`plain`), `delete-file`, `backup-file`, `restore-file`, `ensure-dir`).

## Migration Inventory

### Projection-adjacent file mutation drift (Track A)

- `bin/install.js`
  - hook cleanup command detection (`isGsdHookCommand`)
  - stale Codex hook strip basenames (`STALE_HOOK_BASENAMES`)
  - settings/config hook entry prune/rewrite paths
- `get-shit-done/bin/lib/installer-migrations/002-codex-legacy-hooks-json.cjs`
  - `isManagedCodexHookCommand` regex/path detection duplicated from installer-owned hook policy
- `get-shit-done/bin/lib/shell-command-projection.cjs`
  - `isManagedHookBasename` already owns part of this policy and should become the canonical owner

### Solution-wide file operation drift (Track B)

- `bin/install.js`
  - local `atomicWriteFileSync` and temp cleanup registry
  - large inlined read/modify/write + backup/rollback logic for runtime config and hooks
- `get-shit-done/bin/lib/core.cjs`
  - `atomicWriteFileSync` helper diverges in fallback behavior from installer/migration variants
- `get-shit-done/bin/lib/installer-migrations.cjs`
  - separate `writeFileAtomicSync`, rollback journaling, lock handling, and containment checks
- `get-shit-done/bin/lib/planning-workspace.cjs` and `get-shit-done/bin/lib/state.cjs`
  - duplicated lock-file create/release/remove patterns and best-effort cleanup semantics
- `get-shit-done/bin/lib/roadmap.cjs`, `phase.cjs`, `milestone.cjs`, `frontmatter.cjs`, `drift.cjs`
  - direct read/modify/write flows with inconsistent atomicity and normalization policy application

## Interface sketch

The File Operation Engine Module should expose typed mutation planning and execution helpers:

```js
planFileMutations({
  rootDir,
  operations: [
    { type: 'rewrite-json', relPath, mutate },
    { type: 'rewrite-text', relPath, mutate, format: 'toml' | 'markdown' | 'plain' },
    { type: 'delete-file', relPath },
    { type: 'ensure-dir', relPath },
  ],
  ownership: { mode: 'managed-only' | 'allow-user', classifier },
})
```

```js
applyFileMutationPlan({
  plan,
  atomic: true,
  rollback: true,
  lock: { scope: 'config' | 'planning', id: '...' },
})
```

For projection-adjacent paths, adapters should consume projection policy:

```js
isManagedHookCommand(commandText, { surface, configDir })
```

## Consequences

- File mutation safety policy becomes local to one module, reducing drift across installer/migration/planning paths.
- Shell command projection and hook ownership classification stay aligned at one seam family.
- Tests can assert typed mutation IR and reason codes instead of source-grep and duplicated predicate mirrors.
- Initial migration is broad; sequencing should prioritize projection-adjacent hook config paths first, then converge atomic-write and lock semantics.

## Open questions

- Whether lock semantics should be one shared policy for installer + planning, or two adapters over one lock primitive.
- Whether SDK query write paths should consume the same engine in the first pass or follow after CJS convergence.
- Whether file mutation telemetry (per-op reason codes and rollback events) should be required for all engine adapters.

## References

- ADR-0008: `0008-installer-migration-module.md`
- ADR-0009: `0009-shell-command-projection-module.md`
- Related bug history: `#1755`, `#2866`, `#2979`, `#3002`, `#3017`, `#3439`
