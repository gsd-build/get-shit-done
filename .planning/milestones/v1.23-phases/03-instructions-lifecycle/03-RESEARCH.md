# Phase 3: Instructions & Lifecycle - Research

**Researched:** 2026-03-03
**Domain:** Node.js installer — marker-based file merging, uninstall logic, manifest/patch verification
**Confidence:** HIGH

## Summary

Phase 3 implements three capabilities: (1) generating/merging `copilot-instructions.md` with marker-based content management, (2) wiring Copilot-specific uninstall cleanup, and (3) verifying that existing manifest/patch features work correctly for Copilot's directory structure.

The codebase already has a proven pattern for marker-based config merging in `mergeCodexConfig()` / `stripGsdFromCodexConfig()` (lines 722-800 of `bin/install.js`). The Copilot instructions merge follows the same three-case pattern but targets markdown with HTML comment markers instead of TOML. Investigation reveals **four specific gaps** in the current code that Phase 3 must address: missing instructions generation, broken uninstall skill removal path, incomplete manifest hashing, and wrong `reportLocalPatches` command format.

**Primary recommendation:** Model the instructions merge/strip functions directly on the Codex config.toml pattern. The three install scenarios and the strip-or-delete-if-empty logic are identical conceptually — only the marker format and content differ.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**copilot-instructions.md Generation (INST-01, INST-02):**
- Template location: `./get-shit-done/templates/copilot-instructions.md` — lives in the source, not in `.github/`
- Content: Same as current `.github/copilot-instructions.md` (5 GSD instructions about skill usage, command routing, agent preference, workflow control, next-step prompting)
- Markers: Use HTML comments `<!-- GSD Configuration -->` to delimit GSD section
- Three scenarios on install: (1) File doesn't exist → create with GSD content between markers, (2) File exists without GSD markers → append GSD section at the end, (3) File exists with GSD markers → replace only the section between markers
- Both modes: Generate in local (`.github/copilot-instructions.md`) and global (`~/.copilot/copilot-instructions.md`)
- Same content in both global and local modes
- File placement: At runtime directory root, NOT inside `get-shit-done/`

**Uninstall Logic (LIFE-01):**
- Pattern-based deletion (same as other runtimes): `skills/gsd-*/`, `agents/gsd-*.agent.md`, `get-shit-done/`
- copilot-instructions.md cleanup on uninstall: Remove GSD section between markers, delete file if empty after removal, preserve file with only user content if remains
- Follows Codex pattern for config.toml cleanup (`stripGsdFromCodexConfig()`)

**Manifest and Local Patches (LIFE-02, LIFE-03):**
- Already implemented — `writeManifest()`, `saveLocalPatches()`, and `reportLocalPatches()` are generic functions that work for all runtimes
- Phase 3 scope: Verify these work correctly with Copilot's directory structure
- No new code needed unless testing reveals issues with Copilot-specific paths

### Claude's Discretion
- Exact marker format (opening/closing comment structure)
- Error messages for edge cases
- Whether to warn when appending to existing file vs silently appending
- Internal function naming for instructions merge logic

