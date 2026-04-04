# Model Profile Resolution

How GSD resolves which model to use for a given agent. Orchestrators reference this when spawning agents via Task().

## Resolution Order

1. **Per-agent override** -- Check `model_overrides.<agent>` in config.json (or `models.<agent>` via config-set)
2. **Profile table** -- Look up agent in MODEL_PROFILES for the active `model_profile`
3. **Fallback** -- If agent not in table, use `sonnet`

## Config Keys

| Key | Purpose | Example |
|-----|---------|---------|
| `model_profile` | Active profile preset | `"balanced"`, `"adaptive"` |
| `model_overrides.<agent>` | Per-agent override (JSON) | `{ "gsd-planner": "opus" }` |
| `models.<agent>` | Per-agent override (config-set) | `config-set models.gsd-planner opus` |

Both `models` and `model_overrides` are read by loadConfig. `models` takes precedence if both exist.

## Special Values

- `inherit` -- profile value: all agents use the session's current model. NOT stored in MODEL_PROFILES; handled as a special case in resolveModelInternal.
- `"omit"` -- resolve_model_ids setting: returns empty string so runtime uses its default model. For non-Claude runtimes.

## Implementation

Resolution happens in `resolveModelInternal` (core.cjs):

```
resolveModelInternal(cwd, agentType):
  config = loadConfig(cwd)
  if config.model_overrides[agentType] exists -> return it
  if config.resolve_model_ids === 'omit' -> return ''
  profile = config.model_profile (default: 'balanced')
  if profile === 'inherit' -> return 'inherit'
  alias = MODEL_PROFILES[agentType][profile] (fallback: 'sonnet')
  if config.resolve_model_ids === true -> return MODEL_ALIAS_MAP[alias]
  return alias
```

## Profiles

| Profile | Strategy |
|---------|----------|
| `quality` | Opus for decision-making, Sonnet for verification |
| `balanced` | Opus for planning only, Sonnet everywhere else |
| `adaptive` | Sonnet for reasoning agents, Haiku for mechanical agents |
| `budget` | Sonnet for code-writing, Haiku for research/verification |
| `inherit` | All agents use session's current model |

See `model-profiles.md` for the full agent-to-model mapping table.

## Usage Pattern

Orchestrators resolve once at the start, then pass to each Task spawn:

```
1. Read .planning/config.json
2. Check model_overrides for agent-specific override
3. If no override, look up agent in profile table
4. Pass model parameter to Task call
```
