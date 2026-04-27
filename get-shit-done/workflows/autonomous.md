<purpose>

Drive milestone phases autonomously — all remaining phases, a range via `--from N`/`--to N`, or a single phase via `--only N`. For each incomplete phase: discuss → plan → execute using Skill() flat invocations. Pauses only for explicit user decisions (grey area acceptance, blockers, validation requests). Re-reads ROADMAP.md after each phase to catch dynamically inserted phases.

</purpose>

<required_reading>

Read all files referenced by the invoking prompt's execution_context before starting.

</required_reading>

<process>

<step name="initialize" priority="first">

## 1. Initialize

Parse `$ARGUMENTS` for `--from N`, `--to N`, `--only N`, and `--interactive` flags:

```bash
FROM_PHASE=""
if echo "$ARGUMENTS" | grep -qE '\-\-from\s+[0-9]'; then
  FROM_PHASE=$(echo "$ARGUMENTS" | grep -oE '\-\-from\s+[0-9]+\.?[0-9]*' | awk '{print $2}')
fi

TO_PHASE=""
if echo "$ARGUMENTS" | grep -qE '\-\-to\s+[0-9]'; then
  TO_PHASE=$(echo "$ARGUMENTS" | grep -oE '\-\-to\s+[0-9]+\.?[0-9]*' | awk '{print $2}')
fi

ONLY_PHASE=""
if echo "$ARGUMENTS" | grep -qE '\-\-only\s+[0-9]'; then
  ONLY_PHASE=$(echo "$ARGUMENTS" | grep -oE '\-\-only\s+[0-9]+\.?[0-9]*' | awk '{print $2}')
  FROM_PHASE="$ONLY_PHASE"
fi

INTERACTIVE=""
if echo "$ARGUMENTS" | grep -q '\-\-interactive'; then
  INTERACTIVE="true"
fi
```

When `--only` is set, also set `FROM_PHASE` to the same value so existing filter logic applies.

When `--interactive` is set, discuss runs inline with questions (not auto-answered), while plan and execute are dispatched as background agents. This keeps the main context lean — only discuss conversations accumulate — while preserving user input on all design decisions.

Bootstrap via milestone-level init:

```bash
INIT=$(gsd-sdk query init.milestone-op)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `milestone_version`, `milestone_name`, `phase_count`, `completed_phases`, `roadmap_exists`, `state_exists`, `commit_docs`.

**If `roadmap_exists` is false:** Error — "No ROADMAP.md found. Run `/gsd-new-milestone` first."
**If `state_exists` is false:** Error — "No STATE.md found. Run `/gsd-new-milestone` first."

Display startup banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Milestone: {milestone_version} — {milestone_name}
 Phases: {phase_count} total, {completed_phases} complete
```

If `ONLY_PHASE` is set, display: `Single phase mode: Phase ${ONLY_PHASE}`
Else if `FROM_PHASE` is set, display: `Starting from phase ${FROM_PHASE}`
If `TO_PHASE` is set, display: `Stopping after phase ${TO_PHASE}`
If `INTERACTIVE` is set, display: `Mode: Interactive (discuss inline, plan+execute in background)`

</step>

<step name="discover_phases">

## 2. Discover Phases

Run phase discovery:

```bash
ROADMAP=$(gsd-sdk query roadmap.analyze)
```

Parse the JSON `phases` array.

**Filter to incomplete phases:** Keep only phases where `disk_status !== "complete"` OR `roadmap_complete === false`.

**Apply `--from N` filter:** If `FROM_PHASE` was provided, additionally filter out phases where `number < FROM_PHASE` (use numeric comparison — handles decimal phases like "5.1").

**Apply `--to N` filter:** If `TO_PHASE` was provided, additionally filter out phases where `number > TO_PHASE` (use numeric comparison). This limits execution to phases up through the target phase.

**Apply `--only N` filter:** If `ONLY_PHASE` was provided, additionally filter OUT phases where `number != ONLY_PHASE`. This means the phase list will contain exactly one phase (or zero if already complete).

