---
name: gsd:autopilot
description: Launch, monitor, stop, or authenticate GSD Autopilot for the current git branch
argument-hint: "[show|status|stop|login [github]|--prd path|--phases range|--notify channel]"
allowed-tools:
  - Bash
---

# GSD Autopilot Command

Launch and manage the GSD Autopilot workflow orchestrator. Each git branch gets its own isolated autopilot instance with a deterministic port assignment.

## Usage

**Launch autopilot** (spawns background process, opens dashboard):
```
/gsd:autopilot
/gsd:autopilot --prd path/to/prd.md
/gsd:autopilot --phases 3-5
/gsd:autopilot --notify teams
```

**Show dashboard** (starts dashboard if needed, opens browser — no autopilot):
```
/gsd:autopilot show
```

**Check status** (reports phase progress and dashboard URL):
```
/gsd:autopilot status
```

**Stop autopilot** (gracefully terminates the background process):
```
/gsd:autopilot stop
```

**Authenticate for dev tunnels** (runs devtunnel browser login):
```
/gsd:autopilot login
/gsd:autopilot login github
```

## How It Works

When you run `/gsd:autopilot`, this command:
1. Gets your current git branch
2. Checks if autopilot is already running for this branch
3. Assigns a deterministic port based on branch name (uses SHA-256 hashing)
4. Spawns `npx gsd-autopilot` as a detached background process
5. Returns the dashboard URL for monitoring progress

The launcher handles all routing, port assignment, and process management. Multiple branches can run autopilot simultaneously without conflicts.

## Execution

```bash
# Get current git branch
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "detached")

# Get all arguments after the command
ARGUMENTS="${@}"

# Delegate to launcher script with branch name and user arguments
node __LAUNCHER_PATH__ "$BRANCH" $ARGUMENTS
```
