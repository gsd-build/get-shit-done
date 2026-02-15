# Project Research Summary

**Project:** Adding Cursor Runtime Support to GSD Installer
**Domain:** Runtime adaptation / Installer enhancement
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

Adding Cursor IDE runtime support to the GSD installer (`bin/install.js`) follows a well-established pattern already proven with OpenCode and Gemini implementations. Cursor requires specific conversions from Claude Code format: path references (`~/.claude/` → `~/.cursor/`), command format (`/gsd:` → `/gsd-`), tool names (PascalCase → snake_case), and frontmatter format (array → object with booleans). The conversion logic already exists in `cursor-gsd/scripts/migrate.sh` and needs to be integrated into the main installer following the same pattern used for other runtimes.

The implementation is straightforward but requires careful attention to avoid common pitfalls: incomplete tool name mapping in body text, path replacement edge cases, and frontmatter format conversion failures. The existing codebase provides clear patterns to follow, and the conversion requirements are well-documented in the adaptation guide.

**Key Risk:** The hand-rolled YAML frontmatter parsing used in existing conversion functions is fragile and may miss edge cases. However, the pattern is proven and can be extended for Cursor with careful testing.

## Key Findings

### Recommended Stack

The implementation uses existing Node.js patterns already in `bin/install.js`:

**Core technologies:**
- **Node.js fs/path modules** — file operations and path handling (already used)
- **Hand-rolled YAML parsing** — simple line-by-line parsing for frontmatter conversion (matches existing pattern)
- **Runtime-specific conversion functions** — follows `convertClaudeToOpencodeFrontmatter()` and `convertClaudeToGeminiAgent()` patterns

