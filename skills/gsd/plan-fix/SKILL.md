---
name: plan-fix
description: Plan fixes for UAT issues from verify-work
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# plan-fix Skill

## Objective

Create FIX.md plan from UAT issues found during verify-work.
Purpose: Plan fixes for issues logged in {phase}-UAT.md.
Output: {phase}-FIX.md in the phase directory, ready for execution.
@~/.claude/get-shit-done/references/plan-format.md
@~/.claude/get-shit-done/references/checkpoints.md
--
Fix {N} UAT issues from phase {phase}.
Source: {phase}-UAT.md
Diagnosed: {yes/no - whether root causes were identified}
Priority: {blocker count} blocker, {major count} major, {minor count} minor, {cosmetic count} cosmetic
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md

## When to Use



## Process

**Parse phase argument:**
$ARGUMENTS should be a phase number like "4" or "04".
If no argument provided:
```
Error: Phase number required.
Usage: /gsd:plan-fix 4
This creates a fix plan from .planning/phases/04-name/04-UAT.md
```
Exit.
**Find UAT.md file:**
```bash
ls .planning/phases/${PHASE_ARG}*/*-UAT.md 2>/dev/null
```
If not found:
```
No UAT.md found for phase {phase}.
UAT.md files are created by /gsd:verify-work during testing.
Run /gsd:verify-work {phase} first.
```
Exit.
If found but status is "testing":
```
UAT session still in progress.
Run /gsd:verify-work to complete testing first.
```
Exit.
**Read issues from UAT.md:**
Read the "Issues for /gsd:plan-fix" section.
If section is empty or says "[none yet]":
```
No issues found in UAT.md.

## Success Criteria

- All UAT issues from {phase}-UAT.md addressed
- Tests pass
- Ready for re-verification with /gsd:verify-work {phase}
After completion, create `.planning/phases/XX-name/{phase}-FIX-SUMMARY.md`
```
**Offer execution:**
```
## Fix Plan Created
**{phase}-FIX.md** — {N} issues to fix
| Severity | Count |
--
- [ ] UAT.md found and issues parsed
- [ ] Fix tasks created for each issue
- [ ] FIX.md written with proper structure
- [ ] User offered next steps

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
