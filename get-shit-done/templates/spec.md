# Phase Spec Template

Template for `.planning/phases/XX-name/{phase_num}-SPEC.md` — locks requirements before discuss-phase.

**Purpose:** Capture WHAT a phase delivers and WHY, with enough precision that requirements are falsifiable. discuss-phase reads this file and focuses on HOW to implement (skipping "what/why" questions already answered here).

**Key principle:** Every requirement must be falsifiable — you can write a test or check that proves it was met or not. Vague requirements like "improve performance" are not allowed.

**Downstream consumers:**
- `discuss-phase` — reads SPEC.md at startup; treats Requirements, Boundaries, and Acceptance Criteria as locked; skips "what/why" questions
- `gsd-planner` — reads locked requirements to constrain plan scope
- `gsd-verifier` — uses acceptance criteria as explicit pass/fail checks

---

## File Template

```markdown
# Phase [X]: [Name] — Specification

**Created:** [date]
**Ambiguity score:** [score] (gate: ≤ 0.20)
**Requirements:** [N] locked

## Goal

[One precise sentence — specific and measurable. NOT "improve X" — instead "X changes from A to B".]

## Background

[Current state from codebase — what exists today, what's broken or missing, what triggers this work. Grounded in code reality, not abstract description.]

## Requirements

1. **[Short label]**: [Specific, testable statement.]
   - Current: [what exists or does NOT exist today]
   - Target: [what it should become after this phase]
   - Acceptance: [concrete pass/fail check — how a verifier confirms this was met]

2. **[Short label]**: [Specific, testable statement.]
   - Current: [what exists or does NOT exist today]
   - Target: [what it should become after this phase]
   - Acceptance: [concrete pass/fail check]

[Continue for all requirements. Each must have Current/Target/Acceptance.]

## Boundaries

**In scope:**
- [Explicit list of what this phase produces]
- [Each item is a concrete deliverable or behavior]

**Out of scope:**
- [Explicit list of what this phase does NOT do] — [brief reason why it's excluded]
- [Adjacent problems excluded from this phase] — [brief reason]

## Constraints

[Performance, compatibility, data volume, dependency, or platform constraints.
If none: "No additional constraints beyond standard project conventions."]

## Acceptance Criteria

- [ ] [Pass/fail criterion — unambiguous, verifiable]
- [ ] [Pass/fail criterion]
- [ ] [Pass/fail criterion]

[Every acceptance criterion must be a checkbox that resolves to PASS or FAIL.
No "should feel good", "looks reasonable", or "generally works" — those are not checkboxes.]

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                              |
|--------------------|-------|------|--------|------------------------------------|
| Goal Clarity       |       | 0.75 |        |                                    |
| Boundary Clarity   |       | 0.70 |        |                                    |
| Constraint Clarity |       | 0.65 |        |                                    |
| Acceptance Criteria|       | 0.70 |        |                                    |
| **Ambiguity**      |       | ≤0.20|        |                                    |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

[Key decisions made during the Socratic interview. Format: round → question → answer → decision locked.]

| Round | Perspective    | Question summary         | Decision locked                    |
|-------|----------------|-------------------------|------------------------------------|
| 1     | Researcher     | [what was asked]        | [what was decided]                 |
| 2     | Simplifier     | [what was asked]        | [what was decided]                 |
| 3     | Boundary Keeper| [what was asked]        | [what was decided]                 |

[If --auto mode: note "auto-selected" decisions with the reasoning Claude used.]

---

*Phase: [XX-name]*
*Spec created: [date]*
*Next step: /gsd-discuss-phase [X] — implementation decisions (how to build what's specified above)*
```

<good_examples>

**Example 1: Feature addition (Post Feed)**

