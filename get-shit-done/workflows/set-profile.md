<purpose>
Switch the model profile used by GSD agents. Controls which Claude model each agent uses, balancing quality vs token spend.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="validate">
Validate argument:

```
if $ARGUMENTS.profile not in ["quality", "balanced", "budget", "auto"]:
  Error: Invalid profile "$ARGUMENTS.profile"
  Valid profiles: quality, balanced, budget, auto
  EXIT
```
</step>

<step name="ensure_and_load_config">
Ensure config exists and load current state:

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.js config-ensure-section
INIT_FILE="/tmp/gsd-init-$$.json"
node ~/.claude/get-shit-done/bin/gsd-tools.js state load > "$INIT_FILE"
```

This creates `.planning/config.json` with defaults if missing and loads current config.
</step>

<step name="update_config">
Read current config from state load or directly:

Update `model_profile` field:
```json
{
  "model_profile": "$ARGUMENTS.profile"
}
```

Write updated config back to `.planning/config.json`.
</step>

<step name="confirm">
Display confirmation with model table for selected profile:

```
✓ Model profile set to: $ARGUMENTS.profile

Agents will now use:

[Show table from MODEL_PROFILES in gsd-tools.js for selected profile]

Example:
| Agent | Model |
|-------|-------|
| gsd-planner | opus |
| gsd-executor | sonnet |
| gsd-verifier | haiku |
| ... | ... |

Next spawned agents will use the new profile.
```

Map profile names:
- quality: use "quality" column from MODEL_PROFILES
- balanced: use "balanced" column from MODEL_PROFILES
- budget: use "budget" column from MODEL_PROFILES
- auto: display auto mode documentation (see below)

For auto profile, instead of model table, show:

```
✓ Model profile set to: auto

## Auto Mode Enabled

Auto mode routes each task to the most appropriate model based on:
- Task description keyword matching against routing rules
- Project-specific overrides in `.planning/routing/project-rules.md`
- Global rules in `~/.claude/routing-rules.md`

When auto is active:
- Tasks are analyzed before spawning via gsd-task-router
- Model selection happens per-task, not per-workflow
- Token savings tracked in `.planning/quota/session-usage.json`
- Status bar shows: `Tokens: 32K → Haiku | +15 min | H:60% S:35% O:5%`

**Fallback behavior:** Sonnet when no patterns match (safety over savings)

To view stats:
- Quick status: `node ~/.claude/get-shit-done/bin/gsd-tools.js quota status-bar`
- Full breakdown: `node ~/.claude/get-shit-done/bin/gsd-tools.js quota stats --table`
```
</step>

</process>

<success_criteria>
- [ ] Argument validated
- [ ] Config file ensured
- [ ] Config updated with new model_profile
- [ ] Confirmation displayed with model table
</success_criteria>
