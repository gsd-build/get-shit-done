<adaptive_model_selection>

Intelligent model selection based on task complexity to optimize cost and speed while maintaining quality.

## Overview

The adaptive profile automatically selects the appropriate Claude model (Haiku, Sonnet, Opus) based on task complexity evaluation. This optimizes token costs and execution speed without sacrificing quality on complex tasks.

**When to use:**
- Cost optimization is important
- Tasks vary significantly in complexity
- Rate limits are a concern (especially on Team plans)

**When not to use:**
- Quality is paramount regardless of cost (use `quality` profile)
- Tasks are consistently complex (use `quality` or `balanced`)
- Prefer predictability over optimization (use static profiles)

## Complexity Evaluation

### Scoring System

Tasks are scored 0-10+ based on multiple factors:

| Factor | Points | Examples |
|--------|--------|----------|
| **Files Modified** | 1 point per file (max 5) | 1 file = 1pt, 6+ files = 5pts |
| **Novel Patterns** | +3 points | New library, new architecture, unfamiliar API |
| **Cross-Cutting** | +2 points | Changes span multiple subsystems |
| **Architecture** | +3 points | Design decisions, system structure |
| **Integration** | +2 points | External APIs, complex dependencies |
| **Refactoring** | +1 point | Large-scale code reorganization |

### Complexity Tiers

Based on total score:

**Simple (0-3 points) → Haiku or Sonnet**
- Single file edits
- Following established patterns
- Configuration changes
- Documentation updates
- Simple CRUD operations
- Straightforward bug fixes

**Medium (4-7 points) → Sonnet**
- Multi-file changes (3-5 files)
- Standard feature implementation
- Refactoring with clear scope
- Test writing
- Bug fixes requiring investigation
- Existing pattern extension

**Complex (8+ points) → Opus**
- Architecture decisions
- Novel problem solving
- Cross-cutting concerns (6+ files)
- Planning phases
- Research and investigation
- New integrations
- System design

## Model Selection Logic

```javascript
function selectModel(task, config) {
  // Use static profile if not adaptive
  if (config.model_profile !== 'adaptive') {
    return getStaticProfileModel(config.model_profile, task.type);
  }

  // Evaluate complexity
  let score = 0;

  // Factor 1: Files to modify
  score += Math.min(task.files_count || 0, 5);

  // Factor 2: Novel patterns
  if (task.uses_new_library || task.new_architecture) {
    score += 3;
  }

  // Factor 3: Cross-cutting concerns
  if (task.spans_subsystems) {
    score += 2;
  }

  // Factor 4: Architecture work
  if (task.type === 'planning' || task.requires_design) {
    score += 3;
  }

  // Factor 5: Integration complexity
  if (task.external_apis || task.complex_dependencies) {
    score += 2;
  }

  // Factor 6: Large refactoring
  if (task.is_refactoring && task.files_count > 3) {
    score += 1;
  }

  // Select model based on score
  if (score <= 3) {
    return config.adaptive_settings.prefer_cost_optimization ? 'haiku' : 'sonnet';
  } else if (score <= 7) {
    return 'sonnet';
  } else {
    return 'opus';
  }
}
```

## Rate Limit Fallback

When a model hits rate limits, automatically fall back to the next tier:

**Fallback chain:**
1. Opus → Sonnet → Haiku
2. Sonnet → Haiku
3. Haiku → Wait 60s and retry

**Implementation:**

```xml
<rate_limit_handler>
On Task tool error indicating rate limit:

  1. Identify current model tier
  2. Select fallback model:
     - opus → sonnet
     - sonnet → haiku
     - haiku → wait 60s, retry with haiku

  3. Log fallback event to .planning/usage.json:
     {
       "timestamp": "2026-01-21T10:30:00Z",
       "task": "plan-phase-3",
       "original_model": "opus",
       "fallback_model": "sonnet",
       "reason": "rate_limit"
     }

  4. If team plan detected, show reminder:
     "⚠️ Rate limit reached for {model}. Falling back to {fallback}.
      Your Team plan may hit limits frequently with GSD.
      Run /gsd:check-plan for recommendations."

  5. Retry task with fallback model
</rate_limit_handler>
```

## Configuration

Adaptive settings in `.planning/config.json`:

