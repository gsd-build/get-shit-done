---
name: soc2-workpaper
description: "Assemble formal work papers from testing artifacts with cross-references"
argument-hint: "<control-id|all> [--finalize]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
---

<objective>
Assemble formal work papers from testing artifacts (sampling memos, test results). Each work paper is a comprehensive, self-contained document that ties together the objective, population, sample, procedure, results, exceptions, and conclusion for a control.

Work papers are the foundation of the audit file — they must stand up to peer review and regulatory inspection.

When --finalize is specified, marks work papers as review-ready.

ENGAGEMENT PHASE: Work Paper Assembly (Phase 6 of 8)
  Precondition: /soc2-test completed (.audit/workpapers/{control-id}/TEST-RESULTS.md must exist)
  Produces: .audit/workpapers/{control-id}/WORKPAPER.md
  Next: /soc2-review (peer review and quality review)
</objective>

<references>
@.claude/skills/soc2-templates/workpaper.md
</references>

<context>
$ARGUMENTS
</context>

<process>

## Welcome

Display the following before doing anything else:

```
===========================================================
  SOC 2 AUDITOR — Work Paper Assembly
===========================================================

  PHASE 6 of 8: Work Papers
  ─────────────────────────────────────────────────────────
  Previous: /soc2-test (Control Testing)
  Next:     /soc2-review (Peer Review)

  Work papers are the formal record of your audit. This
  skill pulls together your sampling approach, test results,
  and evidence into professional documents ready for review.

  Each work paper is SELF-CONTAINED — a reviewer should
  understand the entire test without reading other files.

  Usage:
    /soc2-workpaper CC6.1-01           Single control
    /soc2-workpaper all                All tested controls
    /soc2-workpaper all --finalize     Finalize for review

  Estimated time: 2–5 min per control
===========================================================
```

## Step 0: Parse Arguments and Load Context

Parse $ARGUMENTS for:
- **control-id** or **"all"** — which control(s) to assemble work papers for
- **--finalize** — if present, mark work papers as review-ready

Read `.audit/CONTROL-MATRIX.md` and `.audit/config.json` (for engagement type).

If "all" is specified, identify all controls that have both SAMPLING-MEMO.md and TEST-RESULTS.md in their workpaper directories. Process them in control matrix order (by TSC criteria, then by control ID).

## Step 1: Gather Artifacts (per control)

For each control being processed, read:

1. **SAMPLING-MEMO.md** — sampling parameters, population, selected items (REQUIRED)
2. **TEST-RESULTS.md** — test observations, exceptions, conclusion (REQUIRED)
3. **CONTROL-MATRIX.md** — control details, criteria mapping (already loaded)
4. **AUDIT-PLAN.md** — testing strategy for cross-reference
5. **PBC-LIST.md** — identify corresponding PBC items for cross-reference

If a required artifact is missing, skip the control and report:
```
Skipped {{CONTROL_ID}}: Missing {{ARTIFACT}}.
  → Run /soc2-test {{CONTROL_ID}} to complete testing first.
```

If processing "all", continue to the next control after skipping.

## Step 2: Assemble Work Paper (per control)

Using the work paper template (@.claude/skills/soc2-templates/workpaper.md), build the formal work paper:

### 2a: Header
- Work Paper Ref: WP-{CONTROL_ID}
- Control ID and description
- TSC criteria addressed
- Preparer (from test results, or "AI-Assisted" if not specified)
- Date prepared (today, ISO 8601)
- Status: "Draft" (or "Finalized — Ready for Review" if --finalize)

### 2b: Objective

**Type II:**
"To evaluate the design and operating effectiveness of [control description] in meeting the [TSC criteria] criteria throughout the period [start] to [end]."

**Type I:**
"To evaluate the design effectiveness of [control description] in meeting the [TSC criteria] criteria as of [date]."

### 2c: Criteria Addressed
List each TSC criteria the control maps to (a single control may satisfy multiple criteria), with descriptions from the control matrix.

### 2d: Population
Pull from the sampling memo:
- Population description
- Source (where the population was obtained)
- Size (total items in population)
- Period (date range covered)
- Completeness verification (how we know the population is complete)

### 2e: Sample
Pull from the sampling memo:
- Cross-reference: "See SAMPLING-MEMO.md in this workpaper directory"
- Method (statistical/judgmental/frequency-based)
- Sample size
- Selection method (random with seed / systematic / haphazard)

**Type I note:** For Type I engagements, this section reads: "Sample size: 1 (Type I design walkthrough — single instance)."

### 2f: Procedure
Write a narrative description of the test procedure performed, in past tense:
- What test type was used (inspected / reperformed / observed / inquired)
- Specific steps taken during the test
- What was examined or verified at each step

Pull the actual test steps from TEST-RESULTS.md and formalize into professional narrative. If TEST-RESULTS.md lacks detail, supplement from the test procedures reference.

**Type I note:** For Type I, the procedure section describes only the design walkthrough: "We inspected [evidence] to determine whether [control] is suitably designed to [objective]."

### 2g: Results Table
Pull per-item results from TEST-RESULTS.md:

| # | Item Identifier | Date | Observation | Result |
|---|----------------|------|-------------|--------|

Every sample item MUST have a row. No omissions.

### 2h: Exceptions
If exceptions were found, pull full exception details for each:
- Exception number
- Item reference
- Description of the deviation
- Root cause (design flaw / procedural miss / human error / system issue)
- Impact assessment
- Management response
- Compensating controls evaluated (if any)

If no exceptions: "No exceptions were noted."

