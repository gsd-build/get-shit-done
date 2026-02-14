<purpose>
Verify phase goal achievement through goal-backward analysis. Check that the codebase actually delivers what the phase promised, not just that tasks were completed.

This workflow is executed by a verification subagent spawned from execute-phase.md.
</purpose>

<core_principle>
**Task completion ≠ Goal achievement**

A task "create chat component" can be marked complete when the component is a placeholder. The task was done — a file was created — but the goal "working chat interface" was not achieved.

Goal-backward verification starts from the outcome and works backwards:
1. What must be TRUE for the goal to be achieved?
2. What must EXIST for those truths to hold?
3. What must be WIRED for those artifacts to function?

Then verify each level against the actual codebase.
</core_principle>

<required_reading>
@~/.claude/get-shit-done/references/verification-patterns.md
@~/.claude/get-shit-done/templates/verification-report.md
</required_reading>

<process>

<step name="load_context" priority="first">
**Gather all verification context:**

```bash
# Phase directory (match both zero-padded and unpadded)
PADDED_PHASE=$(printf "%02d" ${PHASE_ARG} 2>/dev/null || echo "${PHASE_ARG}")
PHASE_DIR=$(ls -d .planning/phases/${PADDED_PHASE}-* .planning/phases/${PHASE_ARG}-* 2>/dev/null | head -1)

# Phase goal from ROADMAP
grep -A 5 "Phase ${PHASE_NUM}" .planning/ROADMAP.md

# Requirements mapped to this phase
grep -E "^| ${PHASE_NUM}" .planning/REQUIREMENTS.md 2>/dev/null

# All SUMMARY files (claims to verify)
ls "$PHASE_DIR"/*-SUMMARY.md 2>/dev/null

# All PLAN files (for must_haves in frontmatter)
ls "$PHASE_DIR"/*-PLAN.md 2>/dev/null
```

**Extract phase goal:** Parse ROADMAP.md for this phase's goal/description. This is the outcome to verify, not the tasks.

**Extract requirements:** If REQUIREMENTS.md exists, find requirements mapped to this phase. These become additional verification targets.
</step>

<step name="establish_must_haves">
**Determine what must be verified.**

**Option A: Must-haves in PLAN frontmatter**

Check if any PLAN.md has `must_haves` in frontmatter:

```bash
grep -l "must_haves:" "$PHASE_DIR"/*-PLAN.md 2>/dev/null
```

If found, extract and use:
```yaml
must_haves:
  truths:
    - "User can see existing messages"
    - "User can send a message"
  artifacts:
    - path: "src/components/Chat.tsx"
      provides: "Message list rendering"
  key_links:
    - from: "Chat.tsx"
      to: "api/chat"
      via: "fetch in useEffect"
```

**Option B: Derive from phase goal**

If no must_haves in frontmatter, derive using goal-backward process:

1. **State the goal:** Take phase goal from ROADMAP.md

2. **Derive truths:** Ask "What must be TRUE for this goal to be achieved?"
   - List 3-7 observable behaviors from user perspective
   - Each truth should be testable by a human using the app

3. **Derive artifacts:** For each truth, ask "What must EXIST?"
   - Map truths to concrete files (components, routes, schemas)
   - Be specific: `src/components/Chat.tsx`, not "chat component"

4. **Derive key links:** For each artifact, ask "What must be CONNECTED?"
   - Identify critical wiring (component calls API, API queries DB)
   - These are where stubs hide

5. **Document derived must-haves** before proceeding to verification.

<!-- Goal-backward derivation expertise is baked into the gsd-verifier agent -->
</step>

<step name="query_past_antipatterns">
**Query knowledge base for known anti-patterns relevant to this phase.**

Get phase goal for semantic query:

```bash
PHASE_GOAL=$(node /Users/gshah/.claude/get-shit-done/bin/gsd-tools.js roadmap get-phase "${PHASE_NUM}" 2>/dev/null | jq -r '.goal // empty')
```

Query anti-patterns:

```bash
PAST_ANTIPATTERNS=$(node scripts/query-learnings.js \
  --query "Common mistakes and anti-patterns for: ${PHASE_GOAL}" \
  --type anti-pattern \
  --top-k 5 \
  --min-score 0.30 \
  --format checklist 2>&1 | grep -v "mutex\|libc")
```

