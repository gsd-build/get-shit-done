---
description: Execute actions for a milestone with wave-based scheduling and upward verification
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
argument-hint: "[M-XX] [--confirm]"
---

Execute all pending actions for a milestone using wave-based scheduling, parallel agent spawning, per-wave verification, and automatic milestone completion.

**Step 1: Determine milestone scope.**

Parse `$ARGUMENTS` for a milestone ID (matching pattern `M-XX`) and a `--confirm` flag.

If `$ARGUMENTS` contains a milestone ID, use it directly and proceed to Step 2.

If `$ARGUMENTS` is empty or contains no milestone ID (interactive mode):
- Run the milestone picker:

```bash
node dist/declare-tools.cjs execute
```

- Parse the JSON output. It contains a `milestones` array with `{id, title, status, actionCount, doneCount}` objects.
- Display a numbered list:

```
## Select a Milestone to Execute

1. M-01: [title] — [status] ([doneCount]/[actionCount] actions done)
2. M-02: [title] — [status] ([doneCount]/[actionCount] actions done)
```

- Ask the user: "Which milestone would you like to execute? Provide the ID (e.g., M-01)."
- Wait for the user's response, then use their provided ID in Step 2.

Check if `--confirm` is present in `$ARGUMENTS`. If so, pause between waves for user review.

**Step 2: Load execution data.**

Run:

```bash
node dist/declare-tools.cjs execute --milestone M-XX
```

Parse the JSON output.

If `allDone` is true:
- Display: "All actions for M-XX are already complete. Milestone status: [status]"
- Exit.

Display a banner:

```
## Executing: M-XX — [milestoneTitle]

**Declarations:** [for each declaration: "D-XX (title)"]
**Actions:** [pendingCount] pending of [totalActions] total | **Waves:** [waves.length]
```

**Step 3: For each wave, execute actions.**

Iterate over each wave in the `waves` array:

**3a. Generate exec plans (on-demand, per wave):**

For each action in the wave:

```bash
node dist/declare-tools.cjs generate-exec-plan --action A-XX --milestone M-XX --wave N
```

Parse the JSON output and note the `outputPath` for each action.

If any generation returns an error, display it and suggest fixes (e.g., "Run /declare:actions first to create the milestone plan folder").

**3b. Display wave banner:**

```
--- Wave N of [total waves] ---
**Actions:** A-XX ([title]), A-XX ([title])
Spawning [count] agent(s)...
```

**3c. Spawn executor agents in parallel using the Task tool:**

For each action in the wave, spawn a Task with instructions like:

```
Execute the plan at [outputPath].

Read the EXEC-PLAN file at the path above. Follow all tasks described in it.
Make atomic commits per task. When complete, report:
- What was done
- Files created or modified
- Commit hashes
- Any issues encountered

Context: This action is part of milestone M-XX ([milestoneTitle]).
```

Use one Task tool call per action. If the wave has multiple actions, spawn them all in the same response so they execute in parallel.

**3d. After all agents in the wave complete, verify:**

Run:

```bash
node dist/declare-tools.cjs verify-wave --milestone M-XX --actions "A-01,A-02"
```

(Use the comma-separated list of action IDs from the current wave.)

Parse the verification JSON output.

Display automated check results:

```
### Wave N Verification

| Action | Check        | Result |
| ------ | ------------ | ------ |
| A-XX   | action-exists | PASS   |
| A-XX   | produces-exist| PASS   |
```

Perform AI review: Given the trace context from the verification result (`traceContext.whyChain` and `traceContext.declarations`), assess whether the completed work meaningfully advances the milestone. Produce a 1-2 sentence assessment.

If `passed` is false (verification failed):
- Identify which actions failed and what checks failed.
- Retry up to 2 times: re-spawn the failed action's Task agent with the failure context appended:

```
Previous attempt failed verification. Failure details:
- Check [check-name] failed for action A-XX
- [Details from allChecks]

Please fix the issues and try again.
```

- After 2 retries with continued failure, surface to user:
  "Action A-XX failed verification after 2 retries. Details: [failure info]. What would you like to do?"
- Wait for user guidance before continuing.

If `--confirm` flag was set, pause after successful verification:
- "Wave N complete and verified. Proceed to Wave N+1? (yes/no)"
- Wait for user confirmation before continuing.

**3e. Update action statuses in PLAN.md:**

After successful wave verification, update each completed action's status in the milestone's PLAN.md file:

1. Use the `milestoneFolderPath` from Step 2 to locate the PLAN.md file.
2. Read the PLAN.md file.
3. For each action in the completed wave, find `**Status:** PENDING` (or `**Status:** ACTIVE`) for that action and change it to `**Status:** DONE`.
4. Write the updated PLAN.md back.

**Step 4: After all waves complete, check milestone completion.**

