# Adaptive Model Selection

The `adaptive` profile auto-selects models per-plan based on complexity evaluation, achieving 35-65% cost savings while maintaining quality where it matters.

## How It Works

1. Plan metadata (files modified, task count, objective keywords) is evaluated
2. A complexity score (0-10+) is computed
3. The score maps to a tier: Simple, Medium, or Complex
4. Each tier defines which model each agent uses

## Scoring Algorithm

| Factor | Points | Signal |
|--------|--------|--------|
| Files modified | 1pt each (max 5) | `context.files_modified.length` |
| Task count | 0-2pts | 3-5 tasks = 1pt, 6+ = 2pts |
| Architecture keywords | +3pts | `architect`, `system design`, `data model` |
| Integration keywords | +2pts | `integrat*`, `external api`, `third party`, `webhook` |
| Cross-cutting keywords | +2pts | `cross cutting`, `multiple modules`, `refactor across` |
| Novel pattern keywords | +3pts | `new library`, `unfamiliar`, `prototype` |
| Refactoring keywords | +1pt | `refactor`, `restructure`, `migrate` |
| TDD plan type | +2pts | `context.plan_type === 'tdd'` |
| Dependencies | +1pt | `context.depends_on.length > 0` |
| Test files | +1pt | Files matching `.(test|spec).[tj]sx?` or `__tests__` in `files_modified` |

## Tier Definitions

| Tier | Score Range | Description |
|------|-------------|-------------|
| Simple | 0-3 | Small changes, few files, no architectural concerns |
| Medium | 4-7 | Moderate scope, some complexity factors |
| Complex | 8+ | Large scope, architectural decisions, novel patterns |

## Tier-to-Model Mapping

| Agent | Simple | Medium | Complex |
|-------|--------|--------|---------|
| gsd-planner | sonnet | opus | opus |
| gsd-roadmapper | sonnet | sonnet | opus |
| gsd-executor | haiku | sonnet | sonnet |
| gsd-phase-researcher | haiku | sonnet | opus |
| gsd-project-researcher | haiku | sonnet | opus |
| gsd-research-synthesizer | haiku | sonnet | sonnet |
| gsd-debugger | sonnet | sonnet | opus |
| gsd-codebase-mapper | haiku | haiku | sonnet |
| gsd-verifier | haiku | sonnet | sonnet |
| gsd-plan-checker | haiku | sonnet | sonnet |
| gsd-integration-checker | haiku | sonnet | sonnet |

## Config Schema

```json
{
  "model_profile": "adaptive",
  "adaptive_settings": {
    "min_model": "sonnet",
    "max_model": "opus",
    "log_selections": false
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `min_model` | string | none | Floor model — never select below this tier |
| `max_model` | string | none | Ceiling model — never select above this tier |
| `log_selections` | boolean | false | When true, appends each model selection to `.planning/adaptive-usage.json` with timestamp, agent, tier, score, and model |

### Clamping Examples

- `min_model: "sonnet"` — Simple plans that would get haiku are upgraded to sonnet
- `max_model: "sonnet"` — Complex plans that would get opus are capped at sonnet
- Both set — constrains to a single model tier

## Default Behavior

When adaptive is active but no plan context is available (e.g., during init), defaults to **medium tier** (score 5). This is a safe middle ground that avoids under-provisioning.

## Resolution Logic

```
1. Check model_overrides for agent-specific override (highest priority)
2. If adaptive profile:
   a. Evaluate complexity from plan context
   b. Look up model from ADAPTIVE_TIERS[tier][agentType]
   c. Clamp to min_model / max_model bounds
   d. Return result ('opus', 'sonnet', or 'haiku')
3. Non-adaptive: standard profile table lookup
```

Per-agent overrides always take precedence over adaptive selection.

## CLI Usage

```bash
# Resolve with plan context
node gsd-tools.cjs resolve-adaptive-model gsd-executor \
  --context '{"files_modified":["a.js"],"task_count":1,"objective":"fix typo"}'
# Returns: haiku, simple tier

# Complex plan
node gsd-tools.cjs resolve-adaptive-model gsd-planner \
  --context '{"files_modified":["a.js","b.js","c.js","d.js","e.js"],"task_count":8,"objective":"architect new integration with external API"}'
# Returns: opus, complex tier
```

## Workflow Integration

In `execute-phase`, when `model_profile === 'adaptive'`:

1. Load plan metadata from `phase-plan-index`
2. Call `resolve-adaptive-model` per-plan with metadata as context
3. Display complexity tier and model in wave description
4. Spawn executor with the resolved model

Non-adaptive profiles ignore plan context entirely — full backward compatibility.
