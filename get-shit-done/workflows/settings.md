<purpose>
Interactive configuration of GSD workflow agents (research, plan_check, verifier) and model profile selection via multi-question prompt. Updates .planning/config.json with user preferences. Optionally saves settings as global defaults (~/.gsd/defaults.json) for future projects.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="ensure_and_load_config">
Ensure config exists and load current state:

```bash
gsd-sdk query config-ensure-section
INIT=$(gsd-sdk query state.load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# `state.load` returns STATE frontmatter JSON from the SDK — it does not include `config_path`. Orchestrators may set `GSD_CONFIG_PATH` from init phase-op JSON; otherwise resolve the same path gsd-tools uses for flat vs active workstream (#2282).
if [[ -z "${GSD_CONFIG_PATH:-}" ]]; then
  if [[ -f .planning/active-workstream ]]; then
    WS=$(tr -d '\n\r' < .planning/active-workstream)
    GSD_CONFIG_PATH=".planning/workstreams/${WS}/config.json"
  else
    GSD_CONFIG_PATH=".planning/config.json"
  fi
fi
```

Creates `config.json` (at the resolved path) with defaults if missing. `INIT` still holds `state.load` output for any step that needs STATE fields.
Store `$GSD_CONFIG_PATH` — all subsequent reads and writes use this path, not a hardcoded `.planning/config.json`, so active-workstream installs target the correct file (#2282).
</step>

<step name="read_current">
```bash
cat "$GSD_CONFIG_PATH"
```

Parse current values (default to `true` if not present):
- `workflow.research` — spawn researcher during plan-phase
- `workflow.plan_check` — spawn plan checker during plan-phase
- `workflow.verifier` — spawn verifier during execute-phase
- `workflow.nyquist_validation` — validation architecture research during plan-phase (default: true if absent)
- `workflow.pattern_mapper` — run gsd-pattern-mapper between research and planning (default: true if absent)
- `workflow.ui_phase` — generate UI-SPEC.md design contracts for frontend phases (default: true if absent)
- `workflow.ui_safety_gate` — prompt to run /gsd-ui-phase before planning frontend phases (default: true if absent)
- `workflow.ai_integration_phase` — framework selection + eval strategy for AI phases (default: true if absent)
- `workflow.tdd_mode` — enforce RED/GREEN/REFACTOR gate sequence during execute-phase (default: false if absent)
- `workflow.code_review` — enable /gsd-code-review and /gsd-code-review-fix commands (default: true if absent)
- `workflow.code_review_depth` — default depth for /gsd-code-review: `quick`, `standard`, or `deep` (default: `"standard"` if absent; only relevant when `code_review` is on)
- `workflow.ui_review` — run visual quality audit (/gsd-ui-review) in autonomous mode (default: true if absent)
- `commit_docs` — whether `.planning/` files are committed to git (default: true if absent)
- `intel.enabled` — enable queryable codebase intelligence (/gsd-intel) (default: false if absent)
- `graphify.enabled` — enable project knowledge graph (/gsd-graphify) (default: false if absent)
- `model_profile` — which model each agent uses (default: `balanced`)
- `git.branching_strategy` — branching approach (default: `"none"`)
- `workflow.use_worktrees` — whether parallel executor agents run in worktree isolation (default: `true`)
</step>

<step name="present_settings">

**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.

**Non-Claude runtime note:** If `TEXT_MODE` is active (i.e. the runtime is non-Claude), prepend the following notice before the model profile question:

```
Note: Quality, Balanced, Budget, and Adaptive profiles assign semantic tiers
(Opus/Sonnet/Haiku) to each agent. When `runtime` is set in .planning/config.json,
tiers resolve to runtime-native model IDs — on Codex that's gpt-5.4 / gpt-5.3-codex /
gpt-5.4-mini with appropriate reasoning effort. See "Runtime-Aware Profiles" in
docs/CONFIGURATION.md.

If `runtime` is unset on a non-Claude runtime, the profile tiers have no effect on
actual model selection — agents use the runtime's default model. Choose "Inherit" to
force session-model behavior, set `runtime` + a profile to get tiered models, or
configure `model_overrides` manually in .planning/config.json to target specific
models per agent.
```

Use AskUserQuestion with current values pre-selected. Questions are grouped into six visual sections; the first question in each section carries the section-denoting `header` field (AskUserQuestion renders abbreviated section tags for grouping, max 12 chars).

Section layout:

### Planning
Research, Plan Checker, Pattern Mapper, Nyquist, UI Phase, UI Gate, AI Phase

### Execution
Verifier, TDD Mode, Code Review, Code Review Depth _(conditional — only when code_review=on)_, UI Review

### Docs & Output
Commit Docs, Skip Discuss, Worktrees

### Features
Intel, Graphify

### Model & Pipeline
Model Profile, Auto-Advance, Branching

### Misc
Context Warnings, Research Qs

**Conditional visibility — code_review_depth:** This question is shown only when the user's chosen `code_review` value (after they answer that question, or the pre-selected value if unchanged) is on. If `code_review` is off, omit the `code_review_depth` question from the AskUserQuestion block and preserve the existing `workflow.code_review_depth` value in config (do not overwrite). Implementation: ask the Model + Planning + Execution-up-to-Code-Review questions first; if `code_review=on`, include `code_review_depth` in the same batch; otherwise skip it. Conceptually this is a one-branch split on the `code_review` answer.

```
AskUserQuestion([
  {
    question: "Which model profile for agents?",
    header: "Model",
    multiSelect: false,
    options: [
      { label: "Quality", description: "Opus everywhere except verification (highest cost) — Claude only" },
      { label: "Balanced (Recommended)", description: "Opus for planning, Sonnet for research/execution/verification — Claude only" },
      { label: "Budget", description: "Sonnet for writing, Haiku for research/verification (lowest cost) — Claude only" },
      { label: "Inherit", description: "Use current session model for all agents (required for non-Claude runtimes: Codex, Gemini CLI, OpenRouter, local models)" }
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
    question: "Enable TDD Mode? (RED/GREEN/REFACTOR gates for eligible tasks)",
    header: "TDD",
    multiSelect: false,
    options: [
      { label: "No (Recommended)", description: "Execute tasks normally. Tests written alongside implementation." },
      { label: "Yes", description: "Planner applies type:tdd to business logic/APIs/validations; executor enforces gate sequence. End-of-phase review checks compliance." }
    ]
  },
  {
    question: "Enable Code Review? (/gsd-code-review and /gsd-code-review-fix commands)",
    header: "Code Review",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Enable /gsd-code-review commands for reviewing source files changed during a phase." },
      { label: "No", description: "Commands exit with a configuration gate message. Use when code review is handled externally." }
    ]
  },
  // Conditional: include the following code_review_depth question ONLY when the user's
  // chosen code_review value is "Yes". If code_review is "No", omit this question from
  // the AskUserQuestion call and do not touch the existing workflow.code_review_depth value.
  {
    question: "Code Review Depth? (default depth for /gsd-code-review — override per-run with --depth=)",
    header: "Review Depth",
    multiSelect: false,
    options: [
      { label: "Standard (Recommended)", description: "Per-file analysis. Balanced cost and signal." },
      { label: "Quick", description: "Pattern-matching only. Fastest, lowest cost." },
      { label: "Deep", description: "Cross-file analysis with import graphs. Highest cost, highest signal." }
    ]
  },
  {
    question: "Enable UI Review? (visual quality audit via /gsd-ui-review in autonomous mode)",
    header: "UI Review",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Run visual quality audit after phase execution in autonomous mode." },
      { label: "No", description: "Skip the UI audit step. Good for backend-only projects." }
    ]
  },
  {
    question: "Auto-advance pipeline? (discuss → plan → execute automatically)",
    header: "Auto",
    multiSelect: false,
    options: [
      { label: "No (Recommended)", description: "Manual /clear + paste between stages" },
      { label: "Yes", description: "Chain stages via Task() subagents (same isolation)" }
    ]
  },
  {
    question: "Run Pattern Mapper? (maps new files to existing codebase analogs between research and planning)",
    header: "Pattern Mapper",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "gsd-pattern-mapper runs between research and plan steps. Surfaces conventions so new code follows house style." },
      { label: "No", description: "Skip pattern mapping. Faster; lose consistency hinting for new files." }
    ]
  },
  {
    question: "Enable Nyquist Validation? (researches test coverage during planning)",
    header: "Nyquist",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Research automated test coverage during plan-phase. Adds validation requirements to plans. Blocks approval if tasks lack automated verify." },
      { label: "No", description: "Skip validation research. Good for rapid prototyping or no-test phases." }
    ]
  },
  // Note: Nyquist validation depends on research output. If research is disabled,
  // plan-phase automatically skips Nyquist steps (no RESEARCH.md to extract from).
  {
    question: "Enable UI Phase? (generates UI-SPEC.md design contracts for frontend phases)",
    header: "UI Phase",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Generate UI design contracts before planning frontend phases. Locks spacing, typography, color, and copywriting." },
      { label: "No", description: "Skip UI-SPEC generation. Good for backend-only projects or API phases." }
    ]
  },
  {
    question: "Enable UI Safety Gate? (prompts to run /gsd-ui-phase before planning frontend phases)",
    header: "UI Gate",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "plan-phase asks to run /gsd-ui-phase first when frontend indicators detected." },
      { label: "No", description: "No prompt — plan-phase proceeds without UI-SPEC check." }
    ]
  },
  {
    question: "Enable AI Phase? (framework selection + eval strategy for AI phases)",
    header: "AI Phase",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Run /gsd-ai-integration-phase before planning AI system phases. Surfaces the right framework, researches its docs, and designs the evaluation strategy." },
      { label: "No", description: "Skip AI design contract. Good for non-AI phases or when framework is already decided." }
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
    question: "Enable context window warnings? (injects advisory messages when context is getting full)",
    header: "Ctx Warnings",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Warn when context usage exceeds 65%. Helps avoid losing work." },
      { label: "No", description: "Disable warnings. Allows Claude to reach auto-compact naturally. Good for long unattended runs." }
    ]
  },
  {
    question: "Research best practices before asking questions? (web search during new-project and discuss-phase)",
    header: "Research Qs",
    multiSelect: false,
    options: [
      { label: "No (Recommended)", description: "Ask questions directly. Faster, uses fewer tokens." },
      { label: "Yes", description: "Search web for best practices before each question group. More informed questions but uses more tokens." }
    ]
  },
  {
    question: "Commit .planning/ files to git? (controls whether plans/artifacts are tracked in your repo)",
    header: "Commit Docs",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Commit .planning/ to git. Plans, research, and phase artifacts travel with the repo." },
      { label: "No", description: "Do not commit .planning/. Keep planning local only. Automatic when .planning/ is in .gitignore." }
    ]
  },
  {
    question: "Skip discuss-phase in autonomous mode? (use ROADMAP phase goals as spec)",
    header: "Skip Discuss",
    multiSelect: false,
    options: [
      { label: "No (Recommended)", description: "Run smart discuss before each phase — surfaces gray areas and captures decisions." },
      { label: "Yes", description: "Skip discuss in /gsd-autonomous — chain directly to plan. Best for backend/pipeline work where phase descriptions are the spec." }
    ]
  },
  {
    question: "Use git worktrees for parallel agent isolation?",
    header: "Worktrees",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Each parallel executor runs in its own worktree branch — no conflicts between agents." },
      { label: "No", description: "Disable worktree isolation. Agents run sequentially on the main working tree. Use if EnterWorktree creates branches from wrong base (known cross-platform issue)." }
    ]
  },
  {
    question: "Enable Intel? (queryable codebase intelligence via /gsd-intel — builds a JSON index in .planning/intel/)",
    header: "Intel",
    multiSelect: false,
    options: [
      { label: "No (Recommended)", description: "Skip intel indexing. Use when codebase is small or intel queries are not needed." },
      { label: "Yes", description: "Enable /gsd-intel commands. Builds and queries a JSON index of the codebase." }
    ]
  },
  {
    question: "Enable Graphify? (project knowledge graph via /gsd-graphify — builds a graph in .planning/graphs/)",
    header: "Graphify",
    multiSelect: false,
    options: [
      { label: "No (Recommended)", description: "Skip knowledge graph. Use when dependency graphs are not needed." },
      { label: "Yes", description: "Enable /gsd-graphify commands. Builds and queries a project knowledge graph." }
    ]
  }
])
```
</step>

<step name="update_config">
Merge new settings into existing config.json:

```json
{
  ...existing_config,
  "model_profile": "quality" | "balanced" | "budget" | "adaptive" | "inherit",
  "commit_docs": true/false,
  "workflow": {
    "research": true/false,
    "plan_check": true/false,
    "verifier": true/false,
    "auto_advance": true/false,
    "nyquist_validation": true/false,
    "pattern_mapper": true/false,
    "ui_phase": true/false,
    "ui_safety_gate": true/false,
    "ai_integration_phase": true/false,
    "tdd_mode": true/false,
    "code_review": true/false,
    "code_review_depth": "quick" | "standard" | "deep",
    "ui_review": true/false,
    "text_mode": true/false,
    "research_before_questions": true/false,
    "discuss_mode": "discuss" | "assumptions",
    "skip_discuss": true/false,
    "use_worktrees": true/false
  },
  "intel": {
    "enabled": true/false
  },
  "graphify": {
    "enabled": true/false
  },
  "git": {
    "branching_strategy": "none" | "phase" | "milestone",
    "quick_branch_template": <string|null>
  },
  "hooks": {
    "context_warnings": true/false,
    "workflow_guard": true/false
  }
}
```

**Safe merge:** Apply each chosen value via `gsd-sdk query config-set <key.path> <value>` so unrelated keys are never clobbered. `code_review_depth` is written only if the code_review question was answered `on`; otherwise leave the existing value in place.

Write updated config to `$GSD_CONFIG_PATH` (the workstream-aware path resolved in `ensure_and_load_config`). Never hardcode `.planning/config.json` — workstream installs route to `.planning/workstreams/<slug>/config.json`.
</step>

<step name="save_as_defaults">
Ask whether to save these settings as global defaults for future projects:

```
AskUserQuestion([
  {
    question: "Save these as default settings for all new projects?",
    header: "Defaults",
    multiSelect: false,
    options: [
      { label: "Yes", description: "New projects start with these settings (saved to ~/.gsd/defaults.json)" },
      { label: "No", description: "Only apply to this project" }
    ]
  }
])
```

If "Yes": write the same config object (minus project-specific fields like `brave_search`) to `~/.gsd/defaults.json`:

```bash
mkdir -p ~/.gsd
```

Write `~/.gsd/defaults.json` with:
```json
{
  "mode": <current>,
  "granularity": <current>,
  "model_profile": <current>,
  "commit_docs": <current>,
  "parallelization": <current>,
  "branching_strategy": <current>,
  "quick_branch_template": <current>,
  "workflow": {
    "research": <current>,
    "plan_check": <current>,
    "verifier": <current>,
    "auto_advance": <current>,
    "nyquist_validation": <current>,
    "pattern_mapper": <current>,
    "ui_phase": <current>,
    "ui_safety_gate": <current>,
    "ai_integration_phase": <current>,
    "tdd_mode": <current>,
    "code_review": <current>,
    "code_review_depth": <current>,
    "ui_review": <current>,
    "skip_discuss": <current>
  },
  "intel": {
    "enabled": <current>
  },
  "graphify": {
    "enabled": <current>
  }
}
```
</step>

<step name="confirm">
Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SETTINGS UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Setting              | Value |
|----------------------|-------|
| Model Profile        | {quality/balanced/budget/inherit} |
| Plan Researcher      | {On/Off} |
| Plan Checker         | {On/Off} |
| Pattern Mapper       | {On/Off} |
| Execution Verifier   | {On/Off} |
| TDD Mode             | {On/Off} |
| Code Review          | {On/Off} |
| Code Review Depth    | {quick/standard/deep} |
| UI Review            | {On/Off} |
| Commit Docs          | {On/Off} |
| Intel                | {On/Off} |
| Graphify             | {On/Off} |
| Auto-Advance         | {On/Off} |
| Nyquist Validation   | {On/Off} |
| UI Phase             | {On/Off} |
| UI Safety Gate       | {On/Off} |
| AI Integration Phase | {On/Off} |
| Git Branching        | {None/Per Phase/Per Milestone} |
| Skip Discuss         | {On/Off} |
| Context Warnings     | {On/Off} |
| Saved as Defaults    | {Yes/No} |

These settings apply to future /gsd-plan-phase and /gsd-execute-phase runs.

Quick commands:
- /gsd-settings-integrations — configure API keys (Brave/Firecrawl/Exa), review.models CLI routing, and agent_skills injection
- /gsd-set-profile <profile> — switch model profile
- /gsd-plan-phase --research — force research
- /gsd-plan-phase --skip-research — skip research
- /gsd-plan-phase --skip-verify — skip plan check
- /gsd-settings-advanced — power-user tuning (plan bounce, timeouts, branch templates, cross-AI, context window)
```
</step>

</process>

<success_criteria>
- [ ] Current config read
- [ ] User presented with 22 settings (profile + workflow toggles + features + git branching + ctx warnings), grouped into six sections: Planning, Execution, Docs & Output, Features, Model & Pipeline, Misc. `code_review_depth` is conditional on `code_review=on`.
- [ ] Config updated with model_profile, workflow, and git sections
- [ ] User offered to save as global defaults (~/.gsd/defaults.json)
- [ ] Changes confirmed to user
</success_criteria>
