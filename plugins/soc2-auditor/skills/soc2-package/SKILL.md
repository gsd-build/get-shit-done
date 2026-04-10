---
name: soc2-package
description: "Assemble final audit report package and export to Word"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
Assemble the final SOC 2 report package from all engagement artifacts. Produces all four report sections (opinion, assertion, system description review, tests and results) and exports to Word via pandoc.

This is the final skill in the engagement lifecycle. All controls must be tested, all work papers finalized, and all reviews complete before running this skill.
</objective>

<references>
@.claude/skills/soc2-references/report-components.md
@.claude/skills/soc2-references/aicpa-standards.md
@.claude/skills/soc2-templates/report-opinion.md
@.claude/skills/soc2-templates/management-assertion.md
</references>

<context>
$ARGUMENTS
</context>

<process>

## Step 1: Pre-Flight Check

Read all engagement files and verify readiness:

### 1a: Engagement Completeness

Read `.audit/CONTROL-MATRIX.md` and verify:
- [ ] All controls have Status != "Not Tested"
- [ ] All work papers exist (.audit/workpapers/{control-id}/WORKPAPER.md)
- [ ] All work papers are "Reviewed — Signed Off"

Read `.audit/STATE.md` and verify:
- [ ] Tested count = Total Controls
- [ ] WP Reviewed count = Total Controls
- [ ] No open Must Resolve review notes

If ANY check fails, report the gaps and stop:

```
Pre-Flight Check FAILED

Missing:
  - {{CONTROL_ID}}: {{ISSUE}} (e.g., "Not tested", "Work paper not finalized", "Review pending")

Please resolve all gaps before running /soc2-package.
Run /soc2-test, /soc2-workpaper, or /soc2-review for the affected controls.
```

**GATE: ALL pre-flight checks must pass before proceeding.**

### 1b: Load Engagement Context

Read all required files:
- `.audit/ENGAGEMENT.md` — client info, period, type, team
- `.audit/SCOPE.md` — TSC categories, boundaries
- `.audit/RISK-ASSESSMENT.md` — risk levels
- `.audit/AUDIT-PLAN.md` — testing strategy
- `.audit/CONTROL-MATRIX.md` — all controls with results
- `.audit/config.json` — firm info, word template setting
- All work papers and review notes

## Step 2: Determine Opinion

### 2a: Analyze Exception Summary

From the control matrix, identify:
- Total controls with exceptions
- Exception details from each work paper
- TSC criteria affected by exceptions

### 2b: Materiality Assessment

For each exception, assess materiality:

**Quantitative factors:**
- Number of user entities affected
- Volume of transactions affected
- Severity of the control failure

**Qualitative factors:**
- Nature: systematic vs. isolated
- Root cause: design flaw vs. one-time procedural miss
- Duration: persisted throughout period vs. corrected promptly
- Compensating controls: effective vs. none
- Pervasiveness: affects multiple criteria vs. single control

### 2c: Opinion Determination

| Scenario | Opinion |
|----------|---------|
| No exceptions | Unqualified |
| Exceptions, but immaterial (individually and aggregate) | Unqualified (exceptions noted in Section IV) |
| Material exception(s) in specific area(s) | Qualified |
| Pervasive material exceptions | Adverse |

Present the opinion determination to the auditor:

"Opinion Recommendation:

Total Controls: {{TOTAL}}
Controls with Exceptions: {{EXCEPTION_COUNT}}
Affected Criteria: {{AFFECTED_CRITERIA}}

Exception Analysis:
{{#each exception}}
  {{CONTROL_ID}}: {{DESCRIPTION}} — Assessed as {{MATERIAL/IMMATERIAL}}
{{/each}}

Recommended Opinion: {{UNQUALIFIED/QUALIFIED/ADVERSE}}
Rationale: {{RATIONALE}}

Do you agree with this opinion? (yes / adjust)"

**GATE: Engagement partner must confirm the opinion.**

## Step 3: Assemble Section I — Independent Service Auditor's Report

Using the report opinion template:

### For Type I:
Replace placeholders:
- Report period: "as of {{DATE}}"
- Design effectiveness language only
- Remove operating effectiveness references
- Remove Type II-only paragraphs

### For Type II:
Replace placeholders:
- Report period: "for the period {{START}} to {{END}}"
- Include design AND operating effectiveness language
- Include testing paragraph

### Opinion-Specific:
- **Unqualified:** Standard opinion paragraph
- **Qualified:** Add "Basis for Qualified Opinion" paragraph before opinion
- **Adverse:** Add "Basis for Adverse Opinion" paragraph, change opinion language

Fill in:
- Client name, system name
- TSC categories in scope (listed by name)
- Firm name and address
- Report date
- Subservice organization paragraph (if applicable)
- Restricted use paragraph with specific intended users

Write to `.audit/deliverables/section-1-opinion.md`

## Step 4: Assemble Section II — Management's Assertion

Using the management assertion template:

Fill in:
- Client name, system name
- Period or as-of date
- TSC categories addressed
- Subservice organization description and method
- CUECs from SCOPE.md
- CSOCs (if carve-out method)
- Service commitments from ENGAGEMENT.md

### Type I:
- Assertions a) and b) only (description + design)

### Type II:
- Assertions a), b), and c) (description + design + operating)

Write to `.audit/deliverables/section-2-assertion.md`

## Step 5: Assemble Section III — System Description Review

