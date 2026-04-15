<purpose>
Check project progress, summarize recent work and what's ahead, then intelligently route to the next action — either executing an existing plan or creating the next one. Provides situational awareness before continuing work.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="init_context">
**Load progress context (paths only):**

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init progress)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract from init JSON: `project_exists`, `roadmap_exists`, `state_exists`, `phases`, `current_phase`, `next_phase`, `milestone_version`, `completed_count`, `phase_count`, `paused_at`, `state_path`, `roadmap_path`, `project_path`, `config_path`.

```bash
DISCUSS_MODE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.discuss_mode 2>/dev/null || echo "discuss")
```

**Parse `--forensic` flag from `$ARGUMENTS`:**

```bash
FORENSIC=false
if echo "$ARGUMENTS" | grep -q '\-\-forensic'; then
  FORENSIC=true
fi
```

When `FORENSIC=true`, the standard progress report and routing suggestion still run first, unchanged. The `forensic_audit` step then appends a 6-check integrity audit after routing. When `FORENSIC=false` (default), the `forensic_audit` step is skipped entirely — behavior is byte-for-byte identical to pre-flag behavior.

If `project_exists` is false (no `.planning/` directory):

```
No planning structure found.

Run /gsd-new-project to start a new project.
```

Exit.

If missing STATE.md: suggest `/gsd-new-project`.

**If ROADMAP.md missing but PROJECT.md exists:**

This means a milestone was completed and archived. Go to **Route F** (between milestones).

If missing both ROADMAP.md and PROJECT.md: suggest `/gsd-new-project`.
</step>

<step name="load">
**Use structured extraction from gsd-tools:**

Instead of reading full files, use targeted tools to get only the data needed for the report:
- `ROADMAP=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap analyze)`
- `STATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state-snapshot)`

This minimizes orchestrator context usage.
</step>

<step name="analyze_roadmap">
**Get comprehensive roadmap analysis (replaces manual parsing):**

```bash
ROADMAP=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap analyze)
```

This returns structured JSON with:
- All phases with disk status (complete/partial/planned/empty/no_directory)
- Goal and dependencies per phase
- Plan and summary counts per phase
- Aggregated stats: total plans, summaries, progress percent
- Current and next phase identification

Use this instead of manually reading/parsing ROADMAP.md.
</step>

<step name="recent">
**Gather recent work context:**

- Find the 2-3 most recent SUMMARY.md files
- Use `summary-extract` for efficient parsing:
  ```bash
  node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" summary-extract <path> --fields one_liner
  ```
- This shows "what we've been working on"
  </step>

<step name="position">
**Parse current position from init context and roadmap analysis:**

- Use `current_phase` and `next_phase` from `$ROADMAP`
- Note `paused_at` if work was paused (from `$STATE`)
- Count pending todos: use `init todos` or `list-todos`
- Check for active debug sessions: `(ls .planning/debug/*.md 2>/dev/null || true) | grep -v resolved | wc -l`
  </step>

<step name="report">
**Generate progress bar from gsd-tools, then present rich status report:**

```bash
# Get formatted progress bar
PROGRESS_BAR=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" progress bar --raw)
```

Present:

```
# [Project Name]

**Progress:** {PROGRESS_BAR}
**Profile:** [quality/balanced/budget/inherit]
**Discuss mode:** {DISCUSS_MODE}

## Recent Work
- [Phase X, Plan Y]: [what was accomplished - 1 line from summary-extract]
- [Phase X, Plan Z]: [what was accomplished - 1 line from summary-extract]

## Current Position
Phase [N] of [total]: [phase-name]
Plan [M] of [phase-total]: [status]
CONTEXT: [✓ if has_context | - if not]

## Key Decisions Made
- [extract from $STATE.decisions[]]
- [e.g. jq -r '.decisions[].decision' from state-snapshot]

## Blockers/Concerns
- [extract from $STATE.blockers[]]
- [e.g. jq -r '.blockers[].text' from state-snapshot]

## Pending Todos
- [count] pending — /gsd-check-todos to review

## Active Debug Sessions
- [count] active — /gsd-debug to continue
(Only show this section if count > 0)

## What's Next
[Next phase/plan objective from roadmap analyze]
```

