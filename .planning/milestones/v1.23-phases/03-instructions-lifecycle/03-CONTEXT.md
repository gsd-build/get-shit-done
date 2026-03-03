# Phase 3: Instructions & Lifecycle - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate `copilot-instructions.md` with marker-based merging, wire Copilot-specific uninstall logic (including instructions cleanup), and verify that existing manifest/patch features work correctly for Copilot.

</domain>

<decisions>
## Implementation Decisions

### copilot-instructions.md Generation (INST-01, INST-02)

- **Template location:** `./get-shit-done/templates/copilot-instructions.md` — lives in the source, not in `.github/`
- **Content:** Same as current `.github/copilot-instructions.md` (5 GSD instructions about skill usage, command routing, agent preference, workflow control, next-step prompting)
- **Markers:** Use HTML comments `<!-- GSD Configuration -->` to delimit GSD section
- **Three scenarios on install:**
  1. File doesn't exist → create with GSD content between markers
  2. File exists without GSD markers → append GSD section at the end
  3. File exists with GSD markers → replace only the section between markers
- **Both modes:** Generate in local (`.github/copilot-instructions.md`) and global (`~/.copilot/copilot-instructions.md`)
- **Same content** in both global and local modes
- **File placement:** At runtime directory root, NOT inside `get-shit-done/`

### Uninstall Logic (LIFE-01)

- **Pattern-based deletion** (same as other runtimes): `skills/gsd-*/`, `agents/gsd-*.agent.md`, `get-shit-done/`
- **copilot-instructions.md cleanup on uninstall:**
  - Remove GSD section between `<!-- GSD Configuration -->` markers
  - If file becomes empty/whitespace-only after removal → delete the file entirely
  - If user content remains outside markers → preserve file with only user content
- **Follows Codex pattern** for config.toml cleanup (`stripGsdFromCodexConfig()`)

### Manifest and Local Patches (LIFE-02, LIFE-03)

- **Already implemented** — `writeManifest()`, `saveLocalPatches()`, and `reportLocalPatches()` are generic functions that work for all runtimes
- **Phase 3 scope:** Verify these work correctly with Copilot's directory structure (skills/gsd-*/, agents/gsd-*.agent.md, get-shit-done/)
- **No new code needed** unless testing reveals issues with Copilot-specific paths

### Claude's Discretion

- Exact marker format (opening/closing comment structure)
- Error messages for edge cases
- Whether to warn when appending to existing file vs silently appending
- Internal function naming for instructions merge logic

</decisions>

<specifics>
## Specific Ideas

- The Codex `mergeCodexConfig()` and `stripGsdFromCodexConfig()` functions are the closest pattern reference for the instructions merge/strip logic
- The template at `./get-shit-done/templates/copilot-instructions.md` should contain ONLY the GSD instructions (no markers) — markers are added by the merge function
- `reportLocalPatches()` already has runtime-specific command suggestions (Claude: `/gsd:reapply-patches`, Codex: `$gsd-reapply-patches`) — needs a Copilot entry: `/gsd-reapply-patches`

</specifics>

<deferred>
## Deferred Ideas

- **Hooks support** — Copilot CLI supports hooks but deferred to future milestone (from Phase 1 context)
- **Path-specific instructions** — Copilot supports `.github/instructions/*.instructions.md` for contextual instructions, could enhance GSD later

</deferred>

---

*Phase: 03-instructions-lifecycle*
*Context gathered: 2026-03-03*
