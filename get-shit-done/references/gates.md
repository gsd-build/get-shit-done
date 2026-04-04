# Gate System Taxonomy

Reference for gate types, firing conditions, and canonical examples. Workflow orchestrators consume this doc via `@-reference` to classify and apply gates consistently.

**Related:** `references/gate-prompts.md` (prompt patterns), `references/revision-loop.md` (CRE pattern)

---

## Gate Types

### Pre-Flight Gates

**Fires when:** Before a workflow step begins; blocks if preconditions are not met.

**Canonical example:** `sdk/src/research-gate.ts` -- blocks planning when RESEARCH.md contains unresolved open questions.

- Pure function: `checkResearchGate(researchContent: string): ResearchGateResult`
- Returns `{ pass: boolean, unresolvedQuestions: string[] }`
- Called by `phase-runner.ts` before spawning the planner agent
- If `pass === false`, surfaces the unresolved questions and stops

**How to apply:** Call the gate function or check the condition before spawning the producer agent. If the gate does not pass, surface the blocking message and stop. Do not proceed silently.

**Other pre-flight examples:**
- UI safety gate: blocks execution when destructive UI changes are detected
- Schema push gate: blocks deployment when schema migrations are pending

---

### Revision Gates

**Fires when:** A checker or validator returns BLOCKER or WARNING issues after a producer agent completes its output.

**Canonical example:** `workflows/plan-phase.md` step 12 -- routes failing plans back to `gsd-planner` with a structured issue list for targeted fixes.

- Checker output contains a `## Issues` heading with a YAML block
- Each issue has: dimension, severity, finding, affected_field, suggested_fix
- The revision agent receives checker feedback verbatim (see `revision-loop.md`)

**How to apply:** Spawn the checker after the producer finishes. If issues are found, feed the structured issue list back to the producer via a `<checker_issues>` block. Track `issue_count` per iteration to detect stalls. See the Check-Revise-Escalate (CRE) pattern in `revision-loop.md`.

---

### Escalation Gates

**Fires when:** The revision iteration limit is reached (iteration_count >= 3) OR a stall is detected (issue_count >= prev_issue_count across consecutive iterations).

**Canonical example:** `workflows/plan-phase.md` step 12 -- "Max iterations reached" or "Revision loop stalled" prompt. Uses the `yes-no` gate pattern from `gate-prompts.md`.

- question: "Issues remain after {N} revision attempts. Proceed with current output?"
- header: "Proceed?"
- options: Proceed anyway | Adjust approach

**How to apply:** When the revision loop exhausts its iterations or detects a stall, surface choices to the user. Do NOT continue silently. The user must explicitly choose to proceed, adjust, or abandon.

**Stall detection logic** (from `revision-loop.md`):
```
prev_issue_count = Infinity
LOOP:
  ... parse issue_count from checker ...
  If issue_count >= prev_issue_count:
    -> Escalate: "Revision loop stalled (issue count not decreasing)"
  prev_issue_count = issue_count
```

---

### Abort Gates

**Fires when:** An unrecoverable condition is encountered -- plan index unreadable, required file missing, type error in config, corrupted state.

**Canonical example:** `sdk/src/phase-runner.ts` error path when the plan index cannot be loaded -- execution stops immediately with a diagnostic message.

**How to apply:** Stop execution immediately. Report the error with enough context for recovery (what failed, why, what to check). Do NOT attempt retries -- the condition is unrecoverable by definition. If the condition might be transient, use a pre-flight gate with retry logic instead.

---

## Gate Selection Guide

| Condition | Gate Type | Action |
|-----------|-----------|--------|
| Prerequisite not met | Pre-Flight | Block before step begins |
| Output quality low (issues found) | Revision | Route back to producer with feedback |
| No progress after revision | Escalation | Surface choices to user |
| Iteration limit reached | Escalation | Surface choices to user |
| Unrecoverable error | Abort | Stop and report |
| Config invalid or missing | Abort | Stop and report |
| Checker returns only INFO | None | Accept output, continue |

---

## Applying Gates in Workflows

1. **Identify the gate type** using the selection guide above
2. **Reference the prompt pattern** from `gate-prompts.md` (e.g., `yes-no`, `approve-revise-abort`)
3. **Implement the check** as either:
   - A TypeScript function (like `research-gate.ts`) for automated enforcement
   - A workflow step condition for orchestrator-level decisions
4. **Always surface results** -- gates must be visible to the user, never silent

---

## Rules

- Every gate must have a "Fires when" condition that is concrete and checkable
- Gates do not replace each other -- a workflow can use multiple gate types in sequence
- Pre-flight gates run before work begins; revision/escalation gates run after
- Abort gates are terminal -- no retry, no user choice, just stop and report
- INFO-level issues never trigger gates (see `revision-loop.md`)
