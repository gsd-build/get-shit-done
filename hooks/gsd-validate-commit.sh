#!/bin/bash
# gsd-validate-commit.sh — PreToolUse hook: enforce Conventional Commits format
# Blocks git commit commands with non-conforming messages (exit 2).
# Allows conforming messages and all non-commit commands (exit 0).
# Uses POSIX-compatible patterns (no grep -P) for CI portability.

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only check git commit commands
if [[ "$CMD" =~ ^git[[:space:]]+commit ]]; then
  # Extract message from -m flag using bash parameter expansion (no grep -P needed)
  MSG=""
  # Try double-quoted -m "message"
  if [[ "$CMD" =~ -m[[:space:]]+\"([^\"]+)\" ]]; then
    MSG="${BASH_REMATCH[1]}"
  # Try single-quoted -m 'message'
  elif [[ "$CMD" =~ -m[[:space:]]+\'([^\']+)\' ]]; then
    MSG="${BASH_REMATCH[1]}"
  fi

  if [ -n "$MSG" ]; then
    # Get first line of message (the subject line)
    SUBJECT=$(echo "$MSG" | head -1)
    # Validate Conventional Commits format using bash regex (POSIX-compatible)
    if ! [[ "$SUBJECT" =~ ^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+\))?:[[:space:]].+ ]]; then
      echo '{"decision": "block", "reason": "Commit message must follow Conventional Commits: <type>(<scope>): <subject>. Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore. Subject must be <=72 chars, lowercase, imperative mood, no trailing period."}'
      exit 2
    fi
    # Check subject length (<=72 chars)
    if [ ${#SUBJECT} -gt 72 ]; then
      echo '{"decision": "block", "reason": "Commit subject must be 72 characters or less."}'
      exit 2
    fi
  fi
fi

exit 0
