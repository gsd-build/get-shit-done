# State Derivation Reference

**Purpose**: Derive project state from filesystem examination instead of reading centralized STATE.md.

**Philosophy**: File existence is atomic. Two processes can check "does SUMMARY.md exist?" simultaneously without corruption. Race conditions occur when multiple processes READ and WRITE the same file - but reads-only are safe.

**Key Insight**: SUMMARY.md existence already means "plan complete". The filesystem IS the state - we just need functions to read it instead of duplicating it in STATE.md.

**Why This Matters**: When two terminals run GSD simultaneously, reading/writing STATE.md creates race conditions. Deriving state from filesystem artifacts (PLAN/SUMMARY files) eliminates this entirely.

---

## Function 1: get_current_phase() — DRV-01

**Purpose**: Scan ROADMAP.md for the first incomplete phase (has unchecked plans).

**Logic**:
1. Read ROADMAP.md
2. Find phase sections with unchecked plan items (`- [ ]`)
3. Return first phase with incomplete plans
4. If all complete, return "none" (project done)

**Implementation**:

```bash
get_current_phase() {
  local planning_dir="${1:-.planning}"
  local roadmap="${planning_dir}/ROADMAP.md"

  if [ ! -f "$roadmap" ]; then
    echo "none"
    return 1
  fi

  # Parse ROADMAP.md for phases with unchecked items
  # Phase format: "### Phase N:" or "- [ ] **Phase N:"
  # Look for first phase section containing "- [ ]" (incomplete checkbox)

  local current_phase=""
  local in_phase=""

  while IFS= read -r line; do
    # Match phase header: "### Phase 1:" or "## Phase 01:" etc
    if echo "$line" | grep -qE "^#{2,4} Phase [0-9]+(\.[0-9]+)?"; then
      # Extract phase number (handles 01, 1, 01.1, etc)
      in_phase=$(echo "$line" | grep -oE "Phase [0-9]+(\.[0-9]+)?" | grep -oE "[0-9]+(\.[0-9]+)?")
    fi

    # If we're in a phase and find unchecked plan
    if [ -n "$in_phase" ]; then
      if echo "$line" | grep -qE "^\s*-\s*\[ \]"; then
        echo "$in_phase"
        return 0
      fi
    fi
  done < "$roadmap"

  # Alternative: Check phase directories directly
  # Find first phase dir with PLAN without SUMMARY
  for phase_dir in "${planning_dir}"/phases/*/; do
    if [ -d "$phase_dir" ]; then
      local plan_count=$(ls -1 "${phase_dir}"*-PLAN.md 2>/dev/null | wc -l)
      local summary_count=$(ls -1 "${phase_dir}"*-SUMMARY.md 2>/dev/null | wc -l)

      if [ "$plan_count" -gt "$summary_count" ]; then
        # Extract phase number from directory name (e.g., "01-foundation" -> "01")
        local phase_name=$(basename "$phase_dir")
        echo "${phase_name%%-*}"
        return 0
      fi
    fi
  done

  echo "none"
  return 0
}
```

**Example Usage**:

```bash
CURRENT_PHASE=$(get_current_phase)
if [ "$CURRENT_PHASE" = "none" ]; then
  echo "All phases complete!"
else
  echo "Currently on phase: $CURRENT_PHASE"
fi
```

---

## Function 2: get_current_plan() — DRV-02

**Purpose**: Scan phase directory for first PLAN without matching SUMMARY.

**Logic**:
1. List all *-PLAN.md files in phase directory (sorted)
2. For each PLAN, check if corresponding SUMMARY exists
3. Return first plan ID where SUMMARY doesn't exist
4. If all have SUMMARYs, return "none" (phase complete)

**Implementation**:

```bash
get_current_plan() {
  local phase_dir="$1"

  if [ ! -d "$phase_dir" ]; then
    echo "none"
    return 1
  fi

  # Get all PLAN files, sorted
  for plan_file in $(ls -1 "${phase_dir}"/*-PLAN.md 2>/dev/null | sort); do
    # Extract plan identifier (e.g., "01-01" from "01-01-PLAN.md")
    local plan_basename=$(basename "$plan_file" .md)
    local plan_id="${plan_basename%-PLAN}"

    # Check if corresponding SUMMARY exists
    local summary_file="${phase_dir}/${plan_id}-SUMMARY.md"

    if [ ! -f "$summary_file" ]; then
      echo "$plan_id"
      return 0
    fi
  done

  echo "none"
  return 0
}
```

