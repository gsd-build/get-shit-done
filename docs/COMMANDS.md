# GSD Command Reference

> Command syntax, flags, options, and examples for stable commands. For feature details, see [Feature Reference](FEATURES.md). For workflow walkthroughs, see [User Guide](USER-GUIDE.md).

---

## Command Syntax

- **Claude Code / Copilot / OpenCode / Kilo:** `/gsd-command-name [args]` (hyphen form)
- **Gemini CLI:** `/gsd:command-name [args]` (colon form — Gemini namespaces commands under `gsd:`)
- **Codex:** `$gsd-command-name [args]`

The hyphen and colon forms are *runtime-specific spellings of the same command*. Whichever runtime you're on, the installer writes the correct form into your runtime's command directory.

---

## Namespace Meta-Skills

Six namespace routers ship as the first-stage entry points in v1.40. They keep the eager skill-listing token cost low (~120 tokens for 6 routers vs ~2,150 for a flat 86-skill listing) while the full surface remains directly invocable. The model selects a namespace, then routes to the concrete sub-skill. See [#2792](https://github.com/gsd-build/get-shit-done/issues/2792).

| Command | Routes to |
|---------|-----------|
| `/gsd-workflow` | Phase pipeline — discuss / plan / execute / verify / phase / progress |
| `/gsd-project` | Project lifecycle — milestones, audits, summary |
| `/gsd-quality` | Quality gates — code review, debug, audit, security, eval, ui |
| `/gsd-context` | Codebase intelligence — map, graphify, docs, learnings |
| `/gsd-manage` | Management — config, workspace, workstreams, thread, update, ship, inbox |
| `/gsd-ideate` | Exploration & capture — explore, sketch, spike, spec, capture |

The namespace skills are **additive** — every existing concrete command (e.g. `/gsd-plan-phase`, `/gsd-code-review --fix`) is still invocable directly.

---

## Core Workflow Commands

### `/gsd-new-project`

Initialize a new project with deep context gathering.

| Flag | Description |
|------|-------------|
| `--auto @file.md` | Auto-extract from document, skip interactive questions |

**Prerequisites:** No existing `.planning/PROJECT.md`
**Produces:** `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, `research/`, `CLAUDE.md`

```bash
/gsd-new-project                    # Interactive mode
/gsd-new-project --auto @prd.md     # Auto-extract from PRD
```

---

### `/gsd-workspace`

Manage GSD workspaces — create, list, or remove isolated workspace environments with repo copies and independent `.planning/` directories.

| Flag | Description |
|------|-------------|
| `--new` | Create a new workspace (use with `--name`, `--repos`, etc.) |
| `--list` | List active GSD workspaces and their status |
| `--remove <name>` | Remove a workspace and clean up git worktrees |
| `--name <name>` | Workspace name (used with `--new`) |
| `--repos repo1,repo2` | Comma-separated repo paths or names (used with `--new`) |
| `--path /target` | Target directory (default: `~/gsd-workspaces/<name>`) |
| `--strategy worktree\|clone` | Copy strategy (default: `worktree`) |
| `--branch <name>` | Branch to checkout (default: `workspace/<name>`) |
| `--auto` | Skip interactive questions |

**Use cases:**
- Multi-repo: work on a subset of repos with isolated GSD state
- Feature isolation: `--repos .` creates a worktree of the current repo

**Produces:** `WORKSPACE.md`, `.planning/`, repo copies (worktrees or clones)

```bash
/gsd-workspace --new --name feature-b --repos hr-ui,ZeymoAPI
/gsd-workspace --new --name feature-b --repos . --strategy worktree  # Same-repo isolation
/gsd-workspace --list
/gsd-workspace --remove feature-b
```

---

### `/gsd-discuss-phase`

Gather phase context through adaptive questioning before planning.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to current phase) |

| Flag | Description |
|------|-------------|
| `--all` | Skip area selection — discuss all gray areas interactively (no auto-advance) |
| `--auto` | Auto-select recommended defaults for all questions |
| `--batch` | Group questions for batch intake instead of one-by-one |
| `--analyze` | Add trade-off analysis during discussion |
| `--power` | File-based bulk question answering from a prepared answers file |
| `--assumptions` | Surface Claude's implementation assumptions about the phase without an interactive session |

**Prerequisites:** `.planning/ROADMAP.md` exists
**Produces:** `{phase}-CONTEXT.md`, `{phase}-DISCUSSION-LOG.md` (audit trail)

```bash
/gsd-discuss-phase 1                # Interactive discussion for phase 1
/gsd-discuss-phase 1 --all          # Discuss all gray areas without selection step
/gsd-discuss-phase 3 --auto         # Auto-select defaults for phase 3
/gsd-discuss-phase --batch          # Batch mode for current phase
/gsd-discuss-phase 2 --analyze      # Discussion with trade-off analysis
/gsd-discuss-phase 1 --power        # Bulk answers from file
/gsd-discuss-phase 3 --assumptions  # Surface Claude's assumptions before planning
```

---

### `/gsd-ui-phase`

Generate UI design contract for frontend phases.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to current phase) |

**Prerequisites:** `.planning/ROADMAP.md` exists, phase has frontend/UI work
**Produces:** `{phase}-UI-SPEC.md`

```bash
/gsd-ui-phase 2                     # Design contract for phase 2
```

---

### `/gsd-plan-phase`

Research, plan, and verify a phase.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to next unplanned phase) |

| Flag | Description |
|------|-------------|
| `--auto` | Skip interactive confirmations |
| `--research` | Force re-research even if RESEARCH.md exists |
| `--skip-research` | Skip domain research step |
| `--research-phase <N>` | Research-only mode: spawn researcher for phase `<N>`, write RESEARCH.md, exit before planner. Replaces the deleted `gsd-research-phase` standalone command (#3042). |
| `--view` | Research-only modifier: when used with `--research-phase`, print existing RESEARCH.md to stdout and exit (no spawn). |
| `--gaps` | Gap closure mode (reads VERIFICATION.md, skips research) |
| `--skip-verify` | Skip plan checker verification loop |
| `--prd <file>` | Use a PRD file instead of discuss-phase for context |
| `--ingest <path-or-glob>` | Use ADR file(s) instead of discuss-phase for context synthesis |
| `--ingest-format <auto\|nygard\|madr\|narrative>` | Optional ADR parser format override for `--ingest` |
| `--reviews` | Replan with cross-AI review feedback from REVIEWS.md |
| `--validate` | Run state validation before planning begins |
| `--bounce` | Run external plan bounce validation after planning (uses `workflow.plan_bounce_script`) |
| `--skip-bounce` | Skip plan bounce even if enabled in config |

**Prerequisites:** `.planning/ROADMAP.md` exists
**Produces:** `{phase}-RESEARCH.md`, `{phase}-{N}-PLAN.md`, `{phase}-VALIDATION.md`

**Research-only mode (`--research-phase <N>`):**
- No modifier: prompts `update / view / skip` if RESEARCH.md already exists.
- With `--research`: force-refresh — re-spawn researcher unconditionally, no prompt.
- With `--view`: print existing RESEARCH.md to stdout, no spawn. Errors if RESEARCH.md missing.

**Package Legitimacy Gate (v1.51):**
When the researcher recommends external packages, it runs `slopcheck install <pkg> --json` on each one and writes a `## Package Legitimacy Audit` table to RESEARCH.md recording Registry, Age, Downloads, Source Repo, and slopcheck verdict. Verdicts:

- `[SLOP]` — package removed from RESEARCH.md entirely; never reaches the planner
- `[SUS]` — package flagged; planner inserts `checkpoint:human-verify` before the install task
- `[OK]` — package approved; no checkpoint added

Packages sourced from WebSearch are tagged `[ASSUMED]` (not `[VERIFIED]`) and treated the same as `[SUS]` — they get a human checkpoint before install. If `slopcheck` cannot be installed, every recommended package is tagged `[ASSUMED]` and gated.

See [Package Legitimacy Gate in the User Guide](USER-GUIDE.md#package-legitimacy-gate-v151) for the full checkpoint format, verdict table, and troubleshooting.

```bash
/gsd-plan-phase 1                              # Research + plan + verify phase 1
/gsd-plan-phase 3 --skip-research              # Plan without research (familiar domain)
/gsd-plan-phase --auto                         # Non-interactive planning
/gsd-plan-phase 2 --validate                   # Validate state before planning
/gsd-plan-phase 1 --bounce                     # Plan + external bounce validation
/gsd-plan-phase 2 --ingest docs/adr/0010.md   # ADR express path for context synthesis
/gsd-plan-phase 2 --ingest 'docs/adr/00*.md' --ingest-format auto
/gsd-plan-phase --research-phase 4             # Research only on phase 4 (prompts if RESEARCH.md exists)
/gsd-plan-phase --research-phase 4 --view      # Print existing RESEARCH.md, no spawn
/gsd-plan-phase --research-phase 4 --research  # Force-refresh research, no prompt
```

---

### `/gsd-plan-review-convergence`

Cross-AI plan convergence loop — replan with review feedback until no HIGH concerns remain. Runs `plan-phase → review → replan → re-review` cycles (max 3 cycles by default). Spawns isolated agents for planning and review; orchestrator handles loop control, HIGH-concern counting, stall detection, and escalation.

| Argument / Flag | Required | Description |
|-----------------|----------|-------------|
| `N` | **Yes** | Phase number to plan and review |
| `--codex` / `--gemini` / `--claude` / `--opencode` | No | Single-reviewer selection |
| `--all` | No | Run every configured reviewer in parallel |
| `--max-cycles N` | No | Override cycle cap (default 3) |

**Exit behavior:** Loop exits when HIGH count hits zero. Stall detection warns when HIGH count is not decreasing across cycles. Escalation gate asks the user to proceed or review manually when `--max-cycles` is hit with HIGH concerns still open.

```bash
/gsd-plan-review-convergence 3                    # Default reviewers, 3 cycles
/gsd-plan-review-convergence 3 --codex            # Codex-only review
/gsd-plan-review-convergence 3 --all --max-cycles 5
```

---

### `/gsd-ultraplan-phase`

**[BETA]** Offload plan phase to Claude Code's ultraplan cloud; review in browser and import back. The plan drafts remotely so the terminal stays free; review inline comments in a browser, then import the finalized plan back into `.planning/` via `/gsd-import`.

| Flag | Required | Description |
|------|----------|-------------|
| `N` | **Yes** | Phase number to plan remotely |

**Isolation:** Intentionally separate from `/gsd-plan-phase` so upstream ultraplan changes cannot affect the core planning pipeline.

```bash
/gsd-ultraplan-phase 4                  # Offload planning for phase 4
```

---

### `/gsd-execute-phase`

Execute all plans in a phase with wave-based parallelization, or run a specific wave.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | **Yes** | Phase number to execute |
| `--wave N` | No | Execute only Wave `N` in the phase |
| `--validate` | No | Run state validation before execution begins |
| `--cross-ai` | No | Delegate execution to an external AI CLI (uses `workflow.cross_ai_command`) |
| `--no-cross-ai` | No | Force local execution even if cross-AI is enabled in config |

**Prerequisites:** Phase has PLAN.md files
**Produces:** per-plan `{phase}-{N}-SUMMARY.md`, git commits, and `{phase}-VERIFICATION.md` when the phase is fully complete

**Package install failures (v1.51):** If a plan's install step fails, the executor surfaces a `checkpoint:human-verify` and stops. It does not auto-install a similarly-named alternative. This is intentional — silently substituting package names is how slopsquatting spreads. Respond to the checkpoint after verifying the package on its registry page.

```bash
/gsd-execute-phase 1                # Execute phase 1
/gsd-execute-phase 1 --wave 2       # Execute only Wave 2
/gsd-execute-phase 1 --validate     # Validate state before execution
/gsd-execute-phase 2 --cross-ai     # Delegate phase 2 to external AI CLI
```

---

### `/gsd-verify-work`

User acceptance testing with auto-diagnosis.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to last executed phase) |

**Prerequisites:** Phase has been executed
**Produces:** `{phase}-UAT.md`, fix plans if issues found

```bash
/gsd-verify-work 1                  # UAT for phase 1
```

---

---

### `/gsd-ship`

Create PR from completed phase work with auto-generated body.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number or milestone version (e.g., `4` or `v1.0`) |
| `--draft` | No | Create as draft PR |

**Prerequisites:** Phase verified (`/gsd-verify-work` passed), `gh` CLI installed and authenticated
**Produces:** GitHub PR with rich body from planning artifacts, STATE.md updated

```bash
/gsd-ship 4                         # Ship phase 4
/gsd-ship 4 --draft                 # Ship as draft PR
```

**PR body includes:**
- Phase goal from ROADMAP.md
- Changes summary from SUMMARY.md files
- Requirements addressed (REQ-IDs)
- Verification status
- Key decisions
- Optional configured PRD-style sections from `ship.pr_body_sections`

See [Custom PR Body Sections](ship-pr-body-sections.md) for onboarding, examples, and validation rules.

---

### `/gsd-ui-review`

Retroactive 6-pillar visual audit of implemented frontend.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to last executed phase) |

