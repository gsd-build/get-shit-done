#!/usr/bin/env bash
# guard-upstream-files.sh — Prevents the repair agent from modifying upstream-owned files.
# Usage: bash scripts/guard-upstream-files.sh pre-commit
#        bash scripts/guard-upstream-files.sh post-commit
set -euo pipefail

MODE="${1:-post-commit}"

# Dynamically detect upstream-owned files
git ls-tree -r --name-only upstream/main | sort > /tmp/upstream-owned-files.txt

# Load fork exemptions — files this fork intentionally diverges from upstream.
# Defined in scripts/guard-exemptions.txt (one path per line, # = comment).
EXEMPTIONS_FILE="$(dirname "$0")/guard-exemptions.txt"
if [ -f "$EXEMPTIONS_FILE" ]; then
  grep -v '^\s*#' "$EXEMPTIONS_FILE" | grep -v '^\s*$' | sort > /tmp/guard-exemptions.txt
  # Remove exempted files from the upstream-owned list before violation checks
  comm -23 /tmp/upstream-owned-files.txt /tmp/guard-exemptions.txt > /tmp/upstream-owned-filtered.txt
else
  cp /tmp/upstream-owned-files.txt /tmp/upstream-owned-filtered.txt
fi

if [ "$MODE" = "pre-commit" ]; then
  # Check staged files
  git diff --cached --name-only | sort > /tmp/staged-files.txt
  VIOLATIONS=$(comm -12 /tmp/upstream-owned-filtered.txt /tmp/staged-files.txt || true)
  if [ -n "$VIOLATIONS" ]; then
    echo "::error::Filesystem guard (pre-commit): repair agent modified upstream-owned files:"
    echo "$VIOLATIONS"
    echo "$VIOLATIONS" | xargs git restore --staged
    echo "::error::Staged changes reverted. Failing."
    exit 1
  fi
  echo "Filesystem guard (pre-commit): no violations."
elif [ "$MODE" = "post-commit" ]; then
  # Determine the diff baseline.
  # When called from the repair job, PRE_REPAIR_BASELINE contains the SHA recorded
  # before any agent work ran. Using it means we only flag files the agent actually
  # changed — not all files the fork legitimately diverges from upstream on.
  # Fall back to upstream/main when no baseline is available (e.g. manual invocations).
  if [ -n "${PRE_REPAIR_BASELINE:-}" ]; then
    BASELINE="$PRE_REPAIR_BASELINE"
    echo "Using pre-repair baseline: $BASELINE"
  elif [ -f /tmp/pre-repair-sha ]; then
    BASELINE=$(cat /tmp/pre-repair-sha)
    echo "Using pre-repair baseline from file: $BASELINE"
  else
    BASELINE="upstream/main"
    echo "No pre-repair baseline found; falling back to upstream/main."
  fi
  git diff --name-only "$BASELINE" HEAD | sort > /tmp/committed-files.txt
  VIOLATIONS=$(comm -12 /tmp/upstream-owned-filtered.txt /tmp/committed-files.txt || true)
  if [ -n "$VIOLATIONS" ]; then
    echo "::error::Filesystem guard (post-commit): repair agent committed changes to upstream-owned files:"
    echo "$VIOLATIONS"
    # Restore each violated file to its upstream/main state.
    # Every violation is guaranteed to exist in upstream/main because VIOLATIONS
    # is the intersection of committed-files with the upstream-owned file list.
    echo "$VIOLATIONS" | while IFS= read -r f; do
      git checkout upstream/main -- "$f"
    done
    # Ensure git identity is set before amending (runner may not have it configured)
    git config user.email "github-actions[bot]@users.noreply.github.com" 2>/dev/null || true
    git config user.name "github-actions[bot]" 2>/dev/null || true
    git commit --amend --no-edit || true
    git push --force-with-lease origin HEAD
    echo "::error::Upstream-owned files reverted and force-pushed. Failing."
    exit 1
  fi
  echo "Filesystem guard (post-commit): no violations."
else
  echo "Unknown mode: $MODE. Use pre-commit or post-commit." >&2
  exit 2
fi