**Example Usage**:

```bash
CURRENT_PLAN=$(get_current_plan ".planning/phases/01-state-derivation-core")
if [ "$CURRENT_PLAN" = "none" ]; then
  echo "Phase complete!"
else
  echo "Next plan to execute: $CURRENT_PLAN"
fi
```

---

## Function 3: get_progress() — DRV-03

**Purpose**: Compute completion percentage from file counts across all phases.

**Logic**:
1. Count all *-PLAN.md files in all phase directories
2. Count all *-SUMMARY.md files in all phase directories
3. Return percentage: (summaries / plans) * 100
4. Handle edge case: 0 plans = 0%

**Implementation**:

```bash
get_progress() {
  local planning_dir="${1:-.planning}"
  local phases_dir="${planning_dir}/phases"

  if [ ! -d "$phases_dir" ]; then
    echo "0"
    return 0
  fi

  # Count PLANs and SUMMARYs across all phases
  local plan_count=$(find "$phases_dir" -name "*-PLAN.md" 2>/dev/null | wc -l | tr -d ' ')
  local summary_count=$(find "$phases_dir" -name "*-SUMMARY.md" 2>/dev/null | wc -l | tr -d ' ')

  # Handle edge case: no plans
  if [ "$plan_count" -eq 0 ]; then
    echo "0"
    return 0
  fi

  # Calculate percentage (integer math, bash doesn't do floats)
  local progress=$(( (summary_count * 100) / plan_count ))
  echo "$progress"
  return 0
}
```

**Example Usage**:

```bash
PROGRESS=$(get_progress)
echo "Project: ${PROGRESS}% complete"

# Visual progress bar
filled=$(( PROGRESS / 10 ))
empty=$(( 10 - filled ))
bar=$(printf "█%.0s" $(seq 1 $filled 2>/dev/null) || echo "")
bar+=$(printf "░%.0s" $(seq 1 $empty 2>/dev/null) || echo "░░░░░░░░░░")
echo "Progress: [${bar:0:10}] ${PROGRESS}%"
```

---

## Function 4: get_phase_status() — DRV-04

**Purpose**: Determine if a specific phase is complete (all plans have SUMMARYs).

**Logic**:
1. Count PLANs in phase directory
2. Count SUMMARYs in phase directory
3. Return "complete" if counts match
4. Return "in-progress" if some SUMMARYs exist
5. Return "not-started" if 0 SUMMARYs

**Implementation**:

```bash
get_phase_status() {
  local phase_dir="$1"

  if [ ! -d "$phase_dir" ]; then
    echo "not-found"
    return 1
  fi

  local plan_count=$(ls -1 "${phase_dir}"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
  local summary_count=$(ls -1 "${phase_dir}"/*-SUMMARY.md 2>/dev/null | wc -l | tr -d ' ')

  # Handle edge case: no plans
  if [ "$plan_count" -eq 0 ]; then
    echo "empty"
    return 0
  fi

  if [ "$summary_count" -eq 0 ]; then
    echo "not-started"
  elif [ "$summary_count" -eq "$plan_count" ]; then
    echo "complete"
  else
    echo "in-progress"
  fi

  return 0
}
```

**Example Usage**:

```bash
STATUS=$(get_phase_status ".planning/phases/01-foundation")
case "$STATUS" in
  "complete")     echo "Phase 1 complete!" ;;
  "in-progress")  echo "Phase 1 in progress..." ;;
  "not-started")  echo "Phase 1 not yet started" ;;
  "empty")        echo "Phase 1 has no plans" ;;
  "not-found")    echo "Phase 1 directory not found" ;;
esac
```

---

## Function 5: get_decisions() — DRV-05

**Purpose**: Aggregate decisions from all SUMMARY.md frontmatter.

**Logic**:
1. Find all *-SUMMARY.md files
2. Extract `key-decisions:` field from frontmatter
3. Combine into chronological list
4. Return as newline-separated list

**Implementation**:

