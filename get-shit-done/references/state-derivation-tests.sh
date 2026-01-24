#!/usr/bin/env bash
# State Derivation Test Harness
# Validates parallel execution safety and function correctness
#
# Run: ./get-shit-done/references/state-derivation-tests.sh

set -euo pipefail

# ============================================================================
# Test Utilities
# ============================================================================

PASS_COUNT=0
FAIL_COUNT=0
TEST_DIR=""

pass() {
  echo "  ✓ $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo "  ✗ $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

# ============================================================================
# Setup/Teardown
# ============================================================================

setup_test_project() {
  TEST_DIR=$(mktemp -d)
  mkdir -p "${TEST_DIR}/.planning/phases/01-foundation"
  mkdir -p "${TEST_DIR}/.planning/phases/02-auth"
  mkdir -p "${TEST_DIR}/.planning/phases/03-features"

  # Create ROADMAP.md
  cat > "${TEST_DIR}/.planning/ROADMAP.md" << 'ROADMAP'
# Roadmap

## Phase 1: Foundation
- [x] 01-01-PLAN.md - Setup project
- [ ] 01-02-PLAN.md - Configure database

## Phase 2: Auth
- [ ] 02-01-PLAN.md - JWT implementation
- [ ] 02-02-PLAN.md - User registration

## Phase 3: Features
- [ ] 03-01-PLAN.md - Main feature
ROADMAP

  # Phase 1: One complete, one not
  touch "${TEST_DIR}/.planning/phases/01-foundation/01-01-PLAN.md"
  touch "${TEST_DIR}/.planning/phases/01-foundation/01-01-SUMMARY.md"
  touch "${TEST_DIR}/.planning/phases/01-foundation/01-02-PLAN.md"
  # No 01-02-SUMMARY.md

  # Phase 2: Neither complete
  touch "${TEST_DIR}/.planning/phases/02-auth/02-01-PLAN.md"
  touch "${TEST_DIR}/.planning/phases/02-auth/02-02-PLAN.md"
  # No SUMMARYs

  # Phase 3: Not started
  touch "${TEST_DIR}/.planning/phases/03-features/03-01-PLAN.md"

  # Add frontmatter with decisions to one SUMMARY
  cat > "${TEST_DIR}/.planning/phases/01-foundation/01-01-SUMMARY.md" << 'SUMMARY'
---
phase: 01-foundation
plan: 01
key-decisions:
  - "Use PostgreSQL for database"
  - "JWT with 15-min expiry"
---

# Phase 1 Plan 1 Summary

## Next Phase Readiness

- Ready for next plan
- All clear to proceed
SUMMARY
}

cleanup_test_project() {
  if [ -n "$TEST_DIR" ] && [ -d "$TEST_DIR" ]; then
    rm -rf "$TEST_DIR"
  fi
  TEST_DIR=""
}

# ============================================================================
# State Derivation Functions (Implementation)
# ============================================================================

get_current_phase() {
  local planning_dir="${1:-.planning}"
  local phases_dir="${planning_dir}/phases"

  if [ ! -d "$phases_dir" ]; then
    echo "none"
    return 0
  fi

  # Find first phase dir with PLAN without SUMMARY
  for phase_dir in "${phases_dir}"/*/; do
    if [ -d "$phase_dir" ]; then
      local plan_count=$(ls -1 "${phase_dir}"*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
      local summary_count=$(ls -1 "${phase_dir}"*-SUMMARY.md 2>/dev/null | wc -l | tr -d ' ')

      if [ "$plan_count" -gt "$summary_count" ]; then
        local phase_name=$(basename "$phase_dir")
        echo "${phase_name%%-*}"
        return 0
      fi
    fi
  done

  echo "none"
  return 0
}

get_current_plan() {
  local phase_dir="$1"

  if [ ! -d "$phase_dir" ]; then
    echo "none"
    return 0
  fi

  for plan_file in $(ls -1 "${phase_dir}"/*-PLAN.md 2>/dev/null | sort); do
    local plan_basename=$(basename "$plan_file" .md)
    local plan_id="${plan_basename%-PLAN}"
    local summary_file="${phase_dir}/${plan_id}-SUMMARY.md"

    if [ ! -f "$summary_file" ]; then
      echo "$plan_id"
      return 0
    fi
  done

  echo "none"
  return 0
}

get_progress() {
  local planning_dir="${1:-.planning}"
  local phases_dir="${planning_dir}/phases"

  if [ ! -d "$phases_dir" ]; then
    echo "0"
    return 0
  fi

  local plan_count=$(find "$phases_dir" -name "*-PLAN.md" 2>/dev/null | wc -l | tr -d ' ')
  local summary_count=$(find "$phases_dir" -name "*-SUMMARY.md" 2>/dev/null | wc -l | tr -d ' ')

  if [ "$plan_count" -eq 0 ]; then
    echo "0"
    return 0
  fi

  local progress=$(( (summary_count * 100) / plan_count ))
  echo "$progress"
  return 0
}

get_phase_status() {
  local phase_dir="$1"

  if [ ! -d "$phase_dir" ]; then
    echo "not-found"
    return 0
  fi

  local plan_count=$(ls -1 "${phase_dir}"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
  local summary_count=$(ls -1 "${phase_dir}"/*-SUMMARY.md 2>/dev/null | wc -l | tr -d ' ')

  if [ "$plan_count" -eq 0 ]; then
    echo "empty"
  elif [ "$summary_count" -eq 0 ]; then
    echo "not-started"
  elif [ "$summary_count" -eq "$plan_count" ]; then
    echo "complete"
  else
    echo "in-progress"
  fi

  return 0
}

get_decisions() {
  local planning_dir="${1:-.planning}"
  local phases_dir="${planning_dir}/phases"

  if [ ! -d "$phases_dir" ]; then
    echo ""
    return 0
  fi

  for summary_file in $(find "$phases_dir" -name "*-SUMMARY.md" 2>/dev/null | sort); do
    local in_frontmatter=0
    local in_decisions=0
    local phase=$(basename "$(dirname "$summary_file")")

    while IFS= read -r line || [ -n "$line" ]; do
      if [ "$line" = "---" ]; then
        if [ "$in_frontmatter" -eq 0 ]; then
          in_frontmatter=1
          continue
        else
          break
        fi
      fi

      if [ "$in_frontmatter" -eq 1 ]; then
        if echo "$line" | grep -qE "^key-decisions:"; then
          in_decisions=1
          continue
        fi

        if [ "$in_decisions" -eq 1 ]; then
          if echo "$line" | grep -qE "^\s*-\s"; then
            local decision=$(echo "$line" | sed 's/^\s*-\s*//' | sed 's/^"//' | sed 's/"$//')
            echo "[$phase] $decision"
          elif ! echo "$line" | grep -qE "^\s"; then
            in_decisions=0
          fi
        fi
      fi
    done < "$summary_file"
  done
}

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

    while IFS= read -r line || [ -n "$line" ]; do
      if echo "$line" | grep -qiE "^##.*Next Phase Readiness|^##.*Blockers"; then
        in_readiness=1
        continue
      fi

      if [ "$in_readiness" -eq 1 ]; then
        if echo "$line" | grep -qE "^##"; then
          in_readiness=0
          continue
        fi

        if echo "$line" | grep -qiE "^\s*-.*blocker"; then
          local blocker=$(echo "$line" | sed 's/^\s*-\s*//')
          echo "[$phase] $blocker"
        fi
      fi
    done < "$summary_file"
  done
}

