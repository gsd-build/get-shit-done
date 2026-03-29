#!/bin/bash
# gsd-phase-boundary.sh — PostToolUse hook: detect .planning/ file writes
# Outputs a reminder when planning files are modified outside normal workflow.
# Uses Node.js for JSON parsing (always available in GSD projects, no jq dependency).

INPUT=$(cat)

# Extract file_path from JSON using Node (handles escaping correctly)
FILE=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).tool_input?.file_path||'')}catch{}})" 2>/dev/null)

if [[ "$FILE" == *.planning/* ]] || [[ "$FILE" == .planning/* ]]; then
  echo ".planning/ file modified: $FILE"
  echo "Check: Should STATE.md be updated to reflect this change?"
fi

exit 0
