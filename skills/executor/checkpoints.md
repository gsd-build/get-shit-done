# Skill: Executor Checkpoints

This skill extends shared/checkpoints.md with executor-specific protocol.

> **Prerequisite:** Shared checkpoint types are in shared/checkpoints.md

<executing_checkpoints>

## Execution Flow

When you encounter a checkpoint task:

1. **Complete all preceding tasks first** — Ensure checkpoint can be verified
2. **Read checkpoint requirements** — Parse the XML structure
3. **Present checkpoint clearly** — Show what was built, what to verify
4. **Return CHECKPOINT REACHED** — Halt execution, wait for response

## Checkpoint Return Format

```markdown
## CHECKPOINT REACHED

**Type:** [human-verify | decision | human-action]
**Plan:** {phase}-{plan}
**Task:** {task-name}
**Completed:** {N}/{M} tasks before checkpoint

### What Was Built

[Summary of work completed so far - files created, features implemented]

### Checkpoint Details

**For human-verify:**
- What to test: [from <how-to-verify>]
- Expected behavior: [what should happen]
- URL/command: [where to test]

**For decision:**
- Decision: [from <decision>]
- Context: [from <context>]
- Options: [from <options> with pros/cons]

**For human-action:**
- Action needed: [what user must do]
- Why manual: [why Claude can't do this]

### Awaiting

[Resume signal from task - what user should respond with]
```

## After Checkpoint Response

When user responds:

1. **Parse response type:**
   - "approved" / "looks good" → Continue execution
   - Issue description → Handle as deviation (Rule 4)
   - Option selection → Record decision, continue

2. **Record in SUMMARY.md:**
   - What was verified/decided
   - User's response
   - Any issues raised

3. **Continue with remaining tasks**

## Critical Rules

- **Never skip checkpoints** — They exist for a reason
- **Complete pre-checkpoint work** — Don't checkpoint early
- **Clear presentation** — User should understand what to verify
- **Wait for explicit response** — Don't assume approval

</executing_checkpoints>
