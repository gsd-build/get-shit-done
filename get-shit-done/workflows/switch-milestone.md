<purpose>
Switch the active milestone. Shows available milestones, warns about in-progress work on the current milestone, and updates the active milestone pointer.
</purpose>

<process>

## 0. Initialize

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init milestone-op)
```

Parse JSON for: `planning_base`.

## 1. List Available Milestones

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" milestone list
```

Display milestones with their status. If only one milestone exists, inform user there's nothing to switch to.

## 2. Get Target Milestone

If not provided as argument, ask user which milestone to switch to using AskUserQuestion.

## 3. Switch

```bash
RESULT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" milestone switch "${TARGET}")
```

Parse JSON for: `switched`, `name`, `status`, `state_path`, `previous_milestone`, `previous_status`, `has_in_progress`.

**If `has_in_progress` is true:**

Present warning before confirming:
```
## Warning: In-Progress Work

Milestone **{previous_milestone}** has status: {previous_status}

Switching won't lose any work — you can switch back anytime.
```

## 4. Confirm

```
## Switched to: {name}

**Status:** {status}
**State:** {state_path}

---

Run `/gsd:progress` to see where this milestone stands.
```

</process>

<success_criteria>
- [ ] Available milestones shown
- [ ] In-progress warning displayed if applicable
- [ ] ACTIVE_MILESTONE updated
- [ ] User sees new milestone status
</success_criteria>
