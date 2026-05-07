# GSD Configuration Reference

> Full configuration schema, workflow toggles, model profiles, and git branching options. For feature context, see [Feature Reference](FEATURES.md).

---

## Configuration File

GSD stores project settings in `.planning/config.json`. Created during `/gsd-new-project`, updated via `/gsd-settings`.

### Full Schema

```json
{
  "mode": "interactive",
  "granularity": "standard",
  "model_profile": "balanced",
  "model_overrides": {},
  "models": {},
  "dynamic_routing": null,
  "planning": {
    "commit_docs": true,
    "search_gitignored": false,
    "sub_repos": []
  },
  "context": null,
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": false,
    "nyquist_validation": true,
    "ui_phase": true,
    "ui_safety_gate": true,
    "ui_review": true,
    "node_repair": true,
    "node_repair_budget": 2,
    "research_before_questions": false,
    "discuss_mode": "discuss",
    "max_discuss_passes": 3,
    "skip_discuss": false,
    "tdd_mode": false,
    "text_mode": false,
    "use_worktrees": true,
    "code_review": true,
    "code_review_depth": "standard",
    "plan_bounce": false,
    "plan_bounce_script": null,
    "plan_bounce_passes": 2,
    "plan_chunked": false,
    "code_review_command": null,
    "cross_ai_execution": false,
    "cross_ai_command": null,
    "cross_ai_timeout": 300,
    "security_enforcement": true,
    "security_asvs_level": 1,
    "security_block_on": "high",
    "post_planning_gaps": true,
    "build_command": null,
    "test_command": null
  },
  "hooks": {
    "context_warnings": true,
    "workflow_guard": false
  },
  "parallelization": {
    "enabled": true,
    "plan_level": true,
    "task_level": false,
    "skip_checkpoints": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  },
  "git": {
    "branching_strategy": "none",
    "phase_branch_template": "gsd/phase-{phase}-{slug}",
    "milestone_branch_template": "gsd/{milestone}-{slug}",
    "quick_branch_template": null
  },
  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_breakdown": true,
    "confirm_plan": true,
    "execute_next_plan": true,
    "issues_review": true,
    "confirm_transition": true
  },
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  },
  "project_code": null,
  "agent_skills": {},
  "response_language": null,
  "features": {
    "thinking_partner": false,
    "global_learnings": false
  },
  "learnings": {
    "max_inject": 10
  },
  "intel": {
    "enabled": false
  },
  "claude_md_path": "./CLAUDE.md"
}
```

---

## Core Settings