```bash
get_decisions() {
  local planning_dir="${1:-.planning}"
  local phases_dir="${planning_dir}/phases"

  if [ ! -d "$phases_dir" ]; then
    echo ""
    return 0
  fi

  # Find all SUMMARYs and extract decisions from frontmatter
  # Frontmatter is between --- markers at start of file
  # key-decisions is a YAML list

  for summary_file in $(find "$phases_dir" -name "*-SUMMARY.md" 2>/dev/null | sort); do
    # Extract frontmatter (between first and second ---)
    local in_frontmatter=0
    local in_decisions=0

    while IFS= read -r line; do
      # Track frontmatter boundaries
      if [ "$line" = "---" ]; then
        if [ "$in_frontmatter" -eq 0 ]; then
          in_frontmatter=1
          continue
        else
          break  # End of frontmatter
        fi
      fi

      # Inside frontmatter, look for key-decisions
      if [ "$in_frontmatter" -eq 1 ]; then
        if echo "$line" | grep -qE "^key-decisions:"; then
          in_decisions=1
          continue
        fi

        # If in decisions section, extract list items
        if [ "$in_decisions" -eq 1 ]; then
          # Check if line is a list item (starts with -)
          if echo "$line" | grep -qE "^\s*-\s"; then
            # Extract decision text (remove leading - and quotes)
            local decision=$(echo "$line" | sed 's/^\s*-\s*//' | sed 's/^"//' | sed 's/"$//')
            local phase=$(basename "$(dirname "$summary_file")")
            echo "[$phase] $decision"
          elif ! echo "$line" | grep -qE "^\s"; then
            # Non-indented line means end of decisions section
            in_decisions=0
          fi
        fi
      fi
    done < "$summary_file"
  done
}
```

**Example Usage**:

```bash
echo "=== All Project Decisions ==="
DECISIONS=$(get_decisions)
if [ -n "$DECISIONS" ]; then
  echo "$DECISIONS"
else
  echo "No decisions recorded yet."
fi
```

---

## Function 6: get_blockers() — DRV-06

**Purpose**: Aggregate blockers/concerns from SUMMARY.md "Next Phase Readiness" sections.

**Logic**:
1. Find all *-SUMMARY.md files
2. Search for "Next Phase Readiness" or "Blockers" sections
3. Extract listed concerns/blockers
4. Return as newline-separated list

**Implementation**:

```bash
get_blockers() {
  local planning_dir="${1:-.planning}"
  local phases_dir="${planning_dir}/phases"

  if [ ! -d "$phases_dir" ]; then
    echo ""
    return 0
  fi

  for summary_file in $(find "$phases_dir" -name "*-SUMMARY.md" 2>/dev/null | sort); do
    local in_readiness=0
    local phase=$(basename "$(dirname "$summary_file")")

    while IFS= read -r line; do
      # Look for readiness section header
      if echo "$line" | grep -qiE "^##.*Next Phase Readiness|^##.*Blockers|^##.*Concerns"; then
        in_readiness=1
        continue
      fi

      # If in readiness section
      if [ "$in_readiness" -eq 1 ]; then
        # Stop at next section header
        if echo "$line" | grep -qE "^##"; then
          in_readiness=0
          continue
        fi

        # Extract bullet items that mention blockers, concerns, issues
        if echo "$line" | grep -qiE "^\s*-.*blocker|^\s*-.*concern|^\s*-.*issue|^\s*-.*warning"; then
          local blocker=$(echo "$line" | sed 's/^\s*-\s*//')
          echo "[$phase] $blocker"
        fi

        # Also extract items that explicitly say "not ready" or "blocked"
        if echo "$line" | grep -qiE "not ready|blocked by|waiting on|depends on"; then
          local blocker=$(echo "$line" | sed 's/^\s*-\s*//')
          echo "[$phase] $blocker"
        fi
      fi
    done < "$summary_file"
  done
}
```

**Example Usage**:

```bash
echo "=== Active Blockers ==="
BLOCKERS=$(get_blockers)
if [ -n "$BLOCKERS" ]; then
  echo "$BLOCKERS"
else
  echo "No blockers - clear to proceed!"
fi
```

---

## Function 7: get_agent_tracking_path() — PAR-05 (Scoped Agent Tracking)

**Purpose**: Return per-plan agent tracking path instead of global path.

**Logic**:
- Instead of `.planning/current-agent-id.txt` (global)
- Use `.planning/phases/{phase-dir}/{plan-id}-agent.txt` (per-plan)
- This allows parallel plan execution without agent ID conflicts

**Implementation**:

```bash
get_agent_tracking_path() {
  local phase_dir="$1"
  local plan_id="$2"

  echo "${phase_dir}/${plan_id}-agent.txt"
}
```

**Why This Matters**:
Agent tracking is WRITE during execution (not read for state derivation). By scoping the path per-plan, two concurrent executions write to different files, eliminating conflicts. The state derivation functions (DRV-01 through DRV-06) derive project state from PLAN/SUMMARY existence - they don't read agent state.

