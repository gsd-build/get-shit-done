#!/bin/bash
#
# gsd-autonomous-parse.sh - Helper script for /gsd-autonomous command
# Parses arguments, extracts phase ranges, manages execution flow

# Initialize defaults
PHASE=""
FROM_PHASE=""
TO_PHASE=""
MAX_ITERATIONS=""
USER_TASK=""

# Default: loop until complete (no limit)
# Only set MAX_ITERATIONS if -N or --max-iterations is specified

# Default guidance (used if no user task provided)
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
    --max-iterations=*) MAX_ITERATIONS="${arg#*=}" ;;
    -N=*) MAX_ITERATIONS="${arg#*=}" ;;
    -N) ;; # Handle -N without = (next arg will be the value)
    --*) ;; # Unknown flag, skip
    *) USER_TASK="$USER_TASK $arg" ;; # Accumulate user task
  esac
done

# Handle -N without = (look for number in next position)
# This is a simplified approach - the main loop handles it via -N= format

# Trim user task
USER_TASK=$(echo "$USER_TASK" | sed 's/^ *//;s/ *$//')

# Apply default guidance if no user task provided
if [ -z "$USER_TASK" ]; then
  USER_TASK="$DEFAULT_GUIDANCE"
fi

# Try to extract phase range from prose if not specified via flags
# Patterns: "phases X to Y", "phase X through Y", "phases X-Y", "phases X and Y"
if [ -z "$FROM_PHASE" ] && [ -z "$PHASE" ]; then
  # Check for "phases X to Y" or "phase X to Y"
  PHASE_RANGE=$(echo "$USER_TASK" | grep -oiE 'phases? ([0-9]+) to ([0-9]+)' | head -1)
  if [ -n "$PHASE_RANGE" ]; then
    FROM_PHASE=$(echo "$PHASE_RANGE" | grep -oE '[0-9]+' | head -1)
    TO_PHASE=$(echo "$PHASE_RANGE" | grep -oE '[0-9]+' | tail -1)
  fi
fi

if [ -z "$FROM_PHASE" ] && [ -z "$PHASE" ]; then
  # Check for "phases X through Y"
  PHASE_RANGE=$(echo "$USER_TASK" | grep -oiE 'phases? ([0-9]+) through ([0-9]+)' | head -1)
  if [ -n "$PHASE_RANGE" ]; then
    FROM_PHASE=$(echo "$PHASE_RANGE" | grep -oE '[0-9]+' | head -1)
    TO_PHASE=$(echo "$PHASE_RANGE" | grep -oE '[0-9]+' | tail -1)
  fi
fi

if [ -z "$FROM_PHASE" ] && [ -z "$PHASE" ]; then
  # Check for "phases X-Y" (with hyphen)
  PHASE_RANGE=$(echo "$USER_TASK" | grep -oiE 'phases? ([0-9]+)-([0-9]+)' | head -1)
  if [ -n "$PHASE_RANGE" ]; then
    FROM_PHASE=$(echo "$PHASE_RANGE" | grep -oE '[0-9]+' | head -1)
    TO_PHASE=$(echo "$PHASE_RANGE" | grep -oE '[0-9]+' | tail -1)
  fi
fi

# Determine mode
if [ -n "$PHASE" ] || [ -n "$FROM_PHASE" ]; then
  # Phase-based mode
  if [ -n "$PHASE" ]; then
    FROM_PHASE="$PHASE"
    TO_PHASE="$PHASE"
  elif [ -z "$TO_PHASE" ]; then
    TO_PHASE="$FROM_PHASE"
  fi
  echo "MODE: phase"
  echo "FROM: $FROM_PHASE"
  echo "TO: $TO_PHASE"
else
  # Ad-hoc mode (default)
  echo "MODE: ad-hoc"
  echo "TASK: $USER_TASK"
fi

# Output iteration limit (empty = loop forever)
if [ -n "$MAX_ITERATIONS" ]; then
  echo "MAX_ITERATIONS: $MAX_ITERATIONS"
else
  echo "MAX_ITERATIONS: unlimited"
fi

echo "UNTIL_COMPLETE: true"
echo "USER_TASK: $USER_TASK"
echo "GSD_INSTALLED: $GSD_INSTALLED"
echo "PLANNING_EXISTS: $PLANNING_EXISTS"
echo "ROADMAP_EXISTS: $ROADMAP_EXISTS"
echo "STATE_EXISTS: $STATE_EXISTS"
