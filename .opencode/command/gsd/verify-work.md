---

description: Guide manual user acceptance testing of recently built features

---

<objective>
Guide the user through manual acceptance testing of recently built features.

Purpose: Validate that what Claude thinks was built actually works from the user's perspective. The USER performs all testing — Claude generates the test checklist, guides the process, and captures issues.

Output: Validation of features, any issues logged to phase-scoped ISSUES.md
</objective>

<execution_context>
@~/.config/opencode/gsd/workflows/verify-work.md
@~/.config/opencode/gsd/templates/uat-issues.md
</execution_context>

<context>
Scope: $ARGUMENTS (optional)
- If provided: Test specific phase or plan (e.g., "4" or "04-02")
- If not provided: Test most recently completed plan

**Load project state:**
@.planning/STATE.md

**Load roadmap:**
@.planning/ROADMAP.md
</context>

<process>
1. Validate arguments (if provided, parse as phase or plan number)
2. Find relevant SUMMARY.md (specified or most recent)
3. Follow verify-work.md workflow:
   - Extract testable deliverables
   - Generate test checklist
   - Guide through each test via AskUserQuestion
   - Collect and categorize issues
   - Log issues to `.planning/phases/XX-name/{phase}-{plan}-ISSUES.md`
   - Present summary with verdict
4. Offer next steps based on results:
   - If all passed: Continue to next phase
   - If issues found: `/gsd/plan-fix {phase} {plan}` to create fix plan
</process>

<anti_patterns>
- Don't run automated tests (that's for CI/test suites)
- Don't make assumptions about test results — USER reports outcomes
- Don't skip the guidance — walk through each test
- Don't dismiss minor issues — log everything user reports
- Don't fix issues during testing — capture for later
</anti_patterns>

<success_criteria>
- [ ] Test scope identified from SUMMARY.md
- [ ] Checklist generated based on deliverables
- [ ] User guided through each test
- [ ] All test results captured (pass/fail/partial/skip)
- [ ] Any issues logged to phase-scoped ISSUES.md (not global)
- [ ] Summary presented with verdict
- [ ] User knows next steps based on results
</success_criteria>
