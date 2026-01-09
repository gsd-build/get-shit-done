---
name: gsd:autopilot
description: Run autonomous build loop - plans and executes all phases without intervention
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

<objective>
Run the entire GSD workflow autonomously. Plans each phase, executes it, and moves to the next until the milestone is complete.

For yolo-mode users who don't want to babysit the loop.
</objective>

<process>

<step name="verify">
**Verify project exists:**

```bash
[ -f .planning/ROADMAP.md ] || { echo "ERROR: No ROADMAP.md found. Run /gsd:new-project and /gsd:create-roadmap first."; exit 1; }
```

If no roadmap exists, exit with error message.
</step>

<step name="check_config">
**Check if yolo mode (recommended but not required):**

```bash
cat .planning/config.json 2>/dev/null | grep -q '"mode": "yolo"' && echo "YOLO_MODE" || echo "INTERACTIVE_MODE"
```

If INTERACTIVE_MODE, warn:
```
Note: You're in interactive mode. Autopilot works best with yolo mode.
Consider updating .planning/config.json to set "mode": "yolo"
Continuing anyway...
```
</step>

<step name="create_runner">
**Create the autonomous runner script if it doesn't exist:**

```bash
[ -f ./run-gsd.sh ] && echo "Runner exists" || cat > ./run-gsd.sh << 'SCRIPT'
#!/bin/bash
# GSD Autopilot - follows Claude's suggestions autonomously
# Created by /gsd:autopilot

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

LOG_FILE=".planning/build.log"
TEMP_OUTPUT=$(mktemp)

log() {
    echo "$1" | tee -a "$LOG_FILE"
}

log "=== GSD Autopilot ==="
log "Project: $PROJECT_DIR"
log "Started: $(date)"
log ""

# Start with progress check, or use provided command
NEXT_CMD="${1:-/gsd:progress}"

while true; do
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "Running: $NEXT_CMD"
    log "Time: $(date)"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Run the command, capture output
    if ! claude --dangerously-skip-permissions -p "$NEXT_CMD" 2>&1 | tee -a "$LOG_FILE" > "$TEMP_OUTPUT"; then
        log "!!! Command failed. Check log for details."
        log "Resume with: ./run-gsd.sh \"$NEXT_CMD\""
        rm -f "$TEMP_OUTPUT"
        exit 1
    fi

    # Extract next suggested command (first backtick-wrapped /gsd: command)
    NEXT_CMD=$(grep -oE '`/gsd:[^`]+`' "$TEMP_OUTPUT" | head -1 | tr -d '`')

    if [ -z "$NEXT_CMD" ]; then
        log ""
        log "=== BUILD COMPLETE ==="
        log "No more /gsd: commands found."
        log "Finished: $(date)"
        break
    fi

    # Skip /clear suggestions (not needed in -p mode)
    if [[ "$NEXT_CMD" == *"clear"* ]]; then
        NEXT_CMD=$(grep -oE '`/gsd:[^`]+`' "$TEMP_OUTPUT" | grep -v clear | head -1 | tr -d '`')
        [ -z "$NEXT_CMD" ] && break
    fi

    # Stop after complete-milestone (natural end point)
    if [[ "$NEXT_CMD" == *"complete-milestone"* ]]; then
        log ""
        log ">>> Running final command: $NEXT_CMD"
        claude --dangerously-skip-permissions -p "$NEXT_CMD" 2>&1 | tee -a "$LOG_FILE"
        log ""
        log "=== MILESTONE COMPLETE ==="
        log "Finished: $(date)"
        break
    fi

    log ">>> Next: $NEXT_CMD"
    log ""
done

rm -f "$TEMP_OUTPUT"
SCRIPT
chmod +x ./run-gsd.sh
echo "Created run-gsd.sh"
```
</step>

<step name="launch">
**Launch autopilot in background:**

```bash
nohup ./run-gsd.sh > .planning/autopilot-output.log 2>&1 &
AUTOPILOT_PID=$!
echo "Autopilot PID: $AUTOPILOT_PID"
```

**Report to user:**

```
Autopilot is running in background (PID: [pid]).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Monitor progress:
  tail -f .planning/build.log

Check if running:
  ps aux | grep run-gsd

Stop autopilot:
  pkill -f run-gsd.sh

Resume if interrupted:
  ./run-gsd.sh "/gsd:progress"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You can close this terminal. The build continues in background.
```
</step>

</process>

<success_criteria>
- [ ] Project has ROADMAP.md
- [ ] Runner script created and executable
- [ ] Autopilot launched in background
- [ ] User has monitoring/control instructions
</success_criteria>
