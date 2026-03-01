# Model Profiles

Model profiles control which Claude model each GSD agent uses. This allows balancing quality vs token spend.

## Profile Definitions

| Agent | `quality` | `balanced` | `budget` | `adaptive` |
|-------|-----------|------------|----------|------------|
| gsd-planner | opus | opus | sonnet | sonnet→opus |
| gsd-roadmapper | opus | sonnet | sonnet | sonnet→opus |
| gsd-executor | opus | sonnet | sonnet | haiku→sonnet |
| gsd-phase-researcher | opus | sonnet | haiku | haiku→opus |
| gsd-project-researcher | opus | sonnet | haiku | haiku→opus |
| gsd-research-synthesizer | sonnet | sonnet | haiku | haiku→sonnet |
| gsd-debugger | opus | sonnet | sonnet | sonnet→opus |
| gsd-codebase-mapper | sonnet | haiku | haiku | haiku→sonnet |
| gsd-verifier | sonnet | sonnet | haiku | haiku→sonnet |
| gsd-plan-checker | sonnet | sonnet | haiku | haiku→sonnet |
| gsd-integration-checker | sonnet | sonnet | haiku | haiku→sonnet |

*Adaptive column shows the range: simple tier → complex tier. Actual model depends on per-plan complexity evaluation.*

## Profile Philosophy

**quality** - Maximum reasoning power
- Opus for all decision-making agents
- Sonnet for read-only verification
- Use when: quota available, critical architecture work

**balanced** (default) - Smart allocation
- Opus only for planning (where architecture decisions happen)
- Sonnet for execution and research (follows explicit instructions)
- Sonnet for verification (needs reasoning, not just pattern matching)
- Use when: normal development, good balance of quality and cost

**budget** - Minimal Opus usage
- Sonnet for anything that writes code
- Haiku for research and verification
- Use when: conserving quota, high-volume work, less critical phases

**adaptive** - Per-plan complexity-based selection
- Evaluates plan metadata (files, tasks, objective keywords) to score complexity 0-10+
- Simple plans (0-3): haiku for executors, sonnet for planners
- Medium plans (4-7): sonnet across the board
- Complex plans (8+): opus for planners/researchers, sonnet for executors
- Use when: mixed-complexity projects, optimizing cost without manual profile switching
- See `references/adaptive-model-selection.md` for full algorithm

## Resolution Logic

Orchestrators resolve model before spawning:

```
1. Read .planning/config.json
2. Check model_overrides for agent-specific override
3. If adaptive profile:
   a. Evaluate complexity from plan context (files, tasks, objective)
   b. Map score to tier (simple/medium/complex)
   c. Look up model from ADAPTIVE_TIERS[tier][agentType]
   d. Clamp to adaptive_settings.min_model / max_model bounds
4. If non-adaptive: look up agent in static profile table
5. Pass model parameter to Task call
```

## Per-Agent Overrides

Override specific agents without changing the entire profile:

```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "gsd-executor": "opus",
    "gsd-planner": "haiku"
  }
}
```

Overrides take precedence over the profile. Valid values: `opus`, `sonnet`, `haiku`.

## Switching Profiles

Runtime: `/gsd:set-profile <profile>`

Per-project default: Set in `.planning/config.json`:
```json
{
  "model_profile": "balanced"
}
```

## Design Rationale

**Why Opus for gsd-planner?**
Planning involves architecture decisions, goal decomposition, and task design. This is where model quality has the highest impact.

**Why Sonnet for gsd-executor?**
Executors follow explicit PLAN.md instructions. The plan already contains the reasoning; execution is implementation.

**Why Sonnet (not Haiku) for verifiers in balanced?**
Verification requires goal-backward reasoning - checking if code *delivers* what the phase promised, not just pattern matching. Sonnet handles this well; Haiku may miss subtle gaps.

**Why Haiku for gsd-codebase-mapper?**
Read-only exploration and pattern extraction. No reasoning required, just structured output from file contents.

**Why `opus` and not `inherit`?**
GSD passes `"opus"` directly to Claude Code's Task tool, which resolves it to the current
Opus model version. Earlier versions used `"inherit"` to avoid org-policy version conflicts,
but this silently downgraded agents to Sonnet when the parent session ran on Sonnet (the
default). Passing `"opus"` explicitly ensures quality-profile agents actually run on Opus.
If an org policy blocks Opus, the Task call will fail with a clear error rather than
silently running on the wrong model.
