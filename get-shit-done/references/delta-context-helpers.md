# Delta Context Helpers

Reference file for selective context loading in GSD v2.1+.

**Purpose:** Reduce token consumption by loading only relevant portions of context files instead of full files for each subagent.

**When used:** When `optimization.delta_context: true` in config.json.

---

## Context Matrix

| Agent Type | PROJECT.md | ROADMAP.md | STATE.md | REQUIREMENTS.md |
|------------|------------|------------|----------|-----------------|
| gsd-executor | Skip | Phase section only | Relevant decisions | Task-mapped only |
| gsd-executor-core | Skip | Phase section only | Relevant decisions | Skip |
| gsd-verifier | Skip | Phase goal + criteria | Full | Skip |
| gsd-verifier-core | Skip | Phase goal only | Relevant decisions | Skip |
| gsd-planner | Full | Full | Full | v1 scope only |
| gsd-planner-core | Full | Full | Full | v1 scope only |

---

## Extraction Functions

### extract_phase_section(roadmap, phase_number)

Extract only the current phase block from ROADMAP.md.

**Input:** Full ROADMAP.md content, phase number (e.g., "03" or "3")

**Output:** Only the phase block:
```
## Phase 03: Authentication
Goal: Implement user authentication with JWT
Requirements: AUTH-01, AUTH-02, AUTH-03
Must-haves:
- Login endpoint returns JWT token
- Protected routes reject invalid tokens
- Refresh token mechanism works
```

**Bash implementation:**
```bash
extract_phase_section() {
  local ROADMAP_FILE="$1"
  local PHASE_NUM="$2"

  # Normalize phase number (remove leading zeros for regex flexibility)
  local PHASE_PATTERN=$(echo "$PHASE_NUM" | sed 's/^0*//')

  # Also match zero-padded version
  local PADDED_PHASE=$(printf "%02d" "$PHASE_PATTERN" 2>/dev/null || echo "$PHASE_NUM")

  # Extract from "## Phase XX" to next "## Phase" or "---" or end of phases section
  # Use sed '$d' instead of head -n -1 for macOS compatibility
  sed -n "/^## Phase ${PADDED_PHASE}:\|^## Phase ${PHASE_PATTERN}:/,/^## Phase [0-9]\|^---\|^# /p" "$ROADMAP_FILE" | sed '$d'
}
```

**Token savings:** ~1,600 tokens (full ROADMAP ~2,000 → phase section ~400)

---

### extract_relevant_decisions(state, phase_number)

Extract only decisions relevant to current phase execution.

**Input:** Full STATE.md content, phase number

**Output:** Current position + phase-relevant decisions + roadmap decisions:
```
## Current Position
Phase: 03-authentication
Status: executing

## Relevant Decisions
- [Roadmap] All API responses use JSON format
- [03-01] Use bcrypt for password hashing (security requirement)
- [03-02] JWT expiry set to 1 hour (from AUTH-02)
```

**Bash implementation:**
```bash
extract_relevant_decisions() {
  local STATE_FILE="$1"
  local PHASE_NUM="$2"

  # Normalize phase number
  local PHASE_PATTERN=$(echo "$PHASE_NUM" | sed 's/^0*//')
  local PADDED_PHASE=$(printf "%02d" "$PHASE_PATTERN" 2>/dev/null || echo "$PHASE_NUM")

  # Extract Current Position section (everything until next ## heading)
  echo "## Current Position"
  # Use sed '$d' for macOS compatibility
  sed -n '/^## Current Position/,/^## /p' "$STATE_FILE" | tail -n +2 | sed '$d'

  echo ""
  echo "## Relevant Decisions"

  # Extract global decisions (Roadmap-level)
  grep -E "^- \[Roadmap\]" "$STATE_FILE" 2>/dev/null || true

  # Extract phase-specific decisions (pattern: [XX-YY] where XX is current phase)
  grep -E "^- \[${PADDED_PHASE}-[0-9]+\]" "$STATE_FILE" 2>/dev/null || true
}
```

**Token savings:** ~1,000 tokens (full STATE ~1,300 → relevant ~300)

---

### extract_phase_goal(roadmap, phase_number)

Extract only the phase goal and must-haves for verifier context.

**Input:** Full ROADMAP.md content, phase number

**Output:** Minimal verification context:
```
## Phase 03: Authentication
Goal: Implement user authentication with JWT

Must-haves:
- Login endpoint returns JWT token
- Protected routes reject invalid tokens
- Refresh token mechanism works
```

**Bash implementation:**
```bash
extract_phase_goal() {
  local ROADMAP_FILE="$1"
  local PHASE_NUM="$2"

  local PHASE_PATTERN=$(echo "$PHASE_NUM" | sed 's/^0*//')
  local PADDED_PHASE=$(printf "%02d" "$PHASE_PATTERN" 2>/dev/null || echo "$PHASE_NUM")

  # Extract phase header, goal line, and must-haves section only
  # Use sed '$d' for macOS compatibility
  local PHASE_SECTION=$(sed -n "/^## Phase ${PADDED_PHASE}:\|^## Phase ${PHASE_PATTERN}:/,/^## Phase [0-9]\|^---\|^# /p" "$ROADMAP_FILE" | sed '$d')

  # Print header and goal
  echo "$PHASE_SECTION" | head -2

  # Extract Must-haves section
  echo ""
  # Use sed '$d' for macOS compatibility
  echo "$PHASE_SECTION" | sed -n '/^Must-haves:/,/^[A-Z]/p' | sed '$d'
}
```

