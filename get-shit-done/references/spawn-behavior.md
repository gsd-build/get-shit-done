# GSD Spawn Behavior Reference

## Yolo Mode Spawn Protocol

**When mode is `yolo` in `.planning/config.json`, Claude spawns new sessions directly.**

No `/clear` messaging. No user intervention. Just spawn and continue.

## How to Spawn

At the end of any workflow with a handoff, execute this bash directly:

```bash
PROJECT="$(basename "$(pwd)")-$(date +%s)"
NEXT_CMD="/gsd:next-command [args]"
tmux new-window -n "$PROJECT" -c "$(pwd)" "claude --dangerously-skip-permissions --chrome '$NEXT_CMD'"
```

Then report:
```
✓ Spawned: $PROJECT
Next: $NEXT_CMD
Switch: Ctrl+B n
```

## Checking Mode

```bash
MODE=$(cat .planning/config.json 2>/dev/null | jq -r '.mode // "interactive"')
if [[ "$MODE" == "yolo" ]]; then
  # Spawn directly
else
  # Show manual handoff
fi
```

## Workflow Handoffs

| From Workflow | Spawns | Next Command |
|---------------|--------|--------------|
| discuss-milestone | new-milestone | `/gsd:new-milestone [context]` |
| create-milestone | plan-phase | `/gsd:plan-phase [first-phase]` |
| discuss-phase | plan-phase | `/gsd:plan-phase [N]` |
| plan-phase | execute-plan | `/gsd:execute-plan [path]` |
| execute-phase (plan done) | execute-plan | `/gsd:execute-plan [next-path]` |
| execute-phase (phase done) | plan-phase | `/gsd:plan-phase [N+1]` |
| execute-phase (milestone done) | complete-milestone | `/gsd:complete-milestone` |
| complete-milestone | discuss-milestone | `/gsd:discuss-milestone` |
| transition | plan-phase | `/gsd:plan-phase [N+1]` |

## Key Principle

**In yolo mode, the user never types commands manually between workflow steps.**

Claude:
1. Finishes current workflow
2. Spawns new tmux window with next command
3. Reports what was spawned
4. User switches windows (Ctrl+B n) to see new session running