</step>

<step name="route">
**Determine next action based on verified counts.**

**Step 1: Count plans, summaries, and issues in current phase**

List files in the current phase directory:

```bash
(ls -1 .planning/phases/[current-phase-dir]/*-PLAN.md 2>/dev/null || true) | wc -l
(ls -1 .planning/phases/[current-phase-dir]/*-SUMMARY.md 2>/dev/null || true) | wc -l
(ls -1 .planning/phases/[current-phase-dir]/*-UAT.md 2>/dev/null || true) | wc -l
```

State: "This phase has {X} plans, {Y} summaries."

**Step 1.5: Check for unaddressed UAT gaps**

Check for UAT.md files with status "diagnosed" (has gaps needing fixes).

```bash
# Check for diagnosed UAT with gaps or partial (incomplete) testing
grep -l "status: diagnosed\|status: partial" .planning/phases/[current-phase-dir]/*-UAT.md 2>/dev/null || true
```

Track:
- `uat_with_gaps`: UAT.md files with status "diagnosed" (gaps need fixing)
- `uat_partial`: UAT.md files with status "partial" (incomplete testing)

**Step 1.6: Cross-phase health check**

Scan ALL phases in the current milestone for outstanding verification debt using the CLI (which respects milestone boundaries via `getMilestonePhaseFilter`):

```bash
DEBT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" audit-uat --raw 2>/dev/null)
```

Parse JSON for `summary.total_items` and `summary.total_files`.

Track: `outstanding_debt` — `summary.total_items` from the audit.

**If outstanding_debt > 0:** Add a warning section to the progress report output (in the `report` step), placed between "## What's Next" and the route suggestion:

```markdown
## Verification Debt ({N} files across prior phases)

| Phase | File | Issue |
|-------|------|-------|
| {phase} | {filename} | {pending_count} pending, {skipped_count} skipped, {blocked_count} blocked |
| {phase} | {filename} | human_needed — {count} items |

Review: `/gsd-audit-uat ${GSD_WS}` — full cross-phase audit
Resume testing: `/gsd-verify-work {phase} ${GSD_WS}` — retest specific phase
```

This is a WARNING, not a blocker — routing proceeds normally. The debt is visible so the user can make an informed choice.

**Step 2: Route based on counts**

| Condition | Meaning | Action |
|-----------|---------|--------|
| uat_partial > 0 | UAT testing incomplete | Go to **Route E.2** |
| uat_with_gaps > 0 | UAT gaps need fix plans | Go to **Route E** |
| summaries < plans | Unexecuted plans exist | Go to **Route A** |
| summaries = plans AND plans > 0 | Phase complete | Go to Step 3 |
| plans = 0 | Phase not yet planned | Go to **Route B** |

---

**Route A: Unexecuted plan exists**

Find the first PLAN.md without matching SUMMARY.md.
Read its `<objective>` section.

```
---

## ▶ Next Up

**{phase}-{plan}: [Plan Name]** — [objective summary from PLAN.md]

`/clear` then:

`/gsd-execute-phase {phase} ${GSD_WS}`

---
```

---

**Route B: Phase needs planning**

Check if `{phase_num}-CONTEXT.md` exists in phase directory.

Check if current phase has UI indicators:

```bash
PHASE_SECTION=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "${CURRENT_PHASE}" 2>/dev/null)
PHASE_HAS_UI=$(echo "$PHASE_SECTION" | grep -qi "UI hint.*yes" && echo "true" || echo "false")
```

**If CONTEXT.md exists:**

```
---

## ▶ Next Up

**Phase {N}: {Name}** — {Goal from ROADMAP.md}
<sub>✓ Context gathered, ready to plan</sub>

`/clear` then:

`/gsd-plan-phase {phase-number} ${GSD_WS}`

---
```

