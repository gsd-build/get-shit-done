#!/usr/bin/env bash
# patch-workflows.sh — apply IC pack workflow gate-hook patches to a target's
# stock GSD workflow files.
#
# Usage:
#   tools/patch-workflows.sh [<root>]            apply patches
#   tools/patch-workflows.sh --check [<root>]    dry-run, exit 0 if all apply
#   tools/patch-workflows.sh --revert [<root>]   revert applied patches
#
# In Plan 0 there are no patches; all modes are no-ops. Phase plans (1+) extend
# this script with concrete patch operations targeting:
#   - get-shit-done/workflows/new-project.md
#   - get-shit-done/workflows/discuss-phase.md
#   - get-shit-done/workflows/plan-phase.md
#   - get-shit-done/workflows/execute-phase.md
#   - get-shit-done/workflows/verify-work.md
#   - get-shit-done/workflows/secure-phase.md
#   - get-shit-done/workflows/audit-milestone.md
# (Per spec §9.3, each gate-hook insertion is one conditional `Skill(...)`
# call. Patches must keep validate-seamless-fork.sh happy.)

set -euo pipefail

mode="apply"
target_root="${PWD}"

while [ $# -gt 0 ]; do
  case "$1" in
    --check)  mode="check"; shift ;;
    --revert) mode="revert"; shift ;;
    --help|-h) sed -n '2,18p' "$0"; exit 0 ;;
    --) shift; break ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) target_root="$1"; shift ;;
  esac
done

# Plan 0: no patches defined. Always exit 0.
patches_dir="$(cd "$(dirname "$0")/../workflow-patches" 2>/dev/null && pwd)" || patches_dir=""
if [ -z "$patches_dir" ] || [ -z "$(ls -A "$patches_dir" 2>/dev/null | grep -v '^\.gitkeep$' || true)" ]; then
  case "$mode" in
    check)  echo "[patch-workflows] no patches defined (Plan 0 stub)"; exit 0 ;;
    revert) echo "[patch-workflows] no patches to revert"; exit 0 ;;
    apply)  echo "[patch-workflows] no patches to apply (Plan 0 stub)"; exit 0 ;;
  esac
fi

# Phase 1+ extension point: iterate $patches_dir/*.patch and apply.
echo "[patch-workflows] would process: $(ls "$patches_dir")"
exit 0