Build anti-pattern context block:

```bash
ANTIPATTERN_CONTEXT=""
if [ -n "$PAST_ANTIPATTERNS" ]; then
  # Check if results are not just "No past learnings found" message
  if echo "$PAST_ANTIPATTERNS" | grep -q "Pitfall"; then
    ANTIPATTERN_CONTEXT="<known_antipatterns>
## Check These Anti-Patterns FIRST (From Past Phases)

${PAST_ANTIPATTERNS}

**Verification priority:**
1. Check for each anti-pattern listed above
2. If found: mark as FAILED with reference to source phase
3. If not found: note as 'avoided known anti-pattern'
</known_antipatterns>"
  fi
fi
```

Display status:

```bash
if [ -n "$ANTIPATTERN_CONTEXT" ]; then
  ANTIPATTERN_COUNT=$(echo "$PAST_ANTIPATTERNS" | grep -c "^[0-9]" 2>/dev/null || echo "0")
  echo "◆ Querying past anti-patterns..."
  echo "  Found: ${ANTIPATTERN_COUNT} known anti-patterns to check"
else
  echo "◆ No past anti-patterns found (possibly first implementation in this domain)"
fi
```

**Note:** `ANTIPATTERN_CONTEXT` is available to `scan_antipatterns` and `verify_truths` steps for enhanced verification.
</step>

<step name="verify_truths">
**For each observable truth, determine if codebase enables it.**

**NOTE:** If `ANTIPATTERN_CONTEXT` is available from previous step, be aware of known failure modes when verifying truths.

A truth is achievable if the supporting artifacts exist, are substantive, and are wired correctly.

**Verification status:**
- ✓ VERIFIED: All supporting artifacts pass all checks
- ✗ FAILED: One or more supporting artifacts missing, stub, or unwired
- ? UNCERTAIN: Can't verify programmatically (needs human)

**For each truth:**

1. Identify supporting artifacts (which files make this truth possible?)
2. Check artifact status (see verify_artifacts step)
3. Check wiring status (see verify_wiring step)
4. Determine truth status based on supporting infrastructure

**Example:**

Truth: "User can see existing messages"

Supporting artifacts:
- Chat.tsx (renders messages)
- /api/chat GET (provides messages)
- Message model (defines schema)

If Chat.tsx is a stub → Truth FAILED
If /api/chat GET returns hardcoded [] → Truth FAILED
If Chat.tsx exists, is substantive, calls API, renders response → Truth VERIFIED
</step>

<step name="verify_artifacts">
**For each required artifact, verify three levels:**

### Level 1: Existence

```bash
check_exists() {
  local path="$1"
  if [ -f "$path" ]; then
    echo "EXISTS"
  elif [ -d "$path" ]; then
    echo "EXISTS (directory)"
  else
    echo "MISSING"
  fi
}
```

If MISSING → artifact fails, record and continue to next artifact.

### Level 2: Substantive

Check that the file has real implementation, not a stub.

**Line count check:**
```bash
check_length() {
  local path="$1"
  local min_lines="$2"
  local lines=$(wc -l < "$path" 2>/dev/null || echo 0)
  [ "$lines" -ge "$min_lines" ] && echo "SUBSTANTIVE ($lines lines)" || echo "THIN ($lines lines)"
}
```

Minimum lines by type:
- Component: 15+ lines
- API route: 10+ lines
- Hook/util: 10+ lines
- Schema model: 5+ lines

**Stub pattern check:**
```bash
check_stubs() {
  local path="$1"

  # Universal stub patterns
  local stubs=$(grep -c -E "TODO|FIXME|placeholder|not implemented|coming soon" "$path" 2>/dev/null || echo 0)

  # Empty returns
  local empty=$(grep -c -E "return null|return undefined|return \{\}|return \[\]" "$path" 2>/dev/null || echo 0)

  # Placeholder content
  local placeholder=$(grep -c -E "will be here|placeholder|lorem ipsum" "$path" 2>/dev/null || echo 0)

  local total=$((stubs + empty + placeholder))
  [ "$total" -gt 0 ] && echo "STUB_PATTERNS ($total found)" || echo "NO_STUBS"
}
```

**Export check (for components/hooks):**
```bash
check_exports() {
  local path="$1"
  grep -E "^export (default )?(function|const|class)" "$path" && echo "HAS_EXPORTS" || echo "NO_EXPORTS"
}
```

