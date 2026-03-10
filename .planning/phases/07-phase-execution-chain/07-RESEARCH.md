# Phase 7: Phase Execution Chain - Research

**Researched:** 2026-03-10
**Domain:** Workflow orchestration — auto-chaining discuss→plan→execute within autonomous.md
**Confidence:** HIGH

## Summary

Phase 7 modifies the `execute_phase` step (step 3) in `get-shit-done/workflows/autonomous.md` to implement proper auto-chaining of plan-phase and execute-phase with correct flags, post-execution validation routing, and error recovery. The current code (lines 107-175) has three issues: (1) plan-phase is invoked without flags but also without post-invocation failure detection, (2) execute-phase is invoked without `--no-transition` so it may chain to transition.md internally, and (3) after execute-phase there is no validation routing — just a simple transition message.

The fix is surgical: enhance steps 3b, 3c, and 3d within the existing `execute_phase` step. No new steps are created. No other workflow files are modified. The execute-phase workflow already supports `--no-transition` (line 392-394) and already produces VERIFICATION.md with `passed|human_needed|gaps_found` status (lines 302-362). The autonomous workflow just needs to use these existing capabilities and route on the result.

**Primary recommendation:** Modify autonomous.md steps 3b→3c→3d to add `--no-transition` flag to execute-phase, read VERIFICATION.md after execution, and route on the three status values with AskUserQuestion for human_needed and gaps_found cases. Keep plan-phase invocation as-is (no flags) but add failure detection. Route all failures to existing handle_blocker.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Invocation Flags
- **plan-phase**: No `--auto` flag — without it, plan-phase plans and returns control to autonomous. With `--auto` it would chain to execute-phase internally, causing double execution
- **execute-phase**: Use `--no-transition` flag — prevents execute-phase from chaining to the next phase via transition.md. Autonomous manages all phase-to-phase transitions
- **No `Skill` needed in allowed-tools** — `Skill()` is a workflow-level construct, not a tool. Other commands (discuss-phase, plan-phase) use it without listing in allowed-tools
- **No custom `--autonomous` flag** — plan-phase and execute-phase function normally; autonomous controls flow externally

#### Post-Execution Validation (EXEC-03)
- **execute-phase handles its own verification** via its built-in gsd-verifier. Autonomous reads the result. No duplication
- **`passed`**: Continue to next phase automatically — verification passed, no human input needed
- **`human_needed`**: Ask user — "Hay N items que requieren testing manual. ¿Validar ahora o continuar?" If user continues, log and proceed
- **`gaps_found`**: Offer gap closure via AskUserQuestion — "Se encontraron gaps. ¿Ejecutar gap closure, continuar sin gaps, o detener?" If gap closure: `Skill(plan-phase --gaps)` → re-execute
- Detection method: Read `{phase_dir}/*-VERIFICATION.md` after execute-phase, parse `status:` from frontmatter

#### Interaction Surfacing & Error Recovery (EXEC-04)
- **No interception needed** — when plan-phase spawns researcher/planner that use AskUserQuestion, questions reach the user naturally through Skill() invocations
- **Plan-phase failure**: Go to handle_blocker — verify `has_plans` post-Skill, if false → blocker
- **Execute-phase failure**: Go to handle_blocker — execute-phase handles waves internally; if it fails, returns and autonomous detects
- **Partial failures**: Autonomous doesn't retry individual waves — execute-phase manages that internally

### Claude's Discretion
- Exact wording of validation prompts to user
- How to parse VERIFICATION.md frontmatter (grep vs read + parse)
- Whether to display verification summary before asking validation question
- Error detection heuristics for plan/execute failures

### Deferred Ideas (OUT OF SCOPE)
- Custom `--autonomous` flag for plan/execute skills (unnecessary — external control works)
- Automatic retry before blocker escalation (adds complexity, current handle_blocker UX is sufficient)
- Wave-level retry on partial execute-phase failures (execute-phase handles this internally)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXEC-01 | After discuss completes, system automatically invokes plan-phase for the current phase | Step 3b already does this via `Skill(skill="gsd:plan-phase", args="${PHASE_NUM}")`. Enhancement: add has_plans failure detection post-Skill. |
| EXEC-02 | After plan completes, system automatically invokes execute-phase for the current phase | Step 3c needs `--no-transition` flag added to Skill call. Enhancement: read VERIFICATION.md and route on status. |
| EXEC-03 | If validation is needed after execution, system asks user; otherwise continues to next phase | New step 3d logic: read VERIFICATION.md status, route passed→continue, human_needed→AskUserQuestion, gaps_found→AskUserQuestion with gap closure option. |
| EXEC-04 | System handles plan-phase interactions (research questions, plan approval) by asking user directly | No code change needed — Skill() invocations naturally surface AskUserQuestion to user. Add error recovery routing to handle_blocker. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| autonomous.md | Current | The single file being modified | All changes are confined to this workflow file |
| gsd-tools.cjs | Current | CLI tooling for init, phase-op, commit | Already used throughout autonomous.md |

