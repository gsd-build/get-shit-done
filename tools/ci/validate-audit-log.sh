#!/usr/bin/env bash
# validate-audit-log.sh — enforce the line format of .planning/audit.md.
# Format (5 pipe-delimited columns):
#   <ISO-8601 timestamp> | <agent-name> | <completion-marker> | <artifact-path> | <notes>
# Heading lines (#...), HTML comments (<!--...-->), and blank lines are skipped.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-audit-log"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
AUDIT="$ROOT/.planning/audit.md"

if [ ! -f "$AUDIT" ]; then
  vinfo "no .planning/audit.md — nothing to validate"
  vexit
fi

line_re='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z[[:space:]]*\|[[:space:]]*[A-Za-z0-9_.-]+[[:space:]]*\|[[:space:]]*##[[:space:]]+.+[[:space:]]*\|[[:space:]]*[^|]+[[:space:]]*\|[[:space:]]*.*$'

n=0
while IFS= read -r line; do
  n=$((n+1))
  # Skip blank, headings, html comments.
  case "$line" in
    "" ) continue ;;
    \#*) continue ;;
    "<!--"*) continue ;;
  esac
  if ! [[ "$line" =~ $line_re ]]; then
    vfail "malformed audit entry at line $n: $line"
  fi
done < "$AUDIT"

vexit