**Combine level 2 results:**
- SUBSTANTIVE: Adequate length + no stubs + has exports
- STUB: Too short OR has stub patterns OR no exports
- PARTIAL: Mixed signals (length OK but has some stubs)

### Level 3: Wired

Check that the artifact is connected to the system.

**Import check (is it used?):**
```bash
check_imported() {
  local artifact_name="$1"
  local search_path="${2:-src/}"

  # Find imports of this artifact
  local imports=$(grep -r "import.*$artifact_name" "$search_path" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)

  [ "$imports" -gt 0 ] && echo "IMPORTED ($imports times)" || echo "NOT_IMPORTED"
}
```

**Usage check (is it called?):**
```bash
check_used() {
  local artifact_name="$1"
  local search_path="${2:-src/}"

  # Find usages (function calls, component renders, etc.)
  local uses=$(grep -r "$artifact_name" "$search_path" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "import" | wc -l)

  [ "$uses" -gt 0 ] && echo "USED ($uses times)" || echo "NOT_USED"
}
```

**Combine level 3 results:**
- WIRED: Imported AND used
- ORPHANED: Exists but not imported/used
- PARTIAL: Imported but not used (or vice versa)

### Final artifact status

| Exists | Substantive | Wired | Status |
|--------|-------------|-------|--------|
| ✓ | ✓ | ✓ | ✓ VERIFIED |
| ✓ | ✓ | ✗ | ⚠️ ORPHANED |
| ✓ | ✗ | - | ✗ STUB |
| ✗ | - | - | ✗ MISSING |

Record status and evidence for each artifact.
</step>

<step name="verify_wiring">
**Verify key links between artifacts.**

Key links are critical connections. If broken, the goal fails even with all artifacts present.

### Pattern: Component → API

Check if component actually calls the API:

```bash
verify_component_api_link() {
  local component="$1"
  local api_path="$2"

  # Check for fetch/axios call to the API
  local has_call=$(grep -E "fetch\(['\"].*$api_path|axios\.(get|post).*$api_path" "$component" 2>/dev/null)

  if [ -n "$has_call" ]; then
    # Check if response is used
    local uses_response=$(grep -A 5 "fetch\|axios" "$component" | grep -E "await|\.then|setData|setState" 2>/dev/null)

    if [ -n "$uses_response" ]; then
      echo "WIRED: $component → $api_path (call + response handling)"
    else
      echo "PARTIAL: $component → $api_path (call exists but response not used)"
    fi
  else
    echo "NOT_WIRED: $component → $api_path (no call found)"
  fi
}
```

### Pattern: API → Database

Check if API route queries database:

```bash
verify_api_db_link() {
  local route="$1"
  local model="$2"

  # Check for Prisma/DB call
  local has_query=$(grep -E "prisma\.$model|db\.$model|$model\.(find|create|update|delete)" "$route" 2>/dev/null)

  if [ -n "$has_query" ]; then
    # Check if result is returned
    local returns_result=$(grep -E "return.*json.*\w+|res\.json\(\w+" "$route" 2>/dev/null)

    if [ -n "$returns_result" ]; then
      echo "WIRED: $route → database ($model)"
    else
      echo "PARTIAL: $route → database (query exists but result not returned)"
    fi
  else
    echo "NOT_WIRED: $route → database (no query for $model)"
  fi
}
```

### Pattern: Form → Handler

Check if form submission does something:

```bash
verify_form_handler_link() {
  local component="$1"

  # Find onSubmit handler
  local has_handler=$(grep -E "onSubmit=\{|handleSubmit" "$component" 2>/dev/null)

  if [ -n "$has_handler" ]; then
    # Check if handler has real implementation
    local handler_content=$(grep -A 10 "onSubmit.*=" "$component" | grep -E "fetch|axios|mutate|dispatch" 2>/dev/null)

    if [ -n "$handler_content" ]; then
      echo "WIRED: form → handler (has API call)"
    else
      # Check for stub patterns
      local is_stub=$(grep -A 5 "onSubmit" "$component" | grep -E "console\.log|preventDefault\(\)$|\{\}" 2>/dev/null)
      if [ -n "$is_stub" ]; then
        echo "STUB: form → handler (only logs or empty)"
      else
        echo "PARTIAL: form → handler (exists but unclear implementation)"
      fi
    fi
  else
    echo "NOT_WIRED: form → handler (no onSubmit found)"
  fi
}
```

