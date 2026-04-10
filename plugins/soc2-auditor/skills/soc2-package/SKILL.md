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
Assemble the final SOC 2 report package from all engagement artifacts. Produces all four report sections (opinion, management assertion, system description review, tests and results) and exports to Word via pandoc.

This is the final skill in the engagement lifecycle. Everything leads to this.

ENGAGEMENT PHASE: Report Packaging (Phase 8 of 8)
  Precondition: /soc2-review completed (all work papers must be "Reviewed — Signed Off")
  Produces: .audit/deliverables/section-1-opinion.md through section-4-controls-tests-results.md, report.docx
  Next: (none — engagement complete after this phase)
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

## Welcome

Display the following before doing anything else:

```
===========================================================
  SOC 2 AUDITOR — Report Packaging
===========================================================

  PHASE 8 of 8: Final Report
  ─────────────────────────────────────────────────────────
  Previous: /soc2-review (Peer Review)
  Next:     (none — this completes the engagement)

  You've completed all the hard work — testing controls,
  documenting findings, and getting peer review. Now we
  assemble everything into a professional, client-ready
  SOC 2 report.

  The report has four sections:
    I.   Independent Service Auditor's Report (opinion)
    II.  Management's Assertion
    III. System Description Review
    IV.  Tests of Controls and Results

  We'll determine the opinion type, assemble each section,
  present the draft for partner approval, and optionally
  export to Word (.docx).

  Estimated time: 15–30 minutes (includes partner review)
===========================================================
```

## Step 1: Pre-Flight Check

Read all engagement files and verify readiness:

### 1a: Engagement Completeness

Read `.audit/CONTROL-MATRIX.md` and verify:
- [ ] Every control has Status = "Effective" or "Exception" (none "Not Tested" or "In Progress")
- [ ] Every control has a WORKPAPER.md in .audit/workpapers/{control-id}/
- [ ] Every work paper has Status = "Reviewed — Signed Off"
- [ ] Every work paper with Status = "Exception" has complete exception documentation

Read `.audit/STATE.md` and verify:
- [ ] Tested count = Total Controls
- [ ] WP Reviewed count = Total Controls
- [ ] No open Must Resolve review notes anywhere

If ANY check fails, report ALL gaps at once and stop:

```
===========================================================
  Pre-Flight Check FAILED
===========================================================

  The following items must be resolved before packaging:

  {{#each gap}}
    - {{CONTROL_ID}}: {{ISSUE}}
      → Fix: {{RECOMMENDED_ACTION}}
  {{/each}}

  Run the appropriate skill for each gap:
    Not tested:         /soc2-test <control-id>
    Work paper missing: /soc2-workpaper <control-id> --finalize
    Review pending:     /soc2-review <control-id>
===========================================================
```

**GATE: ALL pre-flight checks must pass. No partial packaging.**

### 1b: Load Engagement Context

Read all required files:
- `.audit/ENGAGEMENT.md` — client info, period, type, team, subservice orgs
- `.audit/SCOPE.md` — TSC categories, boundaries, CUECs, CSOCs
- `.audit/RISK-ASSESSMENT.md` — risk levels for materiality context
- `.audit/AUDIT-PLAN.md` — testing strategy
- `.audit/CONTROL-MATRIX.md` — all controls with final results
- `.audit/config.json` — firm info, engagement type, word template path
- All WORKPAPER.md files (for Section IV assembly)

## Step 2: Determine Opinion

### 2a: Analyze Exception Summary

From the control matrix and work papers, compile:
- Total controls tested
- Controls with exceptions (count and list)
- Exception details from each work paper (description, root cause, impact, management response)
- TSC criteria affected by exceptions
- Compensating controls identified

### 2b: Materiality Assessment

For each exception, assess materiality using **qualitative factors** (SOC 2 does not use quantitative materiality thresholds like financial audits):

