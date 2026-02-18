# Phase 5: Integrity System - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Milestone truth verification and auto-remediation. After agents execute all actions for a milestone, the system verifies whether the milestone is actually TRUE (not just that actions completed). When truth doesn't hold, the system auto-remediates by deriving and executing new actions. This is the gap between "tasks done" and "promise kept."

**Rethought from original design:** The original commitment tracking with staleness/drift was designed for human-paced projects. Since Declare runs via agents in hours, integrity is about verifying truth at completion time, not tracking drift over weeks.

</domain>

<decisions>
## Implementation Decisions

### Commitment scope
- Only milestones are commitments — actions are tasks, not promises
- Declarations are checked in Phase 6 (alignment), not here

### Detection and verification
- Verification happens immediately after all actions for a milestone complete
- Two-layer verification: programmatic checks where possible (file exists, test passes) + AI assessment for the rest
- Each milestone's success criteria become structured checkboxes with pass/fail and evidence

### Auto-remediation flow
- When verification fails: system derives new actions to close the gap
- System shows the remediation plan, then auto-executes immediately (no pause for approval)
- Maximum 2 remediation attempts before escalating to user
- Remediation is inline during execution — "M-03 failed verification → remediating..."

### Escalation (after 2 failed attempts)
- System produces a diagnosis report: what was tried, what failed, specific suggestions for adjustment
- Suggestions always included — "Consider narrowing this criterion" or "This test needs X"
- User option: adjust the milestone statement or criteria, then system retries verification

### Honor protocol history
- Each milestone folder gets a VERIFICATION.md (not a system-level INTEGRITY.md)
- Full history: each verification attempt logged with timestamp, what was checked, result, remediation actions taken
- Structured checklist format: success criteria as checkboxes with pass/fail and evidence

### Output verbosity
- When auto-remediation succeeds: summary (3-5 lines) — what failed, what remediation did, that it passed
- Surfaced inline during execution, not batched into a post-execution report

### Claude's Discretion
- Milestone state vocabulary (original ACTIVE/KEPT/BROKEN/HONORED/RENEGOTIATED vs simplified vs hybrid)
- VERIFICATION.md exact format and structure
- How to derive remediation actions from verification failures
- Programmatic check implementation details

</decisions>

<specifics>
## Specific Ideas

- The core insight: "I did all the steps" (task completion) vs "the thing is actually true" (promise kept) — this gap is what Phase 5 closes
- Verification runs immediately after milestone execution, not as a separate phase
- Per-milestone VERIFICATION.md lives in the milestone folder alongside PLAN.md
- No system-level INTEGRITY.md file — aggregate view handled by /declare:status

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-integrity-system*
*Context gathered: 2026-02-16*
