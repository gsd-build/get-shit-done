<purpose>
Configure quality enforcement features for the current project. Adds/updates the `quality` section in `.planning/config.json`.
</purpose>

<process>

<step name="check_config">
```bash
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.js state load)
```

Verify `.planning/config.json` exists. If not, run `config ensure-section` first.
</step>

<step name="route_preset">
Parse $ARGUMENTS for preset flags: `--minimal`, `--standard`, `--full`.

**If preset flag provided:** Apply preset directly, skip interactive.

| Preset | tdd_mode | specs | feedback | checkpoints | coverage_threshold |
|--------|----------|-------|----------|-------------|--------------------|
| `--minimal` | basic | false | true | false | 80 |
| `--standard` | basic | true | true | true | 80 |
| `--full` | full | true | true | true | 80 |

**If no preset:** Continue to interactive selection.
</step>

<step name="interactive">
Use AskUserQuestion:

```
questions: [
  {
    header: "Preset",
    question: "Which quality preset?",
    multiSelect: false,
    options: [
      { label: "Minimal", description: "Basic TDD + feedback tracking" },
      { label: "Standard (Recommended)", description: "TDD + specs + feedback + checkpoints" },
      { label: "Full", description: "Hook-enforced TDD + specs + feedback + checkpoints" },
      { label: "Custom", description: "Choose each feature individually" }
    ]
  }
]
```

**If Custom:** Ask about each feature individually using AskUserQuestion with 2 options each (enable/disable).
</step>

<step name="apply_config">
Read `.planning/config.json`, merge quality section:

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.js config-set quality.tdd_mode "{value}"
node ~/.claude/get-shit-done/bin/gsd-tools.js config-set quality.specs {value}
node ~/.claude/get-shit-done/bin/gsd-tools.js config-set quality.feedback {value}
node ~/.claude/get-shit-done/bin/gsd-tools.js config-set quality.checkpoints {value}
node ~/.claude/get-shit-done/bin/gsd-tools.js config-set quality.coverage_threshold {value}
```

Present confirmation:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUALITY CONFIGURED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Feature | Status |
|---------|--------|
| TDD Mode | {value} |
| Specs | {value} |
| Feedback | {value} |
| Checkpoints | {value} |
| Coverage | {value}% |
```

**If tdd_mode is "full":**
```
TDD hooks needed. Run: /gsd:setup-tdd-hooks
```
</step>

</process>

<success_criteria>
- [ ] Preset or interactive selection completed
- [ ] config.json updated with quality section
- [ ] Confirmation shown
- [ ] Hook setup suggested if tdd_mode is "full"
</success_criteria>
