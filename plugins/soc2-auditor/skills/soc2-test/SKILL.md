---
name: soc2-test
description: "Test controls — inspect evidence/screenshots, reperform, observe, inquiry"
argument-hint: "<control-id> [--mode inspect|reperform|observe|inquiry] [--evidence-path ./path]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

<objective>
Execute control testing for a specific control. Supports four test modes: inspection (including multimodal evidence review of screenshots), reperformance, observation, and inquiry. Produces TEST-RESULTS.md for the control.

This is the core testing skill — it examines evidence and determines whether controls are operating effectively.

Requires: `.audit/workpapers/{control-id}/SAMPLING-MEMO.md` must exist (run /soc2-sample first).
</objective>

<references>
@.claude/skills/soc2-references/test-procedures.md
@.claude/skills/soc2-references/evidence-types.md
</references>

<context>
$ARGUMENTS
</context>

<process>

## Step 0: Parse Arguments and Load Context

Parse $ARGUMENTS for:
- **control-id** (required) — the control to test
- **--mode** (optional) — test mode override (inspect | reperform | observe | inquiry)
- **--evidence-path** (optional) — path to evidence files

Read:
- `.audit/CONTROL-MATRIX.md` — get control details
- `.audit/workpapers/{control-id}/SAMPLING-MEMO.md` — get sample items
- `.audit/ENGAGEMENT.md` — get audit period dates
- `.audit/AUDIT-PLAN.md` — get testing strategy

If SAMPLING-MEMO.md doesn't exist, tell the user to run `/soc2-sample {control-id}` first and stop.

Extract:
- Control description, criteria, frequency, risk level
- Test method from the control matrix (or use --mode override)
- Sample items from the sampling memo
- Audit period start and end dates

## Step 1: Determine Test Mode

If --mode is specified, use it. Otherwise, use the test method from the control matrix.

If the control matrix specifies "Combination", determine the primary and secondary test types based on risk:
- High risk: Inspection + Reperformance
- Moderate risk: Inspection + Inquiry
- Low risk: Inspection alone

## Step 2: Execute Testing by Mode

### Mode: Inspect

For each sample item in the sampling memo:

1. **Locate evidence:**
   - If --evidence-path provided, look for evidence files there
   - Otherwise, ask the auditor to provide the evidence file path for this item
   - Use Glob to find matching files if a directory is provided

2. **Read and examine evidence:**
   - Use Read to examine the evidence file
   - For **images/screenshots**: Read will display them visually — examine:
     - Is the date/timestamp within the audit period?
     - Is the correct system/application shown (URL bar, system name)?
     - Does the content show the control operating as designed?
     - Are approvals/sign-offs present where expected?
     - Are the correct settings/configurations shown?
   - For **documents/PDFs**: Read and verify:
     - Document date is within the audit period
     - Content matches the control description
     - Required signatures/approvals are present
     - Version is current (not outdated)
   - For **system reports/logs**: Verify:
     - Report parameters cover the correct period
     - Data appears complete (no gaps)
     - Results are consistent with control description

3. **Record observation:**
   - What was examined
   - What was observed
   - Whether the control operated as designed
   - Result: **Effective** or **Exception**

4. If **Exception** found:
   - Document the specific deviation
   - Note the nature (design vs. operating failure)
   - Ask the auditor about root cause and management response via AskUserQuestion

### Mode: Reperform

For each sample item:

1. **Describe the expected reperformance steps** based on the control description
2. **Guide the auditor** through re-executing the control:
   - Present step-by-step instructions
   - Ask the auditor to perform each step and report results (AskUserQuestion)
3. **Compare results:**
   - Do the reperformance results match the original control execution?
   - Any discrepancies?
4. **Record:** Effective or Exception with detailed observations

### Mode: Observe

For each sample item (or for the control in general):

1. **Present observation framework:**
   - What to observe
   - What constitutes effective operation
   - What to document
2. **Collect observation notes** from the auditor (AskUserQuestion):
   - "Please describe what you observed when [control description] was performed"
   - "Was the control performed by the expected personnel?"
   - "Was the control performed timely per its defined frequency?"
   - "Were all required steps completed?"
