# Import Workflow

External plan and PRD ingestion with conflict detection and agent delegation.

Two execution paths:
- **--from**: Import external plan → conflict detection → write PLAN.md → validate via gsd-plan-checker
- **--prd**: Extract PRD → generate PROJECT.md + REQUIREMENTS.md → delegate ROADMAP.md to gsd-planner

---

<step name="banner">

Display the stage banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► IMPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</step>

<step name="parse_arguments">

Parse `$ARGUMENTS` to determine the execution mode:

- If `--from` is present: extract FILEPATH (the next token after `--from`), set MODE=plan
- If `--prd` is present: extract FILEPATH (the next token after `--prd`), set MODE=prd
- If neither flag is found: display usage and exit:

```
Usage: /gsd-import --from <path> | --prd <path>

  --from <path>   Import an external plan file into GSD format
  --prd <path>    Extract a PRD into PROJECT.md, REQUIREMENTS.md, and ROADMAP.md
```

Validate that FILEPATH exists:

```bash
test -f "{FILEPATH}" || echo "FILE_NOT_FOUND"
```

If FILE_NOT_FOUND: display error and exit:

```
╔══════════════════════════════════════════════════════════════╗
║  ERROR                                                       ║
╚══════════════════════════════════════════════════════════════╝

File not found: {FILEPATH}

**To fix:** Verify the file path and try again.
```

</step>

---

## Path A: MODE=plan (--from)

<step name="plan_load_context">

Load project context for conflict detection:

1. Read `.planning/ROADMAP.md` — extract phase structure, phase numbers, dependencies
2. Read `.planning/PROJECT.md` — extract project constraints, tech stack, scope boundaries
3. Glob for all CONTEXT.md files across phase directories:
   ```bash
   find .planning/phases/ -name "*-CONTEXT.md" -o -name "CONTEXT.md" 2>/dev/null
   ```
   Read each CONTEXT.md found — extract locked decisions (any decision in a `<decisions>` block)

Store loaded context for conflict detection in the next step.

</step>

<step name="plan_read_input">

Read the imported file at FILEPATH.

Determine the format:
- **GSD PLAN.md format**: Has YAML frontmatter with `phase:`, `plan:`, `type:` fields
- **Freeform document**: Any other format (markdown spec, design doc, task list, etc.)

Extract from the imported content:
- **Phase target**: Which phase this plan belongs to (from frontmatter or inferred from content)
- **Plan objectives**: What the plan aims to accomplish
- **Tasks listed**: Individual work items described in the plan
- **Files modified**: Any files mentioned as targets
- **Dependencies**: Any referenced prerequisites

</step>

<step name="plan_conflict_detection">

Run conflict checks against the loaded project context. Output as a plain-text conflict report using [BLOCKER], [WARNING], and [INFO] labels. Do NOT use markdown tables (no `|---|` format).

### BLOCKER checks (any one prevents import):

- Plan targets a phase number that does not exist in ROADMAP.md → [BLOCKER]
- Plan specifies a tech stack that contradicts PROJECT.md constraints → [BLOCKER]
- Plan contradicts a locked decision in any CONTEXT.md `<decisions>` block → [BLOCKER]
- Plan uses PBR plan naming convention (PLAN-01.md, plan-01.md) → [BLOCKER] naming convention violation

### WARNING checks (user confirmation required):

- Plan has `depends_on` referencing plans that are not yet complete → [WARNING]
- Plan modifies files that overlap with existing incomplete plans → [WARNING]
- Plan phase number conflicts with existing phase numbering in ROADMAP.md → [WARNING]

### INFO checks (informational, no action needed):

- Plan uses a library not currently in the project tech stack → [INFO]
- Plan adds a new phase to the ROADMAP.md structure → [INFO]

Display the full Conflict Detection Report:

```
## Conflict Detection Report

### BLOCKERS ({N})

[BLOCKER] {Short title}
  Found: {what the imported plan says}
  Expected: {what project context requires}
  → {Specific action to resolve}

### WARNINGS ({N})

[WARNING] {Short title}
  Found: {what was detected}
  Impact: {what could go wrong}
  → {Suggested action}

### INFO ({N})

[INFO] {Short title}
  Note: {relevant information}
```

**If any [BLOCKER] exists:**

Display:
```
GSD > BLOCKED: {N} blockers must be resolved before import can proceed.
```

Exit WITHOUT writing any files. This is the safety gate — no PLAN.md is written when blockers exist.

**If only WARNINGS and/or INFO (no blockers):**

Ask via AskUserQuestion using the approve-revise-abort pattern:
- question: "Review the warnings above. Proceed with import?"
- header: "Approve?"
- options: Approve | Abort

If user selects "Abort": exit cleanly with message "Import cancelled."

</step>

<step name="plan_convert">

Convert the imported content to GSD PLAN.md format.

Ensure the PLAN.md has all required frontmatter fields:
```yaml
---
phase: "{NN}-{slug}"
plan: "{NN}-{MM}"
type: "feature|refactor|config|test|docs"
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths: []
  artifacts: []
---
```

Apply GSD naming convention for the output filename:
- Format: `{NN}-{MM}-PLAN.md` (e.g., `04-01-PLAN.md`)
- NEVER use `PLAN-01.md`, `plan-01.md`, or any other format
- NN = phase number (zero-padded), MM = plan number within the phase (zero-padded)

Determine the target directory:
```
.planning/phases/{NN}-{slug}/
```

If the directory does not exist, create it:
```bash
mkdir -p ".planning/phases/{NN}-{slug}/"
```

Write the PLAN.md file to the target directory.

</step>

<step name="plan_validate">

