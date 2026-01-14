# UAT Issues Template

Template for `.planning/phases/XX-name/{phase}-{plan}-ISSUES.md` - phase-scoped issues discovered during user acceptance testing.

**Purpose:** Capture issues found during /gsd/verify-work. Unlike global ISSUES.md (for deferred enhancements), this file tracks bugs and problems in specific delivered work.

**Location:** Same directory as the SUMMARY.md being tested.

---

## File Template

```markdown
# UAT Issues: Phase [X] Plan [Y]

**Tested:** [date]
**Source:** [path to SUMMARY.md that was tested]
**Tester:** User via /gsd/verify-work

## Open Issues

### UAT-001: [Brief description]

**Discovered:** [date]
**Phase/Plan:** [XX]-[YY]
**Severity:** [Blocker/Major/Minor/Cosmetic]
**Feature:** [Which feature from the test checklist]
**Description:** [User's description of the problem]
**Expected:** [What should have happened]
**Actual:** [What actually happened]
**Repro:** [Steps to reproduce, if captured]

### UAT-002: [Brief description]

...

## Resolved Issues

[Moved here after /gsd/plan-fix executes and fixes are verified]

### UAT-001: [Brief description]
**Resolved:** [date] - Fixed in [phase]-[plan]-FIX.md
**Commit:** [hash]

---

*Phase: XX-name*
*Plan: YY*
*Tested: [date]*
```

---

## Severity Guide

| Severity | Definition | Example |
|----------|------------|---------|
| **Blocker** | Feature completely unusable | App crashes on button click |
| **Major** | Feature works but significant problem | Form submits but data not saved |
| **Minor** | Feature usable but has issues | Button text slightly cut off |
| **Cosmetic** | Visual only, no functional impact | Wrong shade of color |

---

## UAT Numbering

- **Prefix:** `UAT-` (distinguishes from ISS- enhancement issues)
- **Scope:** Per-file numbering (UAT-001, UAT-002, etc. within each file)
- **No global numbering:** Each {phase}-{plan}-ISSUES.md has its own sequence

---

<good_examples>
```markdown
# UAT Issues: Phase 5 Plan 2

**Tested:** 2025-01-15
**Source:** .planning/phases/05-auth/05-02-SUMMARY.md
**Tester:** User via /gsd/verify-work

## Open Issues

### UAT-001: Login form doesn't show validation errors

**Discovered:** 2025-01-15
**Phase/Plan:** 05-02
**Severity:** Major
**Feature:** User login form
**Description:** When I enter an invalid email, nothing happens. No error message appears.
**Expected:** Red error message below email field saying "Invalid email format"
**Actual:** Field border turns red but no text explanation
**Repro:**
1. Go to /login
2. Enter "notanemail" in email field
3. Click Login button

### UAT-002: Password field allows paste

**Discovered:** 2025-01-15
**Phase/Plan:** 05-02
**Severity:** Cosmetic
**Feature:** User login form
**Description:** Can paste into password field. Minor UX inconsistency.
**Expected:** Paste disabled (matches signup form)
**Actual:** Paste works in login but not signup
**Repro:** Ctrl+V in password field

## Resolved Issues

[None yet]

---

*Phase: 05-auth*
*Plan: 02*
*Tested: 2025-01-15*
```
</good_examples>

<guidelines>
**When to create:**
- First time /gsd/verify-work finds an issue for a plan
- One file per plan tested

**Location:**
- `.planning/phases/XX-name/{phase}-{plan}-ISSUES.md`
- Lives alongside SUMMARY.md being tested

**Difference from global ISSUES.md:**
- Global ISSUES.md: Deferred enhancements (Rule 5 - nice-to-haves)
- UAT ISSUES.md: Actual problems found during testing

**Workflow:**
1. /gsd/verify-work creates this file with issues
2. /gsd/plan-fix reads this file and creates FIX.md plan
3. After FIX.md executes, issues move to "Resolved" section
4. File becomes historical record of what was found and fixed

**Resolution:**
- Don't delete resolved issues - move to "Resolved Issues" section
- Include fix reference (commit hash, plan that fixed it)
- File serves as audit trail
</guidelines>
