---
name: soc2-plan
description: "Audit planning — risk assessment, control identification, testing strategy"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
Perform comprehensive audit planning: risk assessment, control identification, criteria-to-control mapping, and testing strategy. Produces RISK-ASSESSMENT.md, AUDIT-PLAN.md, and CONTROL-MATRIX.md.

ENGAGEMENT PHASE: Planning (Phase 2 of 8)
  Precondition: /soc2-kickoff completed (.audit/ENGAGEMENT.md and .audit/SCOPE.md must exist)
  Produces: RISK-ASSESSMENT.md, AUDIT-PLAN.md, CONTROL-MATRIX.md
  Next: /soc2-pbc (PBC evidence request generation)
</objective>

<references>
@.claude/skills/soc2-references/trust-service-criteria.md
@.claude/skills/soc2-references/risk-factors.md
@.claude/skills/soc2-references/evidence-types.md
@.claude/skills/soc2-templates/risk-assessment.md
@.claude/skills/soc2-templates/audit-plan.md
@.claude/skills/soc2-templates/control-matrix.md
</references>

<context>
$ARGUMENTS
</context>

<process>

## Welcome

Display the following to the auditor before doing anything else:

```
===========================================================
  SOC 2 AUDITOR — Audit Planning
===========================================================

  PHASE 2 of 8: Planning
  ─────────────────────────────────────────────────────────
  Previous: /soc2-kickoff (Engagement Kickoff)
  Next:     /soc2-pbc (PBC Generation)

  This skill performs the foundation of your audit:

    1. Assess entity-level and control-level risks
    2. Identify controls for each in-scope TSC criteria
    3. Map controls to testing strategies
    4. Build the formal audit plan

  We'll present the risk assessment and control matrix
  for your review before finalizing anything.

  What you'll need:
    - Understanding of the client's industry and technology
    - Knowledge of prior audit findings (if any)
    - Time to review the control matrix (~30-60 controls typical)

  Estimated time: 15–30 minutes
===========================================================
```

## Step 0: Load Engagement Context

Read `.audit/ENGAGEMENT.md`, `.audit/SCOPE.md`, and `.audit/STATE.md`. If ENGAGEMENT.md and SCOPE.md don't exist, tell the user to run `/soc2-kickoff` first and stop.

Extract:
- Client name, industry, system type
- Engagement type (Type I / Type II)
- Audit period
- TSC categories in scope
- Subservice organizations
- Any predecessor audit findings

## Step 1: Risk Assessment

### 1a: Entity-Level Risk Analysis

Using the risk factors reference, assess each category:

**Industry and Regulatory Environment:**
- Regulation level (high/moderate/low)
- Data sensitivity classification
- Regulatory history

**Entity Characteristics:**
- Maturity and stability
- Management experience
- Prior audit findings (if predecessor report available)
- Organizational complexity

**Technology Environment:**
- Infrastructure complexity
- Change velocity
- Custom vs. COTS systems
- Third-party dependencies

For each factor, document:
- The assessment (what we know)
- The risk level (High / Moderate / Low)
- Supporting rationale

### 1b: Category-Level Risk Assessment

For each in-scope TSC category, determine:
- **Inherent risk** — risk before considering controls
- **Control risk** — estimated risk that controls won't prevent/detect issues
- **Combined risk** — overall risk level
- **Required detection risk** — inversely proportional to combined risk
- **Testing intensity** — driven by detection risk

### 1c: Fraud Risk Considerations

Assess fraud risk factors:
- Management override potential
- Segregation of duties adequacy
- Unauthorized access risks
- Data manipulation risks

### 1d: Present Risk Assessment for Review

Present the complete risk assessment to the auditor using AskUserQuestion:

"Risk Assessment Summary:

[Display entity-level factors with risk levels]
[Display category-level risk matrix]
[Display fraud risk considerations]

Please review and confirm the risk assessment, or provide adjustments:
- Are the risk levels appropriate?
- Are there additional risk factors to consider?
- Any adjustments to testing intensity?"

**GATE: Auditor must confirm or adjust the risk assessment before proceeding.**

## Step 2: Control Identification

### 2a: Map Controls to Criteria

Using the Trust Service Criteria reference, identify controls for each in-scope criteria:

For **Security (CC1-CC9)**, identify controls covering:
- CC1: Control environment (governance, ethics, HR)
- CC2: Communication (policies, external notifications)
- CC3: Risk assessment (entity risk process)
- CC4: Monitoring (vulnerability mgmt, pen testing, internal audit)
- CC5: Control activities (segregation, approvals)
- CC6: Access controls (authentication, provisioning, deprovisioning, reviews, physical, network, encryption)
- CC7: Operations (monitoring, incident response, recovery)
- CC8: Change management (change process, code review, testing, deployment)
- CC9: Risk mitigation (BCP, vendor management)

For each additional in-scope category, identify additional controls:
- **A1**: Capacity, backup, recovery testing
- **PI1**: Input validation, processing accuracy, output completeness
- **C1**: Data classification, DLP, disposal
- **P1-P8**: Privacy notice, consent, collection, retention, access, disclosure, quality, monitoring

**Important:** You are identifying controls the client has IMPLEMENTED, not controls they SHOULD have. Base control identification on:
- Information from the engagement letter and client discussions
- Industry-standard controls typical for the client's technology stack
- Prior SOC reports (if predecessor auditor information available)