| Setting | Type | Options | Default | Description |
|---------|------|---------|---------|-------------|
| `mode` | enum | `interactive`, `yolo` | `interactive` | `yolo` auto-approves decisions; `interactive` confirms at each step |
| `granularity` | enum | `coarse`, `standard`, `fine` | `standard` | Controls phase count: `coarse` (3-5), `standard` (5-8), `fine` (8-12) |
| `model_profile` | enum | `quality`, `balanced`, `budget`, `adaptive`, `inherit` | `balanced` | Model tier for each agent (see [Model Profiles](#model-profiles)). `adaptive` was added per [#1713](https://github.com/gsd-build/get-shit-done/issues/1713) / [#1806](https://github.com/gsd-build/get-shit-done/issues/1806) and resolves the same way as the other tiers under runtime-aware profiles. |
| `runtime` | string | `claude`, `codex`, or any string | (none) | Active runtime for [runtime-aware profile resolution](#runtime-aware-profiles-2517). When set, profile tiers (opus/sonnet/haiku) resolve to runtime-native model IDs. Today only the Codex install path emits per-agent model IDs from this resolver; other runtimes (`opencode`, `gemini`, `qwen`, `copilot`, …) consume the resolver at spawn time and gain dedicated install-path support in [#2612](https://github.com/gsd-build/get-shit-done/issues/2612). When unset (default), behavior is unchanged from prior versions. Added in v1.39 |
| `model_profile_overrides.<runtime>.<tier>` | string \| object | per-runtime tier override | (none) | Override the runtime-aware tier mapping for a specific `(runtime, tier)`. Tier is one of `opus`, `sonnet`, `haiku`. Value is either a model ID string (e.g. `"gpt-5-pro"`) or `{ model, reasoning_effort }`. See [Runtime-Aware Profiles](#runtime-aware-profiles-2517). Added in v1.39 |
| `models.<phase_type>` | enum | `opus`, `sonnet`, `haiku`, `inherit` | (none) | Per-phase-type model tier. Six accepted slots: `planning`, `discuss`, `research`, `execution`, `verification`, `completion`. Lets you tune at the phase level ("Opus for planning, Sonnet for the rest") without learning agent names. Resolves between `model_overrides` (higher) and `model_profile` (lower); see [Per-Phase-Type Models](#per-phase-type-models-models--added-in-v140). Added in v1.40 ([#3023](https://github.com/gsd-build/get-shit-done/pull/3030)) |
| `dynamic_routing.enabled` | boolean | `true`, `false` | `false` | Master switch for [dynamic routing with failure-tier escalation](#dynamic-routing-with-failure-tier-escalation-dynamic_routing--added-in-v140). When `true`, agents resolve to `tier_models[default_tier]` and escalate one tier up on orchestrator-detected soft failure. Added in v1.40 ([#3024](https://github.com/gsd-build/get-shit-done/pull/3031)) |
| `dynamic_routing.tier_models.<tier>` | enum | `opus`, `sonnet`, `haiku` | (none) | Tier alias for `light`, `standard`, or `heavy`. Used when `dynamic_routing.enabled: true`. Added in v1.40 |
| `dynamic_routing.escalate_on_failure` | boolean | `true`, `false` | `true` | When `false`, escalation is disabled even if `enabled: true` — every attempt uses the default tier. Added in v1.40 |
| `dynamic_routing.max_escalations` | integer | `0`, `1`, `2`, … | `1` | Hard cap on retries per agent invocation. Beyond the cap the resolver returns the cap-tier model. Added in v1.40 |
| `project_code` | string | any short string | (none) | Prefix for phase directory names (e.g., `"ABC"` produces `ABC-01-setup/`). Added in v1.31 |
| `response_language` | string | language code | (none) | Language for agent responses (e.g., `"pt"`, `"ko"`, `"ja"`). Propagates to all spawned agents for cross-phase language consistency. Added in v1.32 |
| `context_window` | number | any integer | `200000` | Context window size in tokens. Set `1000000` for 1M-context models (e.g., `claude-opus-4-7[1m]`). Values `>= 500000` enable adaptive context enrichment (full-body reads of prior SUMMARY.md, deeper anti-pattern reads). Configured via `/gsd-config --advanced`. |
| `context_profile` | string | `dev`, `research`, `review` | (none) | Execution context preset that applies a pre-configured bundle of mode, model, and workflow settings for the current type of work. Added in v1.34 |
| `claude_md_path` | string | any file path | `./CLAUDE.md` | Custom output path for the generated CLAUDE.md file. Useful for monorepos or projects that need CLAUDE.md in a non-root location. Defaults to `./CLAUDE.md` at the project root. Added in v1.36 |
| `claude_md_assembly.mode` | enum | `embed`, `link` | `embed` | Controls how managed sections are written into CLAUDE.md. `embed` (default) inlines content between GSD markers. `link` writes `@.planning/<source-path>` instead — Claude Code expands the reference at runtime, reducing CLAUDE.md size by ~65% on typical projects. `link` only applies to sections that have a real source file; `workflow` and fallback sections always embed. Per-block overrides: `claude_md_assembly.blocks.<section>` (e.g. `claude_md_assembly.blocks.architecture: link`). Added in v1.38 |
| `context` | string | any text | (none) | Custom context string injected into every agent prompt for the project. Use to provide persistent project-specific guidance (e.g., coding conventions, team practices) that every agent should be aware of |
| `phase_naming` | string | any string | (none) | Custom prefix for phase directory names. When set, overrides the auto-generated phase slug (e.g., `"feature"` produces `feature-01-setup/` instead of the roadmap-derived slug) |
| `brave_search` | boolean | `true`/`false` | auto-detected | Override auto-detection of Brave Search API availability. When unset, GSD checks for `BRAVE_API_KEY` env var or `~/.gsd/brave_api_key` file |
| `firecrawl` | boolean | `true`/`false` | auto-detected | Override auto-detection of Firecrawl API availability. When unset, GSD checks for `FIRECRAWL_API_KEY` env var or `~/.gsd/firecrawl_api_key` file |
| `exa_search` | boolean | `true`/`false` | auto-detected | Override auto-detection of Exa Search API availability. When unset, GSD checks for `EXA_API_KEY` env var or `~/.gsd/exa_api_key` file |
| `search_gitignored` | boolean | `true`/`false` | `false` | Legacy top-level alias for `planning.search_gitignored`. Prefer the namespaced form; this alias is accepted for backward compatibility |

> **Note:** `granularity` was renamed from `depth` in v1.22.3. Existing configs are auto-migrated.

---

## Integration Settings

Configured interactively via [`/gsd-config --integrations`](COMMANDS.md#gsd-config). These are *connectivity* settings — API keys and cross-tool routing — and are intentionally kept separate from `/gsd-settings` (workflow toggles).

### Search API keys

API key fields accept a string value (the key itself). They can also be set to the sentinels `true`/`false`/`null` to override auto-detection from env vars / `~/.gsd/*_api_key` files (legacy behavior, see rows above).

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `brave_search` | string \| boolean \| null | `null` | Brave Search API key used for web research. Displayed as `****<last-4>` in all UI / `config-set` output; never echoed plaintext |
| `firecrawl` | string \| boolean \| null | `null` | Firecrawl API key for deep-crawl scraping. Masked in display |
| `exa_search` | string \| boolean \| null | `null` | Exa Search API key for semantic search. Masked in display |

**Masking convention (`get-shit-done/bin/lib/secrets.cjs`):** keys 8+ characters render as `****<last-4>`; shorter keys render as `****`; `null`/empty renders as `(unset)`. Plaintext is written as-is to `.planning/config.json` — that file is the security boundary — but the CLI, confirmation tables, logs, and `AskUserQuestion` descriptions never display the plaintext. This applies to the `config-set` command output itself: `config-set brave_search <key>` returns a JSON payload with the value masked.

### Code-review CLI routing

`review.models.<cli>` maps a reviewer flavor to a shell command. The code-review workflow shells out using this command when a matching flavor is requested.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `review.models.claude` | string | (session model) | Command for Claude-flavored review. Defaults to the session model when unset |
| `review.models.codex` | string | `null` | Command for Codex review, e.g. `"codex exec --model gpt-5"` |
| `review.models.gemini` | string | `null` | Command for Gemini review, e.g. `"gemini -m gemini-2.5-pro"` |
| `review.models.opencode` | string | `null` | Command for OpenCode review, e.g. `"opencode run --model claude-sonnet-4"` |

The `<cli>` slug is validated against `[a-zA-Z0-9_-]+`. Empty or path-containing slugs are rejected by `config-set`.

### Agent-skill injection (dynamic)

`agent_skills.<agent-type>` extends the `agent_skills` map documented below. Slug is validated against `[a-zA-Z0-9_-]+` — no path separators, no whitespace, no shell metacharacters. Configured interactively via `/gsd-config --integrations`.

---

## Workflow Toggles

All workflow toggles follow the **absent = enabled** pattern. If a key is missing from config, it defaults to `true`.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `workflow.research` | boolean | `true` | Domain investigation before planning each phase |
| `workflow.plan_check` | boolean | `true` | Plan verification loop (up to 3 iterations) |
| `workflow.verifier` | boolean | `true` | Post-execution verification against phase goals |
| `workflow.auto_advance` | boolean | `false` | Auto-chain discuss → plan → execute without stopping |
| `workflow.nyquist_validation` | boolean | `true` | Test coverage mapping during plan-phase research |
| `workflow.ui_phase` | boolean | `true` | Generate UI design contracts for frontend phases |
| `workflow.ui_safety_gate` | boolean | `true` | Prompt to run /gsd-ui-phase for frontend phases during plan-phase |
| `workflow.ui_review` | boolean | `true` | Run visual quality audit (`/gsd-ui-review`) after phase execution in autonomous mode. When `false`, the UI audit step is skipped. |
| `workflow.node_repair` | boolean | `true` | Autonomous task repair on verification failure |
| `workflow.node_repair_budget` | number | `2` | Max repair attempts per failed task |
| `workflow.research_before_questions` | boolean | `false` | Run research before discussion questions instead of after |
| `workflow.discuss_mode` | string | `'discuss'` | Controls how `/gsd-discuss-phase` gathers context. `'discuss'` (default) asks questions one-by-one. `'assumptions'` reads the codebase first, generates structured assumptions with confidence levels, and only asks you to correct what's wrong. Added in v1.28 |
| `workflow.max_discuss_passes` | number | `3` | Maximum number of question rounds in discuss-phase before the workflow stops asking. Useful in headless/auto mode to prevent infinite discussion loops. |
| `workflow.skip_discuss` | boolean | `false` | When `true`, `/gsd-autonomous` bypasses the discuss-phase entirely, writing minimal CONTEXT.md from the ROADMAP phase goal. Useful for projects where developer preferences are fully captured in PROJECT.md/REQUIREMENTS.md. Added in v1.28 |
| `workflow.text_mode` | boolean | `false` | Replaces AskUserQuestion TUI menus with plain-text numbered lists. Required for Claude Code remote sessions (`/rc` mode) where TUI menus don't render. Can also be set per-session with `--text` flag on discuss-phase. Added in v1.28 |
| `workflow.use_worktrees` | boolean | `true` | When `false`, disables git worktree isolation for parallel execution. Users who prefer sequential execution or whose environment does not support worktrees can disable this. Added in v1.31 |
| `workflow.worktree_skip_hooks` | boolean | `false` | When `true`, executor agents in worktree mode pass `--no-verify` (skipping pre-commit hooks) and post-wave hook validation runs against the merged result instead. Opt-in escape hatch for projects whose hooks cannot run in agent worktrees. Default `false` runs hooks on every commit (#2924). |
| `workflow.code_review` | boolean | `true` | Enable `/gsd-code-review` and `/gsd-code-review --fix` commands. When `false`, the commands exit with a configuration gate message. Added in v1.34 |
| `workflow.code_review_depth` | string | `standard` | Default review depth for `/gsd-code-review`: `quick` (pattern-matching only), `standard` (per-file analysis), or `deep` (cross-file with import graphs). Can be overridden per-run with `--depth=`. Added in v1.34 |
| `workflow.plan_bounce` | boolean | `false` | Run external validation script against generated plans. When enabled, the plan-phase orchestrator pipes each PLAN.md through the script specified by `plan_bounce_script` and blocks on non-zero exit. Added in v1.36 |
| `workflow.plan_bounce_script` | string | (none) | Path to the external script invoked for plan bounce validation. Receives the PLAN.md path as its first argument. Required when `plan_bounce` is `true`. Added in v1.36 |
| `workflow.plan_bounce_passes` | number | `2` | Number of sequential bounce passes to run. Each pass feeds the previous pass's output back into the validator. Higher values increase rigor at the cost of latency. Added in v1.36 |
| `workflow.post_planning_gaps` | boolean | `true` | Unified post-planning gap report (#2493). After all plans are generated and committed, scans REQUIREMENTS.md and CONTEXT.md `<decisions>` against every PLAN.md in the phase directory, then prints one `Source \| Item \| Status` table. Word-boundary matching (REQ-1 vs REQ-10) and natural sort (REQ-02 before REQ-10). Non-blocking — informational report only. Set to `false` to skip Step 13e of plan-phase. |
| `workflow.plan_review_convergence` | boolean | `false` | Enable the `/gsd-plan-review-convergence` command. Disabled by default — the command exits with an enable instruction when this key is `false`. The command automates the manual plan→review→replan loop: it spawns configured reviewers (Codex, Gemini, Claude, OpenCode, Ollama, LM Studio, llama.cpp), counts unresolved HIGH concerns via the CYCLE_SUMMARY contract, replans with `--reviews` feedback, and repeats until converged or max cycles reached. Enable with `gsd config-set workflow.plan_review_convergence true`. Added in v1.39 |
| `workflow.plan_chunked` | boolean | `false` | Enable chunked planning mode. When `true` (or when `--chunked` flag is passed to `/gsd-plan-phase`), the orchestrator splits the single long-lived planner Task into a short outline Task followed by N short per-plan Tasks (~3-5 min each). Each plan is committed individually for crash resilience. If a Task hangs and the terminal is force-killed, rerunning with `--chunked` resumes from the last completed plan. Particularly useful on Windows where long-lived Tasks may hang on stdio. Added in v1.38 |
| `workflow.code_review_command` | string | (none) | Shell command for external code review integration in `/gsd-ship`. Receives changed file paths via stdin. Non-zero exit blocks the ship workflow. Added in v1.36 |
| `workflow.tdd_mode` | boolean | `false` | Enable TDD pipeline as a first-class execution mode. When `true`, the planner aggressively applies `type: tdd` to eligible tasks (business logic, APIs, validations, algorithms) and the executor enforces RED/GREEN/REFACTOR gate sequence. An end-of-phase collaborative review checkpoint verifies gate compliance. Added in v1.36 |
| `workflow.cross_ai_execution` | boolean | `false` | Delegate phase execution to an external AI CLI instead of spawning local executor agents. Useful for leveraging a different model's strengths for specific phases. Added in v1.36 |
| `workflow.cross_ai_command` | string | (none) | Shell command template for cross-AI execution. Receives the phase prompt via stdin. Must produce SUMMARY.md-compatible output. Required when `cross_ai_execution` is `true`. Added in v1.36 |
| `workflow.cross_ai_timeout` | number | `300` | Timeout in seconds for cross-AI execution commands. Prevents runaway external processes. Added in v1.36 |
| `workflow.ai_integration_phase` | boolean | `true` | Enable the `/gsd-ai-integration-phase` command. When `false`, the command exits with a configuration gate message |
| `workflow.auto_prune_state` | boolean | `false` | When `true`, automatically prune stale entries from STATE.md at phase boundaries instead of prompting |
| `workflow.pattern_mapper` | boolean | `true` | Run the `gsd-pattern-mapper` agent between research and planning to map new files to existing codebase analogs |
| `workflow.subagent_timeout` | number | `600` | Timeout in seconds for individual subagent invocations. Increase for long-running research or execution phases |
| `workflow.inline_plan_threshold` | number | `3` | Maximum number of tasks in a phase before the planner generates a separate PLAN.md file instead of inlining tasks in the prompt |
| `workflow.drift_threshold` | number | `3` | Minimum number of new structural elements (new directories, barrel exports, migrations, route modules) introduced during a phase before the post-execute codebase-drift gate takes action. See [#2003](https://github.com/gsd-build/get-shit-done/issues/2003). Added in v1.39 |
| `workflow.drift_action` | string | `warn` | What to do when `workflow.drift_threshold` is exceeded after `/gsd-execute-phase`. `warn` prints a message suggesting `/gsd-map-codebase --paths …`; `auto-remap` spawns `gsd-codebase-mapper` scoped to the affected paths. Added in v1.39 |
| `workflow.build_command` | string | (none) | Shell command to build the project in the post-merge build gate (Step A of step 5.6 in execute-phase). When unset, the gate auto-detects: Xcode (`.xcodeproj` present) → `xcodebuild build`, `Makefile` with `build:` target → `make build`, Justfile → `just build`, `Cargo.toml` → `cargo build`, `go.mod` → `go build ./...`, Python → `python -m py_compile`, `package.json` with `build` script → `npm run build`. Runs with a 5-minute timeout; failure increments `WAVE_FAILURE_COUNT`. Added in v1.39 |
| `workflow.test_command` | string | (none) | Shell command to run the project's test suite in the post-merge test gate (Step B of step 5.6 in execute-phase) and the regression gate. When unset, the gate auto-detects: Xcode (`.xcodeproj` present) → `xcodebuild test`, `Makefile` with `test:` target → `make test`, Justfile → `just test`, `package.json` → `npm test`, `Cargo.toml` → `cargo test`, `go.mod` → `go test ./...`, Python → `python -m pytest`. Runs with a 5-minute timeout; failure increments `WAVE_FAILURE_COUNT`. Added in v1.39 |

### Recommended Presets

| Scenario | mode | granularity | profile | research | plan_check | verifier |
|----------|------|-------------|---------|----------|------------|----------|
| Prototyping | `yolo` | `coarse` | `budget` | `false` | `false` | `false` |
| Normal development | `interactive` | `standard` | `balanced` | `true` | `true` | `true` |
| Production release | `interactive` | `fine` | `quality` | `true` | `true` | `true` |

---

## Planning Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `planning.commit_docs` | boolean | `true` | Whether `.planning/` files are committed to git |
| `planning.search_gitignored` | boolean | `false` | Add `--no-ignore` to broad searches to include `.planning/` |
| `planning.sub_repos` | array of strings | `[]` | Paths of nested sub-repos relative to the project root. When set, GSD-aware tooling scopes phase-lookup, path-resolution, and commit operations per sub-repo instead of treating the outer repo as a monorepo |

### Project-Root Resolution in Multi-Repo Workspaces

When `sub_repos` is set and `gsd-tools.cjs` or `gsd-sdk query` is invoked from inside a listed child repo, both CLIs walk up to the parent workspace that owns `.planning/` before dispatching handlers. Resolution order (checked at each ancestor up to 10 levels, never above `$HOME`):

1. If the starting directory already has its own `.planning/`, it is the project root (no walk-up).
2. Parent has `.planning/config.json` listing the starting directory's top-level segment in `sub_repos` (or the legacy `planning.sub_repos` shape).
3. Parent has `.planning/config.json` with legacy `multiRepo: true` and the starting directory is inside a git repo.
4. Parent has `.planning/` and an ancestor up to the candidate parent contains `.git` (heuristic fallback).

If none match, the starting directory is returned unchanged. Explicit `--project-dir /path/to/workspace` is idempotent under this resolution.

### Auto-Detection

If `.planning/` is in `.gitignore`, `commit_docs` is automatically `false` regardless of config.json. This prevents git errors.

---

## Hook Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hooks.context_warnings` | boolean | `true` | Show context window usage warnings via context monitor hook |
| `hooks.workflow_guard` | boolean | `false` | Warn when file edits happen outside GSD workflow context (advises using `/gsd-quick` or `/gsd-fast`) |
| `statusline.show_last_command` | boolean | `false` | Append `last: /<cmd>` suffix to the statusline showing the most recently invoked slash command. Opt-in; reads the active session transcript to extract the latest `<command-name>` tag (closes #2538) |

The prompt injection guard hook (`gsd-prompt-guard.js`) is always active and cannot be disabled — it's a security feature, not a workflow toggle.

### Private Planning Setup

To keep planning artifacts out of git:

1. Set `planning.commit_docs: false` and `planning.search_gitignored: true`
2. Add `.planning/` to `.gitignore`
3. If previously tracked: `git rm -r --cached .planning/ && git commit -m "chore: stop tracking planning docs"`

---

## Agent Skills Injection

Inject custom skill files into GSD subagent prompts. Skills are read by agents at spawn time, giving them project-specific instructions beyond what CLAUDE.md provides.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `agent_skills` | object | `{}` | Map of agent types to skill directory paths |

### Configuration

Add an `agent_skills` section to `.planning/config.json` mapping agent types to arrays of skill directory paths (relative to project root):

```json
{
  "agent_skills": {
    "gsd-executor": ["skills/testing-standards", "skills/api-conventions"],
    "gsd-planner": ["skills/architecture-rules"],
    "gsd-verifier": ["skills/acceptance-criteria"]
  }
}
```

Each path must be a directory containing a `SKILL.md` file. Paths are validated for safety (no traversal outside project root).

### Supported Agent Types

Any GSD agent type can receive skills. Common types:

- `gsd-executor` -- executes implementation plans
- `gsd-planner` -- creates phase plans
- `gsd-checker` -- verifies plan quality
- `gsd-verifier` -- post-execution verification
- `gsd-researcher` -- phase research
- `gsd-project-researcher` -- new-project research
- `gsd-debugger` -- diagnostic agents
- `gsd-codebase-mapper` -- codebase analysis
- `gsd-advisor` -- discuss-phase advisors
- `gsd-ui-researcher` -- UI design contract creation
- `gsd-ui-checker` -- UI spec verification
- `gsd-roadmapper` -- roadmap creation
- `gsd-synthesizer` -- research synthesis

### How It Works

At spawn time, workflows call `gsd-sdk query agent-skills <type>` (or legacy `node gsd-tools.cjs agent-skills <type>`) to load configured skills. If skills exist for the agent type, they are injected as an `<agent_skills>` block in the Task() prompt:

```xml
<agent_skills>
Read these user-configured skills:
- @skills/testing-standards/SKILL.md
- @skills/api-conventions/SKILL.md
</agent_skills>
```

If no skills are configured, the block is omitted (zero overhead).

### CLI

Set skills via the CLI:

```bash
gsd-sdk query config-set agent_skills.gsd-executor '["skills/my-skill"]'
```

---

## Feature Flags

Toggle optional capabilities via the `features.*` config namespace. Feature flags default to `false` (disabled) — enabling a flag opts into new behavior without affecting existing workflows.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `features.thinking_partner` | boolean | `false` | Enable thinking partner analysis at workflow decision points |
| `features.global_learnings` | boolean | `false` | Enable cross-project learnings pipeline (auto-copy at phase completion, planner injection) |
| `learnings.max_inject` | number | `10` | Maximum number of cross-project learnings injected into each planner prompt. Lower values reduce prompt size; higher values provide broader historical context |
| `intel.enabled` | boolean | `false` | Enable queryable codebase intelligence system. When `true`, `/gsd-map-codebase --query` commands build and query a JSON index in `.planning/intel/`. Added in v1.34 |

<a id="graphify-settings"></a>
### Graphify Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `graphify.enabled` | boolean | `false` | Enable the project knowledge graph. When `true`, `/gsd-graphify` builds and queries a graph in `.planning/graphs/`. Added in v1.36 |
| `graphify.build_timeout` | number (seconds) | `300` | Maximum seconds allowed for a `/gsd-graphify build` run before it aborts. Added in v1.36 |

#### Multi-developer setup

If multiple developers will rebuild the graph in the same repo, run once per
clone after enabling graphify:

```bash
graphify hook install
```

This installs a git merge driver that union-merges concurrent `graph.json`
writes (no conflict markers in the knowledge graph), plus the post-commit
rebuild hook. It writes `.gitattributes` and registers `graphify
merge-driver` in `.git/config`. Solo projects can skip this step; running it
anyway is harmless. Introduced upstream in graphify v0.7.0 alongside the
`built_at_commit` freshness signal that `/gsd-graphify status` surfaces.

#### Commit-based staleness

`/gsd-graphify status` reports two orthogonal staleness signals:

- **`stale`** (mtime-based, 24-hour window) — when the graph file was last
  written. Useful when graphify isn't run automatically.
- **`commit_stale`** (commit-based, requires graphify v0.7+) — whether the
  graph was built against the current `git HEAD`. Trustworthy when present.
  Tri-state: `true` / `false` / `null`. `null` means the signal is
  unavailable (pre-v0.7 graph, no git, or unreachable commit) — fall back
  to the mtime flag.

A CI-built graph rebuilt minutes ago against an old checkout will read as
fresh on mtime but `commit_stale: true`. Surface both when answering
architecture questions.

### Usage

```bash
# Enable a feature
gsd-sdk query config-set features.global_learnings true

# Disable a feature
gsd-sdk query config-set features.thinking_partner false
```

The `features.*` namespace is a dynamic key pattern — new feature flags can be added without modifying `VALID_CONFIG_KEYS`. Any key matching `features.<name>` is accepted by the config system.

---

## Parallelization Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `parallelization` | boolean | `true` | Shorthand for `parallelization.enabled`. Setting `parallelization false` disables parallel execution without changing other sub-keys |
| `parallelization.enabled` | boolean | `true` | Run independent plans simultaneously |
| `parallelization.plan_level` | boolean | `true` | Parallelize at plan level |
| `parallelization.task_level` | boolean | `false` | Parallelize tasks within a plan |
| `parallelization.skip_checkpoints` | boolean | `true` | Skip checkpoints during parallel execution |
| `parallelization.max_concurrent_agents` | number | `3` | Maximum simultaneous agents |
| `parallelization.min_plans_for_parallel` | number | `2` | Minimum plans to trigger parallel execution |

> **Pre-commit hooks and parallel execution**: When parallelization is enabled, executor agents commit with `--no-verify` to avoid build lock contention (e.g., cargo lock fights in Rust projects). The orchestrator validates hooks once after each wave completes. STATE.md writes are protected by file-level locking to prevent concurrent write corruption. If you need hooks to run per-commit, set `parallelization.enabled: false`.

---

## STATE.md Frontmatter (Phase Lifecycle)

`STATE.md` carries YAML frontmatter that the status-line hook reads on every render. v1.40 adds four optional phase-lifecycle fields read by `parseStateMd()` and rendered by `formatGsdState()`:

| Field | Type | Purpose |
|-------|------|---------|
| `active_phase` | string (e.g. `"4.5"`) | Phase number when an orchestrator command is in flight |
| `next_action` | string | Recommended next command when idle (`discuss-phase` / `plan-phase` / `execute-phase` / `verify-phase`) |
| `next_phases` | YAML flow array | Phases the `next_action` applies to (e.g. `["4.5"]`) |
| `progress` | block | Nested `total_phases` / `completed_phases` / `percent` for the milestone progress bar |

All four fields are **optional and additive** — STATE.md files without them keep rendering exactly as in v1.38.x. See [`STATE-MD-LIFECYCLE.md`](STATE-MD-LIFECYCLE.md) for the full field reference, parser constraints, and rendering scenes.

---

## Git Branching

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `git.branching_strategy` | enum | `none` | `none`, `phase`, or `milestone` |
| `git.base_branch` | string | `main` | The integration branch that phase/milestone branches are created from and merged back into. Override when your repo uses `master` or a release branch |
| `git.phase_branch_template` | string | `gsd/phase-{phase}-{slug}` | Branch name template for phase strategy |
| `git.milestone_branch_template` | string | `gsd/{milestone}-{slug}` | Branch name template for milestone strategy |
| `git.quick_branch_template` | string or null | `null` | Optional branch name template for `/gsd-quick` tasks |

### Strategy Comparison

| Strategy | Creates Branch | Scope | Merge Point | Best For |
|----------|---------------|-------|-------------|----------|
| `none` | Never | N/A | N/A | Solo development, simple projects |
| `phase` | At `execute-phase` start | One phase | User merges after phase | Code review per phase, granular rollback |
| `milestone` | At first `execute-phase` | All phases in milestone | At `complete-milestone` | Release branches, PR per version |

### Template Variables

| Variable | Available In | Example |
|----------|-------------|---------|
| `{phase}` | `phase_branch_template` | `03` (zero-padded) |
| `{slug}` | Both templates | `user-authentication` (lowercase, hyphenated) |
| `{milestone}` | `milestone_branch_template` | `v1.0` |
| `{num}` / `{quick}` | `quick_branch_template` | `260317-abc` (quick task ID) |

Example quick-task branching:

```json
"git": {
  "quick_branch_template": "gsd/quick-{num}-{slug}"
}
```

### Merge Options at Milestone Completion

| Option | Git Command | Result |
|--------|-------------|--------|
| Squash merge (recommended) | `git merge --squash` | Single clean commit per branch |
| Merge with history | `git merge --no-ff` | Preserves all individual commits |
| Delete without merging | `git branch -D` | Discard branch work |
| Keep branches | (none) | Manual handling later |

---

## Gate Settings

Control confirmation prompts during workflows.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `gates.confirm_project` | boolean | `true` | Confirm project details before finalizing |
| `gates.confirm_phases` | boolean | `true` | Confirm phase breakdown |
| `gates.confirm_roadmap` | boolean | `true` | Confirm roadmap before proceeding |
| `gates.confirm_breakdown` | boolean | `true` | Confirm task breakdown |
| `gates.confirm_plan` | boolean | `true` | Confirm each plan before execution |
| `gates.execute_next_plan` | boolean | `true` | Confirm before executing next plan |
| `gates.issues_review` | boolean | `true` | Review issues before creating fix plans |
| `gates.confirm_transition` | boolean | `true` | Confirm phase transition |

---

## Safety Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `safety.always_confirm_destructive` | boolean | `true` | Confirm destructive operations (deletes, overwrites) |
| `safety.always_confirm_external_services` | boolean | `true` | Confirm external service interactions |

---

## Security Settings

Settings for the security enforcement feature (v1.31). All follow the **absent = enabled** pattern. These keys live under `workflow.*` in `.planning/config.json` — matching the shipped template and the runtime reads in `workflows/plan-phase.md`, `workflows/execute-phase.md`, `workflows/secure-phase.md`, and `workflows/verify-work.md`.

These keys live under `workflow.*` — that is where the workflows and installer write and read them. Setting them at the top level of `config.json` is silently ignored.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `workflow.security_enforcement` | boolean | `true` | Enable threat-model-anchored security verification via `/gsd-secure-phase`. When `false`, security checks are skipped entirely |
| `workflow.security_asvs_level` | number (1-3) | `1` | OWASP ASVS verification level. Level 1 = opportunistic, Level 2 = standard, Level 3 = comprehensive |
| `workflow.security_block_on` | string | `"high"` | Minimum severity that blocks phase advancement. Options: `"high"`, `"medium"`, `"low"` |

---

## Decision Coverage Gates (`workflow.context_coverage_gate`)

When `discuss-phase` writes implementation decisions into CONTEXT.md
`<decisions>`, two gates ensure those decisions survive the trip into
plans and shipped code (issue #2492).

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `workflow.context_coverage_gate` | boolean | `true` | Toggle for both decision-coverage gates. When `false`, both the plan-phase translation gate and the verify-phase validation gate skip silently. |

### What the gates do

**Plan-phase translation gate (BLOCKING).** Runs immediately after the
existing requirements coverage gate, before plans are committed. For each
trackable decision in `<decisions>`, it checks that the decision id
(`D-NN`) or its text appears in at least one plan's `must_haves`,
`truths`, or body. A miss surfaces the missing decision by id and refuses
to mark the phase planned.

**Verify-phase validation gate (NON-BLOCKING).** Runs alongside the other
verify steps. Searches every shipped artifact (PLAN.md, SUMMARY.md, files
modified, recent commit subjects) for each trackable decision. Misses are
written to VERIFICATION.md as a warning section but do **not** flip the
overall verification status. The asymmetry is deliberate — by verify time
the work is done, and a fuzzy substring miss should not fail an otherwise
green phase.

### How to write decisions the gates accept

The discuss-phase template already produces `D-NN`-numbered decisions.
The gate is happiest when:

1. Every plan that implements a decision **cites the id** somewhere —
   `must_haves.truths: ["D-12: bit offsets exposed"]` or a `D-12:` mention
   in the plan body. Strict id match is the cheapest, deterministic path.
2. Soft phrase matching is a fallback for paraphrases — if a 6+-word slice
   of the decision text appears verbatim in a plan/summary, it counts.

### Opt-outs

A decision is **not** subject to the gates when any of the following
apply:

- It lives under the `### Claude's Discretion` heading inside `<decisions>`.
- It is tagged `[informational]`, `[folded]`, or `[deferred]` in its
  bullet (e.g., `- **D-08 [informational]:** Naming style for internal
  helpers`).

Use these escape hatches when a decision genuinely doesn't need plan
coverage — implementation discretion, future ideas captured for the
record, or items already deferred to a later phase.

---

## Review Settings

Configure per-CLI model selection for `/gsd-review`. When set, overrides the CLI's default model for that reviewer.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `review.models.gemini` | string | (CLI default) | Model used when `--gemini` reviewer is invoked |
| `review.models.claude` | string | (CLI default) | Model used when `--claude` reviewer is invoked |
| `review.models.codex` | string | (CLI default) | Model used when `--codex` reviewer is invoked |
| `review.models.opencode` | string | (CLI default) | Model used when `--opencode` reviewer is invoked |
| `review.models.qwen` | string | (CLI default) | Model used when `--qwen` reviewer is invoked |
| `review.models.cursor` | string | (CLI default) | Model used when `--cursor` reviewer is invoked |
| `review.models.ollama` | string | (server default) | Model name passed to Ollama when `--ollama` reviewer is invoked. If unset, the first available model reported by the server is used (e.g. `llama3`). Set to a specific tag: `gsd config-set review.models.ollama codellama` |
| `review.models.lm_studio` | string | (server default) | Model name passed to LM Studio when `--lm-studio` reviewer is invoked. If unset, the first available model reported by the server is used. |
| `review.models.llama_cpp` | string | (server default) | Model name passed to llama.cpp when `--llama-cpp` reviewer is invoked. If unset, the first model reported by `/v1/models` is used. |
| `review.ollama_host` | string | `http://localhost:11434` | Base URL of the Ollama server. Override when running Ollama on a non-default port or remote host: `gsd config-set review.ollama_host http://192.168.1.10:11434` |
| `review.lm_studio_host` | string | `http://localhost:1234` | Base URL of the LM Studio local server. Override when using a non-default port. |
| `review.llama_cpp_host` | string | `http://localhost:8080` | Base URL of the llama.cpp server (`llama-server`). Override when using a non-default port. |

### Example

```json
{
  "review": {
    "models": {
      "gemini": "gemini-2.5-pro",
      "qwen": "qwen-max"
    }
  }
}
```

Falls back to each CLI's configured default when a key is absent. Added in v1.35.0 (#1849).

---

## Manager Passthrough Flags

Configure per-step flags that `/gsd-manager` appends to each dispatched command. This allows customizing how the manager runs discuss, plan, and execute steps without manual flag entry.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `manager.flags.discuss` | string | (none) | Flags appended to discuss-phase commands (e.g., `"--auto"`) |
| `manager.flags.plan` | string | (none) | Flags appended to plan-phase commands (e.g., `"--skip-research"`) |
| `manager.flags.execute` | string | (none) | Flags appended to execute-phase commands (e.g., `"--validate"`) |

**Example:**

```json
{
  "manager": {
    "flags": {
      "discuss": "--auto",
      "plan": "--skip-research",
      "execute": "--validate"
    }
  }
}
```

Invalid flag tokens are sanitized and logged as warnings. Only recognized GSD flags are passed through.

---

## Model Profiles

### Profile Definitions

| Agent | `quality` | `balanced` | `budget` | `inherit` |
|-------|-----------|------------|----------|-----------|
| gsd-planner | Opus | Opus | Sonnet | Inherit |
| gsd-roadmapper | Opus | Sonnet | Sonnet | Inherit |
| gsd-executor | Opus | Sonnet | Sonnet | Inherit |
| gsd-phase-researcher | Opus | Sonnet | Haiku | Inherit |
| gsd-project-researcher | Opus | Sonnet | Haiku | Inherit |
| gsd-research-synthesizer | Sonnet | Sonnet | Haiku | Inherit |
| gsd-debugger | Opus | Sonnet | Sonnet | Inherit |
| gsd-codebase-mapper | Sonnet | Haiku | Haiku | Inherit |
| gsd-verifier | Sonnet | Sonnet | Haiku | Inherit |
| gsd-plan-checker | Sonnet | Sonnet | Haiku | Inherit |
| gsd-integration-checker | Sonnet | Sonnet | Haiku | Inherit |
| gsd-nyquist-auditor | Sonnet | Sonnet | Haiku | Inherit |
| gsd-pattern-mapper | Sonnet | Sonnet | Haiku | Inherit |
| gsd-ui-researcher | Opus | Sonnet | Haiku | Inherit |
| gsd-ui-checker | Sonnet | Sonnet | Haiku | Inherit |
| gsd-ui-auditor | Sonnet | Sonnet | Haiku | Inherit |
| gsd-doc-writer | Opus | Sonnet | Haiku | Inherit |
| gsd-doc-verifier | Sonnet | Sonnet | Haiku | Inherit |

> **Fallback semantics for unlisted agents.** The profiles table above covers 18 of 31 shipped agents. Agents without an explicit profile row (`gsd-advisor-researcher`, `gsd-assumptions-analyzer`, `gsd-security-auditor`, `gsd-user-profiler`, and the nine advanced agents — `gsd-ai-researcher`, `gsd-domain-researcher`, `gsd-eval-planner`, `gsd-eval-auditor`, `gsd-framework-selector`, `gsd-code-reviewer`, `gsd-code-fixer`, `gsd-debug-session-manager`, `gsd-intel-updater`) inherit the runtime default model for the selected profile. To pin a specific model for any of these agents, use `model_overrides` (next section) — `model_overrides` accepts any shipped agent name regardless of whether it has a profile row here. The authoritative profile table lives in `get-shit-done/bin/lib/model-profiles.cjs`; the authoritative 31-agent roster lives in [`docs/INVENTORY.md`](INVENTORY.md).

### Per-Agent Overrides

Override specific agents without changing the entire profile:

```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "gsd-executor": "opus",
    "gsd-planner": "haiku"
  }
}
```

Valid override values: `opus`, `sonnet`, `haiku`, `inherit`, or any fully-qualified model ID (e.g., `"openai/o3"`, `"google/gemini-2.5-pro"`).

`model_overrides` can be set in either `.planning/config.json` (per-project)
or `~/.gsd/defaults.json` (global). Per-project entries win on conflict and
non-conflicting global entries are preserved, so you can tune a single
agent's model in one repo without re-setting global defaults. This applies
uniformly across Claude Code, Codex, OpenCode, Kilo, and the other
supported runtimes. On Codex and OpenCode, the resolved model is embedded
into each agent's static config at install time — `spawn_agent` and
OpenCode's `task` interface do not accept an inline `model` parameter, so
running `gsd install <runtime>` after editing `model_overrides` is required
for the change to take effect. See issue #2256.

### Per-Phase-Type Models (`models`) — added in v1.41

> Express tuning at the **phase** level (planning, research, execution, verification) without learning the agent taxonomy. Added in [#3023](https://github.com/gsd-build/get-shit-done/pull/3030).

`model_overrides` is per-**agent** (precise but verbose; you have to know that `gsd-codebase-mapper` is research and `gsd-doc-writer` is execution). The `models` block lets you say "Opus for planning and execution, Sonnet for the rest" in two lines:

```json
{
  "model_profile": "balanced",
  "models": {
    "planning": "opus",
    "discuss": "opus",
    "research": "sonnet",
    "execution": "opus",
    "verification": "sonnet",
    "completion": "sonnet"
  },
  "model_overrides": {
    "gsd-codebase-mapper": "haiku"
  }
}
```

#### Phase-type → agent mapping

| Phase type | Agents |
|---|---|
| `planning` | `gsd-planner`, `gsd-roadmapper`, `gsd-pattern-mapper` |
| `discuss` | (reserved — no subagent today) |
| `research` | `gsd-phase-researcher`, `gsd-project-researcher`, `gsd-research-synthesizer`, `gsd-codebase-mapper`, `gsd-ui-researcher` |
| `execution` | `gsd-executor`, `gsd-debugger`, `gsd-doc-writer` |
| `verification` | `gsd-verifier`, `gsd-plan-checker`, `gsd-integration-checker`, `gsd-nyquist-auditor`, `gsd-ui-checker`, `gsd-ui-auditor`, `gsd-doc-verifier` |
| `completion` | (reserved — no subagent today) |

`discuss` and `completion` are accepted by the schema for forward compatibility; setting them today is a no-op until a subagent maps to them.

#### Resolution precedence (highest → lowest)

```text
1. model_overrides[<agent>]              ← per-agent; full IDs; targeted exception
2. dynamic_routing.tier_models[<tier>]   ← when enabled (see §Dynamic Routing)
3. models[<phase_type>]                  ← coarse phase-level tier (this section)
4. model_profile (per-agent col)         ← global tier strategy
5. Runtime default                       ← when nothing else applies
```

The five layers compose top-down: `model_profile` is the base tier, `models[<phase_type>]` overrides at the phase level, `dynamic_routing` (when enabled) escalates per-attempt on soft failure, `model_overrides[<agent>]` carves per-agent exceptions at the top, and the runtime default applies when nothing else does. In the example above, all five research agents resolve to `sonnet` *except* `gsd-codebase-mapper`, which the per-agent override pins to `haiku`. `dynamic_routing` is disabled by default — when off (`enabled: false` or block omitted), this section's behavior is unchanged from today.

#### Accepted values

`models.<phase_type>` accepts only tier aliases:

| Value | Effect |
|---|---|
| `"opus"` / `"sonnet"` / `"haiku"` | Standard tier — runtime resolution maps to the active runtime's model for that tier |
| `"inherit"` | Agents in this phase follow the session model (same semantics as `model_profile: "inherit"`) |

If you need a fully-qualified model ID (`"openai/gpt-5"`, `"google/gemini-2.5-pro"`), use `model_overrides` per agent instead. `models.*` is intentionally tier-only so the runtime-aware mapping stays correct on Codex / OpenCode / Gemini CLI installs.

#### When to use which

| You want | Use |
|---|---|
| One global tier strategy ("balanced everywhere") | `model_profile` |
| Coarse phase-level tuning ("Opus for planning") | `models.<phase_type>` |
| Per-agent precision ("force haiku on the codebase mapper") | `model_overrides[<agent>]` |
| Full model ID for a specific agent | `model_overrides[<agent>]: "openai/gpt-5"` |

Mix freely — the precedence rule above resolves any overlap deterministically.

#### Validation

`config-set` rejects unknown phase-types:

```bash
$ gsd config-set models.deployment opus
Error: 'models.deployment' is not a valid config key

# Valid:
$ gsd config-set models.research sonnet
```

Direct edits to `.planning/config.json` are looser — the resolver simply ignores values it doesn't recognize and falls through to the profile tier — so a typo doesn't silently break tier resolution.

### Dynamic Routing with Failure-Tier Escalation (`dynamic_routing`) — added in v1.41

> Start cheap, escalate only when the agent fails the gate. Added in [#3024](https://github.com/gsd-build/get-shit-done/pull/3031).

`dynamic_routing` lets you pay for the cheap tier by default and only escalate to the more expensive tier when the orchestrator detects a soft failure (verification inconclusive, plan-check FLAG, etc.).

```json
{
  "dynamic_routing": {
    "enabled": true,
    "tier_models": {
      "light":    "haiku",
      "standard": "sonnet",
      "heavy":    "opus"
    },
    "escalate_on_failure": true,
    "max_escalations": 1
  }
}
```

#### Agent default tiers

Each agent in `MODEL_PROFILES` declares one of three default tiers. The resolver picks `tier_models[default_tier]` for the first attempt.

| Tier | Agents | Use case |
|---|---|---|
| `light` | gsd-codebase-mapper, gsd-pattern-mapper, gsd-research-synthesizer, gsd-plan-checker, gsd-integration-checker, gsd-nyquist-auditor, gsd-ui-checker, gsd-ui-auditor, gsd-doc-verifier | Cheap/fast — pure mappers, scanners, low-stakes audits |
| `standard` | gsd-executor, gsd-phase-researcher, gsd-project-researcher, gsd-verifier, gsd-doc-writer, gsd-ui-researcher | Default workhorse — research, writing, primary verification |
| `heavy` | gsd-planner, gsd-roadmapper, gsd-debugger | Deep reasoning — already at top, can't escalate further |

#### Escalation flow

```text
1. Orchestrator spawns agent → resolver returns tier_models[default_tier]
2. Soft failure?
   ├─ no → ✓ done (cheap path)
   └─ yes → orchestrator re-spawns at attempt+1
            → resolver returns tier_models[next_tier_up]
            → cap at max_escalations
3. Hard failure (exception/crash) → bypass escalation, surface immediately
```

If `dynamic_routing.escalate_on_failure: false`, soft failures do **not** advance the tier — every respawn keeps using `tier_models[default_tier]` regardless of the attempt counter. The kill-switch overrides the soft-failure branch above.

`light → standard → heavy → heavy` (heavy stays at heavy; can't go further).

#### Resolution precedence (highest → lowest)

1. **`model_overrides[<agent>]`** — full IDs accepted; targeted exception
2. **`dynamic_routing.tier_models[<tier>]`** (when `enabled: true`)
3. **`models[<phase_type>]`** — coarse phase-level (#3023)
4. **`model_profile`** — per-agent column from active profile
5. **Runtime default**

The `dynamic_routing` block is **disabled by default** — `enabled: false` (or omitting the block) preserves today's static resolution exactly.

#### Settings

| Key | Type | Default | Description |
|---|---|---|---|
| `dynamic_routing.enabled` | boolean | `false` | Master switch. When `true`, the dynamic-routing resolver is used for tier selection. |
| `dynamic_routing.tier_models.light` | enum | (none) | Tier alias for the light tier. Typically `haiku`. |
| `dynamic_routing.tier_models.standard` | enum | (none) | Tier alias for standard. Typically `sonnet`. |
| `dynamic_routing.tier_models.heavy` | enum | (none) | Tier alias for heavy. Typically `opus`. |
| `dynamic_routing.escalate_on_failure` | boolean | `true` | When false, escalation is disabled (every attempt uses the default tier). |
| `dynamic_routing.max_escalations` | integer | `1` | Hard cap on retries per agent invocation. Prevents runaway loops. |

#### When to use which

| You want | Use |
|---|---|
| One tier strategy across all agents | `model_profile` |
| Coarse phase-level tuning | `models.<phase_type>` |
| Per-agent precision (full IDs) | `model_overrides` |
| **Cheap-by-default, escalate only on failure** | **`dynamic_routing`** |

`dynamic_routing` is structurally a *cost lever*: you pay Opus rates only for the hard cases that warrant Opus. Compose with `model_overrides` for per-agent exceptions (override always wins).

### Non-Claude Runtimes (Codex, OpenCode, Gemini CLI, Kilo)

When GSD is installed for a non-Claude runtime, the installer automatically sets `resolve_model_ids: "omit"` in `~/.gsd/defaults.json`. This causes GSD to return an empty model parameter for all agents, so each agent uses whatever model the runtime is configured with. No additional setup is needed for the default case.

If you want different agents to use different models, use `model_overrides` with fully-qualified model IDs that your runtime recognizes:

```json
{
  "resolve_model_ids": "omit",
  "model_overrides": {
    "gsd-planner": "o3",
    "gsd-executor": "o4-mini",
    "gsd-debugger": "o3",
    "gsd-codebase-mapper": "o4-mini"
  }
}
```

The intent is the same as the Claude profile tiers -- use a stronger model for planning and debugging (where reasoning quality matters most), and a cheaper model for execution and mapping (where the plan already contains the reasoning).

**When to use which approach:**

| Scenario | Setting | Effect |
|----------|---------|--------|
| Non-Claude runtime, single model | `resolve_model_ids: "omit"` (installer default) | All agents use the runtime's default model |
| Non-Claude runtime, tiered models | `resolve_model_ids: "omit"` + `model_overrides` | Named agents use specific models, others use runtime default |
| Claude Code with OpenRouter/local provider | `model_profile: "inherit"` | All agents follow the session model |
| Claude Code with OpenRouter, tiered | `model_profile: "inherit"` + `model_overrides` | Named agents use specific models, others inherit |

**`resolve_model_ids` values:**

| Value | Behavior | Use When |
|-------|----------|----------|
| `false` (default) | Returns Claude aliases (`opus`, `sonnet`, `haiku`) | Claude Code with native Anthropic API |
| `true` | Maps aliases to full Claude model IDs (`claude-opus-4-6`) | Claude Code with API that requires full IDs |
| `"omit"` | Returns empty string (runtime picks its default) | Non-Claude runtimes (Codex, OpenCode, Gemini CLI, Kilo) |

### Runtime-Aware Profiles (#2517)

When `runtime` is set, profile tiers (`opus`/`sonnet`/`haiku`) resolve to runtime-native model IDs instead of Claude aliases. This lets a single shared `.planning/config.json` work cleanly across Claude and Codex.

**Built-in tier maps:**

| Runtime | `opus` | `sonnet` | `haiku` | reasoning_effort |
|---------|--------|----------|---------|------------------|
| `claude` | `claude-opus-4-6` | `claude-sonnet-4-6` | `claude-haiku-4-5` | (not used) |
| `codex` | `gpt-5.4` | `gpt-5.3-codex` | `gpt-5.4-mini` | `xhigh` / `medium` / `medium` |

**Codex example** — one config, tiered models, no large `model_overrides` block:

```json
{
  "runtime": "codex",
  "model_profile": "balanced"
}
```

This resolves `gsd-planner` → `gpt-5.4` (xhigh), `gsd-executor` → `gpt-5.3-codex` (medium), `gsd-codebase-mapper` → `gpt-5.4-mini` (medium). The Codex installer embeds `model = "..."` and `model_reasoning_effort = "..."` in each generated agent TOML.

**Claude example** — explicit opt-in resolves to full Claude IDs (no `resolve_model_ids: true` needed):

```json
{
  "runtime": "claude",
  "model_profile": "quality"
}
```

**Per-runtime overrides** — replace one or more tier defaults:

```json
{
  "runtime": "codex",
  "model_profile": "quality",
  "model_profile_overrides": {
    "codex": {
      "opus": "gpt-5-pro",
      "haiku": { "model": "gpt-5-nano", "reasoning_effort": "low" }
    }
  }
}
```

**Precedence (highest to lowest):**

1. `model_overrides[<agent>]` — explicit per-agent ID always wins.
2. **Runtime-aware tier resolution** (this section) — when `runtime` is set and profile is not `inherit`.
3. `resolve_model_ids: "omit"` — returns empty string when no `runtime` is set.
4. Claude-native default — `model_profile` tier as alias (current default).
5. `inherit` — propagates literal `inherit` for `Task(model="inherit")` semantics.

**Backwards compatibility.** Setups without `runtime` set see zero behavior change — every existing config continues to work identically. Codex installs that auto-set `resolve_model_ids: "omit"` continue to omit the model field unless the user opts in by setting `runtime: "codex"`.

**Unknown runtimes.** If `runtime` is set to a value with no built-in tier map and no `model_profile_overrides[<runtime>]`, GSD falls back to the Claude-alias safe default rather than emit a model ID the runtime cannot accept. To support a new runtime, populate `model_profile_overrides.<runtime>.{opus,sonnet,haiku}` with valid IDs.

### Profile Philosophy

| Profile | Philosophy | When to Use |
|---------|-----------|-------------|
| `quality` | Opus for all decision-making, Sonnet for verification | Quota available, critical architecture work |
| `balanced` | Opus for planning only, Sonnet for everything else | Normal development (default) |
| `budget` | Sonnet for code-writing, Haiku for research/verification | High-volume work, less critical phases |
| `inherit` | All agents use current session model | Dynamic model switching, **non-Anthropic providers** (OpenRouter, local models) |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `CLAUDE_CONFIG_DIR` | Override default config directory (`~/.claude/`) |
| `GEMINI_API_KEY` | Detected by context monitor to switch hook event name |
| `WSL_DISTRO_NAME` | Detected by installer for WSL path handling |
| `GSD_SKIP_SCHEMA_CHECK` | Skip schema drift detection during execute-phase (v1.31) |
| `GSD_PROJECT` | Override project root for multi-project workspace support (v1.32) |

---

## Global Defaults

Save settings as global defaults for future projects:

**Location:** `~/.gsd/defaults.json`

When `/gsd-new-project` creates a new `config.json`, it reads global defaults and merges them as the starting configuration. Per-project settings always override globals.