**Token savings:** ~1,600 tokens (full ROADMAP ~2,000 → goal+criteria ~400)

---

### extract_mapped_requirements(requirements, req_ids)

Extract only requirements mapped to current task.

**Input:** Full REQUIREMENTS.md content, comma-separated REQ-IDs (e.g., "AUTH-01,AUTH-02")

**Output:** Only the specified requirements:
```
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AUTH-01 | User can login with email/password | Must | Pending |
| AUTH-02 | JWT token returned on successful login | Must | Pending |
```

**Bash implementation:**
```bash
extract_mapped_requirements() {
  local REQ_FILE="$1"
  local REQ_IDS="$2"  # Comma-separated: "AUTH-01,AUTH-02"

  # Print table header (first 3 lines: header + separator + column names)
  head -3 "$REQ_FILE"

  # Extract matching rows for each ID
  for ID in $(echo "$REQ_IDS" | tr ',' '\n' | tr -d ' '); do
    grep "| ${ID} |" "$REQ_FILE" 2>/dev/null || true
  done
}
```

**Token savings:** ~1,800 tokens (full REQUIREMENTS ~2,000 → mapped ~200)

---

## Orchestrator Integration

### build_executor_context(plan_path, phase_num, delta_enabled)

Main function to build context for executor subagents.

**Logic:**
```bash
build_executor_context() {
  local PLAN_PATH="$1"
  local PHASE_NUM="$2"
  local DELTA_ENABLED="$3"  # "true" or "false"

  if [ "$DELTA_ENABLED" = "true" ]; then
    # === DELTA CONTEXT MODE ===

    # 1. Extract phase section from ROADMAP
    echo "## Phase Context"
    extract_phase_section .planning/ROADMAP.md "$PHASE_NUM"
    echo ""

    # 2. Extract relevant decisions from STATE
    extract_relevant_decisions .planning/STATE.md "$PHASE_NUM"

    # 3. Extract task-mapped requirements (if plan specifies them)
    local TASK_REQS=$(grep "^requirements:" "$PLAN_PATH" 2>/dev/null | sed 's/requirements:[[:space:]]*//' || true)

    if [ -n "$TASK_REQS" ] && [ -f .planning/REQUIREMENTS.md ]; then
      echo ""
      echo "## Task Requirements"
      extract_mapped_requirements .planning/REQUIREMENTS.md "$TASK_REQS"
    fi

  else
    # === FULL CONTEXT MODE (backward compatible) ===

    echo "## Project State"
    cat .planning/STATE.md
  fi
}
```

### build_verifier_context(phase_num, delta_enabled)

Build context for verifier subagents.

**Logic:**
```bash
build_verifier_context() {
  local PHASE_NUM="$1"
  local DELTA_ENABLED="$2"

  if [ "$DELTA_ENABLED" = "true" ]; then
    # Verifier needs goal + must-haves for verification
    echo "## Phase Goal"
    extract_phase_goal .planning/ROADMAP.md "$PHASE_NUM"
    echo ""

    # Verifier needs full STATE to understand history
    echo "## Project State"
    cat .planning/STATE.md

  else
    # Full context mode
    echo "## Roadmap"
    cat .planning/ROADMAP.md
    echo ""
    echo "## Project State"
    cat .planning/STATE.md
  fi
}
```

---

## Token Savings Summary

### Per-Executor Savings

| Context File | Full Tokens | Delta Tokens | Savings |
|--------------|-------------|--------------|---------|
| STATE.md | ~1,300 | ~300 | ~1,000 |
| ROADMAP.md (if loaded) | ~2,000 | ~400 | ~1,600 |
| REQUIREMENTS.md (if loaded) | ~2,000 | ~200 | ~1,800 |

**Executor total:** ~1,000-2,600 tokens saved per agent

### Per-Phase Savings (3 executors + 1 verifier)

- Executors: 3 × 1,000 = ~3,000 tokens minimum
- Verifier: ~1,600 tokens (ROADMAP reduction)
- **Total: ~4,600 tokens per phase**

### Combined with v2.0 Optimizations

| Optimization | Per-Executor Savings |
|--------------|---------------------|
| compact_workflows | ~12,500 tokens |
| lazy_references (autonomous) | ~8,700 tokens |
| tiered_instructions | ~2,200 tokens |
| **delta_context** | ~1,000-2,600 tokens |

**Total potential savings:** ~24,400-26,000 tokens per executor

---

## Fallback Behavior

If extraction fails for any reason:
1. Log warning: "Delta context extraction failed for {file}, using full context"
2. Fall back to full file content
3. Execution continues normally

**Never fail execution due to delta context issues.**

---

## Config Flag

```json
{
  "optimization": {
    "delta_context": true
  }
}
```

Default: `true` in v2.1+, `false` if not specified (backward compatible).