### Pattern: State → Render

Check if state is actually rendered:

```bash
verify_state_render_link() {
  local component="$1"
  local state_var="$2"

  # Check if state variable exists
  local has_state=$(grep -E "useState.*$state_var|\[$state_var," "$component" 2>/dev/null)

  if [ -n "$has_state" ]; then
    # Check if state is used in JSX
    local renders_state=$(grep -E "\{.*$state_var.*\}|\{$state_var\." "$component" 2>/dev/null)

    if [ -n "$renders_state" ]; then
      echo "WIRED: state → render ($state_var displayed)"
    else
      echo "NOT_WIRED: state → render ($state_var exists but not displayed)"
    fi
  else
    echo "N/A: state → render (no state var $state_var)"
  fi
}
```

### Aggregate key link results

For each key link in must_haves:
- Run appropriate verification function
- Record status and evidence
- WIRED / PARTIAL / STUB / NOT_WIRED
</step>

<step name="verify_requirements">
**Check requirements coverage if REQUIREMENTS.md exists.**

```bash
# Find requirements mapped to this phase
grep -E "Phase ${PHASE_NUM}" .planning/REQUIREMENTS.md 2>/dev/null
```

For each requirement:
1. Parse requirement description
2. Identify which truths/artifacts support it
3. Determine status based on supporting infrastructure

**Requirement status:**
- ✓ SATISFIED: All supporting truths verified
- ✗ BLOCKED: One or more supporting truths failed
- ? NEEDS HUMAN: Can't verify requirement programmatically
</step>

<step name="scan_antipatterns">
**Scan for anti-patterns across phase files.**

**NOTE:** If `ANTIPATTERN_CONTEXT` is available, prioritize checking for those known anti-patterns in addition to the generic scan below.

