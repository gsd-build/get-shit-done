# Planner Source Audit & Authority Limits

Reference for `agents/gsd-planner.md` — extended rules for multi-source coverage audits and planner authority constraints.

## Multi-Source Coverage Audit Format

Before finalizing plans, produce a **source audit** covering ALL four artifact types:

```
SOURCE    | ID      | Feature/Requirement          | Plan  | Status    | Notes
--------- | ------- | ---------------------------- | ----- | --------- | ------
GOAL      | —       | {phase goal from ROADMAP.md}  | 01-03 | COVERED   |
REQ       | REQ-14  | OAuth login with Google + GH | 02    | COVERED   |
REQ       | REQ-22  | Email verification flow      | 03    | COVERED   |
RESEARCH  | —       | Rate limiting on auth routes | 01    | COVERED   |
RESEARCH  | —       | Refresh token rotation       | NONE  | ⚠ MISSING | No plan covers this
CONTEXT   | D-01    | Use jose library for JWT     | 02    | COVERED   |
CONTEXT   | D-04    | 15min access / 7day refresh  | 02    | COVERED   |
```

### Four Source Types

1. **GOAL** — The `goal:` field from ROADMAP.md for this phase. The primary success condition.
2. **REQ** — Every REQ-ID in `phase_req_ids`. Cross-reference REQUIREMENTS.md for descriptions.
3. **RESEARCH** — Technical approaches, discovered constraints, and features identified in RESEARCH.md. Exclude items explicitly marked "out of scope" or "future work" by the researcher.
4. **CONTEXT** — Every D-XX decision from CONTEXT.md `<decisions>` section.

### What is NOT a Gap

Do not flag these as MISSING:
- Items in `## Deferred Ideas` in CONTEXT.md — developer chose to defer these
- Items scoped to a different phase via `phase_req_ids` — not assigned to this phase
- Items in RESEARCH.md explicitly marked "out of scope" or "future work" by the researcher

### Handling MISSING Items

If ANY row is `⚠ MISSING`, do NOT finalize the plan set silently. Return to the orchestrator:

```
## ⚠ Source Audit: Unplanned Items Found

The following items from source artifacts have no corresponding plan:

1. **{SOURCE}: {item description}** (from {artifact file}, section "{section}")
   - {why this was identified as required}

   Options:
   A) Add a plan to cover this item
   B) Split phase: move to a sub-phase
   C) Defer explicitly: add to backlog with developer confirmation

   → Awaiting developer decision before finalizing plan set.
```

If ALL rows are COVERED → return `## PLANNING COMPLETE` as normal.

---

## Authority Limits — Constraint Examples

The planner's only legitimate reasons to split or flag a feature are **constraints**, not judgments about difficulty:

**Valid (constraints):**
- ✓ "This task touches 9 files and would consume ~45% context — split into two tasks"
- ✓ "No API key or endpoint is defined in any source artifact — need developer input"
- ✓ "This feature depends on the auth system built in Phase 03, which is not yet complete"

**Invalid (difficulty judgments):**
- ✗ "This is complex and would be difficult to implement correctly"
- ✗ "Integrating with an external service could take a long time"
- ✗ "This is a challenging feature that might be better left to a future phase"

If a feature has none of the three legitimate constraints (context cost, missing information, dependency conflict), it gets planned. Period.
