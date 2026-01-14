---

description: Review deferred issues with codebase context, close resolved ones, identify urgent ones
---

<objective>
Review all open issues from ISSUES.md with current codebase context. Identify which issues are resolved (can close), which are now urgent (should address), and which can continue waiting.

This prevents issue pile-up by providing a triage mechanism with codebase awareness.
</objective>

<context>
@.planning/ISSUES.md
@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>

<step name="verify">
**Verify issues file exists:**

If no `.planning/ISSUES.md`:
```
No issues file found.

This means no enhancements have been deferred yet (Rule 5 hasn't triggered).

Nothing to review.
```
Exit.

If ISSUES.md exists but has no open issues (only template or empty "Open Enhancements"):
```
No open issues to review.

All clear - continue with current work.
```
Exit.
</step>

<step name="parse">
**Parse all open issues:**

Extract from "## Open Enhancements" section:
- ISS number (ISS-001, ISS-002, etc.)
- Brief description
- Discovered phase/date
- Type (Performance/Refactoring/UX/Testing/Documentation/Accessibility)
- Description details
- Effort estimate

Build list of issues to analyze.
</step>

<step name="analyze">
**For each open issue, perform codebase analysis:**

1. **Check if still relevant:**
   - Search codebase for related code/files mentioned in issue
   - If code no longer exists or was significantly refactored: likely resolved

2. **Check if accidentally resolved:**
   - Look for commits/changes that may have addressed this
   - Check if the enhancement was implemented as part of other work

3. **Assess current urgency:**
   - Is this blocking upcoming phases?
   - Has this become a pain point mentioned in recent summaries?
   - Is this now affecting code we're actively working on?

4. **Check natural fit:**
   - Does this align with an upcoming phase in the roadmap?
   - Would addressing it now touch the same files as current work?

**Categorize each issue:**
- **Resolved** - Can be closed (code changed, no longer applicable)
- **Urgent** - Should address before continuing (blocking or causing problems)
- **Natural fit** - Good candidate for upcoming phase X
- **Can wait** - Keep deferred, no change in status
</step>

<step name="report">
**Present categorized report:**

```
# Issue Review

**Analyzed:** [N] open issues
**Last reviewed:** [today's date]

## Resolved (can close)

### ISS-XXX: [description]
**Reason:** [Why it's resolved - code changed, implemented elsewhere, no longer applicable]
**Evidence:** [What you found - file changes, missing code, etc.]

[Repeat for each resolved issue, or "None" if none resolved]

---

## Urgent (should address now)

### ISS-XXX: [description]
**Why urgent:** [What changed - blocking next phase, causing active problems, etc.]
**Recommendation:** Insert plan before Phase [X] / Add to current phase
**Effort:** [Quick/Medium/Substantial]

[Repeat for each urgent issue, or "None - all issues can wait" if none urgent]

---

## Natural Fit for Upcoming Work

### ISS-XXX: [description]
**Fits with:** Phase [X] - [phase name]
**Reason:** [Same files, same subsystem, natural inclusion]

[Repeat for each, or "None" if no natural fits]

---

## Can Wait (no change)

### ISS-XXX: [description]
**Status:** Still valid, not urgent, keep deferred

[Repeat for each, or list ISS numbers if many]
```
</step>

<step name="offer_actions">
**Offer batch actions:**

Based on analysis, present options:

```
## Actions

What would you like to do?
```

Use AskUserQuestion with appropriate options based on findings:

**If resolved issues exist:**
- "Close resolved issues" - Move to Closed Enhancements section
- "Review each first" - Show details before closing

**If urgent issues exist:**
- "Insert urgent phase" - Create phase to address urgent issues (/gsd/insert-phase)
- "Add to current plan" - Include in next plan being created
- "Defer anyway" - Keep as-is despite urgency

**If natural fits exist:**
- "Note for phase planning" - Will be picked up during /gsd/plan-phase
- "Add explicit reminder" - Update issue with "Include in Phase X"

**Always include:**
- "Done for now" - Exit without changes
</step>

<step name="execute_actions">
**Execute selected actions:**

**If closing resolved issues:**
1. Read current ISSUES.md
2. For each resolved issue:
   - Remove from "## Open Enhancements"
   - Add to "## Closed Enhancements" with resolution note:
     ```
     ### ISS-XXX: [description]
     **Resolved:** [date] - [reason]
     ```
3. Write updated ISSUES.md
4. Update STATE.md deferred issues count

**If inserting urgent phase:**
- Display the command for user to run after clearing: `/gsd/insert-phase [after-phase] Address urgent issues ISS-XXX, ISS-YYY`

**If noting for phase planning:**
- Update issue's "Suggested phase" field with specific phase number
- These will be picked up by /gsd/plan-phase workflow
</step>

</process>

<success_criteria>
- [ ] All open issues analyzed against current codebase
- [ ] Each issue categorized (resolved/urgent/natural-fit/can-wait)
- [ ] Clear reasoning provided for each categorization
- [ ] Actions offered based on findings
- [ ] ISSUES.md updated if user takes action
- [ ] STATE.md updated if issue count changes
</success_criteria>