# ============================================================================
# Correctness Tests
# ============================================================================

test_get_current_phase() {
  echo "Testing get_current_phase()..."
  setup_test_project

  local result=$(get_current_phase "${TEST_DIR}/.planning")

  if [ "$result" = "01" ]; then
    pass "Returns '01' for first incomplete phase"
  else
    fail "Expected '01', got '$result'"
  fi

  cleanup_test_project
}

test_get_current_plan() {
  echo "Testing get_current_plan()..."
  setup_test_project

  local result=$(get_current_plan "${TEST_DIR}/.planning/phases/01-foundation")

  if [ "$result" = "01-02" ]; then
    pass "Returns '01-02' for first plan without SUMMARY"
  else
    fail "Expected '01-02', got '$result'"
  fi

  # Test complete phase
  local result2=$(get_current_plan "/nonexistent/path")
  if [ "$result2" = "none" ]; then
    pass "Returns 'none' for nonexistent directory"
  else
    fail "Expected 'none' for nonexistent, got '$result2'"
  fi

  cleanup_test_project
}

test_get_progress() {
  echo "Testing get_progress()..."
  setup_test_project

  local result=$(get_progress "${TEST_DIR}/.planning")

  # 1 SUMMARY out of 5 PLANs = 20%
  if [ "$result" = "20" ]; then
    pass "Returns '20' for 1/5 plans complete"
  else
    fail "Expected '20', got '$result'"
  fi

  cleanup_test_project
}

