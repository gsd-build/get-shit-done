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
INIT=$(gsd-sdk query init.progress)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract from init JSON: `project_exists`, `roadmap_exists`, `state_exists`, `phases`, `current_phase`, `next_phase`, `milestone_version`, `completed_count`, `phase_count`, `paused_at`, `state_path`, `roadmap_path`, `project_path`, `config_path`.

```bash
DISCUSS_MODE=$(gsd-sdk query config-get workflow.discuss_mode 2>/dev/null || echo "discuss")
```

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
**Use structured extraction from `gsd-sdk query` (or legacy gsd-tools.cjs):**

Instead of reading full files, use targeted tools to get only the data needed for the report:
- `ROADMAP=$(gsd-sdk query roadmap.analyze)`
- `STATE=$(gsd-sdk query state-snapshot)`

This minimizes orchestrator context usage.
</step>

<step name="analyze_roadmap">
**Get comprehensive roadmap analysis (replaces manual parsing):**

```bash
ROADMAP=$(gsd-sdk query roadmap.analyze)
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
  gsd-sdk query summary-extract <path> --fields one_liner
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
**Generate progress bar from `gsd-sdk query progress` / `progress.json`, then present rich status report:**

```bash
# Get formatted progress bar
PROGRESS_BAR=$(gsd-sdk query progress.bar --raw)
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
DEBT=$(gsd-sdk query audit-uat --raw 2>/dev/null)
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

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

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
PHASE_SECTION=$(gsd-sdk query roadmap.get-phase "${CURRENT_PHASE}" 2>/dev/null)
PHASE_HAS_UI=$(echo "$PHASE_SECTION" | grep -qi "UI hint.*yes" && echo "true" || echo "false")
```

**If CONTEXT.md exists:**

```
---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase {N}: {Name}** — {Goal from ROADMAP.md}
<sub>✓ Context gathered, ready to plan</sub>

`/clear` then:

`/gsd-plan-phase {phase-number} ${GSD_WS}`

---
```

**If CONTEXT.md does NOT exist AND phase has UI (`PHASE_HAS_UI` is `true`):**

```
---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

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

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

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
NEXT_PHASE_SECTION=$(gsd-sdk query roadmap.get-phase "$((Z+1))" 2>/dev/null)
NEXT_HAS_UI=$(echo "$NEXT_PHASE_SECTION" | grep -qi "UI hint.*yes" && echo "true" || echo "false")
```

**If next phase has UI (`NEXT_HAS_UI` is `true`):**

```
---

## ✓ Phase {Z} Complete

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

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

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

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

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

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

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Start Next Milestone** — questioning → research → requirements → roadmap

`/clear` then:

`/gsd-new-milestone ${GSD_WS}`

