#!/usr/bin/env bash
# gsd-hook-version: {{GSD_VERSION}}
# gsd-graphify-update.sh — PostToolUse hook (Bash matcher) that auto-rebuilds
# the project knowledge graph after main HEAD advances on the default branch.
#
# OPT-IN (issue #3347 AC): no-op unless .planning/config.json has BOTH
#   graphify.enabled: true
#   graphify.auto_update: true
# graphify.auto_update defaults to false so existing users see no behavior change.
#
# Gates (in fast-fail order — each shaves work off the common non-dispatch path):
#   1. Stdin payload present and tool_name == "Bash"
#   2. tool_input.command matches a HEAD-advancing git op
#   3. $CI is unset/empty
#   4. Inside a git repo
#   5. Current branch == default branch (git.base_branch override, else main/master/trunk)
#   6. .planning/config.json sets graphify.enabled=true AND graphify.auto_update=true
#   7. graphify binary on PATH
#   8. No rebuild already in flight (PID lock — kill -0 check, stale-tolerant)
#
# When all gates pass:
#   - Writes .planning/graphs/.last-build-status.json with status="running"
#   - Detaches hooks/lib/gsd-graphify-rebuild.sh which copies graphify-out/* to
#     .planning/graphs/ and rewrites the status file with status="ok"|"failed"
#
# Returns 0 in all cases. Never blocks the user-facing tool call.

set -uo pipefail

# Gate 1 — tool_name == Bash; extract command
INPUT=$(cat 2>/dev/null || true)
[ -n "$INPUT" ] || exit 0

TOOL_INFO=$(printf '%s' "$INPUT" | node -e '
let d = "";
process.stdin.on("data", c => d += c);
process.stdin.on("end", () => {
  try {
    const p = JSON.parse(d);
    process.stdout.write((p.tool_name || "") + "\n" + (p.tool_input?.command || ""));
  } catch { process.stdout.write("\n"); }
});
' 2>/dev/null || printf '\n')
TOOL_NAME=$(printf '%s\n' "$TOOL_INFO" | sed -n '1p')
COMMAND=$(printf '%s\n' "$TOOL_INFO" | sed -n '2p')

[ "$TOOL_NAME" = "Bash" ] || exit 0

# Gate 2 — HEAD-advancing git op
case "$COMMAND" in
  *"git commit"*|*"git merge"*|*"git pull"*|*"git rebase --continue"*|*"git cherry-pick"*) ;;
  *) exit 0 ;;
esac

# Gate 3 — not CI
[ -z "${CI:-}" ] || exit 0

# Gate 4 — inside git repo
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# Gate 5 — current branch == default branch
DEFAULT_BRANCH=""
if [ -f .planning/config.json ]; then
  DEFAULT_BRANCH=$(node -e '
try {
  const c = require("./.planning/config.json");
  process.stdout.write(c.git?.base_branch || "");
} catch { process.stdout.write(""); }
' 2>/dev/null || echo "")
fi
if [ -z "$DEFAULT_BRANCH" ]; then
  for cand in main master trunk; do
    if git rev-parse --verify "$cand" >/dev/null 2>&1; then
      DEFAULT_BRANCH="$cand"
      break
    fi
  done
fi
[ -n "$DEFAULT_BRANCH" ] || exit 0

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[ "$CURRENT_BRANCH" = "$DEFAULT_BRANCH" ] || exit 0

# Gate 6 — both graphify gates true in config
[ -f .planning/config.json ] || exit 0
GATES=$(node -e '
try {
  const c = require("./.planning/config.json");
  const ok = c.graphify?.enabled === true && c.graphify?.auto_update === true;
  process.stdout.write(ok ? "1" : "0");
} catch { process.stdout.write("0"); }
' 2>/dev/null || echo "0")
[ "$GATES" = "1" ] || exit 0

# Gate 7 — graphify on PATH
GRAPHIFY_BIN=$(command -v graphify 2>/dev/null || true)
[ -n "$GRAPHIFY_BIN" ] || exit 0

# Gate 8 — no live rebuild in flight
mkdir -p .planning/graphs
LOCK_FILE=".planning/graphs/.rebuild.lock"
if [ -f "$LOCK_FILE" ]; then
  PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    exit 0
  fi
fi

# All gates passed. Write initial running status synchronously so observers
# (the next planner load_graph_context step) see the in-flight signal.
HEAD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
STATUS_FILE=".planning/graphs/.last-build-status.json"
TS_START=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "")
MS_START=$(node -e 'process.stdout.write(String(Date.now()))' 2>/dev/null || echo "0")

GSD_TS="$TS_START" \
GSD_HEAD="$HEAD_SHA" \
GSD_STATUS_FILE="$STATUS_FILE" \
node -e '
  const fs = require("node:fs");
  const status = {
    ts: process.env.GSD_TS,
    status: "running",
    exit_code: null,
    duration_ms: null,
    head_at_build: process.env.GSD_HEAD,
    graphify_version: null,
  };
  fs.writeFileSync(process.env.GSD_STATUS_FILE, JSON.stringify(status, null, 2) + "\n");
' 2>/dev/null || true

# Resolve rebuild helper script (sibling-relative for portability across install layouts)
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
REBUILD_SCRIPT="$HOOK_DIR/lib/gsd-graphify-rebuild.sh"
[ -f "$REBUILD_SCRIPT" ] || exit 0

# Detach the rebuild. Spawn as a regular background job so we can capture
# its PID via $! and write it to the lock file synchronously here in the
# parent. This eliminates a startup race where a caller (e.g. test cleanup)
# observing an absent lock could not distinguish "subprocess finished" from
# "subprocess hasn't started yet." With the lock written before this hook
# returns, lock-presence is a reliable in-flight signal.
bash "$REBUILD_SCRIPT" \
  "$STATUS_FILE" \
  "$LOCK_FILE" \
  "$HEAD_SHA" \
  "$MS_START" \
  "$GRAPHIFY_BIN" \
  </dev/null >/dev/null 2>&1 &
REBUILD_PID=$!
echo "$REBUILD_PID" > "$LOCK_FILE"
disown "$REBUILD_PID" 2>/dev/null || true

exit 0