test_get_phase_status() {
  echo "Testing get_phase_status()..."
  setup_test_project

  local result1=$(get_phase_status "${TEST_DIR}/.planning/phases/01-foundation")
  if [ "$result1" = "in-progress" ]; then
    pass "Phase 1 is 'in-progress' (1/2 complete)"
  else
    fail "Expected 'in-progress' for phase 1, got '$result1'"
  fi

  local result2=$(get_phase_status "${TEST_DIR}/.planning/phases/02-auth")
  if [ "$result2" = "not-started" ]; then
    pass "Phase 2 is 'not-started' (0/2 complete)"
  else
    fail "Expected 'not-started' for phase 2, got '$result2'"
  fi

  local result3=$(get_phase_status "/nonexistent/path")
  if [ "$result3" = "not-found" ]; then
    pass "Nonexistent phase returns 'not-found'"
  else
    fail "Expected 'not-found', got '$result3'"
  fi

  cleanup_test_project
}

test_get_decisions() {
  echo "Testing get_decisions()..."
  setup_test_project

  local result=$(get_decisions "${TEST_DIR}/.planning")

  if echo "$result" | grep -q "PostgreSQL"; then
    pass "Extracts 'PostgreSQL' decision from frontmatter"
  else
    fail "Failed to extract PostgreSQL decision, got: $result"
  fi

  if echo "$result" | grep -q "JWT"; then
    pass "Extracts 'JWT' decision from frontmatter"
  else
    fail "Failed to extract JWT decision"
  fi

  cleanup_test_project
}

test_get_blockers() {
  echo "Testing get_blockers()..."
  setup_test_project

  # Our test SUMMARY has "No blockers" so should return empty
  local result=$(get_blockers "${TEST_DIR}/.planning")

  if [ -z "$result" ]; then
    pass "Returns empty when no blockers found"
  else
    fail "Expected empty, got: $result"
  fi

  cleanup_test_project
}

test_edge_cases() {
  echo "Testing edge cases..."

  # Test with empty directory
  local empty_dir=$(mktemp -d)
  mkdir -p "${empty_dir}/.planning/phases"

  local result1=$(get_progress "${empty_dir}/.planning")
  if [ "$result1" = "0" ]; then
    pass "Empty project returns 0% progress"
  else
    fail "Expected 0 for empty project, got '$result1'"
  fi

  local result2=$(get_current_phase "${empty_dir}/.planning")
  if [ "$result2" = "none" ]; then
    pass "Empty project returns 'none' for current phase"
  else
    fail "Expected 'none' for empty project, got '$result2'"
  fi

  rm -rf "$empty_dir"
}

# ============================================================================
# Parallel Safety Tests
# ============================================================================

