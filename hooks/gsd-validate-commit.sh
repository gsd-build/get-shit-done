#!/bin/bash
# gsd-hook-version: {{GSD_VERSION}}
# gsd-validate-commit.sh — PreToolUse hook: enforce Conventional Commits format
# Blocks git commit commands with non-conforming messages (exit 2).
# Allows conforming messages and all non-commit commands (exit 0).
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

# Extract command from JSON using Node (handles escaping correctly, no jq needed)
CMD=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).tool_input?.command||'')}catch{}})" 2>/dev/null)

# Only check git commit commands
if [[ "$CMD" =~ ^git[[:space:]]+commit ]]; then
  # Extract message from -m flag
  MSG=""
  if [[ "$CMD" =~ -m[[:space:]]+\"([^\"]+)\" ]]; then
    MSG="${BASH_REMATCH[1]}"
  elif [[ "$CMD" =~ -m[[:space:]]+\'([^\']+)\' ]]; then
    MSG="${BASH_REMATCH[1]}"
  fi

  if [ -n "$MSG" ]; then
    SUBJECT=$(echo "$MSG" | head -1)
    # Validate Conventional Commits format
    if ! [[ "$SUBJECT" =~ ^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+\))?:[[:space:]].+ ]]; then
      echo '{"decision": "block", "reason": "Commit message must follow Conventional Commits: <type>(<scope>): <subject>. Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore. Subject must be <=72 chars, lowercase, imperative mood, no trailing period."}'
      exit 2
    fi
    if [ ${#SUBJECT} -gt 72 ]; then
      echo '{"decision": "block", "reason": "Commit subject must be 72 characters or less."}'
      exit 2
    fi
  fi
fi

exit 0
