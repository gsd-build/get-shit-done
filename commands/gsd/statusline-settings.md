---
name: gsd:statusline-settings
description: Configure GSD statusline display options
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
---

<objective>
Allow users to customize the enhanced statusline display through interactive settings.

Updates `.planning/config.json` with statusline preferences including display level and optional features.
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

Parse current statusline values (with defaults):
- `statusline.level` — display detail level (default: `standard`)
- `statusline.show_costs` — show session/project costs (default: `true`)
- `statusline.show_model_usage` — show H/S/O distribution (default: `false`, auto-enabled for adaptive)
- `statusline.show_adaptive_info` — show last selection details (default: `false`, auto-enabled for adaptive)
- `statusline.show_rate_limits` — show rate limit warnings (default: `true`)
- `statusline.show_git_state` — show git changes/ahead/behind (default: `false`)
- `statusline.show_tests` — show test status (default: `false`)
- `statusline.show_time` — show session duration (default: `false`)

## 3. Present Settings

Use AskUserQuestion with current values shown:

```
AskUserQuestion([
  {
    question: "Statusline detail level?",
    header: "Level",
    multiSelect: false,
    options: [
      {
        label: "Minimal",
        description: "Model + context only (cleanest)"
      },
      {
        label: "Standard (Recommended)",
        description: "Phase progress + costs + context"
      },
      {
        label: "Detailed",
        description: "All info including git, tests, time"
      }
    ]
  },
  {
    question: "Display options to enable (select multiple)?",
    header: "Options",
    multiSelect: true,
    options: [
      {
        label: "Costs",
        description: "Session/project cost tracking"
      },
      {
        label: "Model Usage",
        description: "H/S/O distribution (adaptive only)"
      },
      {
        label: "Adaptive Info",
        description: "Last selection + score (adaptive only)"
      },
      {
        label: "Rate Limits",
        description: "Rate limit warnings"
      },
      {
        label: "Git State",
        description: "Uncommitted changes, ahead/behind"
      },
      {
        label: "Tests",
        description: "Test runner status (future)"
      },
      {
        label: "Time",
        description: "Session duration"
      }
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
  "statusline": {
    "level": "minimal" | "standard" | "detailed",
    "show_costs": true/false,
    "show_model_usage": true/false,
    "show_adaptive_info": true/false,
    "show_rate_limits": true/false,
    "show_git_state": true/false,
    "show_tests": true/false,
    "show_time": true/false
  }
}
```

**Important:** Map user selections to boolean values:
- "Costs" selected → `show_costs: true`, not selected → `show_costs: false`
- etc.

Write updated config to `.planning/config.json`.

## 5. Confirm Changes

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► STATUSLINE SETTINGS UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Display Level: {minimal/standard/detailed}

Enabled Options:
  {✓/✗} Costs
  {✓/✗} Model Usage (adaptive only)
  {✓/✗} Adaptive Info (adaptive only)
  {✓/✗} Rate Limits
  {✓/✗} Git State
  {✓/✗} Tests
  {✓/✗} Time

Changes will take effect on next Claude Code session.

Notes:
- Minimal: Cleanest display, just model + directory + context
- Standard: Adds phase progress and costs
- Detailed: All available information

Example statuslines:

Minimal:
  Sonnet 4.5 │ get-shit-done ███████░░░ 75%

Standard:
  Sonnet 4.5 │ Phase 3/8: Auth │ $2.43 ███████░░░ 75%

Detailed:
  Sonnet 4.5 │ Phase 3/8: Auth │ $2.43/$18.76 │ * ↑3 │ 45min ███████░░░ 75%
```

</process>

<success_criteria>
- [ ] Current config read
- [ ] User presented with 2 questions (level + options)
- [ ] Config updated with statusline section
- [ ] All boolean options mapped correctly
- [ ] Changes confirmed to user with examples
</success_criteria>
