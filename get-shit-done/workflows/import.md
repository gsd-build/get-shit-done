# Import Workflow

External plan ingestion with conflict detection and agent delegation.

- **--from**: Import external plan → conflict detection → write PLAN.md → validate via gsd-plan-checker

Future: `--prd` mode (PRD extraction into PROJECT.md + REQUIREMENTS.md + ROADMAP.md) is planned for a follow-up PR.

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
- If `--prd` is present: display message that `--prd` is not yet implemented and exit:
  ```
  GSD > --prd mode is planned for a future release. Use --from to import plan files.
  ```
- If neither flag is found: display usage and exit:

```
Usage: /gsd-import --from <path>

  --from <path>   Import an external plan file into GSD format
```

**Validate the file path:**

Verify the path does not contain traversal sequences and the file exists:

```bash
case "{FILEPATH}" in
  *..* ) echo "SECURITY_ERROR: path contains traversal sequence"; exit 1 ;;
esac
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
2. Read `.planning/PROJECT.md` — extract project constraints, tech stack, scope boundaries.
   **If PROJECT.md does not exist:** skip constraint checks that rely on it and display:
   ```
   GSD > Note: No PROJECT.md found. Conflict checks against project constraints will be skipped.
   ```
3. Read `.planning/REQUIREMENTS.md` — extract existing requirements for overlap and contradiction checks.
   **If REQUIREMENTS.md does not exist:** skip requirement conflict checks and continue.
4. Glob for all CONTEXT.md files across phase directories:
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

Run conflict checks against the loaded project context. The report format, severity semantics, and safety-gate behavior are defined by `references/doc-conflict-engine.md` — read it and apply it here. Operation noun: `import`.

### BLOCKER checks (any one prevents import):

- Plan targets a phase number that does not exist in ROADMAP.md → [BLOCKER]
- Plan specifies a tech stack that contradicts PROJECT.md constraints → [BLOCKER]
- Plan contradicts a locked decision in any CONTEXT.md `<decisions>` block → [BLOCKER]
- Plan contradicts an existing requirement in REQUIREMENTS.md → [BLOCKER]

### WARNING checks (user confirmation required):

- Plan partially overlaps existing requirement coverage in REQUIREMENTS.md → [WARNING]
- Plan has `depends_on` referencing plans that are not yet complete → [WARNING]
- Plan modifies files that overlap with existing incomplete plans → [WARNING]
- Plan phase number conflicts with existing phase numbering in ROADMAP.md → [WARNING]

### INFO checks (informational, no action needed):

- Plan uses a library not currently in the project tech stack → [INFO]
- Plan adds a new phase to the ROADMAP.md structure → [INFO]

Render the full Conflict Detection Report using the format in `references/doc-conflict-engine.md`.

**If any [BLOCKER] exists:** apply the safety gate from the reference — exit WITHOUT writing any files. No PLAN.md is written when blockers exist.

**If only WARNINGS and/or INFO (no blockers):**

**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.

Ask via AskUserQuestion using the approve-revise-abort pattern (see `references/gate-prompts.md`):
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

**Reject PBR naming conventions in source content:**
If the imported plan references PBR plan naming (e.g., `PLAN-01.md`, `plan-01.md`), rename all references to GSD `{NN}-{MM}-PLAN.md` convention during conversion.

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
- Display: "Plan validation passed"

</step>

<step name="plan_finalize">

Update `.planning/ROADMAP.md` to reflect the new plan:
- Add the plan to the Plans list under the correct phase section
- Include the plan name and description

Update `.planning/STATE.md` if appropriate (e.g., increment total plan count).

Commit the imported plan and updated files:
```bash
gsd-sdk query commit "docs({phase}): import plan from {basename FILEPATH}" .planning/phases/{phase}/{plan}-PLAN.md .planning/ROADMAP.md
```

Display completion:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► IMPORT COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Show: plan filename written, phase directory, validation result, next steps.

</step>

---

## Anti-Patterns

Do NOT:
- Violate the shared conflict-engine contract in `references/doc-conflict-engine.md` (no markdown tables, no new severity labels, no bypass of the BLOCKER gate)
- Write PLAN.md files as `PLAN-01.md` or `plan-01.md` — always use `{NN}-{MM}-PLAN.md`
- Use `pbr:plan-checker` or `pbr:planner` — use `gsd-plan-checker` and `gsd-planner`
- Write `.planning/.active-skill` — this is a PBR pattern with no GSD equivalent
- Reference `pbr-tools`, `pbr:`, or `PLAN-BUILD-RUN` anywhere
- Write any PLAN.md file when blockers exist — the safety gate must hold
- Skip path validation on the --from file argument
