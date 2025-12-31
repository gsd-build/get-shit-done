#!/bin/bash
# GSD Queue Helper - Writes next command to project-scoped queue
# Called by GSD workflows at transition points
#
# Usage: queue-next.sh "<command>"
# Example: queue-next.sh "/gsd:execute-plan .planning/phases/01-foundation/01-02-PLAN.md"
#
# Queue location priority:
#   1. .planning/queue.json (project-scoped, preferred)
#   2. Falls back to ~/.claude/queue.json if .planning/ doesn't exist

set -e

COMMAND="$1"

if [[ -z "$COMMAND" ]]; then
    echo "Usage: queue-next.sh '<command>'" >&2
    exit 1
fi

# Check if queue is enabled in config
CONFIG_FILE=".planning/config.json"
if [[ -f "$CONFIG_FILE" ]]; then
    # Check if queue.enabled is explicitly false
    QUEUE_ENABLED=$(cat "$CONFIG_FILE" | grep -o '"enabled"[[:space:]]*:[[:space:]]*false' || true)
    if [[ -n "$QUEUE_ENABLED" ]]; then
        # Queue explicitly disabled
        exit 0
    fi
fi

# Determine queue location
if [[ -d ".planning" ]]; then
    QUEUE_FILE=".planning/queue.json"
else
    QUEUE_FILE="$HOME/.claude/queue.json"
fi

# Write the command to queue
# Format: JSON with command and metadata
cat > "$QUEUE_FILE" << EOF
{
  "command": "$COMMAND",
  "queued_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "project": "$(basename "$(pwd)")",
  "cwd": "$(pwd)"
}
EOF

# Log for debugging (optional)
LOG_FILE="$HOME/.claude/hooks/gsd-queue.log"
if [[ -d "$(dirname "$LOG_FILE")" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Queued: $COMMAND (project: $(basename "$(pwd)"))" >> "$LOG_FILE"
fi
