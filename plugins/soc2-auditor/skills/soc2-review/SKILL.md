---
name: soc2-review
description: "Peer review / engagement quality review of work papers"
argument-hint: "<control-id|all> [--level engagement|concurring]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
Perform peer review (engagement quality review) of finalized work papers. Evaluates sufficiency, documentation quality, conclusion support, cross-references, independence, and compliance. Generates review notes that must be dispositioned before sign-off.

Requires: `.audit/workpapers/{control-id}/WORKPAPER.md` must exist with Status = "Finalized".
</objective>

<references>
@.claude/skills/soc2-references/aicpa-standards.md
@.claude/skills/soc2-templates/review-notes.md
</references>

<context>
$ARGUMENTS
</context>

<process>

## Step 0: Parse Arguments and Load Context

Parse $ARGUMENTS for:
- **control-id** or **"all"** — which work paper(s) to review
- **--level** (optional) — review level: "engagement" (default) or "concurring" (EQR)

Read `.audit/CONTROL-MATRIX.md` and `.audit/AUDIT-PLAN.md` for context.

If "all" is specified, identify all controls with finalized work papers.

## Step 1: Load Work Paper (per control)

Read `.audit/workpapers/{control-id}/WORKPAPER.md`.

If the work paper status is not "Finalized — Ready for Review":
- Warn: "Work paper for {{CONTROL_ID}} is not finalized. Run /soc2-workpaper {{CONTROL_ID}} --finalize first."
- Skip this control.

Also read:
- `.audit/workpapers/{control-id}/SAMPLING-MEMO.md`
- `.audit/workpapers/{control-id}/TEST-RESULTS.md`
- `.audit/RISK-ASSESSMENT.md` (for risk context)

## Step 2: Execute Review Checklist

Evaluate each work paper against the quality checklist:

### 2a: Objective and Scope
- [ ] Objective is clearly stated
- [ ] Objective aligns with the TSC criteria being tested
- [ ] Correct criteria referenced (verify against control matrix)

### 2b: Population
- [ ] Population is adequately described (what, where, how many)
- [ ] Source of population identified
- [ ] Population size stated
- [ ] Completeness assertion documented (how do we know the population is complete?)
- [ ] Period matches the audit period in ENGAGEMENT.md

### 2c: Sampling
- [ ] Sampling method is appropriate for the risk level and control type
- [ ] Sample size is adequate per methodology and sampling tables
- [ ] Selection method is documented
- [ ] Period coverage is sufficient (items span the full audit period)
- [ ] Cross-reference to sampling memo is accurate

### 2d: Procedure
- [ ] Test procedure is adequately described
- [ ] Procedure is responsive to the assessed risk level
- [ ] Test type (inspect/reperform/observe/inquiry) is appropriate
- [ ] For high-risk controls: more than one test type used
- [ ] Procedure addresses both design and operating effectiveness (Type II)

### 2e: Results
- [ ] Every sample item has a documented result
- [ ] Observations are specific and detailed (not generic)
- [ ] Results are internally consistent (no contradictions)
- [ ] Exception rate is correctly calculated

### 2f: Exceptions
- [ ] Each exception is fully described (what, when, who, how)
- [ ] Root cause is identified for each exception
- [ ] Impact assessment is documented
- [ ] Management response is recorded
- [ ] Compensating controls evaluated (if applicable)

### 2g: Conclusion
- [ ] Conclusion is present
- [ ] Conclusion is supported by the test results
- [ ] If effective: exception rate is within tolerance
- [ ] If exception: properly characterized and impact assessed
- [ ] Conclusion uses appropriate language (design vs. operating effectiveness)
- [ ] For Type I: conclusion limited to design effectiveness

### 2h: Cross-References
- [ ] Audit plan reference is accurate
- [ ] Control matrix reference is accurate
- [ ] Sampling memo reference is accurate
- [ ] PBC item references are accurate
- [ ] Evidence file references exist

### 2i: Professional Standards
- [ ] Sufficient appropriate evidence obtained
- [ ] Independence maintained (no self-review concerns)
- [ ] Firm methodology followed
- [ ] Documentation meets AT-C 205 requirements (reproducible by experienced practitioner)

## Step 3: Generate Review Notes

Categorize findings:

### Must Resolve (MR)
Issues that must be fixed before sign-off:
- Missing required elements (population, conclusion, etc.)
- Conclusion not supported by results
- Incorrect criteria references
- Inadequate sampling for risk level
- Missing exception documentation
- Cross-reference errors

