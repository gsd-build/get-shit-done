---
type: prompt
name: gsd:feedback
description: File GSD bugs, feature requests, or questions with diagnostics auto-attached
argument-hint: "[freeform description]"
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

<objective>
Collect user feedback from inside a GSD session, attach actionable diagnostics automatically,
and file a GitHub issue against `gsd-build/get-shit-done`.

Preferred path: create the issue with `gh`.
Fallback path: open a prefilled GitHub issue URL.
Final fallback: always return the full markdown body for manual paste.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/feedback.md
</execution_context>

<context>
**Issue types:**
- `bug`
- `feature`
- `question`

**Repo target:**
- `gsd-build/get-shit-done`

**Input:**
- `$ARGUMENTS` may contain a freeform seed for the title and description
</context>

<process>
Read and execute the feedback workflow from @~/.claude/get-shit-done/workflows/feedback.md end-to-end.
</process>

<success_criteria>
- User intent captured as `bug`, `feature`, or `question`
- Diagnostics attached from current runtime and project state
- `gh issue create` attempted first when available
- Prefilled GitHub issue URL generated as fallback
- Full markdown body returned for manual filing even if submission fails
</success_criteria>

<critical_rules>
- Prefer machine-readable diagnostics from GSD helpers over ad hoc parsing
- Do not discard `$ARGUMENTS`; use it as a seed whenever possible
- Always return enough information for manual filing
- Never block on browser launch failure
</critical_rules>
