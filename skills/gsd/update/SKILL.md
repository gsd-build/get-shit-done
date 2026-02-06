---
name: update
description: Update GSD to latest version with changelog display
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# update Skill

## Objective

Check for GSD updates, install if available, and display what changed.
Provides a better update experience than raw `npx get-shit-done-cc` by showing version diff and changelog entries.
Detect whether GSD is installed locally or globally by checking both locations:

## When to Use



## Process

Detect whether GSD is installed locally or globally by checking both locations:
```bash
# Check local first (takes priority)
if [ -f "./.claude/get-shit-done/VERSION" ]; then
  cat "./.claude/get-shit-done/VERSION"
  echo "LOCAL"
elif [ -f ~/.claude/get-shit-done/VERSION ]; then
  cat ~/.claude/get-shit-done/VERSION
  echo "GLOBAL"
else
  echo "UNKNOWN"
fi
```
Parse output:
- If last line is "LOCAL": installed version is first line, use `--local` flag for update
- If last line is "GLOBAL": installed version is first line, use `--global` flag for update
- If "UNKNOWN": proceed to install step (treat as version 0.0.0)
**If VERSION file missing:**
```
## GSD Update
**Installed version:** Unknown
Your installation doesn't include version tracking.
Running fresh install...
```
Proceed to install step (treat as version 0.0.0 for comparison).
Check npm for latest version:
```bash
npm view get-shit-done-cc version 2>/dev/null
```
**If npm check fails:**
```
Couldn't check for updates (offline or npm unavailable).
To update manually: `npx get-shit-done-cc --global`
```

## Success Criteria

- [ ] Installed version read correctly
- [ ] Latest version checked via npm
- [ ] Update skipped if already current
- [ ] Changelog fetched and displayed BEFORE update
- [ ] Clean install warning shown
- [ ] User confirmation obtained
- [ ] Update executed successfully
- [ ] Restart reminder shown

## Examples

### Example Usage
[TBD: Add specific examples of when and how to use this skill]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
