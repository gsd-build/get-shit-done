# Model Profile Resolution

Resolve model profile once at the start of orchestration, then use it for all Task spawns.

## Resolution Pattern

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

Default: `balanced` if not set or config missing.

## Lookup Table

@~/.claude/get-shit-done/references/model-profiles.md

Look up the agent in the table for the resolved profile. Pass the model parameter to Task calls:

```
Task(
  prompt="...",
  subagent_type="gsd-planner",
  model="{resolved_model}"  # "inherit", "sonnet", or "haiku"
)
```

**Note:** Opus-tier agents resolve to `"inherit"` (not `"opus"`). This causes the agent to use the parent session's model, avoiding conflicts with organization policies that may block specific opus versions.

## Adaptive Profile

When `model_profile` is `"adaptive"`, resolution is per-plan rather than per-project:

1. Pass plan metadata (files_modified, task_count, objective) as context
2. `evaluateComplexity(context)` scores 0-10+ and maps to simple/medium/complex tier
3. Model looked up from `ADAPTIVE_TIERS[tier][agentType]`
4. Clamped to `adaptive_settings.min_model` / `max_model` if configured

Use `resolve-adaptive-model` CLI command with `--context` for per-plan resolution.
See `references/adaptive-model-selection.md` for full algorithm.

## Usage

1. Resolve once at orchestration start (or per-plan if adaptive)
2. Store the profile value
3. Look up each agent's model from the table when spawning
4. Pass model parameter to each Task call (values: `"inherit"`, `"sonnet"`, `"haiku"`)
