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
  # Check files changed relative to upstream/main.
  # Using upstream/main (not origin/main) as the baseline because the
  # automated/upstream-sync branch legitimately diverges from origin/main for all
  # upstream-owned files — that's by design. We only want to catch files the repair
  # agent incorrectly modified relative to what upstream already has.
  git diff --name-only upstream/main HEAD | sort > /tmp/committed-files.txt
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
