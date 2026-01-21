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
- `workflow.tdd` — enforce TDD for all plans (default: `true`)
- `model_profile` — which model each agent uses (default: `balanced`)
- `security_compliance` — security compliance level (default: `none`)

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
    question: "Enforce TDD workflow? (write tests before code)",
    header: "TDD",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "All plans use RED-GREEN-REFACTOR cycle" },
      { label: "No", description: "Standard execution without mandatory tests" }
    ]
  },
  {
    question: "Security compliance level? (Other: iso27001, pci-dss)",
    header: "Security",
    multiSelect: false,
    options: [
      { label: "none", description: "Basic security best practices only" },
      { label: "soc2", description: "SOC 2 Type II (B2B SaaS)" },
      { label: "hipaa", description: "HIPAA (healthcare, PHI protection)" }
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
  "security_compliance": "none" | "soc2" | "hipaa" | "pci-dss" | "iso27001",
  "workflow": {
    "research": true/false,
    "plan_check": true/false,
    "verifier": true/false,
    "tdd": true/false
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

| Setting              | Value |
|----------------------|-------|
| Model Profile        | {quality/balanced/budget} |
| Plan Researcher      | {On/Off} |
| Plan Checker         | {On/Off} |
| Execution Verifier   | {On/Off} |
| TDD Workflow         | {On/Off} |
| Security Compliance  | {none/soc2/hipaa/pci-dss/iso27001} |

These settings apply to future /gsd:plan-phase and /gsd:execute-phase runs.

**TDD Workflow:** When enabled, all plans use RED-GREEN-REFACTOR cycle with 4 test categories.
**Security Compliance:** Determines which security tests are required. See @~/.claude/get-shit-done/references/security-compliance.md

Quick commands:
- /gsd:set-profile <profile> — switch model profile
- /gsd:plan-phase --research — force research
- /gsd:plan-phase --skip-research — skip research
- /gsd:plan-phase --skip-verify — skip plan check
```

</process>

<success_criteria>
- [ ] Current config read
- [ ] User presented with 6 settings (profile + 4 toggles + security)
- [ ] Config updated with model_profile, security_compliance, and workflow section
- [ ] Changes confirmed to user
</success_criteria>