---
```

</step>

<step name="edge_cases">
**Handle edge cases:**

- Phase complete but next phase not planned → offer `/gsd-plan-phase [next] ${GSD_WS}`
- All work complete → offer milestone completion
- Blockers present → highlight before offering to continue
- Handoff file exists → mention it, offer `/gsd-resume-work ${GSD_WS}`
</step>

<step name="forensic_audit">
**Forensic Integrity Audit** — only runs when `--forensic` is present in ARGUMENTS.

If `--forensic` is NOT present in ARGUMENTS: skip this step entirely. Default progress behavior (standard report + routing) is unchanged.

If `--forensic` IS present: after the standard report and routing suggestion have been displayed, append the following audit section.

---

## Forensic Integrity Audit

Running 6 deep checks against project state...

Run each check in order. For each check, emit ✓ (pass) or ⚠ (warning) with concrete evidence when a problem is found.

**Check 1 — STATE vs artifact consistency**

Read STATE.md `status` / `stopped_at` fields (from the STATE snapshot already loaded). Compare against the artifact count from the roadmap analysis. If STATE.md claims the current phase is pending/mid-flight but the artifact count shows it as complete (all PLAN.md files have matching SUMMARY.md files), flag inconsistency. Emit:
- ✓ `STATE.md consistent with artifact count` — if both agree
- ⚠ `STATE.md claims [status] but artifact count shows phase complete` — with the specific values

**Check 2 — Orphaned handoff files**

Check for existence of:
```bash
ls .planning/HANDOFF.json .planning/phases/*/.continue-here.md .planning/phases/*/*HANDOFF*.md 2>/dev/null || true
```
Also check `.planning/continue-here.md`.

Emit:
- ✓ `No orphaned handoff files` — if none found
- ⚠ `Orphaned handoff files found` — list each file path, add: `→ Work was paused mid-flight. Read the handoff before continuing.`

**Check 3 — Deferred scope drift**

Search phase artifacts (CONTEXT.md, DISCUSSION-LOG.md, BUG-BRIEF.md, VERIFICATION.md, SUMMARY.md, HANDOFF.md files under `.planning/phases/`) for patterns:
```bash
grep -rl "defer to Phase\|future phase\|out of scope Phase\|deferred to Phase" .planning/phases/ 2>/dev/null || true
```

For each match, extract the referenced phase number. Cross-reference against ROADMAP.md phase list. If the referenced phase number is NOT in ROADMAP.md, flag as deferred scope not captured.

Emit:
- ✓ `All deferred scope captured in ROADMAP` — if no mismatches
- ⚠ `Deferred scope references phase(s) not in ROADMAP` — list: file, reference text, missing phase number

**Check 4 — Memory-flagged pending work**

Check if `.planning/MEMORY.md` or `.planning/memory/` exists:
```bash
ls .planning/MEMORY.md .planning/memory/*.md 2>/dev/null || true
```

If found, grep for entries containing: `pending`, `status`, `deferred`, `not yet run`, `backfill`, `blocking`.

Emit:
- ✓ `No memory entries flagging pending work` — if none found or no MEMORY.md
- ⚠ `Memory entries flag pending/deferred work` — list the matching lines (max 5, truncated at 80 chars)

**Check 5 — Blocking operational todos**

Check for pending todos:
```bash
ls .planning/todos/pending/*.md 2>/dev/null || true
```

For files found, scan for keywords indicating operational blockers: `script`, `credential`, `API key`, `manual`, `verification`, `setup`, `configure`, `run `.

Emit:
- ✓ `No blocking operational todos` — if no pending todos or none match operational keywords
- ⚠ `Blocking operational todos found` — list the file names and matching keywords (max 5)

**Check 6 — Uncommitted code**

```bash
git status --porcelain 2>/dev/null | grep -v "^??" | grep -v "^.planning\/" | grep -v "^\.\." | head -10
```

If output is non-empty (modified/staged files outside `.planning/`), flag as uncommitted code.

Emit:
- ✓ `Working tree clean` — if no modified files outside `.planning/`
- ⚠ `Uncommitted changes in source files` — list up to 10 file paths

---

After all 6 checks, display the verdict:

**If all 6 checks passed:**
```
### Verdict: CLEAN

The standard progress report is trustworthy — proceed with the routing suggestion above.
```

**If 1 or more checks failed:**
```
### Verdict: N INTEGRITY ISSUE(S) FOUND

The standard progress report may not reflect true project state.
Review the flagged items above before acting on the routing suggestion.
```

Then for each failed check, add a concrete next action:
- Check 2 (orphaned handoff): `Read the handoff file(s) and resume from where work was paused: /gsd-resume-work ${GSD_WS}`
- Check 3 (deferred scope): `Add the missing phases to ROADMAP.md or update the deferred references`
- Check 4 (memory pending): `Review the flagged memory entries and resolve or clear them`
- Check 5 (blocking todos): `Complete the operational steps in .planning/todos/pending/ before continuing`
- Check 6 (uncommitted code): `Commit or stash the uncommitted changes before advancing`
- Check 1 (STATE inconsistency): `Run /gsd-verify-work ${PHASE} ${GSD_WS} to reconcile state`
</step>

</process>

<success_criteria>

- [ ] Rich context provided (recent work, decisions, issues)
- [ ] Current position clear with visual progress
- [ ] What's next clearly explained
- [ ] Smart routing: /gsd-execute-phase if plans exist, /gsd-plan-phase if not
- [ ] User confirms before any action
- [ ] Seamless handoff to appropriate gsd command
      </success_criteria>
