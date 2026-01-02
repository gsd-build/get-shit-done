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
    if command -v jq &> /dev/null; then
        # Use jq for reliable JSON parsing
        QUEUE_ENABLED=$(jq -r '.queue.enabled // true' "$CONFIG_FILE" 2>/dev/null)
        if [[ "$QUEUE_ENABLED" == "false" ]]; then
            exit 0
        fi
    else
        # Fallback: basic grep check (less reliable)
        if grep -q '"queue"' "$CONFIG_FILE" && grep -q '"enabled"[[:space:]]*:[[:space:]]*false' "$CONFIG_FILE"; then
            exit 0
        fi
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
