<purpose>
Cross-AI plan convergence loop — automates the manual chain:
gsd-plan-phase N → gsd-review N --codex → gsd-plan-phase N --reviews → gsd-review N --codex → ...
Each step runs inside an isolated Agent that calls the corresponding Skill.
Orchestrator only does: init, loop control, parse CYCLE_SUMMARY for HIGH count, stall detection, escalation.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.

@$HOME/.claude/get-shit-done/references/revision-loop.md
@$HOME/.claude/get-shit-done/references/gates.md
@$HOME/.claude/get-shit-done/references/agent-contracts.md
</required_reading>

<process>

## 1. Parse and Normalize Arguments

Extract from $ARGUMENTS: phase number, reviewer flags (`--codex`, `--gemini`, `--claude`, `--opencode`, `--ollama`, `--lm-studio`, `--llama-cpp`, `--all`), `--max-cycles N`, `--text`, `--ws`.

```bash
PHASE=$(echo "$ARGUMENTS" | grep -oE '[0-9]+\.?[0-9]*' | head -1)

REVIEWER_FLAGS=""
echo "$ARGUMENTS" | grep -q '\-\-codex' && REVIEWER_FLAGS="$REVIEWER_FLAGS --codex"
echo "$ARGUMENTS" | grep -q '\-\-gemini' && REVIEWER_FLAGS="$REVIEWER_FLAGS --gemini"
echo "$ARGUMENTS" | grep -q '\-\-claude' && REVIEWER_FLAGS="$REVIEWER_FLAGS --claude"
echo "$ARGUMENTS" | grep -q '\-\-opencode' && REVIEWER_FLAGS="$REVIEWER_FLAGS --opencode"
echo "$ARGUMENTS" | grep -q '\-\-ollama' && REVIEWER_FLAGS="$REVIEWER_FLAGS --ollama"
echo "$ARGUMENTS" | grep -q '\-\-lm-studio' && REVIEWER_FLAGS="$REVIEWER_FLAGS --lm-studio"
echo "$ARGUMENTS" | grep -q '\-\-llama-cpp' && REVIEWER_FLAGS="$REVIEWER_FLAGS --llama-cpp"
echo "$ARGUMENTS" | grep -q '\-\-all' && REVIEWER_FLAGS="$REVIEWER_FLAGS --all"
if [ -z "$REVIEWER_FLAGS" ]; then REVIEWER_FLAGS="--codex"; fi

MAX_CYCLES=$(echo "$ARGUMENTS" | grep -oE '\-\-max-cycles\s+[0-9]+' | awk '{print $2}')
if [ -z "$MAX_CYCLES" ]; then MAX_CYCLES=3; fi

GSD_WS=""
echo "$ARGUMENTS" | grep -qE '\-\-ws\s+\S+' && GSD_WS=$(echo "$ARGUMENTS" | grep -oE '\-\-ws\s+\S+')
```

## 1.5. Config Gate (feature disabled by default)

```bash
CONVERGENCE_ENABLED=$(gsd-sdk query config-get workflow.plan_review_convergence 2>/dev/null || echo "false")
```

**If `CONVERGENCE_ENABLED` is not `"true"`:** Display and exit:

```text
gsd-plan-review-convergence is disabled (workflow.plan_review_convergence=false).

This feature automates the plan→review→replan loop using external AI reviewers.
Enable it with:

  gsd config-set workflow.plan_review_convergence true

Then re-run: /gsd-plan-review-convergence {PHASE}
```

## 2. Initialize

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `phase_dir`, `phase_number`, `padded_phase`, `phase_name`, `has_plans`, `plan_count`, `commit_docs`, `text_mode`, `response_language`.

**If `response_language` is set:** All user-facing output should be in `{response_language}`.

Set `TEXT_MODE=true` if `--text` is present in $ARGUMENTS OR `text_mode` from init JSON is `true`. When `TEXT_MODE` is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number.

## 3. Validate Phase + Pre-flight Gate

```bash
PHASE_INFO=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "${PHASE}")
```

**If `found` is false:** Error with available phases. Exit.

Display startup banner:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLAN CONVERGENCE — Phase {phase_number}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Reviewers: {REVIEWER_FLAGS}
 Max cycles: {MAX_CYCLES}