**If CONTEXT.md does NOT exist AND phase has UI (`PHASE_HAS_UI` is `true`):**

```
---

## ▶ Next Up

**Phase {N}: {Name}** — {Goal from ROADMAP.md}

`/clear` then:

`/gsd-discuss-phase {phase}` — gather context and clarify approach

---

**Also available:**
- `/gsd-ui-phase {phase}` — generate UI design contract (recommended for frontend phases)
- `/gsd-plan-phase {phase}` — skip discussion, plan directly
- `/gsd-list-phase-assumptions {phase}` — see Claude's assumptions

---
```

**If CONTEXT.md does NOT exist AND phase has no UI:**

```
---

## ▶ Next Up

**Phase {N}: {Name}** — {Goal from ROADMAP.md}

`/clear` then:

`/gsd-discuss-phase {phase} ${GSD_WS}` — gather context and clarify approach

---

**Also available:**
- `/gsd-plan-phase {phase} ${GSD_WS}` — skip discussion, plan directly
- `/gsd-list-phase-assumptions {phase} ${GSD_WS}` — see Claude's assumptions

---
```

---

**Route E: UAT gaps need fix plans**

UAT.md exists with gaps (diagnosed issues). User needs to plan fixes.

```
---

## ⚠ UAT Gaps Found

**{phase_num}-UAT.md** has {N} gaps requiring fixes.

`/clear` then:

`/gsd-plan-phase {phase} --gaps ${GSD_WS}`

---

**Also available:**
- `/gsd-execute-phase {phase} ${GSD_WS}` — execute phase plans
- `/gsd-verify-work {phase} ${GSD_WS}` — run more UAT testing

---
```

---

**Route E.2: UAT testing incomplete (partial)**

UAT.md exists with `status: partial` — testing session ended before all items resolved.

```
---

## Incomplete UAT Testing

**{phase_num}-UAT.md** has {N} unresolved tests (pending, blocked, or skipped).

`/clear` then:

`/gsd-verify-work {phase} ${GSD_WS}` — resume testing from where you left off

---

**Also available:**
- `/gsd-audit-uat ${GSD_WS}` — full cross-phase UAT audit
- `/gsd-execute-phase {phase} ${GSD_WS}` — execute phase plans

---
```

---

**Step 3: Check milestone status (only when phase complete)**

Read ROADMAP.md and identify:
1. Current phase number
2. All phase numbers in the current milestone section

Count total phases and identify the highest phase number.

State: "Current phase is {X}. Milestone has {N} phases (highest: {Y})."

**Route based on milestone status:**

| Condition | Meaning | Action |
|-----------|---------|--------|
| current phase < highest phase | More phases remain | Go to **Route C** |
| current phase = highest phase | Milestone complete | Go to **Route D** |

---

**Route C: Phase complete, more phases remain**

Read ROADMAP.md to get the next phase's name and goal.

Check if next phase has UI indicators:

```bash
NEXT_PHASE_SECTION=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "$((Z+1))" 2>/dev/null)
NEXT_HAS_UI=$(echo "$NEXT_PHASE_SECTION" | grep -qi "UI hint.*yes" && echo "true" || echo "false")
```

**If next phase has UI (`NEXT_HAS_UI` is `true`):**

```
---

## ✓ Phase {Z} Complete

## ▶ Next Up

**Phase {Z+1}: {Name}** — {Goal from ROADMAP.md}

`/clear` then:

`/gsd-discuss-phase {Z+1}` — gather context and clarify approach

---

**Also available:**
- `/gsd-ui-phase {Z+1}` — generate UI design contract (recommended for frontend phases)
- `/gsd-plan-phase {Z+1}` — skip discussion, plan directly
- `/gsd-verify-work {Z}` — user acceptance test before continuing

---
```

**If next phase has no UI:**

```
---

## ✓ Phase {Z} Complete

## ▶ Next Up

**Phase {Z+1}: {Name}** — {Goal from ROADMAP.md}

`/clear` then:

`/gsd-discuss-phase {Z+1} ${GSD_WS}` — gather context and clarify approach

---

**Also available:**
- `/gsd-plan-phase {Z+1} ${GSD_WS}` — skip discussion, plan directly
- `/gsd-verify-work {Z} ${GSD_WS}` — user acceptance test before continuing

---
```

