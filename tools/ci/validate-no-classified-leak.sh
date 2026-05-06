#!/usr/bin/env bash
# validate-no-classified-leak.sh — grep the repo for IC classified compartment
# markings. ANY hit fails the build.
#
# Patterns (uppercase, "//" delimiter is the IC convention for portion marking):
#   S//        SECRET
#   TS//       TOP SECRET
#   SI//       Special Intelligence (SIGINT)
#   TK//       Talent Keyhole (IMINT/SIGINT)
#   HCS        HUMINT Control System
#   ORCON      Originator Controlled
#   NOFORN     No Foreign Nationals (often appears with markings)
#
# Exclusions: .git/, node_modules/, the validator scripts and their pattern
# strings (self-references), test fixtures dir, the design spec which discusses
# the patterns, and this script itself (case-insensitive name match).

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-no-classified-leak"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"

# Patterns to detect (PCRE). Anchored on uppercase letters + // delimiter where
# applicable; HCS/ORCON/NOFORN are word-boundary matched.
PATTERNS=(
  '\bS//[A-Z]'
  '\bTS//[A-Z]'
  '\bSI//[A-Z]'
  '\bTK//[A-Z]'
  '\bHCS-?[OP]?//'
  '\bORCON\b'
  '\bNOFORN\b'
)

# Excluded paths (relative to ROOT).
EXCLUDES=(
  '.git'
  'node_modules'
  'tools/ci/validate-no-classified-leak.sh'
  'tools/ci/tests/validate-no-classified-leak.test.sh'
  'tools/ci/tests/fixtures'
  'docs/specs'
  'docs/superpowers'
  'docs/plans'
)

# Build a `find` exclusion clause.
prune_args=()
for ex in "${EXCLUDES[@]}"; do
  prune_args+=( -path "$ROOT/$ex" -prune -o )
done

found=0
while IFS= read -r f; do
  for p in "${PATTERNS[@]}"; do
    if grep -E -l "$p" "$f" >/dev/null 2>&1; then
      hit_line="$(grep -nE "$p" "$f" | head -1)"
      vfail "classified marking detected in $f: $hit_line"
      found=$((found+1))
      break  # one hit per file is enough
    fi
  done
done < <(find "$ROOT" "${prune_args[@]}" -type f \( -name "*.md" -o -name "*.js" -o -name "*.cjs" -o -name "*.ts" -o -name "*.json" -o -name "*.sh" -o -name "*.yml" -o -name "*.yaml" -o -name "*.txt" \) -print 2>/dev/null)

if [ "$found" -eq 0 ]; then
  vinfo "scanned repo, no classified markings detected"
fi
vexit
