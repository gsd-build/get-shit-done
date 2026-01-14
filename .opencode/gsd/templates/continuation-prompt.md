# Continuation Prompt Template

Template for spawning fresh agent to continue plan execution after checkpoint resolution.

---

## Template

```markdown
<objective>
Continue executing plan {plan_number} of phase {phase_number}-{phase_name}.

**DO NOT REDO completed tasks.** They are already committed. Start from the resume point below.

Commit each remaining task atomically. Create SUMMARY.md when all tasks complete. Update STATE.md.
</objective>

<completed_tasks>
The following tasks are ALREADY DONE. Do not repeat them.

{completed_tasks_table}

**Verify before continuing:** Check that these commits exist with `git log --oneline -5`
</completed_tasks>

<resume_point>
**Resume from:** Task {resume_task_number} - {resume_task_name}
**Status:** {resume_status}
**User response:** {user_response}

{resume_instructions}
</resume_point>

<execution_context>
@~/.config/opencode/gsd/workflows/execute-plan.md
@~/.config/opencode/gsd/templates/summary.md
@~/.config/opencode/gsd/references/checkpoints.md
@~/.config/opencode/gsd/references/tdd.md
</execution_context>

<context>
Plan: @{plan_path}
Project state: @.planning/STATE.md
Config: @.planning/config.json (if exists)
</context>

<checkpoint_behavior>
If you hit another checkpoint, return using the format in:
@~/.config/opencode/gsd/templates/checkpoint-return.md

Include ALL completed tasks (both previous and new) in the Completed Tasks table.
</checkpoint_behavior>

<completion_format>
When plan completes successfully, return:

## PLAN COMPLETE

**Plan:** {phase}-{plan}
**Tasks:** {total}/{total}
**SUMMARY:** {path to SUMMARY.md}

**Commits:**
- {hash}: {message}
...

Include commits from both previous execution and this continuation.
</completion_format>

<success_criteria>
- [ ] Verified previous commits exist (did not redo work)
- [ ] Remaining tasks executed
- [ ] Each new task committed individually
- [ ] SUMMARY.md created in plan directory (covers ALL tasks)
- [ ] STATE.md updated with position and decisions
</success_criteria>
```

---

## Placeholders

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{phase_number}` | Checkpoint return | `01` |
| `{phase_name}` | Checkpoint return | `foundation` |
| `{plan_number}` | Checkpoint return | `01` |
| `{plan_path}` | Original prompt | `.planning/phases/01-foundation/01-01-PLAN.md` |
| `{completed_tasks_table}` | Checkpoint return | Markdown table of completed tasks |
| `{resume_task_number}` | Checkpoint return | `2` |
| `{resume_task_name}` | Checkpoint return | `Initialize Convex backend` |
| `{resume_status}` | Derived from checkpoint type | `User completed authentication` |
| `{user_response}` | User input | `done` or `approved` or `option-a` |
| `{resume_instructions}` | Derived from checkpoint type | See below |

---

## Resume Instructions by Checkpoint Type

### After human-action (e.g., auth gate)

```markdown
**Resume from:** Task 2 - Initialize Convex backend
**Status:** User completed authentication
**User response:** done

The user has completed the manual action. Verify it worked, then continue:
1. Verify: `cat .env.local | grep CONVEX` shows Convex URL
2. If verified: Continue with remaining Task 2 steps (if any), then Task 3
3. If not verified: Report what's missing, create new checkpoint
```

### After human-verify (e.g., visual check)

```markdown
**Resume from:** Task 3 - Verify responsive behavior
**Status:** User approved verification
**User response:** approved

User confirmed the implementation is correct. Continue to next task.
```

Or if issues reported:

```markdown
**Resume from:** Task 3 - Verify responsive behavior
**Status:** User reported issues
**User response:** "Sidebar overlaps content on tablet view"

Fix the reported issues:
1. Address: "Sidebar overlaps content on tablet view"
2. After fixing, re-present the verification checkpoint
```

### After decision

```markdown
**Resume from:** Task 4 - Select authentication provider
**Status:** User made decision
**User response:** clerk

Proceed with the selected option (Clerk). Implement accordingly.
```

---

## Example: Continuation After Auth Gate

```markdown
<objective>
Continue executing plan 01 of phase 01-foundation.

**DO NOT REDO completed tasks.** They are already committed. Start from the resume point below.

Commit each remaining task atomically. Create SUMMARY.md when all tasks complete. Update STATE.md.
</objective>

<completed_tasks>
The following tasks are ALREADY DONE. Do not repeat them.

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Initialize Next.js 15 project | d6fe73f | package.json, tsconfig.json, next.config.js, app/ |

**Verify before continuing:** Check that these commits exist with `git log --oneline -5`
</completed_tasks>

<resume_point>
**Resume from:** Task 2 - Initialize Convex backend
**Status:** User completed authentication
**User response:** done

The user has completed the manual action. Verify it worked, then continue:
1. Verify: `cat .env.local | grep CONVEX` shows Convex URL
2. If verified: Continue with remaining Task 2 steps (create schema, verify deployment), then Task 3
3. If not verified: Report what's missing, create new checkpoint
</resume_point>

<execution_context>
@~/.config/opencode/gsd/workflows/execute-plan.md
@~/.config/opencode/gsd/templates/summary.md
@~/.config/opencode/gsd/references/checkpoints.md
@~/.config/opencode/gsd/references/tdd.md
</execution_context>

<context>
Plan: @.planning/phases/01-foundation/01-01-PLAN.md
Project state: @.planning/STATE.md
</context>

<checkpoint_behavior>
If you hit another checkpoint, return using the format in:
@~/.config/opencode/gsd/templates/checkpoint-return.md

Include ALL completed tasks (both previous and new) in the Completed Tasks table.
</checkpoint_behavior>

<completion_format>
When plan completes successfully, return:

## PLAN COMPLETE

**Plan:** 01-01
**Tasks:** 3/3
**SUMMARY:** .planning/phases/01-foundation/01-01-SUMMARY.md

**Commits:**
- d6fe73f: feat(01-01): initialize Next.js 15 with TypeScript and Tailwind
- [new]: feat(01-01): initialize Convex backend with schema
- [new]: feat(01-01): integrate Clerk authentication
</completion_format>

<success_criteria>
- [ ] Verified previous commits exist (did not redo work)
- [ ] Remaining tasks executed
- [ ] Each new task committed individually
- [ ] SUMMARY.md created in plan directory (covers ALL tasks)
- [ ] STATE.md updated with position and decisions
</success_criteria>
```

---

## Usage

Orchestrator fills placeholders from checkpoint return and user response:

```python
Task(
    prompt=filled_continuation_template,
    subagent_type="general-purpose"
)
```

Fresh agent loads @-references, verifies completed work, continues from resume point.
