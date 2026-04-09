# Revision Loop Pattern

Standard pattern for iterative agent revision with feedback. Used when a checker/validator finds issues and the producing agent needs to revise its output.

---

## Pattern: Check-Revise-Escalate (max 3 iterations)

This pattern applies whenever:
1. An agent produces output (plans, imports, gap-closure plans)
2. A checker/validator evaluates that output
3. Issues are found that need revision

### Flow

```
prev_issue_count = Infinity
iteration = 0

LOOP:
  1. Run checker/validator on current output
  2. Read checker results
  3. If PASSED or only INFO-level issues:
     -> Accept output, exit loop
  4. If BLOCKER or WARNING issues found:
     a. iteration += 1
     b. If iteration > 3:
        -> Escalate to user (see "After 3 Iterations" below)
     c. Parse issue count from checker output
     d. If issue_count >= prev_issue_count:
        -> Escalate to user: "Revision loop stalled (issue count not decreasing)"
     e. prev_issue_count = issue_count
     f. Re-spawn the producing agent with checker feedback appended
     g. After revision completes, go to LOOP
```

### Issue Count Tracking

Track the number of BLOCKER + WARNING issues returned by the checker on each iteration. If the count does not decrease between consecutive iterations, the producing agent is stuck and further iterations will not help. Break early and escalate to the user.

Display iteration progress before each revision spawn:
`Revision iteration {N}/3 -- {blocker_count} blockers, {warning_count} warnings`

### Re-spawn Prompt Structure

When re-spawning the producing agent for revision, pass the checker's YAML-formatted issues. The checker's output contains a `## Issues` heading followed by a YAML block. Parse this block and pass it verbatim to the revision agent.

```
<checker_issues>
The issues below are in YAML format. Each has: dimension, severity, finding,
affected_field, suggested_fix. Address ALL BLOCKER issues. Address WARNING
issues where feasible.

{YAML issues block from checker output -- passed verbatim}
</checker_issues>

<revision_instructions>
Address ALL BLOCKER and WARNING issues identified above.
- For each BLOCKER: make the required change
- For each WARNING: address or explain why it's acceptable
- Do NOT introduce new issues while fixing existing ones
- Preserve all content not flagged by the checker
This is revision iteration {N} of max 3. Previous iteration had {prev_count}
issues. You must reduce the count or the loop will terminate.
</revision_instructions>
```

### After 3 Iterations

If issues persist after 3 revision cycles:

1. Present remaining issues to the user
2. Use gate prompt (pattern: yes-no from `references/gate-prompts.md`):
   question: "Issues remain after 3 revision attempts. Proceed with current output?"
   header: "Proceed?"
   options:
     - label: "Proceed anyway"   description: "Accept output with remaining issues"
     - label: "Adjust approach"  description: "Discuss a different approach"
3. If "Proceed anyway": accept current output and continue
4. If "Adjust approach" or "Other": discuss with user, then re-enter the producing step with updated context

### Workflow-Specific Variations

| Workflow | Producer Agent | Checker Agent | Notes |
|----------|---------------|---------------|-------|
| plan-phase | gsd-planner | gsd-plan-checker | Revision prompt via planner-revision.md |
| execute-phase | gsd-executor | gsd-verifier | Post-execution verification |
| discuss-phase | orchestrator | gsd-plan-checker | Inline revision by orchestrator |

---

## Important Notes

- **INFO-level issues are always acceptable** -- they don't trigger revision
- **Each iteration gets a fresh agent spawn** -- don't try to continue in the same context
- **Checker feedback must be inlined** -- the revision agent needs to see exactly what failed
- **Don't silently swallow issues** -- always present the final state to the user after exiting the loop
