# GSD Shipped Surface Inventory

> Authoritative roster of every shipped GSD surface: commands, agents, workflows, references, CLI modules, and hooks. Where the broad docs (AGENTS.md, COMMANDS.md, ARCHITECTURE.md, CLI-TOOLS.md) diverge from the filesystem, treat this file and the repository tree itself as the source of truth.

## How To Use This File

- Counts here are derived from the filesystem at the v1.36.0 pin and may drift between releases. For live counts, run `ls commands/gsd/*.md | wc -l`, `ls agents/gsd-*.md | wc -l`, etc. against the checkout.
- This file enumerates every shipped surface across all six families (agents, commands, workflows, references, CLI modules, hooks). Broad docs may render narrative or curated subsets; when they disagree with the filesystem, this file and the directory listings are authoritative.
- New surfaces added after v1.36.0 should land here first, then propagate to the broad docs. The drift-control tests in `tests/inventory-counts.test.cjs`, `tests/commands-doc-parity.test.cjs`, `tests/agents-doc-parity.test.cjs`, `tests/cli-modules-doc-parity.test.cjs`, `tests/hooks-doc-parity.test.cjs`, `tests/architecture-counts.test.cjs`, and `tests/command-count-sync.test.cjs` anchor the counts and roster contents against the filesystem.

---

## Agents (33 shipped)

Full roster at `agents/gsd-*.md`. The "Primary doc" column flags whether [`docs/AGENTS.md`](AGENTS.md) carries a full role card (*primary*), a short stub in the "Advanced and Specialized Agents" section (*advanced stub*), or no coverage (*inventory only*).

| Agent | Role (one line) | Spawned by | Primary doc |
|-------|-----------------|------------|-------------|
| gsd-project-researcher | Researches domain ecosystem before roadmap creation (stack, features, architecture, pitfalls). | `/gsd-new-project`, `/gsd-new-milestone` | primary |
| gsd-phase-researcher | Researches implementation approach for a specific phase before planning. | `/gsd-plan-phase` | primary |
| gsd-ui-researcher | Produces UI design contracts for frontend phases. | `/gsd-ui-phase` | primary |
| gsd-assumptions-analyzer | Produces evidence-backed assumptions for discuss-phase (assumptions mode). | `discuss-phase-assumptions` workflow | primary |
| gsd-advisor-researcher | Researches a single gray-area decision during discuss-phase advisor mode. | `discuss-phase` workflow (advisor mode) | primary |
| gsd-research-synthesizer | Combines parallel researcher outputs into a unified SUMMARY.md. | `/gsd-new-project` | primary |
| gsd-planner | Creates executable phase plans with task breakdown and goal-backward verification. | `/gsd-plan-phase`, `/gsd-quick` | primary |
| gsd-roadmapper | Creates project roadmaps with phase breakdown and requirement mapping. | `/gsd-new-project` | primary |
| gsd-executor | Executes GSD plans with atomic commits and deviation handling. | `/gsd-execute-phase`, `/gsd-quick` | primary |
| gsd-plan-checker | Verifies plans will achieve phase goals (8 verification dimensions). | `/gsd-plan-phase` (verification loop) | primary |
| gsd-integration-checker | Verifies cross-phase integration and end-to-end flows. | `/gsd-audit-milestone` | primary |
| gsd-ui-checker | Validates UI-SPEC.md design contracts against quality dimensions. | `/gsd-ui-phase` (validation loop) | primary |
| gsd-verifier | Verifies phase goal achievement through goal-backward analysis. | `/gsd-execute-phase` | primary |
| gsd-nyquist-auditor | Fills Nyquist validation gaps by generating tests. | `/gsd-validate-phase` | primary |
| gsd-ui-auditor | Retroactive 6-pillar visual audit of implemented frontend code. | `/gsd-ui-review` | primary |
| gsd-codebase-mapper | Explores codebase and writes structured analysis documents. | `/gsd-map-codebase` | primary |
| gsd-debugger | Investigates bugs using scientific method with persistent state. | `/gsd-debug`, `/gsd-verify-work` | primary |
| gsd-user-profiler | Scores developer behavior across 8 dimensions. | `/gsd-profile-user` | primary |
| gsd-doc-writer | Writes and updates project documentation. | `/gsd-docs-update` | primary |
| gsd-doc-verifier | Verifies factual claims in generated documentation. | `/gsd-docs-update` | primary |
| gsd-security-auditor | Verifies threat mitigations from PLAN.md threat model. | `/gsd-secure-phase` | primary |
| gsd-pattern-mapper | Maps new files to closest existing analogs; writes PATTERNS.md for the planner. | `/gsd-plan-phase` (between research and planning) | advanced stub |
| gsd-debug-session-manager | Runs the full `/gsd-debug` checkpoint-and-continuation loop in isolated context so main stays lean. | `/gsd-debug` | advanced stub |
| gsd-code-reviewer | Reviews source files for bugs, security issues, and code-quality problems; produces REVIEW.md. | `/gsd-code-review` | advanced stub |
| gsd-code-fixer | Applies fixes to REVIEW.md findings with atomic per-fix commits; produces REVIEW-FIX.md. | `/gsd-code-review-fix` | advanced stub |
| gsd-ai-researcher | Researches a chosen AI framework's official docs into implementation-ready guidance (AI-SPEC.md §3–§4b). | `/gsd-ai-integration-phase` | advanced stub |
| gsd-domain-researcher | Surfaces domain-expert evaluation criteria and failure modes for an AI system (AI-SPEC.md §1b). | `/gsd-ai-integration-phase` | advanced stub |
| gsd-eval-planner | Designs structured evaluation strategy for an AI phase (AI-SPEC.md §5–§7). | `/gsd-ai-integration-phase` | advanced stub |
| gsd-eval-auditor | Retroactive audit of an AI phase's evaluation coverage; produces EVAL-REVIEW.md (COVERED/PARTIAL/MISSING). | `/gsd-eval-review` | advanced stub |
| gsd-framework-selector | ≤6-question interactive decision matrix that scores and recommends an AI/LLM framework. | `/gsd-ai-integration-phase`, `/gsd-select-framework` | advanced stub |
| gsd-intel-updater | Writes structured intel files (`.planning/intel/*.json`) used as a queryable codebase knowledge base. | `/gsd-intel` | advanced stub |
| gsd-doc-classifier | Classifies a single planning document as ADR, PRD, SPEC, DOC, or UNKNOWN; spawned in parallel to process the doc corpus. | `/gsd-ingest-docs` | advanced stub |
| gsd-doc-synthesizer | Synthesizes classified planning docs into a single consolidated context with precedence rules, cycle detection, and three-bucket conflicts report. | `/gsd-ingest-docs` | advanced stub |

