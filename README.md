<div align="center">

# DECLARE

**A future-driven meta-prompting engine for agentic development.**

Forked from [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) — replaces linear phase-based planning with a three-layer DAG rooted in declared futures.

[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

```bash
npx declare-cc@latest
```

*Declare what's true when this succeeds. The system derives the rest backward.*

</div>

---

## What This Is

Most planning tools start from the present and work forward — "what should we do first?" Declare starts from the future and works backward — "what must be true for this to succeed?"

You declare present-tense statements of fact about your project's future. The system derives milestones ("what must be true?") and actions ("what must be done?") through causal structure, then executes them in topological order with wave-based parallelism.

Built on the Erhard/Jensen/Zaffron ontological model:
- **Integrity** as wholeness and completeness (not morality)
- **Alignment** as shared future (not agreement)
- **Performance** as the product of both

This is a fork of [GSD](https://github.com/gsd-build/get-shit-done). It carries forward GSD's agent orchestration, slash command patterns, esbuild bundling, markdown artifacts, and atomic git commits — but replaces the linear phase model with a declarative graph structure. See [Fork Boundary](#fork-boundary) for details.

---

## How It Works

### 1. Initialize

```
/declare:init
```

Scaffolds the project structure: `FUTURE.md`, `MILESTONES.md`, `.planning/` directory, and the graph config. Installs slash commands if needed.

### 2. Declare Futures

```
/declare:future
```

A guided conversation captures 3-5 declarations about your project's future. Each declaration is a present-tense statement of fact — not a goal, not a wish.

The system detects past-derived language ("I want to avoid...", "We need to fix...") and uses Socratic reframing to help you declare from the future rather than react to the past.

**Creates:** `FUTURE.md` with declarations (D-01, D-02, ...)

### 3. Derive Milestones

```
/declare:milestones
```

Works backward from declarations: "What must be true for D-01 to hold?" Each milestone maps to one or more declarations through causal edges in the DAG.

**Creates:** `MILESTONES.md` with milestones (M-01, M-02, ...)

### 4. Derive Actions

```
/declare:actions [M-XX]
```

For each milestone: "What must be done for M-01 to be true?" Derives concrete actions with dependencies, grouped into execution plans.

**Creates:** `.planning/milestones/M-XX-*/PLAN.md` with actions (A-01, A-02, ...)

### 5. Execute

```
/declare:execute [M-XX]
```

The system:

1. **Computes waves** — Groups actions by topological order using the DAG
2. **Spawns parallel agents** — Independent actions in the same wave run simultaneously
3. **Verifies per wave** — Each wave is verified before the next begins
4. **Completes milestones** — When all actions pass, milestone is marked DONE with verification artifacts

Each agent gets a fresh context window. Your main session stays light.

**Creates:** `VERIFICATION.md` per milestone

### 6. Navigate

Understand your graph at any point:

```
/declare:trace A-03       # Why does this action exist? Walk the why-chain up to its declaration
/declare:visualize        # ASCII tree of the full DAG with status markers
/declare:prioritize M-01  # Rank actions by unblocking power (dependency weight)
/declare:status           # Layer counts, health indicators, integrity/alignment metrics
```

---

## The Three-Layer DAG

```
Declarations (D-XX)     "What is true when this succeeds"
    │
    ▼
Milestones (M-XX)       "What must be true" (derived backward)
    │
    ▼
Actions (A-XX)          "What must be done" (derived backward)
```

Each layer connects to the one above through causal edges. Every action traces back to a declaration. Orphan nodes (actions without a milestone, milestones without a declaration) are detected and flagged.

The graph engine (`DeclareDag`) uses dual adjacency lists for O(1) bidirectional lookups — trace upward (why-chains) or traverse downward (what depends on this) with equal efficiency.

---

## Integrity & Alignment

Declare doesn't just track what's done — it tracks whether commitments are being honored.

### Integrity States

Every node in the graph has an integrity status:

| Status | Meaning |
|--------|---------|
| `KEPT` | Commitment fulfilled as declared |
| `HONORED` | Commitment couldn't be kept, but the honor protocol was followed |
| `BROKEN` | Commitment not fulfilled, no acknowledgment |
| `RENEGOTIATED` | Commitment explicitly changed through renegotiation flow |

The **honor protocol** for a commitment you can't keep: acknowledge the break, inform affected parties, clean up the mess, renegotiate a new commitment. This matches the Erhard/Jensen model — integrity isn't about being perfect, it's about restoring wholeness when things break.

### Alignment Monitoring

- **Drift detection** — Are current actions still aligned with declared futures?
- **Occurrence checks** — AI verifies declarations still hold at milestone completion
- **Performance scoring** — Alignment x Integrity as qualitative HIGH/MEDIUM/LOW (never numeric scores)
- **Renegotiation flow** — When a declaration no longer fits, renegotiate it into `FUTURE-ARCHIVE.md`

---

## Commands

| Command | What it does |
|---------|--------------|
| `/declare:init` | Scaffold project structure and install commands |
| `/declare:future` | Guided conversation to capture declared futures |
| `/declare:milestones` | Derive milestones backward from declarations |
| `/declare:actions [M-XX]` | Derive actions for a milestone |
| `/declare:execute [M-XX]` | Wave-based execution with parallel agents and verification |
| `/declare:trace <node>` | Walk the why-chain from any node up to its source declaration |
| `/declare:visualize` | ASCII tree of the full DAG with status markers |
| `/declare:prioritize [M-XX]` | Rank actions by dependency weight (unblocking power) |
| `/declare:status` | Graph health, layer counts, integrity and alignment metrics |
| `/declare:help` | Show all commands |

---

## Project Structure

```
FUTURE.md                              # Declared futures (D-01, D-02, ...)
MILESTONES.md                          # Derived milestones (M-01, M-02, ...)
FORK-BOUNDARY.md                       # What diverges from GSD and why

.planning/
├── config.json                        # Project settings
├── milestones/
│   └── M-XX-slug/
│       ├── PLAN.md                    # Actions for this milestone
│       └── VERIFICATION.md            # Integrity proof after execution
└── research/                          # Domain research artifacts

dist/declare-tools.cjs                 # Bundled CLI (zero runtime deps)
.claude/commands/declare/*.md          # Slash command definitions
```

---

## Getting Started

### Install

```bash
npx declare-cc@latest
```

Or clone and install locally:

```bash
git clone https://github.com/decocms/declare-cc.git
cd declare-cc
node bin/install.js --claude --local
```

Requires Node.js 18+.

### Quick Start

```
/declare:init                  # Scaffold the project
/declare:future                # Declare 3-5 futures
/declare:milestones            # Derive milestones backward
/declare:actions M-01          # Derive actions for first milestone
/declare:execute M-01          # Execute with wave scheduling
/declare:status                # Check integrity and alignment
```

### Recommended: Skip Permissions Mode

Declare spawns agents and runs CLI tools frequently. For frictionless operation:

```bash
claude --dangerously-skip-permissions
```

<details>
<summary><strong>Alternative: Granular Permissions</strong></summary>

Add to `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(node:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)"
    ]
  }
}
```

</details>

---

## Architecture

### Wave-Based Execution

Actions are grouped into waves based on their dependencies in the DAG. Within each wave, independent actions run in parallel via spawned agents. Waves run sequentially.

```
WAVE 1 (parallel)        WAVE 2 (parallel)        WAVE 3
┌──────────┐ ┌──────────┐  ┌──────────┐ ┌──────────┐  ┌──────────┐
│ A-01     │ │ A-02     │  │ A-03     │ │ A-04     │  │ A-05     │
│ Schema   │ │ Auth     │→ │ API      │ │ Storage  │→ │ UI       │
└──────────┘ └──────────┘  └──────────┘ └──────────┘  └──────────┘
      │           │              ↑           ↑              ↑
      └───────────┴──────────────┴───────────┘              │
             A-03 needs A-01, A-04 needs A-02               │
                        A-05 needs A-03 + A-04              │
```

Each agent gets a fresh 200k-token context window. Your main session stays at ~30-40% capacity.

### Atomic Git Commits

Every action gets its own commit:

```
feat(M-01): create database schema
feat(M-01): implement auth service
feat(M-01): build API endpoints
```

Git bisect finds the exact failing action. Each action is independently revertable.

### Zero Runtime Dependencies

The entire CLI bundles to a single `dist/declare-tools.cjs` via esbuild. No `node_modules` at runtime.

---

## Fork Boundary

Declare is forked from [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done), a meta-prompting and context engineering system for Claude Code.

### What's Carried Forward

- **Agent orchestration** — Planner, executor, researcher, verifier agent patterns
- **Slash command interface** — `.claude/commands/` directory, markdown meta-prompts
- **esbuild bundling** — Single-file CJS distribution, zero runtime deps
- **Markdown artifacts** — `.planning/` directory as source of truth
- **Atomic git commits** — Every state change produces a traceable commit
- **Context engineering** — Fresh context per agent, structured XML plans

### What's Replaced

| GSD | Declare | Why |
|-----|---------|-----|
| Linear phases (1, 2, 3...) | Three-layer DAG (D → M → A) | Phases are past-derived sequencing; DAGs represent causal structure |
| `ROADMAP.md` | `FUTURE.md` + `MILESTONES.md` | The present is given by the future you're living into |
| `STATE.md` tracking | Graph node statuses | Status lives in the graph, not a separate file |
| Sequential execution | Topology-aware wave scheduling | Actions execute in causal order, not linear sequence |
| Phase numbers | Milestone IDs (M-XX) | Milestones derive from declarations, not arbitrary ordering |

See `FORK-BOUNDARY.md` for the full divergence map.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

**Declare the future. Derive backward. Execute with integrity.**

</div>
