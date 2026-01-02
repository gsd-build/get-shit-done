# Research: GSD Auto-Continue

## Goal
Automatically continue GSD workflow when a phase completes without user intervention.

## Current GSD Behavior
When a phase completes, outputs:
```
▶ Next Up
/gsd:plan-phase 3
/clear first → fresh context window
```

User must manually type `/clear` then the command.

---

## Approaches Tested

### 1. Stop Hook (Failed)
**Attempt:** Detect GSD output pattern in Stop hook, send `/clear` via tmux.
**Result:** Stop hook never fired. Unknown why.
**Files:** `~/.claude/hooks/gsd-auto-clear.sh` (archived)

### 2. SessionStart + Transcript Search (Overcomplicated)
**Attempt:** After `/clear`, search transcripts for GSD command pattern.
**Result:** Worked but fragile - transcripts get pushed out of search window.
**Files:** `~/.claude/hooks/gsd-auto-continue.sh` (archived)

### 3. Queue File + SessionStart (Current - Partial)
**Attempt:** Write next command to queue.json, SessionStart hook reads and injects.
**Result:** Works, but requires manual `/clear` or session restart.
**Files:**
- `~/.claude/hooks/session-start.sh` (active)
- `~/.claude/queue.json` (global) or `.planning/queue.json` (project-scoped)

---

## Key Discovery: Ralph Wiggum Plugin

Location: `~/code/claude-code/plugins/ralph-wiggum/`

Uses Stop hook successfully with `{"decision": "block", "reason": "<prompt>"}` to:
1. Prevent session exit
2. Inject new prompt
3. Continue in same context

**Not suitable for GSD** because it accumulates context. GSD needs `/clear` for fresh context between phases.

---

## Working Solution

### Components
1. **Queue file:** `.planning/queue.json` (project-scoped) or `~/.claude/queue.json` (global)
2. **SessionStart hook:** Reads queue, injects as `additionalContext`, deletes queue
3. **Trigger:** Either `/clear` or exit + restart Claude

### Hook: `~/.claude/hooks/session-start.sh`
```bash
#!/bin/bash
set -e
PROJECT_QUEUE=".planning/queue.json"
GLOBAL_QUEUE="$HOME/.claude/queue.json"

# Check project queue first, then global
if [[ -f "$PROJECT_QUEUE" ]]; then
    QUEUE_FILE="$PROJECT_QUEUE"
elif [[ -f "$GLOBAL_QUEUE" ]]; then
    QUEUE_FILE="$GLOBAL_QUEUE"
else
    exit 0
fi

TASK=$(cat "$QUEUE_FILE")
jq -n --arg task "$TASK" '{
    hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: ("GSD AUTO-CONTINUE\n\nEXECUTE THIS COMMAND IMMEDIATELY:\n" + $task)
    }
}'
rm "$QUEUE_FILE"
```

### hooks.json
```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "/Users/bobrain/.claude/hooks/session-start.sh",
        "timeout": 5000
      }]
    }]
  }
}
```

---

## Proposed Solution: Spawn New Session

**Focus:** Spawn a new Claude session with the queued command. Handle killing the old session separately (or let user do it).

**Flow:**
1. GSD phase completes → writes next command to `.planning/queue.json`
2. New session spawns via tmux (new window or same window)
3. SessionStart hook reads queue, injects command
4. Claude executes automatically

**Why spawn, not clear:**
- `/clear` requires programmatic input to running session (fragile)
- Spawning is external, reliable, uses existing `/spawn-project` infrastructure
- Old session can be killed manually or left to timeout

**Implementation:**
1. GSD skill writes queue at phase completion
2. GSD skill outputs: "Run `/spawn-project <path>` to continue" OR triggers spawn directly
3. New session picks up queue automatically

---

## Tested: Queue + Spawn

Successfully tested:
1. Wrote `/gsd:plan-phase 3` to `.planning/queue.json`
2. Sent `/exit` to running session via tmux
3. Started new `claude --dangerously-skip-permissions --chrome`
4. SessionStart hook fired, consumed queue, logged execution

**Log evidence:**
```
[2025-12-31 11:54:10] Executed from project queue: /gsd:plan-phase 3
```

---

## Next Steps for GSD Integration

1. **Modify GSD phase completion** - Write next command to `.planning/queue.json`
2. **Spawn new session** - Use `/spawn-project <path>` or direct tmux command
3. **Later:** Automate killing old session (optional - can be manual for now)

---

## Related Files

| File | Purpose |
|------|---------|
| `~/.claude/hooks/session-start.sh` | Active hook - reads queue on SessionStart |
| `~/.claude/hooks.json` | Hook configuration |
| `~/.claude/commands/queue.md` | `/queue` slash command |
| `~/.claude/commands/spawn.md` | `/spawn` project launcher |
| `~/code/claude-code/plugins/ralph-wiggum/` | Reference implementation |