### Supporting (Reference Only — NOT Modified)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| execute-phase.md | Current | Reference for `--no-transition` behavior and VERIFICATION.md output | Understanding return format and flag parsing |
| plan-phase.md | Current | Reference for no-flag behavior (plans and returns) | Understanding that NO `--auto` flag is needed |
| verification-report.md template | Current | VERIFICATION.md frontmatter format with `status:` field | Understanding how to parse verification results |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `--no-transition` on execute-phase | Custom `--autonomous` flag | Unnecessary — `--no-transition` already exists and does exactly what's needed |
| Reading VERIFICATION.md manually | Having execute-phase return status in structured text | Would require modifying execute-phase.md (out of scope — we only modify autonomous.md) |
| `--auto` on plan-phase | No flag on plan-phase | `--auto` causes plan-phase to chain to execute-phase internally, causing double execution. No flag is correct. |

## Architecture Patterns

### Modified File
```
get-shit-done/workflows/autonomous.md
└── <step name="execute_phase">   ← Lines 107-175, the ONLY section modified
    ├── 3a. Smart Discuss          ← UNCHANGED (already implemented in Phase 6)
    ├── 3b. Plan                   ← ENHANCED: add has_plans failure check → handle_blocker
    ├── 3c. Execute                ← ENHANCED: add --no-transition flag
    └── 3d. Post-Execution         ← REWRITTEN: replace simple transition with validation routing
```

### Pattern 1: Flag-Based Flow Control
**What:** Use `--no-transition` to prevent execute-phase from chaining to transition.md, keeping autonomous in control of phase-to-phase transitions.
**When to use:** Whenever autonomous calls execute-phase — autonomous owns the outer loop.
**Example:**
```
Skill(skill="gsd:execute-phase", args="${PHASE_NUM} --no-transition")
```
The `--no-transition` flag is parsed at execute-phase.md line 392. When present, execute-phase returns a `## PHASE COMPLETE` structured response (lines 399-407) instead of running transition.md or auto-advancing. This is the same flag used by plan-phase's auto-advance chain (line 480).

### Pattern 2: Post-Skill Artifact Verification
**What:** After a Skill() call, verify expected artifacts exist before proceeding.
**When to use:** After plan-phase (check has_plans) and after execute-phase (check VERIFICATION.md).
**Example:**
```bash
# After plan-phase
PHASE_STATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op ${PHASE_NUM})
# Parse has_plans from JSON — if false → handle_blocker
```
This pattern is already used in step 3a (checking has_context after smart_discuss). Steps 3b and 3c need the same pattern.

### Pattern 3: VERIFICATION.md Status Routing
**What:** Read the status from VERIFICATION.md frontmatter and branch on three values.
**When to use:** After execute-phase completes (step 3d).
**How:** The VERIFICATION.md file uses YAML frontmatter with a `status:` field. Parse with grep:
```bash
VERIFY_STATUS=$(grep "^status:" "${PHASE_DIR}"/*-VERIFICATION.md | head -1 | cut -d: -f2 | tr -d ' ')
```
Then route:
- `passed` → continue to iterate (next phase)
- `human_needed` → AskUserQuestion with validate/continue options
- `gaps_found` → AskUserQuestion with gap-closure/continue/stop options

### Pattern 4: AskUserQuestion for Decision Points
**What:** Use AskUserQuestion (the same mechanism used in smart_discuss) to surface validation decisions to the user.
**When to use:** For human_needed and gaps_found verification outcomes.
**Format established by smart_discuss (lines 334-337):**
- **header**: Short context label
- **question**: What we're asking
- **options**: 2-4 concrete choices (AskUserQuestion adds "Other" automatically)

### Pattern 5: Gap Closure Cycle Within Autonomous
**What:** When gaps_found and user chooses gap closure, chain plan-phase --gaps → execute-phase --no-transition → re-read VERIFICATION.md.
**When to use:** Only when user explicitly chooses "Execute gap closure" in the gaps_found AskUserQuestion.
**Flow:**
```
1. Skill(skill="gsd:plan-phase", args="${PHASE_NUM} --gaps")
2. Verify has_plans (gap plans created)
3. Skill(skill="gsd:execute-phase", args="${PHASE_NUM} --gaps-only --no-transition")
4. Re-read VERIFICATION.md status
5. Route again on the three outcomes
```
Note: execute-phase's `--gaps-only` flag (line 66) filters to only gap_closure plans.

