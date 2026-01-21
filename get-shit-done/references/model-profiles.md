# Model Profiles

Model profiles control which Claude model each GSD agent uses. This allows balancing quality vs token spend.

## Profile Definitions

| Agent | `quality` | `balanced` | `budget` | `adaptive` |
|-------|-----------|------------|----------|------------|
| gsd-planner | opus | opus | sonnet | **evaluated** |
| gsd-roadmapper | opus | sonnet | sonnet | **evaluated** |
| gsd-executor | opus | sonnet | sonnet | **evaluated** |
| gsd-phase-researcher | opus | sonnet | haiku | **evaluated** |
| gsd-project-researcher | opus | sonnet | haiku | **evaluated** |
| gsd-research-synthesizer | sonnet | sonnet | haiku | **evaluated** |
| gsd-debugger | opus | sonnet | sonnet | **evaluated** |
| gsd-codebase-mapper | sonnet | haiku | haiku | sonnet |
| gsd-verifier | sonnet | sonnet | haiku | **evaluated** |
| gsd-plan-checker | sonnet | sonnet | haiku | **evaluated** |
| gsd-integration-checker | sonnet | sonnet | haiku | **evaluated** |

**Note:** "evaluated" means model is selected based on task complexity evaluation. See adaptive profile section below.

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

**adaptive** - Intelligent selection based on complexity
- Evaluates each task's complexity (0-10+ score)
- Simple tasks (0-3): haiku or sonnet
- Medium tasks (4-7): sonnet
- Complex tasks (8+): opus
- Automatic fallback on rate limits
- Use when: cost optimization important, varied task complexity, Team plan rate limits

**Complexity factors:**
- Files modified (1pt each, max 5)
- Novel patterns (+3pts: new libraries, unfamiliar APIs)
- Cross-cutting concerns (+2pts: spans subsystems)
- Architecture work (+3pts: design decisions)
- Integration complexity (+2pts: external APIs)
- Large refactoring (+1pt: 4+ files)

See `@~/.claude/get-shit-done/references/adaptive-model-selection.md` for full details.

## Resolution Logic

Orchestrators resolve model before spawning:

**Static profiles (quality/balanced/budget):**
```
1. Read .planning/config.json
2. Get model_profile (default: "balanced")
3. Look up agent in table above
4. Pass model parameter to Task call
```

**Adaptive profile:**
```
1. Read .planning/config.json
2. Check model_profile is "adaptive"
3. Evaluate task complexity (see adaptive-model-selection.md)
4. Select model based on score:
   - 0-3 points: haiku (cost) or sonnet (quality)
   - 4-7 points: sonnet
   - 8+ points: opus
5. Log selection to .planning/usage.json (if enabled)
6. Pass selected model to Task call
7. On rate limit: fallback to smaller model and retry
```

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

**Why adaptive for cost-sensitive work?**
Many tasks in GSD vary significantly in complexity. Simple CRUD operations don't need Opus, but architecture decisions do. Adaptive automatically optimizes model selection per task, achieving 35-65% cost savings vs static profiles while maintaining quality on complex work. Especially valuable for Team plans where rate limits are a concern.
