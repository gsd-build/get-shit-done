<purpose>
Interactive configuration of GSD power-user knobs — plan bounce, node repair, subagent timeouts,
inline plan threshold, cross-AI execution, base branch, branch templates, response language,
context window, gitignored search, graphify build timeout, and runtime model tier overrides.

This is a companion to `/gsd-settings` — the common-case prompt there covers model profile,
research/plan_check/verifier toggles, branching strategy, UI/AI phase gates, and worktree
isolation. This advanced command covers everything else that is user-settable, grouped into
seven sections so each prompt batch stays cognitively scoped. Every answer pre-selects the
current value; numeric-input answers that are non-numeric are rejected and re-prompted.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="ensure_and_load_config">
Ensure config exists and resolve the workstream-aware config path (mirrors `settings.md`):

```bash
gsd-sdk query config-ensure-section
if [[ -z "${GSD_CONFIG_PATH:-}" ]]; then
  if [[ -f .planning/active-workstream ]]; then
    WS=$(tr -d '\n\r' < .planning/active-workstream)
    GSD_CONFIG_PATH=".planning/workstreams/${WS}/config.json"
  else
    GSD_CONFIG_PATH=".planning/config.json"
  fi
fi
```

All subsequent reads and writes go through `$GSD_CONFIG_PATH`. Never hardcode
`.planning/config.json` — workstream installs must route to their own config file.
</step>

<step name="read_current">
```bash
cat "$GSD_CONFIG_PATH"
```

Parse the following current values. If a key is absent, fall back to the documented default
shown in parentheses:

Planning Tuning:
- `workflow.plan_bounce` (default: `false`)
- `workflow.plan_bounce_passes` (default: `2`)
- `workflow.plan_bounce_script` (default: `null`)
- `workflow.subagent_timeout` (default: `600`)
- `workflow.inline_plan_threshold` (default: `3`)

Execution Tuning:
- `workflow.node_repair` (default: `true`)
- `workflow.node_repair_budget` (default: `2`)
- `workflow.auto_prune_state` (default: `false`)

Discussion Tuning:
- `workflow.max_discuss_passes` (default: `3`)

Cross-AI Execution:
- `workflow.cross_ai_execution` (default: `false`)
- `workflow.cross_ai_command` (default: `null`)
- `workflow.cross_ai_timeout` (default: `300`)

Git Customization:
- `git.base_branch` (default: `main`)
- `git.phase_branch_template` (default: `gsd/phase-{phase}-{slug}`)
- `git.milestone_branch_template` (default: `gsd/{milestone}-{slug}`)

Runtime / Output:
- `response_language` (default: `null`)
- `context_window` (default: `200000`)
- `search_gitignored` (default: `false`)
- `graphify.build_timeout` (default: `300`)

Runtime Model Tiers:
- `runtime` (default: `null` — reads as `"claude"`)
- `model_profile_overrides.<runtime>.opus` (default: built-in for the runtime, or absent)
- `model_profile_overrides.<runtime>.sonnet` (default: built-in for the runtime, or absent)
- `model_profile_overrides.<runtime>.haiku` (default: built-in for the runtime, or absent)

Each field's **current value is pre-selected** in the prompt rendering below. When the
current value is absent from the config, render the documented default as the pre-selected
option so the user sees what the effective value is.
</step>

<step name="present_settings">

**Text mode (`workflow.text_mode: true` or `--text` flag):** Set `TEXT_MODE=true` if `--text` is
in `$ARGUMENTS` OR `text_mode` is true in config. When `TEXT_MODE=true`, replace every
`AskUserQuestion` call below with a plain-text numbered list and ask the user to type the
choice number or free-text value.

**Numeric-input validation.** For any numeric field (`*_passes`, `*_budget`, `*_timeout`,
`*_threshold`, `context_window`, `graphify.build_timeout`), if the user types a value that
is not a non-negative integer, the workflow MUST reject it, state which value was invalid,
and re-prompt that single field. The minimum accepted value is field-specific and is stated
in each field's prompt below — `workflow.plan_bounce_passes` and `workflow.max_discuss_passes`
require `>= 1`; all other numeric fields accept `>= 0`. An empty input means "keep current"
— the existing value is retained. Non-numeric input is never silently coerced.

