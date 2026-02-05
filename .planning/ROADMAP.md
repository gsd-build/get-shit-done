# Roadmap

**Project:** GSD Cursor Integration
**Created:** 2026-02-05
**Phases:** 3

## Overview

| # | Phase | Goal | Requirements | Status |
|---|-------|------|--------------|--------|
| 1 | Core Implementation | Installer deploys GSD to ~/.cursor/ with correct conversions | CONV-01..05, PATH-01..04, INST-01..05 | Pending |
| 2 | Polish | Hooks work and UI is complete | HOOK-01..03, UI-01..03 | Pending |
| 3 | Verification & Cleanup | All features verified, cursor-gsd removed | VER-01..04, CLN-01..02 | Pending |

---

## Phase 1: Core Implementation

**Goal:** User can run `npx get-shit-done-cc --cursor --global` and GSD installs correctly to `~/.cursor/` with all files properly converted for Cursor format.

**Requirements:**
- CONV-01: Tool name mapping object
- CONV-02: Tool name conversion function
- CONV-03: Frontmatter conversion function
- CONV-04: Color conversion (reuse existing)
- CONV-05: Tool names in body text
- PATH-01: getDirName('cursor')
- PATH-02: getGlobalDir('cursor') with env var
- PATH-03: Path reference replacement
- PATH-04: Command format conversion
- INST-01: --cursor CLI flag
- INST-02: Interactive prompt option
- INST-03: install() for cursor
- INST-04: uninstall() for cursor
- INST-05: Attribution handling

**Success Criteria:**
1. `npx get-shit-done-cc --cursor --global` completes without errors
2. Files deployed to `~/.cursor/commands/gsd/`, `~/.cursor/agents/`, `~/.cursor/get-shit-done/`
3. All path references in deployed files point to `~/.cursor/`
4. Command references use `/gsd-` format
5. Tool names are snake_case in frontmatter and body
6. Frontmatter uses `tools: { tool: true }` object format

**Dependencies:** None (first phase)

---

## Phase 2: Polish

**Goal:** Hooks are configured and functional, help text is complete, and user experience matches other runtimes.

**Requirements:**
- HOOK-01: Hook script paths
- HOOK-02: SessionStart hook configuration
- HOOK-03: Statusline configuration
- UI-01: Help text with --cursor
- UI-02: finishInstall() Cursor message
- UI-03: Banner and prompts

**Success Criteria:**
1. `settings.json` contains correct hook configuration after install
2. Status line displays in Cursor IDE
3. Update check runs on session start
4. `--help` shows `--cursor` flag with examples
5. Completion message shows correct Cursor instructions

**Dependencies:** Phase 1 (installation must work first)

---

## Phase 3: Verification & Cleanup

**Goal:** All GSD commands and agents work in Cursor IDE, cursor-gsd subfolder removed.

**Requirements:**
- VER-01: Commands load
- VER-02: Agents accessible
- VER-03: Hooks trigger
- VER-04: File references resolve
- CLN-01: Remove cursor-gsd/
- CLN-02: Remove GSD-CURSOR-ADAPTATION.md

**Success Criteria:**
1. `/gsd-help` command loads and displays help in Cursor
2. `/gsd-new-project` initializes project correctly
3. Subagent spawning via Task tool works
4. Hooks execute on session start
5. `cursor-gsd/` folder deleted from repository
6. `GSD-CURSOR-ADAPTATION.md` removed or relocated
7. Git commit confirms cleanup

**Dependencies:** Phase 2 (hooks must be configured)

---

## Requirement Coverage

All v1 requirements mapped to phases:
- Phase 1: 14 requirements (CONV-01..05, PATH-01..04, INST-01..05)
- Phase 2: 6 requirements (HOOK-01..03, UI-01..03)
- Phase 3: 6 requirements (VER-01..04, CLN-01..02)

**Total:** 26 requirements across 3 phases

---
*Roadmap created: 2026-02-05*
