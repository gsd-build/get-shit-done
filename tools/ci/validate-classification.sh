#!/usr/bin/env bash
# validate-classification.sh — every Markdown reference doc under intel-refs/
# and config-overlays/ must explicitly declare classification UNCLASSIFIED.
# Declaration accepted in any of:
#   - YAML frontmatter `classification: UNCLASSIFIED`
#   - HTML comment first-line `<!-- CLASSIFICATION: UNCLASSIFIED -->`
#   - source comment first-line `# CLASSIFICATION: UNCLASSIFIED` (for non-MD)

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-classification"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"

scan_paths=()
[ -d "$ROOT/intel-refs" ] && scan_paths+=("$ROOT/intel-refs")
[ -d "$ROOT/config-overlays" ] && scan_paths+=("$ROOT/config-overlays")

if [ "${#scan_paths[@]}" -eq 0 ]; then
  vinfo "no intel-refs/ or config-overlays/ directories — nothing to validate"
  vexit
fi

# Find all .md files; skip skeleton placeholder docs.
while IFS= read -r f; do
  # .gitkeep, README.md (catalog onboarding doc) are exempt.
  base="$(basename "$f")"
  case "$base" in
    .gitkeep|README.md) continue ;;
  esac

  # Look for a classification declaration in the first 10 lines.
  head_block="$(head -10 "$f" 2>/dev/null || true)"
  declared=""
  if printf "%s" "$head_block" | grep -Eq '^classification:[[:space:]]*'; then
    declared="$(printf "%s" "$head_block" | grep -E '^classification:' | head -1 | sed -E 's/^classification:[[:space:]]*//; s/[[:space:]]*$//')"
  elif printf "%s" "$head_block" | grep -Eq '<!--[[:space:]]*CLASSIFICATION:'; then
    declared="$(printf "%s" "$head_block" | grep -E '<!--[[:space:]]*CLASSIFICATION:' | head -1 | sed -E 's/.*CLASSIFICATION:[[:space:]]*//; s/[[:space:]]*-->.*//')"
  elif printf "%s" "$head_block" | grep -Eq '^#[[:space:]]*CLASSIFICATION:'; then
    declared="$(printf "%s" "$head_block" | grep -E '^#[[:space:]]*CLASSIFICATION:' | head -1 | sed -E 's/^#[[:space:]]*CLASSIFICATION:[[:space:]]*//')"
  fi

  if [ -z "$declared" ]; then
    vfail "no classification declared in $f"
    continue
  fi

  if [ "$declared" != "UNCLASSIFIED" ]; then
    vfail "non-UNCLASSIFIED classification '$declared' in $f"
  fi
done < <(find "${scan_paths[@]}" -type f -name "*.md" 2>/dev/null)

vexit