test_parallel_reads() {
  echo "Testing parallel state derivation (10 concurrent processes)..."
  setup_test_project

  local results_file=$(mktemp)
  local pids=""

  # Spawn 10 background processes
  for i in $(seq 1 10); do
    (
      PHASE=$(get_current_phase "${TEST_DIR}/.planning")
      PLAN=$(get_current_plan "${TEST_DIR}/.planning/phases/01-foundation")
      PROGRESS=$(get_progress "${TEST_DIR}/.planning")
      echo "Process $i: Phase=$PHASE, Plan=$PLAN, Progress=$PROGRESS"
    ) >> "$results_file" &
    pids="$pids $!"
  done

  # Wait for all to complete
  for pid in $pids; do
    wait "$pid" 2>/dev/null || true
  done

  # All processes should report same values (ignoring process ID)
  # Extract just the values (Phase=X, Plan=Y, Progress=Z)
  local unique_values=$(cut -d':' -f2 "$results_file" | sort -u | wc -l | tr -d ' ')

  if [ "$unique_values" -eq 1 ]; then
    pass "All 10 processes reported identical state values"
  else
    fail "Processes reported different state values (got $unique_values unique)"
    cat "$results_file"
  fi

  rm -f "$results_file"
  cleanup_test_project
}

test_no_file_writes() {
  echo "Testing that state derivation performs no writes..."
  setup_test_project

  # Record all file modification times (using portable stat)
  local before_file=$(mktemp)
  find "${TEST_DIR}/.planning" -type f -exec ls -la {} \; > "$before_file" 2>/dev/null

  # Small delay to ensure timestamp would change if modified
  sleep 0.1

  # Call all state functions
  get_current_phase "${TEST_DIR}/.planning" > /dev/null
  get_current_plan "${TEST_DIR}/.planning/phases/01-foundation" > /dev/null
  get_progress "${TEST_DIR}/.planning" > /dev/null
  get_phase_status "${TEST_DIR}/.planning/phases/01-foundation" > /dev/null
  get_decisions "${TEST_DIR}/.planning" > /dev/null
  get_blockers "${TEST_DIR}/.planning" > /dev/null

  # Record after
  local after_file=$(mktemp)
  find "${TEST_DIR}/.planning" -type f -exec ls -la {} \; > "$after_file" 2>/dev/null

  # Compare
  if diff -q "$before_file" "$after_file" > /dev/null; then
    pass "No files modified during state derivation"
  else
    fail "Files were modified during state derivation"
    diff "$before_file" "$after_file" || true
  fi

  rm -f "$before_file" "$after_file"
  cleanup_test_project
}

test_consistency_under_load() {
  echo "Testing consistency with rapid parallel calls..."
  setup_test_project

  local results_file=$(mktemp)
  local pids=""

  # Call get_progress 50 times in parallel
  for i in $(seq 1 50); do
    (
      PROGRESS=$(get_progress "${TEST_DIR}/.planning")
      echo "$PROGRESS"
    ) >> "$results_file" &
    pids="$pids $!"
  done

  # Wait for all
  for pid in $pids; do
    wait "$pid" 2>/dev/null || true
  done

  # All should be identical
  local unique_results=$(sort -u "$results_file" | wc -l | tr -d ' ')
  local expected_value=$(head -1 "$results_file")

  if [ "$unique_results" -eq 1 ] && [ "$expected_value" = "20" ]; then
    pass "All 50 parallel calls returned consistent value (20%)"
  else
    fail "Inconsistent results: $unique_results unique values"
  fi

  rm -f "$results_file"
  cleanup_test_project
}

# ============================================================================
# Main Test Runner
# ============================================================================

main() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║  State Derivation Test Suite                                   ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""

  echo "=== Correctness Tests ==="
  test_get_current_phase
  test_get_current_plan
  test_get_progress
  test_get_phase_status
  test_get_decisions
  test_get_blockers
  test_edge_cases
  echo ""

  echo "=== Parallel Safety Tests ==="
  test_parallel_reads
  test_no_file_writes
  test_consistency_under_load
  echo ""

  echo "════════════════════════════════════════════════════════════════"
  echo "Results: $PASS_COUNT passed, $FAIL_COUNT failed"
  echo ""

  if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "✓ All tests passed - state derivation is parallel-safe"
    exit 0
  else
    echo "✗ Some tests failed"
    exit 1
  fi
}

main "$@"
