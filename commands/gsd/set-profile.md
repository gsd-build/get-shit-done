---
name: set-profile
description: Switch model profile for GSD agents (quality/balanced/budget/custom)
arguments:
  - name: profile
    description: "Profile name: quality, balanced, budget, or custom"
    required: true
---

<objective>
Switch the model profile used by GSD agents. This controls which Claude model each agent uses, balancing quality vs token spend.
</objective>

<profiles>
| Profile | Description |
|---------|-------------|
| **quality** | Opus everywhere except read-only verification |
| **balanced** | Opus for planning, Sonnet for execution/verification (default) |
| **budget** | Sonnet for writing, Haiku for research/verification |
| **custom** | User-defined model for each agent |
</profiles>

<process>

## 1. Validate argument

```
if $ARGUMENTS.profile not in ["quality", "balanced", "budget", "custom"]:
  Error: Invalid profile "$ARGUMENTS.profile"
  Valid profiles: quality, balanced, budget, custom
  STOP
```

## 1.5. Handle Custom Profile

If `$ARGUMENTS.profile` is "custom":

### Read existing custom config (if any)

```bash
# Check for existing custom_profile_models
EXISTING_CUSTOM=$(cat .planning/config.json 2>/dev/null | grep -o '"custom_profile_models"' || echo "")
```

### Prompt for each agent

Use AskUserQuestion for sequential single-select prompts. The 5 agents to configure (in this order):

1. **Planner (gsd-planner)** - default: opus (from balanced)
2. **Plan Checker (gsd-plan-checker)** - default: sonnet (from balanced)
3. **Executor (gsd-executor)** - default: sonnet (from balanced)
4. **Verifier (gsd-verifier)** - default: sonnet (from balanced)
5. **Codebase Mapper (gsd-codebase-mapper)** - default: haiku (from balanced)

For each agent, prompt:

```
AskUserQuestion([
  {
    question: "What model for {Friendly Name} ({gsd-agent-name})?",
    header: "Custom Profile",
    multiSelect: false,
    options: [
      { label: "Opus", description: "Maximum reasoning power" },
      { label: "Sonnet", description: "Balanced quality/speed (default)" },
      { label: "Haiku", description: "Fast and economical" }
    ]
  }
])
```

Store each selection (convert label to lowercase: "Opus" -> "opus").

### Show summary table

After all 5 agents configured, display:

```
Configuration summary:

| Agent | Model |
|-------|-------|
| Planner (gsd-planner) | {selection} |
| Plan Checker (gsd-plan-checker) | {selection} |
| Executor (gsd-executor) | {selection} |
| Verifier (gsd-verifier) | {selection} |
| Codebase Mapper (gsd-codebase-mapper) | {selection} |

Save this configuration?
```

Use AskUserQuestion with Yes/No options.

### Handle confirmation

If "Yes": Continue to step 3 to save config.
If "No": Display "Custom configuration cancelled." and STOP (do not update config).

### Prepare config update

If confirmed, set:
- `model_profile` = "custom"
- `custom_profile_models` = map of agent name -> model selection

```json
{
  "model_profile": "custom",
  "custom_profile_models": {
    "gsd-planner": "{selection}",
    "gsd-plan-checker": "{selection}",
    "gsd-executor": "{selection}",
    "gsd-verifier": "{selection}",
    "gsd-codebase-mapper": "{selection}"
  }
}
```

Then proceed to step 3 (Update config.json).

## 2. Check for project

```bash
ls .planning/config.json 2>/dev/null
```

If no `.planning/` directory:
```
Error: No GSD project found.
Run /gsd:new-project first to initialize a project.
```

## 3. Update config.json

Read current config:
```bash
cat .planning/config.json
```

Update `model_profile` field (or add if missing):
```json
{
  "model_profile": "$ARGUMENTS.profile"
}
```

Write updated config back to `.planning/config.json`.

## 4. Confirm

```
✓ Model profile set to: $ARGUMENTS.profile

Agents will now use:
[Show table from model-profiles.md for selected profile]

Next spawned agents will use the new profile.
```

</process>

<examples>

**Switch to budget mode:**
```
/gsd:set-profile budget

✓ Model profile set to: budget

Agents will now use:
| Agent | Model |
|-------|-------|
| gsd-planner | sonnet |
| gsd-executor | sonnet |
| gsd-verifier | haiku |
| ... | ... |
```

**Switch to quality mode:**
```
/gsd:set-profile quality

✓ Model profile set to: quality

Agents will now use:
| Agent | Model |
|-------|-------|
| gsd-planner | opus |
| gsd-executor | opus |
| gsd-verifier | sonnet |
| ... | ... |
```

</examples>
