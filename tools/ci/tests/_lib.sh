#!/usr/bin/env bash
# Shared helpers for validator tests.
# Each test file: `source "$(dirname "$0")/_lib.sh"; <run cases>; report`.

set -euo pipefail

GSD_IC_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TEST_NAME="${TEST_NAME:-$(basename "${BASH_SOURCE[1]}" .test.sh)}"
__test_passes=0
__test_fails=0

# Make a clean fixture scratch dir for one test case.
mkfixture() {
  local fname="$1"
  local dir="$GSD_IC_ROOT/tools/ci/tests/fixtures/_scratch/$TEST_NAME/$fname"
  rm -rf "$dir"
  mkdir -p "$dir"
  echo "$dir"
}

# Run a validator against a fixture root and capture its exit code.
# Usage: run_validator <validator-script> <root-dir>
# Sets $__last_exit and $__last_output.
run_validator() {
  local validator="$1"; shift
  local root="$1"; shift
  __last_output="$(GSD_IC_ROOT_OVERRIDE="$root" bash "$validator" "$@" 2>&1)" && __last_exit=0 || __last_exit=$?
}

# Assertions.
expect_pass() {
  local label="$1"
  if [ "$__last_exit" -eq 0 ]; then
    printf "  ✓ %s\n" "$label"
    __test_passes=$((__test_passes+1))
  else
    printf "  ✗ %s (expected exit 0, got %d)\n" "$label" "$__last_exit"
    printf "    output: %s\n" "$__last_output" | head -10
    __test_fails=$((__test_fails+1))
  fi
}

expect_fail() {
  local label="$1"
  if [ "$__last_exit" -ne 0 ]; then
    printf "  ✓ %s\n" "$label"
    __test_passes=$((__test_passes+1))
  else
    printf "  ✗ %s (expected non-zero exit, got 0)\n" "$label"
    __test_fails=$((__test_fails+1))
  fi
}

expect_output() {
  local label="$1" pattern="$2"
  if printf "%s" "$__last_output" | grep -q -- "$pattern"; then
    printf "  ✓ %s (output contains %q)\n" "$label" "$pattern"
    __test_passes=$((__test_passes+1))
  else
    printf "  ✗ %s (output missing %q)\n" "$label" "$pattern"
    printf "    output: %s\n" "$__last_output" | head -10
    __test_fails=$((__test_fails+1))
  fi
}

report() {
  printf "[%s] %d passed, %d failed\n" "$TEST_NAME" "$__test_passes" "$__test_fails"
  [ "$__test_fails" -eq 0 ] || exit 1
}
