#!/usr/bin/env bash
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

# Only check git commit commands.
# Delegates to hooks/lib/git-cmd.js isGitSubcommand() — the canonical token-walk
# classifier that handles env-prefix, -C path, and full-path git invocations.
# A naive `^git\s+commit` regex misses all three; this guard fixes that (#3129).
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
if GIT_CMD_LIB="$HOOK_DIR/lib/git-cmd.js" node -e "
  const {isGitSubcommand}=require(process.env.GIT_CMD_LIB);
  process.exit(isGitSubcommand(process.argv[1],'commit')?0:1);
" "$CMD" 2>/dev/null; then
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
      # Emit a typed `code` field alongside `reason` (#2974). Tests assert
      # on the stable code string; the reason is the human-readable copy.
      echo '{"decision": "block", "code": "CONVENTIONAL_COMMITS_VIOLATION", "reason": "Commit message must follow Conventional Commits: <type>(<scope>): <subject>. Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore. Subject must be <=72 chars, lowercase, imperative mood, no trailing period."}'
      exit 2
    fi
    if [ ${#SUBJECT} -gt 72 ]; then
      echo '{"decision": "block", "code": "COMMIT_SUBJECT_TOO_LONG", "reason": "Commit subject must be 72 characters or less."}'
      exit 2
    fi
  fi
fi

exit 0
