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
Perform peer review (engagement quality review) of finalized work papers. Evaluates sufficiency, documentation quality, conclusion support, cross-references, independence, and compliance with AT-C 205. Generates review notes that must be dispositioned before sign-off.

ENGAGEMENT PHASE: Peer Review (Phase 7 of 8)
  Precondition: /soc2-workpaper completed with --finalize (work papers must have Status = "Finalized — Ready for Review")
  Produces: .audit/workpapers/{control-id}/REVIEW-NOTES.md
  Next: /soc2-package (final report assembly)
</objective>

<references>
@.claude/skills/soc2-references/aicpa-standards.md
@.claude/skills/soc2-templates/review-notes.md
</references>

<context>
$ARGUMENTS
</context>

<process>

## Welcome

Display the following before doing anything else:

```
===========================================================
  SOC 2 AUDITOR — Peer Review
===========================================================

  PHASE 7 of 8: Quality Review
  ─────────────────────────────────────────────────────────
  Previous: /soc2-workpaper (Work Paper Assembly)
  Next:     /soc2-package (Final Report)

  Peer review is your quality gate. Before the report
  leaves the firm, this review ensures:

    - All testing is sufficient and appropriate
    - All conclusions are defensible and supported
    - All documentation meets AT-C 205 standards
    - All cross-references are accurate

  Review levels:
    engagement   Standard engagement review (default)
    concurring   Engagement Quality Review (EQR) —
                 heightened scrutiny for high-risk engagements

  Usage:
    /soc2-review CC6.1-01
    /soc2-review all
    /soc2-review all --level concurring

  Estimated time: 5–10 min per control
===========================================================
```

## Step 0: Parse Arguments and Load Context

Parse $ARGUMENTS for:
- **control-id** or **"all"** — which work paper(s) to review
- **--level** (optional) — review level: "engagement" (default) or "concurring" (EQR)

Read `.audit/CONTROL-MATRIX.md`, `.audit/AUDIT-PLAN.md`, `.audit/RISK-ASSESSMENT.md`, and `.audit/config.json` for context.

If "all" is specified, identify all controls with finalized work papers. Skip any already signed off (Status = "Reviewed — Signed Off") unless --level concurring is specified (EQR reviews signed-off work papers too).

## Step 1: Load Work Paper (per control)

Read `.audit/workpapers/{control-id}/WORKPAPER.md`.

If the work paper status is not "Finalized — Ready for Review" (or "Reviewed — Signed Off" for concurring reviews):
- Warn: "Work paper for {{CONTROL_ID}} is not ready for review (Status: {{STATUS}}). Run /soc2-workpaper {{CONTROL_ID}} --finalize first."
- Skip this control.

Also read:
- `.audit/workpapers/{control-id}/SAMPLING-MEMO.md`
- `.audit/workpapers/{control-id}/TEST-RESULTS.md`

## Step 2: Execute Review Checklist

Evaluate the work paper against the quality checklist. For **concurring (EQR) reviews**, apply heightened scrutiny to items marked with [EQR+].

### 2a: Objective and Scope
- [ ] Objective is clearly stated
- [ ] Objective aligns with the TSC criteria being tested
- [ ] Correct criteria referenced (verify against control matrix)
- [ ] [EQR+] Objective correctly distinguishes Type I (design) vs Type II (design + operating)

### 2b: Population
- [ ] Population is adequately described (what, where, how many)
- [ ] Source of population identified
- [ ] Population size stated
- [ ] Completeness assertion documented (how do we know the population is complete?)
- [ ] Period matches the audit period in ENGAGEMENT.md
- [ ] [EQR+] Population source is independent of the control being tested

### 2c: Sampling
- [ ] Sampling method is appropriate for the risk level and control type
- [ ] Sample size is adequate per methodology and sampling tables
- [ ] Selection method is documented (and reproducible if random)
- [ ] Period coverage is sufficient (items span the full audit period)
- [ ] Cross-reference to sampling memo is accurate
- [ ] [EQR+] Sample size justified for the assessed risk level

### 2d: Procedure
- [ ] Test procedure is adequately described
- [ ] Procedure is responsive to the assessed risk level
- [ ] Test type (inspect/reperform/observe/inquiry) is appropriate for the control
- [ ] For high-risk controls: more than one test type used (or justified if not)
- [ ] Procedure addresses both design and operating effectiveness (Type II)
- [ ] [EQR+] Procedure would allow an experienced practitioner to reproduce the test

