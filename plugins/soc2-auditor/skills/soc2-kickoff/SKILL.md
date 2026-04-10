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

## Step 1: Ingest Engagement Letter

Read the engagement letter provided by the user (via file path or @reference in $ARGUMENTS).

If no engagement letter is provided, ask the user:
- "Please provide the engagement letter file path, or paste the key engagement terms."

Extract the following from the engagement letter:

### Required Fields
- **Client name** — legal entity name of the service organization
- **Engagement type** — SOC 2 Type I or Type II
- **Audit period** — start date and end date (Type II) or as-of date (Type I)
- **Trust Service Categories in scope** — Security is always required; check for Availability, Processing Integrity, Confidentiality, Privacy
- **System name** — the system being examined
- **System description** — brief description of services provided

### Optional Fields (extract if present, ask if not)
- Intended report users
- Engagement team (partner, manager, senior, staff)
- Timeline milestones
- Subservice organizations and method (carve-out vs. inclusive)
- Predecessor auditor information
- Principal service commitments and system requirements

## Step 2: Confirm Engagement Terms

Present the extracted terms to the auditor in a clean summary table. Use AskUserQuestion to confirm:

"I've extracted the following engagement terms. Please review and confirm, or provide corrections:

[Display extracted terms in table format]

- Client: [name]
- Type: SOC 2 Type [I/II]
- Period: [start] to [end]
- TSC in scope: [Security, ...]
- System: [name]

Are these correct? (yes / provide corrections)"

**GATE: Do NOT proceed until the auditor confirms the terms.**

If the auditor provides corrections, update the extracted values and re-confirm.

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

Use the engagement template. Replace all `{{placeholder}}` values with the confirmed engagement terms. For any fields not provided, leave as "TBD — to be determined during planning".

### 3b: Write STATE.md

Initialize the state file:
- Current Phase: Kickoff
- Phase History: Kickoff started with today's date
- All counters set to 0
- No open items

### 3c: Write config.json

Initialize the config file:
- Set engagement.client, engagement.type, engagement.periodStart, engagement.periodEnd
- Set default sampling parameters
- Leave firm info and integrations empty for now

### 3d: Write SCOPE.md

Initialize the scope file:
- Security (Common Criteria): Status = In Scope
- Other categories: Set status based on engagement letter extraction
- Leave system boundary tables with placeholder rows
- Leave exclusions empty

### 3e: Create directories

```bash
mkdir -p .audit/workpapers
mkdir -p .audit/deliverables
```

## Step 4: Display Summary and Next Steps

After creating all files, display:

```
SOC 2 Engagement Initialized

Client: [name]
Type: SOC 2 Type [I/II]
Period: [dates]
TSC Scope: [categories]

Created:
  .audit/ENGAGEMENT.md
  .audit/STATE.md
  .audit/config.json
  .audit/SCOPE.md
  .audit/workpapers/
  .audit/deliverables/

Next step: Run /soc2-plan to begin audit planning (risk assessment + control identification)
```

</process>

<guidelines>
- NEVER proceed past the confirmation gate without auditor approval
- If the engagement letter is ambiguous about Type I vs Type II, ask explicitly
- Security (Common Criteria) is ALWAYS in scope — do not ask about it
- For Type I: the "period" is a single as-of date, not a range
- Use ISO 8601 date format (YYYY-MM-DD) in all generated files
- Do not create workpaper subdirectories yet — those are created by soc2-sample and soc2-test
- If .audit/ already exists, warn the auditor and ask whether to overwrite or abort
</guidelines>
