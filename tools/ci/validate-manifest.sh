#!/usr/bin/env bash
# validate-manifest.sh — every entry in intel-refs/MANIFEST.json must resolve to
# a real file under intel-refs/, and every entry must have the required fields:
# applies_when, owner, last_reviewed, classification.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-manifest"

# Resolve repo root (allow override for tests).
ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
MANIFEST="$ROOT/intel-refs/MANIFEST.json"

require_bin jq

if [ ! -f "$MANIFEST" ]; then
  vfail "MANIFEST.json not found at $MANIFEST"
  vexit
fi

# Validate JSON parses.
if ! jq -e . "$MANIFEST" >/dev/null 2>&1; then
  vfail "MANIFEST.json is not valid JSON"
  vexit
fi

# Required fields per entry.
required_fields=(applies_when owner last_reviewed classification)

# Iterate topics. `jq -r 'keys[]'` returns one key per line (none if empty).
while IFS= read -r topic; do
  [ -n "$topic" ] || continue
  topic_path="$ROOT/intel-refs/$topic"
  if [ ! -f "$topic_path" ]; then
    vfail "manifest entry '$topic' does not resolve to a real file at $topic_path"
    continue
  fi
  for field in "${required_fields[@]}"; do
    if ! jq -e --arg t "$topic" --arg f "$field" '.topics[$t][$f]' "$MANIFEST" >/dev/null 2>&1; then
      vfail "manifest entry '$topic' missing required field '$field'"
    fi
  done
done < <(jq -r '.topics | keys[]' "$MANIFEST" 2>/dev/null || true)

# Sanity: top-level shape.
if ! jq -e '.version' "$MANIFEST" >/dev/null 2>&1; then
  vfail "manifest missing top-level 'version' field"
fi
if ! jq -e '.topics' "$MANIFEST" >/dev/null 2>&1; then
  vfail "manifest missing top-level 'topics' field"
fi

vexit
