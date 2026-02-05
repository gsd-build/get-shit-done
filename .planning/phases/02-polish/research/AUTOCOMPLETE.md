# Cursor Command Naming and Autocomplete Research

**Research Date:** 2026-02-05  
**Confidence:** MEDIUM (official docs + codebase analysis + known issues)  
**Mode:** Ecosystem + Feasibility

## Problem Statement

GSD command files use `/gsd-cmd` format (e.g., filename `gsd-help.md` with frontmatter `name: gsd-help`), but:
- Cursor UI displays commands as `/gsd/cmd` (e.g., `/gsd/help`)
- Autocomplete doesn't work when typing `/gsd/` prefix
- Only finds commands when typing `/gsdcmd` (no separator)

## Key Findings

### 1. How Cursor Determines Command Display

**Directory Structure → Display Format:**
- Commands in nested directories (`commands/gsd/help.md`) are displayed as `/gsd/help` (directory name becomes prefix separator)
- Cursor automatically converts directory structure to slash-separated display format
- The nested directory name (`gsd`) becomes the namespace prefix

**Source:** Codebase analysis of `cursor-gsd/README.md` showing commands as `/gsd/map-codebase`, `/gsd/new-project`, etc.

### 2. How Cursor Indexes Commands for Autocomplete

**Frontmatter `name:` Field → Autocomplete Index:**
- Cursor indexes commands based on the `name:` field in YAML frontmatter
- Current GSD commands use `name: gsd-help` (hyphen format)
- Autocomplete searches for exact match: `/gsd-help` (hyphen, no slash separator)
- This creates a mismatch with display format (`/gsd/help`)

**Evidence:**
- All GSD command files have `name: gsd-{command}` format (hyphenated)
- Install script comment (line 575): "Remove name: field - Cursor uses filename for command name" (but files still contain `name:` fields)
- Autocomplete only works with `/gsd{command}` (no separator), suggesting it's matching against the `name:` field value

**Source:** Codebase analysis of `cursor-gsd/src/commands/gsd/*.md` files showing consistent `name: gsd-{command}` pattern

### 3. Official Cursor Documentation

**From Cursor Docs (`cursor.com/docs/context/commands`):**
- Commands are "plain Markdown files" stored in `.cursor/commands` directory
- Documentation does NOT mention nested subdirectories
- Documentation does NOT mention frontmatter `name:` field behavior
- Documentation does NOT explain autocomplete indexing mechanism

**Gap:** Official docs are incomplete regarding nested directories and autocomplete behavior.

**Confidence:** HIGH (official source, but incomplete)

### 4. Known Issues with Nested Directories

**Issue:** Cursor IDE (and Claude Code) has known problems discovering commands in nested subdirectories.

**Evidence from GitHub Issues:**
- Claude Code does not discover slash commands in nested directories like `.claude/commands/bmad/`
- Commands with properly formatted frontmatter in nested directories don't appear in command palette/autocomplete
- This affects multiple projects using nested command structures

**Source:** GitHub issue #773 in BMAD-METHOD repository, GitHub issue #1523 in Cursor repository

**Confidence:** MEDIUM (community reports, not officially documented)

### 5. Current GSD Implementation

**File Structure:**
```
~/.cursor/commands/gsd/
├── help.md          (name: gsd-help)
├── new-project.md   (name: gsd-new-project)
└── ...
```

**Display Behavior:**
- Commands appear in UI as `/gsd/help`, `/gsd/new-project` (slash separator from directory structure)

**Autocomplete Behavior:**
- Typing `/gsd/` → No autocomplete suggestions
- Typing `/gsdhelp` → Finds `/gsd/help` (matches `name: gsd-help` field)
- Typing `/gsd-new-project` → Finds command (matches `name:` field exactly)

**Root Cause:** Mismatch between display format (derived from directory structure) and autocomplete index (derived from `name:` field).

## Why `/gsd-` in Filename Becomes `/gsd/` in UI

**Answer:** It doesn't. The display format comes from the **directory structure**, not the filename.

**Process:**
1. File location: `commands/gsd/help.md`
2. Cursor extracts directory name: `gsd`
3. Cursor extracts filename: `help.md` → `help`
4. Cursor combines: `/gsd/help` (directory name + filename, slash separator)

The `name:` field in frontmatter (`gsd-help`) is used for autocomplete indexing, not display.

## Recommendations

### Option 1: Remove `name:` Field (Recommended)

**Approach:** Remove `name:` field from frontmatter, let Cursor derive command name from filename.