**Prerequisites:** Project has frontend code (works standalone, no GSD project needed)
**Produces:** `{phase}-UI-REVIEW.md`, screenshots in `.planning/ui-reviews/`

```bash
/gsd-ui-review                      # Audit current phase
/gsd-ui-review 3                    # Audit phase 3
```

---

### `/gsd-audit-uat`

Cross-phase audit of all outstanding UAT and verification items.

**Prerequisites:** At least one phase has been executed with UAT or verification
**Produces:** Categorized audit report with human test plan

```bash
/gsd-audit-uat
```

---

### `/gsd-audit-milestone`

Verify milestone met its definition of done.

**Prerequisites:** All phases executed
**Produces:** Audit report with gap analysis

```bash
/gsd-audit-milestone
```

---

### `/gsd-complete-milestone`

Archive milestone, tag release.

**Prerequisites:** Milestone audit complete (recommended)
**Produces:** `MILESTONES.md` entry, git tag

```bash
/gsd-complete-milestone
```

---

### `/gsd-milestone-summary`

Generate comprehensive project summary from milestone artifacts for team onboarding and review.

| Argument | Required | Description |
|----------|----------|-------------|
| `version` | No | Milestone version (defaults to current/latest milestone) |

**Prerequisites:** At least one completed or in-progress milestone
**Produces:** `.planning/reports/MILESTONE_SUMMARY-v{version}.md`