```

## 4. Initial Planning (if no plans exist)

**If `has_plans` is true:** Skip to step 5. Display: `Plans found: {plan_count} PLAN.md files — skipping initial planning.`

**If `has_plans` is false:**

Display: `◆ No plans found — spawning initial planning agent...`

```text
Agent(
  description="Initial planning Phase {PHASE}",
  prompt="Run /gsd-plan-phase for Phase {PHASE}.

Execute: Skill(skill='gsd-plan-phase', args='{PHASE} {GSD_WS}')

Complete the full planning workflow. Do NOT return until planning is complete and PLAN.md files are committed.",
  mode="auto"
)
```

After agent returns, verify plans were created:
```bash
PLAN_COUNT=$(ls ${phase_dir}/${padded_phase}-*-PLAN.md 2>/dev/null | wc -l)
```

If PLAN_COUNT == 0: Error — initial planning failed. Exit.

Display: `Initial planning complete: ${PLAN_COUNT} PLAN.md files created.`

## 5. Convergence Loop

Initialize loop variables:

```text
cycle = 0
prev_high_count = Infinity
```

### 5a. Review (Spawn Agent)

Increment `cycle`.

Display: `◆ Cycle {cycle}/{MAX_CYCLES} — spawning review agent...`

```text
Agent(
  description="Cross-AI review Phase {PHASE} cycle {cycle}",
  prompt="Run /gsd-review for Phase {PHASE}.

Execute: Skill(skill='gsd-review', args='--phase {PHASE} {REVIEWER_FLAGS} {GSD_WS}')

Complete the full review workflow. Do NOT return until REVIEWS.md is committed.

IMPORTANT — CYCLE_SUMMARY contract (required):
Your final response MUST include a machine-readable line of exactly this form:

  CYCLE_SUMMARY: current_high=<N>

Where <N> is the integer count of HIGH-severity concerns that REMAIN UNRESOLVED in this cycle's findings.

Counting rules:
  INCLUDE in the count:
    - Newly raised HIGHs in this cycle
    - PARTIALLY RESOLVED HIGHs: concern acknowledged and a mitigation is in progress, but not yet verified/completed
    - Previously raised HIGHs that are still unresolved

  EXCLUDE from the count:
    - FULLY RESOLVED HIGHs: concern addressed with verification complete (closed ticket, verification log, or reviewer sign-off)
    - HIGH mentions in retrospective/summary tables comparing cycles
    - Quoted excerpts from prior reviews referencing past HIGH items

Definitions:
  PARTIALLY RESOLVED — concern acknowledged and mitigation is in progress but not yet verified/completed (e.g., open ticket exists but fix not landed).
  FULLY RESOLVED — concern addressed with verification complete (closed ticket, verification log, or explicit reviewer sign-off confirming closure).

Your final response MUST also include this section immediately after the CYCLE_SUMMARY line:

## Current HIGH Concerns
[List each unresolved HIGH with a brief description, one per bullet]
[If none: write exactly 'None.']",
  mode="auto"
)
```

After agent returns, verify REVIEWS.md exists:
```bash
REVIEWS_FILE=$(ls ${phase_dir}/${padded_phase}-REVIEWS.md 2>/dev/null)
```

If REVIEWS_FILE is empty: Error — review agent did not produce REVIEWS.md. Exit.

### 5b. Extract HIGH Count from CYCLE_SUMMARY Contract

**Do NOT grep REVIEWS.md for HIGH count.** REVIEWS.md accumulates history across cycles — resolved HIGHs from prior cycles remain in the file as audit trail, inflating a raw grep count and causing false stall detection.

Parse HIGH_COUNT from the review agent's return message via the CYCLE_SUMMARY contract:

```bash
# Extract the integer from "CYCLE_SUMMARY: current_high=N" in the agent's return message
HIGH_COUNT=$(echo "$REVIEW_AGENT_RETURN" | grep -oE 'CYCLE_SUMMARY:\s*current_high=[0-9]+' | head -1 | grep -oE '[0-9]+$')

if [ -z "$HIGH_COUNT" ]; then
  # Distinguish malformed contract from completely absent contract
  if echo "$REVIEW_AGENT_RETURN" | grep -q 'CYCLE_SUMMARY:'; then
    echo "CYCLE_SUMMARY present but current_high is malformed — expected integer, got non-numeric value. Retry or switch reviewer."
  else
    echo "Review agent did not honor the CYCLE_SUMMARY contract — cannot determine HIGH count. Retry or switch reviewer."
  fi
  exit 1
fi

# Extract the ## Current HIGH Concerns section from the agent's return message
HIGH_LINES=$(echo "$REVIEW_AGENT_RETURN" | awk '/^## Current HIGH Concerns/{found=1; next} found && /^##/{exit} found{print}')

if [ "${HIGH_COUNT}" -gt 0 ] && [ -z "${HIGH_LINES}" ]; then
  echo "⚠ Review agent's CYCLE_SUMMARY reports ${HIGH_COUNT} HIGHs but did not provide ## Current HIGH Concerns section — continuing with incomplete escalation details."
