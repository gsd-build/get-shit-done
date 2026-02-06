---
name: verify-work
description: Validate built features through conversational UAT
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# verify-work Skill

## Objective

Validate built features through conversational testing with persistent state.
Purpose: Confirm what Claude built actually works from user's perspective. One test at a time, plain text responses, no interrogation.
Output: {phase}-UAT.md tracking all test results, issues logged for /gsd:plan-fix
@~/.claude/get-shit-done/workflows/verify-work.md
@~/.claude/get-shit-done/templates/UAT.md

## When to Use



## Process

1. Check for active UAT sessions (resume or start new)
2. Find SUMMARY.md files for the phase
3. Extract testable deliverables (user-observable outcomes)
4. Create {phase}-UAT.md with test list
5. Present tests one at a time:
   - Show expected behavior
   - Wait for plain text response
   - "yes/y/next" = pass, anything else = issue (severity inferred)
6. Update UAT.md after each response
7. On completion: commit, present summary, offer next steps
- Don't use AskUserQuestion for test responses — plain text conversation
- Don't ask severity — infer from description
- Don't present full checklist upfront — one test at a time
- Don't run automated tests — this is manual user validation
- Don't fix issues during testing — log for /gsd:plan-fix
- [ ] UAT.md created with tests from SUMMARY.md
- [ ] Tests presented one at a time with expected behavior
- [ ] Plain text responses (no structured forms)
- [ ] Severity inferred, never asked
- [ ] File updated after each response (survives /clear)
- [ ] Committed on completion
- [ ] Clear next steps based on results

## Success Criteria

- [ ] UAT.md created with tests from SUMMARY.md
- [ ] Tests presented one at a time with expected behavior
- [ ] Plain text responses (no structured forms)
- [ ] Severity inferred, never asked
- [ ] File updated after each response (survives /clear)
- [ ] Committed on completion
- [ ] Clear next steps based on results

## Anti-Patterns

- Don't use AskUserQuestion for test responses — plain text conversation
- Don't ask severity — infer from description
- Don't present full checklist upfront — one test at a time
- Don't run automated tests — this is manual user validation
- Don't fix issues during testing — log for /gsd:plan-fix
- [ ] UAT.md created with tests from SUMMARY.md
- [ ] Tests presented one at a time with expected behavior
- [ ] Plain text responses (no structured forms)
- [ ] Severity inferred, never asked
- [ ] File updated after each response (survives /clear)
- [ ] Committed on completion
- [ ] Clear next steps based on results

## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
