---
name: gsd:checkpoint
description: Quick checkpoint to serialize GSD state mid-work. Run frequently to prevent context loss.
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

<objective>
Immediately serialize current GSD state to prevent loss during context compaction.

This is a FAST checkpoint (< 30 seconds) - run it frequently, especially:
- After completing a task
- Before starting something complex
- When you notice context compacting
- Every 10-15 minutes during long sessions
</objective>

<context>
@.planning/STATE.md
</context>

<process>

<step name="detect_current_work">
Quickly identify current phase/plan:

```bash
# Find most recently modified phase directory
CURRENT_PHASE=$(ls -td .planning/phases/*/ 2>/dev/null | head -1)
echo "Current phase: $CURRENT_PHASE"

# Check for existing checkpoint
ls "$CURRENT_PHASE"/.checkpoint.md 2>/dev/null && echo "Previous checkpoint exists"
```
</step>

<step name="quick_serialize">
Create or update `.planning/CHECKPOINT.md` with current state:

**IMPORTANT: Write this file IMMEDIATELY, before any other action.**

```markdown
---
timestamp: [YYYY-MM-DD HH:MM]
phase: [current phase number and name]
session_id: [generate short unique id]
---

# GSD Checkpoint

## Current Position
- **Phase:** [XX] [name]
- **Plan:** [if in a plan, which one]
- **Task:** [if in a task, which one]

## Just Completed
[What was just done - be specific]
- [item 1]
- [item 2]

## In Progress
[What's currently being worked on]

## Next Up
[What comes after current work]

## Key Decisions This Session
- [decision 1]
- [decision 2]

## Files Modified (uncommitted)
[List any files changed but not committed]

## Artifacts Status
- PLAN.md: [exists/missing/N/A]
- SUMMARY.md: [exists/missing/in-progress]
- STATE.md: [last updated when]
```
</step>

<step name="verify_artifacts">
Run quick verification:

```bash
node ~/.claude/get-shit-done/scripts/verify-gsd-state.js 2>/dev/null || echo "Verification script not found"
```

If current phase shows ❌, flag it:
```
⚠️ Current phase missing artifacts - will write SUMMARY before continuing
```
</step>

<step name="commit_checkpoint">
```bash
# Only commit if there are changes
if ! git diff --quiet .planning/CHECKPOINT.md 2>/dev/null; then
  git add .planning/CHECKPOINT.md
  git commit -m "checkpoint: [phase] [brief status]" --no-verify 2>/dev/null || true
fi
```
</step>

<step name="confirm">
Output (keep it brief):
```
✓ Checkpoint saved [timestamp]
  Phase: [XX-name]
  Status: [in-progress/completing]
  Artifacts: [✓ ok / ⚠️ needs attention]
```
</step>

</process>

<auto_trigger>
This command should be mentally triggered when:
- Claude says "Let me summarize..." (compaction signal)
- A task completes
- Before spawning a subagent
- Before any complex multi-step operation
</auto_trigger>

<success_criteria>
- [ ] CHECKPOINT.md updated with current state
- [ ] Takes less than 30 seconds
- [ ] Artifact status verified
- [ ] User knows current position
</success_criteria>
