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

When --finalize is specified, marks work papers as review-ready and locks them.

Requires: `.audit/workpapers/{control-id}/SAMPLING-MEMO.md` and `.audit/workpapers/{control-id}/TEST-RESULTS.md` must exist.
</objective>

<references>
@.claude/skills/soc2-templates/workpaper.md
</references>

<context>
$ARGUMENTS
</context>

<process>

## Step 0: Parse Arguments and Load Context

Parse $ARGUMENTS for:
- **control-id** or **"all"** — which control(s) to assemble work papers for
- **--finalize** — if present, mark work papers as review-ready

Read `.audit/CONTROL-MATRIX.md` to get the list of controls.

If "all" is specified, identify all controls that have both SAMPLING-MEMO.md and TEST-RESULTS.md in their workpaper directories.

## Step 1: Gather Artifacts (per control)

For each control being processed, read:

1. **SAMPLING-MEMO.md** — sampling parameters, population, selected items
2. **TEST-RESULTS.md** — test observations, exceptions, conclusion
3. **CONTROL-MATRIX.md** — control details, criteria mapping
4. **AUDIT-PLAN.md** — testing strategy for cross-reference
5. **PBC-LIST.md** — identify corresponding PBC items for cross-reference

If any required artifact is missing, skip the control and report:
```
Skipped {{CONTROL_ID}}: Missing {{ARTIFACT}}. Run /soc2-test {{CONTROL_ID}} first.
```

## Step 2: Assemble Work Paper (per control)

Using the work paper template, build the formal work paper:

### 2a: Header
- Work Paper Ref: WP-{CONTROL_ID}
- Control ID and description
- TSC criteria addressed
- Preparer (from test results)
- Date prepared (today)
- Status: Draft (or Finalized if --finalize)

### 2b: Objective
Write a clear objective statement:
"To evaluate the design and operating effectiveness of [control description] to meet [TSC criteria] criteria."

For Type I: "To evaluate the design effectiveness of..."

### 2c: Criteria Addressed
List each TSC criteria the control maps to, with descriptions from the control matrix.

### 2d: Population
Pull from the sampling memo:
- Population description
- Source
- Size
- Period
- Completeness verification

### 2e: Sample
Pull from the sampling memo:
- Reference to sampling memo
- Method (statistical/judgmental/frequency-based)
- Sample size
- Selection method

### 2f: Procedure
Write a narrative description of the test procedure performed:
- What test type was used (inspect/reperform/observe/inquiry)
- Specific steps taken
- What was examined/verified

Pull the actual procedure from test results and formalize it.

### 2g: Results Table
Pull per-item results from TEST-RESULTS.md:
- Item identifier
- Date
- Observation summary
- Result (Effective/Exception)

### 2h: Exceptions
If exceptions were found, pull full exception details:
- Exception description
- Root cause
- Impact
- Management response
- Compensating controls (if any)

### 2i: Conclusion
Write a professional conclusion:

**No exceptions:**
"Based on the procedures performed, the control [description] was suitably designed and operated effectively throughout the period [start] to [end] to meet the [criteria] criteria. No exceptions were noted."

**Exceptions within tolerance:**
"Based on the procedures performed, [N] exception(s) were noted out of [sample size] items tested (exception rate: [X]%). The exception rate is within the tolerable deviation rate of [Y]%. Considering the nature of the exception(s) and the [compensating controls/management response], we conclude the control operated effectively in all material respects."

**Exceptions exceeding tolerance:**
"Based on the procedures performed, [N] exception(s) were noted out of [sample size] items tested (exception rate: [X]%), which exceeds the tolerable deviation rate of [Y]%. [Description of impact]. This exception will be reported in Section IV of the SOC 2 report."

For Type I (design only):
"Based on the procedures performed, the control [description] was suitably designed as of [date] to meet the [criteria] criteria."

### 2j: Cross-References
Build the cross-reference table:
- Audit Plan: .audit/AUDIT-PLAN.md, section for this control's category
- Control Matrix: .audit/CONTROL-MATRIX.md, row for {CONTROL_ID}
- Sampling Memo: .audit/workpapers/{CONTROL_ID}/SAMPLING-MEMO.md
- PBC Item(s): PBC #s from PBC-LIST.md that map to this control
- Evidence Files: List paths to evidence files referenced in testing

## Step 3: Completeness Check

For each assembled work paper, verify:

- [ ] Objective present and clear
- [ ] At least one TSC criteria listed
- [ ] Population described with source and size
- [ ] Sample method and size documented
- [ ] Procedure describes what was done
- [ ] Every sample item has a result
- [ ] Exceptions (if any) have full details
- [ ] Conclusion is present and supported by results
- [ ] Cross-references are complete

If any check fails, note it in the work paper as "INCOMPLETE — [missing element]".

## Step 4: Finalize (if --finalize)

If --finalize is specified:
- Set Status to "Finalized — Ready for Review"
- Add finalization timestamp
- Update STATE.md: increment WP Finalized count

## Step 5: Write Work Papers

Write `.audit/workpapers/{CONTROL_ID}/WORKPAPER.md` for each processed control.

## Step 6: Update STATE.md

Update `.audit/STATE.md`:
- WP Draft count (or WP Finalized if --finalize)
- Current phase if all controls have work papers

## Step 7: Display Summary

```
Work Papers Assembled

{{COUNT}} work paper(s) created:
{{#each}}
  WP-{{CONTROL_ID}} — {{STATUS}} {{COMPLETENESS}}
{{/each}}

{{#if finalize}}
All work papers are now Ready for Review.
Next step: Run /soc2-review to begin peer review.
{{else}}
Run /soc2-workpaper all --finalize when ready to lock for review.
{{/if}}
```

</process>

<guidelines>
- Work papers must be SELF-CONTAINED — a reviewer should understand the entire test without reading other files
- Conclusions must be SUPPORTED by the results — never state "effective" if exceptions exceed tolerance
- Cross-references must be ACCURATE — verify paths exist before including
- For "all" mode, process every control with complete artifacts, skip incomplete ones with clear explanation
- Maintain consistent formatting across all work papers
- The conclusion is the most important section — it must be professional, precise, and defensible
- Do not add opinions beyond what the evidence supports
- For Type I engagements, conclusions should address design effectiveness only — never reference operating effectiveness
- Work papers should use the past tense for procedures performed
</guidelines>
