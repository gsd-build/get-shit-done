<purpose>
Guide manual user acceptance testing of recently built features. Extract deliverables from SUMMARY.md, generate test checklist, guide user through each test, log issues to phase-scoped file.

The USER performs all testing — Claude generates the checklist, guides the process, and captures issues.
</purpose>

<process>

<step name="identify">
**Determine what to test:**

If $ARGUMENTS provided:
- Parse as phase number (e.g., "4") or plan number (e.g., "04-02")
- Find corresponding SUMMARY.md file(s)

If no arguments:
- Find most recently modified SUMMARY.md

```bash
find .planning/phases -name "*SUMMARY.md" -type f -exec ls -lt {} + | head -5
```

Read the SUMMARY.md to understand what was built.
</step>

<step name="extract">
**Extract testable deliverables from SUMMARY.md:**

Parse for:
1. **Accomplishments** - Features/functionality added
2. **Files Created/Modified** - What changed
3. **User-facing changes** - UI, workflows, interactions

Focus on USER-OBSERVABLE outcomes, not implementation details.

Examples:
- "Check-in menu item added to navigation" → User can see/click Check-in in nav
- "HomePage refreshes after check-in" → After check-in, home shows updated state
</step>

<step name="generate">
**Generate manual test checklist:**

Create structured test plan:

```
# User Acceptance Test: [Plan/Phase Name]

**Scope:** [What was built - from SUMMARY.md]
**Testing:** Manual user validation

## Pre-flight
- [ ] Application builds and runs without errors
- [ ] Application launches to expected state

## Feature Tests

### [Feature 1 from deliverables]
**What to test:** [User-observable behavior]
**Steps:**
1. [Specific action to take]
2. [What to look for]
3. [Expected result]

### [Feature 2 from deliverables]
...

## Edge Cases
- [ ] [Relevant edge case based on feature]
- [ ] [Another edge case]

## Visual/UX Check
- [ ] UI matches expected design
- [ ] No visual glitches or layout issues
- [ ] Responsive to interactions
```

Present this checklist to user.
</step>

<step name="guide">
**Guide user through each test:**

For each test item, use AskUserQuestion:
- header: "[Feature name]"
- question: "[Test description] - Did this work as expected?"
- options:
  - "Pass" — Works correctly
  - "Fail" — Doesn't work as expected
  - "Partial" — Works but with issues
  - "Skip" — Can't test right now

**If Pass:** Move to next test

**If Fail or Partial:**
Follow up with AskUserQuestion:
- header: "Issue details"
- question: "What went wrong?"
- options:
  - "Crashes/errors" — Application error or exception
  - "Wrong behavior" — Does something unexpected
  - "Missing feature" — Expected functionality not present
  - "UI/visual issue" — Looks wrong but functions
  - "Let me describe" — Free-form description needed
</step>

<step name="collect">
**Collect and categorize issues:**

For each failed/partial test, gather:
- Feature affected
- What went wrong (from user input)
- Severity:
  - **Blocker** — Can't use the feature at all
  - **Major** — Feature works but significant problem
  - **Minor** — Small issue, feature still usable
  - **Cosmetic** — Visual only, no functional impact
</step>

<step name="log">
**Log issues to phase-scoped file:**

If any issues found:

1. Create `.planning/phases/XX-name/{phase}-{plan}-ISSUES.md` if doesn't exist
2. Use template from `@~/.config/opencode/gsd/templates/uat-issues.md`
3. Add each issue:

```markdown
### UAT-[NNN]: [Brief description]

**Discovered:** [date] during user acceptance testing
**Phase/Plan:** [phase]-[plan] that was tested
**Severity:** [Blocker/Major/Minor/Cosmetic]
**Description:** [User's description of the problem]
**Expected:** [What should have happened]
**Actual:** [What actually happened]
```

**Note:** Issues go to phase-scoped file, NOT global `.planning/ISSUES.md`. This keeps UAT findings tied to the specific work being tested and enables `/gsd/plan-fix` to address them.
</step>

<step name="summarize">
**Present test summary:**

```
# Test Results: [Plan/Phase Name]

**Tests run:** [N]
**Passed:** [N]
**Failed:** [N]
**Partial:** [N]
**Skipped:** [N]

## Issues Found
[List any issues with severity]

## Verdict
[Based on results:]
- ALL PASS: "All tests passed. Feature validated."
- MINOR ISSUES: "Feature works with minor issues logged."
- MAJOR ISSUES: "Significant issues found - review before proceeding."
- BLOCKERS: "Blocking issues found - must fix before continuing."

## Next Steps
[Based on verdict:]
- If clean: Suggest proceeding to next phase
- If issues: Suggest /gsd/plan-fix to address
```
</step>

<step name="offer">
**Offer next actions based on results:**

Use AskUserQuestion:
- header: "Next"
- question: "What would you like to do?"
- options (based on results):

If all passed:
- "Continue to next phase" — Proceed with confidence
- "Test more" — Run additional manual tests
- "Done" — Finish testing session

If issues found:
- "Plan fixes" — Create plan to address issues (/gsd/plan-fix)
- "Log and continue" — Issues logged, proceed anyway
- "Review issues" — Look at logged issues in detail
- "Done" — Finish testing session
</step>

</process>

<success_criteria>
- [ ] Test scope identified from SUMMARY.md
- [ ] Checklist generated based on deliverables
- [ ] User guided through each test via AskUserQuestion
- [ ] All test results captured (pass/fail/partial/skip)
- [ ] Any issues logged to phase-scoped ISSUES.md
- [ ] Summary presented with verdict
- [ ] User knows next steps based on results
</success_criteria>