**If `TO_PHASE` is set and no phases remain** (all phases up to N are already completed):

```
All phases through ${TO_PHASE} are already completed. Nothing to do.
```

Exit cleanly.

**If `ONLY_PHASE` is set and no phases remain** (phase already complete):

```
Phase ${ONLY_PHASE} is already complete. Nothing to do.
```

Exit cleanly.

**Sort by `number`** in numeric ascending order.

**If no incomplete phases remain:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ COMPLETE 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 All phases complete! Nothing left to do.
```

Exit cleanly.

**Display phase plan:**

```
## Phase Plan

| # | Phase | Status |
|---|-------|--------|
| 5 | Skill Scaffolding & Phase Discovery | In Progress |
| 6 | Smart Discuss | Not Started |
| 7 | Auto-Chain Refinements | Not Started |
| 8 | Lifecycle Orchestration | Not Started |
```

**Fetch details for each phase:**

```bash
DETAIL=$(gsd-sdk query roadmap.get-phase ${PHASE_NUM})
```

Extract `phase_name`, `goal`, `success_criteria` from each. Store for use in execute_phase and transition messages.

</step>

<step name="execute_phase">

## 3. Execute Phase

For the current phase, display the progress banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ Phase {N}/{T}: {Name} [████░░░░] {P}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Where N = current phase number (from the ROADMAP, e.g., 63), T = total milestone phases (from `phase_count` parsed in initialize step, e.g., 67). **Important:** T must be `phase_count` (the total number of phases in this milestone), NOT the count of remaining/incomplete phases. When phases are numbered 61-67, T=7 and the banner should read `Phase 63/7` (phase 63, 7 total in milestone), not `Phase 63/3` (which would confuse 3 remaining with 3 total). P = percentage of all milestone phases completed so far. Calculate P as: (number of phases with `disk_status` "complete" from the latest `roadmap analyze` / T × 100). Use █ for filled and ░ for empty segments in the progress bar (8 characters wide).

**Alternative display when phase numbers exceed total** (e.g., multi-milestone projects where phases are numbered globally): If N > T (phase number exceeds milestone phase count), use the format `Phase {N} ({position}/{T})` where `position` is the 1-based index of this phase among incomplete phases being processed. This prevents confusing displays like "Phase 63/5".

**3a. Smart Discuss**

Check if CONTEXT.md already exists for this phase:

```bash
PHASE_STATE=$(gsd-sdk query init.phase-op ${PHASE_NUM})
```

Parse `has_context` from JSON.

**If has_context is true:** Skip discuss — context already gathered. Display:

```
Phase ${PHASE_NUM}: Context exists — skipping discuss.
```

Proceed to 3b.

**If has_context is false:** Check if discuss is disabled via settings:

```bash
SKIP_DISCUSS=$(gsd-sdk query config-get workflow.skip_discuss 2>/dev/null || echo "false")
```

**If SKIP_DISCUSS is `true`:** Skip discuss entirely — the ROADMAP phase description is the spec. Display:

```
Phase ${PHASE_NUM}: Discuss skipped (workflow.skip_discuss=true) — using ROADMAP phase goal as spec.
```

Write a minimal CONTEXT.md so downstream plan-phase has valid input. Get phase details:

```bash
DETAIL=$(gsd-sdk query roadmap.get-phase ${PHASE_NUM})
```

Extract `goal` and `requirements` from JSON. Write `${phase_dir}/${padded_phase}-CONTEXT.md` with:

```markdown
# Phase {PHASE_NUM}: {Phase Name} - Context

**Gathered:** {date}
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

{goal from ROADMAP phase description}

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
```

Commit the minimal context:

```bash
gsd-sdk query commit "docs(${PADDED_PHASE}): auto-generated context (discuss skipped)" --files "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Proceed to 3b.

**If SKIP_DISCUSS is `false` (or unset):**

**IMPORTANT — Discuss must be single-pass in autonomous mode.**
The discuss step in `--auto` mode MUST NOT loop. If CONTEXT.md already exists after discuss completes, do NOT re-invoke discuss for the same phase. The `has_context` check below is authoritative — once true, discuss is done for this phase regardless of perceived "gaps" in the context file.