Identify files modified in this phase:
```bash
# Extract files from SUMMARY.md
grep -E "^\- \`" "$PHASE_DIR"/*-SUMMARY.md | sed 's/.*`\([^`]*\)`.*/\1/' | sort -u
```

Run anti-pattern detection:
```bash
scan_antipatterns() {
  local files="$@"

  echo "## Anti-Patterns Found"
  echo ""

  for file in $files; do
    [ -f "$file" ] || continue

    # TODO/FIXME comments
    grep -n -E "TODO|FIXME|XXX|HACK" "$file" 2>/dev/null | while read line; do
      echo "| $file | $(echo $line | cut -d: -f1) | TODO/FIXME | ⚠️ Warning |"
    done

    # Placeholder content
    grep -n -E "placeholder|coming soon|will be here" "$file" -i 2>/dev/null | while read line; do
      echo "| $file | $(echo $line | cut -d: -f1) | Placeholder | 🛑 Blocker |"
    done

    # Empty implementations
    grep -n -E "return null|return \{\}|return \[\]|=> \{\}" "$file" 2>/dev/null | while read line; do
      echo "| $file | $(echo $line | cut -d: -f1) | Empty return | ⚠️ Warning |"
    done

    # Console.log only implementations
    grep -n -B 2 -A 2 "console\.log" "$file" 2>/dev/null | grep -E "^\s*(const|function|=>)" | while read line; do
      echo "| $file | - | Log-only function | ⚠️ Warning |"
    done
  done
}
```

Categorize findings:
- 🛑 Blocker: Prevents goal achievement (placeholder renders, empty handlers)
- ⚠️ Warning: Indicates incomplete (TODO comments, console.log)
- ℹ️ Info: Notable but not problematic
</step>

<step name="identify_human_verification">
**Flag items that need human verification.**

Some things can't be verified programmatically:

**Always needs human:**
- Visual appearance (does it look right?)
- User flow completion (can you do the full task?)
- Real-time behavior (WebSocket, SSE updates)
- External service integration (payments, email)
- Performance feel (does it feel fast?)
- Error message clarity

**Needs human if uncertain:**
- Complex wiring that grep can't trace
- Dynamic behavior depending on state
- Edge cases and error states

**Format for human verification:**
```markdown
## Human Verification Required

### 1. {Test Name}
**Test:** {What to do}
**Expected:** {What should happen}
**Why human:** {Why can't verify programmatically}
```
</step>

<step name="determine_status">
**Calculate overall verification status.**

**Status: passed**
- All truths VERIFIED
- All artifacts pass level 1-3
- All key links WIRED
- No blocker anti-patterns
- (Human verification items are OK — will be prompted)

**Status: gaps_found**
- One or more truths FAILED
- OR one or more artifacts MISSING/STUB
- OR one or more key links NOT_WIRED
- OR blocker anti-patterns found

**Status: human_needed**
- All automated checks pass
- BUT items flagged for human verification
- Can't determine goal achievement without human

**Calculate score:**
```
score = (verified_truths / total_truths)
```
</step>

<step name="generate_fix_plans">
**If gaps_found, recommend fix plans.**

Group related gaps into fix plans:

1. **Identify gap clusters:**
   - API stub + component not wired → "Wire frontend to backend"
   - Multiple artifacts missing → "Complete core implementation"
   - Wiring issues only → "Connect existing components"

2. **Generate plan recommendations:**

```markdown
### {phase}-{next}-PLAN.md: {Fix Name}

**Objective:** {What this fixes}

**Tasks:**
1. {Task to fix gap 1}
   - Files: {files to modify}
   - Action: {specific fix}
   - Verify: {how to confirm fix}

2. {Task to fix gap 2}
   - Files: {files to modify}
   - Action: {specific fix}
   - Verify: {how to confirm fix}

3. Re-verify phase goal
   - Run verification again
   - Confirm all must-haves pass

**Estimated scope:** {Small / Medium}
```

3. **Keep plans focused:**
   - 2-3 tasks per plan
   - Single concern per plan
   - Include verification task

4. **Order by dependency:**
   - Fix missing artifacts before wiring
   - Fix stubs before integration
   - Verify after all fixes
</step>

<step name="create_report">
**Generate VERIFICATION.md using template.**

```bash
REPORT_PATH="$PHASE_DIR/${PHASE_NUM}-VERIFICATION.md"
```

Fill template sections:
1. **Frontmatter:** phase, verified timestamp, status, score
2. **Goal Achievement:** Truth verification table
3. **Required Artifacts:** Artifact verification table
4. **Key Link Verification:** Wiring verification table
5. **Requirements Coverage:** If REQUIREMENTS.md exists
6. **Anti-Patterns Found:** Scan results table
7. **Human Verification Required:** Items needing human
8. **Gaps Summary:** Critical and non-critical gaps
9. **Recommended Fix Plans:** If gaps_found
10. **Verification Metadata:** Approach, timing, counts

See ~/.claude/get-shit-done/templates/verification-report.md for complete template.
</step>

<step name="return_to_orchestrator">
**Return results to execute-phase orchestrator.**

**Return format:**

```markdown
## Verification Complete

**Status:** {passed | gaps_found | human_needed}
**Score:** {N}/{M} must-haves verified
**Report:** .planning/phases/{phase_dir}/{phase}-VERIFICATION.md

{If passed:}
All must-haves verified. Phase goal achieved. Ready to proceed.

{If gaps_found:}
### Gaps Found

{N} critical gaps blocking goal achievement:
1. {Gap 1 summary}
2. {Gap 2 summary}

### Recommended Fixes

{N} fix plans recommended:
1. {phase}-{next}-PLAN.md: {name}
2. {phase}-{next+1}-PLAN.md: {name}

{If human_needed:}
### Human Verification Required

{N} items need human testing:
1. {Item 1}
2. {Item 2}

Automated checks passed. Awaiting human verification.
```

The orchestrator will:
- If `passed`: Continue to update_roadmap
- If `gaps_found`: Create and execute fix plans, then re-verify
- If `human_needed`: Present items to user, collect responses
</step>

</process>

<success_criteria>
- [ ] Must-haves established (from frontmatter or derived)
- [ ] All truths verified with status and evidence
- [ ] All artifacts checked at all three levels
- [ ] All key links verified
- [ ] Requirements coverage assessed (if applicable)
- [ ] Anti-patterns scanned and categorized
- [ ] Human verification items identified
- [ ] Overall status determined
- [ ] Fix plans generated (if gaps_found)
- [ ] VERIFICATION.md created with complete report
- [ ] Results returned to orchestrator
</success_criteria>
