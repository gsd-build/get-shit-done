---

description: Plan fixes for UAT issues from verify-work

---

<objective>
Create FIX.md plan from UAT issues found during verify-work.

Purpose: Plan fixes for issues logged in phase-scoped ISSUES.md files.
Output: {plan}-FIX.md in the phase directory, ready for execution.
</objective>

<execution_context>
@~/.config/opencode/gsd/references/plan-format.md
@~/.config/opencode/gsd/references/checkpoints.md
</execution_context>

<context>
Plan number: $ARGUMENTS (required - e.g., "04-02" or "09-01")

**Load project state:**
@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>

<step name="parse">
**Parse plan argument:**

$ARGUMENTS should be a plan number like "04-02" or "09-01".
Extract phase number (XX) and plan number (NN).

If no argument provided:
```
Error: Plan number required.

Usage: /gsd/plan-fix 04-02

This creates a fix plan from .planning/phases/XX-name/04-02-ISSUES.md
```
Exit.
</step>

<step name="find">
**Find ISSUES.md file:**

Search for matching ISSUES.md:
```bash
ls .planning/phases/*/{plan}-ISSUES.md 2>/dev/null
```

If not found:
```
No ISSUES.md found for plan {plan}.

ISSUES.md files are created by /gsd/verify-work when UAT finds issues.
If no issues were found during testing, no fix plan is needed.
```
Exit.
</step>

<step name="read">
**Read issues:**

Read the ISSUES.md file.
Parse each issue:
- ID (UAT-XXX)
- Title
- Severity (critical/major/minor)
- Description/steps to reproduce
- Acceptance criteria

Count total issues by severity.
</step>

<step name="plan">
**Create fix tasks:**

For each issue (or logical group):
- Create one task per issue OR
- Group related minor issues into single task

Task structure:
```xml
<task type="auto">
  <name>Fix UAT-001: [issue title]</name>
  <files>[affected files from issue]</files>
  <action>
[What to fix based on issue description]
[Reference original acceptance criteria]
  </action>
  <verify>[Test that issue is resolved]</verify>
  <done>[Issue acceptance criteria met]</done>
</task>
```

Prioritize: critical → major → minor
</step>

<step name="write">
**Write FIX.md:**

Create `.planning/phases/XX-name/{plan}-FIX.md`:

```markdown
---
phase: XX-name
plan: {plan}-FIX
type: fix
---

<objective>
Fix {N} UAT issues from plan {plan}.

Source: {plan}-ISSUES.md
Priority: {critical count} critical, {major count} major, {minor count} minor
</objective>

<execution_context>
@~/.config/opencode/gsd/workflows/execute-plan.md
@~/.config/opencode/gsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

**Issues being fixed:**
@.planning/phases/XX-name/{plan}-ISSUES.md

**Original plan for reference:**
@.planning/phases/XX-name/{plan}-PLAN.md
</context>

<tasks>
[Generated fix tasks]
</tasks>

<verification>
Before declaring plan complete:
- [ ] All critical issues fixed
- [ ] All major issues fixed
- [ ] Minor issues fixed or documented as deferred
- [ ] Original acceptance criteria from issues met
</verification>

<success_criteria>
- All UAT issues from {plan}-ISSUES.md addressed
- Tests pass
- Ready for re-verification
</success_criteria>

<output>
After completion, create `.planning/phases/XX-name/{plan}-FIX-SUMMARY.md`
</output>
```
</step>

<step name="offer">
**Offer execution:**

```
---

## ✓ Fix Plan Created

**{plan}-FIX.md** — {N} issues to fix

| Severity | Count |
|----------|-------|
| Critical | {n}   |
| Major    | {n}   |
| Minor    | {n}   |

---

Would you like to:
1. Execute the fix plan now
2. Review the plan first
3. Modify the plan before executing

---
```

Use AskUserQuestion to get response.
If execute: `/gsd/execute-plan .planning/phases/XX-name/{plan}-FIX.md`
</step>

</process>

<success_criteria>
- [ ] ISSUES.md found and parsed
- [ ] Fix tasks created for each issue
- [ ] FIX.md written with proper structure
- [ ] User offered to execute or review
</success_criteria>