**If `INTERACTIVE` is set:** Run the standard discuss-phase skill inline (asks interactive questions, waits for user answers). This preserves user input on all design decisions while keeping plan+execute out of the main context:

```
Skill(skill="gsd:discuss-phase", args="${PHASE_NUM}")
```

**If `INTERACTIVE` is NOT set:** Execute the smart_discuss step for this phase (batch table proposals, auto-optimized).

After discuss completes (either mode), verify context was written:

```bash
PHASE_STATE=$(gsd-sdk query init.phase-op ${PHASE_NUM})
```

Check `has_context`. If false → go to handle_blocker: "Discuss for phase ${PHASE_NUM} did not produce CONTEXT.md."

**3a.5. UI Design Contract (Frontend Phases)**

Check if this phase has frontend indicators and whether a UI-SPEC already exists:

```bash
PHASE_SECTION=$(gsd-sdk query roadmap.get-phase ${PHASE_NUM} 2>/dev/null)
echo "$PHASE_SECTION" | grep -iE "UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget" > /dev/null 2>&1
HAS_UI=$?
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```

Check if UI phase workflow is enabled:

```bash
UI_PHASE_CFG=$(gsd-sdk query config-get workflow.ui_phase 2>/dev/null || echo "true")
```

**If `HAS_UI` is 0 (frontend indicators found) AND `UI_SPEC_FILE` is empty (no UI-SPEC exists) AND `UI_PHASE_CFG` is not `false`:**

Display:

```
Phase ${PHASE_NUM}: Frontend phase detected — generating UI design contract...
```

```
Skill(skill="gsd-ui-phase", args="${PHASE_NUM}")
```

Verify UI-SPEC was created:

```bash
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```

**If `UI_SPEC_FILE` is still empty after ui-phase:** Display warning `Phase ${PHASE_NUM}: UI-SPEC generation did not produce output — continuing without design contract.` and proceed to 3b.

**If `HAS_UI` is 1 (no frontend indicators) OR `UI_SPEC_FILE` is not empty (UI-SPEC already exists) OR `UI_PHASE_CFG` is `false`:** Skip silently to 3b.

**3b. Plan**

**If `INTERACTIVE` is set:** Dispatch plan as a background agent to keep the main context lean. While plan runs, the workflow can immediately start discussing the next phase (see step 4).

```
Agent(
  description="Plan phase ${PHASE_NUM}: ${PHASE_NAME}",
  run_in_background=true,
  prompt="Run plan-phase for phase ${PHASE_NUM}: Skill(skill=\"gsd:plan-phase\", args=\"${PHASE_NUM}\")"
)
```

Store the agent task_id. After discuss for the next phase completes (or if no next phase), wait for the plan agent to finish before proceeding to execute.

**If `INTERACTIVE` is NOT set (default):** Run plan inline as before.

```
Skill(skill="gsd-plan-phase", args="${PHASE_NUM}")
```

Verify plan produced output — re-run `init phase-op` and check `has_plans`. If false → go to handle_blocker: "Plan phase ${PHASE_NUM} did not produce any plans."

**3c. Execute**

**If `INTERACTIVE` is set:** Wait for the plan agent to complete (if not already), verify plans exist, then dispatch execute as a background agent:

```
Agent(
  description="Execute phase ${PHASE_NUM}: ${PHASE_NAME}",
  run_in_background=true,
  prompt="Run execute-phase for phase ${PHASE_NUM}: Skill(skill=\"gsd:execute-phase\", args=\"${PHASE_NUM} --no-transition\")"
)
```

Store the agent task_id. The workflow can now start discussing the next phase while this phase executes in the background. Before starting post-execution routing for this phase, wait for the execute agent to complete.

**If `INTERACTIVE` is NOT set (default):** Run execute inline as before.

```
Skill(skill="gsd-execute-phase", args="${PHASE_NUM} --no-transition")
```

