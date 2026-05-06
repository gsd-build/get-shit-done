#!/usr/bin/env bash
# validate-triggers.sh — every gate trigger in intel-gates.json (template or
# committed) must resolve to a real step in some stock workflow file.
#
# Trigger format: "<workflow-name>.<step-name>"
# Workflow file lookup: {root}/get-shit-done/workflows/<workflow-name>.md (the
# upstream stock layout) OR {root}/commands/gsd/<workflow-name>.md (legacy).
# Step lookup: a Markdown heading whose slug matches <step-name> after
# lowercasing and replacing spaces with hyphens; OR an HTML anchor.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-triggers"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
require_bin jq

# Find any intel-gates.json (template or runtime). Plan 0 has none.
gates_files=()
while IFS= read -r f; do
  gates_files+=("$f")
done < <(find "$ROOT" -path "$ROOT/.git" -prune -o -path "$ROOT/node_modules" -prune -o -path "$ROOT/tools/ci/tests/fixtures" -prune -o -type f -name "intel-gates*.json" -print 2>/dev/null)

if [ "${#gates_files[@]}" -eq 0 ]; then
  vinfo "no intel-gates.json files — nothing to validate"
  vexit
fi

# Step-slug from a workflow file: every Markdown heading => slug.
collect_steps() {
  local wf_file="$1"
  awk '
    /^##+[[:space:]]+/ {
      sub(/^##+[[:space:]]+/, "", $0)
      slug = tolower($0)
      gsub(/[^a-z0-9 -]/, "", slug)
      gsub(/[[:space:]]+/, "-", slug)
      print slug
    }
  ' "$wf_file" 2>/dev/null
}

resolve_trigger() {
  local trigger="$1"
  local wf="${trigger%%.*}"
  local step="${trigger#*.}"

  # Try standard upstream paths.
  local candidate_paths=(
    "$ROOT/get-shit-done/workflows/$wf.md"
    "$ROOT/commands/gsd/$wf.md"
  )
  local wf_path=""
  for p in "${candidate_paths[@]}"; do
    if [ -f "$p" ]; then wf_path="$p"; break; fi
  done

  if [ -z "$wf_path" ]; then
    vfail "trigger '$trigger' references unknown workflow file (looked in get-shit-done/workflows/, commands/gsd/)"
    return
  fi

  # Step might be a heading slug, an HTML anchor, or a literal section name.
  local steps; steps="$(collect_steps "$wf_path")"
  if printf "%s\n" "$steps" | grep -qx "$step"; then
    return 0
  fi
  # Fallback: search for a literal `<a name="step">` anchor.
  if grep -Eq "<a[[:space:]]+name=\"$step\"" "$wf_path" 2>/dev/null; then
    return 0
  fi
  vfail "trigger '$trigger' workflow '$wf' has no step matching '$step'"
}

for gates in "${gates_files[@]}"; do
  triggers="$(jq -r '.gates // {} | to_entries[] | .value.trigger // empty' "$gates" 2>/dev/null || true)"
  while IFS= read -r t; do
    [ -n "$t" ] || continue
    resolve_trigger "$t"
  done <<< "$triggers"
done

vexit
