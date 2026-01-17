# gsd-executor.md — Deep Reference Documentation

## Metadata
| Attribute | Value |
|-----------|-------|
| **Type** | Agent |
| **Location** | `agents/gsd-executor.md` |
| **Size** | 754 lines |
| **Documentation Tier** | Deep Reference |
| **Complexity Score** | 3+3+3+2 = **11** |

### Complexity Breakdown
- **Centrality: 3** — Spawned by execute-phase; output (SUMMARY.md, code) consumed by verifier and future phases
- **Complexity: 3** — Deviation handling (4 rules), checkpoint protocols (3 types), TDD execution, atomic commits, continuation handling
- **Failure Impact: 3** — Execution failures = no code shipped, wasted context, project stalled
- **Novelty: 2** — Execution patterns are GSD-specific but build on familiar concepts

---

## Purpose
The GSD Executor executes PLAN.md files atomically, creating per-task commits, handling deviations automatically, pausing at checkpoints, and producing SUMMARY.md files. It transforms plan intent into working code while maintaining execution traceability.

**Key innovation:** Automatic deviation handling with clear rules — bugs and blockers are auto-fixed, while architectural changes pause for user decision. Each task is committed atomically for clean git history.

---

## Critical Behaviors

### Constraints Enforced
| Constraint | Rule | Consequence if Violated | Source Section |
|------------|------|------------------------|----------------|
| Atomic commits | One commit per task | Lost traceability, can't revert individual tasks | `<task_commit_protocol>` |
| No `git add .` | Stage files individually | Unintended files committed | `<task_commit_protocol>` |
| Checkpoint stops execution | STOP immediately at checkpoint | User interaction bypassed, wrong path taken | `<checkpoint_protocol>` |
| Deviation rules priority | Rule 4 > Rules 1-3 | Architectural changes made without approval | `<deviation_rules>` |
| STATE.md required | Must read before operation | Lost project context, conflicting decisions | `<execution_flow>` |

### Numeric Limits
| Limit | Value | Rationale |
|-------|-------|-----------|
| Deviation rules | 4 rules | Clear classification for handling |
| Checkpoint types | 3 types | human-verify (90%), decision (9%), human-action (1%) |
| TDD commits per task | 2-3 | RED, GREEN, optional REFACTOR |
| Commit message scope | Phase-plan scope | `{type}({phase}-{plan}): {description}` |

---

## Operational Modes

### Mode A: Fully Autonomous (No Checkpoints)
- **Trigger:** Plan has no `type="checkpoint:*"` tasks
- **Input:** PLAN.md with all auto tasks
- **Process:**
  1. Execute all tasks sequentially
  2. Apply deviation rules automatically
  3. Commit each task atomically
  4. Create SUMMARY.md
  5. Update STATE.md
  6. Final metadata commit
- **Output:** Code changes, SUMMARY.md, updated STATE.md
- **Key difference:** Runs to completion without user interaction

### Mode B: Has Checkpoints
- **Trigger:** Plan contains `type="checkpoint:*"` task(s)
- **Input:** PLAN.md with mixed auto and checkpoint tasks
- **Process:**
  1. Execute tasks until checkpoint
  2. At checkpoint: STOP and return structured checkpoint message
  3. Orchestrator handles user interaction
  4. Fresh continuation agent resumes (original agent NOT resumed)
- **Output:** Partial code changes, checkpoint message with completed tasks table
- **Key difference:** Pauses at human interaction points

### Mode C: Continuation
- **Trigger:** Spawned with `<completed_tasks>` in prompt
- **Input:** PLAN.md, completed tasks table, resume point
- **Process:**
  1. Verify previous commits exist in git log
  2. DO NOT redo completed tasks
  3. Start from resume point
  4. Handle based on checkpoint type (verify action, continue, implement decision)
  5. Continue until completion or next checkpoint
- **Output:** Remaining code changes, full SUMMARY.md
- **Key difference:** Picks up where previous agent stopped

---

## Mechanism

### Execution Flow
```
1. load_project_state [priority: first]
   ├── Read .planning/STATE.md
   ├── Parse current position, decisions, blockers
   └── Handle missing STATE.md → error if .planning/ doesn't exist

2. load_plan
   ├── Parse frontmatter (phase, plan, type, autonomous, wave, depends_on)
   ├── Extract objective, @-references, tasks
   └── If CONTEXT.md referenced → honor user's vision

3. record_start_time
   └── Store PLAN_START_TIME and PLAN_START_EPOCH for duration

4. determine_execution_pattern
   ├── Check for checkpoints: grep "type=\"checkpoint" [plan-path]
   ├── Pattern A: Fully autonomous → execute all, SUMMARY, commit
   ├── Pattern B: Has checkpoints → execute until checkpoint, STOP, return message
   └── Pattern C: Continuation → verify commits, resume from specified task

5. execute_tasks [for each task]
   ├── Read task type
   ├── If type="auto":
   │   ├── Check for tdd="true" → follow TDD flow
   │   ├── Work toward completion
   │   ├── If auth error → handle as authentication gate
   │   ├── If additional work found → apply deviation rules
   │   ├── Run verification
   │   ├── Confirm done criteria
   │   ├── Commit task (see task_commit_protocol)
   │   └── Track completion for Summary
   └── If type="checkpoint:*":
       └── STOP, return checkpoint message, do NOT continue

6. create_summary
   └── Write {phase}-{plan}-SUMMARY.md using template

7. update_state
   └── Update STATE.md position, decisions, session continuity

8. final_commit
   └── Commit SUMMARY.md and STATE.md
```

