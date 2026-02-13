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
- `model_profile` — which model each agent uses (default: `balanced`)
- `git.branching_strategy` — branching approach (default: `"none"`)
- `adversary.enabled` — global adversary toggle (default: `true`)
- `adversary.checkpoints.*` — per-checkpoint toggles (default: all `true`)
- `adversary.max_rounds` — global max debate rounds (default: `3`)

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
    question: "Git branching strategy?",
    header: "Branching",
    multiSelect: false,
    options: [
      { label: "None (Recommended)", description: "Commit directly to current branch" },
      { label: "Per Phase", description: "Create branch for each phase (gsd/phase-{N}-{name})" },
      { label: "Per Milestone", description: "Create branch for entire milestone (gsd/{version}-{name})" }
    ]
  },
  {
    question: "Enable adversarial review? (challenges artifacts before execution)",
    header: "Adversary",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Challenge requirements, roadmaps, plans, and verification" },
      { label: "No", description: "Skip adversarial review at all checkpoints" }
    ]
  },
  // ONLY show if adversary = "Yes":
  {
    question: "Which checkpoints should trigger adversarial review?",
    header: "Adversary Checkpoints",
    multiSelect: true,
    options: [
      { label: "Requirements", description: "Challenge REQUIREMENTS.md after creation" },
      { label: "Roadmap", description: "Challenge ROADMAP.md after creation" },
      { label: "Plan", description: "Challenge PLAN.md after creation" },
      { label: "Verification", description: "Challenge verification conclusions" }
    ]
  },
  // ONLY show if adversary = "Yes":
  {
    question: "Maximum debate rounds per checkpoint?",
    header: "Max Rounds",
    multiSelect: false,
    options: [
      { label: "1", description: "Single challenge only (fastest)" },
      { label: "2", description: "Challenge + defense" },
      { label: "3 (Recommended)", description: "Challenge + defense + final assessment" },
      { label: "5", description: "Extended debate (most thorough)" }
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
  "git": {
    "branching_strategy": "none" | "phase" | "milestone"
  },
  "adversary": {
    "enabled": true/false,
    "max_rounds": 1/2/3/5,
    "checkpoints": {
      "requirements": true/false,
      "roadmap": true/false,
      "plan": true/false,
      "verification": true/false
    }
  }
}
```

**Adversary merge rules:**
- Read existing `adversary` section from config first (preserve existing values)
- When toggling `enabled: false`, preserve existing checkpoint and max_rounds values
- When toggling checkpoints, write `true` for selected and `false` for unselected
- When changing max_rounds, write the numeric value (1, 2, 3, or 5)
- If no existing adversary section, use defaults: `enabled: true`, `max_rounds: 3`, all checkpoints `true`

Write updated config to `.planning/config.json`.

## 5. Confirm Changes

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SETTINGS UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Setting              | Value |
|----------------------|-------|
| Model Profile        | {quality/balanced/budget} |
| Plan Researcher      | {On/Off} |
| Plan Checker         | {On/Off} |
| Execution Verifier   | {On/Off} |
| Git Branching        | {None/Per Phase/Per Milestone} |
| Adversary            | {On/Off} |
| Adversary Checkpoints| {list of enabled checkpoints} |
| Max Rounds           | {1/2/3/5} |

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
- [ ] User presented with 8 settings (profile + 3 workflow + branching + 3 adversary)
- [ ] Config updated with model_profile, workflow, git, and adversary sections
- [ ] Changes confirmed to user
</success_criteria>