```markdown
# Phase 3: Post Feed — Specification

**Created:** 2025-01-20
**Ambiguity score:** 0.12
**Requirements:** 4 locked

## Goal

Users can scroll through posts from accounts they follow, with new posts available after pull-to-refresh.

## Background

The database has a `posts` table and `follows` table. No feed query or feed UI exists today. The home screen shows a placeholder "Your feed will appear here." This phase builds the feed query, API endpoint, and the feed list component.

## Requirements

1. **Feed query**: Returns posts from followed accounts ordered by creation time, descending.
   - Current: No feed query exists — `posts` table is queried directly only from profile pages
   - Target: `GET /api/feed` returns paginated posts from followed accounts, newest first, max 20 per page
   - Acceptance: Query returns correct posts for a user who follows 3 accounts with known post counts; cursor-based pagination advances correctly

2. **Feed display**: Posts display in a scrollable card list.
   - Current: Home screen shows static placeholder text
   - Target: Home screen renders feed cards with author, timestamp, post content, and reaction count
   - Acceptance: Feed renders without error for 0 posts (empty state shown), 1 post, and 20+ posts

3. **Pull-to-refresh**: User can refresh the feed manually.
   - Current: No refresh mechanism exists
   - Target: Pull-down gesture triggers refetch; new posts appear at top of list
   - Acceptance: After a new post is created in test, pull-to-refresh shows the new post without full app restart

4. **New posts indicator**: When new posts arrive, a banner appears instead of auto-scrolling.
   - Current: No such mechanism
   - Target: "3 new posts" banner appears when refetch returns posts newer than the oldest visible post; tapping banner scrolls to top and shows new posts
   - Acceptance: Banner appears for ≥1 new post, does not appear when no new posts, tap navigates to top

## Boundaries

**In scope:**
- Feed query (backend) — posts from followed accounts, paginated
- Feed list UI (frontend) — post cards with author, timestamp, content, reaction counts
- Pull-to-refresh gesture
- New posts indicator banner
- Empty state when user follows no one or no posts exist

**Out of scope:**
- Creating posts — that is Phase 4
- Reacting to posts — that is Phase 5
- Following/unfollowing accounts — that is Phase 2 (already done)
- Push notifications for new posts — separate backlog item

## Constraints

- Feed query must use cursor-based pagination (not offset) — the database has 500K+ posts and offset pagination is unacceptably slow beyond page 3
- The feed card component must reuse the existing `<AvatarImage>` component from Phase 2

## Acceptance Criteria

- [ ] `GET /api/feed` returns posts only from followed accounts (not all posts)
- [ ] `GET /api/feed` supports `cursor` parameter for pagination
- [ ] Feed renders correctly at 0, 1, and 20+ posts
- [ ] Pull-to-refresh triggers refetch
- [ ] New posts indicator appears when posts newer than current view exist
- [ ] Empty state renders when user follows no one

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                            |
|--------------------|-------|------|--------|----------------------------------|
| Goal Clarity       | 0.92  | 0.75 | ✓      |                                  |
| Boundary Clarity   | 0.95  | 0.70 | ✓      | Explicit out-of-scope list       |
| Constraint Clarity | 0.80  | 0.65 | ✓      | Cursor pagination required       |
| Acceptance Criteria| 0.85  | 0.70 | ✓      | 6 pass/fail criteria             |
| **Ambiguity**      | 0.12  | ≤0.20| ✓      |                                  |

## Interview Log

| Round | Perspective     | Question summary              | Decision locked                         |
|-------|-----------------|------------------------------|-----------------------------------------|
| 1     | Researcher      | What exists in posts today?  | posts + follows tables exist, no feed  |
| 2     | Simplifier      | Minimum viable feed?         | Cards + pull-refresh, no auto-scroll   |
| 3     | Boundary Keeper | What's NOT this phase?       | Creating posts, reactions out of scope |
| 3     | Boundary Keeper | What does done look like?    | Scrollable feed with 4 card fields     |

---

*Phase: 03-post-feed*
*Spec created: 2025-01-20*
*Next step: /gsd-discuss-phase 3 — implementation decisions (card layout, loading skeleton, etc.)*
```

**Example 2: CLI tool (Database backup)**

