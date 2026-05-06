#!/usr/bin/env bash
# Shared helpers for IC pack CI validators.
# Source this from each validator: `source "$(dirname "$0")/_lib.sh"`.

set -euo pipefail

# Resolve the gsd-ic repo root (works whether validator is invoked by absolute
# path, relative path, or via npm script).
gsd_ic_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
  # tools/ci/<validator>.sh -> tools/ci -> tools -> root
  echo "$(cd "$script_dir/../.." && pwd)"
}

# Color output if we're on a TTY.
if [ -t 1 ]; then
  COLOR_RESET="\033[0m"
  COLOR_RED="\033[31m"
  COLOR_GREEN="\033[32m"
  COLOR_YELLOW="\033[33m"
  COLOR_DIM="\033[2m"
else
  COLOR_RESET=""
  COLOR_RED=""
  COLOR_GREEN=""
  COLOR_YELLOW=""
  COLOR_DIM=""
fi

VALIDATOR_NAME="${VALIDATOR_NAME:-$(basename "${BASH_SOURCE[1]}" .sh)}"
__validator_failures=0
__validator_warnings=0

vinfo()  { printf "${COLOR_DIM}[%s] %s${COLOR_RESET}\n" "$VALIDATOR_NAME" "$*" >&2; }
vpass()  { printf "${COLOR_GREEN}[%s] PASS${COLOR_RESET} %s\n" "$VALIDATOR_NAME" "$*" >&2; }
vwarn()  { printf "${COLOR_YELLOW}[%s] WARN${COLOR_RESET} %s\n" "$VALIDATOR_NAME" "$*" >&2; __validator_warnings=$((__validator_warnings+1)); }
vfail()  { printf "${COLOR_RED}[%s] FAIL${COLOR_RESET} %s\n" "$VALIDATOR_NAME" "$*" >&2; __validator_failures=$((__validator_failures+1)); }

# Exit with the right status code: 0 if no failures (warnings allowed), 1 otherwise.
vexit() {
  if [ "$__validator_failures" -gt 0 ]; then
    printf "${COLOR_RED}[%s] %d failure(s), %d warning(s)${COLOR_RESET}\n" "$VALIDATOR_NAME" "$__validator_failures" "$__validator_warnings" >&2
    exit 1
  fi
  if [ "$__validator_warnings" -gt 0 ]; then
    printf "${COLOR_YELLOW}[%s] OK with %d warning(s)${COLOR_RESET}\n" "$VALIDATOR_NAME" "$__validator_warnings" >&2
  else
    printf "${COLOR_GREEN}[%s] OK${COLOR_RESET}\n" "$VALIDATOR_NAME" >&2
  fi
  exit 0
}

# Require a binary to be on PATH.
require_bin() {
  local b="$1"
  if ! command -v "$b" >/dev/null 2>&1; then
    printf "${COLOR_RED}[%s] required binary missing: %s${COLOR_RESET}\n" "$VALIDATOR_NAME" "$b" >&2
    exit 2
  fi
}
