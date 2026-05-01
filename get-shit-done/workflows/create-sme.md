<step name="init_context" priority="first">
Load create-sme context:

```bash
INIT=$(gsd-sdk query init.map-codebase)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract from init JSON: `commit_docs`, `planning_exists`, `date`, `project_root`, `project_title`, `text_mode`.

```bash
CREATOR_MODEL=$(gsd-sdk query resolve-model gsd-sme-creator --raw)
AGENT_SKILLS_CREATOR=$(gsd-sdk query agent-skills gsd-sme-creator)
```

**If `planning_exists` is false:** Display error: "No .planning/ directory found. Run `/gsd-new-project` first." Exit workflow.

**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set
`TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from
init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion`
call with a plain-text numbered list and ask the user to type their choice number.
This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where
`AskUserQuestion` is not available.
</step>

<step name="resolve_process_name">
Parse `$ARGUMENTS` to determine if a process name was provided.

**If process name provided** (non-empty, non-flag argument in `$ARGUMENTS`):
- Set `PROCESS_NAME` to the provided value
- Skip to step 3 (validation)

**If no process name provided** (empty `$ARGUMENTS` or only flags like `--text`):
- Query existing SMEs:
  ```bash
  SME_LIST=$(gsd-sdk query sme.list)
  ```
  Parse the JSON response to extract `enabled` and `smes[]` array.

- If `enabled` is false: display note — "SME agents are disabled (`workflow.use_sme_agents: false`). Creating an SME will work but the gate integration is inactive. Enable in `/gsd-settings`."

- Build an interactive menu using `AskUserQuestion`:
  ```
  AskUserQuestion(
    header: "Create SME",
    question: |
      Which process would you like to analyze?

      Existing SMEs:
      {for each sme in smes[]: "  - {process_name} ({finding_counts.blocker}B / {finding_counts.warning}W / {finding_counts.watch}W)"}
      {if smes[] is empty: "  (none yet)"}

      Or type a new process name below (e.g. 'contribution', 'enrollment', 'billing').
    followUp: "Process name:"
  )
  ```
- Set `PROCESS_NAME` to the user's response.
</step>

<step name="validate_process_name">
Validate `PROCESS_NAME` against the safe regex before any filesystem use:

```bash
if [[ ! "$PROCESS_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "ERROR: Process name must contain only letters, digits, hyphens, and underscores."
  echo "Got: '$PROCESS_NAME'"
  exit 1
fi
```

Ensure the `.planning/smes/` directory exists:

```bash
mkdir -p .planning/smes
```
</step>

<step name="check_existing_sme">
Check for exact match AND fuzzy overlap with existing SMEs.

**Phase 1: Exact match check**

```bash
SME_PATH=".planning/smes/${PROCESS_NAME}-SME.md"
```

**Phase 2: Fuzzy overlap scan (bidirectional substring matching)**

Scan all existing `*-SME.md` files in `.planning/smes/` and collect any whose
base name (without the `-SME.md` suffix) overlaps with `PROCESS_NAME`.

Overlap is defined as **bidirectional case-insensitive substring match**:
- The input is a substring of an existing name: "document" matches "document-creation"
- An existing name is a substring of the input: "document-creation" matches "document"

```bash
OVERLAPPING_SMES=""
if [ -d ".planning/smes" ]; then
  INPUT_LOWER=$(echo "$PROCESS_NAME" | tr '[:upper:]' '[:lower:]')
  for sme_file in .planning/smes/*-SME.md; do
    [ -f "$sme_file" ] || continue
    base=$(basename "$sme_file" -SME.md)
    BASE_LOWER=$(echo "$base" | tr '[:upper:]' '[:lower:]')
    # Skip exact match -- handled separately
    [ "$BASE_LOWER" = "$INPUT_LOWER" ] && continue
    # Bidirectional substring: input-in-existing OR existing-in-input (case-insensitive)
    if echo "$BASE_LOWER" | grep -q "$INPUT_LOWER" || echo "$INPUT_LOWER" | grep -q "$BASE_LOWER"; then
      OVERLAPPING_SMES="${OVERLAPPING_SMES}${OVERLAPPING_SMES:+, }${base}-SME.md"
    fi
  done
fi
```

**Phase 3: Decision tree**

**Case A -- Exact match exists (`$SME_PATH` exists):**

Present the same update/create/cancel choice as before:

```
AskUserQuestion(
  header: "SME Exists",
  question: "An SME document already exists for '${PROCESS_NAME}' at ${SME_PATH}. What would you like to do?",
  options:
    - "Update existing -- refresh with current code state"
    - "Create new -- overwrite with a fresh analysis"
    - "Cancel"
)
```

- If "Cancel": display "Cancelled." and exit workflow.
- If "Update existing": set `UPDATE_MODE=true`
- If "Create new": set `UPDATE_MODE=false`

Set `RELATED_SMES` from the overlap scan (may be empty -- that is fine).

**Case B -- No exact match, but fuzzy overlaps found (`OVERLAPPING_SMES` is non-empty):**

Present an overlap-aware choice:

```
AskUserQuestion(
  header: "Overlapping SME Detected",
  question: |
    The process name '${PROCESS_NAME}' overlaps with existing SME(s):
      ${OVERLAPPING_SMES}

    This may indicate a near-duplicate. What would you like to do?
  options:
    - "Update existing -- switch to updating the overlapping SME instead"
    - "Create new alongside -- create '${PROCESS_NAME}-SME.md' as a separate SME (will cross-reference)"
    - "Cancel"
)
```

- If "Cancel": display "Cancelled." and exit workflow.
- If "Update existing":
  - If only one overlap: set `PROCESS_NAME` to that SME's base name, `SME_PATH` to its path, `UPDATE_MODE=true`
  - If multiple overlaps: ask user which one to update (numbered list)
- If "Create new alongside": set `UPDATE_MODE=false`, set `RELATED_SMES="${OVERLAPPING_SMES}"`

**Case C -- No exact match, no overlaps:**

Set `UPDATE_MODE=false`, `RELATED_SMES=""`, continue to step 5.
</step>

<step name="spawn_creator">
Display ASCII banner and spawn the creator agent:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CREATE SME -- {PROCESS_NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning SME creator...
```

Spawn the creator as a blocking Task (NOT background):

```
Task(
  subagent_type="gsd-sme-creator",
  model="{CREATOR_MODEL}",
  description="Create SME for {PROCESS_NAME}",
  prompt="Process: {PROCESS_NAME}
Today: {date}

Analyze the '{PROCESS_NAME}' process and produce .planning/smes/{PROCESS_NAME}-SME.md.

{if UPDATE_MODE is true: 'UPDATE MODE: An SME already exists at .planning/smes/{PROCESS_NAME}-SME.md. Refresh it with the current code state. Preserve historical findings that still apply.'}

{if RELATED_SMES is non-empty: 'RELATED SMES: The following existing SMEs overlap with this process: ${RELATED_SMES}. Populate the related_smes frontmatter field with these filenames. Consider reading them for context on what is already documented.'}

{AGENT_SKILLS_CREATOR}"
)
```

> **ORCHESTRATOR RULE -- CODEX RUNTIME**: After calling Task() above, stop working
> on this task immediately. Do not read more files, edit code, or run tests related
> to this task while the subagent is active. Wait for the subagent to return its
> result.
</step>

<step name="handle_return">
After Task() returns, check the creator's return marker:

**If `## SME Creation Complete`:**
- Parse the return text for: process name, finding counts (BLOCKERs, WARNINGs, WATCHes), output path
- Continue to step 7 (commit_and_complete)

**If no return marker or error text:**
- Display error: "SME creation failed. Check the creator agent output above for details."
- Offer: "Retry with `/gsd-create-sme {PROCESS_NAME}` or investigate manually."
- Exit workflow
</step>

<step name="commit_and_complete">
If `commit_docs` from init context is true:

```bash
gsd-sdk query commit "feat: create ${PROCESS_NAME} SME document" --files ".planning/smes/${PROCESS_NAME}-SME.md"
```

Display completion summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SME CREATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Created: .planning/smes/{PROCESS_NAME}-SME.md
Findings: {N} BLOCKERs, {M} WARNINGs, {K} WATCHes

---

## ▶ Next Up

To create another SME:
/gsd-create-sme [process-name]

To enable the plan-phase gate (Phase 6):
Set workflow.use_sme_agents: true in /gsd-settings
```
</step>