---

**Route D: Milestone complete**

```
---

## 🎉 Milestone Complete

All {N} phases finished!

## ▶ Next Up

**Complete Milestone** — archive and prepare for next

`/clear` then:

`/gsd-complete-milestone ${GSD_WS}`

---

**Also available:**
- `/gsd-verify-work ${GSD_WS}` — user acceptance test before completing milestone

---
```

---

**Route F: Between milestones (ROADMAP.md missing, PROJECT.md exists)**

A milestone was completed and archived. Ready to start the next milestone cycle.

Read MILESTONES.md to find the last completed milestone version.

```
---

## ✓ Milestone v{X.Y} Complete

Ready to plan the next milestone.

## ▶ Next Up

**Start Next Milestone** — questioning → research → requirements → roadmap

`/clear` then:

`/gsd-new-milestone ${GSD_WS}`

---
```

</step>

<step name="forensic_audit">
**Skip this entire step unless `FORENSIC=true`** (see `init_context`).

When invoked without `--forensic`, this step is a no-op and output is byte-for-byte identical to pre-flag behavior. When `--forensic` is present, append the audit below AFTER the standard report and routing suggestion have been printed.

Present:

```
---

## Forensic Integrity Audit

Running 6 deep checks against project state...
```

**Check 1 — STATE.md vs artifact completion**

Read STATE.md and extract:
- `stopped_at` field (frontmatter)
- `status` field (frontmatter)
- Session Continuity section → `Stopped at:` line

If ANY of these mention pending/awaiting/in-progress/blocked work BUT the standard progress report shows the current phase as "complete" or all phases done, flag:

```
⚠ Check 1 — STATE says work pending, artifacts say complete
  STATE.md stopped_at: "{stopped_at value}"
  STATE.md status: "{status value}"
  Artifact count: {X}/{Y} plans complete
  → The phase may have been marked complete prematurely
```

Otherwise:
```
✓ Check 1 — STATE.md consistent with artifact count
```

**Check 2 — Orphaned handoff files**

```bash
ls .planning/HANDOFF.json 2>/dev/null || true
ls .planning/phases/*/.continue-here.md 2>/dev/null || true
find .planning/phases/ -type f \( -iname "*handoff*" \) 2>/dev/null || true
```

For each found file, read the first 10 lines to extract context.

If ANY handoff files exist:
```
⚠ Check 2 — Orphaned handoff files found
  {path}: {first-line summary or "You are here" extract}
  → Work was paused mid-flight. Read the handoff before continuing.
```

Otherwise:
```
✓ Check 2 — No orphaned handoff files
```

**Check 3 — Deferred scope not in ROADMAP**

Scan phase artifacts for mentions of deferred future phases:

```bash
grep -rn "defer.*[Pp]hase\|future [Pp]hase\|[Pp]hase [0-9]\+\.[0-9]\+.*deferred\|[Pp]hase [0-9]\+\.[0-9]\+.*NOT.*scope\|out of.*scope.*[Pp]hase" \
  .planning/phases/*/*-BUG-BRIEF.md \
  .planning/phases/*/*-DISCUSSION-LOG.md \
  .planning/phases/*/*-CONTEXT.md \
  .planning/phases/*/*-HANDOFF.md \
  .planning/phases/*/*-VERIFICATION.md \
  .planning/phases/*/*-SUMMARY.md \
  2>/dev/null | head -30 || true
```

For each deferred phase number found, check if it exists in ROADMAP.md:

```bash
grep -c "Phase {deferred_phase_number}" .planning/ROADMAP.md 2>/dev/null || echo "0"
```

If any deferred phase is NOT in ROADMAP:
```
⚠ Check 3 — Deferred scope not captured in ROADMAP
  "{source_file}": mentions Phase {X} deferred — NOT in ROADMAP.md
  → Insert the phase via /gsd-insert-phase or /gsd-add-phase before it gets lost
```

