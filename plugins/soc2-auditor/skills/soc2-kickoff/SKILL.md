---
name: soc2-kickoff
description: "Start a SOC 2 engagement — ingest engagement letter, extract scope, create .audit/ structure"
argument-hint: "[path to engagement letter or @reference]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
---

<objective>
Initialize a SOC 2 examination engagement by ingesting an engagement letter, extracting key terms, confirming with the auditor, and creating the `.audit/` directory structure with all foundational documents.

This is the entry point for every SOC 2 engagement. Nothing else runs until kickoff is complete.
</objective>

<references>
@.claude/skills/soc2-templates/engagement.md
@.claude/skills/soc2-templates/state.md
@.claude/skills/soc2-templates/config.json
@.claude/skills/soc2-templates/scope.md
</references>

<context>
$ARGUMENTS
</context>

<process>

## Welcome

Display the following to the auditor before doing anything else:

```
===========================================================
  SOC 2 AUDITOR — Engagement Kickoff
===========================================================

  PHASE 1 of 8: Kickoff
  ─────────────────────────────────────────────────────────
  Previous: (none — this is the starting point)
  Next:     /soc2-plan (Audit Planning)

  This skill walks you through the critical first step of
  your SOC 2 examination. We'll:

    1. Read your engagement letter
    2. Extract scope, period, TSC categories, and team
    3. Confirm all terms with you before proceeding
    4. Create the .audit/ directory with all foundational
       documents

  What you'll need:
    - Engagement letter (file path or paste contents)
    - Client contact information
    - Knowledge of TSC categories in scope

  Estimated time: 5–10 minutes
===========================================================
```

## Step 0: Pre-Flight Check

Check if `.audit/` already exists at the project root:
- If it exists, warn the auditor: "An .audit/ directory already exists. This may be from a prior engagement. Would you like to overwrite it or abort?"
- **GATE: If .audit/ exists, auditor must explicitly confirm overwrite before proceeding.**

## Step 1: Ingest Engagement Letter

Read the engagement letter provided by the user (via file path or @reference in $ARGUMENTS).

If no engagement letter is provided, ask the user:
"Please provide the engagement letter — either a file path (e.g., `./engagement-letter.pdf`) or paste the key engagement terms directly."

Extract the following from the engagement letter:

### Required Fields (engagement cannot proceed without these)
- **Client name** — legal entity name of the service organization
- **Engagement type** — SOC 2 Type I or Type II
- **Audit period** — start date and end date (Type II) or as-of date (Type I)
- **Trust Service Categories in scope** — Security is always in scope; identify Availability, Processing Integrity, Confidentiality, Privacy
- **System name** — the system being examined
- **System description** — brief description of services provided

If any required field cannot be determined from the engagement letter, ask the auditor explicitly. Do not guess.

### Optional Fields (extract if present, mark TBD if not)
- Intended report users
- Engagement team (partner, manager, senior, staff)
- Timeline milestones
- Subservice organizations and method (carve-out vs. inclusive)
- Predecessor auditor information (prior firm, prior report type, prior opinion, prior exceptions)
- Principal service commitments and system requirements

Optional fields that cannot be determined are set to "TBD — to be determined during planning." They do not block kickoff.

## Step 2: Confirm Engagement Terms

Present ALL extracted terms to the auditor in a clean summary. Use AskUserQuestion:

```
Engagement Terms Extracted
──────────────────────────────────────────────────

Client:          [name]
System:          [system name]
Type:            SOC 2 Type [I / II]
Period:          [start] to [end]  (or "As of [date]" for Type I)

Trust Service Categories:
  Security (CC1–CC9):       Always in scope
  Availability (A1):        [In Scope / Out of Scope]
  Processing Integrity (PI1): [In Scope / Out of Scope]
  Confidentiality (C1):     [In Scope / Out of Scope]
  Privacy (P1–P8):          [In Scope / Out of Scope]

Engagement Team:  [names/roles or TBD]
Timeline:         [key dates or TBD]
Subservice Orgs:  [names or None]
Prior Auditor:    [name or N/A]

──────────────────────────────────────────────────
Are these terms correct? (yes / provide corrections)
```

**GATE: Do NOT proceed until the auditor explicitly confirms the terms.**

If the auditor provides corrections, update the extracted values and re-present for confirmation. Repeat until confirmed.

## Step 3: Create .audit/ Directory Structure

Create the following directory structure at the project root:

```
.audit/
├── ENGAGEMENT.md
├── STATE.md
├── config.json
├── SCOPE.md
├── workpapers/
└── deliverables/
```

### 3a: Write ENGAGEMENT.md

Use the engagement template (@.claude/skills/soc2-templates/engagement.md). Replace all `{{placeholder}}` values with the confirmed engagement terms. For optional fields not provided, set to "TBD — to be determined during planning".

### 3b: Write STATE.md

Initialize the state file:
- Current Phase: Kickoff
- Phase History: Kickoff started with today's date (ISO 8601: YYYY-MM-DD)
- All counters set to 0
- No open items

### 3c: Write config.json

Initialize from the config template (@.claude/skills/soc2-templates/config.json):
- Set `engagement.client`, `engagement.type`, `engagement.periodStart`, `engagement.periodEnd`
- Set `engagement.id` to a unique identifier (client name + period, slugified)
- Default sampling parameters are pre-populated from the template
- Leave firm info and integrations empty for now

### 3d: Write SCOPE.md

Initialize from the scope template:
- Security (Common Criteria): Status = "In Scope" (always)
- Other categories: Set status based on confirmed engagement terms
- Leave system boundary tables with placeholder rows for client to populate
- Leave exclusions empty

### 3e: Create directories

```bash
mkdir -p .audit/workpapers
mkdir -p .audit/deliverables
```

## Step 4: Display Summary and Next Steps

After creating all files, display:

```
===========================================================
  Engagement Initialized Successfully
===========================================================

  Client:     [name]
  System:     [system name]
  Type:       SOC 2 Type [I/II]
  Period:     [dates]
  TSC Scope:  [categories in scope]

  Files Created:
    .audit/ENGAGEMENT.md     Engagement terms and team
    .audit/STATE.md          Phase tracking
    .audit/config.json       Configuration and defaults
    .audit/SCOPE.md          TSC scope and boundaries
    .audit/workpapers/       (empty — populated during testing)
    .audit/deliverables/     (empty — populated during packaging)

  ─────────────────────────────────────────────────────────
  NEXT STEP: Run /soc2-plan to begin audit planning
             (risk assessment + control identification)
  ─────────────────────────────────────────────────────────

  Full workflow:
    1. /soc2-kickoff  ← YOU ARE HERE (complete)
    2. /soc2-plan     ← NEXT
    3. /soc2-pbc
    4. /soc2-sample
    5. /soc2-test
    6. /soc2-workpaper
    7. /soc2-review
    8. /soc2-package
===========================================================
```

</process>

<guidelines>
- NEVER proceed past any confirmation gate without explicit auditor approval
- If the engagement letter is ambiguous about Type I vs Type II, ask explicitly — this distinction drives the entire engagement
- Security (Common Criteria CC1–CC9) is ALWAYS in scope — do not ask about it
- For Type I: the "period" is a single as-of date, not a date range. Adjust all language accordingly.
- Use ISO 8601 date format (YYYY-MM-DD) in all generated files
- Do not create workpaper subdirectories yet — those are created during /soc2-sample and /soc2-test
- If .audit/ already exists, ALWAYS warn and get explicit confirmation before overwriting (Step 0)
- Optional fields should never block engagement kickoff — mark as TBD and move forward
</guidelines>