**Coverage note.** `docs/AGENTS.md` gives full role cards for 21 primary agents plus concise stubs for the 12 advanced agents. The Agent Tool Permissions Summary in that file covers only the primary 21 agents; the advanced agents' tool lists are captured in their per-agent frontmatter in `agents/gsd-*.md`.

---

## Commands (83 shipped)

Full roster at `commands/gsd/*.md`. The groupings below mirror `docs/COMMANDS.md` section order; each row carries the command name, a one-line role derived from the command's frontmatter `description:`, and a link to the source file. `tests/command-count-sync.test.cjs` locks the count against the filesystem.

### Core Workflow

| Command | Role | Source |
|---------|------|--------|
| `/gsd-new-project` | Initialize a new project with deep context gathering and PROJECT.md. | [commands/gsd/new-project.md](../commands/gsd/new-project.md) |
| `/gsd-new-workspace` | Create an isolated workspace with repo copies and independent `.planning/`. | [commands/gsd/new-workspace.md](../commands/gsd/new-workspace.md) |
| `/gsd-list-workspaces` | List active GSD workspaces and their status. | [commands/gsd/list-workspaces.md](../commands/gsd/list-workspaces.md) |
| `/gsd-remove-workspace` | Remove a GSD workspace and clean up worktrees. | [commands/gsd/remove-workspace.md](../commands/gsd/remove-workspace.md) |
| `/gsd-discuss-phase` | Gather phase context through adaptive questioning before planning. | [commands/gsd/discuss-phase.md](../commands/gsd/discuss-phase.md) |
| `/gsd-spec-phase` | Socratic spec refinement producing a SPEC.md with falsifiable requirements. | [commands/gsd/spec-phase.md](../commands/gsd/spec-phase.md) |
| `/gsd-ui-phase` | Generate UI design contract (UI-SPEC.md) for frontend phases. | [commands/gsd/ui-phase.md](../commands/gsd/ui-phase.md) |
| `/gsd-ai-integration-phase` | Generate AI design contract (AI-SPEC.md) via framework selection, research, and eval planning. | [commands/gsd/ai-integration-phase.md](../commands/gsd/ai-integration-phase.md) |
| `/gsd-plan-phase` | Create detailed phase plan (PLAN.md) with verification loop. | [commands/gsd/plan-phase.md](../commands/gsd/plan-phase.md) |
| `/gsd-plan-review-convergence` | Cross-AI plan convergence loop — replan with review feedback until no HIGH concerns remain (max 3 cycles). | [commands/gsd/plan-review-convergence.md](../commands/gsd/plan-review-convergence.md) |
| `/gsd-ultraplan-phase` | [BETA] Offload plan phase to Claude Code's ultraplan cloud — drafts remotely, review in browser, import back via `/gsd-import`. Claude Code only. | [commands/gsd/ultraplan-phase.md](../commands/gsd/ultraplan-phase.md) |
| `/gsd-spike` | Rapidly spike an idea with throwaway experiments to validate feasibility before planning. | [commands/gsd/spike.md](../commands/gsd/spike.md) |
| `/gsd-sketch` | Rapidly sketch UI/design ideas using throwaway HTML mockups with multi-variant exploration. | [commands/gsd/sketch.md](../commands/gsd/sketch.md) |
| `/gsd-research-phase` | Research how to implement a phase (standalone). | [commands/gsd/research-phase.md](../commands/gsd/research-phase.md) |
| `/gsd-execute-phase` | Execute all plans in a phase with wave-based parallelization. | [commands/gsd/execute-phase.md](../commands/gsd/execute-phase.md) |
| `/gsd-verify-work` | Validate built features through conversational UAT with auto-diagnosis. | [commands/gsd/verify-work.md](../commands/gsd/verify-work.md) |
| `/gsd-ship` | Create PR, run review, and prepare for merge after verification. | [commands/gsd/ship.md](../commands/gsd/ship.md) |
| `/gsd-next` | Automatically advance to the next logical step in the GSD workflow. | [commands/gsd/next.md](../commands/gsd/next.md) |
| `/gsd-fast` | Execute a trivial task inline — no subagents, no planning overhead. | [commands/gsd/fast.md](../commands/gsd/fast.md) |
| `/gsd-quick` | Execute a quick task with GSD guarantees (atomic commits, state tracking) but skip optional agents. | [commands/gsd/quick.md](../commands/gsd/quick.md) |
| `/gsd-ui-review` | Retroactive 6-pillar visual audit of implemented frontend code. | [commands/gsd/ui-review.md](../commands/gsd/ui-review.md) |
| `/gsd-code-review` | Review source files changed during a phase for bugs, security, and code-quality problems. | [commands/gsd/code-review.md](../commands/gsd/code-review.md) |
| `/gsd-code-review-fix` | Auto-fix issues found by `/gsd-code-review`, committing each fix atomically. | [commands/gsd/code-review-fix.md](../commands/gsd/code-review-fix.md) |
| `/gsd-eval-review` | Retroactively audit an executed AI phase's evaluation coverage; produces EVAL-REVIEW.md. | [commands/gsd/eval-review.md](../commands/gsd/eval-review.md) |

