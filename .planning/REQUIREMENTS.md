# Requirements: install.js Modularization

**Defined:** 2026-03-04
**Core Value:** Zero regressions — every runtime's install/uninstall behavior works identically before and after the refactor

## v1 Requirements

### Testing Baseline

- [x] **TEST-01**: All 4 runtime converter functions have tests (Claude→OpenCode, Claude→Gemini, Claude→Codex frontmatter/agent/command conversions)
- [x] **TEST-02**: Shared utility functions have tests (path helpers, attribution, frontmatter extraction, settings I/O)
- [x] **TEST-03**: Install flow has tests (file copying with path replacement, uninstall cleanup)
- [x] **TEST-04**: Mutation testing validates test quality — tests must fail when critical logic is altered

### Module Extraction

- [x] **MOD-01**: Extract `bin/lib/core.js` with shared utilities (path helpers, frontmatter parsing, attribution, manifest/patch, settings I/O)
- [x] **MOD-02**: Extract `bin/lib/claude.js` with Claude Code install/uninstall logic, hook and settings registration
- [x] **MOD-03**: Extract `bin/lib/opencode.js` with OpenCode install/uninstall, JSONC parsing, permissions, frontmatter conversion
- [x] **MOD-04**: Extract `bin/lib/gemini.js` with Gemini install/uninstall, TOML conversion, agent frontmatter conversion
- [x] **MOD-05**: Extract `bin/lib/codex.js` with Codex install/uninstall, config.toml management, skill/agent adapters
- [x] **MOD-06**: Reduce `bin/install.js` to thin orchestrator (arg parsing, interactive prompts, runtime dispatch)

### Verification

- [x] **VER-01**: All existing tests pass after refactor (including `tests/codex-config.test.cjs`)
- [x] **VER-02**: Post-refactor line coverage meets or exceeds 27% baseline on `bin/install.js` + `bin/lib/*.js`
- [x] **VER-03**: `GSD_TEST_MODE` exports continue to work or are migrated to per-module exports with backward-compatible re-exports

## v2 Requirements

### Extended Coverage

- **EXT-01**: Integration tests that run actual install to temp directory and verify output
- **EXT-02**: Coverage target raised to 60%+ across all modules

## Out of Scope

| Feature | Reason |
|---------|--------|
| ESM migration | Project uses CJS throughout, not part of this refactor |
| CLI interface changes | Purely internal restructuring, no user-facing changes |
| New runtime support | This is about breaking down what exists |
| Hook/command refactoring | Different concern, different files |
| Interactive prompt UX improvements | Out of scope for structural refactor |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 1 | Complete |
| TEST-02 | Phase 1 | Complete |
| TEST-03 | Phase 1 | Complete |
| TEST-04 | Phase 1 | Complete |
| MOD-01 | Phase 2 | Complete |
| MOD-02 | Phase 2 | Complete |
| MOD-03 | Phase 2 | Complete |
| MOD-04 | Phase 2 | Complete |
| MOD-05 | Phase 2 | Complete |
| MOD-06 | Phase 2 | Complete |
| VER-01 | Phase 3 | Complete |
| VER-02 | Phase 3 | Complete |
| VER-03 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after roadmap creation*