**3c.5. Code Review and Fix**

Auto-invoke code review and fix chain. Autonomous mode chains both review and fix (unlike execute-phase/quick which only suggest fix).

**Config gate:**
```bash
CODE_REVIEW_ENABLED=$(gsd-sdk query config-get workflow.code_review 2>/dev/null || echo "true")
```
If `"false"`: display "Code review skipped (workflow.code_review=false)" and proceed to 3d.

```
Skill(skill="gsd:code-review", args="${PHASE_NUM}")
```

Parse status from REVIEW.md frontmatter. If "clean" or "skipped": proceed to 3d. If findings found: auto-invoke:
```
Skill(skill="gsd:code-review-fix", args="${PHASE_NUM} --auto")
```

**Error handling:** If either Skill fails, catch the error, display as non-blocking, and proceed to 3d.

**3d. Post-Execution Routing**

**If `INTERACTIVE` is set:** Wait for the execute agent to complete before reading verification results.

After execute-phase returns (or the execute agent completes), read the verification result:

```bash
VERIFY_STATUS=$(grep "^status:" "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

Where `PHASE_DIR` comes from the `init phase-op` call already made in step 3a. If the variable is not in scope, re-fetch:

```bash
PHASE_STATE=$(gsd-sdk query init.phase-op ${PHASE_NUM})
```

Parse `phase_dir` from the JSON.

**If VERIFY_STATUS is empty** (no VERIFICATION.md or no status field):

Go to handle_blocker: "Execute phase ${PHASE_NUM} did not produce verification results."

**If `passed`:**

Display:
```
Phase ${PHASE_NUM} ✅ ${PHASE_NAME} — Verification passed
```

Proceed to iterate step.

**If `human_needed`:**

Read the human_verification section from VERIFICATION.md to get the count and items requiring manual testing.


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.
Display the items, then ask user via AskUserQuestion:
- **question:** "Phase ${PHASE_NUM} has items needing manual verification. Validate now or continue to next phase?"
- **options:** "Validate now" / "Continue without validation"

On **"Validate now"**: Present the specific items from VERIFICATION.md's human_verification section. After user reviews, ask:
- **question:** "Validation result?"
- **options:** "All good — continue" / "Found issues"

On "All good — continue": Display `Phase ${PHASE_NUM} ✅ Human validation passed` and proceed to iterate step.

On "Found issues": Go to handle_blocker with the user's reported issues as the description.

On **"Continue without validation"**: Display `Phase ${PHASE_NUM} ⏭ Human validation deferred` and proceed to iterate step.

**If `gaps_found`:**

Read gap summary from VERIFICATION.md (score and missing items). Display:
```
⚠ Phase ${PHASE_NUM}: ${PHASE_NAME} — Gaps Found
Score: {N}/{M} must-haves verified
```

Ask user via AskUserQuestion:
- **question:** "Gaps found in phase ${PHASE_NUM}. How to proceed?"
- **options:** "Run gap closure" / "Continue without fixing" / "Stop autonomous mode"

On **"Run gap closure"**: Execute gap closure cycle (limit: 1 attempt):

```
Skill(skill="gsd-plan-phase", args="${PHASE_NUM} --gaps")
```

Verify gap plans were created — re-run `init phase-op ${PHASE_NUM}` and check `has_plans`. If no new gap plans → go to handle_blocker: "Gap closure planning for phase ${PHASE_NUM} did not produce plans."

Re-execute:
```
Skill(skill="gsd-execute-phase", args="${PHASE_NUM} --no-transition")
```

Re-read verification status:
```bash
VERIFY_STATUS=$(grep "^status:" "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

If `passed` or `human_needed`: Route normally (continue or ask user as above).

If still `gaps_found` after this retry: Display "Gaps persist after closure attempt." and ask via AskUserQuestion:
- **question:** "Gap closure did not fully resolve issues. How to proceed?"
- **options:** "Continue anyway" / "Stop autonomous mode"

On "Continue anyway": Proceed to iterate step.
On "Stop autonomous mode": Go to handle_blocker.

This limits gap closure to 1 automatic retry to prevent infinite loops.

On **"Continue without fixing"**: Display `Phase ${PHASE_NUM} ⏭ Gaps deferred` and proceed to iterate step.

On **"Stop autonomous mode"**: Go to handle_blocker with "User stopped — gaps remain in phase ${PHASE_NUM}".

**3d.5. UI Review (Frontend Phases)**

> Run after any successful execution routing (passed, human_needed accepted, or gaps deferred/accepted) — before proceeding to the iterate step.

Check if this phase had a UI-SPEC (created in step 3a.5 or pre-existing):

```bash
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```

Check if UI review is enabled:

```bash
UI_REVIEW_CFG=$(gsd-sdk query config-get workflow.ui_review 2>/dev/null || echo "true")
```

**If `UI_SPEC_FILE` is not empty AND `UI_REVIEW_CFG` is not `false`:**

Display:

```
Phase ${PHASE_NUM}: Frontend phase with UI-SPEC — running UI review audit...
```

```
Skill(skill="gsd-ui-review", args="${PHASE_NUM}")
```

Display the review result summary (score from UI-REVIEW.md if produced). Continue to iterate step regardless of score — UI review is advisory, not blocking.

**If `UI_SPEC_FILE` is empty OR `UI_REVIEW_CFG` is `false`:** Skip silently to iterate step.

</step>

<step name="smart_discuss">

## Smart Discuss

> Full instructions are in `get-shit-done/references/autonomous-smart-discuss.md`. Read that file now and follow it exactly.

Smart discuss is an autonomous-optimized variant of `gsd-discuss-phase`. It proposes grey area answers in batch tables — the user accepts or overrides per area — and writes an identical CONTEXT.md to what discuss-phase produces.

**Inputs:** `PHASE_NUM` from execute_phase.

Read and execute: `$HOME/.claude/get-shit-done/references/autonomous-smart-discuss.md`

</step>

<step name="iterate">

## 4. Iterate

**If `ONLY_PHASE` is set:** Do not iterate. Proceed directly to lifecycle step (which exits cleanly per single-phase mode).

**If `TO_PHASE` is set and current phase number >= `TO_PHASE`:** The target phase has been reached. Do not iterate further. Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ --to ${TO_PHASE} REACHED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Completed through phase ${TO_PHASE} as requested.
 Remaining phases were not executed.

 Resume with: /gsd-autonomous --from ${next_incomplete_phase}
```

Proceed directly to lifecycle step (which handles partial completion — skips audit/complete/cleanup since not all phases are done). Exit cleanly.

**Otherwise:** After each phase completes, re-read ROADMAP.md to catch phases inserted mid-execution (decimal phases like 5.1):

```bash
ROADMAP=$(gsd-sdk query roadmap.analyze)
```

Re-filter incomplete phases using the same logic as discover_phases:
- Keep phases where `disk_status !== "complete"` OR `roadmap_complete === false`
- Apply `--from N` filter if originally provided
- Apply `--to N` filter if originally provided
- Sort by number ascending

Read STATE.md fresh:

```bash
cat .planning/STATE.md
```

Check for blockers in the Blockers/Concerns section. If blockers are found, go to handle_blocker with the blocker description.

If incomplete phases remain: proceed to next phase, loop back to execute_phase.

**Interactive mode overlap:** When `INTERACTIVE` is set, the iterate step enables pipeline parallelism:
1. After discuss completes for Phase N, dispatch plan+execute as background agents
2. Immediately start discuss for Phase N+1 (the next incomplete phase) while Phase N builds
3. Before starting plan for Phase N+1, wait for Phase N's execute agent to complete and handle its post-execution routing (verification, gap closure, etc.)

This means the user is always answering discuss questions (lightweight, interactive) while the heavy work (planning, code generation) runs in the background. The main context only accumulates discuss conversations — plan and execute contexts are isolated in their agents.

If all phases complete, proceed to lifecycle step.

</step>

<step name="lifecycle">

## 5. Lifecycle

**If `ONLY_PHASE` is set:** Skip lifecycle. A single phase does not trigger audit/complete/cleanup. Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ PHASE ${ONLY_PHASE} COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Phase ${ONLY_PHASE}: ${PHASE_NAME} — Done
 Mode: Single phase (--only)

 Lifecycle skipped — run /gsd-autonomous without --only
 after all phases complete to trigger audit/complete/cleanup.
```

Exit cleanly.

**Otherwise:** After all phases complete, run the milestone lifecycle sequence: audit → complete → cleanup.

Display lifecycle transition banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ LIFECYCLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 All phases complete → Starting lifecycle: audit → complete → cleanup
 Milestone: {milestone_version} — {milestone_name}
```

**5a. Audit**

```
Skill(skill="gsd-audit-milestone")
```

After audit completes, detect the result:

```bash
AUDIT_FILE=".planning/v${milestone_version}-MILESTONE-AUDIT.md"
AUDIT_STATUS=$(grep "^status:" "${AUDIT_FILE}" 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

**If AUDIT_STATUS is empty** (no audit file or no status field):

Go to handle_blocker: "Audit did not produce results — audit file missing or malformed."

**If `passed`:**

Display:
```
Audit ✅ passed — proceeding to complete milestone
```

Proceed to 5b (no user pause — per CTRL-01).

**If `gaps_found`:**

Read the gaps summary from the audit file. Display:
```
⚠ Audit: Gaps Found
```

Ask user via AskUserQuestion:
- **question:** "Milestone audit found gaps. How to proceed?"
- **options:** "Continue anyway — accept gaps" / "Stop — fix gaps manually"

On **"Continue anyway"**: Display `Audit ⏭ Gaps accepted — proceeding to complete milestone` and proceed to 5b.

On **"Stop"**: Go to handle_blocker with "User stopped — audit gaps remain. Run /gsd-audit-milestone to review, then /gsd-complete-milestone when ready."

**If `tech_debt`:**

Read the tech debt summary from the audit file. Display:
```
⚠ Audit: Tech Debt Identified
```

Show the summary, then ask user via AskUserQuestion:
- **question:** "Milestone audit found tech debt. How to proceed?"
- **options:** "Continue with tech debt" / "Stop — address debt first"

On **"Continue with tech debt"**: Display `Audit ⏭ Tech debt acknowledged — proceeding to complete milestone` and proceed to 5b.

On **"Stop"**: Go to handle_blocker with "User stopped — tech debt to address. Run /gsd-audit-milestone to review details."

**5b. Complete Milestone**

```
Skill(skill="gsd-complete-milestone", args="${milestone_version}")
```

After complete-milestone returns, verify it produced output:

```bash
ls .planning/milestones/v${milestone_version}-ROADMAP.md 2>/dev/null || true
```

If the archive file does not exist, go to handle_blocker: "Complete milestone did not produce expected archive files."

**5c. Cleanup**

```
Skill(skill="gsd-cleanup")
```

Cleanup shows its own dry-run and asks user for approval internally — this is an acceptable pause per CTRL-01 since it's an explicit decision about file deletion.

**5d. Final Completion**

Display final completion banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ COMPLETE 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Milestone: {milestone_version} — {milestone_name}
 Status: Complete ✅
 Lifecycle: audit ✅ → complete ✅ → cleanup ✅

 Ship it! 🚀
```

</step>

<step name="handle_blocker">

## 6. Handle Blocker

When any phase operation fails or a blocker is detected, present 3 options via AskUserQuestion:

**Prompt:** "Phase {N} ({Name}) encountered an issue: {description}"

**Options:**
1. **"Fix and retry"** — Re-run the failed step (discuss, plan, or execute) for this phase
2. **"Skip this phase"** — Mark phase as skipped, continue to the next incomplete phase
3. **"Stop autonomous mode"** — Display summary of progress so far and exit cleanly

**On "Fix and retry":** Loop back to the failed step within execute_phase. If the same step fails again after retry, re-present these options.

**On "Skip this phase":** Log `Phase {N} ⏭ {Name} — Skipped by user` and proceed to iterate.

**On "Stop autonomous mode":** Display progress summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ STOPPED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Completed: {list of completed phases}
 Skipped: {list of skipped phases}
 Remaining: {list of remaining phases}

 Resume with: /gsd-autonomous ${ONLY_PHASE ? "--only " + ONLY_PHASE : "--from " + next_phase}${TO_PHASE ? " --to " + TO_PHASE : ""}
```

</step>

</process>

<success_criteria>
- [ ] All incomplete phases executed in order (smart discuss → ui-phase → plan → execute → ui-review each)
- [ ] Smart discuss proposes grey area answers in tables, user accepts or overrides per area
- [ ] Progress banners displayed between phases
- [ ] Execute-phase invoked with --no-transition (autonomous manages transitions)
- [ ] Post-execution verification reads VERIFICATION.md and routes on status
- [ ] Passed verification → automatic continue to next phase
- [ ] Human-needed verification → user prompted to validate or skip
- [ ] Gaps-found → user offered gap closure, continue, or stop
- [ ] Gap closure limited to 1 retry (prevents infinite loops)
- [ ] Plan-phase and execute-phase failures route to handle_blocker
- [ ] ROADMAP.md re-read after each phase (catches inserted phases)
- [ ] STATE.md checked for blockers before each phase
- [ ] Blockers handled via user choice (retry / skip / stop)
- [ ] Final completion or stop summary displayed
- [ ] After all phases complete, lifecycle step is invoked (not manual suggestion)
- [ ] Lifecycle transition banner displayed before audit
- [ ] Audit invoked via Skill(skill="gsd-audit-milestone")
- [ ] Audit result routing: passed → auto-continue, gaps_found → user decides, tech_debt → user decides
- [ ] Audit technical failure (no file/no status) routes to handle_blocker
- [ ] Complete-milestone invoked via Skill() with ${milestone_version} arg
- [ ] Cleanup invoked via Skill() — internal confirmation is acceptable (CTRL-01)
- [ ] Final completion banner displayed after lifecycle
- [ ] Progress bar uses phase number / total milestone phases (not position among incomplete), with fallback display when phase numbers exceed total
- [ ] Smart discuss documents relationship to discuss-phase with CTRL-03 note
- [ ] Frontend phases get UI-SPEC generated before planning (step 3a.5) if not already present
- [ ] Frontend phases get UI review audit after successful execution (step 3d.5) if UI-SPEC exists
- [ ] UI phase and UI review respect workflow.ui_phase and workflow.ui_review config toggles
- [ ] UI review is advisory (non-blocking) — phase proceeds to iterate regardless of score
- [ ] `--only N` restricts execution to exactly one phase
- [ ] `--only N` skips lifecycle step (audit/complete/cleanup)
- [ ] `--only N` exits cleanly after single phase completes
- [ ] `--only N` on already-complete phase exits with message
- [ ] `--only N` handle_blocker resume message uses --only flag
- [ ] `--to N` stops execution after phase N completes (halts at iterate step)
- [ ] `--to N` filters out phases with number > N during discovery
- [ ] `--to N` displays "Stopping after phase N" in startup banner
- [ ] `--to N` on already completed target exits with "already completed" message
- [ ] `--to N` compatible with `--from N` (run phases from M to N)
- [ ] `--to N` handle_blocker resume message preserves --to flag
- [ ] `--to N` skips lifecycle when not all milestone phases complete
- [ ] `--interactive` runs discuss inline via gsd:discuss-phase (asks questions, waits for user)
- [ ] `--interactive` dispatches plan and execute as background agents (context isolation)
- [ ] `--interactive` enables pipeline parallelism: discuss Phase N+1 while Phase N builds
- [ ] `--interactive` main context only accumulates discuss conversations (lean)
- [ ] `--interactive` waits for background agents before post-execution routing
- [ ] `--interactive` compatible with `--only`, `--from`, and `--to` flags
</success_criteria>
