#!/usr/bin/env bash
# sync-from-upstream.sh — pull upstream gsd-build/get-shit-done changes into
# this soft-fork, reapply workflow patches, update VERSION's gsd_pinned field,
# and run the full validator suite.
#
# Usage:
#   tools/sync/sync-from-upstream.sh [--branch=main] [--no-merge]
#
# --no-merge: fetch upstream and report the diff, but don't merge. Useful for
# scoping work before committing to a sync.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

branch="main"
do_merge=1

while [ $# -gt 0 ]; do
  case "$1" in
    --branch=*) branch="${1#*=}"; shift ;;
    --no-merge) do_merge=0; shift ;;
    --help|-h) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

# Sanity checks.
if [ -n "$(git status --porcelain)" ]; then
  echo "error: working tree is dirty. Commit or stash before syncing." >&2
  exit 1
fi
if ! git remote get-url upstream >/dev/null 2>&1; then
  echo "error: 'upstream' remote not configured. Run:" >&2
  echo "  git remote add upstream https://github.com/gsd-build/get-shit-done.git" >&2
  exit 1
fi

echo "==> fetching upstream..."
git fetch upstream

ahead_behind="$(git rev-list --left-right --count "$branch...upstream/main" || echo "0	0")"
behind="$(echo "$ahead_behind" | cut -f2)"
echo "==> behind upstream by $behind commits"

if [ "$behind" -eq 0 ]; then
  echo "==> already in sync"
  exit 0
fi

if [ "$do_merge" -eq 0 ]; then
  echo "==> --no-merge: showing what would be merged:"
  git log --oneline "$branch..upstream/main"
  exit 0
fi

echo "==> merging upstream/main into $branch..."
git merge --no-edit upstream/main || {
  echo "error: merge had conflicts. Resolve and re-run validators manually." >&2
  exit 1
}

# Update VERSION's gsd_pinned to whatever the upstream HEAD's package.json declares.
upstream_version="$(node -e "console.log(require('./package.upstream.json').version)" 2>/dev/null || echo "unknown")"
# Note: upstream sync may have changed package.json (we ship our own at root);
# refresh package.upstream.json to reflect the new upstream contents, then update VERSION.
if [ -f package.upstream.json ]; then
  # Pull upstream's package.json content (we want the upstream version, not our IC pack version).
  git show "upstream/main:package.json" > package.upstream.json 2>/dev/null || true
  upstream_version="$(node -e "try { console.log(require('./package.upstream.json').version) } catch(e) { console.log('unknown') }")"
fi
sed -i.bak -E "s/^gsd_pinned:.*/gsd_pinned: $upstream_version/" VERSION
rm -f VERSION.bak
echo "==> VERSION updated: gsd_pinned: $upstream_version"

echo "==> reapplying workflow patches..."
bash tools/patch-workflows.sh

echo "==> running full validator suite..."
bash tools/ci/_run-all.sh --continue

echo "==> sync complete. Review the merge with 'git log -1' and 'git diff HEAD~..HEAD',"
echo "    then push with 'git push origin $branch' when ready."