3. **Record:** Effective or Exception based on observation notes

### Mode: Inquiry

For each relevant topic:

1. **Present structured inquiry questions** based on the control and test procedures reference:
   - Control operation questions
   - Frequency and timing questions
   - Exception handling questions
   - Change questions (any changes during the period?)
2. **Record management responses** (AskUserQuestion for each inquiry point)
3. **Assess corroboration:**
   - Inquiry alone is the WEAKEST form of evidence
   - If this is the only test type, note the limitation
   - Recommend corroboration with inspection where possible
4. **Record:** Effective or Exception based on responses

## Step 3: Compile Results

After testing all sample items:

### Calculate Exception Rate
- Exception count ÷ Sample size = Exception rate
- Compare to tolerable deviation rate from sampling memo

### Evaluate Results
- If exception rate ≤ tolerable deviation rate → Control is **Effective**
- If exception rate > tolerable deviation rate → **Escalation required**

### If Exceptions Exceed Tolerance

Present to auditor via AskUserQuestion:

"Exception Rate Alert for {{CONTROL_ID}}:

Exceptions: {{COUNT}} of {{SAMPLE_SIZE}} ({{RATE}}%)
Tolerable Deviation Rate: {{TOLERABLE}}%

Options:
1. Extend testing (increase sample size) — run /soc2-sample {{CONTROL_ID}} with larger sample
2. Evaluate compensating controls
3. Accept as exception for the report
4. Investigate further

How would you like to proceed?"

**GATE: Auditor must decide how to handle excess exceptions.**

## Step 4: Write TEST-RESULTS.md

Write `.audit/workpapers/{control-id}/TEST-RESULTS.md`:

```markdown
# Test Results — {CONTROL_ID}

## Control: {CONTROL_DESC}
## Test Mode: {MODE}
## Date Tested: {DATE}
## Tested By: {TESTER}

## Summary
- Items Tested: {N}
- Effective: {N}
- Exceptions: {N}
- Exception Rate: {X}%

## Detail Results

| # | Item | Date | Observation | Result |
|...|

## Exceptions (if any)

### Exception 1
- Item: ...
- Description: ...
- Root Cause: ...
- Impact: ...
- Management Response: ...

## Conclusion
{CONCLUSION}
```

## Step 5: Update Control Matrix

Update `.audit/CONTROL-MATRIX.md`:
- Set the control's Status to "Effective" or "Exception"
- Set the Exceptions count
- Set the Work Paper Ref

## Step 6: Update STATE.md

Update `.audit/STATE.md`:
- Increment Tested count
- Increment Effective or Exception count
- Decrement Not Yet Tested count

## Step 7: Display Summary

```
Testing Complete — {{CONTROL_ID}}

Control: {{CONTROL_DESC}}
Test Mode: {{MODE}}
Result: {{EFFECTIVE or EXCEPTION}}
Items Tested: {{N}}
Exceptions: {{N}} ({{RATE}}%)

Files Created/Updated:
  .audit/workpapers/{{CONTROL_ID}}/TEST-RESULTS.md
  .audit/CONTROL-MATRIX.md
  .audit/STATE.md

Next steps:
  - Test more controls: /soc2-test <next-control-id>
  - When all controls tested: /soc2-workpaper all
```

</process>

<guidelines>
- MULTIMODAL EVIDENCE REVIEW: When reading image files (screenshots, photos), Claude can see them via the Read tool. Describe what you see in detail — dates, UI elements, settings, approvals. This is a key differentiator.
- For screenshots: always verify the date/timestamp is within the audit period
- For system reports: always verify the report parameters match the audit scope
- Exceptions must be SPECIFIC — "Access was granted without documented approval on 2025-03-15 for user john.doe" not "access control issue"
- Record management's response to every exception — this is required for the work paper
- Inquiry alone is NEVER sufficient for high-risk controls — always recommend corroboration
- For IT automated controls: test 1 instance + verify no code/config changes during the period
- Do not make the effectiveness determination for the auditor — present facts, let them decide. But do flag when exception rates exceed tolerance.
- If evidence is missing or insufficient, document it as a scope limitation, not an exception
- Each sample item must have its own observation recorded — no batch results
</guidelines>
