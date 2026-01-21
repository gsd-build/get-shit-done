# Evaluate Task Complexity for Adaptive Model Selection

<purpose>
Evaluate task complexity and select appropriate Claude model when using adaptive profile.

This workflow is referenced by orchestrators (execute-phase, plan-phase, etc.) to enable intelligent model selection based on task characteristics.
</purpose>

<when_to_use>
**Use this workflow when:**
- `model_profile` in config.json is "adaptive"
- About to spawn an agent via Task tool
- Need to determine which model to use

**Skip this workflow when:**
- Using static profile (quality/balanced/budget)
- Agent doesn't support model parameter
- Task type is always fixed complexity (e.g., codebase-mapper always uses sonnet)
</when_to_use>

<required_reading>
@~/.claude/get-shit-done/references/adaptive-model-selection.md
@~/.claude/get-shit-done/references/model-profiles.md
@.planning/config.json
</required_reading>

<process>

<step name="check_adaptive_enabled">
Read `.planning/config.json`:

```bash
cat .planning/config.json
```

Check if `model_profile` is "adaptive".

If not adaptive:
- Use static profile model selection
- Exit this workflow

If adaptive:
- Proceed to complexity evaluation
</step>

<step name="gather_task_context">
Collect information about the task to be executed:

**From PLAN.md (if executing plan):**
```bash
# Count files mentioned in <files> tags
FILES_COUNT=$(grep -oP '<files>.*?</files>' PLAN.md | wc -l)

# Check for novel patterns (new imports, unfamiliar libraries)
NOVEL_PATTERNS=$(grep -i "new library\|unfamiliar\|first time\|novel" PLAN.md)

# Check for architecture work
ARCH_WORK=$(grep -i "architecture\|design decision\|system structure" PLAN.md)

# Check for cross-cutting concerns
CROSS_CUTTING=$(grep -i "spans\|multiple subsystems\|cross-cutting" PLAN.md)
```

**From phase context (if planning):**
- Phase type (planning = +3 complexity)
- Research phase (research = +3 complexity)
- Verification (verification = +2 complexity)

**From agent type:**
- gsd-planner: Usually high complexity (architecture decisions)
- gsd-executor: Varies based on plan complexity
- gsd-researcher: Medium complexity
- gsd-verifier: Medium complexity
</step>

<step name="calculate_complexity_score">
Calculate complexity score using scoring system:

```
score = 0

# Factor 1: Files to modify (1pt each, max 5)
score += min(files_count, 5)

# Factor 2: Novel patterns (+3pts)
if novel_patterns_detected:
  score += 3

# Factor 3: Cross-cutting concerns (+2pts)
if spans_subsystems:
  score += 2

# Factor 4: Architecture work (+3pts)
if planning_phase OR design_decisions:
  score += 3

# Factor 5: Integration complexity (+2pts)
if external_apis OR complex_dependencies:
  score += 2

# Factor 6: Large refactoring (+1pt)
if refactoring AND files_count > 3:
  score += 1
```

Store final score.
</step>

<step name="select_model_by_score">
Select model based on complexity score and adaptive settings:

Read adaptive_settings from config.json:
```json
{
  "adaptive_settings": {
    "prefer_cost_optimization": true,
    "min_model": "haiku",
    "max_model": "opus"
  }
}
```

**Selection logic:**

```
if score <= 3:  # Simple
  if prefer_cost_optimization:
    selected_model = "haiku"
  else:
    selected_model = "sonnet"

elif score <= 7:  # Medium
  selected_model = "sonnet"

else:  # Complex (8+)
  selected_model = "opus"

# Apply min/max constraints
if selected_model < min_model:
  selected_model = min_model
if selected_model > max_model:
  selected_model = max_model
```

Store selected_model for Task invocation.
</step>

<step name="log_selection">
If `adaptive_settings.log_selections` is true:

Append to `.planning/usage.json`:

```json
{
  "timestamp": "2026-01-21T10:30:00Z",
  "task_type": "execution",
  "task_id": "phase-3-plan-1",
  "complexity_score": 4,
  "selected_model": "sonnet",
  "reason": "medium_complexity",
  "factors": {
    "files_count": 4,
    "novel_patterns": false,
    "architecture": false,
    "cross_cutting": false
  }
}
```

Create file if it doesn't exist. Ensure valid JSON structure.
</step>

<step name="output_selection">
Return selected model to orchestrator:

**Output format:**
```
SELECTED_MODEL={haiku|sonnet|opus}
COMPLEXITY_SCORE={score}
SELECTION_REASON={simple|medium|complex}_complexity
```

Orchestrator uses SELECTED_MODEL in Task tool invocation.
</step>

</process>

<rate_limit_handling>

If Task tool returns rate limit error:

<step name="handle_rate_limit">

1. **Identify current model:**
   - opus → fallback to sonnet
   - sonnet → fallback to haiku
   - haiku → wait 60s, retry with haiku

2. **Log fallback event:**
   ```json
   {
     "timestamp": "2026-01-21T10:35:00Z",
     "task_type": "execution",
     "task_id": "phase-3-plan-1",
     "original_model": "opus",
     "fallback_model": "sonnet",
     "reason": "rate_limit",
     "retry_attempt": 1
   }
   ```

3. **Check for team plan:**
   If `claude_plan_type` is "team" in config.json:
   ```
   ⚠️ Rate limit reached for {original_model}.

   Automatically falling back to {fallback_model}.

   Your Claude Team Account may hit rate limits frequently
   with GSD. Run /gsd:check-plan for recommendations.
   ```

4. **Retry with fallback model:**
   - Update SELECTED_MODEL to fallback
   - Invoke Task tool again with new model
   - If still rate limited and on haiku: wait 60s, retry once more
   - If retry fails: report error to user

</step>

</rate_limit_handling>

<success_criteria>
- [ ] Adaptive profile detected from config
- [ ] Task context gathered (files, patterns, architecture)
- [ ] Complexity score calculated (0-10+)
- [ ] Model selected based on score and settings
- [ ] Selection logged to usage.json (if enabled)
- [ ] Selected model returned to orchestrator
- [ ] Rate limit fallback handled automatically
</success_criteria>

<example_evaluation>

**Task: Add user profile endpoint**
```
Files: 2 (routes.ts, handlers.ts)
Novel patterns: No (established CRUD)
Architecture: No
Cross-cutting: No
External APIs: No
Refactoring: No

Score: 2 (files only)
Result: Simple → haiku or sonnet
```

**Task: Implement JWT refresh rotation**
```
Files: 4 (auth.ts, middleware.ts, routes.ts, tests.ts)
Novel patterns: No (familiar security patterns)
Architecture: No
Cross-cutting: No
External APIs: No
Refactoring: No

Score: 4 (files only)
Result: Medium → sonnet
```

**Task: Design rate limiting architecture**
```
Files: 8+ (new subsystem)
Novel patterns: Yes (new approach to rate limiting)
Architecture: Yes (design decision)
Cross-cutting: Yes (affects multiple layers)
External APIs: Possibly (Redis, external rate limit service)
Refactoring: No

Score: 5 (files) + 3 (novel) + 3 (arch) + 2 (cross) + 2 (integration) = 15
Result: Complex → opus
```

</example_evaluation>
