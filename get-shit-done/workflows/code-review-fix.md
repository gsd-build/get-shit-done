<purpose>
Auto-fix issues from REVIEW.md. Validates phase, checks config gate, verifies REVIEW.md exists and has fixable issues, spawns gsd-code-fixer agent, handles --auto iteration loop (capped at 3), commits REVIEW-FIX.md once at the end, and presents results.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<available_agent_types>
- gsd-code-fixer: Applies fixes to code review findings
- gsd-code-reviewer: Reviews source files for bugs and issues
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

```bash
FIX_ALL=false
AUTO_MODE=false
for arg in "$@"; do
  if [[ "$arg" == "--all" ]]; then FIX_ALL=true; fi
  if [[ "$arg" == "--auto" ]]; then AUTO_MODE=true; fi
done
```

Compute scope variable:

```bash
if [ "$FIX_ALL" = "true" ]; then
  FIX_SCOPE="all"
else
  FIX_SCOPE="critical_warning"
fi
```

Compute review and fix report paths:

```bash
REVIEW_PATH="${PHASE_DIR}/${PADDED_PHASE}-REVIEW.md"
FIX_REPORT_PATH="${PHASE_DIR}/${PADDED_PHASE}-REVIEW-FIX.md"
```
</step>

<step name="check_config_gate">
Check if code review is enabled via config:

```bash
CODE_REVIEW_ENABLED=$(gsd-sdk query config-get workflow.code_review 2>/dev/null || echo "true")
```

If CODE_REVIEW_ENABLED is "false":
```
Code review fix skipped (workflow.code_review=false in config)
```
Exit workflow.

Default is true — only skip on explicit false. This check runs AFTER phase validation so invalid phase errors are shown first.

Note: This reuses the `workflow.code_review` config key rather than introducing a separate `workflow.code_review_fix` key. Rationale: fixes are meaningless without review, so a single toggle makes sense. If independent control is needed later, a separate key can be added in v2.
</step>

<step name="check_review_exists">
Verify that REVIEW.md exists:

```bash
if [ ! -f "${REVIEW_PATH}" ]; then
  echo "Error: No REVIEW.md found for Phase ${PHASE_ARG}. Run /gsd-code-review ${PHASE_ARG} first."
  exit 1
fi
```

Do NOT auto-run code-review. Require explicit user action to ensure review intent is clear.
</step>

<step name="check_review_status">
Parse REVIEW.md frontmatter to check status and extract context for --auto loop:

```bash
# Parse status field
REVIEW_STATUS=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match && /status:\s*(\S+)/.test(match[1])) {
    console.log(match[1].match(/status:\s*(\S+)/)[1]);
  } else {
    console.log('unknown');
  }
" 2>/dev/null)
```

If status is "clean" or "skipped":
```
No issues to fix in Phase ${PHASE_ARG} REVIEW.md (status: ${REVIEW_STATUS}).
```
Exit workflow.

If status is "unknown":
```
Warning: Could not parse REVIEW.md status. Proceeding with fix attempt.
```

Extract review depth for --auto re-review:

```bash
REVIEW_DEPTH=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match && /depth:\s*(\S+)/.test(match[1])) {
    console.log(match[1].match(/depth:\s*(\S+)/)[1]);
  } else {
    console.log('standard');
  }
" 2>/dev/null)
```

Extract original review file list for --auto re-review scope persistence:

```bash
# Extract review file list — portable bash 3.2+ (no mapfile, handles spaces in paths)
REVIEW_FILES_ARRAY=()
while IFS= read -r line; do
  [ -n "$line" ] && REVIEW_FILES_ARRAY+=("$line")
done < <(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) {
    const fm = match[1];
    // Try YAML array format: files_reviewed_list: [file1, file2]
    const bracketMatch = fm.match(/files_reviewed_list:\s*\[([^\]]+)\]/);
    if (bracketMatch) {
      bracketMatch[1].split(',').map(f => f.trim()).filter(Boolean).forEach(f => console.log(f));
    } else {
      // Try YAML list format: files_reviewed_list:\n  - file1\n  - file2
      let inList = false;
      for (const line of fm.split('\n')) {
        if (/files_reviewed_list:/.test(line)) { inList = true; continue; }
        if (inList && /^\s+-\s+(.+)/.test(line)) { console.log(line.match(/^\s+-\s+(.+)/)[1].trim()); }
        else if (inList && /^\S/.test(line)) { break; }
      }
    }
  }
" 2>/dev/null)
```

