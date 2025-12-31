#!/bin/bash
# GSD Auto-Continue: Project-scoped queue injection
#
# Reads from queue on SessionStart and injects as context.
# Checks project-scoped queue first, then falls back to global.
#
# Queue location priority:
#   1. .planning/queue.json (project-scoped)
#   2. ~/.claude/queue.json (global fallback)

set -e

# Check project-scoped queue first
PROJECT_QUEUE=".planning/queue.json"
GLOBAL_QUEUE="$HOME/.claude/queue.json"

QUEUE_FILE=""
QUEUE_TYPE=""

if [[ -f "$PROJECT_QUEUE" ]]; then
    QUEUE_FILE="$PROJECT_QUEUE"
    QUEUE_TYPE="project"
elif [[ -f "$GLOBAL_QUEUE" ]]; then
    QUEUE_FILE="$GLOBAL_QUEUE"
    QUEUE_TYPE="global"
fi

# If no queue found, exit silently (normal case)
if [[ -z "$QUEUE_FILE" ]]; then
    exit 0
fi

# Read the queue
QUEUE_CONTENT=$(cat "$QUEUE_FILE")

# Extract the command from JSON
# Handles both simple string format and JSON object format
if echo "$QUEUE_CONTENT" | grep -q '"command"'; then
    # JSON object format: {"command": "...", ...}
    TASK=$(echo "$QUEUE_CONTENT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"command"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
else
    # Simple string format (legacy compatibility)
    TASK="$QUEUE_CONTENT"
fi

# Output JSON for Claude Code - inject task as additionalContext
# Using jq for proper JSON escaping
if command -v jq &> /dev/null; then
    jq -n --arg task "$TASK" --arg type "$QUEUE_TYPE" '{
        hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: ("GSD AUTO-CONTINUE (" + $type + " queue)\n\nEXECUTE THIS COMMAND IMMEDIATELY:\n" + $task + "\n\nDo not ask for confirmation. Run the command now.")
        }
    }'
else
    # Fallback without jq (less safe but functional)
    cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "GSD AUTO-CONTINUE ($QUEUE_TYPE queue)\n\nEXECUTE THIS COMMAND IMMEDIATELY:\n$TASK\n\nDo not ask for confirmation. Run the command now."
  }
}
EOF
fi

# Cleanup - remove queue so it doesn't run again
rm "$QUEUE_FILE"

# Log for debugging
LOG_FILE="$HOME/.claude/hooks/gsd-queue.log"
if [[ -d "$(dirname "$LOG_FILE")" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Executed from $QUEUE_TYPE queue: $TASK" >> "$LOG_FILE"
fi
