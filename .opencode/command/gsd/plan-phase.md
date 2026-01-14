---

description: Create detailed execution plan for a phase (PLAN.md)

---

<objective>
Create executable phase prompt with discovery, context injection, and task breakdown.

Purpose: Break down roadmap phases into concrete, executable PLAN.md files that Claude can execute.
Output: One or more PLAN.md files in the phase directory (.planning/phases/XX-name/{phase}-{plan}-PLAN.md)
</objective>

<execution_context>
@~/.config/opencode/gsd/workflows/plan-phase.md
@~/.config/opencode/gsd/templates/phase-prompt.md
@~/.config/opencode/gsd/references/plan-format.md
@~/.config/opencode/gsd/references/scope-estimation.md
@~/.config/opencode/gsd/references/checkpoints.md
@~/.config/opencode/gsd/references/tdd.md
</execution_context>

<context>
Phase number: $ARGUMENTS (optional - auto-detects next unplanned phase if not provided)

**Load project state first:**
@.planning/STATE.md

**Load roadmap:**
@.planning/ROADMAP.md

**Load phase context if exists (created by /gsd/discuss-phase):**
Check for and read `.planning/phases/XX-name/{phase}-CONTEXT.md` - contains research findings, clarifications, and decisions from phase discussion.

**Load codebase context if exists:**
Check for `.planning/codebase/` and load relevant documents based on phase type.
</context>

<process>
1. Check .planning/ directory exists (error if not - user should run /gsd/new-project)
2. If phase number provided via $ARGUMENTS, validate it exists in roadmap
3. If no phase number, detect next unplanned phase from roadmap
4. Follow plan-phase.md workflow:
   - Load project state and accumulated decisions
   - Perform mandatory discovery (Level 0-3 as appropriate)
   - Read project history (prior decisions, issues, concerns)
   - Break phase into tasks
   - Estimate scope and split into multiple plans if needed
   - Create PLAN.md file(s) with executable structure
</process>

<success_criteria>

- One or more PLAN.md files created in .planning/phases/XX-name/
- Each plan has: objective, execution_context, context, tasks, verification, success_criteria, output
- Tasks are specific enough for Claude to execute
- User knows next steps (execute plan or review/adjust)
  </success_criteria>
