# Phase 7: Phase Execution Chain - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase refines the autonomous workflow's execute_phase step (3a→3b→3c→3d) to implement proper auto-chaining with correct flags, post-execution validation routing, and error recovery integration. The Skill() calls for plan-phase and execute-phase are preserved but enhanced with flags and post-invocation result handling.
</domain>

<decisions>
## Implementation Decisions

### Invocation Flags
- **plan-phase**: No `--auto` flag — without it, plan-phase plans and returns control to autonomous. With `--auto` it would chain to execute-phase internally, causing double execution
- **execute-phase**: Use `--no-transition` flag — prevents execute-phase from chaining to the next phase via transition.md. Autonomous manages all phase-to-phase transitions
- **No `Skill` needed in allowed-tools** — `Skill()` is a workflow-level construct, not a tool. Other commands (discuss-phase, plan-phase) use it without listing in allowed-tools
- **No custom `--autonomous` flag** — plan-phase and execute-phase function normally; autonomous controls flow externally

### Post-Execution Validation (EXEC-03)
- **execute-phase handles its own verification** via its built-in gsd-verifier. Autonomous reads the result. No duplication
- **`passed`**: Continue to next phase automatically — verification passed, no human input needed
- **`human_needed`**: Ask user — "Hay N items que requieren testing manual. ¿Validar ahora o continuar?" If user continues, log and proceed
- **`gaps_found`**: Offer gap closure via AskUserQuestion — "Se encontraron gaps. ¿Ejecutar gap closure, continuar sin gaps, o detener?" If gap closure: `Skill(plan-phase --gaps)` → re-execute
- Detection method: Read `{phase_dir}/*-VERIFICATION.md` after execute-phase, parse `status:` from frontmatter

### Interaction Surfacing & Error Recovery (EXEC-04)
- **No interception needed** — when plan-phase spawns researcher/planner that use AskUserQuestion, questions reach the user naturally through Skill() invocations
- **Plan-phase failure**: Go to handle_blocker — verify `has_plans` post-Skill, if false → blocker
- **Execute-phase failure**: Go to handle_blocker — execute-phase handles waves internally; if it fails, returns and autonomous detects
- **Partial failures**: Autonomous doesn't retry individual waves — execute-phase manages that internally

### Claude's Discretion
- Exact wording of validation prompts to user
- How to parse VERIFICATION.md frontmatter (grep vs read + parse)
- Whether to display verification summary before asking validation question
- Error detection heuristics for plan/execute failures
</decisions>

<code_context>
## Existing Code Insights

### Current execute_phase Step (autonomous.md lines 107-175)
- Step 3a: Smart discuss (inline, added in Phase 6)
- Step 3b: `Skill(skill="gsd:plan-phase", args="${PHASE_NUM}")` — no flags
- Step 3c: `Skill(skill="gsd:execute-phase", args="${PHASE_NUM}")` — no flags
- Step 3d: Transition message

### Plan-phase Flag Behavior (plan-phase.md)
- `--auto` → sets `_auto_chain_active`, chains to execute-phase after planning (line 480)
- Without `--auto` → plans and returns, offers next steps
- `--no-transition` used by execute-phase's auto-chain (line 483)

### Execute-phase Flag Behavior (execute-phase.md)
- `--auto` → chains to transition.md after verification (line 422-433)
- `--no-transition` → returns status after verification instead of chaining (line 394)
- Verification always runs (step verify_phase_goal, line 302)
- Three outcomes: `passed`, `human_needed`, `gaps_found` (lines 326-328)

### Integration Points
- VERIFICATION.md created by gsd-verifier with status in frontmatter
- handle_blocker already exists with retry/skip/stop options
- STATE.md updated by phase operations
</code_context>

<specifics>
## Specific References
- execute-phase.md:392-394 — `--no-transition` flag parsing
- execute-phase.md:302-360 — verify_phase_goal step with three outcomes
- execute-phase.md:326-328 — `passed | human_needed | gaps_found` routing
- plan-phase.md:448-504 — auto-advance/offer_next routing with `--auto` flag
- autonomous.md:107-175 — current execute_phase step to modify
</specifics>

<deferred>
## Deferred Ideas
- Custom `--autonomous` flag for plan/execute skills (unnecessary — external control works)
- Automatic retry before blocker escalation (adds complexity, current handle_blocker UX is sufficient)
- Wave-level retry on partial execute-phase failures (execute-phase handles this internally)
</deferred>
