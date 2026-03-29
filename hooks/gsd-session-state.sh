#!/bin/bash
# gsd-session-state.sh — SessionStart hook: inject project state reminder
# Outputs STATE.md head on every session start for orientation.

echo '## Project State Reminder'
echo ''

if [ -f .planning/STATE.md ]; then
  echo 'STATE.md exists - check for blockers and current phase.'
  head -20 .planning/STATE.md
else
  echo 'No .planning/ found - suggest /gsd:new-project if starting new work.'
fi

echo ''

if [ -f .planning/config.json ]; then
  MODE=$(grep -o '"mode"[[:space:]]*:[[:space:]]*"[^"]*"' .planning/config.json 2>/dev/null || echo '"mode": "unknown"')
  echo "Config: $MODE"
fi

exit 0
