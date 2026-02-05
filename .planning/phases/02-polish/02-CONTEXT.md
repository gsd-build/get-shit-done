---
phase: 02-polish
created: 2026-02-05
status: discussed
---

# Phase 2 Context: Polish

**Goal:** Hooks are configured and functional, help text is complete, and user experience matches other runtimes.

## Key Decisions

### 1. Hooks for Cursor

**Decision:** Research first, then decide whether to deploy hooks.

**Rationale:**
- Cursor has no statusline feature → `gsd-statusline.js` is not applicable
- `gsd-check-update.js` runs on SessionStart but relies on statusline to display results
- Without statusline, update check has no way to notify user
- Research Cursor's notification/toast API as alternative

**If no viable alternative:** Skip hooks entirely for Cursor (don't deploy hook files, don't configure settings.json hooks)

### 2. Hook Path Format

**Decision:** Use relative paths for Cursor hooks.

**Rationale:** Cursor hook commands use relative paths (e.g., `./hooks/format.sh`), not absolute paths. The installer should generate relative paths for Cursor, eliminating the need for path conversion.

**Example:**
```json
{
  "hooks": {
    "sessionStart": [{ "command": "./hooks/gsd-check-update.js" }]
  }
}
```

### 3. UI Polish Items

**Already implemented in Phase 1:**
- `--cursor` flag in help text
- Cursor in banner ("...for Claude Code, OpenCode, Gemini, and Cursor")
- `finishInstall()` shows Cursor-appropriate message with `/gsd-help` command

**Needs research:**
- Command autocomplete behavior (see below)

## Research Items

### R1: Cursor Notification API

**Question:** Does Cursor have a notification/toast API that commands can use to alert users?

**Use case:** Show "GSD update available" notification on session start (alternative to statusline)

**If found:** Implement update notification hook for Cursor
**If not found:** Skip hooks for Cursor entirely

### R2: Clear Context Alternative

**Question:** How do you clear/reset agent context in Cursor?

**Context:** GSD workflows suggest `/clear` between phases for fresh context window. Claude Code has `/clear`, Cursor may have different mechanism.

**Needed for:** Update workflow instructions and next-step suggestions

### R3: Clickable Commands in GUI

**Question:** Can Cursor render clickable command links in agent responses?

**Use case:** When GSD suggests "Next: /gsd-plan-phase 2", make it clickable to execute

**Possible approaches:**
- Markdown link syntax that Cursor intercepts
- Special formatting Cursor recognizes
- May not be possible (just informational)

### R4: Command Autocomplete Issue

**Problem:**
- Files use `/gsd-cmd` format (e.g., `/gsd-help`)
- Cursor UI displays as `/gsd/cmd` (e.g., `/gsd/help`)
- Autocomplete doesn't work when typing `/gsd/` prefix
- Only works when typing `/gsdcmd` (no separator)

**Question:** Is there a misconfiguration causing autocomplete to break? What's the correct naming convention for Cursor commands to preserve autocomplete?

**Impact:** Poor discoverability if users can't autocomplete commands

## Scope Boundaries

**In scope:**
- Hook deployment decisions based on research
- UI polish for Cursor-specific messaging
- Command naming/autocomplete fix if possible

**Out of scope (deferred to v2):**
- Cursor-specific statusline alternative (too complex for v1)
- New Cursor-only features

## Deferred Ideas

None captured during discussion.

---
*Context captured: 2026-02-05*