### Phase & Milestone Management

| Command | Role | Source |
|---------|------|--------|
| `/gsd-add-phase` | Add phase to end of current milestone in roadmap. | [commands/gsd/add-phase.md](../commands/gsd/add-phase.md) |
| `/gsd-insert-phase` | Insert urgent work as decimal phase (e.g., 72.1) between existing phases. | [commands/gsd/insert-phase.md](../commands/gsd/insert-phase.md) |
| `/gsd-remove-phase` | Remove a future phase from roadmap and renumber subsequent phases. | [commands/gsd/remove-phase.md](../commands/gsd/remove-phase.md) |
| `/gsd-add-tests` | Generate tests for a completed phase based on UAT criteria and implementation. | [commands/gsd/add-tests.md](../commands/gsd/add-tests.md) |
| `/gsd-list-phase-assumptions` | Surface Claude's assumptions about a phase approach before planning. | [commands/gsd/list-phase-assumptions.md](../commands/gsd/list-phase-assumptions.md) |
| `/gsd-analyze-dependencies` | Analyze phase dependencies and suggest `Depends on` entries for ROADMAP.md. | [commands/gsd/analyze-dependencies.md](../commands/gsd/analyze-dependencies.md) |
| `/gsd-validate-phase` | Retroactively audit and fill Nyquist validation gaps for a completed phase. | [commands/gsd/validate-phase.md](../commands/gsd/validate-phase.md) |
| `/gsd-secure-phase` | Retroactively verify threat mitigations for a completed phase. | [commands/gsd/secure-phase.md](../commands/gsd/secure-phase.md) |
| `/gsd-audit-milestone` | Audit milestone completion against original intent before archiving. | [commands/gsd/audit-milestone.md](../commands/gsd/audit-milestone.md) |
| `/gsd-audit-uat` | Cross-phase audit of all outstanding UAT and verification items. | [commands/gsd/audit-uat.md](../commands/gsd/audit-uat.md) |
| `/gsd-audit-fix` | Autonomous audit-to-fix pipeline — find issues, classify, fix, test, commit. | [commands/gsd/audit-fix.md](../commands/gsd/audit-fix.md) |
| `/gsd-plan-milestone-gaps` | Create phases to close all gaps identified by milestone audit. | [commands/gsd/plan-milestone-gaps.md](../commands/gsd/plan-milestone-gaps.md) |
| `/gsd-complete-milestone` | Archive completed milestone and prepare for next version. | [commands/gsd/complete-milestone.md](../commands/gsd/complete-milestone.md) |
| `/gsd-new-milestone` | Start a new milestone cycle — update PROJECT.md and route to requirements. | [commands/gsd/new-milestone.md](../commands/gsd/new-milestone.md) |
| `/gsd-milestone-summary` | Generate a comprehensive project summary from milestone artifacts. | [commands/gsd/milestone-summary.md](../commands/gsd/milestone-summary.md) |
| `/gsd-cleanup` | Archive accumulated phase directories from completed milestones. | [commands/gsd/cleanup.md](../commands/gsd/cleanup.md) |
| `/gsd-manager` | Interactive command center for managing multiple phases from one terminal. | [commands/gsd/manager.md](../commands/gsd/manager.md) |
| `/gsd-workstreams` | Manage parallel workstreams — list, create, switch, status, progress, complete, resume. | [commands/gsd/workstreams.md](../commands/gsd/workstreams.md) |
| `/gsd-autonomous` | Run all remaining phases autonomously — discuss → plan → execute per phase. | [commands/gsd/autonomous.md](../commands/gsd/autonomous.md) |
| `/gsd-undo` | Safe git revert — roll back phase or plan commits using the phase manifest. | [commands/gsd/undo.md](../commands/gsd/undo.md) |

### Session & Navigation

