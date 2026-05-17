#!/usr/bin/env bash
# gsd-graphify-rebuild.sh — detached rebuild runner for hooks/gsd-graphify-update.sh.
#
# Usage:
#   gsd-graphify-rebuild.sh <STATUS_FILE> <LOCK_FILE> <HEAD_SHA> <MS_START> <GRAPHIFY_BIN>
#
# Writes its own PID into LOCK_FILE on start, removes LOCK_FILE on exit (any cause),
# runs `graphify update .` from the project root (cwd inherited from caller), copies
# the produced graphify-out/* into .planning/graphs/, and rewrites STATUS_FILE to
# reflect the final status ("ok" if graphify exited 0, "failed" otherwise).
#
# Designed to be invoked via `setsid ... &` so it is reparented away from the hook
# caller and never blocks the user-facing tool call.

set -uo pipefail

STATUS_FILE="${1:?STATUS_FILE required}"
LOCK_FILE="${2:?LOCK_FILE required}"
HEAD_SHA="${3:?HEAD_SHA required}"
MS_START="${4:?MS_START required}"
GRAPHIFY_BIN="${5:?GRAPHIFY_BIN required}"

# Atomic-ish lock acquire: write our PID and trap cleanup
echo "$$" > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

"$GRAPHIFY_BIN" update . >/dev/null 2>&1
EXIT_CODE=$?

# Copy outputs only on success — failure path preserves the prior valid graph.
if [ "$EXIT_CODE" -eq 0 ] && [ -f graphify-out/graph.json ]; then
  cp graphify-out/graph.json .planning/graphs/graph.json
  cp graphify-out/graph.html .planning/graphs/graph.html 2>/dev/null || true
  cp graphify-out/GRAPH_REPORT.md .planning/graphs/GRAPH_REPORT.md 2>/dev/null || true
  cp .planning/graphs/graph.json .planning/graphs/.last-build-snapshot.json 2>/dev/null || true
fi

# Compute duration in ms
MS_END=$(node -e 'process.stdout.write(String(Date.now()))' 2>/dev/null || echo "$MS_START")
DURATION=$((MS_END - MS_START))

STATUS_NAME="ok"
[ "$EXIT_CODE" -eq 0 ] || STATUS_NAME="failed"

TS_END=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "")

# Write the final status file. Use Node for safe JSON encoding.
GSD_STATUS_TS="$TS_END" \
GSD_STATUS_NAME="$STATUS_NAME" \
GSD_EXIT_CODE="$EXIT_CODE" \
GSD_DURATION="$DURATION" \
GSD_HEAD_SHA="$HEAD_SHA" \
GSD_STATUS_FILE="$STATUS_FILE" \
node -e '
  const fs = require("node:fs");
  const status = {
    ts: process.env.GSD_STATUS_TS,
    status: process.env.GSD_STATUS_NAME,
    exit_code: parseInt(process.env.GSD_EXIT_CODE, 10),
    duration_ms: parseInt(process.env.GSD_DURATION, 10),
    head_at_build: process.env.GSD_HEAD_SHA,
    graphify_version: null,
  };
  fs.writeFileSync(process.env.GSD_STATUS_FILE, JSON.stringify(status, null, 2) + "\n");
' 2>/dev/null || true
