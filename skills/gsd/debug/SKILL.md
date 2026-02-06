---
name: debug
description: Systematic debugging with persistent state across context resets
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# debug Skill

## Objective

Debug issues using scientific method with a persistent debug document that survives `/clear`.
If resuming (no arguments and active session exists): pick up where you left off.
If starting new: gather symptoms, then investigate autonomously.
@~/.claude/get-shit-done/workflows/debug.md
@~/.claude/get-shit-done/templates/DEBUG.md

## When to Use



## Process

Follow the workflow in @~/.claude/get-shit-done/workflows/debug.md
**Quick reference:**
1. **Check for active sessions** - Offer to resume or start new
2. **Gather symptoms** - What happened? What should happen? Errors? When?
3. **Create DEBUG.md** - Document symptoms in `.planning/debug/[slug].md`
4. **Investigate** - Evidence → Hypothesis → Test → Eliminate or Confirm
5. **Fix and verify** - Minimal fix, verify against original symptoms
6. **Archive** - Move to `.planning/debug/resolved/`
**Key principle:** The DEBUG.md is your memory. Update it constantly. It survives `/clear`.
- [ ] Active sessions checked before starting new
- [ ] Symptoms gathered through AskUserQuestion (not inline questions)
- [ ] DEBUG.md tracks all investigation state
- [ ] Scientific method followed (not random fixes)
- [ ] Root cause confirmed with evidence before fixing
- [ ] Fix verified and session archived

## Success Criteria

- [ ] Active sessions checked before starting new
- [ ] Symptoms gathered through AskUserQuestion (not inline questions)
- [ ] DEBUG.md tracks all investigation state
- [ ] Scientific method followed (not random fixes)
- [ ] Root cause confirmed with evidence before fixing
- [ ] Fix verified and session archived

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