If `milestoneCompletable` is true from the final verify-wave result:
1. Read `.planning/MILESTONES.md`.
2. Find the row for M-XX in the milestones table.
3. Change its Status from PENDING or ACTIVE to DONE.
4. Write the updated MILESTONES.md back.
5. Display: "Milestone M-XX marked as DONE (pending verification)."

Proceed to Step 5. Do NOT display a completion banner yet -- that happens in Step 8 after verification.

**Step 5: Milestone truth verification.**

After marking the milestone DONE in Step 4, verify whether the milestone truth actually holds.

**5a. Run programmatic verification:**

```bash
node dist/declare-tools.cjs verify-milestone --milestone M-XX
```

Parse the JSON result. It contains `criteria` (array of `{id, type, passed, description, evidence}`), `programmaticPassed`, `aiAssessmentNeeded`, and `traceContext`.

**5b. Display programmatic check results:**

```
### Milestone Verification: M-XX

| Criterion | Type | Result | Evidence |
| --------- | ---- | ------ | -------- |
| SC-01     | artifact | PASS | File found at path (NNN bytes) |
| SC-02     | test | PASS | npm test exited with code 0 |
| SC-03     | ai   | (pending) | |
```

For each criterion in the result, show its id, type, result (PASS if `passed === true`, NOT YET MET if `passed === false`, `(pending)` if `passed === null`), and evidence.

**5c. Perform AI assessment:**

If `programmaticPassed` is false, skip AI assessment -- programmatic criteria not yet met are definitive. Proceed directly to remediation (Step 6).

If `programmaticPassed` is true, perform the AI assessment for the criterion with `type: "ai"`:

- Read the milestone title and the trace context (`traceContext.declarations` and `traceContext.whyChain`) from the verify-milestone result.
- Review the work completed across all waves (the actions executed, their produces, the wave verification results).
- Assess: "Given that all actions for this milestone have completed, does the milestone truth statement hold? Is '[milestone title]' actually true?"
- If the AI assessment is positive: mark the AI criterion as passed with a 1-2 sentence evidence summary.
- If the AI assessment is negative: mark the AI criterion as not yet met with evidence explaining what is missing.

Use restoration-focused language throughout: "criterion met" / "criterion not yet met" (never "passed" / "failed" in user-facing output).

**5d. Determine verification outcome:**

- ALL criteria met (including AI): proceed to mark KEPT (Step 5e).
- ANY criterion not yet met: proceed to remediation loop (Step 6).

**5e. All criteria met -- mark milestone KEPT:**

1. Read `.planning/MILESTONES.md`, change M-XX status from DONE to KEPT.
2. Write the updated MILESTONES.md back.
3. Write VERIFICATION.md to the milestone folder using the `writeVerificationFile` format:
   - State: `KEPT`
   - Criteria: all criteria with their pass/fail status, descriptions, and evidence
   - History: one attempt entry with `passed: true`, `remediationTriggered: false`, `stateTransition: "DONE -> KEPT"`
4. Display (3-5 lines):

```
Milestone M-XX verified as KEPT -- "[milestone title]" holds true.
[Brief summary of what was verified: N artifact checks, test suite, AI assessment all met.]
```

5. Skip to completion banner (Step 8).

**Step 6: Remediation loop (max 2 attempts).**

If verification in Step 5 found criteria not yet met:

**6a. Update MILESTONES.md status to BROKEN for M-XX.**

Read `.planning/MILESTONES.md`, change M-XX status from DONE to BROKEN, write back.

**6b. Write initial VERIFICATION.md to the milestone folder.**

Write VERIFICATION.md with:
- State: `BROKEN`
- Criteria: all criteria with current results
- History: one attempt entry with `passed: false`, `remediationTriggered: true`, `stateTransition: "DONE -> BROKEN"`, checks summary (which criteria not yet met)

**6c. For each remediation attempt (max 2):**

**i. Derive remediation actions.** Analyze the criteria not yet met. For each criterion not yet met, derive 1-3 targeted remediation actions using AI reasoning:

```
Given these verification results for milestone M-XX ("[milestone title]"):

Criteria not yet met:
- SC-XX: [description] -- Evidence: [evidence]

Derive remediation actions. Rules:
- Each action targets exactly one criterion not yet met
- Do not modify code that already meets its criteria
- Maximum 3 actions per remediation attempt
- Each action needs: title, produces field, description
```

**ii. Append remediation actions to PLAN.md.** For each derived action:
- Read the existing PLAN.md from the milestone folder (use `milestoneFolderPath` from Step 2).
- Add a new action section at the bottom with the next available A-XX ID.
- Mark it with `**Derived:** remediation (attempt N)` instead of a creation date.
- Write the updated PLAN.md.

**iii. Generate exec plans for remediation actions:**