**Free-text validation.** For branch template fields (`git.phase_branch_template`,
`git.milestone_branch_template`), if the user supplies a non-default value, it MUST be
non-empty and SHOULD contain at least one `{placeholder}`. A template missing placeholders
is rejected with a message explaining the available variables (`{phase}`, `{slug}`,
`{milestone}`) and re-prompted. An empty input means "keep current."

**Null-allowed fields.** For `response_language`, `workflow.plan_bounce_script`,
`workflow.cross_ai_command`: an empty input clears the field (`null`). A non-empty input is
stored verbatim as a string.

---

### Section 1 — Planning Tuning

```text
AskUserQuestion([
  {
    question: "Run external plan-bounce validator against generated PLAN.md? (current: <value or false>)",
    header: "Plan Bounce",
    multiSelect: false,
    options: [
      { label: "No (default: false)", description: "Skip external plan validation." },
      { label: "Yes", description: "Pipe each PLAN.md through `plan_bounce_script` and block on non-zero exit." }
    ]
  },
  {
    question: "How many plan-bounce passes? (current: <value or 2>)",
    header: "Bounce Passes",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave the existing value unchanged." },
      { label: "Enter number", description: "Type an integer >= 1. Non-numeric input is rejected and re-prompted. Default: 2" }
    ]
  },
  {
    question: "Path to plan-bounce validation script? (current: <value or null>)",
    header: "Bounce Script",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave existing path unchanged." },
      { label: "Clear (null)", description: "Unset the script path." },
      { label: "Enter path", description: "Type an absolute or repo-relative path. Receives PLAN.md path as first argument." }
    ]
  },
  {
    question: "Subagent timeout (seconds)? (current: <value or 600>)",
    header: "Subagent Timeout",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave timeout unchanged." },
      { label: "Enter seconds", description: "Integer number of seconds. Non-numeric rejected. Default: 600" }
    ]
  },
  {
    question: "Inline plan threshold — tasks allowed inline before splitting to PLAN.md? (current: <value or 3>)",
    header: "Inline Plan Threshold",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave threshold unchanged." },
      { label: "Enter number", description: "Integer count. Non-numeric rejected. Default: 3" }
    ]
  }
])
```

### Section 2 — Execution Tuning

```text
AskUserQuestion([
  {
    question: "Enable autonomous node repair on verification failure? (current: <value or true>)",
    header: "Node Repair",
    multiSelect: false,
    options: [
      { label: "Yes (default: true)", description: "Executor retries failed tasks up to the repair budget." },
      { label: "No", description: "Stop on first verification failure." }
    ]
  },
  {
    question: "Maximum node-repair attempts per failed task? (current: <value or 2>)",
    header: "Repair Budget",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave existing budget unchanged." },
      { label: "Enter number", description: "Integer >= 0. Non-numeric rejected. Default: 2" }
    ]
  },
  {
    question: "Auto-prune stale STATE.md entries at phase boundaries? (current: <value or false>)",
    header: "Auto Prune",
    multiSelect: false,
    options: [
      { label: "No (default: false)", description: "Prompt before pruning." },
      { label: "Yes", description: "Prune stale entries without prompting." }
    ]
  }
])
```

### Section 3 — Discussion Tuning

```text
AskUserQuestion([
  {
    question: "Maximum discuss-phase question rounds? (current: <value or 3>)",
    header: "Max Discuss Passes",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave existing value unchanged." },
      { label: "Enter number", description: "Integer >= 1. Non-numeric rejected. Default: 3. Prevents infinite discussion loops in headless mode." }
    ]
  }
])
```

### Section 4 — Cross-AI Execution

```text
AskUserQuestion([
  {
    question: "Delegate phase execution to an external AI CLI? (current: <value or false>)",
    header: "Cross-AI",
    multiSelect: false,
    options: [
      { label: "No (default: false)", description: "Use local executor agents." },
      { label: "Yes", description: "Pipe phase prompt to `cross_ai_command` via stdin. Requires command to be set." }
    ]
  },
  {
    question: "Cross-AI command template? (current: <value or null>)",
    header: "Cross-AI Command",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave command unchanged." },
      { label: "Clear (null)", description: "Unset the command." },
      { label: "Enter command", description: "Shell command receiving phase prompt via stdin. Must produce SUMMARY.md-compatible output." }
    ]
  },
  {
    question: "Cross-AI timeout (seconds)? (current: <value or 300>)",
    header: "Cross-AI Timeout",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave timeout unchanged." },
      { label: "Enter seconds", description: "Integer seconds. Non-numeric rejected. Default: 300" }
    ]
  }
])
```

