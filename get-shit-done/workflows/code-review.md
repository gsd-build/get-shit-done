<purpose>
Review source files changed during a phase for bugs, security issues, and code quality problems. Computes file scope (--files override > SUMMARY.md > git diff fallback), checks config gate, spawns gsd-code-reviewer agent, commits REVIEW.md, and presents results to user.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<available_agent_types>
- gsd-code-reviewer: Reviews source files for bugs and quality issues
</available_agent_types>

<process>

<step name="initialize">
Parse arguments and load project state:

```bash
PHASE_ARG="${1}"
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse from init JSON: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `padded_phase`, `commit_docs`.

**Input sanitization (defense-in-depth):**
```bash
# Validate PADDED_PHASE contains only digits and optional dot (e.g., "02", "03.1")
if ! [[ "$PADDED_PHASE" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  echo "Error: Invalid phase number format: '${PADDED_PHASE}'. Expected digits (e.g., 02, 03.1)."
  # Exit workflow
fi
```

**Phase validation (before config gate):**
If `phase_found` is false, report error and exit:
```
Error: Phase ${PHASE_ARG} not found. Run /gsd-status to see available phases.
```

This runs BEFORE config gate check so user errors are surfaced immediately regardless of config state.

Parse optional flags from $ARGUMENTS:

**--depth flag:**
```bash
DEPTH_OVERRIDE=""
for arg in "$@"; do
  if [[ "$arg" == --depth=* ]]; then
    DEPTH_OVERRIDE="${arg#--depth=}"
  fi
done
```

**--files flag:**
```bash
FILES_OVERRIDE=""
for arg in "$@"; do
  if [[ "$arg" == --files=* ]]; then
    FILES_OVERRIDE="${arg#--files=}"
  fi
done
```

If FILES_OVERRIDE is set, split by comma into array:
```bash
if [ -n "$FILES_OVERRIDE" ]; then
  IFS=',' read -ra FILES_ARRAY <<< "$FILES_OVERRIDE"
fi
```
</step>

<step name="check_config_gate">
Check if code review is enabled via config:

```bash
CODE_REVIEW_ENABLED=$(gsd-sdk query config-get workflow.code_review 2>/dev/null || echo "true")
```

If CODE_REVIEW_ENABLED is "false":
```
Code review skipped (workflow.code_review=false in config)
```
Exit workflow.

Default is true — only skip on explicit false. This check runs AFTER phase validation so invalid phase errors are shown first.
</step>

<step name="resolve_depth">
Determine review depth with priority order:

1. DEPTH_OVERRIDE from --depth flag (highest priority)
2. Config value: `gsd-sdk query config-get workflow.code_review_depth 2>/dev/null`
3. Default: "standard"

```bash
if [ -n "$DEPTH_OVERRIDE" ]; then
  REVIEW_DEPTH="$DEPTH_OVERRIDE"
else
  CONFIG_DEPTH=$(gsd-sdk query config-get workflow.code_review_depth 2>/dev/null || echo "")
  REVIEW_DEPTH="${CONFIG_DEPTH:-standard}"
fi
```

**Validate depth value:**
```bash
case "$REVIEW_DEPTH" in
  quick|standard|deep)
    # Valid
    ;;
  *)
    echo "Warning: Invalid depth '${REVIEW_DEPTH}'. Valid values: quick, standard, deep. Using 'standard'."
    REVIEW_DEPTH="standard"
    ;;
esac
```
</step>

<step name="compute_file_scope">
Three-tier scoping with explicit precedence:

**Tier 1 — --files override (highest precedence per D-08):**

If FILES_OVERRIDE is set (from --files flag):
```bash
if [ -n "$FILES_OVERRIDE" ]; then
  REVIEW_FILES=()
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
  
  for file_path in "${FILES_ARRAY[@]}"; do
    # Security: validate path is within repository (prevent path traversal)
    ABS_PATH=$(realpath -m "${file_path}" 2>/dev/null || echo "${file_path}")
    if [[ "$ABS_PATH" != "$REPO_ROOT"* ]]; then
      echo "Error: File path outside repository, skipping: ${file_path}"
      continue
    fi
    
    # Validate path exists (relative to repo root)
    if [ -f "${REPO_ROOT}/${file_path}" ] || [ -f "${file_path}" ]; then
      REVIEW_FILES+=("$file_path")
    else
      echo "Warning: File not found, skipping: ${file_path}"
    fi
  done
  
  echo "File scope: ${#REVIEW_FILES[@]} files from --files override"
