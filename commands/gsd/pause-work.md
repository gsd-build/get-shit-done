---
name: gsd:pause-work
description: Create context handoff when pausing work mid-phase
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Create `.continue-here.md` handoff file to preserve complete work state across sessions.

Enables seamless resumption in fresh session with full context restoration.
</objective>

<context>
@.planning/STATE.md
</context>

<process>

<step name="detect">
Find current phase directory from most recently modified files.

```bash
# Find current phase from STATE.md YAML or recent activity
CURRENT_PHASE_DIR=$(grep "^current_phase_dir:" .planning/STATE.md 2>/dev/null | cut -d: -f2- | tr -d ' ')
if [ -z "$CURRENT_PHASE_DIR" ]; then
  # Fallback: find most recently modified phase
  CURRENT_PHASE_DIR=$(ls -td .planning/phases/*/ 2>/dev/null | head -1)
fi
```
</step>

<step name="consistency_check">
**Check STATE/SUMMARY consistency before pausing:**

```bash
# Count plans vs summaries in current phase
PLAN_COUNT=$(ls -1 "$CURRENT_PHASE_DIR"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
SUMMARY_COUNT=$(ls -1 "$CURRENT_PHASE_DIR"/*-SUMMARY.md 2>/dev/null | wc -l | tr -d ' ')

if [ "$SUMMARY_COUNT" -lt "$PLAN_COUNT" ]; then
  # Find which are missing
  MISSING=""
  for plan in "$CURRENT_PHASE_DIR"/*-PLAN.md; do
    summary="${plan/-PLAN.md/-SUMMARY.md}"
    [ ! -f "$summary" ] && MISSING="$MISSING $(basename $plan | sed 's/-PLAN.md//')"
  done
fi
```

**If inconsistency found:**
```
⚠️ CONSISTENCY WARNING

Before pausing, note that some plans have no SUMMARY:
Missing: {MISSING}

This may indicate:
- Plans executed but session interrupted before SUMMARY creation
- Plans marked complete in STATE.md but SUMMARY missing

Consider:
- /gsd:recover-summary to generate missing SUMMARYs
- Or note this in the handoff for next session
```

Continue with pause regardless (warning only).
</step>

<step name="gather">
**Collect complete state for handoff:**

1. **Current position**: Which phase, which plan, which task
2. **Work completed**: What got done this session
3. **Work remaining**: What's left in current plan/phase
4. **Decisions made**: Key decisions and rationale
5. **Blockers/issues**: Anything stuck
6. **Mental context**: The approach, next steps, "vibe"
7. **Files modified**: What's changed but not committed

Ask user for clarifications if needed.
</step>

<step name="write">
**Write handoff to `.planning/phases/XX-name/.continue-here.md`:**

```markdown
---
phase: XX-name
task: 3
total_tasks: 7
status: in_progress
last_updated: [timestamp]
---

<current_state>
[Where exactly are we? Immediate context]
</current_state>

<completed_work>

- Task 1: [name] - Done
- Task 2: [name] - Done
- Task 3: [name] - In progress, [what's done]
  </completed_work>

<remaining_work>

- Task 3: [what's left]
- Task 4: Not started
- Task 5: Not started
  </remaining_work>

<decisions_made>

- Decided to use [X] because [reason]
- Chose [approach] over [alternative] because [reason]
  </decisions_made>

<blockers>
- [Blocker 1]: [status/workaround]
</blockers>

<context>
[Mental state, what were you thinking, the plan]
</context>

<next_action>
Start with: [specific first action when resuming]
</next_action>
```

Be specific enough for a fresh Claude to understand immediately.
</step>

<step name="update_state_yaml">
**Update STATE.md YAML frontmatter with checkpoint info:**

```bash
CONTINUE_HERE_PATH="$CURRENT_PHASE_DIR/.continue-here.md"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Update last_checkpoint to point to the handoff file
sed -i "s|^last_checkpoint:.*|last_checkpoint: $CONTINUE_HERE_PATH|" .planning/STATE.md

# Update phase_status to indicate paused mid-execution
sed -i "s|^phase_status:.*|phase_status: paused|" .planning/STATE.md

# Update consistency tracking fields
PLAN_COUNT=$(ls -1 "$CURRENT_PHASE_DIR"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
SUMMARY_COUNT=$(ls -1 "$CURRENT_PHASE_DIR"/*-SUMMARY.md 2>/dev/null | wc -l | tr -d ' ')

sed -i "s|^plans_in_phase:.*|plans_in_phase: $PLAN_COUNT|" .planning/STATE.md
sed -i "s|^summaries_in_phase:.*|summaries_in_phase: $SUMMARY_COUNT|" .planning/STATE.md
sed -i "s|^last_verified:.*|last_verified: $TIMESTAMP|" .planning/STATE.md

# Set plan_summary_exists based on current plan
CURRENT_PLAN=$(grep "^current_plan:" .planning/STATE.md | cut -d: -f2 | tr -d ' ')
if [ -n "$CURRENT_PLAN" ]; then
  CURRENT_SUMMARY="$CURRENT_PHASE_DIR/*${CURRENT_PLAN}*-SUMMARY.md"
  if ls $CURRENT_SUMMARY 1>/dev/null 2>&1; then
    sed -i "s|^plan_summary_exists:.*|plan_summary_exists: true|" .planning/STATE.md
  else
    sed -i "s|^plan_summary_exists:.*|plan_summary_exists: false|" .planning/STATE.md
  fi
fi
```

**Also update Session Continuity section:**

Update the prose section to match:
```markdown
## Session Continuity

Last session: {TIMESTAMP}
Stopped at: Paused mid-execution via /gsd:pause-work
Next step: /gsd:resume-work
Resume file: {CONTINUE_HERE_PATH}
```
</step>

<step name="commit">
**Check planning config:**

```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

**If `COMMIT_PLANNING_DOCS=false`:** Skip git operations

**If `COMMIT_PLANNING_DOCS=true` (default):**

```bash
git add .planning/phases/*/.continue-here.md
git add .planning/STATE.md
git commit -m "wip: [phase-name] paused at task [X]/[Y]

Checkpoint: .planning/phases/[XX-name]/.continue-here.md
STATE.md updated with:
- last_checkpoint: [path]
- phase_status: paused
- plans_in_phase: [N]
- summaries_in_phase: [M]
"
```
</step>

<step name="confirm">
```
✓ Handoff created: .planning/phases/[XX-name]/.continue-here.md

Current state:

- Phase: [XX-name]
- Task: [X] of [Y]
- Status: [in_progress/blocked]
- Committed as WIP

To resume: /gsd:resume-work

```
</step>

</process>

<success_criteria>
- [ ] Consistency check performed (warning if SUMMARYs missing)
- [ ] .continue-here.md created in correct phase directory
- [ ] All sections filled with specific content
- [ ] STATE.md YAML frontmatter updated:
  - [ ] last_checkpoint set to .continue-here.md path
  - [ ] phase_status set to "paused"
  - [ ] plans_in_phase and summaries_in_phase updated
  - [ ] last_verified timestamp set
- [ ] Session Continuity section updated
- [ ] Committed as WIP (includes STATE.md)
- [ ] User knows location and how to resume
</success_criteria>
```
