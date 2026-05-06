#!/usr/bin/env bash
# validate-publish-scope.sh — assert that the npm package about to be published
# contains ONLY IC-pack-prefixed content, no upstream GSD source.
#
# Checks:
#   1. package.json `name` is exactly "@adelphi/gsd-ic"
#   2. `files` field is a restrictive allowlist (no entries matching the
#      upstream-source denylist below)
#   3. (Best-effort) `npm pack --dry-run` output contains no upstream-source
#      paths if npm is available locally.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-publish-scope"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
PKG="$ROOT/package.json"
require_bin jq

if [ ! -f "$PKG" ]; then
  vfail "package.json missing at $PKG"
  vexit
fi

# 1. Name check.
name="$(jq -r '.name' "$PKG")"
if [ "$name" != "@adelphi/gsd-ic" ]; then
  vfail "package.json name must be '@adelphi/gsd-ic' (got '$name')"
fi

# 2. files field denylist. Anything matching these patterns means upstream-source leak.
denylist=(
  '^bin/install\.js$'
  '^bin/gsd-sdk\.js$'
  '^sdk/'
  '^scripts/'
  '^get-shit-done/'
  '^README\.[a-z]+\.md$'
)

files_arr="$(jq -r '.files // [] | .[]' "$PKG")"
while IFS= read -r path; do
  [ -n "$path" ] || continue
  # Special case: commands/ entries must be commands/gsd/intel-gate-* only.
  # (POSIX ERE has no negative lookahead; this replaces the original PCRE entry.)
  if [[ "$path" =~ ^commands/ ]] && ! [[ "$path" =~ ^commands/gsd/intel-gate- ]]; then
    vfail "package.json files entry '$path' under commands/ must be commands/gsd/intel-gate-* (got '$path')"
    continue
  fi
  for deny in "${denylist[@]}"; do
    if printf "%s" "$path" | grep -Eq "$deny"; then
      vfail "package.json files entry '$path' matches upstream-source denylist '$deny'"
    fi
  done
done <<< "$files_arr"

# 3. (best-effort) npm pack --dry-run.
if command -v npm >/dev/null 2>&1; then
  pack_out="$(cd "$ROOT" && npm pack --dry-run --json 2>/dev/null || true)"
  if [ -n "$pack_out" ]; then
    leaked="$(printf "%s" "$pack_out" | jq -r '.[0].files[]?.path // empty' 2>/dev/null | grep -E '^(sdk/|scripts/|get-shit-done/|bin/install\.js|bin/gsd-sdk\.js)' || true)"
    if [ -n "$leaked" ]; then
      while IFS= read -r leak; do
        vfail "npm pack would include upstream-source path: $leak"
      done <<< "$leaked"
    fi
  fi
fi

vexit