fi
```

Skip SUMMARY/git scoping entirely when --files is provided.

**Tier 2 — SUMMARY.md extraction (primary per D-01):**

If --files NOT provided:
```bash
if [ -z "$FILES_OVERRIDE" ]; then
  SUMMARIES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
  REVIEW_FILES=()
  
  if [ -n "$SUMMARIES" ]; then
    for summary in $SUMMARIES; do
      # Extract key_files.created and key_files.modified using node for reliable YAML parsing
      # This avoids fragile awk parsing that breaks on indentation differences
      EXTRACTED=$(node -e "
        const fs = require('fs');
        const content = fs.readFileSync('$summary', 'utf-8');
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match) { process.exit(0); }
        const yaml = match[1];
        const files = [];
        let inSection = null;
        for (const line of yaml.split('\n')) {
          if (/^\s+created:/.test(line)) { inSection = 'created'; continue; }
          if (/^\s+modified:/.test(line)) { inSection = 'modified'; continue; }
          if (/^\s*\w+:/.test(line) && !/^\s*-/.test(line)) { inSection = null; continue; }
          if (inSection && /^\s+-\s+(.+)/.test(line)) {
            files.push(line.match(/^\s+-\s+(.+)/)[1].trim());
          }
        }
        if (files.length) console.log(files.join('\n'));
      " 2>/dev/null)
      
      # Add extracted files to REVIEW_FILES array
      if [ -n "$EXTRACTED" ]; then
        while IFS= read -r file; do
          if [ -n "$file" ]; then
            REVIEW_FILES+=("$file")
          fi
        done <<< "$EXTRACTED"
      fi
    done
    
    if [ ${#REVIEW_FILES[@]} -eq 0 ]; then
      echo "Warning: SUMMARY artifacts found but contained no file paths. Falling back to git diff."
    fi
  fi
fi
```

**Tier 3 — Git diff fallback (per D-02):**

If no SUMMARY.md files found OR no files extracted from them:
```bash
if [ ${#REVIEW_FILES[@]} -eq 0 ]; then
  # Compute diff base from phase commits — fail closed if no reliable base found
  PHASE_COMMITS=$(git log --oneline --all --grep="${PADDED_PHASE}" --format="%H" 2>/dev/null)
  
  if [ -n "$PHASE_COMMITS" ]; then
    DIFF_BASE=$(echo "$PHASE_COMMITS" | tail -1)^
    
    # Verify the parent commit exists (first commit in repo has no parent)
    if ! git rev-parse "${DIFF_BASE}" >/dev/null 2>&1; then
      DIFF_BASE=$(echo "$PHASE_COMMITS" | tail -1)
    fi
    
    # Run git diff with specific exclusions (per D-03)
    DIFF_FILES=$(git diff --name-only "${DIFF_BASE}..HEAD" -- . \
      ':!.planning/' ':!ROADMAP.md' ':!STATE.md' \
      ':!*-SUMMARY.md' ':!*-VERIFICATION.md' ':!*-PLAN.md' \
      ':!package-lock.json' ':!yarn.lock' ':!Gemfile.lock' ':!poetry.lock' 2>/dev/null)
    
    while IFS= read -r file; do
      [ -n "$file" ] && REVIEW_FILES+=("$file")
    done <<< "$DIFF_FILES"
    
    echo "File scope: ${#REVIEW_FILES[@]} files from git diff (base: ${DIFF_BASE})"
  else
    # Fail closed — no reliable diff base found. Do not use arbitrary HEAD~N.
    echo "Warning: No phase commits found for '${PADDED_PHASE}'. Cannot determine reliable diff scope."
    echo "Use --files flag to specify files explicitly: /gsd:code-review ${PHASE_ARG} --files=file1,file2,..."
  fi
fi
```

**Post-processing (all tiers):**

1. **Apply exclusions (per D-03):** Remove paths matching planning artifacts
```bash
FILTERED_FILES=()
for file in "${REVIEW_FILES[@]}"; do
  # Skip planning directory and specific artifacts
  if [[ "$file" == .planning/* ]] || \
     [[ "$file" == ROADMAP.md ]] || \
     [[ "$file" == STATE.md ]] || \
     [[ "$file" == *-SUMMARY.md ]] || \
     [[ "$file" == *-VERIFICATION.md ]] || \
     [[ "$file" == *-PLAN.md ]]; then
    continue
  fi
  FILTERED_FILES+=("$file")
done
REVIEW_FILES=("${FILTERED_FILES[@]}")
```

2. **Filter deleted files:** Remove paths that don't exist on disk
```bash
EXISTING_FILES=()
DELETED_COUNT=0
for file in "${REVIEW_FILES[@]}"; do
  if [ -f "$file" ]; then
    EXISTING_FILES+=("$file")
  else
    DELETED_COUNT=$((DELETED_COUNT + 1))
  fi
done
REVIEW_FILES=("${EXISTING_FILES[@]}")

if [ $DELETED_COUNT -gt 0 ]; then
  echo "Filtered $DELETED_COUNT deleted files from review scope"
fi
```

3. **Deduplicate:** Remove duplicate paths (portable — bash 3.2+ compatible, handles spaces in paths)
```bash
DEDUPED=()
while IFS= read -r line; do
  [ -n "$line" ] && DEDUPED+=("$line")
done < <(printf '%s\n' "${REVIEW_FILES[@]}" | sort -u)
REVIEW_FILES=("${DEDUPED[@]}")
```

4. **Sort:** Alphabetical sort for reproducible agent input (already sorted by sort -u above)

**Log final scope and warn if large:**
```bash
if [ -n "$FILES_OVERRIDE" ]; then
  TIER="--files override"
elif [ -n "$SUMMARIES" ] && [ ${#REVIEW_FILES[@]} -gt 0 ]; then
  TIER="SUMMARY.md"
else
  TIER="git diff"
fi
echo "File scope: ${#REVIEW_FILES[@]} files from ${TIER}"

# Warn if file count is very large — may exceed agent context or produce superficial review
if [ ${#REVIEW_FILES[@]} -gt 50 ]; then
  echo "Warning: ${#REVIEW_FILES[@]} files is a large review scope."
  echo "Consider using --files to narrow scope, or --depth=quick for a faster pass."
  if [ "$REVIEW_DEPTH" = "deep" ]; then
    echo "Switching from deep to standard depth for large file count."
    REVIEW_DEPTH="standard"
  fi
fi
```
</step>

<step name="check_empty_scope">
If REVIEW_FILES is empty:
```
No source files changed in phase ${PHASE_ARG}. Skipping review.
```
Exit workflow. Do NOT spawn agent or create REVIEW.md.
</step>

<step name="spawn_reviewer">
Compute the review output path:
```bash
REVIEW_PATH="${PHASE_DIR}/${PADDED_PHASE}-REVIEW.md"
```

Compute DIFF_BASE for agent context (in case agent needs it):
```bash
PHASE_COMMITS=$(git log --oneline --all --grep="${PADDED_PHASE}" --format="%H" 2>/dev/null)
if [ -n "$PHASE_COMMITS" ]; then
  DIFF_BASE=$(echo "$PHASE_COMMITS" | tail -1)^
else
  DIFF_BASE=""
fi
```

Build files_to_read block for agent:
```bash
FILES_TO_READ=""
for file in "${REVIEW_FILES[@]}"; do
  FILES_TO_READ+="- ${file}\n"
done
```

Build config block for agent:
```bash
CONFIG_FILES=""
for file in "${REVIEW_FILES[@]}"; do
  CONFIG_FILES+="  - ${file}\n"
done
```

Spawn the gsd-code-reviewer agent:

```
Task(subagent_type="gsd-code-reviewer", prompt="
<files_to_read>
${FILES_TO_READ}
</files_to_read>

<config>
depth: ${REVIEW_DEPTH}
phase_dir: ${PHASE_DIR}
review_path: ${REVIEW_PATH}
${DIFF_BASE:+diff_base: ${DIFF_BASE}}
files:
${CONFIG_FILES}
</config>

Review the listed source files at ${REVIEW_DEPTH} depth. Write findings to ${REVIEW_PATH}.
Do NOT commit the output — the orchestrator handles that.
")
```

**Agent failure handling:**

If the Task() call fails (agent error, timeout, or exception):
```
Error: Code review agent failed: ${error_message}

No REVIEW.md created. You can retry with /gsd:code-review ${PHASE_ARG} or check agent logs.
```

Do NOT proceed to commit_review step. Do NOT create a partial or empty REVIEW.md. Exit workflow.
</step>

<step name="commit_review">
After agent completes successfully, verify REVIEW.md was created and has valid structure:

```bash
if [ -f "${REVIEW_PATH}" ]; then
  # Validate REVIEW.md has valid YAML frontmatter with status field
  HAS_STATUS=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
    const fs = require('fs');
    const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match && /status:/.test(match[1])) { console.log('valid'); } else { console.log('invalid'); }
  " 2>/dev/null)
  
  if [ "$HAS_STATUS" = "valid" ]; then
    echo "REVIEW.md created at ${REVIEW_PATH}"
    
    if [ "$COMMIT_DOCS" = "true" ]; then
      gsd-sdk query commit \
        "docs(${PADDED_PHASE}): add code review report" \
        --files "${REVIEW_PATH}"
    fi
  else
    echo "Warning: REVIEW.md exists but has invalid or missing frontmatter (no status field)."
    echo "Agent may have produced malformed output. Not committing. Review manually: ${REVIEW_PATH}"
  fi
else
  echo "Warning: Agent completed but REVIEW.md not found at ${REVIEW_PATH}. This may indicate an agent issue."
  echo "No REVIEW.md to commit. Please retry with /gsd:code-review ${PHASE_ARG}"
fi
```
</step>

<step name="present_results">
Read the REVIEW.md YAML frontmatter to extract finding counts.

Extract frontmatter between `---` delimiters first to avoid matching values in the review body:

```bash
# Extract only the YAML frontmatter block (between first two --- lines)
FRONTMATTER=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) process.stdout.write(match[1]);
" 2>/dev/null)

# Parse fields from frontmatter only (not full file)
STATUS=$(echo "$FRONTMATTER" | grep "^status:" | cut -d: -f2 | xargs)
FILES_REVIEWED=$(echo "$FRONTMATTER" | grep "^files_reviewed:" | cut -d: -f2 | xargs)
CRITICAL=$(echo "$FRONTMATTER" | grep "critical:" | head -1 | cut -d: -f2 | xargs)
WARNING=$(echo "$FRONTMATTER" | grep "warning:" | head -1 | cut -d: -f2 | xargs)
INFO=$(echo "$FRONTMATTER" | grep "info:" | head -1 | cut -d: -f2 | xargs)
TOTAL=$(echo "$FRONTMATTER" | grep "total:" | head -1 | cut -d: -f2 | xargs)
```

Display inline summary to user:

```
═══════════════════════════════════════════════════════════════

  Code Review Complete: Phase ${PHASE_NUMBER} (${PHASE_NAME})

───────────────────────────────────────────────────────────────

  Depth:           ${REVIEW_DEPTH}
  Files Reviewed:  ${FILES_REVIEWED}
  
  Findings:
    Critical:  ${CRITICAL}
    Warning:   ${WARNING}
    Info:      ${INFO}
    ──────────
    Total:     ${TOTAL}

───────────────────────────────────────────────────────────────
```

If status is "clean":
```
✓ No issues found. All ${FILES_REVIEWED} files pass review at ${REVIEW_DEPTH} depth.

Full report: ${REVIEW_PATH}
```

If total findings > 0:
```
⚠ Issues found. Review the report for details.

Full report: ${REVIEW_PATH}

Next steps:
  /gsd:code-review-fix ${PHASE_NUMBER}  — Auto-fix issues
  cat ${REVIEW_PATH}                     — View full report
```

If critical > 0 or warning > 0, list top 3 issues inline:
```bash
echo "Top issues:"
grep -A 3 "^### CR-\|^### WR-" "${REVIEW_PATH}" | head -n 12
```

**Note on tests:** Automated tests for this command and workflow are planned for Phase 4 (Pipeline Integration & Testing, requirement INFR-03). Phase 2 focuses on correct implementation; Phase 4 adds regression coverage across platforms.

═══════════════════════════════════════════════════════════════
</step>

</process>

<platform_notes>
**Windows:** This workflow uses bash features (arrays, process substitution). On Windows, it requires
Git Bash or WSL. Native PowerShell is not supported. The CI matrix (Ubuntu/macOS/Windows)
runs under Git Bash on Windows runners, which provides bash compatibility.

**macOS:** macOS ships with bash 3.2 (GPL licensing). This workflow does NOT use `mapfile` (bash 4+
only) — all array construction uses portable `while IFS= read -r` loops compatible with bash 3.2.
The `--files` path validation uses `realpath -m` which requires GNU coreutils (install via
`brew install coreutils`). Without coreutils, the path guard falls back to fail-closed behavior
(rejects paths it cannot verify), so security is maintained but valid relative paths may be rejected.
If `--files` validation fails unexpectedly on macOS, install coreutils or use absolute paths.
</platform_notes>

<success_criteria>
- [ ] Phase validated before config gate check
- [ ] Config gate checked (workflow.code_review)
- [ ] Depth resolved with validation (quick|standard|deep)
- [ ] File scope computed with 3 tiers: --files > SUMMARY.md > git diff
- [ ] Malformed/missing SUMMARY.md handled gracefully with fallback
- [ ] Deleted files filtered from scope
- [ ] Files deduplicated and sorted
- [ ] Empty scope results in skip (no agent spawn)
- [ ] Agent spawned with explicit file list, depth, review_path, diff_base
- [ ] Agent failure handled without partial commits
- [ ] REVIEW.md committed if created
- [ ] Results presented inline with next step suggestion
</success_criteria>