### Anti-Patterns to Avoid
- **Using `--auto` on plan-phase:** Causes plan-phase to internally chain to execute-phase, creating double execution. Plan-phase without `--auto` plans and returns control to autonomous.
- **Duplicating verification logic:** Execute-phase already runs its own verifier (step verify_phase_goal). Autonomous should NOT re-verify — just read the result.
- **Modifying execute-phase.md or plan-phase.md:** All changes are in autonomous.md only. The other workflows already have the needed capabilities.
- **Skipping handle_blocker routing:** If plan-phase or execute-phase fails, the error MUST go to handle_blocker (step 5) — not be silently swallowed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase verification | Custom verification logic in autonomous | Read VERIFICATION.md created by execute-phase's built-in gsd-verifier | Execute-phase already handles verification; duplicating would be fragile and inconsistent |
| Gap closure planning | Custom gap analysis in autonomous | `Skill(plan-phase --gaps)` which reads VERIFICATION.md internally | Plan-phase --gaps already knows how to read verification gaps and create gap_closure plans |
| Phase completion marking | Manual ROADMAP.md/STATE.md edits | Execute-phase's update_roadmap step handles this | The `phase complete` CLI command handles all tracking file updates |
| Transition to next phase | Custom next-phase logic | The iterate step already re-reads ROADMAP.md and finds next incomplete phase | The iterate step (step 4) already handles phase advancement |

**Key insight:** The autonomous workflow is an orchestrator — it invokes existing skills and routes on results. It never reimplements the logic those skills already contain.

## Common Pitfalls

### Pitfall 1: Double Execution from --auto Flag
**What goes wrong:** If `--auto` is passed to plan-phase, plan-phase chains to execute-phase internally (line 480 of plan-phase.md). Then autonomous also calls execute-phase, causing the phase to execute twice.
**Why it happens:** Natural instinct to pass --auto to "speed things up."
**How to avoid:** Never pass `--auto` to plan-phase from autonomous. The CONTEXT.md explicitly locks this decision.
**Warning signs:** Phase executes twice, duplicate commits, SUMMARY.md overwritten.

### Pitfall 2: Execute-Phase Running Transition
**What goes wrong:** Without `--no-transition`, execute-phase may chain to transition.md (lines 411-437), which advances to the next phase. Then autonomous also tries to advance, causing confusion.
**Why it happens:** Forgetting the `--no-transition` flag on the Skill call.
**How to avoid:** Always include `--no-transition` when autonomous calls execute-phase.
**Warning signs:** Autonomous displays "Phase N ✅" but STATE.md already shows Phase N+1.

### Pitfall 3: VERIFICATION.md Not Found After Execute-Phase
**What goes wrong:** Execute-phase might fail before reaching the verify_phase_goal step, so no VERIFICATION.md exists.
**Why it happens:** Execute-phase could fail during wave execution, before verification runs.
**How to avoid:** Check for VERIFICATION.md existence before trying to parse it. If missing, treat as execution failure → handle_blocker.
**Warning signs:** `grep "^status:"` returns empty string or error.

### Pitfall 4: Missing has_verification Check
**What goes wrong:** After execute-phase returns, autonomous tries to read VERIFICATION.md but the file doesn't exist (execute-phase failed mid-execution).
**Why it happens:** Execute-phase handles internal failures and may return without creating VERIFICATION.md.
**How to avoid:** Use `init phase-op` to check `has_verification` before trying to parse the file. If false → handle_blocker with "Execute phase did not complete verification."
**Warning signs:** File not found errors when grepping VERIFICATION.md.

### Pitfall 5: Gap Closure Infinite Loop
**What goes wrong:** User keeps choosing "Execute gap closure" but gaps persist, creating an infinite loop.
**Why it happens:** Gaps might be unfixable automatically, or gap closure creates new gaps.
**How to avoid:** Track gap closure attempts. After the first gap closure cycle, if gaps_found persists, change the AskUserQuestion to emphasize "continue without gaps" or "stop" options. Alternatively, limit to one automatic gap closure attempt before requiring explicit user decision.
**Warning signs:** Same gaps appearing repeatedly in VERIFICATION.md.

