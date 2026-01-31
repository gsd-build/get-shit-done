---
name: gsd:settings
description: Configure GSD workflow toggles and model profile
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
---

<objective>
Allow users to toggle workflow agents on/off and select model profile via interactive settings.

Updates `.planning/config.json` with workflow preferences and model profile selection.
</objective>

<process>

## 1. Validate Environment

```bash
ls .planning/config.json 2>/dev/null
```

**If not found:** Error - run `/gsd:new-project` first.

## 2. Read Current Config

```bash
cat .planning/config.json
```

Parse current values (default to `true` if not present):
- `workflow.research` — spawn researcher during plan-phase
- `workflow.plan_check` — spawn plan checker during plan-phase
- `workflow.verifier` — spawn verifier during execute-phase
- `workflow.integration_check.enabled` — run integration check during complete-milestone (default: `true`)
- `workflow.integration_check.min_phases` — minimum phases to trigger integration check (default: `4`)
- `model_profile` — which model each agent uses (default: `balanced`)
- `optimization.level` — optimization level (default: `standard`)
- `optimization.context_budget.enabled` — context budget monitoring (default: `true`)
- `optimization.context_budget.thresholds` — warn: 40, suggest_split: 60, critical: 75
- `optimization.tiered_instructions` — use tiered instructions (default: `true`)
- `optimization.delta_context` — send only changed context (default: `true`)
- `optimization.lazy_references` — lazy load file contents (default: `true`)
- `optimization.compact_workflows` — compact workflow descriptions (default: `true`)
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
    ]
  },
  {
    question: "Spawn Plan Researcher? (researches domain before planning)",
    header: "Research",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Research phase goals before planning" },
      { label: "No", description: "Skip research, plan directly" }
    ]
  },
  {
    question: "Spawn Plan Checker? (verifies plans before execution)",
    header: "Plan Check",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Verify plans meet phase goals" },
      { label: "No", description: "Skip plan verification" }
    ]
  },
  {
    question: "Spawn Execution Verifier? (verifies phase completion)",
    header: "Verifier",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Verify must-haves after execution" },
      { label: "No", description: "Skip post-execution verification" }
    ]
  },
  {
    question: "Optimization Level",
    header: "Optimization",
    multiSelect: false,
    options: [
      { label: "Standard (Recommended)", description: "Balanced token savings with safety" },
      { label: "Aggressive", description: "Maximum savings, may need more retries" },
      { label: "Minimal", description: "v1.x behavior, no optimizations" }
    ]
  },
  {
    question: "Enable Context Budget Monitoring?",
    header: "Context Budget",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Monitor context usage with thresholds (warn: 40%, suggest_split: 60%, critical: 75%)" },
      { label: "No", description: "Disable context budget monitoring" }
    ]
  },
  {
    question: "Enable Tiered Instructions?",
    header: "Tiered Instructions",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Use concise instructions for simple tasks" },
      { label: "No", description: "Use full instructions for all tasks" }
    ]
  },
  {
    question: "Enable Delta Context?",
    header: "Delta Context",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Only send changed context between agent calls" },
      { label: "No", description: "Send full context every time" }
    ]
  },
  {
    question: "Enable Lazy References?",
    header: "Lazy References",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Load file contents only when needed" },
      { label: "No", description: "Always include full file contents" }
    ]
  },
  {
    question: "Enable Compact Workflows?",
    header: "Compact Workflows",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Use streamlined workflow descriptions" },
      { label: "No", description: "Use verbose workflow descriptions" }
    ]
  },
  {
    question: "Git branching strategy?",
    header: "Branching",
    multiSelect: false,
    options: [
      { label: "None (Recommended)", description: "Commit directly to current branch" },
      { label: "Per Phase", description: "Create branch for each phase (gsd/phase-{N}-{name})" },
      { label: "Per Milestone", description: "Create branch for entire milestone (gsd/{version}-{name})" }
    ]
  }
])
```

**Pre-select based on current config values.**

## 4. Update Config

Merge new settings into existing config.json:

```json
{
  ...existing_config,
  "model_profile": "quality" | "balanced" | "budget",
  "workflow": {
    "research": true/false,
    "plan_check": true/false,
    "verifier": true/false
  },
  "optimization": {
    "level": "standard" | "aggressive" | "minimal",
    "context_budget": {
      "enabled": true/false,
      "thresholds": {
        "warn": 40,
        "suggest_split": 60,
        "critical": 75
      }
    },
    "tiered_instructions": true/false,
    "delta_context": true/false,
    "lazy_references": true/false,
    "compact_workflows": true/false
  },
  "git": {
    "branching_strategy": "none" | "phase" | "milestone"
  }
}
```

Write updated config to `.planning/config.json`.

## 5. Confirm Changes

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SETTINGS UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Setting                    | Value |
|----------------------------|-------|
| Model Profile              | {quality/balanced/budget} |
| Plan Researcher            | {On/Off} |
| Plan Checker               | {On/Off} |
| Execution Verifier         | {On/Off} |
| Optimization Level         | {standard/aggressive/minimal} |
| Context Budget Monitoring  | {On/Off} |
| Tiered Instructions        | {On/Off} |
| Delta Context              | {On/Off} |
| Lazy References            | {On/Off} |
| Compact Workflows          | {On/Off} |
| Git Branching              | {None/Per Phase/Per Milestone} |

These settings apply to future /gsd:plan-phase and /gsd:execute-phase runs.

Quick commands:
- /gsd:set-profile <profile> — switch model profile
- /gsd:plan-phase --research — force research
- /gsd:plan-phase --skip-research — skip research
- /gsd:plan-phase --skip-verify — skip plan check
```

</process>

<success_criteria>
- [ ] Current config read
- [ ] User presented with 5 settings (profile + 3 workflow toggles + git branching)
- [ ] Config updated with model_profile, workflow, and git sections
- [ ] Changes confirmed to user
</success_criteria>
