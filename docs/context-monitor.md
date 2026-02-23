# Context Window Monitor

A PostToolUse hook that warns the agent when context window usage is high.

## Problem

The statusline shows context usage to the **user**, but the **agent** has no awareness of context limits. When context runs low, the agent continues working until it hits the wall — potentially mid-task with no state saved.

## How It Works

1. The statusline hook writes context metrics to `/tmp/claude-ctx-{session_id}.json`
2. After each tool use, the context monitor reads these metrics
3. When remaining context drops below thresholds, it injects a warning as `additionalContext`
4. The agent receives the warning in its conversation and can act accordingly

## Thresholds

| Level | Remaining | Agent Behavior |
|-------|-----------|----------------|
| Normal | > 35% | No warning |
| WARNING | <= 35% | Wrap up current task, avoid starting new complex work |
| CRITICAL | <= 25% | Stop immediately, save state (`/gsd:pause-work`) |

## Debounce

To avoid spamming the agent with repeated warnings:
- First warning always fires immediately
- Subsequent warnings require 5 tool uses between them
- Severity escalation (WARNING -> CRITICAL) bypasses debounce

## Architecture

```
Statusline Hook (gsd-statusline.js)
    | writes
    v
/tmp/claude-ctx-{session_id}.json
    ^ reads
    |
Context Monitor (gsd-context-monitor.js, PostToolUse)
    | injects
    v
additionalContext -> Agent sees warning
```

The bridge file is a simple JSON object:

```json
{
  "session_id": "abc123",
  "remaining_percentage": 28.5,
  "used_pct": 71,
  "timestamp": 1708200000
}
```

## Integration with GSD

GSD's `/gsd:pause-work` command saves execution state. The WARNING message suggests using it. The CRITICAL message instructs immediate state save.

## Setup

Both hooks are automatically registered during `npx get-shit-done-cc` installation:

- **Statusline** (writes bridge file): Registered as `statusLine` in settings.json
- **Context Monitor** (reads bridge file): Registered as `PostToolUse` hook in settings.json

Manual registration in `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/hooks/gsd-statusline.js"
  },
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/gsd-context-monitor.js"
          }
        ]
      }
    ]
  }
}
```

## Safety

- The hook wraps everything in try/catch and exits silently on error
- It never blocks tool execution — a broken monitor should not break the agent's workflow
- Stale metrics (older than 60s) are ignored
- Missing bridge files are handled gracefully (subagents, fresh sessions)
