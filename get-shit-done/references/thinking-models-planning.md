# Thinking Models: Planning Cluster

Structured reasoning models for the **planner** and **roadmapper** agents. Apply these at decision points during plan creation, not continuously. Each model counters a specific documented failure mode.

Source: Curated from [thinking-partner](https://github.com/mattnowdev/thinking-partner) model catalog (150+ models). Selected for direct applicability to GSD planning workflow.

## Conflict Resolution

Pre-Mortem and Constraint Analysis both analyze risk at different granularities. Run Constraint Analysis FIRST (identify the hardest constraint), then Pre-Mortem (enumerate failure modes around that constraint and the rest of the plan).

## 1. Pre-Mortem Analysis

**Counters:** Optimistic plan decomposition that ignores failure modes.

Before finalizing this plan, assume it has already failed. List the 3 most likely reasons for failure -- missing dependency, wrong decomposition, underestimated complexity -- and add mitigation steps or acceptance criteria that would catch each failure early.

## 2. MECE Decomposition

**Counters:** Overlapping tasks (merge conflicts) or gapped tasks (missing requirements).

Verify this task breakdown is MECE at the REQUIREMENT level: (1) list every requirement from the phase goal, (2) confirm each maps to exactly one task's `<done>`, (3) if two tasks modify the same file, confirm they modify DIFFERENT sections or serve DIFFERENT requirements, (4) flag any requirement not covered by any task.

## 3. Constraint Analysis

**Counters:** Deferring the hardest constraint to the last task, causing late-stage failures.

Identify the single hardest constraint in this phase -- the one thing that, if it doesn't work, makes everything else irrelevant. Schedule that constraint as Task 1 or 2, not last. If the constraint involves an external API or unfamiliar library, add a spike/proof-of-concept task before the main implementation.

## 4. Reversibility Test

**Counters:** Over-analyzing cheap decisions, under-analyzing costly ones.

For each significant decision in this plan, classify as REVERSIBLE (can change later with low cost) or IRREVERSIBLE (changing later requires migration, breaking changes, or significant rework). Spend analysis time proportional to irreversibility. For irreversible decisions, document the rationale in the plan.

## 5. Curse of Knowledge Counter

**Counters:** Plan-to-executor ambiguity from compressed instructions.

For each `<action>` step, re-read it as if you have NEVER seen this codebase. Is every noun unambiguous (which file? which function? which endpoint?)? Is every verb specific (add WHERE? modify HOW?)? If a step could be interpreted two ways, rewrite it. Include file paths, function names, and expected behavior in every action step.

## 6. Base Rate Neglect Counter

**Counters:** Planners ignoring low-confidence research caveats.

Before finalizing the plan, read ALL `[NEEDS DECISION]` items and LOW-confidence recommendations from SUMMARY.md. For each: either (a) create a `checkpoint:decision` task to resolve it, or (b) document why the risk is acceptable in the plan's deviation notes. LOW-confidence items that are silently accepted become undocumented technical debt.

## Gap Closure Mode: Root-Cause Check

**Applies only when:** Planner enters gap closure mode (triggered by `gaps_found` in VERIFICATION.md).

Before writing the fix plan, apply a single "why" round: Why did this gap occur? Was it a plan deficiency (wrong task), an execution miss (correct task, wrong implementation), or a changed assumption (environment/dependency shift)? The fix plan must target the root cause category, not just the symptom.

---

## When NOT to Think

Skip structured reasoning models when the situation does not benefit from them:

- **Single-task plans** -- If the phase has one clear requirement and one obvious task, do not run Pre-Mortem or MECE analysis. Write the task directly.
- **Well-researched phases** -- If RESEARCH.md has HIGH-confidence recommendations for every decision and no `[NEEDS DECISION]` items, skip Base Rate Neglect Counter. The research already resolved uncertainty.
- **Revision iterations** -- When revising a plan based on checker feedback, focus on fixing the flagged issues. Do not re-run the full model suite on every revision pass -- apply only the model relevant to the specific issue (e.g., MECE if the checker found a coverage gap).
- **Boilerplate plans** -- Configuration changes, version bumps, documentation updates. These do not have failure modes worth pre-mortem analysis.
