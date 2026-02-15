---
name: gsdf:set-profile
description: Switch model profile for GSDF agents (independent from /gsd:set-profile)
argument-hint: "<profile: quality | balanced | budget>"
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Set the model profile used by GSDF agents. This is SEPARATE from the official GSD profile.

Allows running GSDF on budget while keeping full GSD on quality.
</objective>

<profiles>
| Profile | Description |
|---------|-------------|
| **quality** | Opus for planning, Sonnet for execution |
| **balanced** | Sonnet everywhere (default) |
| **budget** | Sonnet for planning, Haiku for execution/research |
</profiles>

<model_lookup>
| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-planner-core | opus | sonnet | sonnet |
| gsd-executor-core | sonnet | sonnet | haiku |
| gsd-debugger-core | sonnet | sonnet | haiku |
| gsd-phase-researcher-core | opus | sonnet | haiku |
| gsd-project-researcher | opus | sonnet | haiku |
| gsd-roadmapper | opus | sonnet | sonnet |
| gsd-integration-checker | sonnet | sonnet | haiku |
| gsd-codebase-mapper | sonnet | sonnet | haiku |
</model_lookup>

<process>

## 1. Validate Argument

```bash
PROFILE="$ARGUMENTS"
if [[ ! "$PROFILE" =~ ^(quality|balanced|budget)$ ]]; then
  echo "ERROR: Invalid profile '$PROFILE'"
  echo "Valid profiles: quality, balanced, budget"
  exit 1
fi
```

## 2. Check for Project

```bash
if [ ! -f .planning/config.json ]; then
  echo "ERROR: No GSD project found."
  echo "Run /gsd:new-project or /gsdf:new-project first."
  exit 1
fi
```

## 3. Read Current Config

```bash
cat .planning/config.json
```

Parse current values.

## 4. Update Config

Add or update `model_profile_gsdf` field (separate from `model_profile`):

```json
{
  "model_profile": "quality",
  "model_profile_gsdf": "budget",
  ...
}
```

Write updated config to `.planning/config.json`.

## 5. Confirm

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► PROFILE SET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**GSDF profile:** {profile}
**Full GSD profile:** {model_profile from config}

GSDF agents will now use:

| Agent | Model |
|-------|-------|
| gsd-planner-core | {model} |
| gsd-executor-core | {model} |
| gsd-debugger-core | {model} |
| gsd-phase-researcher-core | {model} |

---

**Note:** This is independent from `/gsd:set-profile`.
- `/gsdf:*` commands use `model_profile_gsdf`
- `/gsd:*` commands use `model_profile`
```

</process>

<examples>

**Run GSDF on budget, keep full GSD on quality:**
```
/gsd:set-profile quality
/gsdf:set-profile budget

Config:
{
  "model_profile": "quality",
  "model_profile_gsdf": "budget"
}
```

**Both on balanced:**
```
/gsd:set-profile balanced
/gsdf:set-profile balanced
```

</examples>

<success_criteria>
- [ ] Profile argument validated
- [ ] config.json updated with `model_profile_gsdf`
- [ ] Confirmation shows both profiles
- [ ] User understands separation
</success_criteria>