| Factor | Material Indicator | Immaterial Indicator |
|--------|-------------------|---------------------|
| Nature | Systematic design flaw | Isolated procedural miss |
| Root cause | Inadequate control design | One-time human error |
| Duration | Persisted throughout period | Corrected promptly |
| Compensating controls | None available | Effective compensating control exists |
| Impact on criteria | Directly undermines the criteria | Tangential to criteria |
| Pervasiveness | Affects multiple criteria | Isolated to one control |
| Management response | No remediation | Prompt remediation with evidence |

**Aggregate assessment:** Even if individual exceptions are immaterial, assess whether the aggregate effect across all exceptions is material.

### 2c: Opinion Determination

| Scenario | Opinion Type | When to Use |
|----------|-------------|-------------|
| No exceptions | Unqualified | All controls effective |
| Exceptions, individually and in aggregate immaterial | Unqualified | Exceptions exist but are isolated, corrected, or compensated. Note in Section IV. |
| Material exception(s) in specific, identified area(s) | Qualified | One or more criteria have material exceptions, but the issue is not pervasive across the system |
| Pervasive material exceptions across multiple criteria | Adverse | Fundamental failure of the control environment; exceptions affect the system broadly |

Present the opinion recommendation to the engagement partner:

```
Opinion Recommendation
──────────────────────────────────────────────────

Total Controls Tested: {{TOTAL}}
Controls with Exceptions: {{EXCEPTION_COUNT}}
Affected TSC Criteria: {{CRITERIA_LIST}}

Exception Analysis:
{{#each exception}}
  {{CONTROL_ID}}: {{BRIEF_DESC}}
    Root cause: {{CAUSE}}
    Materiality: {{MATERIAL / IMMATERIAL}}
    Rationale: {{RATIONALE}}
{{/each}}

Aggregate Materiality: {{MATERIAL / IMMATERIAL}}

Recommended Opinion: {{TYPE}}
Rationale: {{OPINION_RATIONALE}}

──────────────────────────────────────────────────
Do you agree with this opinion? (yes / adjust)
```

**GATE: The engagement partner MUST confirm the opinion. This is the most consequential judgment in the engagement.**

If the partner disagrees, discuss and adjust. The partner's judgment prevails — document the rationale for the final opinion.

## Step 3: Assemble Section I — Independent Service Auditor's Report

Using the report opinion template (@.claude/skills/soc2-templates/report-opinion.md):

### Type I Report:
- Report period: "as of {{DATE}}"
- Use design effectiveness language ONLY throughout
- Remove all references to operating effectiveness
- Remove Type II-only paragraphs (testing of operating effectiveness)

### Type II Report:
- Report period: "for the period {{START}} to {{END}}"
- Include both design AND operating effectiveness language
- Include the testing paragraph describing the examination of operating effectiveness

### Opinion-Specific Content:

**Unqualified:**
Standard opinion paragraph — "In our opinion, in all material respects..."

**Qualified:**
Add "Basis for Qualified Opinion" paragraph BEFORE the opinion paragraph:
- Describe the specific matter(s) giving rise to the qualification
- Identify the affected criteria
- Describe the nature and extent of the exception(s)
- Opinion paragraph reads: "In our opinion, except for the matter(s) described..."

**Adverse:**
Add "Basis for Adverse Opinion" paragraph BEFORE the opinion paragraph:
- Describe the pervasive material exceptions
- Opinion paragraph reads: "In our opinion, because of the significance of the matter(s) described..."

### Fill in all placeholders:
- Client name and system name
- TSC categories in scope (listed by full name)
- Firm name and address (from config.json)
- Report date (today)
- Subservice organization paragraph (if applicable — from SCOPE.md)
- Restricted use paragraph with intended users (from ENGAGEMENT.md)

Write to `.audit/deliverables/section-1-opinion.md`

## Step 4: Assemble Section II — Management's Assertion

Using the management assertion template (@.claude/skills/soc2-templates/management-assertion.md):

Fill in all content from engagement files:
- Client name, system name
- Period or as-of date
- TSC categories addressed
- Subservice organizations and method (carve-out/inclusive)
- CUECs from SCOPE.md
- CSOCs (if carve-out method used)
- Principal service commitments from ENGAGEMENT.md

