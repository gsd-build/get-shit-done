# GSD User Guide

A detailed reference for workflows, troubleshooting, and configuration. For quick-start setup, see the [README](../README.md).

---

## Table of Contents

- [End-to-End Walkthrough](#end-to-end-walkthrough)
- [Workflow Diagrams](#workflow-diagrams)
- [UI Design Contract](#ui-design-contract)
- [Spiking & Sketching](#spiking--sketching)
- [Backlog & Threads](#backlog--threads)
- [Workstreams](#workstreams)
- [Security](#security)
- [Command And Configuration Reference](#command-and-configuration-reference)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)
- [Recovery Quick Reference](#recovery-quick-reference)

---

## End-to-End Walkthrough

This walkthrough shows how GSD phases connect for a typical single-phase project — a small Node.js REST API that validates webhook signatures. Follow it to understand what each command does, what it creates, and how the next command consumes it.

### 1. Create the project

```
/gsd-new-project
```

GSD asks questions about your idea, spawns parallel research agents, extracts requirements, and creates a roadmap. You approve the roadmap before any code is written.

**Example output (abridged):**

```
> What are you building?
  A webhook signature validator middleware for Express apps.

> Who's the user?
  Backend developers integrating third-party webhooks (Stripe, GitHub, Shopify).

[Research agents run in parallel...]
[Requirements extracted...]

Roadmap (1 phase):
  Phase 1 — Core middleware: HMAC-SHA256 signature validation,
             timing-safe compare, configurable tolerance window.

Approve? [y/n]
```

**What gets created:**

```
.planning/
  PROJECT.md          # "Webhook validator middleware — Express, HMAC-SHA256..."
  REQUIREMENTS.md     # REQ-001: Validate signature header; REQ-002: Timing-safe...
  ROADMAP.md          # Phase 1 status: pending
  STATE.md            # Session memory, current position
```

`ROADMAP.md` excerpt:
```markdown
## Phase 1 — Core middleware
**Status:** pending
**Goal:** HMAC-SHA256 signature validation with timing-safe compare and a
configurable replay-protection tolerance window.
**Requirements:** REQ-001, REQ-002, REQ-003
```

### 2. Discuss and plan the phase

```
/gsd-discuss-phase 1
```

GSD reads the phase goal and asks about your implementation preferences before any planning happens. This is where you shape *how* it builds — not just *what* it builds.

```
> How should invalid signatures be handled?
  Reject immediately with 401, log the raw header for debugging.

> Should the tolerance window be configurable per-route or global?
  Global config, but allow per-route override via middleware options.

> Any library preferences for HMAC?
  Node built-in crypto only — no extra dependencies.
```

**What gets created:** `.planning/phases/01-core-middleware/CONTEXT.md`

`CONTEXT.md` excerpt:
```markdown
## Implementation Decisions
- Invalid signatures → 401, log raw header
- Tolerance window → global default, per-route override via options object
- HMAC library → Node built-in crypto (no external deps)
- Error format → { error: "invalid_signature", ts: <epoch> }
```

Now plan the phase:

```
/gsd-plan-phase 1
```

GSD spawns four parallel research agents (stack, features, architecture, pitfalls), then a planner reads `CONTEXT.md` + research findings and creates atomic task plans. A plan-checker verifies each plan achieves the phase goal before saving.

**What gets created:**

```
.planning/phases/01-core-middleware/
  RESEARCH.md         # Findings: crypto.timingSafeEqual docs, replay attack patterns...
  01-01-PLAN.md       # Task: create validateSignature() core function
  01-02-PLAN.md       # Task: Express middleware wrapper + error handling
```

`01-01-PLAN.md` excerpt:
```xml
<task type="auto">
  <name>Create validateSignature core function</name>
  <files>src/validate.js, src/validate.test.js</files>
  <action>
    Use crypto.createHmac('sha256', secret).update(rawBody).digest('hex').
    Compare with crypto.timingSafeEqual() — never === or ==.
    Accept tolerance window in ms; reject if |timestamp - now| exceeds it.
  </action>
  <verify>npm test -- --grep "validateSignature"</verify>
  <done>All timing-safe comparison tests pass; replay outside window returns false</done>
</task>
```

### 3. Execute

```
/gsd-execute-phase 1
```

GSD groups plans into waves (parallel where independent, sequential where dependent), spawns a fresh 200k-context executor per plan, and commits each task atomically.

```
Wave 1 (parallel):
  [Executor A] → 01-01-PLAN.md (core function)  ✓ committed
  [Executor B] → 01-02-PLAN.md (middleware)      ✓ committed

[Verifier] Checking codebase against phase goals...
  REQ-001 validateSignature() ✓
  REQ-002 timing-safe compare ✓
  REQ-003 tolerance window    ✓
  Status: PASS
```

**Git history after execution:**

```
a1b2c3d feat(01-01): implement validateSignature with timingSafeEqual
d4e5f6g feat(01-02): add Express middleware wrapper and 401 error format
h7i8j9k chore(01): phase 1 verification — all requirements met
```

**What gets created:**

```
.planning/phases/01-core-middleware/
  01-01-SUMMARY.md    # "Implemented validateSignature(), 47 lines, tests passing"
  01-02-SUMMARY.md    # "Middleware wraps validator, logs raw header on 401"
  VERIFICATION.md     # REQ-001 ✓, REQ-002 ✓, REQ-003 ✓ — PASS
```

`STATE.md` is updated automatically to reflect the new phase status:

```markdown
## Current Position
Phase 1 — Core middleware: executed, pending verify
```

### 4. Verify

```
/gsd-verify-work 1
```

GSD extracts testable deliverables from the phase goal and walks you through them one at a time.

```
[1/3] Can you require the middleware and pass it to an Express route?
> yes

[2/3] Does a request with a valid signature return 200?
> yes

[3/3] Does a request with an invalid signature return 401 with { error: "invalid_signature" }?
> no — I'm getting a 500 instead

[Diagnosing...]
Root cause: middleware catches crypto.timingSafeEqual TypeError when
buffers are different lengths. Fix: normalize to same length before compare.

Fix plan created: .planning/phases/01-core-middleware/01-03-PLAN.md
Run /gsd-execute-phase 1 to apply.
```

After re-running execute and re-verifying:

```
All 3 checks passed. Phase 1 verified.
```

**What gets created:** `.planning/phases/01-core-middleware/UAT.md`

### What's next

Once a phase is verified, ship it:

```
/gsd-ship 1          # Creates a PR with auto-generated body
```

For multi-phase projects, repeat the loop:

```
/gsd-discuss-phase 2
/gsd-plan-phase 2
/gsd-execute-phase 2
/gsd-verify-work 2
```

Or let GSD figure out the next step automatically:

```
/gsd-next
```

When all phases are done:

```
/gsd-audit-milestone     # Verify all requirements shipped
/gsd-complete-milestone  # Archive, tag release
```

**Relevant flags covered in this walkthrough:**

| Flag | Command | When to use |
| ---- | ------- | ----------- |
| `--auto` | `/gsd-new-project` | Skip interactive questions, ingest from a PRD file |
| `--research` | `/gsd-quick` | Add a research agent to an ad-hoc task |
| `--validate` | `/gsd-quick` | Add plan-checking and post-execution verification |
| `--chain` | `/gsd-discuss-phase` | Auto-chain discuss → plan → execute without stopping |
| `--skip-research` | `/gsd-plan-phase` | Skip research agents when the domain is already familiar |
| `--draft` | `/gsd-ship` | Create a draft PR instead of a ready-for-review one |

For the full command reference with all flags, see [`docs/COMMANDS.md`](COMMANDS.md). For configuration options (model profiles, workflow agents, git branching), see [`docs/CONFIGURATION.md`](CONFIGURATION.md).

---

## Workflow Diagrams

### Full Project Lifecycle

```
  ┌──────────────────────────────────────────────────┐
  │                   NEW PROJECT                    │
  │  /gsd-new-project                                │
  │  Questions -> Research -> Requirements -> Roadmap│
  └─────────────────────────┬────────────────────────┘
                            │
             ┌──────────────▼─────────────┐
             │      FOR EACH PHASE:       │
             │                            │
             │  ┌────────────────────┐    │
             │  │ /gsd-discuss-phase │    │  <- Lock in preferences
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd-ui-phase      │    │  <- Design contract (frontend)
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd-plan-phase    │    │  <- Research + Plan + Verify
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd-execute-phase │    │  <- Parallel execution
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd-verify-work   │    │  <- Manual UAT
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd-ship          │    │  <- Create PR (optional)
             │  └──────────┬─────────┘    │
             │             │              │
             │     Next Phase?────────────┘
             │             │ No
             └─────────────┼──────────────┘
                            │
            ┌───────────────▼──────────────┐
            │  /gsd-audit-milestone        │
            │  /gsd-complete-milestone     │
            └───────────────┬──────────────┘
                            │
                   Another milestone?
                       │          │
                      Yes         No -> Done!
                       │
               ┌───────▼──────────────┐
               │  /gsd-new-milestone  │
               └──────────────────────┘
```

### Planning Agent Coordination

```
  /gsd-plan-phase N
         │
         ├── Phase Researcher (x4 parallel)
         │     ├── Stack researcher
         │     ├── Features researcher
         │     ├── Architecture researcher
         │     └── Pitfalls researcher
         │           │
         │     ┌──────▼──────┐
         │     │ RESEARCH.md │
         │     └──────┬──────┘
         │            │
         │     ┌──────▼──────┐
         │     │   Planner   │  <- Reads PROJECT.md, REQUIREMENTS.md,
         │     │             │     CONTEXT.md, RESEARCH.md
         │     └──────┬──────┘
         │            │
         │     ┌──────▼───────────┐     ┌────────┐
         │     │   Plan Checker   │────>│ PASS?  │
         │     └──────────────────┘     └───┬────┘
         │                                  │
         │                             Yes  │  No
         │                              │   │   │
         │                              │   └───┘  (loop, up to 3x)
         │                              │
         │                        ┌─────▼──────┐
         │                        │ PLAN files │
         │                        └────────────┘
         └── Done
```

### Validation Architecture (Nyquist Layer)

During plan-phase research, GSD now maps automated test coverage to each phase
requirement before any code is written. This ensures that when Claude's executor
commits a task, a feedback mechanism already exists to verify it within seconds.

The researcher detects your existing test infrastructure, maps each requirement to
a specific test command, and identifies any test scaffolding that must be created
before implementation begins (Wave 0 tasks).

The plan-checker enforces this as an 8th verification dimension: plans where tasks
lack automated verify commands will not be approved.

**Output:** `{phase}-VALIDATION.md` -- the feedback contract for the phase.

**Disable:** Set `workflow.nyquist_validation: false` in `/gsd-settings` for
rapid prototyping phases where test infrastructure isn't the focus.

### Retroactive Validation (`/gsd-validate-phase`)

For phases executed before Nyquist validation existed, or for existing codebases
with only traditional test suites, retroactively audit and fill coverage gaps:

```
  /gsd-validate-phase N
         |
         +-- Detect state (VALIDATION.md exists? SUMMARY.md exists?)
         |
         +-- Discover: scan implementation, map requirements to tests
         |
         +-- Analyze gaps: which requirements lack automated verification?
         |
         +-- Present gap plan for approval
         |
         +-- Spawn auditor: generate tests, run, debug (max 3 attempts)
         |
         +-- Update VALIDATION.md
               |
               +-- COMPLIANT -> all requirements have automated checks
               +-- PARTIAL -> some gaps escalated to manual-only
```

The auditor never modifies implementation code — only test files and
VALIDATION.md. If a test reveals an implementation bug, it's flagged as an
escalation for you to address.

**When to use:** After executing phases that were planned before Nyquist was
enabled, or after `/gsd-audit-milestone` surfaces Nyquist compliance gaps.

### Assumptions Discussion Mode

By default, `/gsd-discuss-phase` asks open-ended questions about your implementation preferences. Assumptions mode inverts this: GSD reads your codebase first, surfaces structured assumptions about how it would build the phase, and asks only for corrections.

**Enable:** Set `workflow.discuss_mode` to `'assumptions'` via `/gsd-settings`.

**How it works:**

1. Reads PROJECT.md, codebase mapping, and existing conventions
2. Generates a structured list of assumptions (tech choices, patterns, file locations)
3. Presents assumptions for you to confirm, correct, or expand
4. Writes CONTEXT.md from confirmed assumptions

**When to use:**

- Experienced developers who already know their codebase well
- Rapid iteration where open-ended questions slow you down
- Projects where patterns are well-established and predictable

See [docs/workflow-discuss-mode.md](workflow-discuss-mode.md) for the full discuss-mode reference.

### Decision Coverage Gates

The discuss-phase captures implementation decisions in CONTEXT.md under a
`<decisions>` block as numbered bullets (`- **D-01:** …`). Two gates — added
for issue #2492 — ensure those decisions survive into plans and shipped
code.

**Plan-phase translation gate (blocking).** After planning, GSD refuses to
mark the phase planned until every trackable decision appears in at least
one plan's `must_haves`, `truths`, or body. The gate names each missed
decision by id (`D-07: …`) so you know exactly what to add, move, or
reclassify.

**Verify-phase validation gate (non-blocking).** During verification, GSD
searches plans, SUMMARY.md, modified files, and recent commit messages for
each trackable decision. Misses are logged to VERIFICATION.md as a warning
section; verification status is unchanged. The asymmetry is deliberate —
the blocking gate is cheap at plan time but hostile at verify time.

**Writing decisions the gate can match.** Two match modes:

1. **Strict id match (recommended).** Cite the decision id anywhere in a
   plan that implements it — `must_haves.truths: ["D-12: bit offsets
   exposed"]`, a bullet in the plan body, a frontmatter comment. This is
   deterministic and unambiguous.
2. **Soft phrase match (fallback).** If a 6+-word slice of the decision
   text appears verbatim in any plan or shipped artifact, it counts. This
   forgives paraphrasing but is less reliable.

**Opting a decision out.** If a decision genuinely should not be tracked —
an implementation-discretion note, an informational capture, a decision
already deferred — mark it one of these ways:

- Move it under the `### Claude's Discretion` heading inside `<decisions>`.
- Tag it in its bullet: `- **D-08 [informational]:** …`,
  `- **D-09 [folded]:** …`, `- **D-10 [deferred]:** …`.

**Disabling the gates.** Set
`workflow.context_coverage_gate: false` in `.planning/config.json` (or via
`/gsd-settings`) to skip both gates silently. Default is `true`.

---

## UI Design Contract

### Why

AI-generated frontends are visually inconsistent not because Claude Code is bad at UI but because no design contract existed before execution. Five components built without a shared spacing scale, color contract, or copywriting standard produce five slightly different visual decisions.

`/gsd-ui-phase` locks the design contract before planning. `/gsd-ui-review` audits the result after execution.

### Commands


| Command              | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `/gsd-ui-phase [N]`  | Generate UI-SPEC.md design contract for a frontend phase |
| `/gsd-ui-review [N]` | Retroactive 6-pillar visual audit of implemented UI      |


### Workflow: `/gsd-ui-phase`

**When to run:** After `/gsd-discuss-phase`, before `/gsd-plan-phase` — for phases with frontend/UI work.

**Flow:**

1. Reads CONTEXT.md, RESEARCH.md, REQUIREMENTS.md for existing decisions
2. Detects design system state (shadcn components.json, Tailwind config, existing tokens)
3. shadcn initialization gate — offers to initialize if React/Next.js/Vite project has none
4. Asks only unanswered design contract questions (spacing, typography, color, copywriting, registry safety)
5. Writes `{phase}-UI-SPEC.md` to phase directory
6. Validates against 6 dimensions (Copywriting, Visuals, Color, Typography, Spacing, Registry Safety)
7. Revision loop if BLOCKED (max 2 iterations)

**Output:** `{padded_phase}-UI-SPEC.md` in `.planning/phases/{phase-dir}/`

### Workflow: `/gsd-ui-review`

**When to run:** After `/gsd-execute-phase` or `/gsd-verify-work` — for any project with frontend code.

**Standalone:** Works on any project, not just GSD-managed ones. If no UI-SPEC.md exists, audits against abstract 6-pillar standards.

**6 Pillars (scored 1-4 each):**

1. Copywriting — CTA labels, empty states, error states
2. Visuals — focal points, visual hierarchy, icon accessibility
3. Color — accent usage discipline, 60/30/10 compliance
4. Typography — font size/weight constraint adherence
5. Spacing — grid alignment, token consistency
6. Experience Design — loading/error/empty state coverage

**Output:** `{padded_phase}-UI-REVIEW.md` in phase directory with scores and top 3 priority fixes.

### Configuration


| Setting                   | Default | Description                                                 |
| ------------------------- | ------- | ----------------------------------------------------------- |
| `workflow.ui_phase`       | `true`  | Generate UI design contracts for frontend phases            |
| `workflow.ui_safety_gate` | `true`  | plan-phase prompts to run /gsd-ui-phase for frontend phases |


Both follow the absent=enabled pattern. Disable via `/gsd-settings`.

### shadcn Initialization

For React/Next.js/Vite projects, the UI researcher offers to initialize shadcn if no `components.json` is found. The flow:

1. Visit `ui.shadcn.com/create` and configure your preset
2. Copy the preset string
3. Run `npx shadcn init --preset {paste}`
4. Preset encodes the entire design system — colors, border radius, fonts

The preset string becomes a first-class GSD planning artifact, reproducible across phases and milestones.

### Registry Safety Gate

Third-party shadcn registries can inject arbitrary code. The safety gate requires:

- `npx shadcn view {component}` — inspect before installing
- `npx shadcn diff {component}` — compare against official

Controlled by `workflow.ui_safety_gate` config toggle.

### Screenshot Storage

`/gsd-ui-review` captures screenshots via Playwright CLI to `.planning/ui-reviews/`. A `.gitignore` is created automatically to prevent binary files from reaching git. Screenshots are cleaned up during `/gsd-complete-milestone`.

---

## Spiking & Sketching

Use `/gsd-spike` to validate technical feasibility before planning, and `/gsd-sketch` to explore visual direction before designing. Both store artifacts in `.planning/` and integrate with the project-skills system via their wrap-up companions.

### When to Spike

Spike when you're uncertain whether a technical approach is feasible or want to compare two implementations before committing a phase to one of them.

```
/gsd-spike                              # Interactive intake — describes the question, you confirm
/gsd-spike "can we stream LLM tokens through SSE"
/gsd-spike --quick "websocket vs SSE latency"
```

Each spike runs 2–5 experiments. Every experiment has:
- A **Given / When / Then** hypothesis written before any code
- **Working code** (not pseudocode)
- A **VALIDATED / INVALIDATED / PARTIAL** verdict with evidence

Results land in `.planning/spikes/NNN-name/README.md` and are indexed in `.planning/spikes/MANIFEST.md`.

Once you have signal, run `/gsd-spike-wrap-up` to package the findings into `.claude/skills/spike-findings-[project]/` — future sessions will load them automatically via project-skills discovery.

### When to Sketch

Sketch when you need to compare layout structures, interaction models, or visual treatments before writing any real component code.

```
/gsd-sketch                             # Mood intake — explores feel, references, core action
/gsd-sketch "dashboard layout"
/gsd-sketch --quick "sidebar navigation"
/gsd-sketch --text "onboarding flow"    # For non-Claude runtimes (Codex, Gemini, etc.)
```

Each sketch answers **one design question** with 2–3 variants in a single `index.html` you open directly in a browser — no build step. Variants use tab navigation and shared CSS variables from `themes/default.css`. All interactive elements (hover, click, transitions) are functional.

After picking a winner, run `/gsd-sketch-wrap-up` to capture the visual decisions into `.claude/skills/sketch-findings-[project]/`.

### Spike → Sketch → Phase Flow

```
/gsd-spike "SSE vs WebSocket"     # Validate the approach
/gsd-spike-wrap-up                # Package learnings

/gsd-sketch "real-time feed UI"   # Explore the design
/gsd-sketch-wrap-up               # Package decisions

/gsd-discuss-phase N              # Lock in preferences (now informed by spike + sketch)
/gsd-plan-phase N                 # Plan with confidence
```

---

## Backlog & Threads

### Backlog Parking Lot

Ideas that aren't ready for active planning go into the backlog using 999.x numbering, keeping them outside the active phase sequence.

```
/gsd-add-backlog "GraphQL API layer"     # Creates 999.1-graphql-api-layer/
/gsd-add-backlog "Mobile responsive"     # Creates 999.2-mobile-responsive/
```

Backlog items get full phase directories, so you can use `/gsd-discuss-phase 999.1` to explore an idea further or `/gsd-plan-phase 999.1` when it's ready.

**Review and promote** with `/gsd-review-backlog` — it shows all backlog items and lets you promote (move to active sequence), keep (leave in backlog), or remove (delete).

### Seeds

Seeds are forward-looking ideas with trigger conditions. Unlike backlog items, seeds surface automatically when the right milestone arrives.

```
/gsd-plant-seed "Add real-time collab when WebSocket infra is in place"
```

Seeds preserve the full WHY and WHEN to surface. `/gsd-new-milestone` scans all seeds and presents matches.

**Storage:** `.planning/seeds/SEED-NNN-slug.md`

### Persistent Context Threads

Threads are lightweight cross-session knowledge stores for work that spans multiple sessions but doesn't belong to any specific phase.

```
/gsd-thread                              # List all threads
/gsd-thread fix-deploy-key-auth          # Resume existing thread
/gsd-thread "Investigate TCP timeout"    # Create new thread
```

Threads are lighter weight than `/gsd-pause-work` — no phase state, no plan context. Each thread file includes Goal, Context, References, and Next Steps sections.

Threads can be promoted to phases (`/gsd-add-phase`) or backlog items (`/gsd-add-backlog`) when they mature.

**Storage:** `.planning/threads/{slug}.md`

---

## Workstreams

Workstreams let you work on multiple milestone areas concurrently without state collisions. Each workstream gets its own isolated `.planning/` state, so switching between them doesn't clobber progress.

**When to use:** You're working on milestone features that span different concern areas (e.g., backend API and frontend dashboard) and want to plan, execute, or discuss them independently without context bleed.

### Commands


| Command                            | Purpose                                              |
| ---------------------------------- | ---------------------------------------------------- |
| `/gsd-workstreams create <name>`   | Create a new workstream with isolated planning state |
| `/gsd-workstreams switch <name>`   | Switch active context to a different workstream      |
| `/gsd-workstreams list`            | Show all workstreams and which is active             |
| `/gsd-workstreams complete <name>` | Mark a workstream as done and archive its state      |


### How It Works

Each workstream maintains its own `.planning/` directory subtree. When you switch workstreams, GSD swaps the active planning context so that `/gsd-progress`, `/gsd-discuss-phase`, `/gsd-plan-phase`, and other commands operate on that workstream's state. Active context is session-scoped when the runtime exposes a stable session identifier, which prevents one terminal or AI instance from repointing another instance's `STATE.md`.

This is lighter weight than `/gsd-new-workspace` (which creates separate repo worktrees). Workstreams share the same codebase and git history but isolate planning artifacts.

---

## Security

### Defense-in-Depth (v1.27)

GSD generates markdown files that become LLM system prompts. This means any user-controlled text flowing into planning artifacts is a potential indirect prompt injection vector. v1.27 introduced centralized security hardening:

**Path Traversal Prevention:**
All user-supplied file paths (`--text-file`, `--prd`) are validated to resolve within the project directory. macOS `/var` → `/private/var` symlink resolution is handled.

**Prompt Injection Detection:**
The `security.cjs` module scans for known injection patterns (role overrides, instruction bypasses, system tag injections) in user-supplied text before it enters planning artifacts.

**Runtime Hooks:**

- `gsd-prompt-guard.js` — Scans Write/Edit calls to `.planning/` for injection patterns (always active, advisory-only)
- `gsd-workflow-guard.js` — Warns on file edits outside GSD workflow context (opt-in via `hooks.workflow_guard`)

**CI Scanner:**
`prompt-injection-scan.test.cjs` scans all agent, workflow, and command files for embedded injection vectors. Run as part of the test suite.

---

### Execution Wave Coordination

```
  /gsd-execute-phase N
         │
         ├── Analyze plan dependencies
         │
         ├── Wave 1 (independent plans):
         │     ├── Executor A (fresh 200K context) -> commit
         │     └── Executor B (fresh 200K context) -> commit
         │
         ├── Wave 2 (depends on Wave 1):
         │     └── Executor C (fresh 200K context) -> commit
         │
         └── Verifier
               ├── Check codebase against phase goals
               ├── Test quality audit (disabled tests, circular patterns, assertion strength)
               │
               ├── PASS -> VERIFICATION.md (success)
               └── FAIL -> Issues logged for /gsd-verify-work
```

### Brownfield Workflow (Existing Codebase)

```
  /gsd-map-codebase
         │
         ├── Stack Mapper     -> codebase/STACK.md
         ├── Arch Mapper      -> codebase/ARCHITECTURE.md
         ├── Convention Mapper -> codebase/CONVENTIONS.md
         └── Concern Mapper   -> codebase/CONCERNS.md
                │
        ┌───────▼──────────┐
        │ /gsd-new-project │  <- Questions focus on what you're ADDING
        └──────────────────┘
```

---

## Code Review Workflow

### Phase Code Review

After executing a phase, run a structured code review before UAT:

```bash
/gsd-code-review 3               # Review all changed files in phase 3
/gsd-code-review 3 --depth=deep  # Deep cross-file review (import graphs, call chains)
```

The reviewer scopes files automatically using SUMMARY.md (preferred) or git diff fallback. Findings are classified as Critical, Warning, or Info in `{phase}-REVIEW.md`.

```bash
/gsd-code-review-fix 3           # Fix Critical + Warning findings atomically
/gsd-code-review-fix 3 --auto    # Fix and re-review until clean (max 3 iterations)
```

### Autonomous Audit-to-Fix

To run an audit and fix all auto-fixable issues in one pass:

```bash
/gsd-audit-fix                   # Audit + classify + fix (medium+ severity, max 5)
/gsd-audit-fix --dry-run         # Preview classification without fixing
```

### Code Review in the Full Phase Lifecycle

The review step slots in after execution and before UAT:

```
/gsd-execute-phase N   ->  /gsd-code-review N  ->  /gsd-code-review-fix N  ->  /gsd-verify-work N
```

---

## Exploration & Discovery

### Socratic Exploration

Before committing to a new phase or plan, use `/gsd-explore` to think through the idea:

```bash
/gsd-explore                           # Open-ended ideation
/gsd-explore "caching strategy"        # Explore a specific topic
```

The exploration session guides you through probing questions, optionally spawns a research agent, and routes output to the appropriate GSD artifact: note, todo, seed, research question, requirements update, or new phase.

### Codebase Intelligence

For queryable codebase insights without reading the entire codebase, enable the intel system:

```json
{ "intel": { "enabled": true } }
```

Then build the index:

```bash
/gsd-intel refresh             # Analyze codebase and write .planning/intel/ files
/gsd-intel query auth          # Search for a term across all intel files
/gsd-intel status              # Check freshness of intel files
/gsd-intel diff                # See what changed since last snapshot
```

Intel files cover stack, API surface, dependency graph, file roles, and architecture decisions.

### Quick Scan

For a focused assessment without full `/gsd-map-codebase` overhead:

```bash
/gsd-scan                      # Quick tech + arch overview
/gsd-scan --focus quality      # Quality and code health only
/gsd-scan --focus concerns     # Risk areas and concerns
```

---

## Command And Configuration Reference

- **Command Reference:** see [`docs/COMMANDS.md`](COMMANDS.md) for every stable command's flags, subcommands, and examples. The authoritative shipped-command roster lives in [`docs/INVENTORY.md`](INVENTORY.md#commands-75-shipped).
- **Configuration Reference:** see [`docs/CONFIGURATION.md`](CONFIGURATION.md) for the full `config.json` schema, every setting's default and provenance, the per-agent model-profile table (including the `inherit` option for non-Claude runtimes), git branching strategies, and security settings.
- **Discuss Mode:** see [`docs/workflow-discuss-mode.md`](workflow-discuss-mode.md) for interview vs assumptions mode.

This guide intentionally does not re-document commands or config settings: maintaining two copies previously produced drift (`workflow.discuss_mode`'s default, `claude_md_path`'s default, the model-profile table's agent coverage). The single-source-of-truth rule is enforced mechanically by the drift-guard tests anchored on `docs/INVENTORY.md`.

<!-- The Command Reference table previously here duplicated docs/COMMANDS.md; removed to stop drift. -->
<!-- The Configuration Reference subsection (core settings, planning, workflow toggles, hooks, git branching, model profiles) previously here duplicated docs/CONFIGURATION.md; removed to stop drift. The `resolve_model_ids` ghost key that appeared only in this file's abbreviated schema is retired with the duplicate. -->

---

## Usage Examples

### New Project (Full Cycle)

```bash
claude --dangerously-skip-permissions
/gsd-new-project            # Answer questions, configure, approve roadmap
/clear
/gsd-discuss-phase 1        # Lock in your preferences
/gsd-ui-phase 1             # Design contract (frontend phases)
/gsd-plan-phase 1           # Research + plan + verify
/gsd-execute-phase 1        # Parallel execution
/gsd-verify-work 1          # Manual UAT
/gsd-ship 1                 # Create PR from verified work
/gsd-ui-review 1            # Visual audit (frontend phases)
/clear
/gsd-next                   # Auto-detect and run next step
...
/gsd-audit-milestone        # Check everything shipped
/gsd-complete-milestone     # Archive, tag, done
/gsd-session-report         # Generate session summary
```

### New Project from Existing Document

```bash
/gsd-new-project --auto @prd.md   # Auto-runs research/requirements/roadmap from your doc
/clear
/gsd-discuss-phase 1               # Normal flow from here
```

### Existing Codebase

```bash
/gsd-map-codebase           # Analyze what exists (parallel agents)
/gsd-new-project            # Questions focus on what you're ADDING
# (normal phase workflow from here)
```

**Post-execute drift detection (#2003).** After every `/gsd-execute-phase`,
GSD checks whether the phase introduced enough structural change
(new directories, barrel exports, migrations, or route modules) to make
`.planning/codebase/STRUCTURE.md` stale. If it did, the default behavior is
to print a one-shot warning suggesting the exact `/gsd-map-codebase --paths …`
invocation to refresh just the affected subtrees. Flip the behavior with:

```bash
/gsd-settings workflow.drift_action auto-remap       # remap automatically
/gsd-settings workflow.drift_threshold 5             # tune sensitivity
```

The gate is non-blocking: any internal failure logs and the phase continues.

### Quick Bug Fix

```bash
/gsd-quick
> "Fix the login button not responding on mobile Safari"
```

### Resuming After a Break

```bash
/gsd-progress               # See where you left off and what's next
# or
/gsd-resume-work            # Full context restoration from last session
```

### Preparing for Release

```bash
/gsd-audit-milestone        # Check requirements coverage, detect stubs
/gsd-plan-milestone-gaps    # If audit found gaps, create phases to close them
/gsd-complete-milestone     # Archive, tag, done
```

### Speed vs Quality Presets


| Scenario    | Mode          | Granularity | Profile    | Research | Plan Check | Verifier |
| ----------- | ------------- | ----------- | ---------- | -------- | ---------- | -------- |
| Prototyping | `yolo`        | `coarse`    | `budget`   | off      | off        | off      |
| Normal dev  | `interactive` | `standard`  | `balanced` | on       | on         | on       |
| Production  | `interactive` | `fine`      | `quality`  | on       | on         | on       |


**Skipping discuss-phase in autonomous mode:** When running in `yolo` mode with well-established preferences already captured in PROJECT.md, set `workflow.skip_discuss: true` via `/gsd-settings`. This bypasses the discuss-phase entirely and writes a minimal CONTEXT.md derived from the ROADMAP phase goal. Useful when your PROJECT.md and conventions are comprehensive enough that discussion adds no new information.

### Mid-Milestone Scope Changes

```bash
/gsd-add-phase              # Append a new phase to the roadmap
# or
/gsd-insert-phase 3         # Insert urgent work between phases 3 and 4
# or
/gsd-remove-phase 7         # Descope phase 7 and renumber
```

### Multi-Project Workspaces

Work on multiple repos or features in parallel with isolated GSD state.

```bash
# Create a workspace with repos from your monorepo
/gsd-new-workspace --name feature-b --repos hr-ui,ZeymoAPI

# Feature branch isolation — worktree of current repo with its own .planning/
/gsd-new-workspace --name feature-b --repos .

# Then cd into the workspace and initialize GSD
cd ~/gsd-workspaces/feature-b
/gsd-new-project

# List and manage workspaces
/gsd-list-workspaces
/gsd-remove-workspace feature-b
```

Each workspace gets:

- Its own `.planning/` directory (fully independent from source repos)
- Git worktrees (default) or clones of specified repos
- A `WORKSPACE.md` manifest tracking member repos

---

## Troubleshooting

### Programmatic CLI (`gsd-sdk query` vs `gsd-tools.cjs`)

For automation and copy-paste from docs, prefer **`gsd-sdk query`** with a registered subcommand (see [CLI-TOOLS.md — SDK and programmatic access](CLI-TOOLS.md#sdk-and-programmatic-access) and [QUERY-HANDLERS.md](../sdk/src/query/QUERY-HANDLERS.md)). The legacy `node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs` CLI remains supported for dual-mode operation.

**CLI-only (not in the query registry):** **graphify**, **from-gsd2** / **gsd2-import** — call `gsd-tools.cjs` (see [QUERY-HANDLERS.md](../sdk/src/query/QUERY-HANDLERS.md)). **Two different `state` JSON shapes in the legacy CLI:** `state json` (frontmatter rebuild) vs `state load` (`config` + `state_raw` + flags). **`gsd-sdk query` today:** both `state.json` and `state.load` resolve to the frontmatter-rebuild handler — use `node …/gsd-tools.cjs state load` when you need the CJS `state load` shape. See [CLI-TOOLS.md](CLI-TOOLS.md#sdk-and-programmatic-access) and QUERY-HANDLERS.

### STATE.md Out of Sync

If STATE.md shows incorrect phase status or position, use the state consistency commands (**CJS-only** until ported to the query layer):

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state validate          # Detect drift between STATE.md and filesystem
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state sync --verify     # Preview what sync would change
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state sync              # Reconstruct STATE.md from disk
```

These commands are new in v1.32 and replace manual STATE.md editing.

### Read-Before-Edit Infinite Retry Loop

Some non-Claude runtimes (Cline, Augment Code) may enter an infinite retry loop when an agent attempts to edit a file it hasn't read. The `gsd-read-before-edit.js` hook (v1.32) detects this pattern and advises reading the file first. If your runtime doesn't support PreToolUse hooks, add this to your project's `CLAUDE.md`:

```markdown
## Edit Safety Rule
Always read a file before editing it. Never call Edit or Write on a file you haven't read in this session.
```

### "Project already initialized"

You ran `/gsd-new-project` but `.planning/PROJECT.md` already exists. This is a safety check. If you want to start over, delete the `.planning/` directory first.

### Context Degradation During Long Sessions

Clear your context window between major commands: `/clear` in Claude Code. GSD is designed around fresh contexts -- every subagent gets a clean 200K window. If quality is dropping in the main session, clear and use `/gsd-resume-work` or `/gsd-progress` to restore state.

### Plans Seem Wrong or Misaligned

Run `/gsd-discuss-phase [N]` before planning. Most plan quality issues come from Claude making assumptions that `CONTEXT.md` would have prevented. You can also run `/gsd-list-phase-assumptions [N]` to see what Claude intends to do before committing to a plan.

### Discuss-Phase Uses Technical Jargon I Don't Understand

`/gsd-discuss-phase` adapts its language based on your `USER-PROFILE.md`. If the profile indicates a non-technical owner — `learning_style: guided`, `jargon` listed as a frustration trigger, or `explanation_depth: high-level` — gray area questions are automatically reframed in product-outcome language instead of implementation terminology.

To enable this: run `/gsd-profile-user` to generate your profile. The profile is stored at `~/.claude/get-shit-done/USER-PROFILE.md` and is read automatically on every `/gsd-discuss-phase` invocation. No other configuration is required.

### Execution Fails or Produces Stubs

Check that the plan was not too ambitious. Plans should have 2-3 tasks maximum. If tasks are too large, they exceed what a single context window can produce reliably. Re-plan with smaller scope.

### Lost Track of Where You Are

Run `/gsd-progress`. It reads all state files and tells you exactly where you are and what to do next.

### Need to Change Something After Execution

Do not re-run `/gsd-execute-phase`. Use `/gsd-quick` for targeted fixes, or `/gsd-verify-work` to systematically identify and fix issues through UAT.

### Model Costs Too High

Switch to budget profile: `/gsd-set-profile budget`. Disable research and plan-check agents via `/gsd-settings` if the domain is familiar to you (or to Claude).

### Tuning model cost by phase (`models`) — added in v1.40

If you've heard "use Opus for planning, Sonnet for verification" and want to apply that without learning the agent taxonomy, add a `models` block to `.planning/config.json`:

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
  }
}
```

The six slots (`planning` / `discuss` / `research` / `execution` / `verification` / `completion`) accept tier aliases (`opus`, `sonnet`, `haiku`, `inherit`). Each slot covers a group of agents — for example, setting `models.research = "sonnet"` applies to `gsd-phase-researcher`, `gsd-codebase-mapper`, `gsd-research-synthesizer`, and the other research agents in one shot.

Need a per-agent exception? Add `model_overrides` alongside — it wins over `models`:

```json
{
  "models": { "research": "sonnet" },
  "model_overrides": {
    "gsd-codebase-mapper": "haiku"
  }
}
```

That gives sonnet to all research agents *except* the codebase mapper, which runs haiku for the cheap-but-broad fan-out scan.

For the full mapping table and resolution-precedence rules, see [Per-Phase-Type Models](CONFIGURATION.md#per-phase-type-models-models--added-in-v140) in the configuration reference.

### Using Non-Claude Runtimes (Codex, OpenCode, Gemini CLI, Kilo)

If you installed GSD for a non-Claude runtime, the installer already configured model resolution so all agents use the runtime's default model. No manual setup is needed. Specifically, the installer sets `resolve_model_ids: "omit"` in your config, which tells GSD to skip Anthropic model ID resolution and let the runtime choose its own default model.

To assign different models to different agents on a non-Claude runtime, add `model_overrides` to `.planning/config.json` with fully-qualified model IDs that your runtime recognizes:

```json
{
  "resolve_model_ids": "omit",
  "model_overrides": {
    "gsd-planner": "o3",
    "gsd-executor": "o4-mini",
    "gsd-debugger": "o3"
  }
}
```

The installer auto-configures `resolve_model_ids: "omit"` for Gemini CLI, OpenCode, Kilo, and Codex. If you're manually setting up a non-Claude runtime, add it to `.planning/config.json` yourself.

#### Switching from Claude to Codex with one config change (#2517)

If you want tiered models on Codex without writing a large `model_overrides` block, set `runtime: "codex"` and pick a profile:

```json
{
  "runtime": "codex",
  "model_profile": "balanced"
}
```

GSD will resolve each agent's tier (`opus`/`sonnet`/`haiku`) to the Codex-native model and reasoning effort defined in the runtime tier map (`gpt-5.4` xhigh / `gpt-5.3-codex` medium / `gpt-5.4-mini` medium). The Codex installer embeds both `model` and `model_reasoning_effort` into each agent's TOML automatically. To override a single tier, add `model_profile_overrides.codex.<tier>`. See [Runtime-Aware Profiles](CONFIGURATION.md#runtime-aware-profiles-2517).

See the [Configuration Reference](CONFIGURATION.md#non-claude-runtimes-codex-opencode-gemini-cli-kilo) for the full explanation.

### Installing for Cline

Cline uses a rules-based integration — GSD installs as `.clinerules` rather than slash commands.

```bash
# Global install (applies to all projects)
npx get-shit-done-cc --cline --global

# Local install (this project only)
npx get-shit-done-cc --cline --local
```

Global installs write to `~/.cline/`. Local installs write to `./.cline/`. No custom slash commands are registered — GSD rules are loaded automatically by Cline from the rules file.

### Installing for CodeBuddy

CodeBuddy uses a skills-based integration.

```bash
npx get-shit-done-cc --codebuddy --global
```

Skills are installed to `~/.codebuddy/skills/gsd-*/SKILL.md`.

### Installing for Qwen Code

Qwen Code uses the same open skills standard as Claude Code 2.1.88+.

```bash
npx get-shit-done-cc --qwen --global
```

Skills are installed to `~/.qwen/skills/gsd-*/SKILL.md`. Use the `QWEN_CONFIG_DIR` environment variable to override the default install path.

### Using Claude Code with Non-Anthropic Providers (OpenRouter, Local)

If GSD subagents call Anthropic models and you're paying through OpenRouter or a local provider, switch to the `inherit` profile: `/gsd-set-profile inherit`. This makes all agents use your current session model instead of specific Anthropic models. See also `/gsd-settings` → Model Profile → Inherit.

### Working on a Sensitive/Private Project

Set `commit_docs: false` during `/gsd-new-project` or via `/gsd-settings`. Add `.planning/` to your `.gitignore`. Planning artifacts stay local and never touch git.

### GSD Update Overwrote My Local Changes

Since v1.17, the installer backs up locally modified files to `gsd-local-patches/`. Run `/gsd-update --reapply` to merge your changes back.

### Cannot Update via npm

If `npx get-shit-done-cc` fails due to npm outages or network restrictions, see [docs/manual-update.md](manual-update.md) for a step-by-step manual update procedure that works without npm access.

### Workflow Diagnostics (`/gsd-forensics`)

When a workflow fails in a way that isn't obvious -- plans reference nonexistent files, execution produces unexpected results, or state seems corrupted -- run `/gsd-forensics` to generate a diagnostic report.

**What it checks:**

- Git history anomalies (orphaned commits, unexpected branch state, rebase artifacts)
- Artifact integrity (missing or malformed planning files, broken cross-references)
- State inconsistencies (ROADMAP status vs. actual file presence, config drift)

**Output:** A diagnostic report written to `.planning/forensics/` with findings and suggested remediation steps.

### Executor Subagent Gets "Permission denied" on Bash Commands

GSD's `gsd-executor` subagents need write-capable Bash access to a project's standard tooling — `git commit`, `bin/rails`, `bundle exec`, `npm run`, `uv run`, and similar commands. Claude Code's default `~/.claude/settings.json` only allows a narrow set of read-only git commands, so a fresh install will hit "Permission to use Bash has been denied" the first time an executor tries to make a commit or run a build tool.

**Fix: add the required patterns to `~/.claude/settings.json`.**

The patterns you need depend on your stack. Copy the block for your stack and add it to the `permissions.allow` array.

#### Required for all stacks (git + gh)

```json
"Bash(git add:*)",
"Bash(git commit:*)",
"Bash(git merge:*)",
"Bash(git worktree:*)",
"Bash(git rebase:*)",
"Bash(git reset:*)",
"Bash(git checkout:*)",
"Bash(git switch:*)",
"Bash(git restore:*)",
"Bash(git stash:*)",
"Bash(git rm:*)",
"Bash(git mv:*)",
"Bash(git fetch:*)",
"Bash(git cherry-pick:*)",
"Bash(git apply:*)",
"Bash(gh:*)"
```

#### Rails / Ruby

```json
"Bash(bin/rails:*)",
"Bash(bin/brakeman:*)",
"Bash(bin/bundler-audit:*)",
"Bash(bin/importmap:*)",
"Bash(bundle:*)",
"Bash(rubocop:*)",
"Bash(erb_lint:*)"
```

#### Python / uv

```json
"Bash(uv:*)",
"Bash(python:*)",
"Bash(pytest:*)",
"Bash(ruff:*)",
"Bash(mypy:*)"
```

#### Node / npm / pnpm / bun

```json
"Bash(npm:*)",
"Bash(npx:*)",
"Bash(pnpm:*)",
"Bash(bun:*)",
"Bash(node:*)"
```

#### Rust / Cargo

```json
"Bash(cargo:*)"
```

**Example `~/.claude/settings.json` snippet (Rails project):**

```json
{
  "permissions": {
    "allow": [
      "Write",
      "Edit",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git merge:*)",
      "Bash(git worktree:*)",
      "Bash(git rebase:*)",
      "Bash(git reset:*)",
      "Bash(git checkout:*)",
      "Bash(git switch:*)",
      "Bash(git restore:*)",
      "Bash(git stash:*)",
      "Bash(git rm:*)",
      "Bash(git mv:*)",
      "Bash(git fetch:*)",
      "Bash(git cherry-pick:*)",
      "Bash(git apply:*)",
      "Bash(gh:*)",
      "Bash(bin/rails:*)",
      "Bash(bin/brakeman:*)",
      "Bash(bin/bundler-audit:*)",
      "Bash(bundle:*)",
      "Bash(rubocop:*)"
    ]
  }
}
```

**Per-project permissions (scoped to one repo):** If you prefer to allow these patterns for a single project rather than globally, add the same `permissions.allow` block to `.claude/settings.local.json` in your project root instead of `~/.claude/settings.json`. Claude Code checks project-local settings first.

**Interactive guidance:** When an executor is blocked mid-phase, it will identify the exact pattern needed (e.g. `"Bash(bin/rails:*)"`) so you can add it and re-run `/gsd-execute-phase`.

### Subagent Appears to Fail but Work Was Done

A known workaround exists for a Claude Code classification bug. GSD's orchestrators (execute-phase, quick) spot-check actual output before reporting failure. If you see a failure message but commits were made, check `git log` -- the work may have succeeded.

### Parallel Execution Causes Build Lock Errors

If you see pre-commit hook failures, cargo lock contention, or 30+ minute execution times during parallel wave execution, this is caused by multiple agents triggering build tools simultaneously. GSD handles this automatically since v1.26 — parallel agents use `--no-verify` on commits and the orchestrator runs hooks once after each wave. If you're on an older version, add this to your project's `CLAUDE.md`:

```markdown
## Git Commit Rules for Agents
All subagent/executor commits MUST use `--no-verify`.
```

To disable parallel execution entirely: `/gsd-settings` → set `parallelization.enabled` to `false`.

### Windows: Installation Crashes on Protected Directories

If the installer crashes with `EPERM: operation not permitted, scandir` on Windows, this is caused by OS-protected directories (e.g., Chromium browser profiles). Fixed since v1.24 — update to the latest version. As a workaround, temporarily rename the problematic directory before running the installer.

---

## Recovery Quick Reference


| Problem                              | Solution                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Lost context / new session           | `/gsd-resume-work` or `/gsd-progress`                                    |
| Phase went wrong                     | `git revert` the phase commits, then re-plan                             |
| Need to change scope                 | `/gsd-add-phase`, `/gsd-insert-phase`, or `/gsd-remove-phase`            |
| Milestone audit found gaps           | `/gsd-plan-milestone-gaps`                                               |
| Something broke                      | `/gsd-debug "description"` (add `--diagnose` for analysis without fixes) |
| STATE.md out of sync                 | `state validate` then `state sync`                                       |
| Workflow state seems corrupted       | `/gsd-forensics`                                                         |
| Quick targeted fix                   | `/gsd-quick`                                                             |
| Plan doesn't match your vision       | `/gsd-discuss-phase [N]` then re-plan                                    |
| Costs running high                   | `/gsd-set-profile budget` and `/gsd-settings` to toggle agents off       |
| Update broke local changes           | `/gsd-update --reapply`                                                  |
| Want session summary for stakeholder | `/gsd-session-report`                                                    |
| Don't know what step is next         | `/gsd-next`                                                              |
| Parallel execution build errors      | Update GSD or set `parallelization.enabled: false`                       |


---

## Project File Structure

For reference, here is what GSD creates in your project:

```
.planning/
  PROJECT.md              # Project vision and context (always loaded)
  REQUIREMENTS.md         # Scoped v1/v2 requirements with IDs
  ROADMAP.md              # Phase breakdown with status tracking
  STATE.md                # Decisions, blockers, session memory
  config.json             # Workflow configuration
  MILESTONES.md           # Completed milestone archive
  HANDOFF.json            # Structured session handoff (from /gsd-pause-work)
  research/               # Domain research from /gsd-new-project
  reports/                # Session reports (from /gsd-session-report)
  todos/
    pending/              # Captured ideas awaiting work
    done/                 # Completed todos
  debug/                  # Active debug sessions
    resolved/             # Archived debug sessions
  spikes/                 # Feasibility experiments (from /gsd-spike)
    NNN-name/             # Experiment code + README with verdict
    MANIFEST.md           # Index of all spikes
  sketches/               # HTML mockups (from /gsd-sketch)
    NNN-name/             # index.html (2-3 variants) + README
    themes/
      default.css         # Shared CSS variables for all sketches
    MANIFEST.md           # Index of all sketches with winners
  codebase/               # Brownfield codebase mapping (from /gsd-map-codebase)
  phases/
    XX-phase-name/
      XX-YY-PLAN.md       # Atomic execution plans
      XX-YY-SUMMARY.md    # Execution outcomes and decisions
      CONTEXT.md          # Your implementation preferences
      RESEARCH.md         # Ecosystem research findings
      VERIFICATION.md     # Post-execution verification results
      XX-UI-SPEC.md       # UI design contract (from /gsd-ui-phase)
      XX-UI-REVIEW.md     # Visual audit scores (from /gsd-ui-review)
  ui-reviews/             # Screenshots from /gsd-ui-review (gitignored)
```