### Section 5 — Git Customization

```text
AskUserQuestion([
  {
    question: "Git base branch? (current: <value or main>)",
    header: "Base Branch",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave base branch unchanged." },
      { label: "Enter branch name", description: "e.g., main, master, develop. Integration branch for phase/milestone branches." }
    ]
  },
  {
    question: "Phase branch template? (current: <value or gsd/phase-{phase}-{slug}>)",
    header: "Phase Template",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave template unchanged." },
      { label: "Enter template", description: "Non-empty string with at least one placeholder. Available: {phase}, {slug}. Non-default values missing placeholders are rejected." }
    ]
  },
  {
    question: "Milestone branch template? (current: <value or gsd/{milestone}-{slug}>)",
    header: "Milestone Template",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave template unchanged." },
      { label: "Enter template", description: "Non-empty string. Available placeholders: {milestone}, {slug}. Non-default values missing placeholders are rejected." }
    ]
  }
])
```

### Section 6 — Runtime / Output

```text
AskUserQuestion([
  {
    question: "Response language for agent output? (current: <value or null>)",
    header: "Language",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave unchanged." },
      { label: "Clear (null)", description: "Use Claude default (English)." },
      { label: "Enter language", description: "Free-text language name or code (e.g., Japanese, pt, ko). Propagates to spawned agents." }
    ]
  },
  {
    question: "Context window size (tokens)? (current: <value or 200000>)",
    header: "Context Window",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave unchanged." },
      { label: "Enter number", description: "Integer. Non-numeric rejected. Default: 200000. Use 1000000 for 1M-context models. Values >= 500000 enable adaptive enrichment." }
    ]
  },
  {
    question: "Include gitignored files in broad searches? (current: <value or false>)",
    header: "Search Gitignored",
    multiSelect: false,
    options: [
      { label: "No (default: false)", description: "Respect .gitignore during searches." },
      { label: "Yes", description: "Add --no-ignore to broad searches (includes .planning/)." }
    ]
  },
  {
    question: "Graphify build timeout (seconds)? (current: <value or 300>)",
    header: "Graphify Timeout",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave timeout unchanged." },
      { label: "Enter seconds", description: "Integer seconds. Non-numeric rejected. Default: 300" }
    ]
  }
])
```

### Section 7 — Runtime Model Tiers

This section lets the user inspect and override the built-in model IDs GSD resolves for each
profile tier (`opus` / `sonnet` / `haiku`) on their configured runtime.

**Step A — Show current runtime and built-in defaults:**

Read `runtime` from the config (or treat as `"claude"` if absent). Look up the built-in
tier map from the table below. For each tier, also read the current override from
`model_profile_overrides.<runtime>.<tier>` if present.

Built-in tier defaults by runtime:

| Runtime    | `opus`                        | `sonnet`                        | `haiku`                       |
|------------|-------------------------------|---------------------------------|-------------------------------|
| `claude`   | `claude-opus-4-7`             | `claude-sonnet-4-6`             | `claude-haiku-4-5`            |
| `codex`    | `gpt-5.4`                     | `gpt-5.3-codex`                 | `gpt-5.4-mini`                |
| `gemini`   | `gemini-3-pro`                | `gemini-3-flash`                | `gemini-2.5-flash-lite`       |
| `qwen`     | `qwen3-max-2026-01-23`        | `qwen3-coder-plus`              | `qwen3-coder-next`            |
| `opencode` | `anthropic/claude-opus-4-7`   | `anthropic/claude-sonnet-4-6`   | `anthropic/claude-haiku-4-5`  |
| `copilot`  | `claude-opus-4-7`             | `claude-sonnet-4-6`             | `claude-haiku-4-5`            |
| `hermes`   | `anthropic/claude-opus-4-7`   | `anthropic/claude-sonnet-4-6`   | `anthropic/claude-haiku-4-5`  |
| Group B (`kilo`, `cline`, `cursor`, `windsurf`, `augment`, `trae`, `codebuddy`, `antigravity`) | (no built-in default — your runtime handles model selection) | | |

Display a table to the user showing the effective configuration:

```text
Runtime model tiers — runtime: <current runtime or "claude (default)">

| Tier   | Built-in default                  | Current override (if any)         |
|--------|-----------------------------------|-----------------------------------|
| opus   | <built-in or "(no built-in)">     | <override value or "(none)">      |
| sonnet | <built-in or "(no built-in)">     | <override value or "(none)">      |
| haiku  | <built-in or "(no built-in)">     | <override value or "(none)">      |
```

For Group B runtimes (those without a built-in default), show `(no built-in default — your runtime handles model selection)` in the built-in column.

**Step B — Let the user choose a runtime (optional):**

```text
AskUserQuestion([
  {
    question: "Which runtime do you want to configure tier overrides for? (current: <runtime or 'claude'>)",
    header: "Runtime Selection",
    multiSelect: false,
    options: [
      { label: "Keep current (<runtime>)", description: "Configure overrides for the current runtime." },
      { label: "claude", description: "Claude Code / Anthropic CLI." },
      { label: "codex", description: "OpenAI Codex CLI." },
      { label: "gemini", description: "Gemini CLI." },
      { label: "qwen", description: "Qwen CLI." },
      { label: "opencode", description: "OpenCode (uses anthropic/ prefix)." },
      { label: "copilot", description: "GitHub Copilot." },
      { label: "Other (Group B or custom)", description: "kilo, cline, cursor, windsurf, augment, trae, codebuddy, antigravity, or a custom runtime string. Overrides are honored even though no built-in map exists." }
    ]
  }
])
```

If "Other" is selected, prompt the user to enter the runtime name as a free-text string.
If the selected runtime differs from the stored `runtime` key, update `runtime` via
`gsd-sdk query config-set runtime <value>` before proceeding to Step C.

**Step C — Configure tier overrides for the selected runtime:**

```text
AskUserQuestion([
  {
    question: "Override for opus tier? Built-in: <opus default or '(no built-in)'>  Current: <override or '(none)'>",
    header: "Opus Override",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave unchanged (uses built-in default if no override)." },
      { label: "Clear override", description: "Remove any existing override; fall back to built-in." },
      { label: "Enter model ID", description: "Type the exact model ID string to use for opus-tier agents on this runtime." }
    ]
  },
  {
    question: "Override for sonnet tier? Built-in: <sonnet default or '(no built-in)'>  Current: <override or '(none)'>",
    header: "Sonnet Override",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave unchanged." },
      { label: "Clear override", description: "Remove any existing override; fall back to built-in." },
      { label: "Enter model ID", description: "Type the exact model ID string to use for sonnet-tier agents on this runtime." }
    ]
  },
  {
    question: "Override for haiku tier? Built-in: <haiku default or '(no built-in)'>  Current: <override or '(none)'>",
    header: "Haiku Override",
    multiSelect: false,
    options: [
      { label: "Keep current", description: "Leave unchanged." },
      { label: "Clear override", description: "Remove any existing override; fall back to built-in." },
      { label: "Enter model ID", description: "Type the exact model ID string to use for haiku-tier agents on this runtime." }
    ]
  }
])
```

**Step D — Apply the changes:**

For each tier where the user chose "Enter model ID":
```bash
gsd-sdk query config-set model_profile_overrides.<runtime>.<tier> "<model-id>"
```

For each tier where the user chose "Clear override", remove the key by setting it to null:
```bash
gsd-sdk query config-set model_profile_overrides.<runtime>.<tier> null
```

"Keep current" selections are skipped entirely. Never write a key the user did not explicitly
change.

</step>

<step name="update_config">
Merge the new settings into the existing config at `$GSD_CONFIG_PATH`. This merge is the
core correctness invariant: **preserve every unrelated key** — do not clobber siblings.

Apply each selected value via `gsd-sdk query config-set <key> <value>` so the central
validator (`isValidConfigKey`) accepts the write and the deep-merge preserves unrelated
keys and sibling sub-objects.

```bash
# Example — only write keys the user changed. "Keep current" selections are skipped.
gsd-sdk query config-set workflow.plan_bounce_passes 5
gsd-sdk query config-set workflow.subagent_timeout 900
gsd-sdk query config-set git.base_branch main
gsd-sdk query config-set context_window 1000000
# Runtime model tier examples:
gsd-sdk query config-set runtime gemini
gsd-sdk query config-set model_profile_overrides.gemini.opus gemini-3-ultra
gsd-sdk query config-set model_profile_overrides.gemini.haiku null
```