```json
{
  "model_profile": "adaptive",
  "adaptive_settings": {
    "enable_auto_selection": true,
    "prefer_cost_optimization": true,
    "fallback_on_rate_limit": true,
    "min_model": "haiku",
    "max_model": "opus",
    "log_selections": true
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `enable_auto_selection` | `true` | Enable adaptive selection (false = use balanced profile) |
| `prefer_cost_optimization` | `true` | Prefer Haiku over Sonnet for simple tasks |
| `fallback_on_rate_limit` | `true` | Automatically retry with smaller model on rate limit |
| `min_model` | `"haiku"` | Minimum model to use (haiku/sonnet/opus) |
| `max_model` | `"opus"` | Maximum model to use (haiku/sonnet/opus) |
| `log_selections` | `true` | Log model selections to .planning/usage.json |

## Usage Logging

Track model usage in `.planning/usage.json`:

```json
{
  "sessions": [
    {
      "date": "2026-01-21",
      "tasks": [
        {
          "time": "10:30:00Z",
          "type": "execution",
          "task_id": "phase-3-plan-1",
          "complexity_score": 4,
          "selected_model": "sonnet",
          "reason": "medium_complexity",
          "fallback": null
        },
        {
          "time": "10:35:00Z",
          "type": "planning",
          "task_id": "phase-4",
          "complexity_score": 9,
          "selected_model": "opus",
          "reason": "high_complexity",
          "fallback": null
        }
      ]
    }
  ],
  "summary": {
    "haiku_tasks": 18,
    "sonnet_tasks": 12,
    "opus_tasks": 3,
    "estimated_savings_vs_quality": "62%",
    "estimated_savings_vs_balanced": "35%"
  }
}
```

## Workflow Integration

Each orchestrator evaluates complexity before spawning agents:

```xml
<step name="evaluate_complexity_and_select_model">

If model_profile is "adaptive":

  Read task context:
  - Count files from <files> tags in PLAN.md
  - Check for novel_patterns indicators (new imports, unfamiliar APIs)
  - Assess integration_complexity (external services mentioned)
  - Detect architecture work (phase type, design decisions)

  Calculate complexity score using scoring system.

  Select model based on score and adaptive_settings.

  Log selection to .planning/usage.json if log_selections enabled.

  Store selected_model for Task tool invocation.

Else:
  Use model from static profile (quality/balanced/budget).

</step>

<step name="spawn_agent_with_adaptive_model">

Invoke Task tool with selected model:

```bash
Task(
  subagent_type="gsd-executor",
  model=selected_model,
  prompt="..."
)
```

If rate limit error:
  Apply rate_limit_handler logic (see above).
  Retry with fallback model.

</step>
```

## Example: Plan Execution

**Scenario:** Executing phase 3 with 3 plans

```
Plan 3-1: Add user profile endpoint
  Files: 2 (routes.ts, handlers.ts)
  Pattern: Established CRUD pattern
  Score: 2 (files) + 0 (pattern known) = 2 → Simple
  Selected: haiku (cost optimized) or sonnet (quality preferred)

Plan 3-2: Implement JWT refresh rotation
  Files: 4 (auth.ts, middleware.ts, routes.ts, tests.ts)
  Pattern: Security-critical, some novel logic
  Score: 4 (files) + 0 (familiar pattern) = 4 → Medium
  Selected: sonnet

Plan 3-3: Design rate limiting architecture
  Files: 8+ (new subsystem)
  Pattern: Architecture decision, new approach
  Score: 5 (files) + 3 (architecture) + 2 (cross-cutting) = 10 → Complex
  Selected: opus
```

**Result:** Mix of models optimized for each task's needs.

## Benefits

**Cost Savings:**
- 35-65% reduction in token costs vs. static profiles
- Haiku for simple tasks (10× cheaper than Opus)
- Opus only when truly needed

**Speed:**
- Haiku completes simple tasks ~2× faster than Sonnet
- Reduces wait time for straightforward operations
- Parallelization more effective with faster models

**Quality Maintained:**
- Complex tasks still use Opus
- Architecture and planning get best model
- No compromise on critical decisions

**Rate Limit Resilience:**
- Automatic fallback on limits
- Graceful degradation
- Continues working instead of blocking

## Comparison to Static Profiles

| Profile | Opus Tasks | Sonnet Tasks | Haiku Tasks | Relative Cost |
|---------|------------|--------------|-------------|---------------|
| Quality | 90% | 10% | 0% | 100% (baseline) |
| Balanced | 30% | 65% | 5% | 45% |
| Budget | 0% | 70% | 30% | 28% |
| **Adaptive** | 10% | 40% | 50% | **35-40%** |

*Percentages based on typical GSD project with mixed complexity tasks.*

## Best Practices

**Do:**
- Enable adaptive for projects with varied task complexity
- Set `prefer_cost_optimization: true` for cost-sensitive work
- Review `.planning/usage.json` periodically to verify savings
- Use `min_model: "sonnet"` if Haiku quality is insufficient

**Don't:**
- Use adaptive for mission-critical production systems (use `quality`)
- Disable `fallback_on_rate_limit` (causes execution failures)
- Set `max_model: "haiku"` (limits quality on complex tasks)
- Ignore logged fallbacks (may indicate plan issues or rate limit problems)

**Team Plans:**
- Adaptive is highly recommended for Team accounts
- Reduces rate limit frequency by using smaller models
- Fallback mechanism prevents blocking on limits
- Combine with disabled optional agents for maximum reduction

</adaptive_model_selection>