| Command | Role | Source |
|---------|------|--------|
| `/gsd-progress` | Check project progress, show context, and route to next action. | [commands/gsd/progress.md](../commands/gsd/progress.md) |
| `/gsd-stats` | Display project statistics — phases, plans, requirements, git metrics, timeline. | [commands/gsd/stats.md](../commands/gsd/stats.md) |
| `/gsd-session-report` | Generate a session report with token usage estimates, work summary, outcomes. | [commands/gsd/session-report.md](../commands/gsd/session-report.md) |
| `/gsd-pause-work` | Create context handoff when pausing work mid-phase. | [commands/gsd/pause-work.md](../commands/gsd/pause-work.md) |
| `/gsd-resume-work` | Resume work from previous session with full context restoration. | [commands/gsd/resume-work.md](../commands/gsd/resume-work.md) |
| `/gsd-explore` | Socratic ideation and idea routing — think through ideas before committing. | [commands/gsd/explore.md](../commands/gsd/explore.md) |
| `/gsd-do` | Route freeform text to the right GSD command automatically. | [commands/gsd/do.md](../commands/gsd/do.md) |
| `/gsd-note` | Zero-friction idea capture — append, list, or promote notes to todos. | [commands/gsd/note.md](../commands/gsd/note.md) |
| `/gsd-add-todo` | Capture idea or task as todo from current conversation context. | [commands/gsd/add-todo.md](../commands/gsd/add-todo.md) |
| `/gsd-check-todos` | List pending todos and select one to work on. | [commands/gsd/check-todos.md](../commands/gsd/check-todos.md) |
| `/gsd-add-backlog` | Add an idea to the backlog parking lot (999.x numbering). | [commands/gsd/add-backlog.md](../commands/gsd/add-backlog.md) |
| `/gsd-review-backlog` | Review and promote backlog items to active milestone. | [commands/gsd/review-backlog.md](../commands/gsd/review-backlog.md) |
| `/gsd-plant-seed` | Capture a forward-looking idea with trigger conditions. | [commands/gsd/plant-seed.md](../commands/gsd/plant-seed.md) |
| `/gsd-thread` | Manage persistent context threads for cross-session work. | [commands/gsd/thread.md](../commands/gsd/thread.md) |

### Codebase Intelligence

| Command | Role | Source |
|---------|------|--------|
| `/gsd-map-codebase` | Analyze codebase with parallel mapper agents; produces `.planning/codebase/` documents. | [commands/gsd/map-codebase.md](../commands/gsd/map-codebase.md) |
| `/gsd-scan` | Rapid codebase assessment — lightweight alternative to `/gsd-map-codebase`. | [commands/gsd/scan.md](../commands/gsd/scan.md) |
| `/gsd-intel` | Query, inspect, or refresh codebase intelligence files in `.planning/intel/`. | [commands/gsd/intel.md](../commands/gsd/intel.md) |
| `/gsd-graphify` | Build, query, and inspect the project knowledge graph in `.planning/graphs/`. | [commands/gsd/graphify.md](../commands/gsd/graphify.md) |
| `/gsd-extract-learnings` | Extract decisions, lessons, patterns, and surprises from completed phase artifacts. | [commands/gsd/extract_learnings.md](../commands/gsd/extract_learnings.md) |

### Review, Debug & Recovery

| Command | Role | Source |
|---------|------|--------|
| `/gsd-review` | Request cross-AI peer review of phase plans from external AI CLIs. | [commands/gsd/review.md](../commands/gsd/review.md) |
| `/gsd-debug` | Systematic debugging with persistent state across context resets. | [commands/gsd/debug.md](../commands/gsd/debug.md) |
| `/gsd-forensics` | Post-mortem investigation for failed GSD workflows — analyzes git, artifacts, state. | [commands/gsd/forensics.md](../commands/gsd/forensics.md) |
| `/gsd-health` | Diagnose planning directory health and optionally repair issues. | [commands/gsd/health.md](../commands/gsd/health.md) |
| `/gsd-import` | Ingest external plans with conflict detection against project decisions. | [commands/gsd/import.md](../commands/gsd/import.md) |
| `/gsd-from-gsd2` | Import a GSD-2 (`.gsd/`) project back to GSD v1 (`.planning/`) format. | [commands/gsd/from-gsd2.md](../commands/gsd/from-gsd2.md) |
| `/gsd-inbox` | Triage and review all open GitHub issues and PRs against project templates. | [commands/gsd/inbox.md](../commands/gsd/inbox.md) |

### Docs, Profile & Utilities

| Command | Role | Source |
|---------|------|--------|
| `/gsd-docs-update` | Generate or update project documentation verified against the codebase. | [commands/gsd/docs-update.md](../commands/gsd/docs-update.md) |
| `/gsd-ingest-docs` | Scan a repo for mixed ADRs/PRDs/SPECs/DOCs and bootstrap or merge the full `.planning/` setup with classification, synthesis, and conflicts report. | [commands/gsd/ingest-docs.md](../commands/gsd/ingest-docs.md) |
| `/gsd-spike-wrap-up` | Package spike findings into a persistent project skill for future build conversations. | [commands/gsd/spike-wrap-up.md](../commands/gsd/spike-wrap-up.md) |
| `/gsd-sketch-wrap-up` | Package sketch design findings into a persistent project skill for future build conversations. | [commands/gsd/sketch-wrap-up.md](../commands/gsd/sketch-wrap-up.md) |
| `/gsd-profile-user` | Generate developer behavioral profile and Claude-discoverable artifacts. | [commands/gsd/profile-user.md](../commands/gsd/profile-user.md) |
| `/gsd-settings` | Configure GSD workflow toggles and model profile. | [commands/gsd/settings.md](../commands/gsd/settings.md) |
| `/gsd-set-profile` | Switch model profile for GSD agents (quality/balanced/budget/inherit). | [commands/gsd/set-profile.md](../commands/gsd/set-profile.md) |
| `/gsd-pr-branch` | Create a clean PR branch by filtering out `.planning/` commits. | [commands/gsd/pr-branch.md](../commands/gsd/pr-branch.md) |
| `/gsd-sync-skills` | Sync managed GSD skill directories across runtime roots for multi-runtime users. | [commands/gsd/sync-skills.md](../commands/gsd/sync-skills.md) |
| `/gsd-update` | Update GSD to latest version with changelog display. | [commands/gsd/update.md](../commands/gsd/update.md) |
| `/gsd-reapply-patches` | Reapply local modifications after a GSD update. | [commands/gsd/reapply-patches.md](../commands/gsd/reapply-patches.md) |
| `/gsd-help` | Show available GSD commands and usage guide. | [commands/gsd/help.md](../commands/gsd/help.md) |
| `/gsd-join-discord` | Join the GSD Discord community. | [commands/gsd/join-discord.md](../commands/gsd/join-discord.md) |

