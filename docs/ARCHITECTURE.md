# GSD Architecture

> System architecture for contributors and advanced users. For user-facing documentation, see [Feature Reference](FEATURES.md) or [User Guide](USER-GUIDE.md).

---

## Table of Contents

- [System Overview](#system-overview)
- [Design Principles](#design-principles)
- [Component Architecture](#component-architecture)
- [Agent Model](#agent-model)
- [Data Flow](#data-flow)
- [File System Layout](#file-system-layout)
- [Installer Architecture](#installer-architecture)
- [Hook System](#hook-system)
- [CLI Tools Layer](#cli-tools-layer)
- [Runtime Abstraction](#runtime-abstraction)

---

## System Overview

GSD is a **meta-prompting framework** that sits between the user and AI coding agents (Claude Code, Gemini CLI, OpenCode, Kilo, Codex, Copilot, Antigravity, Trae, Cline, Augment Code). It provides:

1. **Context engineering** — Structured artifacts that give the AI everything it needs per task
2. **Multi-agent orchestration** — Thin orchestrators that spawn specialized agents with fresh context windows
3. **Spec-driven development** — Requirements → research → plans → execution → verification pipeline
4. **State management** — Persistent project memory across sessions and context resets

```
┌──────────────────────────────────────────────────────┐
│                      USER                            │
│            /gsd-command [args]                        │
└─────────────────────┬────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────┐
│              COMMAND LAYER                            │
│   commands/gsd/*.md — Prompt-based command files      │
│   (Claude Code custom commands / Codex skills)        │
└─────────────────────┬────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────┐
│              WORKFLOW LAYER                           │
│   get-shit-done/workflows/*.md — Orchestration logic  │
│   (Reads references, spawns agents, manages state)    │
└──────┬──────────────┬─────────────────┬──────────────┘
       │              │                 │
┌──────▼──────┐ ┌─────▼─────┐ ┌────────▼───────┐
│  AGENT      │ │  AGENT    │ │  AGENT         │
│  (fresh     │ │  (fresh   │ │  (fresh        │
│   context)  │ │   context)│ │   context)     │
└──────┬──────┘ └─────┬─────┘ └────────┬───────┘
       │              │                 │
┌──────▼──────────────▼─────────────────▼──────────────┐
│              CLI TOOLS LAYER                          │
│   gsd-sdk query (sdk/src/query) + gsd-tools.cjs       │
│   Programmatic SDK bridge: GSDTools/query-runtime-bridge.ts │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│              FILE SYSTEM (.planning/)                 │
│   PROJECT.md | REQUIREMENTS.md | ROADMAP.md          │
│   STATE.md | config.json | phases/ | research/       │
└──────────────────────────────────────────────────────┘
```

---

## Design Principles

### 1. Fresh Context Per Agent

Every agent spawned by an orchestrator gets a clean context window (up to 200K tokens). This eliminates context rot — the quality degradation that happens as an AI fills its context window with accumulated conversation.

### 2. Thin Orchestrators

Workflow files (`get-shit-done/workflows/*.md`) never do heavy lifting. They:

- Load context via `gsd-sdk query init.<workflow>` (or legacy `gsd-tools.cjs init <workflow>`)
- Spawn specialized agents with focused prompts
- Collect results and route to the next step
- Update state between steps

### 3. File-Based State

All state lives in `.planning/` as human-readable Markdown and JSON. No database, no server, no external dependencies. This means:

- State survives context resets (`/clear`)
- State is inspectable by both humans and agents
- State can be committed to git for team visibility

### 4. Absent = Enabled

Workflow feature flags follow the **absent = enabled** pattern. If a key is missing from `config.json`, it defaults to `true`. Users explicitly disable features; they don't need to enable defaults.

### 5. Defense in Depth

Multiple layers prevent common failure modes:

- Plans are verified before execution (plan-checker agent)
- Execution produces atomic commits per task
- Post-execution verification checks against phase goals
- UAT provides human verification as final gate

---

## Component Architecture

### Commands (`commands/gsd/*.md`)

User-facing entry points. Each file contains YAML frontmatter (name, description, allowed-tools) and a prompt body that bootstraps the workflow. Commands are installed as:

- **Claude Code:** Custom slash commands (hyphen form, `/gsd-command-name`)
- **OpenCode / Kilo:** Slash commands (hyphen form, `/gsd-command-name`)
- **Codex:** Skills (`$gsd-command-name`)
- **Copilot:** Slash commands (hyphen form, `/gsd-command-name`)
- **Gemini CLI:** Slash commands under the `gsd:` namespace (colon form, `/gsd:command-name`) — Gemini namespaces all custom commands under their plugin id, so the install path rewrites every body-text reference to colon form
- **Antigravity:** Skills

**Total commands:** see [`docs/INVENTORY.md`](INVENTORY.md#commands) for the authoritative count and full roster.

#### Two-stage hierarchical routing (v1.40, [#2792](https://github.com/gsd-build/get-shit-done/issues/2792))

To keep the eager skill-listing token cost low, v1.40 introduces six namespace **meta-skills** (`gsd-workflow`, `gsd-project`, `gsd-quality`, `gsd-context`, `gsd-manage`, `gsd-ideate` — sourced from `commands/gsd/ns-*.md`, but the invocable `name:` is the bare form shown here) layered above the concrete sub-skills. The model sees 6 namespace routers (~120 tokens) instead of a flat 86-skill listing (~2,150 tokens), selects a namespace, then routes to the concrete sub-skill via a routing table embedded in the namespace router's body. Namespace skills are **additive** — every concrete command is still directly invocable.

The router descriptions use pipe-separated keyword tags (≤ 60 chars) per the Tool Attention research showing keyword-dense tags outperform prose for routing at ~40 % the token cost.

#### MCP token-budget interaction

The eager skill listing is one of two recurring per-turn token costs. The other is the MCP tool schema injected by every enabled MCP server in `.claude/settings.json`. Heavyweight MCP servers (browser/playwright, Mac-tools, Windows-tools) can each cost 20 k+ tokens per turn — often dwarfing what `model_profile` tuning saves. The toggle lives in the Claude Code harness (`enabledMcpjsonServers` / `disabledMcpjsonServers` in `.claude/settings.json`) and is **not** a GSD concern. Together, the two-stage routing layer (#2792) and disciplined MCP enablement are the largest cost levers per turn. See [`docs/USER-GUIDE.md`](USER-GUIDE.md) and `references/context-budget.md` for the audit checklist.

### Workflows (`get-shit-done/workflows/*.md`)

Orchestration logic that commands reference. Contains the step-by-step process including:

- Context loading via `gsd-sdk query` init handlers (or legacy `gsd-tools.cjs init`)
- Agent spawn instructions with model resolution
- Gate/checkpoint definitions
- State update patterns
- Error handling and recovery

**Total workflows:** see [`docs/INVENTORY.md`](INVENTORY.md#workflows) for the authoritative count and full roster.

#### Progressive disclosure for workflows

Workflow files are loaded verbatim into Claude's context every time the
corresponding `/gsd-*` command is invoked. To keep that cost bounded, the
workflow size budget enforced by `tests/workflow-size-budget.test.cjs`
mirrors the agent budget from #2361:

| Tier      | Per-file line limit |
|-----------|--------------------|
| `XL`      | 1700 — top-level orchestrators (`execute-phase`, `plan-phase`, `new-project`) |
| `LARGE`   | 1500 — multi-step planners and large feature workflows |
| `DEFAULT` | 1000 — focused single-purpose workflows (the target tier) |

`workflows/discuss-phase.md` is held to a stricter <500-line ceiling per
issue #2551. When a workflow grows beyond its tier, extract per-mode bodies
into `workflows/<workflow>/modes/<mode>.md`, templates into
`workflows/<workflow>/templates/`, and shared knowledge into
`get-shit-done/references/`. The parent file becomes a thin dispatcher that
Reads only the mode and template files needed for the current invocation.

`workflows/discuss-phase/` is the canonical example of this pattern —
parent dispatches, modes/ holds per-flag behavior (`power.md`, `all.md`,
`auto.md`, `chain.md`, `text.md`, `batch.md`, `analyze.md`, `default.md`,
`advisor.md`), and templates/ holds CONTEXT.md, DISCUSSION-LOG.md, and
checkpoint.json schemas that are read only when the corresponding output
file is being written.

### Agents (`agents/*.md`)

Specialized agent definitions with frontmatter specifying:

- `name` — Agent identifier
- `description` — Role and purpose
- `tools` — Allowed tool access (Read, Write, Edit, Bash, Grep, Glob, WebSearch, etc.)
- `color` — Terminal output color for visual distinction

**Total agents:** 33

### References (`get-shit-done/references/*.md`)

Shared knowledge documents that workflows and agents `@-reference` (see [`docs/INVENTORY.md`](INVENTORY.md#references-41-shipped) for the authoritative count and full roster):

**Core references:**

- `checkpoints.md` — Checkpoint type definitions and interaction patterns
- `gates.md` — 4 canonical gate types (Confirm, Quality, Safety, Transition) wired into plan-checker and verifier
- `model-profiles.md` — Per-agent model tier assignments
- `model-profile-resolution.md` — Model resolution algorithm documentation
- `verification-patterns.md` — How to verify different artifact types
- `verification-overrides.md` — Per-artifact verification override rules
- `planning-config.md` — Full config schema and behavior
- `git-integration.md` — Git commit, branching, and history patterns
- `git-planning-commit.md` — Planning directory commit conventions
- `questioning.md` — Dream extraction philosophy for project initialization
- `tdd.md` — Test-driven development integration patterns
- `ui-brand.md` — Visual output formatting patterns
- `common-bug-patterns.md` — Common bug patterns for code review and verification

**Workflow references:**

- `agent-contracts.md` — Formal interface between orchestrators and agents
- `context-budget.md` — Context window budget allocation rules
- `continuation-format.md` — Session continuation/resume format
- `domain-probes.md` — Domain-specific probing questions for discuss-phase
- `gate-prompts.md` — Gate/checkpoint prompt templates
- `revision-loop.md` — Plan revision iteration patterns
- `universal-anti-patterns.md` — Common anti-patterns to detect and avoid
- `artifact-types.md` — Planning artifact type definitions
- `phase-argument-parsing.md` — Phase argument parsing conventions
- `decimal-phase-calculation.md` — Decimal sub-phase numbering rules
- `workstream-flag.md` — Workstream active pointer conventions
- `user-profiling.md` — User behavioral profiling methodology
- `thinking-partner.md` — Conditional thinking partner activation at decision points

**Thinking model references:**

References for integrating thinking-class models (o3, o4-mini, Gemini 2.5 Pro) into GSD workflows:

- `thinking-models-debug.md` — Thinking model patterns for debugging workflows
- `thinking-models-execution.md` — Thinking model patterns for execution agents
- `thinking-models-planning.md` — Thinking model patterns for planning agents
- `thinking-models-research.md` — Thinking model patterns for research agents
- `thinking-models-verification.md` — Thinking model patterns for verification agents

**Modular planner decomposition:**

The planner agent (`agents/gsd-planner.md`) was decomposed from a single monolithic file into a core agent plus reference modules to stay under the 50K character limit imposed by some runtimes:

- `planner-gap-closure.md` — Gap closure mode behavior (reads VERIFICATION.md, targeted replanning)
- `planner-reviews.md` — Cross-AI review integration (reads REVIEWS.md from `/gsd-review`)
- `planner-revision.md` — Plan revision patterns for iterative refinement

### Templates (`get-shit-done/templates/`)

Markdown templates for all planning artifacts. Used by `gsd-sdk query template.fill` / `phase.scaffold` (and legacy `gsd-tools.cjs template fill` / top-level `scaffold`) to create pre-structured files:
- `project.md`, `requirements.md`, `roadmap.md`, `state.md` — Core project files
- `phase-prompt.md` — Phase execution prompt template
- `summary.md` (+ `summary-minimal.md`, `summary-standard.md`, `summary-complex.md`) — Granularity-aware summary templates
- `DEBUG.md` — Debug session tracking template
- `UI-SPEC.md`, `UAT.md`, `VALIDATION.md` — Specialized verification templates
- `discussion-log.md` — Discussion audit trail template
- `codebase/` — Brownfield mapping templates (stack, architecture, conventions, concerns, structure, testing, integrations)
- `research-project/` — Research output templates (SUMMARY, STACK, FEATURES, ARCHITECTURE, PITFALLS)

### Hooks (`hooks/`)

Runtime hooks that integrate with the host AI agent:

| Hook | Event | Purpose |
|------|-------|---------|
| `gsd-statusline.js` | `statusLine` | Displays model, task, directory, and context usage bar |
| `gsd-context-monitor.js` | `PostToolUse` / `AfterTool` | Injects agent-facing context warnings at 35%/25% remaining |
| `gsd-check-update.js` | `SessionStart` | Foreground trigger for the background update check |
| `gsd-check-update-worker.js` | (helper) | Background worker spawned by `gsd-check-update.js`; no direct event registration |
| `gsd-prompt-guard.js` | `PreToolUse` | Scans `.planning/` writes for prompt injection patterns (advisory) |
| `gsd-read-injection-scanner.js` | `PostToolUse` | Scans Read tool output for injected instructions in untrusted content |
| `gsd-workflow-guard.js` | `PreToolUse` | Detects file edits outside GSD workflow context (advisory, opt-in via `hooks.workflow_guard`) |
| `gsd-read-guard.js` | `PreToolUse` | Advisory guard preventing Edit/Write on files not yet read in the session |
| `gsd-session-state.sh` | `PostToolUse` | Session state tracking for shell-based runtimes |
| `gsd-validate-commit.sh` | `PostToolUse` | Commit validation for conventional commit enforcement |
| `gsd-phase-boundary.sh` | `PostToolUse` | Phase boundary detection for workflow transitions |

See [`docs/INVENTORY.md`](INVENTORY.md#hooks-11-shipped) for the authoritative 11-hook roster.

### SDK Runtime Bridge Module (`sdk/src/query-runtime-bridge.ts`)

Programmatic SDK callers (`GSDTools`) route through one seam that owns query dispatch policy:

- Native registry dispatch preference
- Explicit subprocess fallback policy (`allowFallbackToSubprocess`)
- Strict SDK mode (`strictSdk`) for fail-fast native-only enforcement
- Structured dispatch observability (`onDispatchEvent`) with mode, reason, duration, and outcome

This keeps callers thin adapters and centralizes transport decisions for SDK publishability.

### CLI Tools (`get-shit-done/bin/`)

Node.js CLI utility (`gsd-tools.cjs`) with domain modules split across `get-shit-done/bin/lib/` (see [`docs/INVENTORY.md`](INVENTORY.md#cli-modules-33-shipped) for the authoritative roster):


| Module                 | Responsibility                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `core.cjs`             | Error handling, output formatting, shared utilities; compatibility re-exports for planning helpers |
| `planning-workspace.cjs` | Planning seam (`planningDir`, `planningPaths`, active workstream routing, `.planning/.lock`)      |
| `state.cjs`            | STATE.md parsing, updating, progression, metrics                                                    |
| `phase.cjs`            | Phase directory operations, decimal numbering, plan indexing                                        |
| `roadmap.cjs`          | ROADMAP.md parsing, phase extraction, plan progress                                                 |
| `config.cjs`           | config.json read/write, section initialization                                                      |
| `verify.cjs`           | Plan structure, phase completeness, reference, commit validation                                    |
| `template.cjs`         | Template selection and filling with variable substitution                                           |
| `frontmatter.cjs`      | YAML frontmatter CRUD operations                                                                    |
| `init.cjs`             | Compound context loading for each workflow type                                                     |
| `milestone.cjs`        | Milestone archival, requirements marking                                                            |
| `commands.cjs`         | Misc commands (slug, timestamp, todos, scaffolding, stats)                                          |
| `model-profiles.cjs`   | Model profile resolution table                                                                      |
| `security.cjs`         | Path traversal prevention, prompt injection detection, safe JSON parsing, shell argument validation |
| `uat.cjs`              | UAT file parsing, verification debt tracking, audit-uat support                                     |
| `docs.cjs`             | Docs-update workflow init, Markdown scanning, monorepo detection                                    |
| `workstream.cjs`       | Workstream CRUD, migration, session-scoped active pointer                                           |
| `schema-detect.cjs`    | Schema-drift detection for ORM patterns (Prisma, Drizzle, etc.)                                     |
| `profile-pipeline.cjs` | User behavioral profiling data pipeline, session file scanning                                      |
| `profile-output.cjs`   | Profile rendering, USER-PROFILE.md and dev-preferences.md generation                                |


---

## Agent Model

### Orchestrator → Agent Pattern

```
Orchestrator (workflow .md)
    │
    ├── Load context: gsd-sdk query init.<workflow> <phase> (or legacy gsd-tools.cjs init)
    │   Returns JSON with: project info, config, state, phase details
    │
    ├── Resolve model: gsd-sdk query resolve-model <agent-name>
    │   Returns: opus | sonnet | haiku | inherit
    │
    ├── Spawn Agent (Task/SubAgent call)
    │   ├── Agent prompt (agents/*.md)
    │   ├── Context payload (init JSON)
    │   ├── Model assignment
    │   └── Tool permissions
    │
    ├── Collect result
    │
    └── Update state: gsd-sdk query state.update / state.patch / state.advance-plan (or legacy gsd-tools.cjs)
```

### Primary Agent Spawn Categories

Conceptual spawn-pattern taxonomy for the 21 primary agents. For the authoritative 31-agent roster (including the 10 advanced/specialized agents such as `gsd-pattern-mapper`, `gsd-code-reviewer`, `gsd-code-fixer`, `gsd-ai-researcher`, `gsd-domain-researcher`, `gsd-eval-planner`, `gsd-eval-auditor`, `gsd-framework-selector`, `gsd-debug-session-manager`, `gsd-intel-updater`), see [`docs/INVENTORY.md`](INVENTORY.md#agents-31-shipped).


| Category         | Agents                                                                                  | Parallelism                                                                               |
| ---------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Researchers**  | gsd-project-researcher, gsd-phase-researcher, gsd-ui-researcher, gsd-advisor-researcher | 4 parallel (stack, features, architecture, pitfalls); advisor spawns during discuss-phase |
| **Synthesizers** | gsd-research-synthesizer                                                                | Sequential (after researchers complete)                                                   |
| **Planners**     | gsd-planner, gsd-roadmapper                                                             | Sequential                                                                                |
| **Checkers**     | gsd-plan-checker, gsd-integration-checker, gsd-ui-checker, gsd-nyquist-auditor          | Sequential (verification loop, max 3 iterations)                                          |
| **Executors**    | gsd-executor                                                                            | Parallel within waves, sequential across waves                                            |
| **Verifiers**    | gsd-verifier                                                                            | Sequential (after all executors complete)                                                 |
| **Mappers**      | gsd-codebase-mapper                                                                     | 4 parallel (tech, arch, quality, concerns)                                                |
| **Debuggers**    | gsd-debugger                                                                            | Sequential (interactive)                                                                  |
| **Auditors**     | gsd-ui-auditor, gsd-security-auditor                                                    | Sequential                                                                                |
| **Doc Writers**  | gsd-doc-writer, gsd-doc-verifier                                                        | Sequential (writer then verifier)                                                         |
| **Profilers**    | gsd-user-profiler                                                                       | Sequential                                                                                |
| **Analyzers**    | gsd-assumptions-analyzer                                                                | Sequential (during discuss-phase)                                                         |


### Wave Execution Model

During `execute-phase`, plans are grouped into dependency waves:

```
Wave Analysis:
  Plan 01 (no deps)      ─┐
  Plan 02 (no deps)      ─┤── Wave 1 (parallel)
  Plan 03 (depends: 01)  ─┤── Wave 2 (waits for Wave 1)
  Plan 04 (depends: 02)  ─┘
  Plan 05 (depends: 03,04) ── Wave 3 (waits for Wave 2)
```

Each executor gets:

- Fresh 200K context window (or up to 1M for models that support it)
- The specific PLAN.md to execute
- Project context (PROJECT.md, STATE.md)
- Phase context (CONTEXT.md, RESEARCH.md if available)

### Adaptive Context Enrichment (1M Models)

When the context window is 500K+ tokens (1M-class models like Opus 4.6, Sonnet 4.6), subagent prompts are automatically enriched with additional context that would not fit in standard 200K windows:

- **Executor agents** receive prior wave SUMMARY.md files and the phase CONTEXT.md/RESEARCH.md, enabling cross-plan awareness within a phase
- **Verifier agents** receive all PLAN.md, SUMMARY.md, CONTEXT.md files plus REQUIREMENTS.md, enabling history-aware verification

The orchestrator reads `context_window` from config (`gsd-sdk query config-get context_window`, or legacy `gsd-tools.cjs config-get`) and conditionally includes richer context when the value is >= 500,000. For standard 200K windows, prompts use truncated versions with cache-friendly ordering to maximize context efficiency.

#### Parallel Commit Safety

When multiple executors run within the same wave, two mechanisms prevent conflicts:

1. `--no-verify` commits — Parallel agents skip pre-commit hooks (which can cause build lock contention, e.g., cargo lock fights in Rust projects). The orchestrator runs `git hook run pre-commit` once after each wave completes.
2. **STATE.md file locking** — All `writeStateMd()` calls use lockfile-based mutual exclusion (`STATE.md.lock` with `O_EXCL` atomic creation). This prevents the read-modify-write race condition where two agents read STATE.md, modify different fields, and the last writer overwrites the other's changes. Includes stale lock detection (10s timeout) and spin-wait with jitter.

---

## Data Flow

### New Project Flow

```
User input (idea description)
    │
    ▼
Questions (questioning.md philosophy)
    │
    ▼
4x Project Researchers (parallel)
    ├── Stack → STACK.md
    ├── Features → FEATURES.md
    ├── Architecture → ARCHITECTURE.md
    └── Pitfalls → PITFALLS.md
    │
    ▼
Research Synthesizer → SUMMARY.md
    │
    ▼
Requirements extraction → REQUIREMENTS.md
    │
    ▼
Roadmapper → ROADMAP.md
    │
    ▼
User approval → STATE.md initialized
```

### Phase Execution Flow

```
discuss-phase → CONTEXT.md (user preferences)
    │
    ▼
ui-phase → UI-SPEC.md (design contract, optional)
    │
    ▼
plan-phase
    ├── Research gate (blocks if RESEARCH.md has unresolved open questions)
    ├── Phase Researcher → RESEARCH.md
    │       └── Package Legitimacy Gate: slopcheck on every package; [SLOP] removed,
    │           [SUS]/[ASSUMED] flagged; Audit table written to RESEARCH.md
    ├── Planner (with reachability check) → PLAN.md files
    │       └── checkpoint:human-verify injected before [ASSUMED]/[SUS] installs;
    │           T-{phase}-SC STRIDE row added for install-bearing plans
    ├── Plan Checker → Verify loop (max 3x)
    ├── Requirements coverage gate (REQ-IDs → plans)
    └── Decision coverage gate (CONTEXT.md `<decisions>` → plans, BLOCKING — #2492)
    │
    ▼
state planned-phase → STATE.md (Planned/Ready to execute)
    │
    ▼
execute-phase (context reduction: truncated prompts, cache-friendly ordering)
    ├── Wave analysis (dependency grouping)
    ├── Executor per plan → code + atomic commits
    ├── SUMMARY.md per plan
    └── Verifier → VERIFICATION.md
        └── Decision coverage gate (CONTEXT.md decisions → shipped artifacts, NON-BLOCKING — #2492)
    │
    ▼
verify-work → UAT.md (user acceptance testing)
    │
    ▼
ui-review → UI-REVIEW.md (visual audit, optional)
```

### Context Propagation

Each workflow stage produces artifacts that feed into subsequent stages:

```
PROJECT.md ────────────────────────────────────────────► All agents
REQUIREMENTS.md ───────────────────────────────────────► Planner, Verifier, Auditor
ROADMAP.md ────────────────────────────────────────────► Orchestrators
STATE.md ──────────────────────────────────────────────► All agents (decisions, blockers)
CONTEXT.md (per phase) ────────────────────────────────► Researcher, Planner, Executor
RESEARCH.md (per phase) ───────────────────────────────► Planner, Plan Checker
PLAN.md (per plan) ────────────────────────────────────► Executor, Plan Checker
SUMMARY.md (per plan) ─────────────────────────────────► Verifier, State tracking
UI-SPEC.md (per phase) ────────────────────────────────► Executor, UI Auditor
```

---

## File System Layout

### Installation Files

```
~/.claude/                          # Claude Code (global install)
├── skills/gsd-*/SKILL.md           # Global skills (authoritative roster: docs/INVENTORY.md)
├── commands/gsd/*.md               # Local Claude installs use slash commands instead of global skills
├── get-shit-done/
│   ├── bin/gsd-tools.cjs           # CLI utility
│   ├── bin/lib/*.cjs               # Domain modules (authoritative roster: docs/INVENTORY.md)
│   ├── workflows/*.md              # Workflow definitions (authoritative roster: docs/INVENTORY.md)
│   ├── references/*.md             # Shared reference docs (authoritative roster: docs/INVENTORY.md)
│   └── templates/                  # Planning artifact templates
├── agents/*.md                     # Agent definitions (authoritative roster: docs/INVENTORY.md)
├── hooks/*.js                      # Node.js hooks (statusline, guards, monitors, update check)
├── hooks/*.sh                      # Shell hooks (session state, commit validation, phase boundary)
├── settings.json                   # Hook registrations
└── VERSION                         # Installed version number
```

Equivalent paths for other runtimes:

- **OpenCode:** `~/.config/opencode/` global or `./.opencode/` local
- **Kilo:** `~/.config/kilo/` global or `./.kilo/` local
- **Gemini CLI:** `~/.gemini/` global or `./.gemini/` local
- **Codex:** `~/.codex/` global or `./.codex/` local
- **Copilot:** `~/.copilot/` global or `./.github/` local
- **Antigravity:** `~/.gemini/antigravity/` global or `./.agent/` local
- **Cursor:** `~/.cursor/` global or `./.cursor/` local
- **Windsurf:** `~/.codeium/windsurf/` global or `./.windsurf/` local
- **Augment Code:** `~/.augment/` global or `./.augment/` local
- **Trae:** `~/.trae/` global or `./.trae/` local
- **Qwen Code:** `~/.qwen/` global or `./.qwen/` local
- **Hermes Agent:** `~/.hermes/` global or `./.hermes/` local
- **CodeBuddy:** `~/.codebuddy/` global or `./.codebuddy/` local
- **Cline:** `~/.cline/` global or project-root `.clinerules` local

### Project Files (`.planning/`)

```
.planning/
├── PROJECT.md              # Project vision, constraints, decisions, evolution rules
├── REQUIREMENTS.md         # Scoped requirements (v1/v2/out-of-scope)
├── ROADMAP.md              # Phase breakdown with status tracking
├── STATE.md                # Living memory: position, decisions, blockers, metrics
├── config.json             # Workflow configuration
├── MILESTONES.md           # Completed milestone archive
├── research/               # Domain research from /gsd-new-project
│   ├── SUMMARY.md
│   ├── STACK.md
│   ├── FEATURES.md
│   ├── ARCHITECTURE.md
│   └── PITFALLS.md
├── codebase/               # Brownfield mapping (from /gsd-map-codebase)
│   ├── STACK.md            # YAML frontmatter carries `last_mapped_commit`
│   ├── ARCHITECTURE.md     # for the post-execute drift gate (#2003)
│   ├── CONVENTIONS.md
│   ├── CONCERNS.md
│   ├── STRUCTURE.md
│   ├── TESTING.md
│   └── INTEGRATIONS.md
├── phases/
│   └── XX-phase-name/
│       ├── XX-CONTEXT.md       # User preferences (from discuss-phase)
│       ├── XX-RESEARCH.md      # Ecosystem research (from plan-phase)
│       ├── XX-YY-PLAN.md       # Execution plans
│       ├── XX-YY-SUMMARY.md    # Execution outcomes
│       ├── XX-VERIFICATION.md  # Post-execution verification
│       ├── XX-VALIDATION.md    # Nyquist test coverage mapping
│       ├── XX-UI-SPEC.md       # UI design contract (from ui-phase)
│       ├── XX-UI-REVIEW.md     # Visual audit scores (from ui-review)
│       └── XX-UAT.md           # User acceptance test results
├── quick/                  # Quick task tracking
│   └── YYMMDD-xxx-slug/
│       ├── PLAN.md
│       └── SUMMARY.md
├── todos/
│   ├── pending/            # Captured ideas
│   └── done/               # Completed todos
├── threads/               # Persistent context threads (from /gsd-thread)
├── seeds/                 # Forward-looking ideas (from /gsd-capture --seed)
├── debug/                  # Active debug sessions
│   ├── *.md                # Active sessions
│   ├── resolved/           # Archived sessions
│   └── knowledge-base.md   # Persistent debug learnings
├── ui-reviews/             # Screenshots from /gsd-ui-review (gitignored)
└── continue-here.md        # Context handoff (from pause-work)
```

### Post-Execute Codebase Drift Gate (#2003)

After the last wave of `/gsd-execute-phase` commits, the workflow runs a
non-blocking `codebase_drift_gate` step (between `schema_drift_gate` and
`verify_phase_goal`). It compares the diff `last_mapped_commit..HEAD`
against `.planning/codebase/STRUCTURE.md` and counts four kinds of
structural elements:

1. New directories outside mapped paths
2. New barrel exports at `(packages|apps)/<name>/src/index.*`
3. New migration files
4. New route modules under `routes/` or `api/`

If the count meets `workflow.drift_threshold` (default 3), the gate either
**warns** (default) with the suggested `/gsd-map-codebase --paths …` command,
or **auto-remaps** (`workflow.drift_action = auto-remap`) by spawning
`gsd-codebase-mapper` scoped to the affected paths. Any error in detection
or remap is logged and the phase continues — drift detection cannot fail
verification.

`last_mapped_commit` lives in YAML frontmatter at the top of each
`.planning/codebase/*.md` file; `bin/lib/drift.cjs` provides
`readMappedCommit` and `writeMappedCommit` round-trip helpers.

---

## Installer Architecture

The installer (`bin/install.js`, ~10,700 lines) handles:

1. **Runtime detection** — Interactive prompt or CLI flags (`--claude`, `--opencode`, `--gemini`, `--kilo`, `--codex`, `--copilot`, `--antigravity`, `--cursor`, `--windsurf`, `--augment`, `--trae`, `--qwen`, `--hermes`, `--codebuddy`, `--cline`, `--all`)
2. **Location selection** — Global (`--global`) or local (`--local`)
3. **File deployment** — Copies commands, skills, workflows, references, templates, agents, and hooks
4. **Runtime adaptation** — Transforms file content per runtime:
  - Claude Code: Uses as-is
  - OpenCode: Converts commands/agents to OpenCode-compatible flat command + subagent format
  - Kilo: Reuses the OpenCode conversion pipeline with Kilo config paths
  - Codex: Generates TOML config + skills from commands
  - Copilot: Maps tool names (Read→read, Bash→execute, etc.)
  - Gemini: Adjusts hook event names (`AfterTool` instead of `PostToolUse`)
  - Antigravity: Skills-first with Google model equivalents
  - Cursor: Skills-first with Cursor rule references
  - Windsurf: Skills-first with Windsurf rule references
  - Trae: Skills-first install to `~/.trae` / `./.trae` with no `settings.json` or hook integration
  - Qwen Code: Skills-first with Qwen-branded path and prompt rewrites
  - Hermes Agent: Category-based skills under `skills/gsd/`
  - CodeBuddy: Skills-first with CodeBuddy path and prompt rewrites
  - Cline: Writes `.clinerules` for rule-based integration
  - Augment Code: Skills-first with full skill conversion and config management
5. **Path normalization** — Replaces `~/.claude/` paths with runtime-specific paths
6. **Settings integration** — Registers hooks in runtime's `settings.json`
7. **Patch backup** — Since v1.17, backs up locally modified files to `gsd-local-patches/` for `/gsd-update --reapply`
8. **Manifest tracking** — Writes `gsd-file-manifest.json` for clean uninstall
9. **Uninstall mode** — `--uninstall` removes all GSD files, hooks, and settings

Install-time file moves, stale-artifact cleanup, config rewrites, and user-data
preservation are governed by the Installer Migration Module. See
[Installer Migrations](installer-migrations.md) and
[ADR 0008](adr/0008-installer-migration-module.md).
The migration module also owns the gated first-time baseline scan for legacy
installs, classifying known runtime install surfaces before later migrations
remove or rewrite anything.

### Platform Handling

- **Windows:** `windowsHide` on child processes, EPERM/EACCES protection on protected directories, path separator normalization
- **WSL:** Detects Windows Node.js running on WSL and warns about path mismatches
- **Docker/CI:** Supports `CLAUDE_CONFIG_DIR` env var for custom config directory locations

---

## Hook System

### Architecture

```
Runtime Engine (Claude Code / Gemini CLI)
    │
    ├── statusLine event ──► gsd-statusline.js
    │   Reads: stdin (session JSON)
    │   Writes: stdout (formatted status), /tmp/claude-ctx-{session}.json (bridge)
    │
    ├── PostToolUse/AfterTool event ──► gsd-context-monitor.js
    │   Reads: stdin (tool event JSON), /tmp/claude-ctx-{session}.json (bridge)
    │   Writes: stdout (hookSpecificOutput with additionalContext warning)
    │
    └── SessionStart event ──► gsd-check-update.js
        Reads: VERSION file
        Writes: ~/.claude/cache/gsd-update-check.json (spawns background process)
```

### Context Monitor Thresholds


| Remaining Context | Level    | Agent Behavior                          |
| ----------------- | -------- | --------------------------------------- |
| > 35%             | Normal   | No warning injected                     |
| ≤ 35%             | WARNING  | "Avoid starting new complex work"       |
| ≤ 25%             | CRITICAL | "Context nearly exhausted, inform user" |


Debounce: 5 tool uses between repeated warnings. Severity escalation (WARNING→CRITICAL) bypasses debounce.

### Safety Properties

- All hooks wrap in try/catch, exit silently on error
- stdin timeout guard (3s) prevents hanging on pipe issues
- Stale metrics (>60s old) are ignored
- Missing bridge files handled gracefully (subagents, fresh sessions)
- Context monitor is advisory — never issues imperative commands that override user preferences

### Package Legitimacy Gate (v1.42.1)

The researcher → planner → executor pipeline includes a supply-chain gate against slopsquatting (AI-hallucinated package names pre-registered with malicious post-install scripts).

**Threat model:** GSD automates the full path from "researcher names a package" to "executor runs `npm install`". A hallucinated name that passes `npm view` (proving only registration, not legitimacy) would previously flow through undetected. ~20% of AI-generated package references are hallucinated; ~43% of those names recur consistently across prompts, making pre-registration economically viable for attackers.

**Gate layers:**

| Layer | Component | Action |
|-------|-----------|--------|
| Research | `gsd-phase-researcher` | Runs `slopcheck install <pkgs> --json`; writes `## Package Legitimacy Audit` table to RESEARCH.md; strips `[SLOP]` packages before RESEARCH.md is written |
| Planning | `gsd-planner` | Reads Audit table; inserts `checkpoint:human-verify` before any `[ASSUMED]` or `[SUS]` install task; adds `T-{phase}-SC` STRIDE supply-chain row to `<threat_model>` |
| Execution | `gsd-executor` | RULE 3 excludes package installation from auto-fix scope; failed installs surface as checkpoints, never silent substitutions |

**Claim provenance integration:** Package names discovered via WebSearch are tagged `[ASSUMED]` (not `[VERIFIED]`) regardless of `npm view` result. This extends the existing `[ASSUMED]` / `[VERIFIED]` / `[CITED]` provenance system by enforcing the provenance tag as a hard gate at the install boundary — `[ASSUMED]` always generates a `checkpoint:human-verify` in PLAN.md.

**Ecosystem coverage:** The researcher uses registry-specific verification commands — `npm view` (Node), `pip index versions` (Python), `cargo search` (Rust) — rather than a single generic check. This catches cross-ecosystem hallucination (~9% rate documented in 2025 USENIX research).

**Graceful degradation:** If `slopcheck` is unavailable, every recommended package is tagged `[ASSUMED]` and gated with a checkpoint. Research and planning proceed; the system never hard-fails on a missing tool dependency.

**External dependency:** `slopcheck` (MIT, pip-installable). If abandoned, the `[ASSUMED]`-gate fallback maintains human-checkpoint coverage.

---

### Security Hooks (v1.27)

**Prompt Guard** (`gsd-prompt-guard.js`):

- Triggers on Write/Edit to `.planning/` files
- Scans content for prompt injection patterns (role override, instruction bypass, system tag injection)
- Advisory-only — logs detection, does not block
- Patterns are inlined (subset of `security.cjs`) for hook independence

**Workflow Guard** (`gsd-workflow-guard.js`):

- Triggers on Write/Edit to non-`.planning/` files
- Detects edits outside GSD workflow context (no active `/gsd-` command or Task subagent)
- Advises using `/gsd-quick` or `/gsd-fast` for state-tracked changes
- Opt-in via `hooks.workflow_guard: true` (default: false)

---

## Runtime Abstraction

GSD supports multiple AI coding runtimes through a unified command/workflow architecture:

### Runtime Install Contract Matrix

This matrix describes the runtime surfaces the installer materializes today.
The migration-specific ownership and source snapshots live in
[Installer Migrations](installer-migrations.md#runtime-configuration-contract-registry).

| Runtime | Global root | Local root | Invocation surface | Agent surface | Config and hooks |
| --- | --- | --- | --- | --- | --- |
| Claude Code | `~/.claude` | `./.claude` | Global `skills/gsd-*/SKILL.md`; local `commands/gsd/*.md` | `agents/gsd-*.md` | `settings.json` hook and statusLine entries |
| OpenCode | `~/.config/opencode` | `./.opencode` | `command/gsd-*.md` | `agents/gsd-*.md` | `opencode.json` or `opencode.jsonc`; no GSD hooks |
| Kilo | `~/.config/kilo` | `./.kilo` | `command/gsd-*.md` | `agents/gsd-*.md` | `kilo.json` or `kilo.jsonc`; no GSD hooks |
| Gemini CLI | `~/.gemini` | `./.gemini` | `commands/gsd/*.toml` | `agents/gsd-*.md` | `settings.json` feature flag, hooks, and statusline |
| Codex | `~/.codex` | `./.codex` | `skills/gsd-*/SKILL.md` | `agents/` source markdown plus per-agent TOML | `config.toml` `[agents.gsd-*]`, `[features].hooks` (canonical; legacy alias `codex_hooks` is recognized and migrated forward on reinstall, #3566), and hook tables |
| GitHub Copilot | `~/.copilot` | `./.github` | `skills/gsd-*/SKILL.md` and `copilot-instructions.md` | `.agent.md` files | No GSD hooks or statusline |
| Antigravity | `~/.gemini/antigravity` | `./.agent` | `skills/gsd-*/SKILL.md` | `agents/gsd-*.md` | Gemini-style `settings.json` hook entries when installed by GSD |
| Cursor | `~/.cursor` | `./.cursor` | `skills/gsd-*/SKILL.md` | `agents/gsd-*.md` | Rule references under `rules/`; no GSD hooks |
| Windsurf | `~/.codeium/windsurf` | `./.windsurf` | `skills/gsd-*/SKILL.md` | `agents/gsd-*.md` | Rule references under `rules/`; no GSD hooks |
| Augment Code | `~/.augment` | `./.augment` | `skills/gsd-*/SKILL.md` | `agents/gsd-*.md` | No GSD hooks or statusline |
| Trae | `~/.trae` | `./.trae` | `skills/gsd-*/SKILL.md` | `agents/gsd-*.md` | Rule references under `rules/`; no GSD hooks |
| Qwen Code | `~/.qwen` | `./.qwen` | `skills/gsd-*/SKILL.md` | `agents/gsd-*.md` | Common GSD settings and hook entries where supported |
| Hermes Agent | `~/.hermes` | `./.hermes` | `skills/gsd/DESCRIPTION.md` plus `skills/gsd/gsd-*/SKILL.md` | `agents/gsd-*.md` | Common GSD settings and hook entries where supported |
| CodeBuddy | `~/.codebuddy` | `./.codebuddy` | `skills/gsd-*/SKILL.md` | `agents/gsd-*.md` | Common GSD settings and hook entries where supported |
| Cline | `~/.cline` | project root | `.clinerules` | Rules only | No GSD hooks or statusline |

### Upstream Contract Sources

Runtime install expectations are checked against primary documentation where
available. The current source snapshot is 2026-05-11:

- Claude Code: Anthropic slash commands, settings, hooks, and subagents docs.
- OpenCode and Kilo: OpenCode config docs and Kilo custom subagent docs.
- Gemini CLI and Qwen Code: command/config docs; Qwen command docs were last
  updated 2026-05-06.
- Codex: OpenAI Codex docs and `config-schema.json`; the installer also carries
  Codex 0.124.0 compatibility for agent table shape.
- Copilot, Cursor, Cline, Augment, Hermes, and CodeBuddy: vendor docs for
  custom instructions, rules, skills, or config.
- Antigravity, Windsurf, and Trae: source-limited rows. The installer documents
  current compatibility shims, and migrations must refresh those sources before
  rewriting their config.

### Abstraction Points

1. **Tool name mapping** — Each runtime has its own tool names (e.g., Claude's `Bash` → Copilot's `execute`)
2. **Hook event names** — Claude uses `PostToolUse`, Gemini uses `AfterTool`
3. **Agent frontmatter** — Each runtime has its own agent definition format
4. **Path conventions** — Each runtime stores config in different directories
5. **Model references** — `inherit` profile lets GSD defer to runtime's model selection

The installer handles all translation at install time. Workflows and agents are written in Claude Code's native format and transformed during deployment.
