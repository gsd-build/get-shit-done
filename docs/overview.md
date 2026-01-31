# GSD (Get Shit Done Together) Overview

GSD is a meta-prompting and context engineering system for Claude Code, OpenCode, and Gemini CLI. It solves "context rot" — quality degradation as Claude fills its context window — through structured planning, multi-agent orchestration, and atomic execution.

## The Problem GSD Solves

As AI assistants work on larger tasks, their output quality degrades when context windows fill up. GSD addresses this by:

1. **Structured Planning** — Breaking work into phases and plans with clear boundaries
2. **Multi-Agent Orchestration** — Spawning fresh agents for each task to avoid context pollution
3. **Atomic Execution** — Per-task commits that preserve history and enable recovery
4. **Goal-Backward Verification** — Checking that goals were achieved, not just tasks completed

## Core Hierarchy

```
PROJECT (strategic container - lives forever)
    └── MILESTONE (version release - v1.0, v1.1, v2.0)
            └── PHASE (roadmap delivery unit - coherent work chunk)
                    └── PLAN (executable prompt - 2-3 tasks)
                            └── TASK (atomic implementation step)
```

| Level | Question Answered | Lifespan | Example |
|-------|-------------------|----------|---------|
| **Project** | "What am I building?" | Product lifetime | "Community platform for sharing interests" |
| **Milestone** | "What ships in this version?" | One release cycle | "v1.0 MVP with auth and posts" |
| **Phase** | "What outcome do we deliver?" | Part of milestone | "Phase 2: User Authentication" |
| **Plan** | "What exact steps?" | Single execution | "Plan 02-01: JWT auth with refresh" |
| **Task** | "What code change?" | Minutes | "Create login endpoint" |

## Key Concepts

### Projects
The long-lived strategic container. Defines what you're building, why it matters, and tracks requirements across all milestones. Lives in `.planning/PROJECT.md`.

[Learn more about Projects →](concepts/projects.md)

### Milestones
Shipped, tagged versions (v1.0, v1.1, v2.0). Bundle related phases together and represent release cycles. Archived after completion.

[Learn more about Milestones →](concepts/milestones.md)

### Phases
Roadmap delivery units with goals and success criteria. Too large to execute directly — they're broken into plans. Numbered continuously across milestones (never restart at 1).

[Learn more about Phases →](concepts/phases.md)

### Plans
Executable prompts with 2-3 tasks each. The actual instruction set Claude executes. Include verification criteria (`must_haves`) for goal-backward verification.

[Learn more about Plans →](concepts/plans.md)

## The .planning/ Directory

All GSD artifacts live in `.planning/`:

```
.planning/
├── PROJECT.md           # Strategic vision and requirements
├── ROADMAP.md           # Phase structure for current milestone
├── REQUIREMENTS.md      # Scoped requirements with traceability
├── STATE.md             # Project memory (position, decisions, blockers)
├── config.json          # Workflow preferences
├── phases/              # Phase execution directories
│   ├── 01-foundation/
│   │   ├── 01-01-PLAN.md
│   │   ├── 01-01-SUMMARY.md
│   │   └── 01-VERIFICATION.md
│   └── 02-features/
├── research/            # Domain research (optional)
├── codebase/            # Codebase analysis (optional)
└── milestones/          # Archived completed milestones
```

## Typical Workflow

```
/gsd:new-project              # Initialize project with deep questioning
    ↓
/gsd:plan-phase 1             # Create executable plans for Phase 1
    ↓
/gsd:execute-phase 1          # Run plans with parallel execution
    ↓
/gsd:verify-work 1            # Optional: User acceptance testing
    ↓
/gsd:progress                 # Route to next action (Phase 2, etc.)
    ↓
... repeat for each phase ...
    ↓
/gsd:audit-milestone          # Verify milestone completeness
    ↓
/gsd:complete-milestone       # Archive and tag release
    ↓
/gsd:new-milestone            # Start next version cycle
```

## Key Design Principles

### 1. Wave-Based Parallelization
Plans are grouped by `wave` number. Wave 1 plans run in parallel, Wave 2 waits for Wave 1, etc. Maximizes execution speed.

### 2. Atomic Commits
Each task produces one commit. Each plan produces a summary commit. Full git history for bisect/blame.

### 3. Goal-Backward Verification
Verification checks that **goals were achieved**, not just tasks completed. Catches hidden stubs and placeholder implementations.

### 4. State Persistence
STATE.md tracks position, decisions, and blockers. Survives context resets and session changes.

### 5. Fresh Agent Spawning
Each plan executed by a fresh `gsd-executor` agent. Prevents context pollution between plans.

## Configuration

GSD behavior is controlled by `.planning/config.json`:

```json
{
  "mode": "interactive",
  "depth": "standard",
  "model_profile": "balanced",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  },
  "git": {
    "branching_strategy": "none"
  }
}
```

**Model Profiles:**
- `quality` — Opus everywhere (highest quality, highest cost)
- `balanced` — Opus for planning, Sonnet for execution (recommended)
- `budget` — Sonnet/Haiku focus (fastest, lowest cost)

## Quick Reference

| Command | Purpose |
|---------|---------|
| `/gsd:new-project` | Initialize new project |
| `/gsd:plan-phase [N]` | Plan a phase |
| `/gsd:execute-phase [N]` | Execute a phase |
| `/gsd:progress` | Check status and route next |
| `/gsd:pause-work` | Save context for later |
| `/gsd:resume-work` | Restore saved context |
| `/gsd:help` | Show all commands |

[Full Command Reference →](reference/commands.md)

## Next Steps

- [Getting Started Guide](guides/getting-started.md) — Your first GSD project
- [Concepts Deep Dive](concepts/projects.md) — Understand the hierarchy
- [Command Reference](reference/commands.md) — All available commands
- [Agent Reference](reference/agents.md) — Understanding subagents
