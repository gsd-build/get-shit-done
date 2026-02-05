# Requirements

**Project:** GSD Cursor Integration
**Last Updated:** 2026-02-05

## v1 Requirements

### Conversion Functions
- [ ] **CONV-01**: Tool name mapping object (`claudeToCursorTools`) converting PascalCase to snake_case
- [ ] **CONV-02**: Tool name conversion function (`convertCursorToolName`) applying mappings
- [ ] **CONV-03**: Frontmatter conversion function (`convertClaudeToCursorFrontmatter`) converting array/string to object format
- [ ] **CONV-04**: Color name to hex conversion in frontmatter (reuse existing `colorNameToHex` mapping)
- [ ] **CONV-05**: Tool name replacement in body text (not just frontmatter)

### Directory and Path Handling
- [ ] **PATH-01**: `getDirName('cursor')` returns `.cursor`
- [ ] **PATH-02**: `getGlobalDir('cursor')` returns `~/.cursor/` with `CURSOR_CONFIG_DIR` env var support
- [ ] **PATH-03**: Path reference replacement (`~/.claude/` → `~/.cursor/`) in file content
- [ ] **PATH-04**: Command format conversion (`/gsd:` → `/gsd-`) in file content

### Installer Integration
- [ ] **INST-01**: `--cursor` CLI flag recognized and adds 'cursor' to `selectedRuntimes`
- [ ] **INST-02**: Cursor option in interactive `promptRuntime()` (option 4: Cursor, option 5: All)
- [ ] **INST-03**: `install(isGlobal, 'cursor')` deploys files to `~/.cursor/` using nested directory structure
- [ ] **INST-04**: `uninstall(isGlobal, 'cursor')` removes GSD files from `~/.cursor/`
- [ ] **INST-05**: Attribution handling via `getCommitAttribution('cursor')` using settings.json pattern

### Hook Support
- [ ] **HOOK-01**: Hook script paths updated for Cursor (`~/.cursor/hooks/gsd-*.js`)
- [ ] **HOOK-02**: Settings.json configured with SessionStart hook for update checking
- [ ] **HOOK-03**: Statusline configured in settings.json

### User Interface
- [ ] **UI-01**: Help text includes `--cursor` flag and examples
- [ ] **UI-02**: `finishInstall()` shows Cursor-appropriate completion message
- [ ] **UI-03**: Banner and prompts reference Cursor where appropriate

### Verification
- [ ] **VER-01**: All 27 commands load in Cursor IDE
- [ ] **VER-02**: All 11 agents accessible via Task tool
- [ ] **VER-03**: Hooks trigger correctly on session start
- [ ] **VER-04**: File references (`@~/.cursor/...`) resolve correctly

### Cleanup
- [ ] **CLN-01**: Remove `cursor-gsd/` subfolder from repository
- [ ] **CLN-02**: Remove `GSD-CURSOR-ADAPTATION.md` from root (moved to docs or removed)

## v2 Requirements (Deferred)

- Local install support for Cursor (`.cursor/` in project)
- Runtime auto-detection (detect Cursor without `--cursor` flag)
- Cursor-specific statusline enhancements

## Out of Scope

- Windows-specific PowerShell installer — covered by unified Node.js installer
- Separate cursor-gsd distribution — consolidating into main installer
- Cursor plugin/extension — GSD installs as config files, not as extension

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONV-01 | 1 | Complete |
| CONV-02 | 1 | Complete |
| CONV-03 | 1 | Complete |
| CONV-04 | 1 | Complete |
| CONV-05 | 1 | Complete |
| PATH-01 | 1 | Complete |
| PATH-02 | 1 | Complete |
| PATH-03 | 1 | Complete |
| PATH-04 | 1 | Complete |
| INST-01 | 1 | Complete |
| INST-02 | 1 | Complete |
| INST-03 | 1 | Complete |
| INST-04 | 1 | Complete |
| INST-05 | 1 | Complete |
| HOOK-01 | 2 | Skipped |
| HOOK-02 | 2 | Skipped |
| HOOK-03 | 2 | Skipped |
| UI-01 | 2 | Complete |
| UI-02 | 2 | Complete |
| UI-03 | 2 | Complete |
| VER-01 | 3 | Pending |
| VER-02 | 3 | Pending |
| VER-03 | 3 | Pending |
| VER-04 | 3 | Pending |
| CLN-01 | 3 | Pending |
| CLN-02 | 3 | Pending |

---
*Requirements defined: 2026-02-05*