### 2e: Results
- [ ] Every sample item has a documented result
- [ ] Observations are specific and detailed (not generic "no issues noted")
- [ ] Results are internally consistent (no contradictions)
- [ ] Exception rate is correctly calculated
- [ ] [EQR+] Observations demonstrate the auditor actually examined the evidence (not rubber-stamped)

### 2f: Exceptions (if applicable)
- [ ] Each exception is fully described (what, when, who, how)
- [ ] Root cause is identified for each exception
- [ ] Impact assessment is documented
- [ ] Management response is recorded
- [ ] Compensating controls evaluated (if applicable)
- [ ] [EQR+] Exceptions assessed for materiality (qualitative factors considered)

### 2g: Conclusion
- [ ] Conclusion is present
- [ ] Conclusion is supported by the test results (not aspirational)
- [ ] If effective: exception rate is within tolerance AND exceptions are immaterial
- [ ] If exception: properly characterized with impact on criteria
- [ ] Conclusion uses correct language for engagement type (design vs. operating)
- [ ] For Type I: conclusion limited to design effectiveness — no operating effectiveness references
- [ ] [EQR+] Conclusion aligns with the firm's risk assessment for this control area

### 2h: Cross-References
- [ ] Audit plan reference is accurate and path exists
- [ ] Control matrix reference is accurate
- [ ] Sampling memo reference is accurate and path exists
- [ ] PBC item references are accurate
- [ ] Evidence file references exist (no broken paths)

### 2i: Professional Standards (AT-C 205)
- [ ] Sufficient appropriate evidence obtained for the conclusion reached
- [ ] Independence maintained (reviewer ≠ preparer; no self-review threat)
- [ ] Firm methodology followed
- [ ] Documentation meets AT-C 205 standard: "sufficient to enable an experienced practitioner, having no previous connection with the engagement, to understand the nature, timing, and extent of procedures performed, evidence obtained, and conclusions reached"

## Step 3: Generate Review Notes

Categorize findings into three tiers:

### Must Resolve (MR) — Blocking
Issues that MUST be fixed before sign-off. Use this category when:
- A required work paper element is missing (population, conclusion, etc.)
- The conclusion is not supported by the test results
- Criteria references are incorrect
- Sampling is inadequate for the assessed risk level
- Exception documentation is incomplete (missing root cause or management response)
- Cross-references are broken
- The work paper would not withstand regulatory review

### Should Consider (SC) — Non-Blocking Recommendation
Items the reviewer recommends the preparer address. The preparer may agree or provide a response:
- Observations could use more detail or specificity
- Conclusion language could be stronger or clearer
- Additional corroborative evidence would strengthen the conclusion
- Period coverage could be improved with better distribution
- Minor documentation gaps that don't affect conclusions

### Enhancement (EN) — Non-Blocking Suggestion
Nice-to-have improvements for continuous quality improvement:
- Formatting or readability improvements
- Additional context that would help report readers
- Alternative testing approaches for future periods
- Documentation efficiency suggestions

## Step 4: Present Review Notes

Present all findings to the auditor:

```
Review Notes for WP-{{CONTROL_ID}}
──────────────────────────────────────────────────
Review Level: {{LEVEL}} (engagement / concurring)
Checklist: {{PASS_COUNT}}/{{TOTAL_COUNT}} items passed

Must Resolve ({{MR_COUNT}}):
  MR-1: [description]
  MR-2: [description]

Should Consider ({{SC_COUNT}}):
  SC-1: [description]

Enhancement ({{EN_COUNT}}):
  EN-1: [description]
──────────────────────────────────────────────────
```

For each **Must Resolve** note, ask the auditor for disposition individually:

"MR-{{N}}: {{description}}

How would you like to address this?
- **Resolve:** Update the work paper (describe what to change)
- **Accepted:** Provide a written response justifying the current state
- **Revised:** Change the testing approach (may require re-testing)"

**GATE: ALL Must Resolve notes must be dispositioned before sign-off. No exceptions.**

If a disposition is "Revised" (requires re-testing), instruct the auditor:
"This item requires re-testing. Run /soc2-test {{CONTROL_ID}} to re-execute, then /soc2-workpaper {{CONTROL_ID}} --finalize, then re-run /soc2-review {{CONTROL_ID}}."