### Pitfall 6: Forgetting --gaps-only on Re-Execute
**What goes wrong:** After gap closure planning, execute-phase without `--gaps-only` re-executes ALL plans (including already-completed ones), wasting time and potentially breaking things.
**Why it happens:** Omitting the `--gaps-only` flag when re-running execute-phase for gap closure.
**How to avoid:** Always use `--gaps-only` flag when executing after gap closure planning.
**Warning signs:** Already-completed plans being re-executed.

## Code Examples

### Current Step 3b-3d (Lines 149-172) — What Exists Today
```markdown
**3b. Plan**

Skill(skill="gsd:plan-phase", args="${PHASE_NUM}")

Verify plan produced output — re-run `init phase-op` and check `has_plans`. If false → go to handle_blocker: "Plan phase ${PHASE_NUM} did not produce any plans."

**3c. Execute**

Skill(skill="gsd:execute-phase", args="${PHASE_NUM}")

**3d. Transition**

Display transition message:

Phase {N} ✅ {Name}
→ Phase {N+1}: {Next Name} — {1-line goal}

Proceed to iterate step.
```

### Target Step 3b — Plan (Enhanced with Failure Detection)
```markdown
**3b. Plan**

Skill(skill="gsd:plan-phase", args="${PHASE_NUM}")

Verify plan produced output:
PHASE_STATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op ${PHASE_NUM})

Check `has_plans`. If false → go to handle_blocker: "Plan phase ${PHASE_NUM} did not produce any plans."
```
Note: Step 3b is already nearly correct — it already has the has_plans check. The main fix is ensuring the pattern is exactly right (re-run init phase-op, parse JSON, check has_plans boolean).

### Target Step 3c — Execute (Enhanced with --no-transition)
```markdown
**3c. Execute**

Skill(skill="gsd:execute-phase", args="${PHASE_NUM} --no-transition")

Verify execution completed with verification:
PHASE_STATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op ${PHASE_NUM})

Check `has_verification`. If false → go to handle_blocker: "Execute phase ${PHASE_NUM} did not complete verification."
```

### Target Step 3d — Post-Execution Validation Routing (New Logic)
```markdown
**3d. Post-Execution Validation**

Read verification status:
VERIFY_STATUS=$(grep "^status:" "${PHASE_DIR}"/*-VERIFICATION.md | head -1 | cut -d: -f2 | tr -d ' ')

**If `passed`:**

Phase {N} ✅ {Name} — Verification passed
→ Proceeding to next phase

Proceed to iterate step.

**If `human_needed`:**

Read human verification items from VERIFICATION.md (the `## Human Verification Required` section).

Display summary of items needing human testing.

AskUserQuestion:
- header: "Phase ${PHASE_NUM} Validation"
- question: "N items need human testing. Validate now or continue to next phase?"
- options: "Validate now" / "Continue without validation"

On "Validate now": Present the human verification items. After user confirms "approved" or reports issues, proceed accordingly (approved → iterate, issues → handle as gaps_found).

On "Continue without validation": Log "Phase ${PHASE_NUM}: Human validation deferred by user" and proceed to iterate step.

**If `gaps_found`:**

Read gap summary from VERIFICATION.md (the `## Gaps Summary` section).

Display the gap summary.

AskUserQuestion:
- header: "Phase ${PHASE_NUM} Gaps"
- question: "Gaps found in phase ${PHASE_NUM}. How to proceed?"
- options: "Execute gap closure" / "Continue without fixing" / "Stop autonomous"

On "Execute gap closure":
  Skill(skill="gsd:plan-phase", args="${PHASE_NUM} --gaps")
  Verify has_plans. If false → handle_blocker.
  Skill(skill="gsd:execute-phase", args="${PHASE_NUM} --gaps-only --no-transition")
  Re-read VERIFICATION.md status and route again.

On "Continue without fixing": Log "Phase ${PHASE_NUM}: Gaps deferred by user" and proceed to iterate step.

On "Stop autonomous": Go to handle_blocker with stop option pre-selected.
```

### VERIFICATION.md Frontmatter Format (From Template)
```yaml
---
phase: XX-name
verified: YYYY-MM-DDTHH:MM:SSZ
status: passed | gaps_found | human_needed
score: N/M must-haves verified
---
```
Source: `get-shit-done/templates/verification-report.md` — the `status:` field is always one of the three values. The grep command (`grep "^status:"`) works because the status line starts at column 0 within the YAML frontmatter.

### Execute-Phase --no-transition Return Format (From execute-phase.md lines 399-407)
```markdown
## PHASE COMPLETE

Phase: ${PHASE_NUMBER} - ${PHASE_NAME}
Plans: ${completed_count}/${total_count}
Verification: {Passed | Gaps Found}

