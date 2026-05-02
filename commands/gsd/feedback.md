---
type: prompt
name: gsd:feedback
description: File a GSD issue — bug, feature request, or question — without leaving your session.
argument-hint: "[optional: brief description]"
allowed-tools:
  - Read
  - Bash
---

<objective>
User-driven issue intake for GSD. Complements /gsd-forensics (investigation-driven,
triggered by failures) — this command is proactive: run it any time, for any reason.

Purpose: Let users file bugs, feature requests, and questions to the GSD project
without leaving their session or context-switching to a browser.
Output: A filed GitHub issue (URL shown), or a prefilled browser URL, or formatted
markdown for manual copy-paste.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/feedback.md
</execution_context>

<context>
**User input:**
- Optional brief description: $ARGUMENTS (used to pre-fill title prompt if provided)
</context>

<process>
Read and execute the feedback workflow from @~/.claude/get-shit-done/workflows/feedback.md end-to-end.
</process>

<success_criteria>
- Issue type collected (bug / feature / question)
- Title and description collected
- For bugs: diagnostics attachment offered (once, not repeated)
- Issue filed via gh CLI, browser URL, or copy-paste fallback — in that order
- Filed issue URL (or fallback URL) presented to user
</success_criteria>

<critical_rules>
- **Ask once:** Each prompt is asked exactly once. Never loop back to re-ask a field.
- **Diagnostics are optional:** If the user declines or .planning/ doesn't exist, skip silently.
- **Redact paths:** Strip $HOME from any diagnostic content before including in issue body.
- **No fabrication:** Do not invent or guess GSD version, reproduction steps, or stack traces.
</critical_rules>
