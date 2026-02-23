---
name: gsdf:help
description: Show gsdf commands and token savings
---

# GSDF: Token-Optimized Workflow

GSDF is an overlay on official GSD that reduces token usage through modular skill loading.

## Available Commands

### Core Commands (Optimized)

| Command | Description | Token Savings |
|---------|-------------|---------------|
| `/gsdf:new-project` | Initialize project | ~60% |
| `/gsdf:new-milestone` | Start new milestone | ~55% |
| `/gsdf:map-codebase` | Map existing codebase | ~50% |
| `/gsdf:plan-phase` | Plan a phase | ~55-68% |
| `/gsdf:research-phase` | Research phase approach | ~50% |
| `/gsdf:execute-phase` | Execute phase plans | ~45-55% |
| `/gsdf:quick` | Quick task execution | ~50% |
| `/gsdf:verify-work` | User acceptance testing | ~45% |
| `/gsdf:debug` | Systematic debugging | ~50-68% |
| `/gsdf:audit-milestone` | Audit milestone completion | ~40% |
| `/gsdf:plan-milestone-gaps` | Plan gap closure phases | ~45% |
| `/gsdf:set-profile` | Set GSDF model profile | - |

### Passthrough Commands (Use Full GSD)

These are lightweight and don't need optimization:

| Command | Description |
|---------|-------------|
| `/gsd:progress` | Check project status |
| `/gsd:discuss-phase` | Gather phase context |
| `/gsd:add-phase` | Add phase to roadmap |
| `/gsd:insert-phase` | Insert urgent phase |
| `/gsd:remove-phase` | Remove future phase |
| `/gsd:add-todo` | Capture todo |
| `/gsd:check-todos` | List pending todos |
| `/gsd:pause-work` | Create handoff |
| `/gsd:resume-work` | Resume from handoff |
| `/gsd:complete-milestone` | Archive milestone |
| `/gsd:settings` | Configure workflow |
| `/gsd:set-profile` | Switch model profile |
| `/gsd:list-phase-assumptions` | See Claude's assumptions |
| `/gsd:help` | Full GSD reference |
| `/gsd:update` | Update GSD |
| `/gsd:join-discord` | Join community |

## How It Works

Instead of loading monolithic agent prompts every time, GSDF:

1. **Loads lean cores** — Essential agent logic only (~300-450 lines vs 800-1400)
2. **Detects requirements** — What does this specific task need?
3. **Loads only required skills** — Modular additions on demand

## Modular Architecture

### Core Agents (Always Loaded)

| Agent | Lines | Original | Savings |
|-------|-------|----------|---------|
| gsd-planner-core | ~440 | 1,386 | 68% |
| gsd-executor-core | ~310 | 784 | 60% |
| gsd-debugger-core | ~330 | 1,203 | 73% |
| gsd-phase-researcher-core | ~230 | 641 | 64% |

### Skills (Conditionally Loaded)

**Planner Skills:**
| Skill | Lines | Loaded When |
|-------|-------|-------------|
| checkpoints.md | ~55 | Phase has verification needs |
| tdd.md | ~85 | Phase mentions TDD/tests |
| gap-closure.md | ~80 | `--gaps` flag used |
| revision.md | ~110 | Checker finds issues |

**Executor Skills:**
| Skill | Lines | Loaded When |
|-------|-------|-------------|
| checkpoints.md | ~75 | Plan has checkpoint tasks |
| tdd.md | ~70 | Plan type is TDD |
| auth-gates.md | ~80 | Plan involves external services |

**Debugger Skills:**
| Skill | Lines | Loaded When |
|-------|-------|-------------|
| investigation-techniques.md | ~80 | Complex/intermittent issues |
| verification-patterns.md | ~75 | Fix verification needed |

**Shared Skills:**
| Skill | Lines | Used By |
|-------|-------|---------|
| checkpoints.md | ~120 | Both planner and executor |
| research-methodology.md | ~115 | Researchers, debugger |

## Token Savings Examples

### Planning a Simple Phase (CRUD)
```
Official: 1,386 lines (full planner)
Lite: 440 lines (core only)
Savings: 68%
```

