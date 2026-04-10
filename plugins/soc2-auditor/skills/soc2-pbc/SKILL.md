---
name: soc2-pbc
description: "Generate Prepared By Client evidence request list from control matrix"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
---

<objective>
Generate a comprehensive Prepared By Client (PBC) evidence request list from the control matrix. Each control maps to specific evidence items the client must provide. Produces PBC-LIST.md.

ENGAGEMENT PHASE: Evidence Requests (Phase 3 of 8)
  Precondition: /soc2-plan completed (.audit/CONTROL-MATRIX.md must exist)
  Produces: PBC-LIST.md (and optional PBC-LIST.csv)
  Next: /soc2-sample (sample size calculation and item selection)
</objective>

<references>
@.claude/skills/soc2-references/evidence-types.md
@.claude/skills/soc2-templates/pbc-list.md
</references>

<context>
$ARGUMENTS
</context>

<process>

## Welcome

Display the following to the auditor before doing anything else:

```
===========================================================
  SOC 2 AUDITOR — PBC List Generation
===========================================================

  PHASE 3 of 8: Evidence Requests
  ─────────────────────────────────────────────────────────
  Previous: /soc2-plan (Audit Planning)
  Next:     /soc2-sample (Sampling)

  This skill generates a comprehensive Prepared By Client
  (PBC) evidence request list. The PBC list tells the
  client exactly what evidence to provide for testing.

  We'll:
    1. Generate standard document requests (policies, org
       charts, employee lists)
    2. Map each control to specific evidence items
    3. Present the full list for your review
    4. Optionally export to CSV for client delivery

  What you'll need:
    - Client contact name for evidence delivery
    - Preferred due date for evidence collection
    - Any client-specific considerations for evidence format

  Estimated time: 10–15 minutes
===========================================================
```

## Step 0: Load Engagement Context

Read `.audit/ENGAGEMENT.md`, `.audit/SCOPE.md`, and `.audit/CONTROL-MATRIX.md`.

If CONTROL-MATRIX.md doesn't exist, tell the user to run `/soc2-plan` first and stop.

Extract:
- All controls from the control matrix
- Audit period (for date ranges in requests)
- TSC categories in scope
- Client contact information

## Step 1: Generate General Document Requests

Always include general documents that every SOC 2 engagement requires:

- Organizational chart
- Employee list (name, title, department, start/end dates)
- Terminated employee list
- Core policies (information security, acceptable use, data classification, incident response, BCP/DR, change management, access control, vendor management)
- Risk assessment document
- Critical vendor list
- Network and data flow diagrams

Number these G-01 through G-XX.

Additionally, include these commonly missed but critical SOC 2 general documents:

| G-16 | Penetration test report (from qualified third party) | PDF |  |
| G-17 | Most recent vulnerability scan report | PDF/system report |  |
| G-18 | Prior SOC report (if one exists from predecessor auditor) | PDF |  |
| G-19 | SOC reports from subservice organizations (e.g., AWS, Azure, GCP) | PDF |  |
| G-20 | Security awareness training completion records | System report/CSV |  |
| G-21 | Board/management meeting minutes related to security oversight | PDF (redacted OK) |  |

## Step 2: Map Controls to Evidence Requests

For each control in the control matrix, use the evidence types reference to determine:

1. **What evidence is needed** — specific documents, screenshots, logs, reports
2. **Expected format** — PDF, screenshot, CSV/spreadsheet, system export
3. **Period coverage** — full audit period, point-in-time, or specific dates

Generate a PBC item for each required piece of evidence:
- **PBC #**: Sequential numbering by category (e.g., CC6-01, CC6-02, A1-01)
- **Control Ref**: Control ID from the matrix
- **Evidence Description**: Specific, unambiguous description of what to provide
- **Format Expected**: File type or format
- **Due Date**: Based on engagement timeline (typically 2-3 weeks from issuance)
- **Assigned To**: Client contact (if known) or "Client"
- **Status**: "Requested"

### Evidence Request Guidelines

Write requests that are:
- **Specific**: "Screenshot of MFA configuration in Okta showing enforcement policy" not "MFA evidence"
- **Scoped**: Include date ranges — "List of all user provisioning tickets from [start] to [end]"
- **Achievable**: Don't ask for things the client can't produce
- **Organized**: Group by control area / TSC criteria