```bash
node dist/declare-tools.cjs generate-exec-plan --action A-XX --milestone M-XX --wave remediation
```

**iv. Display remediation banner:**

```
--- Remediation Attempt N ---
**Criteria not yet met:** SC-XX, SC-YY
**Actions:** A-XX ([title]), A-YY ([title])
Spawning [count] agent(s)...
```

**v. Spawn executor agents for remediation actions using the Task tool** (same pattern as Step 3c).

**vi. After remediation agents complete, re-run verification:**

```bash
node dist/declare-tools.cjs verify-milestone --milestone M-XX
```

Re-perform AI assessment for the AI criterion (same process as Step 5c).

**vii. If ALL criteria now met:**
- Read `.planning/MILESTONES.md`, change M-XX status from BROKEN to HONORED.
- Write the updated MILESTONES.md back.
- Update VERIFICATION.md: use `appendAttempt` to add the successful attempt with `passed: true`, `remediationTriggered: false`, `stateTransition: "BROKEN -> HONORED"`, and update the header state to HONORED.
- Display (3-5 lines):

```
Milestone M-XX verified as HONORED -- "[milestone title]" now holds true.
Remediation: [brief description of what was fixed]. [N] criteria now met.
```

- Skip to completion banner (Step 8).

**viii. If criteria still not met after attempt 2:** proceed to escalation (Step 7).

**Step 7: Escalation.**

After 2 remediation attempts with criteria still not met:

**7a. Update VERIFICATION.md** with the final attempt (attempt 2) results using `appendAttempt`.

**7b. Display diagnosis report:**

```
## Verification: M-XX requires attention

**Milestone:** [milestone title]
**Remediation attempts:** 2 (criteria still not yet met)

### What was tried

**Attempt 1:** [actions taken] -- [which criteria still not yet met]
**Attempt 2:** [actions taken] -- [which criteria still not yet met]

### Criteria still not yet met

| Criterion | Evidence |
| --------- | -------- |
| SC-XX     | [latest evidence] |

### Suggestions

- [Specific suggestion per criterion not yet met, e.g., "Consider narrowing SC-02 to check only the main export" or "The test in SC-03 may need a mock for external service X"]

### Options

1. **Adjust** the milestone statement or success criteria, then I will retry verification
2. **Accept** the current state and continue to the next milestone
```

**7c. Wait for user response.**

If user chooses to **adjust**:
- Apply the user's adjustments to the milestone statement or success criteria.
- Re-run verification (Step 5).
- If all criteria now met: change M-XX status from BROKEN to RENEGOTIATED in MILESTONES.md.
- Update VERIFICATION.md with a new attempt entry with `stateTransition: "BROKEN -> RENEGOTIATED"`.
- Display: "Milestone M-XX renegotiated and verified -- adjusted criteria now hold."
- Proceed to Step 8.

If user chooses to **accept**:
- Leave M-XX status as BROKEN in MILESTONES.md.
- Add a note to VERIFICATION.md: "User accepted current state. Milestone remains BROKEN."
- Proceed to Step 8.

**Step 8: Completion banner.**

Display the final execution summary:

```
## Execution Complete: M-XX -- [milestoneTitle]

**Actions completed:** [count of actions executed, including remediation actions]
**Waves executed:** [count of waves]
**Verification:** [KEPT | HONORED | RENEGOTIATED | BROKEN (user accepted)]
**Milestone status:** [final status in MILESTONES.md]
```

**Error handling:**

- If any CJS command returns a JSON with an `error` field, display it clearly and suggest fixes.
- If milestone folder not found, suggest running `/declare:actions` first to create the milestone plan.
- If no pending actions, report the milestone is already complete.
- If a Task agent fails (non-verification failure), display the error and ask the user how to proceed.

**Key patterns:**

- Execution scope is per-milestone (never cross-milestone).
- Wave scheduling is automatic from the action graph.
- Auto-advance between waves by default; `--confirm` pauses for user review.
- GSD-style banners with progress at each stage.
- Atomic commits per task (handled by executor agents).
- Two-layer verification: automated checks (CJS tool) then AI review (this slash command).
- Max 2 retries on verification failure before escalating to user.
- Milestone truth verification after all waves: DONE is intermediate, KEPT/HONORED/RENEGOTIATED are final.
- Auto-remediation derives targeted actions, appends to PLAN.md, executes, and re-verifies.
- Escalation provides diagnosis with specific suggestions, never judgment.
- Language is restoration-focused: "criterion not yet met" not "failed", "requires attention" not "broken".
- State transitions: DONE -> KEPT (all criteria met first try), DONE -> BROKEN -> HONORED (remediated), DONE -> BROKEN -> RENEGOTIATED (user adjusted criteria).
- VERIFICATION.md written to milestone folder with full attempt history and audit trail.