**Summary includes:**
- Overview, architecture decisions, phase-by-phase breakdown
- Key decisions and trade-offs
- Requirements coverage
- Tech debt and deferred items
- Getting started guide for new team members
- Interactive Q&A offered after generation

```bash
/gsd-milestone-summary                # Summarize current milestone
/gsd-milestone-summary v1.0           # Summarize specific milestone
```

---

### `/gsd-new-milestone`

Start next version cycle.

| Argument | Required | Description |
|----------|----------|-------------|
| `name` | No | Milestone name |
| `--reset-phase-numbers` | No | Restart the new milestone at Phase 1 and archive old phase dirs before roadmapping |

**Prerequisites:** Previous milestone completed
**Produces:** Updated `PROJECT.md`, new `REQUIREMENTS.md`, new `ROADMAP.md`

```bash
/gsd-new-milestone                  # Interactive
/gsd-new-milestone "v2.0 Mobile"    # Named milestone
/gsd-new-milestone --reset-phase-numbers "v2.0 Mobile"  # Restart milestone numbering at 1
```

---

## Phase Management Commands

### `/gsd-phase`

CRUD for phases in ROADMAP.md — add, insert, remove, or edit phases with a single consolidated command.

| Flag | Description |
|------|-------------|
| (none) | Append a new integer phase to the end of the current milestone |
| `--insert <N>` | Insert urgent work as a decimal phase (e.g., 3.1) after phase N |
| `--remove <N>` | Remove a future phase and renumber subsequent phases |
| `--edit <N>` | Edit any field of an existing phase in place |
| `--force` | Allow editing in-progress or completed phases (used with `--edit`) |

**Prerequisites:** `.planning/ROADMAP.md` exists
**Produces:** Updated ROADMAP.md

```bash
/gsd-phase "Add authentication system"          # Append new phase with description
/gsd-phase --insert 3 "Fix auth race condition" # Insert between phase 3 and 4 → creates 3.1
/gsd-phase --remove 7               # Remove phase 7, renumber 8→7, 9→8, etc.
/gsd-phase --edit 5                 # Edit any field of phase 5
/gsd-phase --edit 5 --force         # Edit phase 5 even if in-progress or completed
```

---

### `/gsd-validate-phase`

Retroactively audit and fill Nyquist validation gaps.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number |

```bash
/gsd-validate-phase 2               # Audit test coverage for phase 2
```

---

## Navigation Commands

### `/gsd-progress`

Show status, next steps, and automatically advance to the next logical workflow step. Reads project state and determines the appropriate action.

| Flag | Description |
|------|-------------|
| `--next` | Automatically advance to the next logical workflow step without manual route selection |
| `--do "task description"` | Analyze freeform intent and dispatch to the most appropriate GSD command |
| `--forensic` | Append a 6-check integrity audit after the standard report (STATE consistency, orphaned handoffs, deferred scope drift, memory-flagged pending work, blocking todos, uncommitted code) |

**Auto-routing behavior (`--next`):**
- No project → suggests `/gsd-new-project`
- Phase needs discussion → runs `/gsd-discuss-phase`
- Phase needs planning → runs `/gsd-plan-phase`
- Phase needs execution → runs `/gsd-execute-phase`
- Phase needs verification → runs `/gsd-verify-work`
- All phases complete → suggests `/gsd-complete-milestone`

```bash
/gsd-progress                       # "Where am I? What's next?" with auto-routing
/gsd-progress --next                # Advance to next step automatically
/gsd-progress --do "fix the auth bug"  # Dispatch freeform intent to best GSD command
/gsd-progress --forensic            # Standard report + integrity audit
```

### `/gsd-resume-work`

Restore full context from last session.

```bash
/gsd-resume-work                    # After context reset or new session
```

### `/gsd-pause-work`

Save context handoff when stopping mid-phase.

| Flag | Description |
|------|-------------|
| `--report` | Generate a post-session summary in `.planning/reports/` capturing commits, file changes, and phase progress |

```bash
/gsd-pause-work                     # Creates continue-here.md
/gsd-pause-work --report            # Creates continue-here.md + session report
```

### `/gsd-manager`

Interactive command center for managing multiple phases from one terminal.

