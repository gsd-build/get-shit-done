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

## Codex alias mapping

When running under Codex, map the resolved aliases to concrete Codex models:

| Alias | Codex model | Reasoning effort |
|-------|-------------|------------------|
| `inherit` (`opus` tier) | `gpt-5.3-codex` | `xhigh` |
| `sonnet` | `gpt-5.3-spark` | `xhigh` |
| `haiku` | `gpt-5.1-codex-mini` | `high` |

## Usage

1. Resolve once at orchestration start
2. Store the profile value
3. Look up each agent's model from the table when spawning
4. Pass model parameter to each Task call (values: `"inherit"`, `"sonnet"`, `"haiku"`)
5. In Codex mode, translate those aliases with the table above before spawning subagents
