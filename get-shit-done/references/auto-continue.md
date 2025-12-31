# GSD Auto-Continue

Automatically continue to the next phase/plan after `/clear` without manual command entry.

## How It Works

1. **At transition points**, GSD workflows queue the next command to `.planning/queue.json`
2. **After `/clear`**, the SessionStart hook reads the queue and injects the command
3. **Claude executes** the queued command immediately

This enables hands-free progression through phases when running multiple projects in parallel.

## Setup

### 1. Add the SessionStart Hook

Edit your `~/.claude/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/get-shit-done/bin/session-start-hook.sh",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

### 2. (Optional) Disable for Specific Projects

Add to your project's `.planning/config.json`:

```json
{
  "mode": "interactive",
  "queue": {
    "enabled": false
  }
}
```

## Queue Locations

| Location | Scope | Priority |
|----------|-------|----------|
| `.planning/queue.json` | Project-specific | Checked first |
| `~/.claude/queue.json` | Global fallback | Checked second |

Project-scoped queues prevent conflicts when running multiple projects in parallel tmux windows.

## Queue Format

```json
{
  "command": "/gsd:execute-plan .planning/phases/01-foundation/01-02-PLAN.md",
  "queued_at": "2025-01-15T10:30:00Z",
  "project": "my-project",
  "cwd": "/Users/you/code/my-project"
}
```

## Manual Queue Commands

Queue a task manually:

```bash
# Using the /queue command
/queue /gsd:execute-plan .planning/phases/01-foundation/01-02-PLAN.md

# Or directly
~/.claude/get-shit-done/bin/queue-next.sh "/gsd:execute-plan ..."
```

## Debugging

Check the queue log:

```bash
cat ~/.claude/hooks/gsd-queue.log
```

View current queue:

```bash
cat .planning/queue.json 2>/dev/null || cat ~/.claude/queue.json 2>/dev/null
```

Clear a stale queue:

```bash
rm .planning/queue.json 2>/dev/null; rm ~/.claude/queue.json 2>/dev/null
```

## Multi-Project Workflow

When running multiple GSD projects in parallel tmux windows:

1. Each window has its own working directory
2. Each project's queue lives in `.planning/queue.json`
3. No conflicts between projects
4. `/clear` in each window picks up that project's queue

```
Window 1 (slack-mcp):     Phase 2 complete → queues /gsd:plan-phase 3
Window 2 (dht-crawler):   Phase 4 complete → queues /gsd:execute-plan ...
Window 1:                 /clear → runs /gsd:plan-phase 3 (correct project)
Window 2:                 /clear → runs /gsd:execute-plan ... (correct project)
```

## Integration with /spawn

The `/spawn` command launches Claude sessions with `/gsd:progress`. Combined with auto-continue:

1. `/spawn` launches projects in parallel tmux windows
2. Each project runs `/gsd:progress` to determine next action
3. User works through phases, running `/clear` between each
4. Queue system handles continuation automatically

## Workflow Example

```
[Run /gsd:execute-plan]
     ↓
[Plan executes, completes]
     ↓
[GSD queues: /gsd:execute-plan .../01-02-PLAN.md]
     ↓
[User runs /clear]
     ↓
[SessionStart hook reads queue, injects command]
     ↓
[Claude immediately runs /gsd:execute-plan .../01-02-PLAN.md]
     ↓
[Repeat until phase/milestone complete]
```
