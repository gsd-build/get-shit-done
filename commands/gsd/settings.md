---
name: gsd:settings
description: Guided wizard to view and update .planning/config.json
argument-hint: "[--reset]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - AskUserQuestion
---

<objective>
Provide an interactive settings wizard for GSD project configuration.

Walk through each setting with:
- What it does
- Current value
- Allowed values (multi-choice where possible)

Then write the updated `.planning/config.json` (pretty JSON). Optionally commit the change.
</objective>

<execution_context>
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Project config: @.planning/config.json

Optional reset template:
@~/.claude/get-shit-done/templates/config.json
</context>

<process>

## 0. Validate

```bash
ls .planning/config.json 2>/dev/null
```

If missing: explain that settings are per-project and require `/gsd:new-project` first.

## 1. Load Current Config

Read `.planning/config.json` and parse as JSON.

If JSON is invalid, use AskUserQuestion:
- header: "Config"
- question: "config.json is invalid JSON — how do you want to proceed?"
- options:
  - "Reset to defaults" — overwrite with template config
  - "Abort" — do nothing

If `--reset` flag is present, confirm and then overwrite with template config before proceeding.

## 2. Explain Wizard

Tell the user:
- You’ll ask a few multi-choice questions
- You’ll preserve unknown fields
- You’ll summarize changes before writing

## 3. Mode + Depth

### Mode (`mode`)

Explain:
- `interactive` — asks for confirmations at key gates
- `yolo` — auto-approves most gates
- `custom` — uses `gates.*` to decide what to confirm

Use AskUserQuestion:
- header: "Mode"
- question: "Select workflow mode (current: {current_mode})"
- multiSelect: false
- options:
  - "YOLO" — sets `mode: \"yolo\"`
  - "Interactive" — sets `mode: \"interactive\"`
  - "Custom" — sets `mode: \"custom\"` (uses gates below)

### Depth (`depth`)

Explain:
- Controls how thorough planning should be (more depth → more phases/plans/checks).

Use AskUserQuestion:
- header: "Depth"
- question: "Select planning depth (current: {current_depth})"
- multiSelect: false
- options:
  - "Quick" — `depth: \"quick\"`
  - "Standard" — `depth: \"standard\"`
  - "Comprehensive" — `depth: \"comprehensive\"`

## 4. Enhancements (`enhancements.*`)

Explain each enhancement, then allow multi-select toggles.

Use AskUserQuestion:
- header: "Enhancements"
- question: "Enable enhanced workflows? (current: {list current enabled})"
- multiSelect: true
- options:
  - "Decision Ledger" — `enhancements.decision_ledger` (deeper discuss-phase with sign-off)
  - "Codebase Research" — `enhancements.codebase_research` (plan-phase pre-research)
  - "Plan Audit" — `enhancements.plan_audit` (execute-phase audit gate)
  - "Session Safety" — `enhancements.session_safety` (session conflict + cleanup)

Update `enhancements.*` booleans accordingly (selected = true, not selected = false).

## 5. Gates (`gates.*`)

Explain:
- Gates matter most in `mode: custom` (interactive/yolo override most prompting behavior).

For each gate, explain what it affects and show current value:
- `confirm_project`
- `confirm_phases`
- `confirm_roadmap`
- `confirm_breakdown`
- `confirm_plan`
- `execute_next_plan`
- `issues_review`
- `confirm_transition`
- `confirm_milestone_scope`

Use AskUserQuestion:
- header: "Gates"
- question: "In custom mode, which confirmations should be enabled? (selected = enabled, unselected = disabled)"
- multiSelect: true
- options:
  - "confirm_project" — confirm project artifacts before proceeding
  - "confirm_phases" — confirm phase list/structure
  - "confirm_roadmap" — confirm roadmap before planning/execution
  - "confirm_breakdown" — confirm plan breakdown before writing plans
  - "confirm_plan" — confirm plan(s) before execution
  - "execute_next_plan" — confirm before executing next plan
  - "issues_review" — review issues at end of a plan
  - "confirm_transition" — confirm phase transitions
  - "confirm_milestone_scope" — confirm milestone completion scope

Set each gate boolean to true if selected, false otherwise.

## 6. Safety Rails (`safety.*`)

Explain:
- Safety rails apply regardless of mode: they should block or confirm risky actions.

Use AskUserQuestion:
- header: "Safety"
- question: "Which safety rails should always require confirmation? (selected = ON)"
- multiSelect: true
- options:
  - "always_confirm_destructive" — rm/reset/delete, irreversible operations
  - "always_confirm_external_services" — third-party dashboards, billing, secrets

Set booleans accordingly.

## 7. Summary + Apply

Summarize the changes:
- Show old → new for each changed key
- Mention that unknown fields were preserved

Use AskUserQuestion:
- header: "Apply"
- question: "Write updated .planning/config.json?"
- options:
  - "Apply changes"
  - "Abort"

If abort: exit without writing.

## 8. Write Config

Write `.planning/config.json` with pretty formatting (2 spaces) and trailing newline.

## 9. Optional Commit

Use AskUserQuestion:
- header: "Git"
- question: "Commit .planning/config.json changes?"
- options:
  - "Commit"
  - "Don't commit"

If commit selected:
```bash
git status --porcelain
git add .planning/config.json
git commit -m "chore(config): update gsd settings"
```

</process>

<success_criteria>
- [ ] Wizard explains each setting and current value
- [ ] Updates `.planning/config.json` safely (preserve unknown keys)
- [ ] Uses multi-choice prompts where possible
- [ ] Confirms before writing
- [ ] Optional commit supported
</success_criteria>