Flag any criteria that lack a clear control for inquiry during the PBC phase. Do not assume controls exist.

### 2b: Classify Each Control

For each identified control, determine:
- **Control ID** — formatted as {Criteria}-{Sequence} (e.g., CC6.1-01)
- **Description** — what the control does
- **Type** — Preventive / Detective / Corrective
- **Frequency** — Annual / Quarterly / Monthly / Weekly / Daily / Per Occurrence / Continuous
- **Risk level** — High / Moderate / Low (from risk assessment)
- **Test method** — Inspect / Reperform / Observe / Inquiry / Combination

### 2c: Determine Testing Approach

**Type I engagements:**
- All controls: design effectiveness only (sample size = 1, design walkthrough)
- No operating effectiveness testing — no sampling calculations needed
- Test methods: inspection and inquiry only
- Materiality focuses on design defects, not operating failures
- CONTROL-MATRIX.md should show "Type I — Design Only" in the Test Method column
- Timeline is typically shorter (2–4 weeks vs. 6–12 weeks for Type II)
- Report period is "as of [date]" not a date range

**Type II engagements:**
- Design AND operating effectiveness
- Sample sizes driven by frequency and risk level (per sampling tables)
- Higher-risk controls: combination of test methods (inspect + reperform)
- IT automated controls: test 1 instance + validate no changes via ITGC
- Report period is "for the period [start] to [end]"

## Step 3: Build Audit Plan

### 3a: Materiality Determination

SOC 2 examinations use primarily **qualitative materiality** — there are no numeric thresholds like financial audits.

**Qualitative factors for assessing whether an exception is material:**
- Nature: Is the exception a systematic design flaw or an isolated procedural miss?
- Pervasiveness: Does it affect one control or multiple criteria?
- Duration: Did it persist throughout the period or was it corrected promptly?
- Compensating controls: Do other controls mitigate the risk?
- Impact on users: Could the exception affect user entity decisions?

**For sampling purposes (tolerable deviation rates used in sample size calculations only):**
- High-risk controls: 5% tolerable deviation rate
- Moderate-risk controls: 7% tolerable deviation rate
- Low-risk controls: 10% tolerable deviation rate
- Confidence level: 95% (default) or 90% (if justified by low risk)

Note: These sampling parameters guide sample size calculations in /soc2-sample. The ultimate materiality determination for the opinion is qualitative and made during /soc2-package.

### 3b: Team Assignments

If team members were identified in the engagement, assign control areas to team members. If not, leave for auditor to assign.

### 3c: Timeline

Build testing timeline based on engagement timeline from ENGAGEMENT.md.

## Step 4: Present Control Matrix for Review

Present the complete control matrix to the auditor:

"Control Matrix — {{TOTAL}} controls identified across {{CATEGORIES}} categories:

[Display control matrix in table format — ID, Description, Criteria, Type, Frequency, Risk, Test Method]

Please review:
- Are any controls missing?
- Are classifications correct?
- Should any controls be added or removed?
- Are test methods appropriate?"

**GATE: Auditor must confirm or adjust the control matrix before proceeding.**

## Step 5: Write Output Files

### 5a: Write RISK-ASSESSMENT.md

Using the risk assessment template, populate all fields with the confirmed risk assessment.

### 5b: Write AUDIT-PLAN.md

Using the audit plan template, populate:
- Scope and objectives
- Materiality parameters
- Testing strategy by risk level
- Team assignments
- Timeline

### 5c: Write CONTROL-MATRIX.md

Using the control matrix template, populate:
- All identified controls with full classification
- Status = "Not Tested" for all controls
- Summary counts by category

### 5d: Update STATE.md

Update `.audit/STATE.md`:
- Phase: Planning → Complete
- Total Controls: count from control matrix
- All other counters: initialized

## Step 6: Display Summary

```
Audit Planning Complete

Risk Assessment:
  Security: [risk level]
  [Other categories with levels]

Controls Identified: [total]
  High Risk: [count]
  Moderate Risk: [count]
  Low Risk: [count]

Files Updated:
  .audit/RISK-ASSESSMENT.md
  .audit/AUDIT-PLAN.md
  .audit/CONTROL-MATRIX.md
  .audit/STATE.md

  Full workflow:
    1. /soc2-kickoff  (complete)
    2. /soc2-plan     ← YOU ARE HERE (complete)
    3. /soc2-pbc      ← NEXT
    4. /soc2-sample
    5. /soc2-test
    6. /soc2-workpaper
    7. /soc2-review
    8. /soc2-package

Next step: Run /soc2-pbc to generate the evidence request list
```

</process>

<guidelines>
- Controls must be specific and testable, not vague aspirations
- Every in-scope TSC criteria must be addressed by at least one control
- Do not over-identify controls — focus on key controls that management relies upon
- For cloud-native organizations, physical access controls typically map to the cloud provider's SOC report (carve-out)
- IT automated controls should be identified separately from manual controls — they have different testing approaches
- The control matrix is the backbone of the entire engagement — accuracy here is critical
- When uncertain about a control's existence, flag it for inquiry during PBC/testing rather than assuming
- Type I engagements should have simpler plans — no operating effectiveness testing
</guidelines>