### Should Consider (SC)
Items the reviewer recommends addressing:
- Insufficient detail in observations
- Conclusion language could be stronger/clearer
- Additional corroborative evidence recommended
- Period coverage could be improved
- Minor documentation gaps

### Enhancement (EN)
Nice-to-have improvements (non-blocking):
- Formatting improvements
- Additional context that would help report readers
- Alternative testing approach for next period
- Documentation efficiency suggestions

## Step 4: Present Review Notes

For each review note, present to the auditor (who acts as preparer in this context):

"Review Notes for WP-{{CONTROL_ID}}:

Checklist: {{PASS_COUNT}}/{{TOTAL_COUNT}} passed

Must Resolve ({{MR_COUNT}}):
{{#each MR notes}}
  MR-{{N}}: {{description}}
{{/each}}

Should Consider ({{SC_COUNT}}):
{{#each SC notes}}
  SC-{{N}}: {{description}}
{{/each}}

Enhancement ({{EN_COUNT}}):
{{#each EN notes}}
  EN-{{N}}: {{description}}
{{/each}}"

For each **Must Resolve** note, ask the auditor for disposition:

"MR-{{N}}: {{description}}

How would you like to address this?
- Resolve: Update the work paper (describe the update)
- Accepted: Provide a response justifying current state
- Revised: Change the approach"

**GATE: ALL Must Resolve notes must be dispositioned before sign-off.**

For Should Consider and Enhancement notes, present as a batch:

"The following notes are non-blocking. Please provide dispositions or 'acknowledged' for each:
[list notes]"

## Step 5: Apply Resolutions

For each "Resolve" disposition:
- Update the work paper with the correction
- Mark the note as "Resolved" with details of the change

For each "Accepted" disposition:
- Record the preparer's response
- Mark as "Accepted"

## Step 6: Write REVIEW-NOTES.md

Write `.audit/workpapers/{control-id}/REVIEW-NOTES.md` using the review notes template:
- All checklist items with pass/fail
- All review notes with dispositions
- Sign-off conditions

## Step 7: Determine Sign-Off

If all Must Resolve notes are dispositioned AND reviewer is satisfied:
- Update WORKPAPER.md status to "Reviewed — Signed Off"
- Update REVIEW-NOTES.md sign-off section
- Update STATE.md: increment WP Reviewed count

If any Must Resolve notes remain open:
- Status remains "Under Review"
- List remaining open items

## Step 8: Display Summary

```
Review Complete — {{CONTROL_ID}}

Checklist: {{PASS}}/{{TOTAL}} passed
Review Notes: {{MR}} Must Resolve, {{SC}} Should Consider, {{EN}} Enhancement
Sign-Off: {{SIGNED or PENDING}}

{{#if pending}}
Open Items:
{{#each open_notes}}
  - {{NOTE_ID}}: {{description}}
{{/each}}
Re-run /soc2-review {{CONTROL_ID}} after resolving open items.
{{/if}}

{{#if signed}}
Files Updated:
  .audit/workpapers/{{CONTROL_ID}}/WORKPAPER.md (status updated)
  .audit/workpapers/{{CONTROL_ID}}/REVIEW-NOTES.md
  .audit/STATE.md

{{#if all_reviewed}}
All work papers reviewed and signed off.
Next step: Run /soc2-package to assemble the final report.
{{else}}
Continue reviewing: /soc2-review <next-control-id>
Or review all remaining: /soc2-review all
{{/if}}
{{/if}}
```

</process>

<guidelines>
- Review must be INDEPENDENT — approach the work paper as if seeing it for the first time
- The reviewer role is to challenge, not rubber-stamp — identify real issues
- Must Resolve items are genuinely blocking — use this category for issues that affect the quality or accuracy of the work paper
- Should Consider items are professional recommendations — the preparer may disagree
- Enhancement items are for continuous improvement — never blocking
- For concurring (EQR) level reviews: apply heightened scrutiny, focus on significant judgments and high-risk areas
- A work paper that passes all checklist items may still have review notes if the reviewer identifies qualitative issues
- The review should be efficient — don't nitpick formatting when substance is strong
- Cross-reference accuracy is critical — broken references undermine the entire work paper
- If reviewing "all", process each work paper sequentially with its own review cycle
</guidelines>
