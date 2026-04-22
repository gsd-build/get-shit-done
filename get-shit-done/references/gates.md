# Gates Taxonomy

Canonical gate types used across GSD workflows. Every validation checkpoint maps to one of these four types.

---

## Gate Types

### Pre-flight Gate
**Purpose:** Validates preconditions before starting an operation.
**Behavior:** Blocks entry if conditions unmet. No partial work created.
**Recovery:** Fix the missing precondition, then retry.
**Examples:**
- Plan-phase checks for REQUIREMENTS.md before planning
- Execute-phase validates PLAN.md exists before execution
- Discuss-phase confirms phase exists in ROADMAP.md

### Revision Gate
**Purpose:** Evaluates output quality and routes to revision if insufficient.
**Behavior:** Loops back to producer with specific feedback. Bounded by iteration cap.
**Recovery:** Producer addresses feedback; checker re-evaluates. The loop also escalates early if issue count does not decrease between consecutive iterations (stall detection). After max iterations, escalates unconditionally.
**Examples:**
- Plan-checker reviewing PLAN.md (max 3 iterations)
- Verifier checking phase deliverables against success criteria

### Escalation Gate
**Purpose:** Surfaces unresolvable issues to the developer for a decision.
**Behavior:** Pauses workflow, presents options, waits for human input.
**Recovery:** Developer chooses action; workflow resumes on selected path.
**Examples:**
- Revision loop exhausted after 3 iterations
- Merge conflict during worktree cleanup
- Ambiguous requirement needing clarification

### Abort Gate
**Purpose:** Terminates the operation to prevent damage or waste.
**Behavior:** Stops immediately, preserves state, reports reason.
**Recovery:** Developer investigates root cause, fixes, restarts from checkpoint.
**Examples:**
- Context window critically low during execution
- STATE.md in error state blocking /gsd:next
- Verification finds critical missing deliverables

---

## Gate Matrix

| Workflow | Phase | Gate Type | Artifacts Checked | Failure Behavior |
|----------|-------|-----------|-------------------|------------------|
| plan-phase | Entry | Pre-flight | REQUIREMENTS.md, ROADMAP.md | Block with missing-file message |
| plan-phase | Step 12 | Revision | PLAN.md quality | Loop to planner (max 3) |
| plan-phase | Post-revision | Escalation | Unresolved issues | Surface to developer |
| execute-phase | Entry | Pre-flight | PLAN.md | Block with missing-plan message |
| execute-phase | Completion | Revision | SUMMARY.md completeness | Re-run incomplete tasks |
| verify-work | Entry | Pre-flight | SUMMARY.md | Block with missing-summary |
| verify-work | Evaluation | Escalation | Failed criteria | Surface gaps to developer |
| next | Entry | Abort | Error state, checkpoints | Stop with diagnostic |

---

## Implementing Gates

Use this taxonomy when designing or auditing workflow validation points:

- **Pre-flight** gates belong at workflow entry points. They are cheap, deterministic checks that prevent wasted work. If you can verify a precondition with a file-existence check or a config read, use a pre-flight gate.
- **Revision** gates belong after a producer step where quality varies. Always pair them with an iteration cap to prevent infinite loops. The cap should reflect the cost of each iteration -- expensive operations get fewer retries.
- **Escalation** gates belong wherever automated resolution is impossible or ambiguous. They are the safety valve between revision loops and abort. Present the developer with clear options and enough context to decide.
- **Abort** gates belong at points where continuing would cause damage, waste significant resources, or produce meaningless output. They should preserve state so work can resume after the root cause is fixed.

**Selection heuristic:** Start with pre-flight. If the check happens after work is produced, it is a revision gate. If the revision loop cannot resolve the issue, escalate. If continuing is dangerous, abort.