For Should Consider and Enhancement notes, present as a batch:
"The following notes are non-blocking. Please provide dispositions or 'acknowledged' for each:
[list notes]"

## Step 5: Apply Resolutions

For each "Resolve" disposition:
- Update the work paper with the correction (edit WORKPAPER.md)
- Mark the note as "Resolved" with details of what changed

For each "Accepted" disposition:
- Record the preparer's written response in the review notes
- Mark as "Accepted — [response summary]"

For each "Revised" disposition:
- Mark as "Revised — requires re-testing" and stop processing this control
- The auditor must re-test and re-run the review

## Step 6: Write REVIEW-NOTES.md

Write `.audit/workpapers/{control-id}/REVIEW-NOTES.md` using the review notes template:
- Review metadata (reviewer, date, level)
- All checklist items with pass/fail status
- All review notes with final dispositions
- Sign-off conditions

## Step 7: Determine Sign-Off

Sign-off requires ALL of the following:
1. All Must Resolve notes are dispositioned (Resolved or Accepted — not Revised)
2. No "Revised" dispositions pending (those require re-testing)
3. Reviewer confirms satisfaction with the work paper

If all conditions met:
- Update WORKPAPER.md status to "Reviewed — Signed Off"
- Update REVIEW-NOTES.md sign-off section with date
- Update STATE.md: increment WP Reviewed count

If conditions not met:
- Status remains "Under Review"
- List remaining open items clearly

## Step 8: Display Summary

```
===========================================================
  Review Complete — {{CONTROL_ID}}
===========================================================

  Review Level: {{LEVEL}}
  Checklist: {{PASS}}/{{TOTAL}} passed
  Review Notes: {{MR}} Must Resolve, {{SC}} Should Consider, {{EN}} Enhancement
  Sign-Off: {{SIGNED OFF / PENDING}}

  {{#if pending}}
  Open Items:
    {{#each open_notes}}
    - {{NOTE_ID}}: {{description}} ({{status}})
    {{/each}}
  Re-run /soc2-review {{CONTROL_ID}} after resolving.
  {{/if}}

  {{#if signed}}
  {{#if all_reviewed}}
  ─────────────────────────────────────────────────────────
  All work papers reviewed and signed off!
  NEXT STEP: Run /soc2-package to assemble the final report
  ─────────────────────────────────────────────────────────
  {{else}}
  Continue: /soc2-review <next-control-id>
  Or:       /soc2-review all
  {{/if}}
  {{/if}}

  Full workflow:
    1. /soc2-kickoff   (complete)
    2. /soc2-plan      (complete)
    3. /soc2-pbc       (complete)
    4. /soc2-sample    (complete)
    5. /soc2-test      (complete)
    6. /soc2-workpaper (complete)
    7. /soc2-review    ← YOU ARE HERE
    8. /soc2-package   ← NEXT
===========================================================
```

</process>

<guidelines>
- Review must be INDEPENDENT — approach the work paper as if seeing it for the first time. The reviewer is a different professional perspective, not a rubber stamp.
- The reviewer role is to CHALLENGE — identify real issues that affect audit quality. But be efficient: don't nitpick formatting when substance is strong.
- Must Resolve items are genuinely blocking — reserve this category for issues that would fail regulatory inspection or undermine the conclusion
- Should Consider items are professional recommendations — the preparer may provide a reasoned response and decline
- Enhancement items are for continuous improvement — never blocking, never urgent
- **Independence:** The reviewer must not have a self-review threat. If the reviewer performed the original testing, flag this as an independence concern in the review notes.
- **Concurring (EQR) reviews:** Apply heightened scrutiny. Focus on significant professional judgments (risk assessment alignment, conclusion defensibility, materiality of exceptions). EQR reviews can re-examine already-signed-off work papers.
- **Escalation:** If the reviewer identifies a conclusion that is clearly wrong (e.g., "effective" when exceptions exceed tolerance), this is always a Must Resolve, regardless of review level.
- Cross-reference accuracy is critical — broken references undermine the entire work paper chain
- If reviewing "all", process each work paper sequentially with its own complete review cycle. Do not batch sign-offs.
- A work paper that passes all checklist items may still receive review notes if the reviewer identifies qualitative concerns
</guidelines>
