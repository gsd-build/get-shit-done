# Discussion Log Template

Template for `.planning/phases/XX-name/{phase_num}-DISCUSSION-LOG.md` — audit trail of discuss-phase Q&A sessions.

**Purpose:** Software audit trail for decision-making. Captures all options considered, not just the selected one. Separate from CONTEXT.md which is the implementation artifact consumed by downstream agents.

**NOT for LLM consumption.** This file should never be referenced in `<files_to_read>` blocks or agent prompts.

## Format

```markdown
# Phase [X]: [Name] - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** [ISO date]
**Phase:** [phase number]-[phase name]
**Areas discussed:** [comma-separated list]

---

## [Area 1 Name]

| Option | Description | Selected |
|--------|-------------|----------|
| [Option 1] | [Brief description] | |
| [Option 2] | [Brief description] | ✓ |
| [Option 3] | [Brief description] | |

**User's choice:** [Selected option or verbatim free-text response]
**Notes:** [Any clarifications or rationale provided during discussion]

---

## [Area 2 Name]

...

---

## Claude's Discretion

[Areas delegated to Claude's judgment — list what was deferred and why]

## Deferred Ideas

[Ideas mentioned but not in scope for this phase]

---

*Phase: XX-name*
*Discussion log generated: [date]*
```

## Rules

- Generated automatically at end of every discuss-phase session
- Includes ALL options considered, not just the selected one
- Includes user's freeform notes and clarifications
- Clearly marked as audit-only, not an implementation artifact
- Does NOT interfere with CONTEXT.md generation or downstream agent behavior
- Committed alongside CONTEXT.md in the same git commit
