<purpose>
Interactive configuration of GSD workflow agents (research, plan_check, verifier), TDD, security compliance, and model profile selection via multi-question prompt. Updates .planning/config.json with user preferences.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="ensure_and_load_config">
Ensure config exists and load current state:

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.js config-ensure-section
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.js state load)
```

Creates `.planning/config.json` with defaults if missing and loads current config values.
</step>

<step name="read_current">
```bash
cat .planning/config.json
```

Parse current values (default to `true` if not present):
- `workflow.research` — spawn researcher during plan-phase
- `workflow.plan_check` — spawn plan checker during plan-phase
- `workflow.verifier` — spawn verifier during execute-phase
- `workflow.tdd` — enforce TDD for all plans (default: `true`)
- `model_profile` — which model each agent uses (default: `balanced`)
- `security_compliance` — security compliance level (default: `"none"`)
- `git.branching_strategy` — branching approach (default: `"none"`)
</step>

<step name="present_settings_round1">
**Round 1 — Model profile and workflow agents (4 questions max):**

Use AskUserQuestion with current values pre-selected:

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
  }
])
```

**Pre-select based on current config values.**
</step>

<step name="present_settings_round2">
**Round 2 — TDD, security, and branching (3 questions):**

```
AskUserQuestion([
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
</step>

<step name="update_config">
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
  },
  "git": {
    "branching_strategy": "none" | "phase" | "milestone"
  }
}
```

Write updated config to `.planning/config.json`.
</step>

<step name="confirm">
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
| Git Branching        | {None/Per Phase/Per Milestone} |

These settings apply to future /gsd:plan-phase and /gsd:execute-phase runs.

**TDD Workflow:** When enabled, all plans use RED-GREEN-REFACTOR cycle with 4 test categories.
**Security Compliance:** Determines which security tests are required. See @~/.claude/get-shit-done/references/security-compliance.md

Quick commands:
- /gsd:set-profile <profile> — switch model profile
- /gsd:plan-phase --research — force research
- /gsd:plan-phase --skip-research — skip research
- /gsd:plan-phase --skip-verify — skip plan check
```
</step>

</process>

<success_criteria>
- [ ] Current config read
- [ ] User presented with 7 settings across 2 rounds (4 + 3, respecting AskUserQuestion limit)
- [ ] Config updated with model_profile, security_compliance, workflow, and git sections
- [ ] Changes confirmed to user
</success_criteria>
