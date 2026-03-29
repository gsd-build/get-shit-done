#!/bin/bash
# gsd-phase-boundary.sh — PostToolUse hook: detect .planning/ file writes
# Outputs a reminder when planning files are modified outside normal workflow.

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

if [[ "$FILE" == *.planning/* ]] || [[ "$FILE" == .planning/* ]]; then
  echo ".planning/ file modified: $FILE"
  echo "Check: Should STATE.md be updated to reflect this change?"
fi

exit 0
