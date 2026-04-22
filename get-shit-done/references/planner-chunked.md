# Chunked Mode Return Formats

Used when `plan-phase` spawns `gsd-planner` with `CHUNKED_MODE=true` (triggered by `--chunked`
flag or `workflow.plan_chunked: true` config). Splits the single long-lived planner Task into
shorter-lived Tasks to bound the blast radius of Windows stdio hangs.

## Modes

### outline-only

Write **only** `{PHASE_DIR}/{PADDED_PHASE}-PLAN-OUTLINE.md`. Do not write any PLAN.md files.
Return:

```markdown
## OUTLINE COMPLETE

**Phase:** {phase-name}
**Plans:** {N} plan(s) in {M} wave(s)

| Plan ID | Objective | Wave | Depends On | Requirements |
|---------|-----------|------|-----------|-------------|
| {padded_phase}-01 | [brief objective] | 1 | none | REQ-001, REQ-002 |
| {padded_phase}-02 | [brief objective] | 1 | none | REQ-003 |
```

The orchestrator reads this table, then spawns one single-plan Task per row.

### single-plan

Write **exactly one** `{PHASE_DIR}/{plan_id}-PLAN.md`. Do not write any other plan files.
Return:

```markdown
## PLAN COMPLETE

**Plan:** {plan-id}
**Objective:** {brief}
**File:** {PHASE_DIR}/{plan-id}-PLAN.md
**Tasks:** {N}
```

The orchestrator verifies the file exists on disk after each return, commits it, then moves
to the next plan entry from the outline.

## Resume Behaviour

If the orchestrator detects that `PLAN-OUTLINE.md` already exists (from a prior interrupted
run), it skips the outline-only Task and goes directly to single-plan Tasks, skipping any
`{plan_id}-PLAN.md` files that already exist on disk.