If REVIEW.md contains a `files_reviewed_list` frontmatter field, use that as the re-review scope. If not present, fall back to re-reviewing the full phase (same behavior as initial code-review).
</step>

<step name="spawn_fixer">
Spawn the gsd-code-fixer agent with config:

```bash
# Build config for agent
echo "Applying fixes from ${REVIEW_PATH}..."
echo "Fix scope: ${FIX_SCOPE}"
```

Use Task() to spawn agent:

```
Task(subagent_type="gsd-code-fixer", prompt="
<files_to_read>
${REVIEW_PATH}
</files_to_read>

<config>
phase_dir: ${PHASE_DIR}
padded_phase: ${PADDED_PHASE}
review_path: ${REVIEW_PATH}
fix_scope: ${FIX_SCOPE}
fix_report_path: ${FIX_REPORT_PATH}
iteration: 1
</config>

Read REVIEW.md findings, apply fixes, commit each atomically, write REVIEW-FIX.md. Do NOT commit REVIEW-FIX.md (orchestrator handles that).
")
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.

**Agent failure handling:**

If Task() fails:
```
Error: Code fix agent failed: ${error_message}
```

Check if FIX_REPORT_PATH exists:
- If yes: "Partial success — some fixes may have been committed."
- If no: "No fixes applied."

Either way:
```
Some fix commits may already exist in git history — check git log for fix(${PADDED_PHASE}) commits.
You can retry with /gsd-code-review-fix ${PHASE_ARG}.
```

Exit workflow (skip auto loop).
</step>

<step name="auto_iteration_loop">
Only runs if AUTO_MODE is true. If AUTO_MODE is false, skip this step entirely.

```bash
if [ "$AUTO_MODE" = "true" ]; then
  # Iteration semantics: the initial fix pass (step 5) is iteration 1.
  # This loop runs iterations 2..MAX_ITERATIONS (re-review + re-fix cycles).
  # Total fix passes = MAX_ITERATIONS. Loop uses -lt (not -le) intentionally.
  ITERATION=1
  MAX_ITERATIONS=3
  
  while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    
    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "  --auto: Starting iteration ${ITERATION}/${MAX_ITERATIONS}"
    echo "═══════════════════════════════════════════════════════"
    echo ""
    
    # Re-review using same depth and file scope as original review
    echo "Re-reviewing phase ${PHASE_ARG} at ${REVIEW_DEPTH} depth..."
    
    # Backup previous REVIEW.md and REVIEW-FIX.md before overwriting
    if [ -f "${REVIEW_PATH}" ]; then
      cp "${REVIEW_PATH}" "${REVIEW_PATH%.md}.iter${ITERATION}.md" 2>/dev/null || true
    fi
    if [ -f "${FIX_REPORT_PATH}" ]; then
      cp "${FIX_REPORT_PATH}" "${FIX_REPORT_PATH%.md}.iter${ITERATION}.md" 2>/dev/null || true
    fi
    
    # If original review had explicit file list, pass it safely to re-review agent
    FILES_CONFIG=""
    if [ ${#REVIEW_FILES_ARRAY[@]} -gt 0 ]; then
      FILES_CONFIG="files:"
      for f in "${REVIEW_FILES_ARRAY[@]}"; do
        FILES_CONFIG="${FILES_CONFIG}
  - ${f}"
      done
    fi
    
    # Spawn gsd-code-reviewer agent to re-review
    # (This overwrites REVIEW_PATH with latest review state)
    Task(subagent_type="gsd-code-reviewer", prompt="
<config>
depth: ${REVIEW_DEPTH}
phase_dir: ${PHASE_DIR}
review_path: ${REVIEW_PATH}
${FILES_CONFIG}
</config>

Re-review the phase at ${REVIEW_DEPTH} depth. Write findings to ${REVIEW_PATH}.
Do NOT commit the output — the orchestrator handles that.
")
    # ORCHESTRATOR RULE — CODEX RUNTIME: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result before proceeding.
    
    # Check new REVIEW.md status
    NEW_STATUS=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
      const fs = require('fs');
      const content = fs.readFileSync(process.env.REVIEW_PATH, 'utf-8');
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (match && /status:\s*(\S+)/.test(match[1])) {
        console.log(match[1].match(/status:\s*(\S+)/)[1]);
      } else {
        console.log('unknown');
      }
    " 2>/dev/null)
    
    if [ "$NEW_STATUS" = "clean" ]; then
      echo ""
      echo "✓ All issues resolved after iteration ${ITERATION}."
      break
    fi
    
    # Still has issues — spawn fixer again
    echo "Issues remain. Applying fixes for iteration ${ITERATION}..."
    
    Task(subagent_type="gsd-code-fixer", prompt="
<files_to_read>
${REVIEW_PATH}
</files_to_read>

<config>
phase_dir: ${PHASE_DIR}
padded_phase: ${PADDED_PHASE}
review_path: ${REVIEW_PATH}
fix_scope: ${FIX_SCOPE}
fix_report_path: ${FIX_REPORT_PATH}
iteration: ${ITERATION}
</config>

Read REVIEW.md findings, apply fixes, commit each atomically, write REVIEW-FIX.md (overwrite previous). Do NOT commit REVIEW-FIX.md.
")
    # ORCHESTRATOR RULE — CODEX RUNTIME: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result before proceeding.
    
    # Check if fixer succeeded
    if [ ! -f "${FIX_REPORT_PATH}" ]; then
      echo "Warning: Iteration ${ITERATION} fixer failed to produce fix report. Stopping auto-loop."
      break
    fi
  done
  
  # After loop completes
  if [ $ITERATION -ge $MAX_ITERATIONS ]; then
    echo ""
    echo "⚠ Reached maximum iterations (${MAX_ITERATIONS}). Remaining issues documented in REVIEW-FIX.md."
  fi
fi
```

Key design decisions for --auto (addresses ALL review HIGH concerns):
1. **Re-review scope**: Uses REVIEW_FILES_ARRAY from original REVIEW.md frontmatter, falling back to full phase scope. Scope is NOT lost between iterations. Uses portable while-read loop (bash 3.2+ compatible, handles spaces in paths).
2. **Artifact semantics**: REVIEW.md is overwritten by each re-review (latest review state). REVIEW-FIX.md is overwritten by each fixer iteration (latest fix state with iteration count). There is ONE final version of each artifact, not per-iteration copies.
   Backup files (.iterN.md) preserve history for post-mortem analysis if iterations degrade.
3. **Commit timing**: Fix commits happen per-finding inside the agent. REVIEW-FIX.md is NOT committed until step 7 (after ALL iterations complete). Only ONE docs commit for REVIEW-FIX.md, not one per iteration.
</step>

<step name="commit_fix_report">
After ALL iterations complete (or single pass in non-auto mode), validate and commit REVIEW-FIX.md:

```bash
if [ -f "${FIX_REPORT_PATH}" ]; then
  # Validate REVIEW-FIX.md has valid YAML frontmatter with status field
  HAS_STATUS=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
    const fs = require('fs');
    const content = fs.readFileSync(process.env.FIX_REPORT_PATH, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match && /status:/.test(match[1])) { console.log('valid'); } else { console.log('invalid'); }
  " 2>/dev/null)
  
  if [ "$HAS_STATUS" = "valid" ]; then
    echo "REVIEW-FIX.md created at ${FIX_REPORT_PATH}"
    
    if [ "$COMMIT_DOCS" = "true" ]; then
      gsd-sdk query commit \
        "docs(${PADDED_PHASE}): add code review fix report" \
        --files "${FIX_REPORT_PATH}"
    fi
  else
    echo "Warning: REVIEW-FIX.md has invalid frontmatter (no status field). Not committing."
    echo "Agent may have produced malformed output. Review manually: ${FIX_REPORT_PATH}"
  fi
else
  echo "Warning: REVIEW-FIX.md not found at ${FIX_REPORT_PATH}."
  echo "Agent may have failed before writing report."
  echo "Check git log for any fix(${PADDED_PHASE}) commits that were applied."
fi
```

This commit happens ONCE at the end of the workflow, after all iterations (if --auto) complete. Not per-iteration.
</step>

<step name="present_results">
Parse REVIEW-FIX.md frontmatter and present formatted summary to user.

First check if fix report exists:

```bash
if [ ! -f "${FIX_REPORT_PATH}" ]; then
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "  ⚠ No fix report generated"
  echo ""
  echo "───────────────────────────────────────────────────────────────"
  echo ""
  echo "The fixer agent may have failed before completing."
  echo "Check git log for any fix(${PADDED_PHASE}) commits."
  echo ""
  echo "Retry: /gsd-code-review-fix ${PHASE_ARG}"
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  exit 1
fi
```

Extract frontmatter fields:

```bash
# Extract only the YAML frontmatter block (between first two --- lines)
FIX_FRONTMATTER=$(REVIEW_PATH="${REVIEW_PATH}" node -e "
  const fs = require('fs');
  const content = fs.readFileSync(process.env.FIX_REPORT_PATH, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) process.stdout.write(match[1]);
" 2>/dev/null)

# Parse fields from frontmatter only (not full file)
FIX_STATUS=$(echo "$FIX_FRONTMATTER" | grep "^status:" | cut -d: -f2 | xargs)
FINDINGS_IN_SCOPE=$(echo "$FIX_FRONTMATTER" | grep "^findings_in_scope:" | cut -d: -f2 | xargs)
FIXED_COUNT=$(echo "$FIX_FRONTMATTER" | grep "^fixed:" | cut -d: -f2 | xargs)
SKIPPED_COUNT=$(echo "$FIX_FRONTMATTER" | grep "^skipped:" | cut -d: -f2 | xargs)
ITERATION_COUNT=$(echo "$FIX_FRONTMATTER" | grep "^iteration:" | cut -d: -f2 | xargs)
```

Display formatted inline summary:

```bash
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Code Review Fix Complete: Phase ${PHASE_NUMBER} (${PHASE_NAME})"
echo ""
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "  Fix Scope:       ${FIX_SCOPE}"
echo "  Findings:        ${FINDINGS_IN_SCOPE}"
echo "  Fixed:           ${FIXED_COUNT}"
echo "  Skipped:         ${SKIPPED_COUNT}"
if [ "$AUTO_MODE" = "true" ]; then
  echo "  Iterations:      ${ITERATION_COUNT}"
fi
echo "  Status:          ${FIX_STATUS}"
echo ""
echo "───────────────────────────────────────────────────────────────"
echo ""
```

If status is "all_fixed":
```bash
if [ "$FIX_STATUS" = "all_fixed" ]; then
  echo "✓ All issues resolved."
  echo ""
  echo "Full report: ${FIX_REPORT_PATH}"
  echo ""
  echo "Next step:"
  echo "  /gsd-verify-work  — Verify phase completion"
  echo ""
fi
```

If status is "partial" or "none_fixed":
```bash
if [ "$FIX_STATUS" = "partial" ] || [ "$FIX_STATUS" = "none_fixed" ]; then
  echo "⚠ Some issues could not be fixed automatically."
  echo ""
  echo "Full report: ${FIX_REPORT_PATH}"
  echo ""
  echo "Next steps:"
  echo "  cat ${FIX_REPORT_PATH}                     — View fix report"
  echo "  /gsd-code-review ${PHASE_NUMBER}           — Re-review code"
  echo "  /gsd-verify-work                           — Verify phase completion"
  echo ""
fi
```

```bash
echo "═══════════════════════════════════════════════════════════════"
```
</step>

</process>

<platform_notes>
**Windows:** This workflow uses bash features (arrays, variable expansion, while loops). On Windows, it requires Git Bash or WSL. Native PowerShell is not supported. The CI matrix (Ubuntu/macOS/Windows) runs under Git Bash on Windows runners, which provides bash compatibility.
</platform_notes>

<success_criteria>
- [ ] Phase validated before config gate check
- [ ] Config gate checked (workflow.code_review)
- [ ] REVIEW.md existence verified (error if missing)
- [ ] REVIEW.md status checked (skip if clean/skipped)
- [ ] Agent spawned with correct config (review_path, fix_scope, fix_report_path)
- [ ] Agent failure handled with partial-success awareness (some fix commits may exist)
- [ ] --auto iteration loop respects 3-iteration cap
- [ ] --auto re-review uses persisted file scope (not lost between iterations)
- [ ] REVIEW-FIX.md committed ONCE after all iterations (not per-iteration)
- [ ] Missing fix report handled with explicit error message in present_results
- [ ] Results presented inline with next step suggestion
</success_criteria>