### Type I:
Include assertions a) and b) only:
- a) Description fairly presents the system as of [date]
- b) Controls suitably designed as of [date]

### Type II:
Include assertions a), b), and c):
- a) Description fairly presents the system throughout the period
- b) Controls suitably designed throughout the period
- c) Controls operated effectively throughout the period

**Important note to auditor:** "Management must review and sign this assertion before the report is delivered. The auditor prepares the template; the client signs it."

Write to `.audit/deliverables/section-2-assertion.md`

## Step 5: Assemble Section III — System Description Review

Build a checklist-based review of the system description against DC 200 (Description Criteria):

| # | Criteria | Status | Notes |
|---|---------|--------|-------|
| 1 | Types of services provided | | |
| 2 | Principal service commitments and system requirements | | |
| 3 | Infrastructure components | | |
| 4 | Software components | | |
| 5 | People (roles and responsibilities) | | |
| 6 | Procedures (automated and manual) | | |
| 7 | Data (types processed, stored, transmitted) | | |
| 8 | System boundaries clearly defined | | |
| 9 | Controls mapped to applicable criteria | | |
| 10 | CUECs listed | | |
| 11 | CSOCs listed (if carve-out method) | | |
| 12 | Changes during the period (Type II only) | | |
| 13 | Relevant incidents during the period (Type II only) | | |

Present the checklist to the auditor:

"Section III — System Description Review. Please confirm which criteria the client's system description meets, or identify gaps:

[Display checklist]

Any items that need client attention before finalizing?"

Write to `.audit/deliverables/section-3-description-review.md`

## Step 6: Assemble Section IV — Tests of Controls and Results

Build the tests and results table from all work papers, sorted by TSC criteria:

For each control in the control matrix:

| Trust Service Criteria | Control Activity | Test Applied | Test Description | Results |
|----------------------|-----------------|-------------|-----------------|---------|
| CC6.1 | [Control description] | Inspected | [Procedure summary from work paper] | [Result] |

### Format results:
- **No exceptions:** "No exceptions noted."
- **Exceptions:** "[N] of [sample size] items tested exhibited [specific deviation]. The exception resulted from [root cause]. [Management response if applicable]."

### Cross-verification:
- Every control in the control matrix MUST appear in Section IV
- Every control in Section IV MUST appear in the control matrix
- Results in Section IV MUST match the work paper conclusions exactly

Write to `.audit/deliverables/section-4-controls-tests-results.md`

## Step 7: Present Draft Package for Partner Review

Present the complete package:

```
SOC 2 Type {{TYPE}} Report Package — DRAFT
──────────────────────────────────────────────────

Section I: {{OPINION_TYPE}} Opinion
  [2-3 sentence summary]

Section II: Management's Assertion
  Assertions: {{a, b}} (Type I) or {{a, b, c}} (Type II)
  TSC Categories: [list]

Section III: System Description Review
  Checklist: {{PASS}}/{{TOTAL}} criteria met

Section IV: Tests of Controls and Results
  Controls: {{TOTAL}}
  Effective: {{EFFECTIVE}}
  Exceptions: {{EXCEPTION_COUNT}}
  [Exception summary if any]

──────────────────────────────────────────────────
Please review the draft. Any changes before finalizing?
```

**GATE: Engagement partner must approve the complete package.**

## Step 8: Export to Word

Check if pandoc is available:
```bash
command -v pandoc >/dev/null 2>&1 && echo "available" || echo "not found"
```

If pandoc is available:

```bash
# Concatenate all sections with page breaks
{
  cat .audit/deliverables/section-1-opinion.md
  echo -e "\n\n---\n\n"
  cat .audit/deliverables/section-2-assertion.md
  echo -e "\n\n---\n\n"
  cat .audit/deliverables/section-3-description-review.md
  echo -e "\n\n---\n\n"
  cat .audit/deliverables/section-4-controls-tests-results.md
} > .audit/deliverables/report-combined.md

# Check for custom firm template
TEMPLATE_ARG=""
CONFIG_TEMPLATE=$(node -pe "try{JSON.parse(require('fs').readFileSync('.audit/config.json','utf8')).settings?.wordTemplate||''}catch(e){''}" 2>/dev/null)
if [ -n "$CONFIG_TEMPLATE" ] && [ -f "$CONFIG_TEMPLATE" ]; then
  TEMPLATE_ARG="--reference-doc=$CONFIG_TEMPLATE"
fi

# Convert to Word
pandoc .audit/deliverables/report-combined.md \
  -f markdown \
  -t docx \
  $TEMPLATE_ARG \
  -o .audit/deliverables/report.docx
```