**Prerequisites:** `.planning/ROADMAP.md` exists
**Behavior:**
- Dashboard of all phases with visual status indicators
- Recommends optimal next actions based on dependencies and progress
- Dispatches work: discuss runs inline, plan/execute run as background agents
- Designed for power users parallelizing work across phases from one terminal
- Supports per-step passthrough flags via `manager.flags` config (see [Configuration](CONFIGURATION.md#manager-passthrough-flags))

```bash
/gsd-manager                        # Open command center dashboard
/gsd-manager --analyze-deps         # Scan ROADMAP phases for dependency relationships before parallel execution
```

**Checkpoint Heartbeats (#2410):**

Background `execute-phase` runs emit `[checkpoint]` markers at every wave and plan
boundary so the Claude API SSE stream never idles long enough to trigger
`Stream idle timeout - partial response received` on multi-plan phases. The
format is:

```
[checkpoint] phase {N} wave {W}/{M} starting, {count} plan(s), {P}/{Q} plans done
[checkpoint] phase {N} wave {W}/{M} plan {plan_id} starting ({P}/{Q} plans done)
[checkpoint] phase {N} wave {W}/{M} plan {plan_id} complete ({P}/{Q} plans done)
[checkpoint] phase {N} wave {W}/{M} complete, {P}/{Q} plans done ({ok}/{count} ok)
```

If a background phase fails partway through, grep the transcript for `[checkpoint]`
to see the last confirmed boundary. The manager's background-completion handler
uses these markers to report partial progress when an agent errors out.

**Manager Passthrough Flags:**

Configure per-step flags in `.planning/config.json` under `manager.flags`. These flags are appended to each dispatched command:

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

---

### `/gsd-help`

Show all commands and usage guide.

```bash
/gsd-help                           # Quick reference
```

---

## Utility Commands

### `/gsd-explore`

Socratic ideation session — guide an idea through probing questions, optionally spawn research, then route output to the right GSD artifact (notes, todos, seeds, research questions, requirements, or a new phase).

| Argument | Required | Description |
|----------|----------|-------------|
| `topic` | No | Topic to explore (e.g., `/gsd-explore authentication strategy`) |

```bash
/gsd-explore                        # Open-ended ideation session
/gsd-explore authentication strategy  # Explore a specific topic
```

---

### `/gsd-undo`

Safe git revert — roll back GSD phase or plan commits using the phase manifest with dependency checks and a confirmation gate.

| Flag | Required | Description |
|------|----------|-------------|
| `--last N` | (one of three required) | Show recent GSD commits for interactive selection |
| `--phase NN` | (one of three required) | Revert all commits for a phase |
| `--plan NN-MM` | (one of three required) | Revert all commits for a specific plan |

**Safety:** Checks dependent phases/plans before reverting; always shows a confirmation gate.

```bash
/gsd-undo --last 5                  # Pick from the 5 most recent GSD commits
/gsd-undo --phase 03                # Revert all commits for phase 3
/gsd-undo --plan 03-02              # Revert commits for plan 02 of phase 3
```

---

### `/gsd-import`

Ingest an external plan file into the GSD planning system with conflict detection against `PROJECT.md` decisions before writing anything.

| Flag | Required | Description |
|------|----------|--------------|
| `--from <filepath>` | Yes (or `--from-gsd2`) | Path to the external plan file to import |
| `--from-gsd2` | Yes (or `--from`) | Reverse-migrate a GSD-2 (`.gsd/`) project back to GSD v1 (`.planning/`) format |
| `--path <dir>` | No | With `--from-gsd2`: path to the GSD-2 project directory (defaults to current directory) |

**Process:** Detects conflicts → prompts for resolution → writes as GSD PLAN.md → validates via `gsd-plan-checker`

```bash
/gsd-import --from /tmp/team-plan.md    # Import and validate an external plan
/gsd-import --from-gsd2                # Migrate from GSD-2 back to v1 (current dir)
/gsd-import --from-gsd2 --path ~/old-project  # Migrate from a different path
```

---

### `/gsd-ingest-docs`

Bootstrap or merge a .planning/ setup from existing ADRs, PRDs, SPECs, and docs in a repo. Runs parallel classification (`gsd-doc-classifier`) plus synthesis with precedence rules and cycle detection (`gsd-doc-synthesizer`). Produces a three-bucket conflicts report (`INGEST-CONFLICTS.md`: auto-resolved, competing-variants, unresolved-blockers) and hard-blocks on LOCKED-vs-LOCKED ADR contradictions.

| Argument / Flag | Required | Description |
|-----------------|----------|-------------|
| `path` | No | Target directory to scan (defaults to repo root) |
| `--mode new\|merge` | No | Override auto-detect (defaults: `new` if `.planning/` absent, `merge` if present) |
| `--manifest <file>` | No | YAML file listing `{path, type, precedence?}` per doc; overrides heuristic classification |
| `--resolve auto` | No | Conflict resolution mode (v1: only `auto`; `interactive` is reserved) |

**Limits:** v1 caps at 50 docs per invocation. Extracts the shared conflict-detection contract into `references/doc-conflict-engine.md`, which `/gsd-import` also consumes.

```bash
/gsd-ingest-docs                            # Scan repo root, auto-detect mode
/gsd-ingest-docs docs/                      # Only ingest under docs/
/gsd-ingest-docs --manifest ingest.yaml     # Explicit precedence manifest
```

---

### `/gsd-quick`

Execute ad-hoc task with GSD guarantees.

| Flag | Description |
|------|-------------|
| `--full` | Enable the complete quality pipeline — discussion + research + plan-checking + verification |
| `--validate` | Plan-checking (max 2 iterations) + post-execution verification only; no discussion or research |
| `--discuss` | Lightweight pre-planning discussion |
| `--research` | Spawn focused researcher before planning |

Granular flags are composable: `--discuss --research --validate` is equivalent to `--full`.

| Subcommand | Description |
|------------|-------------|
| `list` | List all quick tasks with status |
| `status <slug>` | Show status of a specific quick task |
| `resume <slug>` | Resume a specific quick task by slug |

```bash
/gsd-quick                          # Basic quick task
/gsd-quick --discuss --research     # Discussion + research + planning
/gsd-quick --validate               # Plan-checking + verification only
/gsd-quick --full                   # Complete quality pipeline
/gsd-quick list                     # List all quick tasks
/gsd-quick status my-task-slug      # Show status of a quick task
/gsd-quick resume my-task-slug      # Resume a quick task
```

### `/gsd-autonomous`

Run all remaining phases autonomously.

| Flag | Description |
|------|-------------|
| `--from N` | Start from a specific phase number |
| `--to N` | Stop after completing a specific phase number |
| `--interactive` | Lean context with user input |

```bash
/gsd-autonomous                     # Run all remaining phases
/gsd-autonomous --from 3            # Start from phase 3
/gsd-autonomous --to 5              # Run up to and including phase 5
/gsd-autonomous --from 3 --to 5     # Run phases 3 through 5
```

### `/gsd-debug`

Systematic debugging with persistent state.

| Argument | Required | Description |
|----------|----------|-------------|
| `description` | No | Description of the bug |

| Flag | Description |
|------|-------------|
| `--diagnose` | Diagnosis-only mode — investigate without attempting fixes |

**Subcommands:**
- `/gsd-debug list` — List all active debug sessions with status, hypothesis, and next action
- `/gsd-debug status <slug>` — Print full summary of a session (Evidence count, Eliminated count, Resolution, TDD checkpoint) without spawning an agent
- `/gsd-debug continue <slug>` — Resume a specific session by slug (surfaces Current Focus then spawns continuation agent)
- `/gsd-debug [--diagnose] <description>` — Start new debug session (existing behavior; `--diagnose` stops at root cause without applying fix)

**TDD mode:** When `tdd_mode: true` in `.planning/config.json`, debug sessions require a failing test to be written and verified before any fix is applied (red → green → done).

```bash
/gsd-debug "Login button not responding on mobile Safari"
/gsd-debug --diagnose "Intermittent 500 errors on /api/users"
/gsd-debug list
/gsd-debug status auth-token-null
/gsd-debug continue form-submit-500
```

### `/gsd-add-tests`

Generate tests for a completed phase.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number |

```bash
/gsd-add-tests 2                    # Generate tests for phase 2
```

### `/gsd-stats`

Display project statistics.

```bash
/gsd-stats                          # Project metrics dashboard
```

### `/gsd-profile-user`

Generate a developer behavioral profile from Claude Code session analysis across 8 dimensions (communication style, decision patterns, debugging approach, UX preferences, vendor choices, frustration triggers, learning style, explanation depth). Produces artifacts that personalize Claude's responses.

| Flag | Description |
|------|-------------|
| `--questionnaire` | Use interactive questionnaire instead of session analysis |
| `--refresh` | Re-analyze sessions and regenerate profile |

**Generated artifacts:**
- `USER-PROFILE.md` — Full behavioral profile
- `CLAUDE.md` profile section — Auto-discovered by Claude Code

```bash
/gsd-profile-user                   # Analyze sessions and build profile
/gsd-profile-user --questionnaire   # Interactive questionnaire fallback
/gsd-profile-user --refresh         # Re-generate from fresh analysis
```

### `/gsd-health`

Validate `.planning/` directory integrity. With `--context`, probes the
context-window utilization guard against the 60 % / 70 % thresholds (added
v1.40.0, [#2792](https://github.com/gsd-build/get-shit-done/issues/2792)).

| Flag | Description |
|------|-------------|
| `--repair` | Auto-fix recoverable issues |
| `--context` | Probe context-window utilization; warns at 60 %, critical at 70 % |

```bash
/gsd-health                         # Check integrity
/gsd-health --repair                # Check and fix
/gsd-health --context               # Context-utilization triage
```

### `/gsd-cleanup`

Archive accumulated phase directories from completed milestones.

```bash
/gsd-cleanup
```

---

## Spiking & Sketching Commands

### `/gsd-spike`

Run 2–5 focused feasibility experiments before committing to an implementation approach. Each experiment uses Given/When/Then framing, produces executable code, and returns a VALIDATED / INVALIDATED / PARTIAL verdict.

| Argument | Required | Description |
|----------|----------|-------------|
| `idea` | No | The technical question or approach to investigate |
| `--quick` | No | Skip intake conversation; use `idea` text directly |
| `--wrap-up` | No | Package completed spike findings into a reusable project-local skill |

**Produces:** `.planning/spikes/NNN-experiment-name/` with code, results, and README; `.planning/spikes/MANIFEST.md`
**`--wrap-up` produces:** `.claude/skills/spike-findings-[project]/` skill file

```bash
/gsd-spike                              # Interactive intake
/gsd-spike "can we stream LLM tokens through SSE"
/gsd-spike --quick websocket-vs-polling
/gsd-spike --wrap-up                    # Package findings into a reusable skill
```

---

### `/gsd-sketch`

Explore design directions through throwaway HTML mockups before committing to implementation. Produces 2–3 variants per design question for direct browser comparison.

| Argument | Required | Description |
|----------|----------|-------------|
| `idea` | No | The UI design question or direction to explore |
| `--quick` | No | Skip mood intake; use `idea` text directly |
| `--text` | No | Text-mode fallback — replace interactive prompts with numbered lists (for non-Claude runtimes) |
| `--wrap-up` | No | Package winning sketch decisions into a reusable project-local skill |

**Produces:** `.planning/sketches/NNN-descriptive-name/index.html` (2–3 interactive variants), `README.md`, shared `themes/default.css`; `.planning/sketches/MANIFEST.md`
**`--wrap-up` produces:** `.claude/skills/sketch-findings-[project]/` skill file

```bash
/gsd-sketch                             # Interactive mood intake
/gsd-sketch "dashboard layout"
/gsd-sketch --quick "sidebar navigation"
/gsd-sketch --text "onboarding flow"    # Non-Claude runtime
/gsd-sketch --wrap-up                   # Package winning sketch into a skill
```

---

## Diagnostics Commands

### `/gsd-forensics`

Post-mortem investigation for failed GSD workflows — diagnoses what went wrong.

| Argument | Required | Description |
|----------|----------|-------------|
| `description` | No | Problem description (prompted if omitted) |

**Prerequisites:** `.planning/` directory exists
**Produces:** `.planning/forensics/report-{timestamp}.md`

**Investigation covers:**
- Git history analysis (recent commits, stuck patterns, time gaps)
- Artifact integrity (expected files for completed phases)
- STATE.md anomalies and session history
- Uncommitted work, conflicts, abandoned changes
- At least 4 anomaly types checked (stuck loop, missing artifacts, abandoned work, crash/interruption)
- GitHub issue creation offered if actionable findings exist

```bash
/gsd-forensics                              # Interactive — prompted for problem
/gsd-forensics "Phase 3 execution stalled"  # With problem description
```

---

### `/gsd-extract-learnings`

Extract reusable patterns, anti-patterns, and architectural decisions from completed phase work.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | **Yes** | Phase number to extract learnings from |

| Flag | Description |
|------|-------------|
| `--all` | Extract learnings from all completed phases |
| `--format` | Output format: `markdown` (default), `json` |

**Prerequisites:** Phase has been executed (SUMMARY.md files exist)
**Produces:** `.planning/learnings/{phase}-LEARNINGS.md`

**Extracts:**
- Architectural decisions and their rationale
- Patterns that worked well (reusable in future phases)
- Anti-patterns encountered and how they were resolved
- Technology-specific insights
- Performance and testing observations

```bash
/gsd-extract-learnings 3                    # Extract learnings from phase 3
/gsd-extract-learnings --all                # Extract from all completed phases
```

---

## Workstream Management

### `/gsd-workstreams`

Manage parallel workstreams for concurrent work on different milestone areas.

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `list` | List all workstreams with status (default if no subcommand) |
| `create <name>` | Create a new workstream |
| `status <name>` | Detailed status for one workstream |
| `switch <name>` | Set active workstream |
| `progress` | Progress summary across all workstreams |
| `complete <name>` | Archive a completed workstream |
| `resume <name>` | Resume work in a workstream |

**Prerequisites:** Active GSD project
**Produces:** Workstream directories under `.planning/`, state tracking per workstream

```bash
/gsd-workstreams                    # List all workstreams
/gsd-workstreams create backend-api # Create new workstream
/gsd-workstreams switch backend-api # Set active workstream
/gsd-workstreams status backend-api # Detailed status
/gsd-workstreams progress           # Cross-workstream progress overview
/gsd-workstreams complete backend-api  # Archive completed workstream
/gsd-workstreams resume backend-api    # Resume work in workstream
```

---

## Configuration Commands

### `/gsd-settings`

Interactive configuration of workflow toggles and model profile. Questions are grouped into six visual sections:

- **Planning** — Research, Plan Checker, Pattern Mapper, Nyquist, UI Phase, UI Gate, AI Phase
- **Execution** — Verifier, TDD Mode, Code Review, Code Review Depth _(conditional — only when Code Review is on)_, UI Review
- **Docs & Output** — Commit Docs, Skip Discuss, Worktrees
- **Features** — Intel, Graphify
- **Model & Pipeline** — Model Profile, Auto-Advance, Branching
- **Misc** — Context Warnings, Research Qs

All answers are merged via `gsd-sdk query config-set` into the resolved project config path (`.planning/config.json` for a standard install, or `.planning/workstreams/<active>/config.json` when a workstream is active), preserving unrelated keys. After confirmation, the user may save the full settings object to `~/.gsd/defaults.json` so future `/gsd-new-project` runs start from the same baseline.

```bash
/gsd-settings                       # Interactive config
```

### `/gsd-config`

Configure GSD settings interactively — workflow toggles, advanced knobs, integrations, and model profile — with a single consolidated command.

| Flag | Description |
|------|-------------|
| (none) | Common-case toggles: model, research, plan_check, verifier, branching |
| `--advanced` | Power-user knobs: planning tuning, timeouts, branch templates, cross-AI execution, runtime/output |
| `--integrations` | Third-party API keys, code-review CLI routing, agent-skill injection |
| `--profile <name>` | Quick profile switch: `quality`, `balanced`, `budget`, or `inherit` |

**`--advanced` sections:**

| Section | Keys |
|---------|------|
| Planning Tuning | `workflow.plan_bounce`, `workflow.plan_bounce_passes`, `workflow.plan_bounce_script`, `workflow.subagent_timeout`, `workflow.inline_plan_threshold` |
| Execution Tuning | `workflow.node_repair`, `workflow.node_repair_budget`, `workflow.auto_prune_state` |
| Discussion Tuning | `workflow.max_discuss_passes` |
| Cross-AI Execution | `workflow.cross_ai_execution`, `workflow.cross_ai_command`, `workflow.cross_ai_timeout` |
| Git Customization | `git.base_branch`, `git.phase_branch_template`, `git.milestone_branch_template` |
| Runtime / Output | `response_language`, `context_window`, `search_gitignored`, `graphify.build_timeout` |

All answers merge via `gsd-sdk query config-set`, preserving unrelated keys. API keys are masked (`****<last-4>`) in all output.

```bash
/gsd-config                         # Common-case interactive config
/gsd-config --advanced              # Power-user knobs (six-section prompt)
/gsd-config --integrations          # API keys, review CLI routing, agent skills
/gsd-config --profile budget        # Switch to budget profile
/gsd-config --profile quality       # Switch to quality profile
```

See [CONFIGURATION.md](CONFIGURATION.md) for the full schema and defaults.

### `/gsd-surface`

Toggle which skills are surfaced — apply a profile, list, or disable a cluster without reinstall.

| Subcommand | Description |
|------------|-------------|
| `list` | Show enabled and disabled clusters and skills |
| `status` | Alias for `list` plus token cost summary |
| `profile <name>` | Write `baseProfile` and re-stage skills |
| `disable <cluster>` | Add cluster to disabled list and re-stage |
| `enable <cluster>` | Remove cluster from disabled list and re-stage |
| `reset` | Delete surface delta; return to install-time profile |

```bash
/gsd-surface list                   # Show current surface
/gsd-surface profile standard       # Switch to standard profile
/gsd-surface disable utility        # Disable the utility cluster
/gsd-surface reset                  # Restore install-time profile
```

---

## Brownfield Commands

### `/gsd-map-codebase`

Analyze existing codebase with parallel mapper agents. Use `--fast` for a quick single-agent scan, or `--query` to search existing intel.

| Argument | Required | Description |
|----------|----------|-------------|
| `area` | No | Scope mapping to a specific area |
| `--fast` | No | Rapid single-focus assessment — spawns one mapper agent instead of four parallel ones (lightweight alternative) |
| `--query <term>` | No | Search queryable codebase intel files in `.planning/intel/` (requires `intel.enabled: true`) |

| Flag | Description |
|------|-------------|
| `--focus tech\|arch\|quality\|concerns\|tech+arch` | Focus area for `--fast` mode (default: `tech+arch`) |

**Produces:** `.planning/codebase/` analysis documents (full mode); targeted document(s) in `.planning/codebase/` (`--fast`); intel query results (`--query`)

```bash
/gsd-map-codebase                   # Full codebase analysis (4 parallel agents)
/gsd-map-codebase auth              # Focus on auth area
/gsd-map-codebase --fast            # Quick tech + arch overview (1 agent)
/gsd-map-codebase --fast --focus quality  # Quality and code health only
/gsd-map-codebase --query authentication  # Search intel for a term
```

### `/gsd-graphify`

Build, query, and inspect the project knowledge graph stored in `.planning/graphs/`. Opt-in via `graphify.enabled: true` in `config.json` (see [Configuration Reference](CONFIGURATION.md#graphify-settings)); when disabled, the command prints an activation hint and stops.

| Subcommand | Description |
|------------|-------------|
| `build` | Build or rebuild the knowledge graph (runs `graphify update .` inline and refreshes `.planning/graphs/`) |
| `query <term>` | Search the graph for a term |
| `status` | Show graph freshness and statistics |
| `diff` | Show changes since the last build |

**Produces:** `.planning/graphs/` graph artifacts (nodes, edges, snapshots)

```bash
/gsd-graphify build                 # Build or rebuild the knowledge graph
/gsd-graphify query authentication  # Search the graph for a term
/gsd-graphify status                # Show freshness and statistics
/gsd-graphify diff                  # Show changes since last build
```

**Programmatic access:** `node gsd-tools.cjs graphify <build|query|status|diff|snapshot>` — see [CLI Tools Reference](CLI-TOOLS.md).

---

## AI Integration Commands

### `/gsd-ai-integration-phase`

Generate an AI-SPEC.md design contract for phases that involve building AI systems. Presents an interactive decision matrix, surfaces domain-specific failure modes and eval criteria, and produces `AI-SPEC.md` with a framework recommendation, implementation guidance, and evaluation strategy.

**Produces:** `{phase}-AI-SPEC.md` in the phase directory

**Spawns:** 3 parallel specialist agents: domain-researcher, framework-selector, ai-researcher, and eval-planner

```bash
/gsd-ai-integration-phase              # Wizard for the current phase
/gsd-ai-integration-phase 3           # Wizard for a specific phase
```

---

### `/gsd-eval-review`

Audit an executed AI phase's evaluation coverage and produce an EVAL-REVIEW.md remediation plan. Checks implementation against the `AI-SPEC.md` evaluation plan produced by `/gsd-ai-integration-phase`. Scores each eval dimension as COVERED/PARTIAL/MISSING.

**Prerequisites:** Phase has been executed and has an `AI-SPEC.md`
**Produces:** `{phase}-EVAL-REVIEW.md` with findings, gaps, and remediation guidance

```bash
/gsd-eval-review                       # Audit current phase
/gsd-eval-review 3                     # Audit a specific phase
```

---

## Update Commands

### `/gsd-update`

Update GSD with changelog preview, and optionally sync skills or reapply local patches.

| Flag | Description |
|------|-------------|
| `--sync` | Sync skills from the GSD registry after updating |
| `--reapply` | Restore local modifications (patches) after updating |

```bash
/gsd-update                         # Check for updates and install
/gsd-update --sync                  # Update and sync skills
/gsd-update --reapply               # Update and reapply local patches
```

---

## Code Quality Commands

### `/gsd-code-review`

Review source files changed during a phase for bugs, security vulnerabilities, and code quality problems. Use `--fix` to auto-fix findings after review.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | **Yes** | Phase number whose changes to review (e.g., `2` or `02`) |
| `--depth=quick\|standard\|deep` | No | Review depth level (overrides `workflow.code_review_depth` config). `quick`: pattern-matching only (~2 min). `standard`: per-file analysis with language-specific checks (~5–15 min, default). `deep`: cross-file analysis including import graphs and call chains (~15–30 min) |
| `--files file1,file2,...` | No | Explicit comma-separated file list; skips SUMMARY/git scoping entirely |
| `--fix` | No | Auto-fix issues after review — reads REVIEW.md, spawns fixer agent, commits each fix atomically |
| `--fix --all` | No | Include Info findings in fix scope (default: Critical + Warning only) |
| `--fix --auto` | No | Fix + re-review iteration loop, capped at 3 iterations |

**Prerequisites:** Phase has been executed and has SUMMARY.md or git history
**Produces:** `{phase}-REVIEW.md` with severity-classified findings; `{phase}-REVIEW-FIX.md` when `--fix` is used
**Spawns:** `gsd-code-reviewer` agent; `gsd-code-fixer` agent (with `--fix`)

```bash
/gsd-code-review 3                          # Standard review for phase 3
/gsd-code-review 2 --depth=deep             # Deep cross-file review
/gsd-code-review 4 --files src/auth.ts,src/token.ts  # Explicit file list
/gsd-code-review 3 --fix                    # Review then fix Critical + Warning findings
/gsd-code-review 3 --fix --all             # Review then fix all findings including Info
/gsd-code-review 3 --fix --auto            # Review, fix, and re-review until clean (max 3 iterations)
```

---

### `/gsd-audit-fix`

Autonomous audit-to-fix pipeline — runs an audit, classifies findings, fixes auto-fixable issues with test verification, and commits each fix atomically.

| Flag | Description |
|------|-------------|
| `--source <audit>` | Which audit to run (default: `audit-uat`) |
| `--severity high\|medium\|all` | Minimum severity to process (default: `medium`) |
| `--max N` | Maximum findings to fix (default: 5) |
| `--dry-run` | Classify findings without fixing (shows classification table) |

**Prerequisites:** At least one phase has been executed with UAT or verification
**Produces:** Fix commits with test verification; classification report

```bash
/gsd-audit-fix                              # Run audit-uat, fix medium+ issues (max 5)
/gsd-audit-fix --severity high             # Only fix high-severity issues
/gsd-audit-fix --dry-run                   # Preview classification without fixing
/gsd-audit-fix --max 10 --severity all     # Fix up to 10 issues of any severity
```

---

## Fast & Inline Commands

### `/gsd-fast`

Execute a trivial task inline — no subagents, no planning overhead. For typo fixes, config changes, small refactors, forgotten commits.

| Argument | Required | Description |
|----------|----------|-------------|
| `task description` | No | What to do (prompted if omitted) |

**Not a replacement for `/gsd-quick`** — use `/gsd-quick` for anything needing research, multi-step planning, or verification.

```bash
/gsd-fast "fix typo in README"
/gsd-fast "add .env to gitignore"
```

---

### `/gsd-review`

Cross-AI peer review of phase plans from external AI CLIs.

| Argument | Required | Description |
|----------|----------|-------------|
| `--phase N` | **Yes** | Phase number to review |

| Flag | Description |
|------|-------------|
| `--gemini` | Include Gemini CLI review |
| `--claude` | Include Claude CLI review (separate session) |
| `--codex` | Include Codex CLI review |
| `--coderabbit` | Include CodeRabbit review |
| `--opencode` | Include OpenCode review (via GitHub Copilot) |
| `--qwen` | Include Qwen Code review (Alibaba Qwen models) |
| `--cursor` | Include Cursor agent review |
| `--all` | Include all available CLIs |

**Produces:** `{phase}-REVIEWS.md` — consumable by `/gsd-plan-phase --reviews`

```bash
/gsd-review --phase 3 --all
/gsd-review --phase 2 --gemini
```

---

### `/gsd-pr-branch`

Create a clean PR branch by filtering out `.planning/` commits.

| Argument | Required | Description |
|----------|----------|-------------|
| `target branch` | No | Base branch (default: `main`) |

**Purpose:** Reviewers see only code changes, not GSD planning artifacts.

```bash
/gsd-pr-branch                     # Filter against main
/gsd-pr-branch develop             # Filter against develop
```

---

### `/gsd-secure-phase`

Retroactively verify threat mitigations for a completed phase.

| Argument | Required | Description |
|----------|----------|-------------|
| `phase number` | No | Phase to audit (default: last completed phase) |

**Prerequisites:** Phase must have been executed. Works with or without existing SECURITY.md.
**Produces:** `{phase}-SECURITY.md` with threat verification results
**Spawns:** `gsd-security-auditor` agent

Three operating modes:
1. SECURITY.md exists — audit and verify existing mitigations
2. No SECURITY.md but PLAN.md has threat model — generate from artifacts
3. Phase not executed — exits with guidance

```bash
/gsd-secure-phase                   # Audit last completed phase
/gsd-secure-phase 5                 # Audit specific phase
```

---

### `/gsd-docs-update`

Generate or update project documentation verified against the codebase.

| Argument | Required | Description |
|----------|----------|-------------|
| `--force` | No | Skip preservation prompts, regenerate all docs |
| `--verify-only` | No | Check existing docs for accuracy, no generation |

**Produces:** Up to 9 documentation files (README, architecture, API, getting started, development, testing, configuration, deployment, contributing)
**Spawns:** `gsd-doc-writer` agents (one per doc type), then `gsd-doc-verifier` agents for factual verification

Each doc writer explores the codebase directly — no hallucinated paths or stale signatures. Doc verifier checks claims against the live filesystem.

```bash
/gsd-docs-update                    # Generate/update docs interactively
/gsd-docs-update --force            # Regenerate all docs
/gsd-docs-update --verify-only      # Verify existing docs only
```

---

## Task Capture & Backlog Commands

### `/gsd-capture`

Capture ideas, tasks, notes, and seeds to their appropriate destination. Default mode adds a structured todo; flags route to specialized capture workflows.

| Flag | Description |
|------|-------------|
| (none) | Capture as a structured todo for later work |
| `--note [text]` | Zero-friction note — append, list (`--note list`), or promote (`--note promote N`) |
| `--backlog <description>` | Add to the backlog parking lot using 999.x numbering |
| `--seed [idea summary]` | Capture a forward-looking idea with trigger conditions |
| `--list` | List pending todos and select one to work on |
| `--global` | Use global scope (for note operations) |

**Backlog:** 999.x numbering keeps items outside the active phase sequence; phase directories are created immediately so `/gsd-discuss-phase` and `/gsd-plan-phase` work on them.
**Seeds:** Preserve full WHY, WHEN to surface, and breadcrumbs — consumed by `/gsd-new-milestone`.

**Produces:** `.planning/todos/` (default), note files (--note), ROADMAP.md backlog section (--backlog), `.planning/seeds/SEED-NNN-slug.md` (--seed)

```bash
/gsd-capture "Consider adding dark mode support"   # Add todo
/gsd-capture --note "Caching strategy idea"        # Quick note
/gsd-capture --note list                           # List all notes
/gsd-capture --note promote 3                      # Promote note 3 to todo
/gsd-capture --backlog "GraphQL API layer"         # Add to backlog
/gsd-capture --seed "Add real-time collaboration when WebSocket infra is in place"
/gsd-capture --list                                # Browse and act on todos
```

---

### `/gsd-review-backlog`

Review and promote backlog items to active milestone.

**Actions per item:** Promote (move to active sequence), Keep (leave in backlog), Remove (delete).

```bash
/gsd-review-backlog
```

---

### `/gsd-thread`

Manage persistent context threads for cross-session work.

| Argument | Required | Description |
|----------|----------|-------------|
| (none) / `list` | — | List all threads |
| `list --open` | — | List threads with status `open` or `in_progress` only |
| `list --resolved` | — | List threads with status `resolved` only |
| `status <slug>` | — | Show status of a specific thread |
| `close <slug>` | — | Mark a thread as resolved |
| `name` | — | Resume existing thread by name |
| `description` | — | Create new thread |

Threads are lightweight cross-session knowledge stores for work that spans multiple sessions but doesn't belong to any specific phase. Lighter weight than `/gsd-pause-work`.

```bash
/gsd-thread                         # List all threads
/gsd-thread list --open             # List only open/in-progress threads
/gsd-thread list --resolved         # List only resolved threads
/gsd-thread status fix-deploy-key   # Show thread status
/gsd-thread close fix-deploy-key    # Mark thread as resolved
/gsd-thread fix-deploy-key-auth     # Resume thread
/gsd-thread "Investigate TCP timeout in pasta service"  # Create new
```

---

## State Management Commands

### `state validate`

Detect drift between STATE.md and the actual filesystem.

**Prerequisites:** `.planning/STATE.md` exists
**Produces:** Validation report showing any drift between STATE.md fields and filesystem reality

```bash
node gsd-tools.cjs state validate
```

---

### `state sync [--verify]`

Reconstruct STATE.md from actual project state on disk.

| Flag | Description |
|------|-------------|
| `--verify` | Dry-run mode — show proposed changes without writing |

**Prerequisites:** `.planning/` directory exists
**Produces:** Updated `STATE.md` reflecting filesystem reality

```bash
node gsd-tools.cjs state sync             # Reconstruct STATE.md from disk
node gsd-tools.cjs state sync --verify    # Dry-run: show changes without writing
```

---

### `state planned-phase`

Record state transition after plan-phase completes (Planned/Ready to execute).

| Flag | Description |
|------|-------------|
| `--phase N` | Phase number that was planned |
| `--plans N` | Number of plans generated |

**Prerequisites:** Phase has been planned
**Produces:** Updated `STATE.md` with post-planning state

```bash
node gsd-tools.cjs state planned-phase --phase 3 --plans 2
```

---

## Community Commands

### Community Hooks

Optional git and session hooks gated behind `hooks.community: true` in `.planning/config.json`. All are no-ops unless explicitly enabled.

| Hook | Purpose |
|------|---------|
| `gsd-validate-commit.sh` | Enforce Conventional Commits format on git commit messages |
| `gsd-session-state.sh` | Track session state transitions |
| `gsd-phase-boundary.sh` | Enforce phase boundary checks |

Enable with:
```json
{ "hooks": { "community": true } }
```

---

### Community Invite

To join the GSD Discord community, visit the link in the GSD README or run `/gsd-help` and follow the Discord link shown there.

---

## Contributing: Skill Description Standards

Skill descriptions (the `description:` field in each `commands/gsd/*.md` frontmatter) are
injected into every session's system prompt. To keep per-session overhead low, descriptions
must be ≤ 100 chars and must not duplicate flag documentation already in `argument-hint:`.

A lint gate enforces the budget:

```bash
npm run lint:descriptions
```

The check is also run as part of `npm test` via `tests/enh-2789-description-budget.test.cjs`.