Conceptual shape after merge (unchanged top-level keys like `model_profile`,
`granularity`, `mode`, `brave_search`, `agent_skills.*`, `hooks.context_warnings`, and
anything not listed in Sections 1–7 MUST survive the update):

```json
{
  ...existing_config,
  "workflow": {
    ...existing_workflow,
    "plan_bounce": <new|existing>,
    "plan_bounce_passes": <new|existing>,
    "plan_bounce_script": <new|existing|null>,
    "subagent_timeout": <new|existing>,
    "inline_plan_threshold": <new|existing>,
    "node_repair": <new|existing>,
    "node_repair_budget": <new|existing>,
    "auto_prune_state": <new|existing>,
    "max_discuss_passes": <new|existing>,
    "cross_ai_execution": <new|existing>,
    "cross_ai_command": <new|existing|null>,
    "cross_ai_timeout": <new|existing>
  },
  "git": {
    ...existing_git,
    "base_branch": <new|existing>,
    "phase_branch_template": <new|existing>,
    "milestone_branch_template": <new|existing>
  },
  "response_language": <new|existing|null>,
  "context_window": <new|existing>,
  "search_gitignored": <new|existing>,
  "graphify": {
    ...existing_graphify,
    "build_timeout": <new|existing>
  },
  "runtime": <new|existing|null>,
  "model_profile_overrides": {
    ...existing_model_profile_overrides,
    "<runtime>": {
      ...existing_runtime_overrides,
      "opus": <new|existing|null>,
      "sonnet": <new|existing|null>,
      "haiku": <new|existing|null>
    }
  }
}
```

Never emit a full overwrite of the file that omits keys the user did not touch. Always
route each write through `gsd-sdk query config-set` so sibling preservation is handled by
the central setter.
</step>

<step name="confirm">
Display:

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ADVANCED SETTINGS UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Setting                                    | Value |
|--------------------------------------------|-------|
| workflow.plan_bounce                       | {on/off} |
| workflow.plan_bounce_passes                | {n} |
| workflow.plan_bounce_script                | {path/null} |
| workflow.subagent_timeout                  | {seconds} |
| workflow.inline_plan_threshold             | {n} |
| workflow.node_repair                       | {on/off} |
| workflow.node_repair_budget                | {n} |
| workflow.auto_prune_state                  | {on/off} |
| workflow.max_discuss_passes                | {n} |
| workflow.cross_ai_execution                | {on/off} |
| workflow.cross_ai_command                  | {cmd/null} |
| workflow.cross_ai_timeout                  | {seconds} |
| git.base_branch                            | {branch} |
| git.phase_branch_template                  | {template} |
| git.milestone_branch_template              | {template} |
| response_language                          | {lang/null} |
| context_window                             | {tokens} |
| search_gitignored                          | {on/off} |
| graphify.build_timeout                     | {seconds} |
| runtime                                    | {runtime/null} |
| model_profile_overrides.<runtime>.opus     | {model/built-in/null} |
| model_profile_overrides.<runtime>.sonnet   | {model/built-in/null} |
| model_profile_overrides.<runtime>.haiku    | {model/built-in/null} |

These settings apply to future /gsd-plan-phase, /gsd-execute-phase, /gsd-discuss-phase,
and /gsd-ship runs.

For common-case toggles (model profile, research/plan_check/verifier, branching strategy,
UI/AI phase gates), use /gsd-settings.
```
</step>

</process>

<success_criteria>
- [ ] Current config read from resolved `$GSD_CONFIG_PATH`
- [ ] Seven sections rendered (Planning, Execution, Discussion, Cross-AI, Git, Runtime/Output, Runtime Model Tiers)
- [ ] Every field pre-selected to its current value (or documented default if absent)
- [ ] Numeric inputs validated — non-numeric rejected and re-prompted
- [ ] Branch-template inputs validated — non-default must contain a placeholder
- [ ] Null-allowed fields accept an empty input as a clear
- [ ] Writes routed through `gsd-sdk query config-set` so unrelated keys are preserved
- [ ] Section 7 shows current runtime and built-in tier table
- [ ] Group B runtimes display "(no built-in default — your runtime handles model selection)"
- [ ] Override set/clear/keep paths all work correctly for each tier
- [ ] Confirmation table rendered listing all 23 fields (19 + runtime + 3 tier overrides)
</success_criteria>
