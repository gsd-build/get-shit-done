#!/usr/bin/env bash
# validate-seamless-fork.sh — verify that workflow patches, when applied, only
# *add* lines that are semantically inert when gates/hooks are disabled.
#
# Algorithm:
#   1. Snapshot stock workflow files to a temp dir.
#   2. Run tools/patch-workflows.sh against a clone of the workflow tree.
#   3. Diff snapshot vs. patched.
#   4. Every diff hunk must be an INSERTION (no deletions/modifications), and
#      every inserted line must match an "inert" pattern: an HTML comment, an
#      explicit `if config.intel_gates.<name>.enabled then ...` guard, or a
#      blank line.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-seamless-fork"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
SCRIPT="$ROOT/tools/patch-workflows.sh"
WF_DIR="$ROOT/get-shit-done/workflows"

if [ ! -d "$WF_DIR" ]; then
  vinfo "no workflows directory at $WF_DIR — nothing to validate"
  vexit
fi
if [ ! -x "$SCRIPT" ]; then
  vfail "patch-workflows.sh missing or not executable"
  vexit
fi

stock_snapshot="$(mktemp -d)"
patched_snapshot="$(mktemp -d)"
trap 'rm -rf "$stock_snapshot" "$patched_snapshot"' EXIT

cp -r "$WF_DIR"/. "$stock_snapshot"/
cp -r "$WF_DIR"/. "$patched_snapshot"/

# Run the patch script against patched_snapshot. The script signature: takes a
# repo-root-equivalent path as $1 and patches $1/get-shit-done/workflows/*.md.
# We construct a fake root that mirrors the layout.
fake_root="$(mktemp -d)"
mkdir -p "$fake_root/get-shit-done/workflows"
cp -r "$patched_snapshot"/. "$fake_root/get-shit-done/workflows"/
"$SCRIPT" "$fake_root" >/dev/null 2>&1 || true

# Diff each file.
inert_re='^(<!--|[[:space:]]*$|.*if config\.intel_gates\.[A-Za-z0-9_-]+\.enabled.*Skill\(.*\).*$)'
placeholder_re='.*\{\{[A-Za-z0-9_-]+\}\}.*'

violations=0
for f in "$stock_snapshot"/*.md; do
  base="$(basename "$f")"
  patched="$fake_root/get-shit-done/workflows/$base"
  [ -f "$patched" ] || continue
  while IFS= read -r line; do
    case "$line" in
      "<"*) ;;        # diff header lines (---, +++, @@) etc. handled by leading char filter
    esac
    case "$line" in
      "+"*)
        body="${line#+}"
        # Skip diff metadata (+++ filename).
        case "$body" in "++"*) continue ;; esac
        if ! [[ "$body" =~ $inert_re ]]; then
          vfail "$base: non-inert insertion '$body'"
          violations=$((violations+1))
        fi
        ;;
      "-"*)
        body="${line#-}"
        case "$body" in "--"*) continue ;; esac   # diff metadata
        # Allow deletion of placeholder lines (will be replaced with inert content).
        if ! [[ "$body" =~ $placeholder_re ]]; then
          vfail "$base: stock line removed: '$body'"
          violations=$((violations+1))
        fi
        ;;
    esac
  done < <(diff -u "$f" "$patched" 2>/dev/null || true)
done

if [ "$violations" -eq 0 ]; then
  vinfo "all patches are semantically inert with gates off"
fi
vexit
