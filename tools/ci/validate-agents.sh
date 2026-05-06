#!/usr/bin/env bash
# validate-agents.sh — every IC pack agent must have:
#   - YAML frontmatter (delimited by --- ... ---)
#   - frontmatter contains: name, classification, ic_pack: true
#   - body contains a completion marker line of the form
#     `## <SOMETHING> COMPLETE` or `## <SOMETHING> BLOCKED`/FOUND/FAILED
#
# An IC pack agent is any agents/*.md file whose frontmatter has `ic_pack: true`,
# OR any file in agents/ whose name starts with `gsd-` and which has NO frontmatter
# at all (defensive: catches malformed IC pack agents that lack the marker field).

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-agents"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
AGENTS_DIR="$ROOT/agents"

if [ ! -d "$AGENTS_DIR" ]; then
  vinfo "no agents/ directory — nothing to validate"
  vexit
fi

# Helper: extract frontmatter (between first two `---` lines), output empty if absent.
extract_frontmatter() {
  awk 'BEGIN{in_fm=0; seen=0}
       /^---[[:space:]]*$/ {
         if (seen==0) { in_fm=1; seen=1; next }
         else if (in_fm==1) { in_fm=0; exit }
       }
       in_fm==1 { print }' "$1"
}

# Helper: check if a frontmatter block has a given key.
fm_has_key() {
  local fm="$1" key="$2"
  printf "%s" "$fm" | grep -Eq "^${key}:[[:space:]]"
}

# Helper: get value of a frontmatter key (first match; trimmed).
fm_value() {
  local fm="$1" key="$2"
  printf "%s" "$fm" | grep -E "^${key}:[[:space:]]" | head -1 | sed -E "s/^${key}:[[:space:]]*//; s/[[:space:]]*$//"
}

while IFS= read -r f; do
  fname="$(basename "$f")"
  fm="$(extract_frontmatter "$f")"

  is_ic_pack=false
  if [ -n "$fm" ]; then
    if [ "$(fm_value "$fm" ic_pack)" = "true" ]; then
      is_ic_pack=true
    fi
  else
    # No frontmatter at all. If filename starts with gsd-, treat as malformed IC pack.
    case "$fname" in
      gsd-*) is_ic_pack=true ;;
    esac
  fi

  $is_ic_pack || continue

  # Required: frontmatter exists.
  if [ -z "$fm" ]; then
    vfail "$f: agent has no frontmatter"
    continue
  fi
  for key in name classification; do
    if ! fm_has_key "$fm" "$key"; then
      vfail "$f: frontmatter missing required key '$key'"
    fi
  done
  # Classification (if present) must be UNCLASSIFIED.
  cls="$(fm_value "$fm" classification)"
  if [ -n "$cls" ] && [ "$cls" != "UNCLASSIFIED" ]; then
    vfail "$f: classification must be UNCLASSIFIED (got '$cls')"
  fi
  # Completion marker: a line like `## SOMETHING COMPLETE` or `## SOMETHING BLOCKED/FOUND/FAILED`.
  if ! grep -Eq '^##[[:space:]]+[A-Z][A-Z0-9 _&-]*[[:space:]]+(COMPLETE|BLOCKED|FOUND|FAILED|UPDATE COMPLETE)$' "$f"; then
    vfail "$f: no completion marker line found (expected '## <NAME> COMPLETE' or BLOCKED/FOUND/FAILED variant)"
  fi
done < <(find "$AGENTS_DIR" -maxdepth 1 -type f -name "*.md" 2>/dev/null)

vexit
