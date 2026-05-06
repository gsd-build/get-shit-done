#!/usr/bin/env bash
# validate-skills.sh — every IC pack skill (named in IC_PACK_SKILLS below) must
# have a SKILL.md with classification: UNCLASSIFIED frontmatter and an
# ic_pack: true marker. Other skills in skills/ are upstream and ignored.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-skills"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
SKILLS_DIR="$ROOT/skills"

# IC pack skill names per spec §7.
IC_PACK_SKILLS=(
  intel-coding-conventions
  prototyping-discipline
  classification-conventions
  adelphi-house-style
)

extract_frontmatter() {
  awk 'BEGIN{in_fm=0; seen=0}
       /^---[[:space:]]*$/ {
         if (seen==0) { in_fm=1; seen=1; next }
         else if (in_fm==1) { in_fm=0; exit }
       }
       in_fm==1 { print }' "$1"
}
fm_value() {
  local fm="$1" key="$2"
  printf "%s" "$fm" | grep -E "^${key}:[[:space:]]" | head -1 | sed -E "s/^${key}:[[:space:]]*//; s/[[:space:]]*$//"
}

if [ ! -d "$SKILLS_DIR" ]; then
  vinfo "no skills/ directory — nothing to validate"
  vexit
fi

for skill in "${IC_PACK_SKILLS[@]}"; do
  dir="$SKILLS_DIR/$skill"
  [ -d "$dir" ] || continue   # not yet shipped — fine in Plan 0
  md="$dir/SKILL.md"
  if [ ! -f "$md" ]; then
    vfail "IC pack skill '$skill' directory exists but SKILL.md is missing"
    continue
  fi
  fm="$(extract_frontmatter "$md")"
  if [ -z "$fm" ]; then
    vfail "$md: skill missing frontmatter"
    continue
  fi
  cls="$(fm_value "$fm" classification)"
  if [ "$cls" != "UNCLASSIFIED" ]; then
    vfail "$md: classification must be UNCLASSIFIED (got '$cls')"
  fi
  ic="$(fm_value "$fm" ic_pack)"
  if [ "$ic" != "true" ]; then
    vfail "$md: missing 'ic_pack: true' frontmatter marker"
  fi
done

vexit
