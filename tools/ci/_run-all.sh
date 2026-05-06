#!/usr/bin/env bash
# Run every IC pack CI validator in order. Fails fast on the first failing
# validator (use `--continue` to run them all and report at end).

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

continue_on_error=0
if [ "${1:-}" = "--continue" ]; then
  continue_on_error=1
fi

VALIDATORS=(
  validate-manifest.sh
  validate-classification.sh
  validate-agents.sh
  validate-skills.sh
  validate-no-classified-leak.sh
  validate-completion-markers.sh
  validate-triggers.sh
  validate-reference-staleness.sh
  validate-audit-log.sh
  validate-workflow-patches.sh
  validate-seamless-fork.sh
  validate-publish-scope.sh
)

failures=0
for v in "${VALIDATORS[@]}"; do
  printf "\n=== %s ===\n" "$v"
  if ! bash "$SCRIPT_DIR/$v"; then
    failures=$((failures+1))
    [ "$continue_on_error" -eq 1 ] || {
      printf "\n[ci] FAILED: %s — stopping (use --continue to run all)\n" "$v" >&2
      exit 1
    }
  fi
done

if [ "$failures" -gt 0 ]; then
  printf "\n[ci] %d validator(s) failed\n" "$failures" >&2
  exit 1
fi
printf "\n[ci] all validators passed\n"