---

## Workflows (81 shipped)

Full roster at `get-shit-done/workflows/*.md`. Workflows are thin orchestrators that commands reference internally; most are not read directly by end users. Rows below map each workflow file to its role (derived from the `<purpose>` block) and, where applicable, to the command that invokes it.

| Workflow | Role | Invoked by |
|----------|------|------------|
| `add-phase.md` | Add a new integer phase to the end of the current milestone in the roadmap. | `/gsd-add-phase` |
| `add-tests.md` | Generate unit and E2E tests for a completed phase based on its artifacts. | `/gsd-add-tests` |
| `add-todo.md` | Capture an idea or task that surfaces during a session as a structured todo. | `/gsd-add-todo`, `/gsd-add-backlog` |
| `ai-integration-phase.md` | Orchestrate framework selection → AI research → domain research → eval planning into AI-SPEC.md. | `/gsd-ai-integration-phase` |
| `analyze-dependencies.md` | Analyze ROADMAP.md phases for file overlap and semantic dependencies; suggest `Depends on` edges. | `/gsd-analyze-dependencies` |
| `audit-fix.md` | Autonomous audit-to-fix pipeline — run audit, parse, classify, fix, test, commit. | `/gsd-audit-fix` |
| `audit-milestone.md` | Verify milestone met its definition of done by aggregating phase verifications. | `/gsd-audit-milestone` |
| `audit-uat.md` | Cross-phase audit of UAT and verification files; produces prioritized outstanding-items list. | `/gsd-audit-uat` |
| `autonomous.md` | Drive milestone phases autonomously — all remaining, a range, or a single phase. | `/gsd-autonomous` |
| `check-todos.md` | List pending todos, allow selection, load context, and route to the appropriate action. | `/gsd-check-todos` |
| `cleanup.md` | Archive accumulated phase directories from completed milestones. | `/gsd-cleanup` |
| `code-review-fix.md` | Auto-fix issues from REVIEW.md via gsd-code-fixer with per-fix atomic commits. | `/gsd-code-review-fix` |
| `code-review.md` | Review phase source changes via gsd-code-reviewer; produces REVIEW.md. | `/gsd-code-review` |
| `complete-milestone.md` | Mark a shipped version as complete — MILESTONES.md entry, PROJECT.md evolution, tag. | `/gsd-complete-milestone` |
| `diagnose-issues.md` | Orchestrate parallel debug agents to investigate UAT gaps and find root causes. | `/gsd-verify-work` (auto-diagnosis) |
| `discovery-phase.md` | Execute discovery at the appropriate depth level. | `/gsd-new-project` (discovery path) |
| `discuss-phase-assumptions.md` | Assumptions-mode discuss — extract implementation decisions via codebase-first analysis. | `/gsd-discuss-phase` (when `discuss_mode=assumptions`) |
| `discuss-phase-power.md` | Power-user discuss — pre-generate all questions into a JSON state file + HTML UI. | `/gsd-discuss-phase --power` |
| `discuss-phase.md` | Extract implementation decisions through iterative gray-area discussion. | `/gsd-discuss-phase` |
| `do.md` | Route freeform text from the user to the best matching GSD command. | `/gsd-do` |
| `docs-update.md` | Generate, update, and verify canonical and hand-written project documentation. | `/gsd-docs-update` |
| `eval-review.md` | Retroactive audit of an implemented AI phase's evaluation coverage. | `/gsd-eval-review` |
| `execute-phase.md` | Execute all plans in a phase using wave-based parallel execution. | `/gsd-execute-phase` |
| `execute-plan.md` | Execute a phase prompt (PLAN.md) and create the outcome summary (SUMMARY.md). | `execute-phase.md` (per-plan subagent) |
| `explore.md` | Socratic ideation — guide the developer through probing questions. | `/gsd-explore` |
| `extract_learnings.md` | Extract decisions, lessons, patterns, and surprises from completed phase artifacts. | `/gsd-extract-learnings` |
| `fast.md` | Execute a trivial task inline without subagent overhead. | `/gsd-fast` |
| `forensics.md` | Forensics investigation of failed workflows — git, artifacts, and state analysis. | `/gsd-forensics` |
| `graduation.md` | Cluster recurring LEARNINGS.md items across phases and surface HITL promotion candidates. | `transition.md` (graduation_scan step) |
| `health.md` | Validate `.planning/` directory integrity and report actionable issues. | `/gsd-health` |
| `help.md` | Display the complete GSD command reference. | `/gsd-help` |
| `import.md` | Ingest external plans with conflict detection against existing project decisions. | `/gsd-import` |
| `inbox.md` | Triage open GitHub issues and PRs against project contribution templates. | `/gsd-inbox` |
| `ingest-docs.md` | Scan a repo for mixed planning docs; classify, synthesize, and bootstrap or merge into `.planning/` with a conflicts report. | `/gsd-ingest-docs` |
| `insert-phase.md` | Insert a decimal phase for urgent work discovered mid-milestone. | `/gsd-insert-phase` |
| `list-phase-assumptions.md` | Surface Claude's assumptions about a phase before planning. | `/gsd-list-phase-assumptions` |
| `list-workspaces.md` | List all GSD workspaces found in `~/gsd-workspaces/` with their status. | `/gsd-list-workspaces` |
| `manager.md` | Interactive milestone command center — dashboard, inline discuss, background plan/execute. | `/gsd-manager` |
| `map-codebase.md` | Orchestrate parallel codebase mapper agents to produce `.planning/codebase/` docs. | `/gsd-map-codebase` |
| `milestone-summary.md` | Milestone summary synthesis — onboarding and review artifact from milestone artifacts. | `/gsd-milestone-summary` |
| `new-milestone.md` | Start a new milestone cycle — load project context, gather goals, update PROJECT.md/STATE.md. | `/gsd-new-milestone` |
| `new-project.md` | Unified new-project flow — questioning, research (optional), requirements, roadmap. | `/gsd-new-project` |
| `new-workspace.md` | Create an isolated workspace with repo worktrees/clones and an independent `.planning/`. | `/gsd-new-workspace` |
| `next.md` | Detect current project state and automatically advance to the next logical step. | `/gsd-next` |
| `node-repair.md` | Autonomous repair operator for failed task verification; invoked by `execute-plan`. | `execute-plan.md` (recovery) |
| `note.md` | Zero-friction idea capture — one Write call, one confirmation line. | `/gsd-note` |
| `pause-work.md` | Create structured `.planning/HANDOFF.json` and `.continue-here.md` handoff files. | `/gsd-pause-work` |
| `plan-milestone-gaps.md` | Create all phases necessary to close gaps identified by `/gsd-audit-milestone`. | `/gsd-plan-milestone-gaps` |
| `plan-phase.md` | Create executable PLAN.md files with integrated research and verification loop. | `/gsd-plan-phase`, `/gsd-quick` |
| `plan-review-convergence.md` | Cross-AI plan convergence loop — replan with review feedback until no HIGH concerns remain. | `/gsd-plan-review-convergence` |
| `plant-seed.md` | Capture a forward-looking idea as a structured seed file with trigger conditions. | `/gsd-plant-seed` |
| `pr-branch.md` | Create a clean branch for pull requests by filtering `.planning/` commits. | `/gsd-pr-branch` |
| `profile-user.md` | Orchestrate the full developer profiling flow — consent, session scan, profile generation. | `/gsd-profile-user` |
| `progress.md` | Progress rendering — project context, position, and next-action routing. | `/gsd-progress` |
| `quick.md` | Quick-task execution with GSD guarantees (atomic commits, state tracking). | `/gsd-quick` |
| `remove-phase.md` | Remove a future phase from the roadmap and renumber subsequent phases. | `/gsd-remove-phase` |
| `remove-workspace.md` | Remove a GSD workspace and clean up worktrees. | `/gsd-remove-workspace` |
| `research-phase.md` | Standalone phase research workflow (usually invoked via `plan-phase`). | `/gsd-research-phase` |
| `resume-project.md` | Resume work — restore full context from STATE.md, HANDOFF.json, and artifacts. | `/gsd-resume-work` |
| `review.md` | Cross-AI plan review via external CLIs; produces REVIEWS.md. | `/gsd-review` |
| `scan.md` | Rapid single-focus codebase scan — lightweight alternative to map-codebase. | `/gsd-scan` |
| `secure-phase.md` | Retroactive threat-mitigation audit for a completed phase. | `/gsd-secure-phase` |
| `session-report.md` | Session report — token usage, work summary, outcomes. | `/gsd-session-report` |
| `settings.md` | Configure GSD workflow toggles and model profile. | `/gsd-settings`, `/gsd-set-profile` |
| `ship.md` | Create PR, run review, and prepare for merge after verification. | `/gsd-ship` |
| `sketch.md` | Explore design directions through throwaway HTML mockups with 2-3 variants per sketch. | `/gsd-sketch` |
| `sketch-wrap-up.md` | Curate sketch findings and package them as a persistent `sketch-findings-[project]` skill. | `/gsd-sketch-wrap-up` |
| `spec-phase.md` | Socratic spec refinement with ambiguity scoring; produces SPEC.md. | `/gsd-spec-phase` |
| `spike.md` | Rapid feasibility validation through focused, throwaway experiments. | `/gsd-spike` |
| `spike-wrap-up.md` | Curate spike findings and package them as a persistent `spike-findings-[project]` skill. | `/gsd-spike-wrap-up` |
| `stats.md` | Project statistics rendering — phases, plans, requirements, git metrics. | `/gsd-stats` |
| `sync-skills.md` | Cross-runtime GSD skill sync — diff and apply `gsd-*` skill directories across runtime roots. | `/gsd-sync-skills` |
| `transition.md` | Phase-boundary transition workflow — workstream checks, state advancement. | `execute-phase.md`, `/gsd-next` |
| `ui-phase.md` | Generate UI-SPEC.md design contract via gsd-ui-researcher. | `/gsd-ui-phase` |
| `ui-review.md` | Retroactive 6-pillar visual audit via gsd-ui-auditor. | `/gsd-ui-review` |
| `ultraplan-phase.md` | [BETA] Offload planning to Claude Code's ultraplan cloud; drafts remotely and imports back via `/gsd-import`. | `/gsd-ultraplan-phase` |
| `undo.md` | Safe git revert — phase or plan commits using the phase manifest. | `/gsd-undo` |
| `update.md` | Update GSD to latest version with changelog display. | `/gsd-update` |
| `validate-phase.md` | Retroactively audit and fill Nyquist validation gaps for a completed phase. | `/gsd-validate-phase` |
| `verify-phase.md` | Verify phase goal achievement through goal-backward analysis. | `execute-phase.md` (post-execution) |
| `verify-work.md` | Conversational UAT with auto-diagnosis — produces UAT.md and fix plans. | `/gsd-verify-work` |

