#!/usr/bin/env bash
# validate-workflow-patches.sh — invoke tools/patch-workflows.sh in --check
# (dry-run) mode and propagate the exit code.

set -euo pipefail
source "$(dirname "$0")/_lib.sh"
VALIDATOR_NAME="validate-workflow-patches"

ROOT="${GSD_IC_ROOT_OVERRIDE:-$(gsd_ic_root)}"
SCRIPT="$ROOT/tools/patch-workflows.sh"

if [ ! -f "$SCRIPT" ]; then
  vfail "patch-workflows.sh missing at $SCRIPT"
  vexit
fi
if [ ! -x "$SCRIPT" ]; then
  vfail "patch-workflows.sh is not executable"
  vexit
fi

if "$SCRIPT" --check >/dev/null 2>&1 || "$SCRIPT" >/dev/null 2>&1; then
  vinfo "patch script ran cleanly"
else
  vfail "patch-workflows.sh exited non-zero (patches do not apply against upstream)"
fi

vexit
