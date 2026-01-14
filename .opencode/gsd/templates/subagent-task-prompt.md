# Subagent Task Prompt Template

Template for spawning plan execution agents. Used by execute-phase (parallel) and execute-plan (single) orchestrators.

---

## Template

```markdown
<objective>
Execute plan {plan_number} of phase {phase_number}-{phase_name}.

Commit each task atomically. Create SUMMARY.md. Update STATE.md.

**Checkpoint handling:** If you hit a checkpoint task or auth gate, STOP and return a structured checkpoint message. The orchestrator will spawn a fresh agent to continue after the user responds.
</objective>

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
When you encounter a checkpoint task (type="checkpoint:*") or auth gate, STOP execution and return using the structured format in:

@~/.config/opencode/gsd/templates/checkpoint-return.md

**Required in your return:**
1. Completed Tasks table with commit hashes and files
2. Current task name and what's blocking it
3. Checkpoint details for the user
4. What you're awaiting from the user

The orchestrator will present this to the user. After they respond, a FRESH agent will continue from your checkpoint using the continuation-prompt template. You will NOT be resumed.
</checkpoint_behavior>

<completion_format>
When plan completes successfully, return:

## PLAN COMPLETE

**Plan:** {phase}-{plan}
**Tasks:** {completed}/{total}
**SUMMARY:** {path to SUMMARY.md}

**Commits:**
- {hash}: {message}
...
</completion_format>

<success_criteria>
- [ ] All tasks executed (or paused at checkpoint with full state returned)
- [ ] Each task committed individually
- [ ] SUMMARY.md created in plan directory
- [ ] STATE.md updated with position and decisions
</success_criteria>
```

---

## Placeholders

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{phase_number}` | Phase directory name | `01` |
| `{phase_name}` | Phase directory name | `foundation` |
| `{plan_number}` | Plan filename | `01` |
| `{plan_path}` | Full path to PLAN.md | `.planning/phases/01-foundation/01-01-PLAN.md` |

---

## Usage

Orchestrator fills placeholders and passes to Task tool:

```python
Task(
    prompt=filled_template,
    subagent_type="general-purpose"
)
```

Agent reads @-references, loads full workflow context, executes plan.

When agent returns:
- If contains "## CHECKPOINT REACHED": Parse checkpoint, present to user, spawn fresh agent with continuation-prompt.md
- If contains "## PLAN COMPLETE": Finalize execution