> **Note:** Some workflows have no direct user-facing command (e.g. `execute-plan.md`, `verify-phase.md`, `transition.md`, `node-repair.md`, `diagnose-issues.md`) — they are invoked internally by orchestrator workflows. `discovery-phase.md` is an alternate entry for `/gsd-new-project`.

---

## References (50 shipped)

Full roster at `get-shit-done/references/*.md`. References are shared knowledge documents that workflows and agents `@-reference`. The groupings below match [`docs/ARCHITECTURE.md`](ARCHITECTURE.md#references-get-shit-donereferencesmd) — core, workflow, thinking-model clusters, and the modular planner decomposition.

### Core References

| Reference | Role |
|-----------|------|
| `checkpoints.md` | Checkpoint type definitions and interaction patterns. |
| `gates.md` | 4 canonical gate types (Confirm, Quality, Safety, Transition) wired into plan-checker and verifier. |
| `model-profiles.md` | Per-agent model tier assignments. |
| `model-profile-resolution.md` | Model resolution algorithm documentation. |
| `verification-patterns.md` | How to verify different artifact types. |
| `verification-overrides.md` | Per-artifact verification override rules. |
| `planning-config.md` | Full config schema and behavior. |
| `git-integration.md` | Git commit, branching, and history patterns. |
| `git-planning-commit.md` | Planning directory commit conventions. |
| `questioning.md` | Dream-extraction philosophy for project initialization. |
| `tdd.md` | Test-driven development integration patterns. |
| `ui-brand.md` | Visual output formatting patterns. |
| `common-bug-patterns.md` | Common bug patterns for code review and verification. |
| `debugger-philosophy.md` | Evergreen debugging disciplines loaded by `gsd-debugger`. |
| `mandatory-initial-read.md` | Shared required-reading boilerplate injected into agent prompts. |
| `project-skills-discovery.md` | Shared project-skills-discovery boilerplate injected into agent prompts. |

### Workflow References

| Reference | Role |
|-----------|------|
| `agent-contracts.md` | Formal interface between orchestrators and agents. |
| `context-budget.md` | Context window budget allocation rules. |
| `continuation-format.md` | Session continuation/resume format. |
| `domain-probes.md` | Domain-specific probing questions for discuss-phase. |
| `gate-prompts.md` | Gate/checkpoint prompt templates. |
| `revision-loop.md` | Plan revision iteration patterns. |
| `universal-anti-patterns.md` | Universal anti-patterns to detect and avoid. |
| `artifact-types.md` | Planning artifact type definitions. |
| `phase-argument-parsing.md` | Phase argument parsing conventions. |
| `decimal-phase-calculation.md` | Decimal sub-phase numbering rules. |
| `workstream-flag.md` | Workstream active-pointer conventions (`--ws`). |
| `user-profiling.md` | User behavioral profiling detection heuristics. |
| `thinking-partner.md` | Conditional thinking-partner activation at decision points. |
| `autonomous-smart-discuss.md` | Smart-discuss logic for autonomous mode. |
| `ios-scaffold.md` | iOS application scaffolding patterns. |
| `ai-evals.md` | AI evaluation design reference for `/gsd-ai-integration-phase`. |
| `ai-frameworks.md` | AI framework decision-matrix reference for `gsd-framework-selector`. |
| `executor-examples.md` | Worked examples for the gsd-executor agent. |
| `doc-conflict-engine.md` | Shared conflict-detection contract for ingest/import workflows. |

### Sketch References

References consumed by the `/gsd-sketch` workflow and its wrap-up companion.

| Reference | Role |
|-----------|------|
| `sketch-interactivity.md` | Rules for making HTML sketches feel interactive and alive. |
| `sketch-theme-system.md` | Shared CSS theme variable system for cross-sketch consistency. |
| `sketch-tooling.md` | Floating toolbar utilities included in every sketch. |
| `sketch-variant-patterns.md` | Multi-variant HTML patterns (tabs, side-by-side, overlays). |

### Thinking-Model References

References for integrating thinking-class models (o3, o4-mini, Gemini 2.5 Pro) into GSD workflows.

| Reference | Role |
|-----------|------|
| `thinking-models-debug.md` | Thinking-model patterns for debug workflows. |
| `thinking-models-execution.md` | Thinking-model patterns for execution agents. |
| `thinking-models-planning.md` | Thinking-model patterns for planning agents. |
| `thinking-models-research.md` | Thinking-model patterns for research agents. |
| `thinking-models-verification.md` | Thinking-model patterns for verification agents. |

### Modular Planner Decomposition

The `gsd-planner` agent is decomposed into a core agent plus reference modules to fit runtime character limits.

| Reference | Role |
|-----------|------|
| `planner-antipatterns.md` | Planner anti-patterns and specificity examples. |
| `planner-chunked.md` | Chunked mode return formats (`## OUTLINE COMPLETE`, `## PLAN COMPLETE`) for Windows stdio hang mitigation. |
| `planner-gap-closure.md` | Gap-closure mode behavior (reads VERIFICATION.md, targeted replanning). |
| `planner-reviews.md` | Cross-AI review integration (reads REVIEWS.md from `/gsd-review`). |
| `planner-revision.md` | Plan revision patterns for iterative refinement. |
| `planner-source-audit.md` | Planner source-audit and authority-limit rules. |

> **Subdirectory:** `get-shit-done/references/few-shot-examples/` contains additional few-shot examples (`plan-checker.md`, `verifier.md`) that are referenced from specific agents. These are not counted in the 50 top-level references.

---

## CLI Modules (26 shipped)

Full listing: `get-shit-done/bin/lib/*.cjs`.

| Module | Responsibility |
|--------|----------------|
| `artifacts.cjs` | Canonical artifact registry — known `.planning/` root file names; used by `gsd-health` W019 lint |
| `audit.cjs` | Audit dispatch, audit open sessions, audit storage helpers |
| `commands.cjs` | Misc CLI commands (slug, timestamp, todos, scaffolding, stats) |
| `config-schema.cjs` | Single source of truth for `VALID_CONFIG_KEYS` and dynamic key patterns; imported by both the validator and the config-schema-docs parity test |
| `config.cjs` | `config.json` read/write, section initialization; imports validator from `config-schema.cjs` |
| `core.cjs` | Error handling, output formatting, shared utilities, runtime fallbacks |
| `docs.cjs` | Docs-update workflow init, Markdown scanning, monorepo detection |
| `frontmatter.cjs` | YAML frontmatter CRUD operations |
| `graphify.cjs` | Knowledge-graph build/query/status/diff for `/gsd-graphify` |
| `gsd2-import.cjs` | External-plan ingest for `/gsd-from-gsd2` |
| `init.cjs` | Compound context loading for each workflow type |
| `intel.cjs` | Codebase intel store backing `/gsd-intel` and `gsd-intel-updater` |
| `learnings.cjs` | Cross-phase learnings extraction for `/gsd-extract-learnings` |
| `milestone.cjs` | Milestone archival, requirements marking |
| `model-profiles.cjs` | Model profile resolution table (authoritative profile data) |
| `phase.cjs` | Phase directory operations, decimal numbering, plan indexing |
| `profile-output.cjs` | Profile rendering, USER-PROFILE.md and dev-preferences.md generation |
| `profile-pipeline.cjs` | User behavioral profiling data pipeline, session file scanning |
| `roadmap.cjs` | ROADMAP.md parsing, phase extraction, plan progress |
| `schema-detect.cjs` | Schema-drift detection for ORM patterns (Prisma, Drizzle, etc.) |
| `security.cjs` | Path traversal prevention, prompt injection detection, safe JSON/shell helpers |
| `state.cjs` | STATE.md parsing, updating, progression, metrics |
| `template.cjs` | Template selection and filling with variable substitution |
| `uat.cjs` | UAT file parsing, verification debt tracking, audit-uat support |
| `verify.cjs` | Plan structure, phase completeness, reference, commit validation |
| `workstream.cjs` | Workstream CRUD, migration, session-scoped active pointer |

[`docs/CLI-TOOLS.md`](CLI-TOOLS.md) may describe a subset of these modules; when it disagrees with the filesystem, this table and the directory listing are authoritative.

---

## Hooks (11 shipped)

Full listing: `hooks/`.

| Hook | Event | Purpose |
|------|-------|---------|
| `gsd-statusline.js` | `statusLine` | Displays model, task, directory, context usage |
| `gsd-context-monitor.js` | `PostToolUse` / `AfterTool` | Injects agent-facing context warnings at 35%/25% remaining |
| `gsd-check-update.js` | `SessionStart` | Background check for new GSD versions |
| `gsd-check-update-worker.js` | (worker) | Background worker helper for check-update |
| `gsd-prompt-guard.js` | `PreToolUse` | Scans `.planning/` writes for prompt-injection patterns (advisory) |
| `gsd-workflow-guard.js` | `PreToolUse` | Detects file edits outside GSD workflow context (advisory, opt-in) |
| `gsd-read-guard.js` | `PreToolUse` | Advisory guard preventing Edit/Write on unread files |
| `gsd-read-injection-scanner.js` | `PostToolUse` | Scans tool Read results for prompt-injection patterns (v1.36+, PR #2201) |
| `gsd-session-state.sh` | `PostToolUse` | Session-state tracking for shell-based runtimes |
| `gsd-validate-commit.sh` | `PostToolUse` | Commit validation for conventional-commit enforcement |
| `gsd-phase-boundary.sh` | `PostToolUse` | Phase-boundary detection for workflow transitions |

---

## Maintenance

- When a new command, agent, workflow, reference, CLI module, or hook ships, update the corresponding section here before the release is cut.
- The drift-guard tests under `tests/` (see "How To Use This File" above) assert that every shipped file is enumerated in this inventory. A new file without a matching row here will fail CI.
- When the filesystem diverges from `docs/ARCHITECTURE.md` counts or from curated-subset docs (e.g. `docs/AGENTS.md`'s primary roster), this file is the source of truth.