fi
```

**If HIGH_COUNT == 0 (converged):**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state planned-phase --phase "${PHASE}" --name "${phase_name}" --plans "${PLAN_COUNT}"
```

Display:
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CONVERGENCE COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Phase {phase_number} converged in {cycle} cycle(s).
 No HIGH concerns remaining.

 REVIEWS.md: {REVIEWS_FILE}
 Next: /gsd-execute-phase {PHASE}
```

Exit — convergence achieved.

**If HIGH_COUNT > 0:** Continue to 5c.

### 5c. Stall Detection + Escalation Check

Display: `◆ Cycle {cycle}/{MAX_CYCLES} — {HIGH_COUNT} HIGH concerns found`

**Stall detection:** If `HIGH_COUNT >= prev_high_count`:
```text
⚠ Convergence stalled — HIGH concern count not decreasing
  ({HIGH_COUNT} HIGH concerns, previous cycle had {prev_high_count})
```

**Max cycles check:** If `cycle >= MAX_CYCLES`:

If `TEXT_MODE` is true, present as plain-text numbered list:
```text
Plan convergence did not complete after {MAX_CYCLES} cycles.
{HIGH_COUNT} HIGH concerns remain:

{HIGH_LINES}

How would you like to proceed?

1. Proceed anyway — Accept plans with remaining HIGH concerns and move to execution
2. Manual review — Stop here, review REVIEWS.md and address concerns manually

Enter number:
```

Otherwise use AskUserQuestion:
```js
AskUserQuestion([
  {
    question: "Plan convergence did not complete after {MAX_CYCLES} cycles. {HIGH_COUNT} HIGH concerns remain:\n\n{HIGH_LINES}\n\nHow would you like to proceed?",
    header: "Convergence",
    multiSelect: false,
    options: [
      { label: "Proceed anyway", description: "Accept plans with remaining HIGH concerns and move to execution" },
      { label: "Manual review", description: "Stop here — review REVIEWS.md and address concerns manually" }
    ]
  }
])
```

If "Proceed anyway": Display final status and exit.
If "Manual review":
```text
Review the concerns in: {REVIEWS_FILE}

To replan manually:  /gsd-plan-phase {PHASE} --reviews
To restart loop:     /gsd-plan-review-convergence {PHASE} {REVIEWER_FLAGS}
```
Exit workflow.

### 5d. Replan (Spawn Agent)

**If under max cycles:**

Update `prev_high_count = HIGH_COUNT`.

Display: `◆ Spawning replan agent with review feedback...`

```text
Agent(
  description="Replan Phase {PHASE} with review feedback cycle {cycle}",
  prompt="Run /gsd-plan-phase with --reviews for Phase {PHASE}.

Execute: Skill(skill='gsd-plan-phase', args='{PHASE} --reviews --skip-research {GSD_WS}')

This will replan incorporating cross-AI review feedback from REVIEWS.md.
Do NOT return until replanning is complete and updated PLAN.md files are committed.

IMPORTANT: When gsd-plan-phase outputs '## PLANNING COMPLETE', that means replanning is done. Return at that point.",
  mode="auto"
)
```

After agent returns → go back to **step 5a** (review again).

</process>

<success_criteria>
- [ ] Config gate checked before running — exits with enable instructions if workflow.plan_review_convergence is false
- [ ] Initial planning via Agent → Skill("gsd-plan-phase") if no plans exist
- [ ] Review via Agent → Skill("gsd-review") — isolated, not inline; {GSD_WS} forwarded
- [ ] Replan via Agent → Skill("gsd-plan-phase --reviews") — isolated, not inline
- [ ] Orchestrator only does: init, config gate, loop control, parse CYCLE_SUMMARY for HIGH count, stall detection, escalation
- [ ] HIGH count extracted from review agent's CYCLE_SUMMARY return message (not by grepping REVIEWS.md)
- [ ] Review agent prompt defines CYCLE_SUMMARY: current_high=<N> contract with PARTIALLY/FULLY RESOLVED definitions
- [ ] Abort with clear error if CYCLE_SUMMARY is absent; distinguish malformed from absent
- [ ] Warn if HIGH_COUNT > 0 but ## Current HIGH Concerns section is absent from return message
- [ ] Each Agent fully completes its Skill before returning
- [ ] Loop exits on: no HIGH concerns (converged) OR max cycles (escalation)
- [ ] Stall detection reported when HIGH count not decreasing
- [ ] STATE.md updated on convergence completion
</success_criteria>
