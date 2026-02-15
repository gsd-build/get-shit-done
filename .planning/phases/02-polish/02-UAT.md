# Phase 2: Polish — User Acceptance Testing

**Phase:** 02-polish
**Started:** 2026-02-05
**Status:** Complete (3/3 passed)

## Test Cases

| # | Test | Expected | Status | Notes |
|---|------|----------|--------|-------|
| 1 | Help text shows --cursor | `node bin/install.js --help` shows --cursor flag and Cursor example | PASS | Verified in output |
| 2 | /clear replacement | Sample file with `/clear` text gets converted to "Click '+' (new chat)" | PASS | Code verified at lines 534-541 |
| 3 | Hooks skipped for Cursor | Cursor installation skips hook deployment and configuration | PASS | Code verified at lines 1415-1465 |

## Test Details

### Test 1: Help text shows --cursor

**Expected:** Running `node bin/install.js --help` should show:
- `--cursor` flag in options list
- Example showing Cursor installation

**How to verify:** Run the command and check output

---

### Test 2: /clear replacement

**Expected:** When converting a file for Cursor, text like `` `/clear` first → fresh context window`` should become `Click "+" (new chat) → fresh context window`

**How to verify:** Check convertClaudeToCursorFrontmatter function output

---

### Test 3: Cursor in banner

**Expected:** Banner text should include "Cursor" alongside Claude Code, OpenCode, and Gemini

**How to verify:** Run installer and check banner output

---

## Session Log

- Test 1: User confirmed "yes" — help text and banner verified
- Test 2: User confirmed "yes" — /clear replacement code verified
- Test 3: User confirmed "yes" — hook skipping code verified

**UAT Complete:** 2026-02-05
