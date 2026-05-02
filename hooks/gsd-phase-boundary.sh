#!/bin/bash
# gsd-hook-version: {{GSD_VERSION}}
# gsd-phase-boundary.sh — PostToolUse hook: detect .planning/ file writes
# Outputs a reminder when planning files are modified outside normal workflow.
# Uses Node.js for JSON parsing (always available in GSD projects, no jq dependency).
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

INPUT=$(cat)

# Extract file_path from JSON using Node (handles escaping correctly)
FILE=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).tool_input?.file_path||'')}catch{}})" 2>/dev/null)

# Emit a structured JSON envelope (#2974). additionalContext carries the
# user-visible reminder text; the typed `planning_modified` boolean and
# `file_path` let tests assert on the structured contract without grepping.
PLANNING_MODIFIED="false"
if [[ "$FILE" == *.planning/* ]] || [[ "$FILE" == .planning/* ]]; then
  PLANNING_MODIFIED="true"
fi

if [ "$PLANNING_MODIFIED" = "true" ]; then
  node -e '
    const file = process.argv[1];
    const additionalContext = ".planning/ file modified: " + file + "\n" +
      "Check: Should STATE.md be updated to reflect this change?";
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext,
        planning_modified: true,
        file_path: file,
      },
    }));
  ' "$FILE"
fi

exit 0