[Include aggregate_results output]
```
This is what execute-phase returns when `--no-transition` is set. Autonomous doesn't need to parse this structured return — it reads VERIFICATION.md directly for the authoritative status.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual phase-by-phase invocation | Autonomous discuss→plan→execute chain | Phase 5-7 (v1.24) | Users run one command instead of three per phase |
| Simple transition message after execute | Validation routing with three outcomes | Phase 7 | System asks about validation instead of blindly proceeding |
| No failure detection on plan/execute | Post-Skill artifact verification | Phase 7 | Failures caught and routed to handle_blocker |

**Key context from prior phases:**
- Phase 5 created autonomous.md scaffolding with Skill() flat calls
- Phase 6 replaced Skill(discuss-phase) with inline smart_discuss logic
- Phase 7 enhances the existing Skill(plan-phase) and Skill(execute-phase) calls — does NOT replace them with inline logic

## Open Questions

1. **Gap closure re-verification loop limit**
   - What we know: User can choose "Execute gap closure" which re-plans and re-executes. The verifier runs again.
   - What's unclear: How many gap closure cycles should be allowed before forcing a different option?
   - Recommendation: Allow one automatic gap closure cycle. If gaps persist after closure, present AskUserQuestion with only "Continue without fixing" and "Stop autonomous" options (removing "Execute gap closure"). This prevents infinite loops while giving one honest attempt.

2. **VERIFICATION.md parsing robustness**
   - What we know: `grep "^status:"` works for YAML frontmatter.
   - What's unclear: Edge cases — what if file has multiple `status:` lines (e.g., in gap entries)?
   - Recommendation: Use `head -10 | grep "^status:"` to restrict to frontmatter area, or use the `init phase-op` approach to check `has_verification` first and then parse. The CONTEXT.md leaves parsing method to Claude's discretion.

3. **Transition message wording after validation routing**
   - What we know: Current step 3d shows `Phase {N} ✅ {Name} → Phase {N+1}: {Next Name}`.
   - What's unclear: Whether to keep this transition display or simplify since iterate step handles advancement.
   - Recommendation: Keep a brief confirmation message for user awareness, then hand off to iterate step. E.g., `Phase {N} ✅ {Name} — Verification passed` without the `→ Phase {N+1}` part (iterate step determines what's next).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual review — this is a markdown workflow file, not executable code |
| Config file | N/A |
| Quick run command | `grep -c "no-transition" get-shit-done/workflows/autonomous.md` (verify flag present) |
| Full suite command | Manual walkthrough of autonomous.md execute_phase step logic |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXEC-01 | Auto-invoke plan-phase after discuss | manual-only | Verify `Skill(skill="gsd:plan-phase"` exists in step 3b | N/A |
| EXEC-02 | Auto-invoke execute-phase after plan | manual-only | `grep "no-transition" get-shit-done/workflows/autonomous.md` | N/A |
| EXEC-03 | Ask user about validation when needed | manual-only | Verify `human_needed` and `gaps_found` routing in step 3d | N/A |
| EXEC-04 | Handle plan-phase interactions directly | manual-only | Verify handle_blocker routing for plan/execute failures | N/A |

### Sampling Rate
- **Per task commit:** `grep -c "no-transition\|VERIFICATION.md\|human_needed\|gaps_found\|handle_blocker" get-shit-done/workflows/autonomous.md`
- **Per wave merge:** Full read of step 3 (execute_phase) to verify logical flow
- **Phase gate:** Verifier checks that all four requirements are addressed in the modified workflow

### Wave 0 Gaps
None — this is a markdown workflow modification. No test infrastructure needed. The gsd-verifier will validate the output against phase requirements.

## Sources

### Primary (HIGH confidence)
- `get-shit-done/workflows/autonomous.md` — current file to modify, read in full (542 lines)
- `get-shit-done/workflows/execute-phase.md` — verify_phase_goal step (lines 302-362), --no-transition behavior (lines 386-438)
- `get-shit-done/workflows/plan-phase.md` — auto-advance behavior (lines 448-506), --auto flag usage (line 480)
- `get-shit-done/templates/verification-report.md` — VERIFICATION.md format and status values
- `.planning/phases/07-phase-execution-chain/07-CONTEXT.md` — locked decisions and implementation constraints

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — EXEC-01 through EXEC-04 requirement definitions
- `.planning/ROADMAP.md` — Phase 7 goal and success criteria

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — single-file modification to autonomous.md, all referenced APIs verified in source
- Architecture: HIGH — patterns verified against existing code in execute-phase.md and plan-phase.md
- Pitfalls: HIGH — each pitfall derived from actual flag behavior verified in workflow source code

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable — workflow files change infrequently)