### Deviation Handling Matrix

| Rule | Trigger | Action | Examples | User Permission |
|------|---------|--------|----------|-----------------|
| **Rule 1: Auto-fix bugs** | Code doesn't work as intended | Fix immediately, track | Wrong SQL, logic errors, type errors, security vulns | NO |
| **Rule 2: Auto-add critical** | Missing essential features | Add immediately, track | Missing error handling, input validation, auth checks | NO |
| **Rule 3: Auto-fix blocking** | Can't complete current task | Fix to unblock, track | Missing dependency, wrong types, broken imports | NO |
| **Rule 4: Ask about architectural** | Significant structural change | STOP, return checkpoint | New DB table, schema changes, switching frameworks | YES |

**Rule Priority (when multiple could apply):**
1. If Rule 4 applies → STOP and return checkpoint (architectural decision)
2. If Rules 1-3 apply → Fix automatically, track for Summary
3. If genuinely unsure → Apply Rule 4 (return checkpoint)

**Edge Case Guidance:**
- "This validation is missing" → Rule 2 (critical for security)
- "This crashes on null" → Rule 1 (bug)
- "Need to add table" → Rule 4 (architectural)
- "Need to add column" → Rule 1 or 2 (depends on context)

### Checkpoint Types

| Type | Use Case | Frequency | Trigger |
|------|----------|-----------|---------|
| `checkpoint:human-verify` | Visual/functional verification after automation | 90% | UI checks, interactive flows, feature testing |
| `checkpoint:decision` | Implementation choices requiring user input | 9% | Tech selection, architecture, design choices |
| `checkpoint:human-action` | Truly unavoidable manual steps | 1% | Email verification, 2FA codes, manual approvals |

### Authentication Gate Protocol
When CLI/API returns auth error during `type="auto"` task:
1. Recognize it's an auth gate (not a bug)
2. STOP current task execution
3. Return checkpoint with type `human-action`
4. Provide exact authentication steps
5. Specify verification command

**Auth Error Indicators:**
- "Error: Not authenticated", "Not logged in", "Unauthorized", "401", "403"
- "Authentication required", "Invalid API key", "Missing credentials"
- "Please run {tool} login" or "Set {ENV_VAR} environment variable"

### TDD Execution Flow
```
1. Check test infrastructure (if first TDD task)
   └── Install minimal test framework if needed

2. RED - Write failing test
   ├── Read <behavior> element for spec
   ├── Create test file
   ├── Run tests - MUST fail
   └── Commit: test({phase}-{plan}): add failing test for [feature]

3. GREEN - Implement to pass
   ├── Read <implementation> element
   ├── Write minimal code
   ├── Run tests - MUST pass
   └── Commit: feat({phase}-{plan}): implement [feature]

4. REFACTOR (if needed)
   ├── Clean up if obvious improvements
   ├── Run tests - MUST still pass
   └── Commit: refactor({phase}-{plan}): clean up [feature]
```

### Task Commit Protocol
```
1. Identify modified files: git status --short

2. Stage ONLY task-related files (NEVER git add . or -A):
   git add src/api/auth.ts
   git add src/types/user.ts

3. Determine commit type:
   | Type     | When                                    |
   |----------|----------------------------------------|
   | feat     | New feature, endpoint, component        |
   | fix      | Bug fix, error correction               |
   | test     | Test-only changes (TDD RED)             |
   | refactor | Code cleanup, no behavior change        |
   | perf     | Performance improvement                 |
   | docs     | Documentation changes                   |
   | style    | Formatting, linting                     |
   | chore    | Config, tooling, dependencies           |

4. Craft commit message:
   {type}({phase}-{plan}): {task description}

   - {key change 1}
   - {key change 2}

5. Record commit hash: TASK_COMMIT=$(git rev-parse --short HEAD)
```

---

## Interactions

### Reads
| File | What It Uses | Why |
|------|--------------|-----|
| `.planning/STATE.md` | Current position, decisions, blockers | Execution context |
| PLAN.md (in prompt) | Objective, tasks, context refs, success criteria | What to execute |
| `@`-referenced files | Code context, prior summaries | Implementation guidance |
| `~/.claude/get-shit-done/templates/summary.md` | SUMMARY template | Output format |

### Writes
| File | Content | Format |
|------|---------|--------|
| Code files | Task implementations | Language-specific |
| Test files | TDD tests | Language-specific |
| `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md` | Execution summary | YAML frontmatter + Markdown |
| `.planning/STATE.md` | Updated position, decisions | Markdown |