If pandoc is NOT available:
```
Note: pandoc is not installed. Word export skipped.
The report is available in Markdown format in .audit/deliverables/.
To enable .docx export, install pandoc: https://pandoc.org/installing.html
```

## Step 9: Update STATE.md

Update `.audit/STATE.md`:
- Phase: "Report Issued"
- Report Date: today (ISO 8601)
- Opinion: [unqualified / qualified / adverse]
- All phase history entries completed

## Step 10: Display Final Summary

```
===========================================================
  SOC 2 Type {{TYPE}} Report — COMPLETE
===========================================================

  Client:  {{CLIENT_NAME}}
  System:  {{SYSTEM_NAME}}
  Period:  {{PERIOD}}
  Opinion: {{OPINION_TYPE}}

  Report Sections:
    .audit/deliverables/section-1-opinion.md
    .audit/deliverables/section-2-assertion.md
    .audit/deliverables/section-3-description-review.md
    .audit/deliverables/section-4-controls-tests-results.md
    {{#if docx}}
    .audit/deliverables/report.docx  (Word format)
    {{/if}}

  Controls Summary:
    Total:      {{TOTAL}}
    Effective:  {{EFFECTIVE}}
    Exceptions: {{EXCEPTIONS}}

  ─────────────────────────────────────────────────────────
  ENGAGEMENT COMPLETE
  ─────────────────────────────────────────────────────────

  Full workflow:
    1. /soc2-kickoff   (complete)
    2. /soc2-plan      (complete)
    3. /soc2-pbc       (complete)
    4. /soc2-sample    (complete)
    5. /soc2-test      (complete)
    6. /soc2-workpaper (complete)
    7. /soc2-review    (complete)
    8. /soc2-package   ← COMPLETE

  Before delivery, remember:
    - Management must review and sign Section II (assertion)
    - The report is RESTRICTED USE — distribute only to
      intended users listed in Section I
    - Retain all engagement documentation per firm policy
      (minimum 5 years per AT-C 205)
    - Assemble the engagement documentation within 60 days
      of the report release date
===========================================================
```

</process>

<guidelines>
- Pre-flight check is NON-NEGOTIABLE — never package an incomplete engagement. Every control must be tested, work-papered, and reviewed.
- The opinion is the most consequential professional judgment in the engagement — ALWAYS confirm with the engagement partner. Document the rationale.
- **Unqualified does NOT mean "no exceptions"** — it means all exceptions are immaterial (individually and in aggregate)
- **Qualified** means material exception(s) in specific, identified area(s) — but not pervasive
- **Adverse** is rare and serious — pervasive material failures across the control environment
- Section IV must ACCURATELY reflect the work papers — do not soften, omit, or editorialize exception details
- Report dates must be CONSISTENT across all four sections
- Management's assertion must be signed by CLIENT MANAGEMENT, not the auditor. Note who should sign (typically a senior executive: CEO, CTO, CISO, or VP Engineering).
- The report is RESTRICTED USE — the restricted use paragraph is legally significant. List only the intended users specified in the engagement letter.
- If pandoc is not installed, Markdown deliverables are fully complete — Word export is a convenience, not a requirement
- Do not include Section V (Other Information) unless the client specifically requests it
- Cross-check: every control in Section IV must match the control matrix, and vice versa. No orphans.
- For Type I: ensure NO references to "operating effectiveness" or "throughout the period" appear anywhere in the report
- For Type II: ensure ALL references to "operating effectiveness" and the period are present
</guidelines>
