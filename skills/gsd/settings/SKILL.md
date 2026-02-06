---
name: settings
description: Configure GSD workflow toggles and model profile Opus everywhere except verification (highest cost) }, Opus for planning, Sonnet for execution/verification }, Sonnet for writing, Haiku for research/verification (lowest cost) } Research phase goals before planning }, Skip research, plan directly } Verify plans meet phase goals }, Skip plan verification } Verify must-haves after execution }, Skip post-execution verification } Commit directly to current branch }, Create branch for each phase (gsd/phase-{N}-{name}) }, Create branch for entire milestone (gsd/{version}-{name}) }
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# settings Skill

## Objective

Allow users to toggle workflow agents on/off and select model profile via interactive settings.
Updates `.planning/config.json` with workflow preferences and model profile selection.
## 1. Ensure config exists
```bash

## When to Use



## Process

## 1. Ensure config exists
```bash
ls .planning/config.json 2>/dev/null
```
If `.planning/config.json` missing, create it with defaults:
```bash
mkdir -p .planning
```
```json
{
  "model_profile": "balanced",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  }
}
```
Write this to `.planning/config.json`, then continue.
## 2. Read Current Config
```bash
cat .planning/config.json
```
Parse current values (default to `true` if not present):
- `workflow.research` — spawn researcher during plan-phase
- `workflow.plan_check` — spawn plan checker during plan-phase
- `workflow.verifier` — spawn verifier during execute-phase
- `model_profile` — which model each agent uses (default: `balanced`)
- `git.branching_strategy` — branching approach (default: `"none"`)
## 3. Present Settings
Use AskUserQuestion with current values shown:
```
AskUserQuestion([
  {
    question: "Which model profile for agents?",
    header: "Model",
    multiSelect: false,
    options: [
      { label: "Quality", description: "Opus everywhere except verification (highest cost)" },
      { label: "Balanced (Recommended)", description: "Opus for planning, Sonnet for execution/verification" },
      { label: "Budget", description: "Sonnet for writing, Haiku for research/verification (lowest cost)" }

## Success Criteria

- [ ] Current config read
- [ ] User presented with 5 settings (profile + 3 workflow toggles + git branching)
- [ ] Config updated with model_profile, workflow, and git sections
- [ ] Changes confirmed to user

## Examples

### Example Usage
[TBD: Add specific examples of when and how to use this skill]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