Otherwise:
```
✓ Check 3 — All deferred scope captured in ROADMAP (or none found)
```

**Check 4 — Memory entries flagging pending work**

Read the memory index at the user's memory directory `MEMORY.md`. Identify entries whose title/description mentions: "pending", "status", "pause", "deferred", "NOT YET RUN", "needs", "backfill", "blocking", or current milestone phase numbers.

For each such entry, read the memory file and check if it describes work that is:
- Still pending (not completed)
- Contradicted by the artifact-based progress report
- Describing operational steps not captured as todos

If any memory entry flags unfinished work:
```
⚠ Check 4 — Memory entries indicate pending work
  {memory_file}: "{key finding from memory content}"
  → Verify this work is done or captured as a todo/phase
```

Otherwise:
```
✓ Check 4 — No memory entries flagging pending work
```

**Check 5 — Blocking operational todos**

```bash
ls .planning/todos/pending/ 2>/dev/null || true
```

Read each pending todo file. Flag any that describe:
- Scripts that need to be run (backfill, migration, seed)
- API keys or credentials to configure
- Manual verification steps
- External actions (managed service dashboards, third-party setup)

These are operational blockers that artifact counting can't detect.

If blocking operational todos exist:
```
⚠ Check 5 — Operational todos pending
  {todo_file}: "{description}"
  → These require human action before the phase/milestone is truly complete
```

Otherwise:
```
✓ Check 5 — No blocking operational todos
```

**Check 6 — Uncommitted changes suggesting unfinished work**

```bash
git status --short 2>/dev/null | head -20
git stash list 2>/dev/null | head -5
```

If there are uncommitted changes in source directories (`src/`, `scripts/`, etc.), not just `.planning/`:
```
⚠ Check 6 — Uncommitted code changes
  {file list}
  → May represent unfinished implementation work
```

Otherwise:
```
✓ Check 6 — Working tree clean (or planning-only changes)
```

**Verdict**

Count failures from checks 1–6.

If 0 failures:
```
---

### Verdict: CLEAN

All 6 forensic checks passed. The standard progress report is trustworthy.
Proceed with the routing suggestion above.
```

If 1+ failures:
```
---

### Verdict: {N} INTEGRITY ISSUE(S) FOUND

The standard progress report may not reflect true project state.
Review the flagged items above before proceeding with the routing suggestion.

**Suggested actions:**
- [list specific actions based on which checks failed]
```

Suggested-action mapping:
- Check 1 fail → "Read STATE.md `stopped_at` context and verify the current phase is actually complete"
- Check 2 fail → "Read the handoff file(s) and resume from where work was paused"
- Check 3 fail → "Insert deferred phases into ROADMAP via /gsd-insert-phase or /gsd-add-phase"
- Check 4 fail → "Verify memory-flagged work is done; update or delete stale memory entries"
- Check 5 fail → "Complete operational steps before marking phase/milestone as done"
- Check 6 fail → "Review uncommitted changes — commit, stash, or discard"
</step>

<step name="edge_cases">
**Handle edge cases:**

- Phase complete but next phase not planned → offer `/gsd-plan-phase [next] ${GSD_WS}`
- All work complete → offer milestone completion
- Blockers present → highlight before offering to continue
- Handoff file exists → mention it, offer `/gsd-resume-work ${GSD_WS}`
  </step>

</process>

<success_criteria>

- [ ] Rich context provided (recent work, decisions, issues)
- [ ] Current position clear with visual progress
- [ ] What's next clearly explained
- [ ] Smart routing: /gsd-execute-phase if plans exist, /gsd-plan-phase if not
- [ ] User confirms before any action
- [ ] Seamless handoff to appropriate gsd command
- [ ] Without `--forensic`, output is byte-for-byte unchanged from pre-flag behavior
- [ ] With `--forensic`, 6 integrity checks run after the standard report and produce a verdict (CLEAN or N ISSUE(S) FOUND)
      </success_criteria>
