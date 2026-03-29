#!/bin/bash
# gsd-validate-commit.sh — PreToolUse hook: enforce Conventional Commits format
# Blocks git commit commands with non-conforming messages (exit 2).
# Allows conforming messages and all non-commit commands (exit 0).

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only check git commit commands
if [[ "$CMD" =~ ^git[[:space:]]+commit ]]; then
  # Extract message from -m flag (handles single quotes, double quotes, and heredoc patterns)
  # Try double-quoted -m first
  MSG=$(echo "$CMD" | grep -oP '(?<=-m ")[^"]+' 2>/dev/null)
  # Try single-quoted -m
  if [ -z "$MSG" ]; then
    MSG=$(echo "$CMD" | grep -oP "(?<=-m ')[^']+" 2>/dev/null)
  fi
  # Try heredoc pattern (common in GSD: -m "$(cat <<'EOF'\n...)")
  if [ -z "$MSG" ]; then
    MSG=$(echo "$CMD" | grep -oP '(?<=-m "\$\(cat <<'"'"'EOF'"'"'\n)[^\n]+' 2>/dev/null)
  fi

  if [ -n "$MSG" ]; then
    # Get first line of message (the subject line)
    SUBJECT=$(echo "$MSG" | head -1)
    if ! echo "$SUBJECT" | grep -qP '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+\))?: .{1,72}$'; then
      echo '{"decision": "block", "reason": "Commit message must follow Conventional Commits: <type>(<scope>): <subject>. Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore. Subject must be <=72 chars, lowercase, imperative mood, no trailing period."}'
      exit 2
    fi
  fi
fi

exit 0
