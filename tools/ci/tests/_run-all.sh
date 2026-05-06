#!/usr/bin/env bash
# Run every validator test in tools/ci/tests/*.test.sh.
set -euo pipefail
TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
fail_count=0

for t in "$TEST_DIR"/*.test.sh; do
  [ -e "$t" ] || continue   # glob may not match in early scaffolding
  printf "\n=== %s ===\n" "$(basename "$t")"
  if bash "$t"; then
    :
  else
    fail_count=$((fail_count+1))
  fi
done

if [ "$fail_count" -gt 0 ]; then
  printf "\n[run-all] %d test file(s) failed.\n" "$fail_count"
  exit 1
fi
printf "\n[run-all] all validator tests passed.\n"
