# GSD Command Reference

> Complete command syntax, flags, options, and examples. For feature details, see [Feature Reference](FEATURES.md). For workflow walkthroughs, see [User Guide](USER-GUIDE.md).

---

## Command Syntax

- **Claude Code / Gemini / Copilot:** `/gsd:command-name [args]`
- **OpenCode:** `/gsd-command-name [args]`
- **Codex:** `$gsd-command-name [args]`

---

## Core Workflow Commands

### `/gsd:new-project`

Initialize a new project with deep context gathering.

| Flag | Description |
|------|-------------|
| `--auto @file.md` | Auto-extract from document, skip interactive questions |

**Prerequisites:** No existing `.planning/PROJECT.md`
**Produces:** `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, `research/`

```bash
/gsd:new-project                    # Interactive mode
/gsd:new-project --auto @prd.md     # Auto-extract from PRD
```

---

### `/gsd:discuss-phase`

Capture implementation decisions before planning.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to current phase) |

| Flag | Description |
|------|-------------|
| `--auto` | Auto-select recommended defaults for all questions |
| `--batch` | Group questions for batch intake instead of one-by-one |

**Prerequisites:** `.planning/ROADMAP.md` exists
**Produces:** `{phase}-CONTEXT.md`

```bash
/gsd:discuss-phase 1                # Interactive discussion for phase 1
/gsd:discuss-phase 3 --auto         # Auto-select defaults for phase 3
/gsd:discuss-phase --batch          # Batch mode for current phase
```

---

### `/gsd:ui-phase`

Generate UI design contract for frontend phases.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to current phase) |

**Prerequisites:** `.planning/ROADMAP.md` exists, phase has frontend/UI work
**Produces:** `{phase}-UI-SPEC.md`

```bash
/gsd:ui-phase 2                     # Design contract for phase 2
```

---

### `/gsd:plan-phase`

Research, plan, and verify a phase.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to next unplanned phase) |

| Flag | Description |
|------|-------------|
| `--auto` | Skip interactive confirmations |
| `--skip-research` | Skip domain research step |
| `--skip-verify` | Skip plan checker verification loop |

**Prerequisites:** `.planning/ROADMAP.md` exists
**Produces:** `{phase}-RESEARCH.md`, `{phase}-{N}-PLAN.md`, `{phase}-VALIDATION.md`

```bash
/gsd:plan-phase 1                   # Research + plan + verify phase 1
/gsd:plan-phase 3 --skip-research   # Plan without research (familiar domain)
/gsd:plan-phase --auto              # Non-interactive planning
```

---

### `/gsd:execute-phase`

Execute all plans in a phase with wave-based parallelization.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | **Yes** | Phase number to execute |

**Prerequisites:** Phase has PLAN.md files
**Produces:** `{phase}-{N}-SUMMARY.md`, `{phase}-VERIFICATION.md`, git commits

```bash
/gsd:execute-phase 1                # Execute phase 1
```

---

### `/gsd:verify-work`

User acceptance testing with auto-diagnosis.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to last executed phase) |

**Prerequisites:** Phase has been executed
**Produces:** `{phase}-UAT.md`, fix plans if issues found

```bash
/gsd:verify-work 1                  # UAT for phase 1
```

---

### `/gsd:ui-review`

Retroactive 6-pillar visual audit of implemented frontend.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to last executed phase) |

**Prerequisites:** Project has frontend code (works standalone, no GSD project needed)
**Produces:** `{phase}-UI-REVIEW.md`, screenshots in `.planning/ui-reviews/`

```bash
/gsd:ui-review                      # Audit current phase
/gsd:ui-review 3                    # Audit phase 3
```

---

### `/gsd:audit-milestone`

Verify milestone met its definition of done.

**Prerequisites:** All phases executed
**Produces:** Audit report with gap analysis

```bash
/gsd:audit-milestone
```

---

### `/gsd:complete-milestone`

Archive milestone, tag release.

**Prerequisites:** Milestone audit complete (recommended)
**Produces:** `MILESTONES.md` entry, git tag

```bash
/gsd:complete-milestone
```

---

### `/gsd:new-milestone`

Start next version cycle.

| Argument | Required | Description |
|----------|----------|-------------|
| `name` | No | Milestone name |

**Prerequisites:** Previous milestone completed
**Produces:** Updated `PROJECT.md`, new `REQUIREMENTS.md`, new `ROADMAP.md`

```bash
/gsd:new-milestone                  # Interactive
/gsd:new-milestone "v2.0 Mobile"    # Named milestone
```

---

## Phase Management Commands

### `/gsd:add-phase`

Append new phase to roadmap.

```bash
/gsd:add-phase                      # Interactive — describe the phase
```

### `/gsd:insert-phase`

Insert urgent work between phases using decimal numbering.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Insert after this phase number |

```bash
/gsd:insert-phase 3                 # Insert between phase 3 and 4 → creates 3.1
```

### `/gsd:remove-phase`

Remove future phase and renumber subsequent phases.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number to remove |

```bash
/gsd:remove-phase 7                 # Remove phase 7, renumber 8→7, 9→8, etc.
```

### `/gsd:list-phase-assumptions`

Preview Claude's intended approach before planning.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number |

```bash
/gsd:list-phase-assumptions 2       # See assumptions for phase 2
```

### `/gsd:plan-milestone-gaps`

Create phases to close gaps from milestone audit.

```bash
/gsd:plan-milestone-gaps             # Creates phases for each audit gap
```

### `/gsd:research-phase`

Deep ecosystem research only (standalone — usually use `/gsd:plan-phase` instead).

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number |

```bash
/gsd:research-phase 4               # Research phase 4 domain
```

### `/gsd:validate-phase`

Retroactively audit and fill Nyquist validation gaps.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number |

```bash
/gsd:validate-phase 2               # Audit test coverage for phase 2
```

---

## Navigation Commands

### `/gsd:progress`

Show status and next steps.

```bash
/gsd:progress                       # "Where am I? What's next?"
```

### `/gsd:resume-work`

Restore full context from last session.

```bash
/gsd:resume-work                    # After context reset or new session
```

### `/gsd:pause-work`

Save context handoff when stopping mid-phase.

```bash
/gsd:pause-work                     # Creates continue-here.md
```

### `/gsd:help`

Show all commands and usage guide.

```bash
/gsd:help                           # Quick reference
```

---

## Utility Commands

### `/gsd:quick`

Execute ad-hoc task with GSD guarantees.

| Flag | Description |
|------|-------------|
| `--full` | Enable plan checking (2 iterations) + post-execution verification |
| `--discuss` | Lightweight pre-planning discussion |
| `--research` | Spawn focused researcher before planning |

Default quick runs use the lighter quick-planner profile; `--full` keeps the standard planner profile for stricter plans.

Flags are composable.

```bash
/gsd:quick                          # Basic quick task
/gsd:quick --discuss --research     # Discussion + research + planning
/gsd:quick --full                   # With plan checking and verification
/gsd:quick --discuss --research --full  # All optional stages
```

### `/gsd:autonomous`

Run all remaining phases autonomously.

| Flag | Description |
|------|-------------|
| `--from N` | Start from a specific phase number |

```bash
/gsd:autonomous                     # Run all remaining phases
/gsd:autonomous --from 3            # Start from phase 3
```

### `/gsd:do`

Route freeform text to the right GSD command.

```bash
/gsd:do                             # Then describe what you want
```

### `/gsd:note`

Zero-friction idea capture — append, list, or promote notes to todos.

| Argument | Required | Description |
|----------|----------|-------------|
| `text` | No | Note text to capture (default: append mode) |
| `list` | No | List all notes from project and global scopes |
| `promote N` | No | Convert note N into a structured todo |

| Flag | Description |
|------|-------------|
| `--global` | Use global scope for note operations |

```bash
/gsd:note "Consider caching strategy for API responses"
/gsd:note list
/gsd:note promote 3
```

### `/gsd:debug`

Systematic debugging with persistent state.

| Argument | Required | Description |
|----------|----------|-------------|
| `description` | No | Description of the bug |

```bash
/gsd:debug "Login button not responding on mobile Safari"
```

### `/gsd:add-todo`

Capture idea or task for later.

| Argument | Required | Description |
|----------|----------|-------------|
| `description` | No | Todo description |

```bash
/gsd:add-todo "Consider adding dark mode support"
```

### `/gsd:check-todos`

List pending todos and select one to work on.

```bash
/gsd:check-todos
```

### `/gsd:add-tests`

Generate tests for a completed phase.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number |

```bash
/gsd:add-tests 2                    # Generate tests for phase 2
```

### `/gsd:stats`

Display project statistics.

```bash
/gsd:stats                          # Project metrics dashboard
```

### `/gsd:profile-user`

Generate a developer behavioral profile from Claude Code session analysis across 8 dimensions (communication style, decision patterns, debugging approach, UX preferences, vendor choices, frustration triggers, learning style, explanation depth). Produces artifacts that personalize Claude's responses.

| Flag | Description |
|------|-------------|
| `--questionnaire` | Use interactive questionnaire instead of session analysis |
| `--refresh` | Re-analyze sessions and regenerate profile |

**Generated artifacts:**
- `USER-PROFILE.md` — Full behavioral profile
- `/gsd:dev-preferences` command — Load preferences in any session
- `CLAUDE.md` profile section — Auto-discovered by Claude Code

```bash
/gsd:profile-user                   # Analyze sessions and build profile
/gsd:profile-user --questionnaire   # Interactive questionnaire fallback
/gsd:profile-user --refresh         # Re-generate from fresh analysis
```

### `/gsd:health`

Validate `.planning/` directory integrity.

| Flag | Description |
|------|-------------|
| `--repair` | Auto-fix recoverable issues |

```bash
/gsd:health                         # Check integrity
/gsd:health --repair                # Check and fix
```

### `/gsd:cleanup`

Archive accumulated phase directories from completed milestones.

```bash
/gsd:cleanup
```

---

## Configuration Commands

### `/gsd:settings`

Interactive configuration of workflow toggles and model profile.

```bash
/gsd:settings                       # Interactive config
```

### `/gsd:set-profile`

Quick profile switch.

| Argument | Required | Description |
|----------|----------|-------------|
| `profile` | **Yes** | `quality`, `balanced`, `budget`, or `inherit` |

```bash
/gsd:set-profile budget             # Switch to budget profile
/gsd:set-profile quality            # Switch to quality profile
```

---

## Brownfield Commands

### `/gsd:map-codebase`

Analyze existing codebase with parallel mapper agents.

| Argument | Required | Description |
|----------|----------|-------------|
| `area` | No | Scope mapping to a specific area |

```bash
/gsd:map-codebase                   # Full codebase analysis
/gsd:map-codebase auth              # Focus on auth area
```

---

## Update Commands

### `/gsd:update`

Update GSD with changelog preview.

```bash
/gsd:update                         # Check for updates and install
```

### `/gsd:reapply-patches`

Restore local modifications after a GSD update.

```bash
/gsd:reapply-patches                # Merge back local changes
```

---

## Community Commands

### `/gsd:join-discord`

Open Discord community invite.

```bash
/gsd:join-discord
```
