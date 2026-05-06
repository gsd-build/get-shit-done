#!/usr/bin/env bash
# validate-reference-staleness.sh — emit a warning when any manifest entry's
# last_reviewed date is more than 180 days old. Advisory only; exits 0 with
# warnings.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-reference-staleness"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
MANIFEST="$ROOT/intel-refs/MANIFEST.json"
require_bin jq
require_bin python3

if [ ! -f "$MANIFEST" ]; then
  vinfo "no manifest — nothing to check"
  vexit
fi

today_epoch="$(python3 -c 'import datetime; print(int(datetime.date.today().strftime("%s")))')"
threshold_days=180

while IFS=$'\t' read -r topic last_reviewed; do
  [ -n "$topic" ] || continue
  [ -n "$last_reviewed" ] && [ "$last_reviewed" != "null" ] || { vwarn "$topic: missing last_reviewed"; continue; }
  entry_epoch="$(python3 -c "import datetime,sys; d=datetime.date.fromisoformat('$last_reviewed'); print(int(d.strftime('%s')))" 2>/dev/null || echo "")"
  if [ -z "$entry_epoch" ]; then
    vwarn "$topic: unparseable last_reviewed '$last_reviewed'"
    continue
  fi
  age_days=$(( (today_epoch - entry_epoch) / 86400 ))
  if [ "$age_days" -gt "$threshold_days" ]; then
    vwarn "$topic: last_reviewed $last_reviewed is $age_days days old (threshold: $threshold_days)"
  fi
done < <(jq -r '.topics // {} | to_entries[] | "\(.key)\t\(.value.last_reviewed // "")"' "$MANIFEST")

vexit