### Spawned By
| Command/Agent | Mode | Context Provided |
|---------------|------|------------------|
| `/gsd:execute-phase` | Autonomous/Checkpoint | PLAN.md contents, wave context |
| Continuation spawn | Continuation | PLAN.md, completed_tasks, resume point |

### Output Consumed By
| Consumer | What They Use | How |
|----------|--------------|-----|
| `gsd-verifier` | SUMMARY.md claims, code state | Verifies goal achievement |
| `gsd-planner` (gap closure) | SUMMARY.md artifacts | Plans fixes |
| Future phases | SUMMARY.md frontmatter | Dependency graph, tech available |

---

## Structured Returns

### PLAN COMPLETE
```markdown
## PLAN COMPLETE

**Plan:** {phase}-{plan}
**Tasks:** {completed}/{total}
**SUMMARY:** {path to SUMMARY.md}

**Commits:**
- {hash}: {message}
- {hash}: {message}
...

**Duration:** {time}
```

### CHECKPOINT REACHED
```markdown
## CHECKPOINT REACHED

**Type:** [human-verify | decision | human-action]
**Plan:** {phase}-{plan}
**Progress:** {completed}/{total} tasks complete

### Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | [task name] | [hash] | [key files] |
| 2 | [task name] | [hash] | [key files] |

### Current Task

**Task {N}:** [task name]
**Status:** [blocked | awaiting verification | awaiting decision]
**Blocked by:** [specific blocker]

### Checkpoint Details

[Checkpoint-specific content based on type]

### Awaiting

[What user needs to do/provide]
```

---

## Anti-Patterns

| Anti-Pattern | Why Bad | Correct Approach |
|--------------|---------|------------------|
| `git add .` or `git add -A` | Commits unintended files | Stage each file individually |
| Continue past checkpoint | Bypasses user interaction | STOP immediately, return checkpoint message |
| Redo completed tasks in continuation | Wasted context, potential conflicts | Verify commits exist, start from resume point |
| Skip deviation tracking | Lost audit trail | Track all deviations for Summary documentation |
| Retry auth errors repeatedly | Wastes time on unrecoverable state | Recognize auth gate, return checkpoint |
| Make architectural changes without asking | User loses control of design | Apply Rule 4, return checkpoint for decision |

---

## Change Impact Analysis

### If gsd-executor Changes:

**Upstream Impact (who calls this):**
- `execute-phase` command — May need updated spawning logic for new patterns
- Continuation spawning — May need to provide different context

**Downstream Impact (who consumes output):**
- `gsd-verifier` — Expects SUMMARY.md with specific frontmatter fields
- `gsd-planner` — Gap closure mode reads SUMMARY artifacts list
- Future phases — Depend on SUMMARY frontmatter (tech-stack, key-files, decisions)

**Breaking Changes to Watch:**
- Changing SUMMARY.md frontmatter schema → breaks verifier and planner gap closure
- Changing checkpoint return format → breaks orchestrator continuation handling
- Changing commit message format → affects git log readability
- Changing deviation rules → affects what gets auto-fixed vs paused
- Removing TDD execution → breaks TDD plan types

---

## Section Index

| Section | Lines (approx) | Purpose |
|---------|----------------|---------|
| `<role>` | 1-14 | Identity and core responsibilities |
| `<execution_flow>` | 16-129 | 5-step execution process with decision points |
| `<deviation_rules>` | 131-271 | 4 rules with triggers, actions, examples |
| `<authentication_gates>` | 273-335 | Auth error handling protocol |
| `<checkpoint_protocol>` | 337-414 | 3 checkpoint types with templates |
| `<checkpoint_return_format>` | 416-455 | Exact structure for checkpoint messages |
| `<continuation_handling>` | 457-481 | How continuation agents resume |
| `<tdd_execution>` | 483-520 | RED-GREEN-REFACTOR cycle |
| `<task_commit_protocol>` | 522-579 | Atomic commit process |
| `<summary_creation>` | 581-652 | SUMMARY.md population |
| `<state_updates>` | 654-690 | STATE.md update protocol |
| `<final_commit>` | 692-716 | Metadata commit after completion |
| `<completion_format>` | 718-740 | Return format for successful completion |
| `<success_criteria>` | 742-754 | Completion checklist |

---

## Quick Reference

```
WHAT:     Executes PLAN.md files with atomic commits and deviation handling
MODES:    Autonomous, Has Checkpoints, Continuation
OUTPUT:   Code changes, {phase}-{plan}-SUMMARY.md, updated STATE.md

CORE RULES:
• One commit per task (never git add . or -A)
• STOP immediately at checkpoints
• Auto-fix bugs/blockers (Rules 1-3), ask about architecture (Rule 4)
• TDD tasks produce 2-3 commits (RED/GREEN/REFACTOR)
• Track all deviations for Summary

SPAWNED BY: /gsd:execute-phase, continuation spawn
CONSUMED BY: gsd-verifier, gsd-planner (gap closure), future phases
```
