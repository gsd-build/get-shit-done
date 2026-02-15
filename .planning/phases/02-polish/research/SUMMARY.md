# Phase 2 Research Summary

**Date:** 2026-02-05

## Research Findings

| Item | Finding | Action |
|------|---------|--------|
| Notifications | No native API, statusline not supported | Skip hooks for Cursor |
| Clear Context | No `/clear`, use "+" button for new chat | Update workflow files |
| Clickable Commands | Not supported | Keep backtick format |
| Autocomplete | `name:` field causes mismatch | Remove `name:` during conversion |

## Decisions Based on Research

### 1. Skip Hooks for Cursor

**Rationale:**
- No statusline in Cursor → `gsd-statusline.js` useless
- Update check runs but can't display result → `gsd-check-update.js` useless
- No notification API alternative

**Implementation:**
- Don't deploy `hooks/` directory for Cursor
- Don't configure `settings.json` with hooks
- Skip statusline prompt for Cursor

### 2. Update `/clear` References

**Rationale:**
- Cursor has no `/clear` command
- Users click "+" button for new chat

**Implementation:**
- During Cursor conversion, replace `/clear` with "Click '+' (new chat)"
- Affects ~12 workflow/template files

### 3. Remove `name:` Field for Autocomplete

**Rationale:**
- `name: gsd-help` indexes autocomplete as `/gsd-help`
- Display shows as `/gsd/help` (from directory)
- Mismatch breaks autocomplete

**Implementation:**
- Remove `name:` field during frontmatter conversion (already partially implemented)
- Test if autocomplete works with `/gsd/` prefix

### 4. Keep Backtick Format for Commands

**Rationale:**
- Clickable commands not supported in Cursor
- Backtick format works for copy-paste

**Implementation:**
- No changes needed to output format

## Requirements Status

| Requirement | Status | Notes |
|-------------|--------|-------|
| HOOK-01 | Skip | No hooks for Cursor |
| HOOK-02 | Skip | No hooks for Cursor |
| HOOK-03 | Skip | No statusline in Cursor |
| UI-01 | Done | Phase 1 |
| UI-02 | Done | Phase 1 |
| UI-03 | Done | Phase 1 |

## New Work Items

1. **Installer changes:** Skip hook deployment for Cursor
2. **Conversion changes:** Replace `/clear` with new chat instruction
3. **Conversion changes:** Ensure `name:` field removal works
4. **Testing:** Verify autocomplete with `/gsd/` prefix

---
*Research synthesized: 2026-02-05*
