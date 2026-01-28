# State Template

Template for `.planning/STATE.md` — the project's living memory.

---

## File Template

```markdown
---
# Machine-readable state (parsed by GSD workflows)
# DO NOT EDIT MANUALLY — updated by GSD commands
gsd_version: 2
current_phase: null
current_phase_dir: null
current_plan: null
phase_status: not_started
next_action: /gsd:plan-phase 1
last_checkpoint: null
plan_summary_exists: false  # CRITICAL: Only true when SUMMARY.md verified
plans_in_phase: 0
summaries_in_phase: 0
next_action: /gsd:plan-phase 1
last_checkpoint: null
scope_version: 1
last_verified: null  # Timestamp of last consistency check
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated [date])

**Core value:** [One-liner from PROJECT.md Core Value section]
**Current focus:** [Current phase name]

## Current Position

Phase: [X] of [Y] ([Phase name])
Plan: [A] of [B] in current phase
Status: [Ready to plan / Planning / Ready to execute / In progress / Phase complete]
Last activity: [YYYY-MM-DD] — [What happened]

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: [N]
- Average duration: [X] min
- Total execution time: [X.X] hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: [durations]
- Trend: [Improving / Stable / Degrading]

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase X]: [Decision summary]
- [Phase Y]: [Decision summary]

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

None yet.

## Session Continuity

Last session: [YYYY-MM-DD HH:MM]
Stopped at: [Description of last completed action]
Next step: [Suggested next command, e.g., /gsd:plan-phase 3]
Resume file: [Path to .continue-here*.md if exists, otherwise "None"]
Context file: [Path to relevant CONTEXT.md if exists]
```

<purpose>

STATE.md is the project's short-term memory spanning all phases and sessions.

**Problem it solves:** Information is captured in summaries, issues, and decisions but not systematically consumed. Sessions start without context.

**Solution:** A single, small file that's:
- Read first in every workflow
- Updated after every significant action
- Contains digest of accumulated context
- Enables instant session restoration

</purpose>

<lifecycle>

**Creation:** After ROADMAP.md is created (during init)
- Reference PROJECT.md (read it for current context)
- Initialize empty accumulated context sections
- Set position to "Phase 1 ready to plan"

**Reading:** First step of every workflow
- progress: Present status to user
- plan: Inform planning decisions
- execute: Know current position
- transition: Know what's complete

**Writing:** After every significant action
- execute: After SUMMARY.md created
  - Update position (phase, plan, status)
  - Note new decisions (detail in PROJECT.md)
  - Add blockers/concerns
- transition: After phase marked complete
  - Update progress bar
  - Clear resolved blockers
  - Refresh Project Reference date

</lifecycle>

<sections>

### YAML Frontmatter (Machine-Readable)

The frontmatter contains machine-readable fields parsed by GSD workflows:

| Field | Type | Purpose |
|-------|------|---------|
| `gsd_version` | int | Schema version for backwards compatibility |
| `current_phase` | string | Phase ID, e.g., `track-minus-0.5-phase-6` |
| `current_phase_dir` | string | Full path to phase directory |
| `current_plan` | string | Current plan ID, e.g., `01` or `null` |
| `phase_status` | enum | `not_started`, `planning`, `executing`, `verifying`, `complete` |
| `next_action` | string | Suggested next GSD command |
| `last_checkpoint` | string | Path to .continue-here.md or `null` |
| `scope_version` | int | Incremented when phase scope changes |
| `plan_summary_exists` | bool | **CRITICAL:** Only true when SUMMARY.md verified to exist |
| `plans_in_phase` | int | Count of PLAN.md files in current phase |
| `summaries_in_phase` | int | Count of SUMMARY.md files (should match plans when complete) |
| `last_verified` | string | Timestamp of last STATE/SUMMARY consistency check |

**Consistency Invariant:** `summaries_in_phase` should always match actual SUMMARY.md count. If mismatch detected, use `/gsd:recover-summary` to fix.

**Important:** Workflows should parse these fields instead of regex-matching prose text.

### Project Reference
Points to PROJECT.md for full context. Includes:
- Core value (the ONE thing that matters)
- Current focus (which phase)
- Last update date (triggers re-read if stale)

Claude reads PROJECT.md directly for requirements, constraints, and decisions.

### Current Position
Where we are right now:
- Phase X of Y — which phase
- Plan A of B — which plan within phase
- Status — current state
- Last activity — what happened most recently
- Progress bar — visual indicator of overall completion

Progress calculation: (completed plans) / (total plans across all phases) × 100%

### Performance Metrics
Track velocity to understand execution patterns:
- Total plans completed
- Average duration per plan
- Per-phase breakdown
- Recent trend (improving/stable/degrading)

Updated after each plan completion.

### Accumulated Context

**Decisions:** Reference to PROJECT.md Key Decisions table, plus recent decisions summary for quick access. Full decision log lives in PROJECT.md.

**Pending Todos:** Ideas captured via /gsd:add-todo
- Count of pending todos
- Reference to .planning/todos/pending/
- Brief list if few, count if many (e.g., "5 pending todos — see /gsd:check-todos")

**Blockers/Concerns:** From "Next Phase Readiness" sections
- Issues that affect future work
- Prefix with originating phase
- Cleared when addressed

### Session Continuity
Enables instant resumption:
- When was last session
- What was last completed
- Suggested next command (mirrors frontmatter `next_action`)
- Is there a .continue-here file to resume from
- Relevant context file for current work

**Next step field:** Should contain the exact command to run next, e.g.:
- `/gsd:plan-phase track-minus-0.5-phase-6`
- `/gsd:execute-phase 3`
- `/gsd:verify-work`

This is the primary source of truth for session handoff.

</sections>

<size_constraint>

Keep STATE.md under 100 lines.

It's a DIGEST, not an archive. If accumulated context grows too large:
- Keep only 3-5 recent decisions in summary (full log in PROJECT.md)
- Keep only active blockers, remove resolved ones

The goal is "read once, know where we are" — if it's too long, that fails.

</size_constraint>
