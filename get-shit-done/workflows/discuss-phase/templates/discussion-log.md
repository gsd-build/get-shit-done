# DISCUSSION-LOG.md template — for discuss-phase git_commit step

> **Lazy-loaded.** Read this file only inside the `git_commit` step of
> `workflows/discuss-phase.md`, immediately before writing
> `${phase_dir}/${padded_phase}-DISCUSSION-LOG.md`.

## Purpose

Audit trail for human review (compliance, learning, retrospectives). NOT
consumed by downstream agents — those read CONTEXT.md only.

## Template body

```markdown
# Phase [X]: [Name] - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** [ISO date]
**Phase:** [phase number]-[phase name]
**Areas discussed:** [comma-separated list]

---

[For each gray area discussed:]

## [Area Name]

| Option | Description | Selected |
|--------|-------------|----------|
| [Option 1] | [Description from AskUserQuestion] | |
| [Option 2] | [Description] | ✓ |
| [Option 3] | [Description] | |

**User's choice:** [Selected option or free-text response]
**Notes:** [Any clarifications, follow-up context, or rationale the user provided]

---

[Repeat for each area]

## Claude's Discretion

[List areas where user said "you decide" or deferred to Claude]

## Deferred Ideas

[Ideas mentioned during discussion that were noted for future phases]
```