Build a checklist-based review of the system description (provided by client or referenced from engagement):

### Description Criteria Checklist (DC 200):
- [ ] Types of services provided
- [ ] Principal service commitments and system requirements
- [ ] Infrastructure components
- [ ] Software components
- [ ] People (roles and responsibilities)
- [ ] Procedures (automated and manual)
- [ ] Data (types processed, stored, transmitted)
- [ ] System boundaries
- [ ] Controls mapped to criteria
- [ ] CUECs listed
- [ ] CSOCs listed (if carve-out)
- [ ] Changes during period (Type II)
- [ ] Incidents during period (Type II)

Present the checklist to the auditor and note any deficiencies:

"Section III — System Description Review:

[Checklist with pass/fail]

Any items that need attention before finalizing?"

Write review notes to `.audit/deliverables/section-3-description-review.md`

## Step 6: Assemble Section IV — Tests of Controls and Results

Build the tests and results table from all work papers:

For each control in the control matrix (sorted by TSC criteria):

| Trust Service Criteria | Control Activity | Test Applied | Test Description | Results |
|----------------------|-----------------|-------------|-----------------|---------|
| CC6.1 | [Description from matrix] | Inspected | [Procedure from work paper] | [No exceptions noted / Exception details] |

### Format results:
- **No exceptions:** "No exceptions noted."
- **Exceptions:** "[N] of [sample size] items tested exhibited [specific deviation]. The exception resulted from [root cause]. [Management response if applicable]."

Write to `.audit/deliverables/section-4-controls-tests-results.md`

## Step 7: Present Draft Package for Review

Present the complete package to the engagement partner:

"SOC 2 Type {{TYPE}} Report Package — DRAFT

Section I: {{OPINION_TYPE}} Opinion
  [Summary of opinion]

Section II: Management's Assertion
  [Summary of assertions]

Section III: System Description Review
  [Checklist summary — X/Y passed]

Section IV: Tests and Results
  {{TOTAL_CONTROLS}} controls tested
  {{EXCEPTION_COUNT}} exceptions reported

Please review the draft package. Any changes needed before finalizing?"

**GATE: Engagement partner must approve the draft package.**

## Step 8: Export to Word

Check if pandoc is available:
```bash
which pandoc
```

If pandoc is available:

### Concatenate all sections into a single Markdown file:
```bash
cat .audit/deliverables/section-1-opinion.md \
    .audit/deliverables/section-2-assertion.md \
    .audit/deliverables/section-3-description-review.md \
    .audit/deliverables/section-4-controls-tests-results.md \
    > .audit/deliverables/report-combined.md
```

### Convert to Word:
```bash
# Check for custom template
TEMPLATE_ARG=""
if [ -f ".audit/config.json" ]; then
  TEMPLATE=$(node -e "const c=require('./.audit/config.json'); if(c.settings?.wordTemplate) console.log(c.settings.wordTemplate)")
  if [ -n "$TEMPLATE" ] && [ -f "$TEMPLATE" ]; then
    TEMPLATE_ARG="--reference-doc=$TEMPLATE"
  fi
fi

pandoc .audit/deliverables/report-combined.md \
  -f markdown \
  -t docx \
  $TEMPLATE_ARG \
  -o .audit/deliverables/report.docx
```

If pandoc is not available:
```
Note: pandoc is not installed. Word export skipped.
Install pandoc to enable .docx export: https://pandoc.org/installing.html
The report is available in Markdown format in .audit/deliverables/
```

## Step 9: Update STATE.md

Update `.audit/STATE.md`:
- Phase: Report Issued
- Report Date: today
- Opinion: [type]

## Step 10: Display Final Summary

```
SOC 2 Type {{TYPE}} Report Package Complete

Client: {{CLIENT_NAME}}
System: {{SYSTEM_NAME}}
Period: {{PERIOD}}
Opinion: {{OPINION_TYPE}}

Report Sections:
  .audit/deliverables/section-1-opinion.md
  .audit/deliverables/section-2-assertion.md
  .audit/deliverables/section-3-description-review.md
  .audit/deliverables/section-4-controls-tests-results.md
  {{#if docx}}
  .audit/deliverables/report.docx (Word format)
  {{/if}}

Controls Summary:
  Total: {{TOTAL}}
  Effective: {{EFFECTIVE}}
  Exceptions: {{EXCEPTIONS}}

The engagement is complete. The report package is ready for delivery.

Remember:
  - Management must sign the assertion (Section II) before delivery
  - The report is restricted use — distribute only to intended users
  - Retain engagement documentation per firm policy (minimum 5 years)
```

</process>

<guidelines>
- Pre-flight check is NON-NEGOTIABLE — never package an incomplete engagement
- The opinion is the most consequential judgment in the engagement — always confirm with the partner
- Unqualified does NOT mean "no exceptions" — it means exceptions are immaterial
- Qualified means specific, identified exceptions are material but not pervasive
- Adverse is rare and significant — pervasive material failures
- Section IV must accurately reflect the work papers — do not soften or omit exception details
- Report dates must be consistent across all sections
- Management's assertion must be signed by management, not the auditor — note this requirement
- The report is restricted use — the restricted use paragraph is legally significant
- If pandoc is not installed, the Markdown deliverables are fully sufficient — Word export is a convenience
- Do not include Section V (Other Information) unless the client specifically requests it
- Cross-check: every control in Section IV must appear in the control matrix, and vice versa
</guidelines>