### Planning with TDD + Checkpoints
```
Official: 1,386 lines
Lite: 440 + 85 + 55 = 580 lines
Savings: 58%
```

### Executing with Checkpoints + TDD
```
Official: 784 lines (full executor)
Lite: 310 + 75 + 70 = 455 lines
Savings: 42%
```

### New Project (4 researchers + roadmapper)
```
Official: ~20K tokens (full prompts inline)
Lite: ~8K tokens (core agents)
Savings: 60%
```

## Usage

```bash
# Start a new project
/gsdf:new-project

# Plan and execute
/gsdf:plan-phase 1
/gsdf:execute-phase 1

# Quick task
/gsdf:quick

# Debug an issue
/gsdf:debug "Login fails intermittently"

# Verify and audit
/gsdf:verify-work 1
/gsdf:audit-milestone
```

## Mixing GSD and GSDF

You can mix commands freely:
- `/gsd:new-project` then `/gsdf:plan-phase 1`
- `/gsdf:execute-phase 1` then `/gsd:verify-work 1`

Both use the same `.planning/` structure and artifacts.

## Separate Model Profiles

GSDF has its **own** model profile, independent from full GSD:

```json
{
  "model_profile": "quality",       // Used by /gsd:* commands
  "model_profile_gsdf": "budget",   // Used by /gsdf:* commands
}
```

**Set profiles independently:**
```bash
/gsd:set-profile quality        # Full GSD uses Opus
/gsdf:set-profile budget    # GSDF uses Haiku/Sonnet
```

**Use case:** Run full GSD on quality for complex phases, GSDF on budget for quick iterations.

**GSDF model lookup:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-planner-core | opus | sonnet | sonnet |
| gsd-executor-core | sonnet | sonnet | haiku |
| gsd-debugger-core | sonnet | sonnet | haiku |
| gsd-phase-researcher-core | opus | sonnet | haiku |

**Fallback:** If `model_profile_gsdf` is not set, GSDF falls back to `model_profile`, then to "balanced".

## When to Use Which

**Use `/gsdf:*` when:**
- Token budget is constrained
- Working on simpler/standard projects
- Using budget model profile
- Running many planning/execution iterations
- Tasks are straightforward CRUD, UI, API work

**Use official `/gsd:*` when:**
- First time with complex domain (AI, 3D, games)
- Need full documentation reference
- Debugging unusual or intermittent issues
- Quality is paramount

## File Locations

```
~/.claude/
├── commands/
│   ├── gsd/                     # Official (untouched)
│   └── gsdf/                # Your overlay
│       ├── new-project.md
│       ├── new-milestone.md
│       ├── map-codebase.md
│       ├── plan-phase.md
│       ├── research-phase.md
│       ├── execute-phase.md
│       ├── quick.md
│       ├── verify-work.md
│       ├── debug.md
│       ├── audit-milestone.md
│       ├── plan-milestone-gaps.md
│       ├── set-profile.md
│       └── help.md
│
├── agents/
│   ├── gsd-*.md                 # Official agents
│   ├── gsd-planner-core.md      # Lean cores
│   ├── gsd-executor-core.md
│   ├── gsd-debugger-core.md
│   └── gsd-phase-researcher-core.md
│
└── skills/
    ├── shared/
    │   ├── checkpoints.md
    │   └── research-methodology.md
    ├── planner/
    │   ├── checkpoints.md
    │   ├── tdd.md
    │   ├── gap-closure.md
    │   └── revision.md
    ├── executor/
    │   ├── checkpoints.md
    │   ├── tdd.md
    │   └── auth-gates.md
    ├── debugger/
    │   ├── investigation-techniques.md
    │   └── verification-patterns.md
    └── researcher/
        └── output-formats.md
```

## Staying Updated

GSDF is independent of official GSD:

```bash
# Update official GSD (doesn't touch gsdf)
/gsd:update

# Your modular files are preserved
```

GSDF uses your custom core agents and skills, so updates to official GSD won't break your setup.
