# Configuration Reference

GSD behavior is controlled by `.planning/config.json` in your project directory.

**Full schema reference:** See [`get-shit-done/templates/config-schema.md`](../templates/config-schema.md) for complete documentation of all configuration options.

This document focuses on **timeout configuration** specifically.

---

## Timeouts

Control expected duration for different agent types.

**Important:** These are expectations, not hard limits. See [Timeout Behavior](timeout-behavior.md) for how GSD handles agents that exceed expected duration.

### Configuration

Add a `timeouts` section to `.planning/config.json`:

```json
{
  "timeouts": {
    "executor": 600000,
    "planner": 300000,
    "verifier": 180000,
    "researcher": 420000,
    "debugger": 600000,
    "default": 300000
  }
}
```

All values are in **milliseconds**.

### Agent Type Reference

| Property | Default | Duration | When Used | Purpose |
|----------|---------|----------|-----------|---------|
| `executor` | 600000 | 10 min | Executing PLAN.md files | Complex plans with multiple tasks, commits, file operations |
| `planner` | 300000 | 5 min | Creating PLAN.md files | Planning is faster than execution, mostly markdown |
| `verifier` | 180000 | 3 min | Verifying work | Quick file reading and criteria checking |
| `researcher` | 420000 | 7 min | Researching before planning | Exploration, reading multiple files, synthesis |
| `debugger` | 600000 | 10 min | Diagnosing failures | Investigation, testing hypotheses, deeper analysis |
| `default` | 300000 | 5 min | Unspecified agents | Conservative middle ground |

### When to Adjust

#### Increase Timeouts

**Large/complex projects:**
```json
{
  "timeouts": {
    "executor": 900000,    // 15 min (+50%)
    "researcher": 600000,  // 10 min (+43%)
    "planner": 420000      // 7 min (+40%)
  }
}
```

Use when:
- Agents regularly complete successfully but exceed expected duration
- Project has large codebase (10k+ lines)
- Plans have many tasks (10+ per plan)
- Deep codebase exploration needed

#### Decrease Timeouts

**Quick experiments:**
```json
{
  "timeouts": {
    "executor": 300000,   // 5 min (-50%)
    "planner": 180000,    // 3 min (-40%)
    "verifier": 120000    // 2 min (-33%)
  }
}
```

Use when:
- Running quick prototypes
- Small project (< 1k lines)
- Simple plans (1-3 tasks each)
- Want faster feedback on failures

### Valid Ranges

- **Minimum:** 60000ms (1 minute)
  - Prevents unrealistic expectations
  - Agents need time to read context and work

- **Maximum:** 1800000ms (30 minutes)
  - Prevents indefinite waiting
  - If agents take this long, something is wrong

- **Invalid values:** Fall back to defaults with warning

### Example Configurations

#### Production Quality (Thorough)
```json
{
  "depth": "comprehensive",
  "model_profile": "quality",
  "timeouts": {
    "executor": 900000,
    "planner": 420000,
    "verifier": 300000,
    "researcher": 600000,
    "debugger": 900000
  }
}
```

#### Budget Mode (Fast & Cheap)
```json
{
  "depth": "quick",
  "model_profile": "budget",
  "timeouts": {
    "executor": 420000,
    "planner": 180000,
    "verifier": 120000,
    "researcher": 300000
  }
}
```

#### Balanced (Default)
```json
{
  "depth": "standard",
  "model_profile": "balanced",
  "timeouts": {
    "executor": 600000,
    "planner": 300000,
    "verifier": 180000,
    "researcher": 420000,
    "debugger": 600000,
    "default": 300000
  }
}
```

### How Timeouts Are Used

When GSD spawns an agent:

1. **Read config** - Parse `.planning/config.json` for timeout value
2. **Fall back to default** - If config missing or invalid, use default
3. **Show expectation** - Display expected duration to user before spawning
4. **Start timer** - Record start time
5. **Spawn agent** - Call Task() (blocks until complete)
6. **Measure duration** - Calculate actual time taken
7. **Check artifacts** - Verify agent produced expected outputs
8. **Report status** - Success/failure based on artifacts + duration

See [Timeout Behavior](timeout-behavior.md) for complete details on status reporting.

### Monitoring and Tuning

**Signs you should increase timeouts:**

- Agents regularly show "⚠️ took longer than expected but completed successfully"
- Actual durations consistently 20-50% over expected
- Work is completing correctly, just slower than expected

**Signs you should investigate (not just increase):**

- Agents regularly exceed by 100%+ (may indicate hanging)
- Timeouts followed by missing artifacts (actual failures)
- Inconsistent timing (sometimes 5 min, sometimes 20 min)

**Don't increase timeouts to hide problems.** If agents are failing or hanging, fix the root cause instead of just increasing limits.

### Implementation Details

GSD commands read timeout config using this pattern:

```bash
# Read from config, fall back to default
EXECUTOR_TIMEOUT=$(cat .planning/config.json 2>/dev/null | \
  grep -o '"executor"[[:space:]]*:[[:space:]]*[0-9]*' | \
  grep -o '[0-9]*' || echo "600000")
```

This approach:
- Works without jq dependency
- Handles missing config gracefully
- Falls back to hardcoded defaults
- Consistent across all commands

For integration details, see [`get-shit-done/utilities/task-timeout.md`](../utilities/task-timeout.md).

---

## Other Configuration

This document focuses on timeout configuration. For complete configuration reference including:

- Workflow mode (yolo vs interactive)
- Planning depth (quick vs comprehensive)
- Parallelization settings
- Model profiles
- Safety gates

See the **[Config Schema](../templates/config-schema.md)** for complete documentation.