**Key insight:** Cursor uses a hybrid approach:
- Directory structure: **nested** (`commands/gsd/`) like Claude Code/Gemini (NOT flat like OpenCode)
- Command format: **hyphen** (`/gsd-cmd`) like OpenCode (NOT colon like Claude Code)
- Tool names: **snake_case** like OpenCode/Gemini (simpler than Gemini's `_file` suffixes)
- Frontmatter: **object format** (`tools: { read: true }`) like OpenCode (NOT array like Claude Code)
- Hooks: **Supported** like Claude Code/Gemini (NOT like OpenCode which lacks hooks)

### Expected Features

**Must have (table stakes):**
- Path reference conversion (`~/.claude/` → `~/.cursor/`) — without this, nothing works
- Command format conversion (`/gsd:` → `/gsd-`) — commands won't be recognized
- Tool name conversion (PascalCase → snake_case) — tools won't work with wrong names
- Frontmatter format conversion (`allowed-tools:` array → `tools:` object) — commands won't load
- Color format conversion (names → hex) — required for Cursor validation

**Should have (competitive):**
- Hook path updates — enables statusline and update checks (Cursor supports hooks unlike OpenCode)
- Settings.json hook configuration — completes hook integration
- Global install support — sufficient for MVP (local install can be added later)

**Defer (v2+):**
- Local install support — global-only is sufficient initially
- Runtime auto-detection — can require `--cursor` flag initially
- Advanced hook features — basic hooks are enough

### Architecture Approach

The implementation follows the existing runtime pattern with 16 discrete steps:

**Major components:**
1. **Flag parsing** — Add `--cursor` flag detection (lines 22-39)
2. **Directory resolution** — Add Cursor cases to `getDirName()` and `getGlobalDir()` functions
3. **Tool name mapping** — Create `claudeToCursorTools` object and `convertCursorToolName()` function
4. **Frontmatter conversion** — Create `convertClaudeToCursorFrontmatter()` function (similar to OpenCode pattern)
5. **Install/uninstall logic** — Add Cursor runtime labels and nested directory structure handling
6. **Hook support** — Update hook script paths and settings.json configuration

**Key pattern:** Each runtime requires the same 9 components (flag parsing, directory resolution, tool mapping, frontmatter conversion, install logic, uninstall logic, prompts, help text, attribution), but with runtime-specific implementations.

### Critical Pitfalls

1. **Incomplete Tool Name Mapping** — Tool names must be converted in ALL content (frontmatter AND body text), not just frontmatter. Prevention: Apply tool name replacements to entire content, test with grep for PascalCase tool names.

2. **Path Replacement Edge Cases** — Multiple path formats exist (`~/.claude/`, `.claude/`, `@~/.claude/get-shit-done/`). Prevention: Replace ALL path variants, not just `~/.claude/`, handle Windows paths, test with environment variable overrides.

3. **Frontmatter Format Conversion Failures** — Hand-rolled YAML parsing is fragile and may miss edge cases. Prevention: Handle all frontmatter variants (arrays, comma-separated strings, mixed formats), validate converted frontmatter before writing.

4. **Settings.json Merge Conflicts** — Installing GSD may overwrite existing user settings. Prevention: Deep merge settings instead of overwriting, check for existing hook registrations before adding, preserve user's attribution settings.

5. **MCP Tool Handling Inconsistencies** — MCP tools (`mcp__*`) handled differently across runtimes. Prevention: Document MCP tool behavior per runtime, Cursor should keep format as-is (like OpenCode), exclude Task tool (handled via subagent mechanism).

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Core Conversion Functions
**Rationale:** Foundation for all other work. Tool name mapping and frontmatter conversion are prerequisites.
**Delivers:** `claudeToCursorTools` mapping object, `convertCursorToolName()` function, `convertClaudeToCursorFrontmatter()` function
**Addresses:** Tool name conversion, frontmatter format conversion, color format conversion
**Avoids:** Incomplete tool name mapping, frontmatter format conversion failures

### Phase 2: Directory and Path Handling
**Rationale:** Directory resolution must work before file operations can proceed.
**Delivers:** Cursor cases in `getDirName()`, `getGlobalDir()` with `CURSOR_CONFIG_DIR` env var support, path replacement logic
**Addresses:** Path reference conversion, directory structure (nested `commands/gsd/`)
**Avoids:** Path replacement edge cases

### Phase 3: Installer Integration
**Rationale:** Core installer logic must be updated to use conversion functions and handle Cursor runtime.
**Delivers:** `--cursor` flag parsing, Cursor runtime labels, nested directory structure in `install()` function, command format conversion (`/gsd:` → `/gsd-`)
**Addresses:** Command format conversion, install logic, uninstall logic
**Uses:** Conversion functions from Phase 1, directory resolution from Phase 2

### Phase 4: Hook Support
**Rationale:** Hooks are optional but important for complete integration. Can be done after core functionality works.
**Delivers:** Hook script path updates (`gsd-check-update.js`, `gsd-statusline.js`), settings.json hook configuration, `getCommitAttribution()` Cursor case
**Addresses:** Hook path updates, settings.json configuration
**Avoids:** Settings.json merge conflicts

### Phase 5: User Interface Updates
**Rationale:** User-facing elements (prompts, help text, banners) should be updated last after core functionality is verified.
**Delivers:** Cursor option in `promptRuntime()`, help text updates, banner text updates, `finishInstall()` Cursor case
**Addresses:** Interactive prompts, help text, completion messages

### Phase 6: Testing and Verification
**Rationale:** Comprehensive testing ensures all conversions work correctly and no edge cases are missed.
**Delivers:** Test all 27 commands load correctly, test all 11 agents load correctly, test hooks trigger correctly, verify file references work
**Addresses:** End-to-end verification, edge case testing

### Phase Ordering Rationale

- **Phase 1 → Phase 2 → Phase 3:** Conversion functions are used by directory/path handling, which is used by installer logic (clear dependency chain)
- **Phase 4 after Phase 3:** Hooks depend on core installation working first
- **Phase 5 after Phase 4:** UI updates are cosmetic and should follow functional completion
- **Phase 6 last:** Testing requires all previous phases complete

**Grouping rationale:** Conversion logic (Phase 1) is isolated and testable independently. Directory/path handling (Phase 2) is infrastructure. Installer integration (Phase 3) ties everything together. Hooks (Phase 4) are optional enhancement. UI (Phase 5) is polish. Testing (Phase 6) validates everything.

**Pitfall avoidance:** Phase 1 addresses frontmatter conversion failures by creating robust conversion functions. Phase 2 addresses path replacement edge cases by handling all path variants. Phase 4 addresses settings.json merge conflicts by implementing proper merge logic.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Frontmatter conversion edge cases — test with various YAML formats to ensure robust parsing
- **Phase 4:** Hook system behavior — verify Cursor hook execution matches Claude Code exactly

Phases with standard patterns (skip research-phase):
- **Phase 2:** Directory resolution follows exact same pattern as OpenCode/Gemini
- **Phase 3:** Installer integration follows proven pattern from existing runtimes
- **Phase 5:** UI updates are straightforward text changes

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing Node.js patterns, proven conversion approach |
| Features | HIGH | Well-documented in migration script and adaptation guide |
| Architecture | HIGH | Follows exact same pattern as OpenCode/Gemini implementations |
| Pitfalls | HIGH | Based on direct code analysis and documented issues |

**Overall confidence:** HIGH

The implementation is straightforward because:
1. Conversion logic already exists in `cursor-gsd/scripts/migrate.sh`
2. Pattern is proven with OpenCode and Gemini implementations
3. Requirements are well-documented in `GSD-CURSOR-ADAPTATION.md`
4. Codebase provides clear examples to follow

### Gaps to Address

- **Command display format:** Cursor displays `/gsd/cmd` but files store as `/gsd-cmd`. Verify this is handled automatically by Cursor or if special handling needed. **Resolution:** Test during Phase 6, may need documentation update only.

- **Subagent mechanism:** How exactly does Cursor handle subagent spawning? Same as Claude Code `Task()` tool? **Resolution:** Test during Phase 6, Task tool exclusion is correct based on adaptation guide.

- **Environment variable:** Assumed `CURSOR_CONFIG_DIR` follows same pattern as `CLAUDE_CONFIG_DIR` and `GEMINI_CONFIG_DIR`. **Resolution:** Verify during Phase 2, likely correct based on pattern consistency.

## Sources

### Primary (HIGH confidence)
- `bin/install.js` (lines 1-1530) — Current installer implementation with OpenCode/Gemini patterns
- `cursor-gsd/scripts/migrate.sh` (lines 1-406) — Complete Cursor conversion logic
- `cursor-gsd/docs/GSD-CURSOR-ADAPTATION.md` — Complete adaptation guide with all requirements
- `cursor-gsd/src/` — Converted files showing target format

### Secondary (MEDIUM confidence)
- `cursor-gsd/scripts/install.ps1` — Cursor installation patterns (Windows-specific but shows structure)

### Tertiary (LOW confidence)
- Environment variable `CURSOR_CONFIG_DIR` — Assumed to follow same pattern as other runtimes (needs verification)

---
*Research completed: 2026-02-05*
*Ready for roadmap: yes*