**Rationale:**
- Install script already attempts this (line 575-578)
- Cursor documentation suggests commands use filenames
- Would align autocomplete with display format

**Implementation:**
- Update install script to actually remove `name:` fields (currently commented/not working)
- Test if autocomplete then works with `/gsd/` prefix

**Risk:** LOW - If Cursor truly uses filename, this should work. If not, we can revert.

**Confidence:** MEDIUM - Based on install script comment, but needs verification

### Option 2: Change `name:` Field Format

**Approach:** Change `name: gsd-help` to `name: gsd/help` (match display format).

**Rationale:**
- Aligns autocomplete index with display format
- Users see `/gsd/help`, autocomplete searches for `/gsd/help`

**Implementation:**
- Update all command frontmatter: `name: gsd/{command}`
- Update install script conversion logic

**Risk:** MEDIUM - Unknown if Cursor accepts slashes in `name:` field. May break command registration.

**Confidence:** LOW - No evidence this format works

### Option 3: Flatten Directory Structure

**Approach:** Move commands from `commands/gsd/` to `commands/` root, rename files to `gsd-help.md`.

**Rationale:**
- Avoids nested directory issues entirely
- Commands display as `/gsd-help` (matches `name:` field)
- Autocomplete works with `/gsd-` prefix

**Tradeoffs:**
- Loses namespace organization
- Conflicts with other command collections
- Requires significant refactoring

**Risk:** LOW - Known to work, but loses organizational benefits

**Confidence:** HIGH - Standard pattern documented in Cursor docs

### Option 4: Accept Limitation

**Approach:** Document that users must type `/gsd{command}` (no separator) for autocomplete.

**Rationale:**
- No code changes required
- Commands still work, just different autocomplete pattern
- May be fixed in future Cursor versions

**Tradeoffs:**
- Poor UX (mismatch between display and autocomplete)
- Users must remember different pattern
- Doesn't solve the problem

**Risk:** NONE - No changes needed

**Confidence:** HIGH - Current state works this way

## Recommended Path Forward

**Phase 1: Investigation (Low Risk)**
1. Test removing `name:` field from one command file
2. Verify if autocomplete then works with `/gsd/` prefix
3. If yes → implement Option 1 across all commands
4. If no → proceed to Phase 2

**Phase 2: Format Change (Medium Risk)**
1. Test changing `name: gsd-help` to `name: gsd/help` in one command
2. Verify command still registers and autocomplete works
3. If yes → implement Option 2 across all commands
4. If no → proceed to Phase 3

**Phase 3: Accept Limitation (No Risk)**
1. Document autocomplete pattern in README
2. Update user-facing docs to show `/gsd{command}` pattern
3. Monitor Cursor updates for nested directory support

## Testing Protocol

For each option, verify:
1. **Command Registration:** Does command appear in `/` menu?
2. **Display Format:** Does it show as expected?
3. **Autocomplete:** Does typing `/gsd/` show suggestions?
4. **Execution:** Does command execute correctly?

## Sources

**Official Documentation:**
- `https://cursor.com/docs/context/commands` - Cursor command documentation (incomplete on nested directories)

**Codebase Analysis:**
- `cursor-gsd/src/commands/gsd/*.md` - All command files use `name: gsd-{command}` format
- `bin/install.js:575-578` - Install script attempts to remove `name:` field
- `cursor-gsd/README.md:46-51` - Shows commands as `/gsd/{command}` format

**Community Reports:**
- GitHub issue #773 (BMAD-METHOD) - Nested directory command discovery issues
- GitHub issue #1523 (Cursor) - Feature request for nested directory support

**Confidence Assessment:**
- **Display behavior:** HIGH (verified in codebase)
- **Autocomplete behavior:** MEDIUM (observed behavior, not officially documented)
- **Root cause:** MEDIUM (inferred from evidence, not confirmed by Cursor)
- **Solutions:** LOW-MEDIUM (options are hypotheses, need testing)

## Open Questions

1. Does Cursor actually use the `name:` field for autocomplete, or is it using filename?
2. Can Cursor accept slashes in the `name:` field value?
3. Will Cursor fix nested directory autocomplete in future versions?
4. Is there a Cursor configuration file that controls command indexing?

## Next Steps

1. **Immediate:** Test Option 1 (remove `name:` field) on one command
2. **If successful:** Update install script and all command files
3. **If unsuccessful:** Test Option 2 (change `name:` format)
4. **Documentation:** Update README with correct autocomplete pattern regardless of solution
