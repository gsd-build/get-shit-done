---
name: consider-issues
description: Review deferred issues with codebase context, close resolved ones, identify urgent ones
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# consider-issues Skill

## Objective

Review all open issues from ISSUES.md with current codebase context. Identify which issues are resolved (can close), which are now urgent (should address), and which can continue waiting.
This prevents issue pile-up by providing a triage mechanism with codebase awareness.
@.planning/ISSUES.md
@.planning/STATE.md
@.planning/ROADMAP.md

## When to Use



## Process

**Verify issues file exists:**
If no `.planning/ISSUES.md`:
```
No issues file found.
This means no enhancements have been deferred yet (Rule 5 hasn't triggered).
Nothing to review.
```
Exit.
If ISSUES.md exists but has no open issues (only template or empty "Open Enhancements"):
```
No open issues to review.
All clear - continue with current work.
```
Exit.
**Parse all open issues:**
Extract from "## Open Enhancements" section:
- ISS number (ISS-001, ISS-002, etc.)
- Brief description
- Discovered phase/date
- Type (Performance/Refactoring/UX/Testing/Documentation/Accessibility)
- Description details
- Effort estimate
Build list of issues to analyze.
**For each open issue, perform codebase analysis:**
1. **Check if still relevant:**
   - Search codebase for related code/files mentioned in issue
   - If code no longer exists or was significantly refactored: likely resolved
2. **Check if accidentally resolved:**
   - Look for commits/changes that may have addressed this
   - Check if the enhancement was implemented as part of other work
3. **Assess current urgency:**
   - Is this blocking upcoming phases?

## Success Criteria

- [ ] All open issues analyzed against current codebase
- [ ] Each issue categorized (resolved/urgent/natural-fit/can-wait)
- [ ] Clear reasoning provided for each categorization
- [ ] Actions offered based on findings
- [ ] ISSUES.md updated if user takes action
- [ ] STATE.md updated if issue count changes

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
