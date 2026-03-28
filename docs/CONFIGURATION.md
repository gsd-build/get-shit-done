# GSD Configuration Reference

> Full configuration schema, workflow toggles, model profiles, and git branching options. For feature context, see [Feature Reference](FEATURES.md).

---

## Configuration File

GSD stores project settings in `.planning/config.json`. Created during `/gsd:new-project`, updated via `/gsd:settings`.

### Full Schema

```json
{
  "mode": "interactive",
  "granularity": "standard",
  "model_profile": "balanced",
  "model_overrides": {},
  "planning": {
    "commit_docs": true,
    "search_gitignored": false
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": false,
    "nyquist_validation": true,
    "ui_phase": true,
    "ui_safety_gate": true,
    "node_repair": true,
    "node_repair_budget": 2,
    "research_before_questions": false,
    "discuss_mode": "discuss",
    "skip_discuss": false,
    "text_mode": false
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
  "agent_skills": {}
}
```

---

## Core Settings

| Setting | Type | Options | Default | Description |
|---------|------|---------|---------|-------------|
| `mode` | enum | `interactive`, `yolo` | `interactive` | `yolo` auto-approves decisions; `interactive` confirms at each step |
| `granularity` | enum | `coarse`, `standard`, `fine` | `standard` | Controls phase count: `coarse` (3-5), `standard` (5-8), `fine` (8-12) |
| `model_profile` | enum | `quality`, `balanced`, `budget`, `inherit` | `balanced` | Model tier for each agent (see [Model Profiles](#model-profiles)) |

> **Note:** `granularity` was renamed from `depth` in v1.22.3. Existing configs are auto-migrated.

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
| `workflow.ui_safety_gate` | boolean | `true` | Prompt to run /gsd:ui-phase for frontend phases during plan-phase |
| `workflow.node_repair` | boolean | `true` | Autonomous task repair on verification failure |
| `workflow.node_repair_budget` | number | `2` | Max repair attempts per failed task |
| `workflow.research_before_questions` | boolean | `false` | Run research before discussion questions instead of after |
| `workflow.discuss_mode` | string | `'discuss'` | Controls how `/gsd:discuss-phase` gathers context. `'discuss'` (default) asks questions one-by-one. `'assumptions'` reads the codebase first, generates structured assumptions with confidence levels, and only asks you to correct what's wrong. Added in v1.28 |
| `workflow.skip_discuss` | boolean | `false` | When `true`, `/gsd:autonomous` bypasses the discuss-phase entirely, writing minimal CONTEXT.md from the ROADMAP phase goal. Useful for projects where developer preferences are fully captured in PROJECT.md/REQUIREMENTS.md. Added in v1.28 |
| `workflow.text_mode` | boolean | `false` | Replaces AskUserQuestion TUI menus with plain-text numbered lists. Required for Claude Code remote sessions (`/rc` mode) where TUI menus don't render. Can also be set per-session with `--text` flag on discuss-phase. Added in v1.28 |

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

### Auto-Detection

If `.planning/` is in `.gitignore`, `commit_docs` is automatically `false` regardless of config.json. This prevents git errors.

---

## Hook Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hooks.context_warnings` | boolean | `true` | Show context window usage warnings via context monitor hook |
| `hooks.workflow_guard` | boolean | `false` | Warn when file edits happen outside GSD workflow context (advises using `/gsd:quick` or `/gsd:fast`) |

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

At spawn time, workflows call `node gsd-tools.cjs agent-skills <type>` to load configured skills. If skills exist for the agent type, they are injected as an `<agent_skills>` block in the Task() prompt:

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
node gsd-tools.cjs config-set agent_skills.gsd-executor '["skills/my-skill"]'
```

---

## Parallelization Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `parallelization.enabled` | boolean | `true` | Run independent plans simultaneously |
| `parallelization.plan_level` | boolean | `true` | Parallelize at plan level |
| `parallelization.task_level` | boolean | `false` | Parallelize tasks within a plan |
| `parallelization.skip_checkpoints` | boolean | `true` | Skip checkpoints during parallel execution |
| `parallelization.max_concurrent_agents` | number | `3` | Maximum simultaneous agents |
| `parallelization.min_plans_for_parallel` | number | `2` | Minimum plans to trigger parallel execution |

> **Pre-commit hooks and parallel execution**: When parallelization is enabled, executor agents commit with `--no-verify` to avoid build lock contention (e.g., cargo lock fights in Rust projects). The orchestrator validates hooks once after each wave completes. STATE.md writes are protected by file-level locking to prevent concurrent write corruption. If you need hooks to run per-commit, set `parallelization.enabled: false`.

---

## Git Branching

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `git.branching_strategy` | enum | `none` | `none`, `phase`, or `milestone` |
| `git.phase_branch_template` | string | `gsd/phase-{phase}-{slug}` | Branch name template for phase strategy |
| `git.milestone_branch_template` | string | `gsd/{milestone}-{slug}` | Branch name template for milestone strategy |
| `git.quick_branch_template` | string or null | `null` | Optional branch name template for `/gsd:quick` tasks |

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

## Hook Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hooks.context_warnings` | boolean | `true` | Show context window usage warnings during sessions |

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

### Non-Claude Runtimes (Codex, OpenCode, Gemini CLI)

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
| `true` | Maps aliases to full Claude model IDs (`claude-opus-4-0`) | Claude Code with API that requires full IDs |
| `"omit"` | Returns empty string (runtime picks its default) | Non-Claude runtimes (Codex, OpenCode, Gemini CLI) |

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

---

## Global Defaults

Save settings as global defaults for future projects:

**Location:** `~/.gsd/defaults.json`

When `/gsd:new-project` creates a new `config.json`, it reads global defaults and merges them as the starting configuration. Per-project settings always override globals.