### Deferred Ideas (OUT OF SCOPE)
- Hooks support — Copilot CLI supports hooks but deferred to future milestone
- Path-specific instructions — Copilot supports `.github/instructions/*.instructions.md` for contextual instructions, could enhance GSD later

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INST-01 | `copilot-instructions.md` generated/updated at `.github/copilot-instructions.md` with GSD instructions | Template creation + `mergeCopilotInstructions()` function + wire into `install()` at the early-return point (line ~2249) |
| INST-02 | Smart marker-based merging preserves existing user content in `copilot-instructions.md` (uses `<!-- GSD Configuration -->` markers) | Three-case merge logic modeled on `mergeCodexConfig()` pattern; strip logic modeled on `stripGsdFromCodexConfig()` |
| LIFE-01 | Uninstall support removes GSD skills, agents, get-shit-done dir from `.github/` without removing non-GSD content | Fix uninstall skills branch (currently falls to wrong `else` path); add `copilot-instructions.md` cleanup |
| LIFE-02 | File manifest (`gsd-file-manifest.json`) written after installation for change detection | Fix `writeManifest()` to hash Copilot skills (missing `isCopilot` check at line 1924) |
| LIFE-03 | Local patch persistence detects user modifications before reinstall, backs up to `gsd-local-patches/` | Fix `reportLocalPatches()` to show `/gsd-reapply-patches` for Copilot (currently falls through to Claude's `/gsd:reapply-patches`) |

</phase_requirements>

## Architecture Patterns

### The Codex Merge Pattern (Reference Implementation)

The `mergeCodexConfig()` function at lines 762-800 implements the exact same three-case pattern needed for Copilot instructions:

```javascript
// Source: bin/install.js lines 762-800
function mergeCodexConfig(configPath, gsdBlock) {
  // Case 1: No file → create fresh
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, gsdBlock + '\n');
    return;
  }
  const existing = fs.readFileSync(configPath, 'utf8');
  const markerIndex = existing.indexOf(GSD_CODEX_MARKER);
  // Case 2: Has GSD marker → truncate and re-append
  if (markerIndex !== -1) {
    const before = existing.substring(0, markerIndex).trimEnd();
    const newContent = before ? before + '\n\n' + gsdBlock + '\n' : gsdBlock + '\n';
    fs.writeFileSync(configPath, newContent);
    return;
  }
  // Case 3: No marker → append at end
  content = content.trimEnd() + '\n\n' + gsdBlock + '\n';
  fs.writeFileSync(configPath, content);
}
```

### The Codex Strip Pattern (Reference Implementation)

The `stripGsdFromCodexConfig()` function at lines 722-756 implements the cleanup-on-uninstall pattern:

```javascript
// Source: bin/install.js lines 722-756
function stripGsdFromCodexConfig(content) {
  const markerIndex = content.indexOf(GSD_CODEX_MARKER);
  if (markerIndex !== -1) {
    let before = content.substring(0, markerIndex).trimEnd();
    // ... clean up injected keys ...
    if (!before) return null; // Signal: file was GSD-only, delete it
    return before + '\n';
  }
  // ... fallback regex cleanup ...
}
```

### Copilot Instructions: How It Differs

The Copilot instructions merge is **simpler** than Codex because:
1. **No feature injection** — Codex has a complex Case 3 where it injects `[features]` keys above the marker. Copilot just appends.
2. **Paired markers** — Codex uses a single marker (everything from marker to EOF). Copilot uses opening/closing `<!-- GSD Configuration -->` markers, making the strip logic cleaner (extract between markers, not truncate to EOF).
3. **Pure markdown** — No TOML parsing concerns, no section headers to manage.

### Recommended Marker Format

```markdown
<!-- GSD Configuration -->
# Instructions for GSD

- Use the get-shit-done skill when the user asks for GSD or uses a `gsd-*` command.
- Treat `/gsd-...` or `gsd-...` as command invocations and load the matching file from `.github/skills/gsd-*`.
- When a command says to spawn a subagent, prefer a matching custom agent from `.github/agents`.
- Do not apply GSD workflows unless the user explicitly asks for them.
- After completing any `gsd-*` command, always offer the user the next step by prompting them via the `ask_user` tool.
<!-- /GSD Configuration -->
```

Use `<!-- GSD Configuration -->` as the opening marker and `<!-- /GSD Configuration -->` as the closing marker. This follows HTML comment convention (like `<div>` / `</div>`) and is unambiguous for parsing.

### File Layout

```
get-shit-done/
└── templates/
    └── copilot-instructions.md    # NEW: template source (content only, no markers)

# At install time, generates:
.github/copilot-instructions.md     # local mode
~/.copilot/copilot-instructions.md  # global mode
```

## Specific Gaps Found in Current Code

### Gap 1: Uninstall Skills Branch (CRITICAL — LIFE-01)

**Location:** `bin/install.js` lines 1430-1502

**Problem:** The uninstall function has three branches for command/skill removal:
- `if (isOpencode)` → removes `command/gsd-*.md` ✓
- `else if (isCodex)` → removes `skills/gsd-*/`, `agents/gsd-*.toml`, `config.toml` ✓
- `else` → removes `commands/gsd/` (Claude/Gemini) ← **Copilot falls here!**

Copilot uses `skills/gsd-*/` (like Codex), NOT `commands/gsd/` (like Claude). When uninstalling Copilot, the current code tries to remove `commands/gsd/` which doesn't exist, silently skipping skills removal.

**Fix:** Add `else if (isCopilot)` branch before the `else` block. Copilot skills removal is identical to Codex skill removal (remove `skills/gsd-*/` directories) but without the `.toml` or `config.toml` cleanup.

### Gap 2: Manifest Skill Hashing (MEDIUM — LIFE-02)

**Location:** `bin/install.js` line 1924

**Problem:** `writeManifest()` only hashes skills for `isCodex`:
```javascript
if (isCodex && fs.existsSync(codexSkillsDir)) {
```
Copilot also installs to `skills/gsd-*/` but its files won't be hashed in the manifest.

**Fix:** Change condition to `(isCodex || isCopilot)` where `isCopilot` is `runtime === 'copilot'`. The `listCodexSkillNames()` function works for both runtimes (it's a generic `gsd-*/SKILL.md` scanner).

### Gap 3: reportLocalPatches Command Format (LOW — LIFE-03)

**Location:** `bin/install.js` lines 1998-2002

**Problem:** The reapply command ternary chain is:
```javascript
const reapplyCommand = runtime === 'opencode'
  ? '/gsd-reapply-patches'
  : runtime === 'codex'
    ? '$gsd-reapply-patches'
    : '/gsd:reapply-patches';  // ← Copilot falls here (Claude format)
```
Copilot uses `/gsd-reapply-patches` format (dash, not colon), same as OpenCode.

**Fix:** Add `runtime === 'copilot'` to the first condition: `runtime === 'opencode' || runtime === 'copilot'`.

### Gap 4: Install Function Early Return (MEDIUM — INST-01)

**Location:** `bin/install.js` lines 2249-2253

**Problem:** The install function currently early-returns for Copilot without generating instructions:
```javascript
if (isCopilot) {
  // Copilot: no settings.json, no hooks, no statusline (like Codex)
  // Content conversion handled in Phase 2
  return { settingsPath: null, settings: null, statuslineCommand: null, runtime };
}
```
Instructions generation must be wired in BEFORE this return.

**Fix:** Insert `mergeCopilotInstructions()` call before the early return.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Marker parsing | Custom regex parser for arbitrary markers | Simple `indexOf()` + `substring()` like Codex | The Codex pattern is proven, handles edge cases, and is 15 lines of code |
| File-empty check | Complex whitespace analysis | `.trim()` length check and return `null` | Same pattern as `stripGsdFromCodexConfig()` returning `null` for "delete file" signal |
| Template reading | Inline string in code | `fs.readFileSync()` from `get-shit-done/templates/` | Template can be updated independently of merge logic |

## Common Pitfalls

### Pitfall 1: Marker Collision in User Content
**What goes wrong:** A user writes `<!-- GSD Configuration -->` in their own instructions, causing the merge to incorrectly identify their content as the GSD section.
**Why it happens:** HTML comments are a common format; users might coincidentally use similar markers.
**How to avoid:** The markers are distinctive enough (`GSD Configuration` is unlikely to appear naturally). The paired opening/closing pattern further reduces collision risk. If paranoia is warranted, could use a longer marker like `<!-- GSD Configuration — managed by get-shit-done installer -->` (matching the Codex marker style).
**Recommendation:** Use a more distinctive marker that includes attribution, e.g., `<!-- GSD Configuration — managed by get-shit-done installer -->`. This matches the Codex pattern (`# GSD Agent Configuration — managed by get-shit-done installer`).

### Pitfall 2: Newline Handling at File Boundaries
**What goes wrong:** Appending GSD section creates double-blank-lines or missing newlines between user content and GSD section.
**Why it happens:** Inconsistent trimming when user content ends with various amounts of whitespace.
**How to avoid:** Always `trimEnd()` existing content before appending, then add exactly `\n\n` as separator. Matches the Codex pattern.

### Pitfall 3: Uninstall Leaves Empty File
**What goes wrong:** After stripping GSD content, the file remains but is empty/whitespace-only, confusing users.
**Why it happens:** Not checking if remaining content is meaningful after strip.
**How to avoid:** After removing GSD markers and content, `trim()` the result. If empty, delete the file entirely (return `null` from strip function as signal). This is exactly what `stripGsdFromCodexConfig()` does.

### Pitfall 4: Global Mode Path for Instructions
**What goes wrong:** Instructions file placed inside `get-shit-done/` instead of at the runtime directory root.
**Why it happens:** Confusion about where `copilot-instructions.md` goes relative to other installed files.
**How to avoid:** The instructions file lives at `targetDir/copilot-instructions.md`, NOT `targetDir/get-shit-done/copilot-instructions.md`. For local: `.github/copilot-instructions.md`. For global: `~/.copilot/copilot-instructions.md`.

### Pitfall 5: writeManifest Missing `isCopilot` Check
**What goes wrong:** Skills aren't tracked in manifest, so `saveLocalPatches()` never detects modifications to skills.
**Why it happens:** The manifest code was written for Codex and the `isCopilot` condition wasn't added.
**How to avoid:** The condition at line 1924 must include Copilot: `if ((isCodex || isCopilot) && fs.existsSync(codexSkillsDir))`.

## Code Examples

### Example 1: Instructions Merge Function

```javascript
// Constant — distinctive marker matching Codex style
const GSD_COPILOT_INSTRUCTIONS_MARKER = '<!-- GSD Configuration — managed by get-shit-done installer -->';
const GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER = '<!-- /GSD Configuration -->';

/**
 * Merge GSD instructions into copilot-instructions.md.
 * Three cases: new file, existing with markers, existing without markers.
 * @param {string} filePath - Full path to copilot-instructions.md
 * @param {string} gsdContent - Template content (without markers)
 */
function mergeCopilotInstructions(filePath, gsdContent) {
  const gsdBlock = GSD_COPILOT_INSTRUCTIONS_MARKER + '\n' +
    gsdContent.trim() + '\n' +
    GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER;

  // Case 1: No file — create fresh
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, gsdBlock + '\n');
    return;
  }

  const existing = fs.readFileSync(filePath, 'utf8');
  const openIndex = existing.indexOf(GSD_COPILOT_INSTRUCTIONS_MARKER);
  const closeIndex = existing.indexOf(GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER);

  // Case 2: Has GSD markers — replace between markers
  if (openIndex !== -1 && closeIndex !== -1) {
    const before = existing.substring(0, openIndex).trimEnd();
    const after = existing.substring(closeIndex + GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER.length).trimStart();
    let newContent = '';
    if (before) newContent += before + '\n\n';
    newContent += gsdBlock;
    if (after) newContent += '\n\n' + after;
    newContent += '\n';
    fs.writeFileSync(filePath, newContent);
    return;
  }

  // Case 3: No markers — append at end
  const content = existing.trimEnd() + '\n\n' + gsdBlock + '\n';
  fs.writeFileSync(filePath, content);
}
```

### Example 2: Instructions Strip Function

```javascript
/**
 * Strip GSD section from copilot-instructions.md content.
 * Returns cleaned content, or null if file should be deleted (was GSD-only).
 * @param {string} content - File content
 * @returns {string|null} - Cleaned content or null if empty
 */
function stripGsdFromCopilotInstructions(content) {
  const openIndex = content.indexOf(GSD_COPILOT_INSTRUCTIONS_MARKER);
  const closeIndex = content.indexOf(GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER);

  if (openIndex !== -1 && closeIndex !== -1) {
    const before = content.substring(0, openIndex).trimEnd();
    const after = content.substring(closeIndex + GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER.length).trimStart();
    const cleaned = (before + (before && after ? '\n\n' : '') + after).trim();
    if (!cleaned) return null;
    return cleaned + '\n';
  }

  // No markers found — nothing to strip
  return content;
}
```

### Example 3: Template File Content

```markdown
# Instructions for GSD

- Use the get-shit-done skill when the user asks for GSD or uses a `gsd-*` command.
- Treat `/gsd-...` or `gsd-...` as command invocations and load the matching file from `.github/skills/gsd-*`.
- When a command says to spawn a subagent, prefer a matching custom agent from `.github/agents`.
- Do not apply GSD workflows unless the user explicitly asks for them.
- After completing any `gsd-*` command, always offer the user the next step by prompting them via the `ask_user` tool.
```

### Example 4: Wiring into Install Function

```javascript
// In install(), BEFORE the isCopilot early return (line ~2249):
if (isCopilot) {
  // Generate copilot-instructions.md
  const templatePath = path.join(targetDir, 'get-shit-done', 'templates', 'copilot-instructions.md');
  const instructionsPath = path.join(targetDir, 'copilot-instructions.md');
  if (fs.existsSync(templatePath)) {
    const template = fs.readFileSync(templatePath, 'utf8');
    mergeCopilotInstructions(instructionsPath, template);
    console.log(`  ${green}✓${reset} Generated copilot-instructions.md`);
  }
  return { settingsPath: null, settings: null, statuslineCommand: null, runtime };
}
```

### Example 5: Uninstall Copilot Branch

```javascript
// In uninstall(), add before the else block (line ~1494):
} else if (isCopilot) {
  // Copilot: remove skills/gsd-*/ directories (same layout as Codex skills)
  const skillsDir = path.join(targetDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    let skillCount = 0;
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('gsd-')) {
        fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
        skillCount++;
      }
    }
    if (skillCount > 0) {
      removedCount++;
      console.log(`  ${green}✓${reset} Removed ${skillCount} Copilot skills`);
    }
  }
  
  // Copilot: clean GSD section from copilot-instructions.md
  const instructionsPath = path.join(targetDir, 'copilot-instructions.md');
  if (fs.existsSync(instructionsPath)) {
    const content = fs.readFileSync(instructionsPath, 'utf8');
    const cleaned = stripGsdFromCopilotInstructions(content);
    if (cleaned === null) {
      fs.unlinkSync(instructionsPath);
      removedCount++;
      console.log(`  ${green}✓${reset} Removed copilot-instructions.md (was GSD-only)`);
    } else if (cleaned !== content) {
      fs.writeFileSync(instructionsPath, cleaned);
      removedCount++;
      console.log(`  ${green}✓${reset} Cleaned GSD section from copilot-instructions.md`);
    }
  }
```

## Changes Inventory

All changes are in `bin/install.js` plus one new template file:

| # | File | Change | Requirement |
|---|------|--------|-------------|
| 1 | `get-shit-done/templates/copilot-instructions.md` | **CREATE** — template with 5 GSD instructions (no markers) | INST-01 |
| 2 | `bin/install.js` | **ADD** constant `GSD_COPILOT_INSTRUCTIONS_MARKER` and closing marker | INST-02 |
| 3 | `bin/install.js` | **ADD** function `mergeCopilotInstructions(filePath, gsdContent)` | INST-01, INST-02 |
| 4 | `bin/install.js` | **ADD** function `stripGsdFromCopilotInstructions(content)` | LIFE-01 |
| 5 | `bin/install.js` | **EDIT** `install()` — wire `mergeCopilotInstructions()` before Copilot early return (~line 2249) | INST-01 |
| 6 | `bin/install.js` | **EDIT** `uninstall()` — add `else if (isCopilot)` branch for skills + instructions cleanup (~line 1493) | LIFE-01 |
| 7 | `bin/install.js` | **EDIT** `writeManifest()` — change `isCodex` to `isCodex \|\| isCopilot` for skills hashing (~line 1924) | LIFE-02 |
| 8 | `bin/install.js` | **EDIT** `reportLocalPatches()` — add `runtime === 'copilot'` to first condition (~line 1998) | LIFE-03 |
| 9 | `bin/install.js` | **EDIT** module.exports — add new functions for testing | All |
| 10 | `tests/copilot-install.test.cjs` | **ADD** tests for merge, strip, uninstall, manifest, patches | All |

## Testing Strategy

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (no dependencies) |
| Config file | none — invoked via `scripts/run-tests.cjs` |
| Quick run command | `node --test tests/copilot-install.test.cjs` |
| Full suite command | `node scripts/run-tests.cjs` |

### Tests to Add (in `tests/copilot-install.test.cjs`)

**mergeCopilotInstructions:**
- Case 1: creates file from scratch when none exists
- Case 2: replaces between markers when both markers present
- Case 3: appends to existing file when no markers present
- Preserves user content before/after markers
- Handles file with only GSD content (re-creates cleanly)

**stripGsdFromCopilotInstructions:**
- Returns null when content is GSD-only (signal to delete)
- Returns cleaned content when user content surrounds GSD section
- Returns original content when no markers found
- Handles content before markers, after markers, and both

**Uninstall integration:**
- Skills/gsd-*/ directories removed
- copilot-instructions.md cleaned (user content preserved)
- copilot-instructions.md deleted when GSD-only

**writeManifest Copilot:**
- Skills hashed in manifest for Copilot runtime
- Agents (`.agent.md`) hashed in manifest

**reportLocalPatches Copilot:**
- Shows `/gsd-reapply-patches` (not `/gsd:reapply-patches`)

## Open Questions

1. **Should the template file include the `# Instructions for GSD` heading?**
   - What we know: The current `.github/copilot-instructions.md` starts with `# Instructions for GSD`. The CONTEXT.md says template contains "same content".
   - Recommendation: YES — include the heading in the template. It's part of the content, not a marker. This keeps the template self-documenting.

2. **Should `writeManifest()` also add `isCopilot` to the `!isOpencode && !isCodex` check at line 1911?**
   - What we know: Line 1911 excludes OpenCode and Codex from `commands/gsd/` hashing. Copilot also doesn't have `commands/gsd/`, but `fs.existsSync()` would be false anyway.
   - Recommendation: Add `&& !isCopilot` for correctness/clarity, though not strictly required. The `fs.existsSync` guard handles it.

## Sources

### Primary (HIGH confidence)
- `bin/install.js` — full source review of `mergeCodexConfig()` (lines 762-800), `stripGsdFromCodexConfig()` (lines 722-756), `uninstall()` (lines 1397-1686), `writeManifest()` (lines 1897-1943), `reportLocalPatches()` (lines 1989-2015), `install()` Copilot section (lines 2083-2253)
- `tests/copilot-install.test.cjs` — existing test patterns for Copilot Phase 1+2
- `.github/copilot-instructions.md` — current instructions content (5 bullet points)
- `03-CONTEXT.md` — locked decisions from discuss phase

## Metadata

**Confidence breakdown:**
- Instructions merge/strip pattern: HIGH — directly modeled on proven Codex code in same file
- Uninstall gaps: HIGH — identified by direct source code review of branch logic
- Manifest/patches gaps: HIGH — identified by direct source code review of conditions
- Template content: HIGH — exact content visible in `.github/copilot-instructions.md`

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable — all patterns are internal to this codebase)