### 2i: Conclusion
Write a professional conclusion based on results:

**No exceptions (Type II):**
"Based on the procedures performed, the control [description] was suitably designed and operated effectively throughout the period [start] to [end] to meet the [criteria] criteria. No exceptions were noted."

**Exceptions within tolerance (Type II):**
"Based on the procedures performed, [N] exception(s) were noted out of [sample size] items tested (exception rate: [X]%). The exception rate is within the tolerable deviation rate of [Y]%. Considering the nature of the exception(s) and [compensating controls / management remediation], we conclude the control operated effectively in all material respects."

**Exceptions exceeding tolerance (Type II):**
"Based on the procedures performed, [N] exception(s) were noted out of [sample size] items tested (exception rate: [X]%), which exceeds the tolerable deviation rate of [Y]%. [Description of impact on the criteria]. This exception will be reported in Section IV of the SOC 2 report."

**Type I (design only — no operating effectiveness):**
"Based on the procedures performed, the control [description] was suitably designed as of [date] to meet the [criteria] criteria."

**Type I with design deficiency:**
"Based on the procedures performed, the control [description] was NOT suitably designed as of [date] to meet the [criteria] criteria. [Description of the design deficiency]."

### 2j: Cross-References
Build the cross-reference table:
- Audit Plan: .audit/AUDIT-PLAN.md
- Control Matrix: .audit/CONTROL-MATRIX.md, row for {CONTROL_ID}
- Sampling Memo: .audit/workpapers/{CONTROL_ID}/SAMPLING-MEMO.md
- PBC Item(s): List PBC #s from PBC-LIST.md that map to this control
- Evidence Files: List paths/references to evidence files used in testing

Verify each cross-reference path exists. If a path is broken, flag it as "[BROKEN REFERENCE — verify path]".

## Step 3: Completeness Check

For each assembled work paper, verify:

- [ ] Objective present, clear, and matches engagement type (Type I/II)
- [ ] At least one TSC criteria listed
- [ ] Population described with source, size, and completeness assertion
- [ ] Sample method and size documented
- [ ] Procedure describes what was done (in past tense)
- [ ] Every sample item has a result row
- [ ] Exceptions (if any) have full details including root cause and management response
- [ ] Conclusion is present, supported by results, and uses correct language for engagement type
- [ ] Cross-references are complete and paths are valid
- [ ] For Type I: no references to "operating effectiveness"

If any check fails, note it in the work paper header as: "⚠ INCOMPLETE — [missing element]. Resolve before finalizing."

## Step 4: Finalize (if --finalize)

If --finalize is specified:
- Verify ALL completeness checks pass (do not finalize incomplete work papers)
- Set Status to "Finalized — Ready for Review"
- Add finalization timestamp
- Update STATE.md: increment WP Finalized count

If completeness checks fail and --finalize was requested:
```
Cannot finalize WP-{{CONTROL_ID}}: Completeness check failed.
  Missing: [list of failed checks]
Resolve these issues and re-run with --finalize.
```

## Step 5: Write Work Papers

Write `.audit/workpapers/{CONTROL_ID}/WORKPAPER.md` for each processed control.

If a WORKPAPER.md already exists, overwrite it (this is a regeneration, not an append).

## Step 6: Update STATE.md

Update `.audit/STATE.md`:
- WP Draft count (or WP Finalized if --finalize)
- Current phase: "Work Papers" if in progress, advance if all complete

## Step 7: Display Summary

```
===========================================================
  Work Papers Assembled
===========================================================

  {{COUNT}} work paper(s) processed:
  {{#each}}
    WP-{{CONTROL_ID}} — {{STATUS}}
  {{/each}}

  {{#if incomplete}}
  ⚠ {{INCOMPLETE_COUNT}} work paper(s) have completeness issues.
     Resolve and re-run before finalizing.
  {{/if}}

  {{#if finalized}}
  All work papers are Finalized — Ready for Review.
  ─────────────────────────────────────────────────────────
  NEXT STEP: Run /soc2-review all to begin peer review
  ─────────────────────────────────────────────────────────
  {{else}}
  Run /soc2-workpaper all --finalize to lock for review.
  {{/if}}

  Full workflow:
    1. /soc2-kickoff   (complete)
    2. /soc2-plan      (complete)
    3. /soc2-pbc       (complete)
    4. /soc2-sample    (complete)
    5. /soc2-test      (complete)
    6. /soc2-workpaper ← YOU ARE HERE
    7. /soc2-review    ← NEXT
    8. /soc2-package
===========================================================
```

</process>

<guidelines>
- Work papers must be SELF-CONTAINED — a reviewer (per AT-C 205) should understand the entire test without reading other files. Include enough context that an experienced practitioner with no prior connection to the engagement can understand the work performed and conclusions reached.
- Conclusions must be SUPPORTED by the results — never state "effective" if exceptions exceed tolerance
- Cross-references must be ACCURATE — verify paths exist before including them
- For "all" mode, process controls in control matrix order (by criteria, then by ID). Skip incomplete ones with clear explanation.
- Maintain consistent formatting across all work papers — they will be assembled into the report
- The conclusion is the most critical section — it must be professional, precise, and defensible
- Do not add opinions beyond what the evidence supports
- For Type I engagements: conclusions address design effectiveness ONLY. Never reference "operating effectiveness" or "throughout the period."
- For Type II engagements: conclusions address BOTH design and operating effectiveness
- Work papers should use past tense for procedures performed ("We inspected..." not "Inspect...")
- Do not finalize work papers that fail completeness checks — force the user to resolve first
</guidelines>
