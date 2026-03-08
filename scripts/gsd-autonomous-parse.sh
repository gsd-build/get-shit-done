#!/bin/bash
#
# gsd-autonomous-parse.sh - Helper script for /gsd-autonomous command
# Parses arguments, manages phase execution flow, injects default behaviors

# Initialize defaults
PHASE=""
FROM_PHASE=""
TO_PHASE=""
AD_HOC=false
RESEARCH_FIRST=false
MAX_ITERATIONS=5
UNTIL_COMPLETE=false
USER_TASK=""

# Default behaviors (user can override with explicit guidance)
DEFAULT_GUIDANCE="Use TDD approach when possible. Spawn subagents in parallel aggressively. Verify thoroughly."

# Detect GSD installation and planning files
GSD_INSTALLED=false
PLANNING_EXISTS=false
ROADMAP_EXISTS=false
STATE_EXISTS=false

# Check for GSD installation
if [ -d "$HOME/.config/opencode/get-shit-done" ] || [ -d "$HOME/.claude/get-shit-done" ]; then
  GSD_INSTALLED=true
fi

# Check for planning directory structure
if [ -d ".planning" ]; then
  PLANNING_EXISTS=true
  [ -f ".planning/ROADMAP.md" ] && ROADMAP_EXISTS=true
  [ -f ".planning/STATE.md" ] && STATE_EXISTS=true
fi

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --phase=*) PHASE="${arg#*=}" ;;
    --from=*) FROM_PHASE="${arg#*=}" ;;
    --to=*) TO_PHASE="${arg#*=}" ;;
    --ad-hoc) AD_HOC=true ;;
    --research-first) RESEARCH_FIRST=true ;;
    --max-iterations=*) MAX_ITERATIONS="${arg#*=}" ;;
    --until-complete) UNTIL_COMPLETE=true ;;
    --*) ;; # Unknown flag, skip
    *) USER_TASK="$USER_TASK $arg" ;; # Accumulate user task
  esac
done

# Trim user task
USER_TASK=$(echo "$USER_TASK" | sed 's/^ *//;s/ *$//')

# Apply default behaviors if no user guidance provided
if [ -z "$USER_TASK" ]; then
  USER_TASK="$DEFAULT_GUIDANCE"
fi

# For ad-hoc mode, default to --until-complete if not specified
if [ "$AD_HOC" = true ] && [ "$UNTIL_COMPLETE" = false ]; then
  # Check if user explicitly said not to loop forever
  if [[ "$USER_TASK" != *"--no-loop"* ]] && [[ "$USER_TASK" != *"single pass"* ]]; then
    UNTIL_COMPLETE=true
  fi
fi

# Determine mode and phase range
if [ "$AD_HOC" = true ]; then
  echo "MODE: ad-hoc"
  echo "TASK: $USER_TASK"
else
  # Phase-based mode
  if [ -n "$PHASE" ]; then
    FROM_PHASE="$PHASE"
    TO_PHASE="$PHASE"
  elif [ -z "$FROM_PHASE" ]; then
    # Get current phase from STATE.md
    FROM_PHASE=$(grep -E "Current Phase:|phase:" .planning/STATE.md 2>/dev/null | head -1 | grep -oE '[0-9]+' | head -1)
    FROM_PHASE=${FROM_PHASE:-1}
    TO_PHASE=${TO_PHASE:-999}
  fi
  echo "MODE: phase"
  echo "FROM: $FROM_PHASE"
  echo "TO: $TO_PHASE"
fi

echo "MAX_ITERATIONS: $MAX_ITERATIONS"
echo "UNTIL_COMPLETE: $UNTIL_COMPLETE"
echo "USER_TASK: $USER_TASK"
echo "GSD_INSTALLED: $GSD_INSTALLED"
echo "PLANNING_EXISTS: $PLANNING_EXISTS"
echo "ROADMAP_EXISTS: $ROADMAP_EXISTS"
echo "STATE_EXISTS: $STATE_EXISTS"
echo "DEFAULT_GUIDANCE: $DEFAULT_GUIDANCE"
