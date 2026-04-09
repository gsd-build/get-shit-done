#!/bin/bash
# gsd-session-state.sh — SessionStart hook: inject project state reminder
# Outputs STATE.md head on every session start for orientation.
#
# OPT-IN: This hook is a no-op unless config.json has hooks.community: true.
# Enable with: "hooks": { "community": true } in .planning/config.json

# Check opt-in config — exit silently if not enabled
if [ -f .planning/config.json ]; then
  ENABLED=$(node -e "try{const c=require('./.planning/config.json');process.stdout.write(c.hooks?.community===true?'1':'0')}catch{process.stdout.write('0')}" 2>/dev/null)
  if [ "$ENABLED" != "1" ]; then exit 0; fi
else
  exit 0
fi

echo '## Project State Reminder'
echo ''

if [ -f .planning/STATE.md ]; then
  echo 'STATE.md exists - check for blockers and current phase.'
  head -20 .planning/STATE.md
else
  echo 'No .planning/ found - suggest /gsd-new-project if starting new work.'
fi

echo ''

if [ -f .planning/config.json ]; then
  MODE=$(grep -o '"mode"[[:space:]]*:[[:space:]]*"[^"]*"' .planning/config.json 2>/dev/null || echo '"mode": "unknown"')
  echo "Config: $MODE"
fi

exit 0
