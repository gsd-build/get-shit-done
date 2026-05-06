#!/usr/bin/env bash
# validate-completion-markers.sh — every IC pack agent's completion marker
# (any line of the form `## <NAME> COMPLETE` etc.) must appear verbatim
# somewhere in references/agent-contracts.ic-pack.md.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-completion-markers"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
AGENTS_DIR="$ROOT/agents"
REGISTRY="$ROOT/references/agent-contracts.ic-pack.md"

if [ ! -d "$AGENTS_DIR" ]; then
  vinfo "no agents/ directory — nothing to validate"
  vexit
fi

extract_frontmatter() {
  awk 'BEGIN{in_fm=0; seen=0}
       /^---[[:space:]]*$/ { if (seen==0) {in_fm=1; seen=1; next} else if (in_fm==1) {in_fm=0; exit} }
       in_fm==1 { print }' "$1"
}
fm_value() {
  printf "%s" "$1" | grep -E "^$2:[[:space:]]" | head -1 | sed -E "s/^$2:[[:space:]]*//; s/[[:space:]]*$//"
}

# Collect IC pack agents.
ic_agents=()
while IFS= read -r f; do
  fm="$(extract_frontmatter "$f")"
  [ -n "$fm" ] || continue
  if [ "$(fm_value "$fm" ic_pack)" = "true" ]; then
    ic_agents+=("$f")
  fi
done < <(find "$AGENTS_DIR" -maxdepth 1 -type f -name "*.md" 2>/dev/null)

if [ "${#ic_agents[@]}" -eq 0 ]; then
  vinfo "no IC pack agents — nothing to validate"
  vexit
fi

# Registry must exist if we have any IC pack agents.
if [ ! -f "$REGISTRY" ]; then
  vfail "registry file missing: $REGISTRY (required when IC pack agents exist)"
  vexit
fi

registry_content="$(cat "$REGISTRY")"

for agent in "${ic_agents[@]}"; do
  while IFS= read -r marker_line; do
    [ -n "$marker_line" ] || continue
    # Strip leading "## " for matching but search for the literal marker
    # (the registry rows include "## X COMPLETE" verbatim).
    if ! printf "%s" "$registry_content" | grep -qF "$marker_line"; then
      vfail "$agent: completion marker '$marker_line' not found in $REGISTRY"
    fi
  done < <(grep -E '^##[[:space:]]+[A-Z][A-Z0-9 _&-]*[[:space:]]+(COMPLETE|BLOCKED|FOUND|FAILED|UPDATE COMPLETE)$' "$agent" || true)
done

vexit