**Examples — Bad vs. Good PBC Requests:**

| Bad (vague) | Good (specific) |
|-------------|-----------------|
| "MFA evidence" | "Screenshot of Okta MFA enforcement policy showing all users are required to use MFA. Include URL bar and date." |
| "Access review" | "Completed Q2 2025 user access review spreadsheet for production AWS console, showing reviewer name, review date, and disposition for each user." |
| "Change management evidence" | "3 sample change tickets from the audit period showing: description, testing evidence, code review approval, and deployment approval. Provide full ticket screenshots including timestamps." |
| "Backup evidence" | "Backup job configuration screenshot from Veeam/AWS Backup showing schedule, retention, and scope. Plus backup success/failure log for the month of June 2025." |

### Type I vs Type II Scoping

- **Type I:** Evidence is as-of a single date. Requests should specify "as of [date]" not date ranges. Policies and configurations need only reflect the point-in-time state.
- **Type II:** Evidence covers the full audit period. Requests should specify "for the period [start] to [end]." Logs, reports, and tracking documents must span the entire period.

Adjust all evidence descriptions to match the engagement type.

### Consolidation

Consolidate where possible — if multiple controls need the same evidence (e.g., the access review covers CC6.1, CC6.2, and CC6.3), create ONE PBC item and reference all control IDs.

## Step 3: Present PBC List for Review

Present the complete PBC list to the auditor:

"PBC List Generated — {{TOTAL}} evidence requests:

General Documents: {{G_COUNT}}
Control-Specific: {{C_COUNT}}

[Display PBC list in table format]

Please review:
- Any requests to add or remove?
- Are due dates appropriate?
- Any client-specific considerations for evidence collection?
- Should any requests be consolidated or split?"

**GATE: Auditor must confirm the PBC list before writing.**

## Step 4: Write PBC-LIST.md

Using the PBC list template, populate:
- Engagement information
- Summary counts
- All evidence requests with full details
- General documents section
- Notes for client section (customize period dates)

## Step 5: Offer CSV Export

Ask the auditor:

"Would you like a CSV export of the PBC list for sharing with the client? (yes/no)"

If yes, generate CSV using Bash:
```bash
# Extract PBC table from PBC-LIST.md and convert to CSV
echo "PBC #,Control Ref,Evidence Description,Format Expected,Due Date,Assigned To,Status,Received Date,Notes" > .audit/PBC-LIST.csv
# Append each PBC item as a CSV row
# (The skill should iterate through the PBC items it generated and write each as a comma-separated line)
```

Write each PBC item as a properly quoted CSV row to `.audit/PBC-LIST.csv`.

## Step 6: Update STATE.md

Update `.audit/STATE.md`:
- Phase: PBC Generation → Complete
- PBC Status: Requested = total count, all others = 0

## Step 7: Display Summary

```
===========================================================
  PBC List Generated
===========================================================

Total Requests: [count]
  General Documents: [count]
  Control-Specific: [count]
  
Due Date: [date]

Files Created/Updated:
  .audit/PBC-LIST.md
  .audit/PBC-LIST.csv (if exported)
  .audit/STATE.md

  Full workflow:
    1. /soc2-kickoff   (complete)
    2. /soc2-plan      (complete)
    3. /soc2-pbc       ← YOU ARE HERE (complete)
    4. /soc2-sample    ← NEXT
    5. /soc2-test
    6. /soc2-workpaper
    7. /soc2-review
    8. /soc2-package

Next steps:
  1. Share PBC list with client
  2. Track evidence receipt in .audit/PBC-LIST.md (update Status column)
  3. When evidence is received, run /soc2-sample <control-id> to begin testing
```

</process>

<guidelines>
- Every control in the matrix should have at least one PBC item
- Write evidence descriptions from the client's perspective — tell them exactly what to provide
- Screenshots must include URL bar and timestamps — state this in the request
- For system-generated reports, specify the date range and parameters
- Don't request raw database dumps or overly sensitive data — redaction guidance in templates
- Consolidate related requests to reduce client burden, but ensure traceability to controls
- For Type I engagements, evidence is as-of a point in time, not a full period
- Include the standard general documents even if they seem obvious — completeness matters for the file
</guidelines>