---

## Parallel Safety Guarantees

### All Functions Are Read-Only

Every function above performs ONLY:
- `ls` - List files (atomic)
- `find` - Find files (atomic)
- `grep` - Search content (atomic)
- `wc` - Count lines (atomic)
- `cat` - Read files (atomic)

No function WRITES any files. This is critical.

### File Existence Checks Are Atomic

```bash
# This is atomic - safe for concurrent access
[ -f "$summary_file" ]
```

Two processes checking file existence simultaneously will both get correct results.

### No Locking Needed

Because all state derivation is read-only:
- Two terminals can call `get_progress()` simultaneously
- Both will see the same result
- Neither will corrupt anything

Race conditions require READ-MODIFY-WRITE cycles. Pure reads are always safe.

### ROADMAP.md Update Safety

ROADMAP.md checkbox updates (`- [ ]` to `- [x]`) are the only potential conflict point. However:
1. Phase completion happens when SUMMARY.md is created (atomic)
2. ROADMAP.md updates are cosmetic (human-readable)
3. Worst case: cosmetic mismatch, not data corruption

Recommendation: After state derivation adoption, ROADMAP.md becomes human reference only. State comes from SUMMARY existence.

---

## Complete Usage Example

```bash
#!/usr/bin/env bash
# Example: Derive full project state from filesystem

# Source the functions (or include them directly)
# source ~/.claude/get-shit-done/references/state-derivation-impl.sh

# Get current position
CURRENT_PHASE=$(get_current_phase ".planning")
CURRENT_PLAN=$(get_current_plan ".planning/phases/${CURRENT_PHASE}-"*)
PROGRESS=$(get_progress ".planning")

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  PROJECT STATE (Derived from Filesystem)                     ║"
echo "╠══════════════════════════════════════════════════════════════╣"
printf "║  Current Phase: %-44s ║\n" "$CURRENT_PHASE"
printf "║  Current Plan:  %-44s ║\n" "$CURRENT_PLAN"
printf "║  Progress:      %-44s ║\n" "${PROGRESS}%"
echo "╚══════════════════════════════════════════════════════════════╝"

# Check for blockers
BLOCKERS=$(get_blockers ".planning")
if [ -n "$BLOCKERS" ]; then
  echo ""
  echo "⚠️  Active Blockers:"
  echo "$BLOCKERS" | while read -r line; do
    echo "   - $line"
  done
fi

# Show recent decisions
DECISIONS=$(get_decisions ".planning")
if [ -n "$DECISIONS" ]; then
  echo ""
  echo "📋 Recent Decisions:"
  echo "$DECISIONS" | tail -5 | while read -r line; do
    echo "   - $line"
  done
fi
```

---

## Integration with Existing GSD Commands

These functions replace STATE.md reads in:

| Command | Replaces | With |
|---------|----------|------|
| `/gsd:progress` | `cat STATE.md` | `get_progress()` |
| `/gsd:execute-phase` | `cat STATE.md \| grep "Current Plan"` | `get_current_plan()` |
| `/gsd:plan-phase` | `cat STATE.md \| grep "Current Phase"` | `get_current_phase()` |
| `/gsd:resume-work` | `cat STATE.md` | All derivation functions |

STATE.md becomes a **write-only human reference** - updated for human readability but never read by machines.

---

## Test Validation

These patterns have been validated for parallel safety using the test harness at `@state-derivation-tests.sh`.

**Tests passed:**
- ✓ Correctness: All 6 functions return expected values for known inputs
- ✓ Edge cases: Handles empty projects, complete projects, nonexistent paths
- ✓ Parallel reads: 10 concurrent processes produce identical state values
- ✓ No writes: File modification times unchanged after state derivation
- ✓ Consistency under load: 50 parallel calls produce identical results

**Parallel safety guarantee:**
State derivation functions are read-only and use atomic filesystem operations (ls, find, grep, wc). Two terminal windows can execute different plans simultaneously without any risk of data corruption or race conditions.

**To verify parallel safety yourself:**
```bash
./get-shit-done/references/state-derivation-tests.sh
```

---

## See Also

- **Test Harness**: @state-derivation-tests.sh - Validates parallel safety
- **Git Integration**: @git-integration.md - Commit patterns that enable derivation

---

*Reference Document: State Derivation for Parallel Work Support*
*Version: 1.0*
*Created: 2026-01-24*