```markdown
# Phase 2: Backup Command — Specification

**Created:** 2025-01-20
**Ambiguity score:** 0.15
**Requirements:** 3 locked

## Goal

A `gsd backup` CLI command creates a reproducible database snapshot that can be restored by `gsd restore` (a separate phase).

## Background

No backup tooling exists. The project uses PostgreSQL. Developers currently use `pg_dump` manually — there is no standardized process, no output naming convention, and no CI integration. Three incidents in the last quarter involved restoring from wrong or corrupt dumps.

## Requirements

1. **Backup creation**: CLI command executes a full database backup.
   - Current: No `backup` subcommand exists in the CLI
   - Target: `gsd backup` connects to the database (via `DATABASE_URL` env or `--db` flag), runs pg_dump, writes output to `./backups/YYYY-MM-DD_HH-MM-SS.dump`
   - Acceptance: Running `gsd backup` on a test database creates a `.dump` file; running `pg_restore` on that file recreates the database without error

2. **Network retry**: Transient network failures are retried automatically.
   - Current: pg_dump fails immediately on network error
   - Target: Backup retries up to 3 times with 5-second delay; 4th failure exits with code 1 and a message to stderr
   - Acceptance: Simulating 2 sequential network failures causes 2 retries then success; simulating 4 failures causes exit code 1 and stderr message

3. **Partial cleanup**: Failed backups do not leave corrupt files.
   - Current: Manual pg_dump leaves partial files on failure
   - Target: If backup fails after starting, the partial `.dump` file is deleted before exit
   - Acceptance: After a simulated failure mid-dump, no `.dump` file exists in `./backups/`

## Boundaries

**In scope:**
- `gsd backup` subcommand (full dump only)
- Output to `./backups/` directory (created if missing)
- Network retry (3 attempts)
- Partial file cleanup on failure

**Out of scope:**
- `gsd restore` — that is Phase 3
- Incremental backups — separate backlog item (full dump only for now)
- S3 or remote storage — separate backlog item
- Encryption — separate backlog item
- Scheduled/cron backups — separate backlog item

## Constraints

- Must use `pg_dump` (not a custom query) — ensures compatibility with standard `pg_restore`
- `--no-retry` flag must be available for CI use (fail fast, no retries)

## Acceptance Criteria

- [ ] `gsd backup` creates a `.dump` file in `./backups/YYYY-MM-DD_HH-MM-SS.dump` format
- [ ] `gsd backup` uses `DATABASE_URL` env var or `--db` flag for connection
- [ ] 3 retries on network failure, then exit code 1 with stderr message
- [ ] `--no-retry` flag skips retries and fails immediately on first error
- [ ] No partial `.dump` file left after a failed backup

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                          |
|--------------------|-------|------|--------|--------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      |                                |
| Boundary Clarity   | 0.95  | 0.70 | ✓      | Explicit out-of-scope list     |
| Constraint Clarity | 0.75  | 0.65 | ✓      | pg_dump required               |
| Acceptance Criteria| 0.80  | 0.70 | ✓      | 5 pass/fail criteria           |
| **Ambiguity**      | 0.15  | ≤0.20| ✓      |                                |

## Interview Log

| Round | Perspective     | Question summary              | Decision locked                         |
|-------|-----------------|------------------------------|-----------------------------------------|
| 1     | Researcher      | What backup tooling exists?  | None — pg_dump manual only             |
| 2     | Simplifier      | Minimum viable backup?       | Full dump only, local only             |
| 3     | Boundary Keeper | What's NOT this phase?       | Restore, S3, encryption excluded       |
| 4     | Failure Analyst | What goes wrong on failure?  | Partial files, CI fail-fast needed     |

---

*Phase: 02-backup-command*
*Spec created: 2025-01-20*
*Next step: /gsd-discuss-phase 2 — implementation decisions (progress reporting, flag design, etc.)*
```

</good_examples>

<guidelines>
**Every requirement needs all three fields:**
- Current: grounds the requirement in reality — what exists today?
- Target: the concrete change — not "improve X" but "X becomes Y"
- Acceptance: the falsifiable check — how does a verifier confirm this?

**Ambiguity Report must reflect the actual interview.** If a dimension is below minimum, mark it ⚠ — the planner knows to treat it as an assumption rather than a locked requirement.

**Interview Log is evidence of rigor.** Don't skip it. It shows that requirements came from discovery, not assumption.

**Boundaries protect the phase from scope creep.** The out-of-scope list with reasoning is as important as the in-scope list. Future phases that touch adjacent areas can point to this SPEC.md to understand what was intentionally excluded.

**SPEC.md is a one-way door for requirements.** discuss-phase will treat these as locked. If requirements change after SPEC.md is written, the user should update SPEC.md first, then re-run discuss-phase.

**SPEC.md does NOT replace CONTEXT.md.** They serve different purposes:
- SPEC.md: what the phase delivers (requirements, boundaries, acceptance criteria)
- CONTEXT.md: how the phase will be implemented (decisions, patterns, tradeoffs)

discuss-phase generates CONTEXT.md after reading SPEC.md.
</guidelines>