Delegate validation to gsd-plan-checker:

```
Task({
  subagent_type: "gsd-plan-checker",
  prompt: "Validate: .planning/phases/{phase}/{plan}-PLAN.md — check frontmatter completeness, task structure, and GSD conventions. Report any issues."
})
```

If the checker returns errors:
- Display the errors to the user
- Ask the user to resolve issues before the plan is considered imported
- Do not delete the written file — the user can fix and re-validate manually

If the checker returns clean:
- Display: "✓ Plan validation passed"

</step>

<step name="plan_finalize">

Update `.planning/ROADMAP.md` to reflect the new plan:
- Add the plan to the Plans list under the correct phase section
- Include the plan name and description

Update `.planning/STATE.md` if appropriate (e.g., increment total plan count).

Commit the imported plan and updated files:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs({phase}): import plan from {basename FILEPATH}" --files .planning/phases/{phase}/{plan}-PLAN.md .planning/ROADMAP.md
```

Display completion:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► IMPORT COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Show: plan filename written, phase directory, validation result, next steps.

</step>

---

## Path B: MODE=prd (--prd)

<step name="prd_read">

Read the PRD file at FILEPATH.

Identify and extract sections:
- **Objectives**: What the project aims to achieve
- **Requirements**: Functional and non-functional requirements
- **Out-of-scope**: Explicitly excluded items
- **Constraints**: Technical, timeline, or resource constraints
- **Tech stack**: Languages, frameworks, databases, infrastructure

</step>

<step name="prd_gap_detection">

Identify missing required information. Ask at most 3 AskUserQuestion prompts total — do not exceed this limit.

Check for and ask about (only if missing from the PRD):

1. **Missing project name** → ask: "What is the project name?"
2. **Missing tech stack** → ask: "What tech stack will this use? (or 'TBD' to skip)"
3. **Missing core objective** → ask: "What is the single core problem this solves?"

If the information is already present in the PRD, skip that question. The goal is zero questions when the PRD is complete.

</step>

<step name="prd_generate_docs">

Generate PROJECT.md content inline (no template file):

```markdown
# Project: {name}

## What This Is

{Description from PRD objectives}

## Core Value

{Core objective / problem statement}

## Requirements

### Active

{Requirements extracted from PRD}

### Out of Scope

{Out-of-scope items from PRD}

## Context

{Constraints, tech stack, timeline from PRD}

## Constraints

{Technical and resource constraints}

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| {decisions from PRD} | {rationale} | -- Pending |
```

Generate REQUIREMENTS.md content inline:

```markdown
# Requirements

## Traceability

| ID | Description | Status | Phase |
|----|-------------|--------|-------|
| PRD-01 | {requirement 1} | [ ] | TBD |
| PRD-02 | {requirement 2} | [ ] | TBD |
| ... | ... | ... | ... |

## Details

### PRD-01: {requirement title}

{Requirement description from PRD}

### PRD-02: {requirement title}

{Requirement description from PRD}
```

Use PRD-{NN} format for requirement IDs extracted from the PRD.

</step>

<step name="prd_confirm">

Display the generated PROJECT.md and REQUIREMENTS.md content to the user.

Ask via AskUserQuestion using the approve-revise-abort pattern:
- question: "Review the generated PROJECT.md and REQUIREMENTS.md above. Proceed?"
- header: "Approve?"
- options: Approve | Request changes | Abort

If "Request changes": ask what to change, apply the revisions, and re-confirm (max 1 revision cycle).
If "Abort": exit cleanly with message "Import cancelled."
If "Approve": proceed to write files.

</step>

<step name="prd_write">

Write the generated documents:

```
.planning/PROJECT.md
.planning/REQUIREMENTS.md
```

Create the `.planning/` directory if it does not exist:
```bash
mkdir -p .planning
```

</step>

<step name="prd_roadmap">

Delegate ROADMAP.md generation to gsd-planner:

```
Task({
  subagent_type: "gsd-planner",
  prompt: "Generate a ROADMAP.md for this project:\n\nPROJECT.md content:\n{content}\n\nREQUIREMENTS.md content:\n{content}\n\nWrite .planning/ROADMAP.md following GSD roadmap format with phases, requirements coverage, and success criteria."
})
```

Wait for the planner to complete. Verify that `.planning/ROADMAP.md` was written.

</step>

<step name="prd_finalize">

Commit the generated planning documents:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(planning): import PRD from {basename FILEPATH}" --files .planning/PROJECT.md .planning/REQUIREMENTS.md .planning/ROADMAP.md
```

Display completion:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► IMPORT COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Show summary:
- Artifacts written: PROJECT.md, REQUIREMENTS.md, ROADMAP.md
- Requirement count: {N} requirements extracted
- Phase count: {N} phases in ROADMAP.md
- Next steps: `/gsd-discuss-phase 1` to begin detailed phase planning

</step>

---

## Anti-Patterns

Do NOT:
- Use markdown tables (`|---|`) in the conflict detection report — use plain-text [BLOCKER]/[WARNING]/[INFO] labels
- Write PLAN.md files as `PLAN-01.md` or `plan-01.md` — always use `{NN}-{MM}-PLAN.md`
- Use `pbr:plan-checker` or `pbr:planner` — use `gsd-plan-checker` and `gsd-planner`
- Write `.planning/.active-skill` — this is a PBR pattern with no GSD equivalent
- Reference `pbr-tools`, `pbr:`, or `PLAN-BUILD-RUN` anywhere
- Ask more than 3 AskUserQuestion prompts in the --prd gap detection step
- Write any PLAN.md file when blockers exist — the safety gate must hold
