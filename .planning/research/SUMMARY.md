# Research Summary: `gsd-autonomous` Skill

## Overview

This document synthesizes findings from internal project research into building a `gsd-autonomous` skill — a meta-orchestrator that chains existing GSD phases into a fully autonomous pipeline. The research examined skill structure, workflow patterns, the agent system, configuration/state management, and identified the architectural approach for implementation.

**Core conclusion:** No existing mechanism chains all phases end-to-end. The autonomous skill fills this gap by orchestrating the full discuss → plan → execute loop across every phase in a roadmap, reusing all existing agents and workflows.

---

## 1. Skill & Command Structure

Skills are declared in `.github/skills/gsd-*/SKILL.md` using YAML frontmatter:

| Field | Purpose |
|---|---|
| `name` | Skill identifier (e.g. `gsd-execute-phase`) |
| `description` | Short human-readable summary |
| `argument-hint` | Placeholder shown in UI |
| `allowed-tools` | Tools the skill may invoke |

- Mirror definitions exist in `commands/gsd/*.md` for CLI invocation.
- Orchestrator-level skills reference workflow files via `@.github/get-shit-done/workflows/*.md`.
- Skill bodies use structured XML sections: `<objective>`, `<execution_context>`, `<context>`, `<process>`, and `<success_criteria>`.

**Implication for autonomous skill:** Follow the same declaration pattern — SKILL.md frontmatter + matching command file + workflow reference.

---

## 2. Workflow Patterns

33 workflow files exist under `.github/get-shit-done/workflows/`. Key patterns observed:

### Phase Loop

The core development cycle is:

```
discuss → plan → execute → transition (next phase)
```

Each step is a separate workflow. There is no single workflow that drives the full loop today.

### Subagent Spawning

Workflows delegate to agents via the `Task()` primitive:

```
Task(subagent_type, model, prompt)
```

This is the standard interface for all agent invocation.

### Bootstrapping

Every workflow initializes with `gsd-tools.cjs init`, which loads project context as a JSON payload (roadmap, config, current phase, state).

### Parallel Execution

The execute-phase workflow groups plans into dependency waves and runs independent plans in parallel within each wave.

### Config Gates

`gates.*` flags in config control user interaction checkpoints. Setting gates to `false` reduces prompts but does not eliminate them — grey-area proposals during discuss still require user input.

**Implication for autonomous skill:** The new workflow must bootstrap identically (`gsd-tools.cjs init`), spawn agents through `Task()`, and respect wave-based parallelism during execution.

---

## 3. Agent System

12 specialized agents live in `.github/agents/`, each responsible for a single job:

| Agent | Role |
|---|---|
| `gsd-phase-researcher` | Research implementation approach |
| `gsd-planner` | Create executable phase plans |
| `gsd-plan-checker` | Verify plan quality before execution |
| `gsd-executor` | Execute plans with atomic commits |
| `gsd-verifier` | Verify phase goal achievement |
| `gsd-debugger` | Investigate bugs systematically |
| `gsd-nyquist-auditor` | Fill validation/test gaps |
| `gsd-integration-checker` | Verify cross-phase integration |
| `gsd-codebase-mapper` | Analyze codebase structure |
| `gsd-project-researcher` | Research domain before roadmap |
| `gsd-research-synthesizer` | Synthesize parallel research outputs |
| `gsd-roadmapper` | Create project roadmaps |

### Orchestration Hierarchy

```
Skill → Workflow → Agent → Result Aggregation
         (4 levels of meta-orchestration)
```

**Implication for autonomous skill:** All required agents already exist. The autonomous skill adds a new orchestration layer *above* existing workflows — it does not need new agents.

---

## 4. Configuration & State Management

### Config (`config.json`)

- `workflow.auto_advance` — toggle for automatic phase transitions (exists but does not chain the full loop).
- `gates.*` — per-step interaction gates. Disabling reduces prompts.

### State (`STATE.md`)

- Updated after each significant action.
- Tracks current milestone, phase, and status.

### Roadmap (`ROADMAP.md`)

- Source-of-truth for phase ordering and dependencies.
- Each phase has a number, title, goal, and dependency list.

**Implication for autonomous skill:** Read ROADMAP.md at startup to build the phase execution plan. Update STATE.md after each phase completes. Respect `auto_advance` and gate settings.

---

## 5. Gaps in Current System

| Gap | Detail |
|---|---|
| No cross-phase chaining | Each phase must be manually triggered after the previous completes. |
| Discuss requires human input | Grey areas surface open-ended questions with no mechanism for AI-proposed answers. |
| `--auto` flag is per-command | It reduces interaction within a single command but does not chain commands. |
| No end-to-end audit path | Milestone audit, completion, and cleanup are separate manual steps after all phases. |

---

## 6. Architecture Recommendation

### New Artifacts

| Artifact | Path |
|---|---|
| Skill definition | `.github/skills/gsd-autonomous/SKILL.md` |
| Command definition | `commands/gsd/autonomous.md` |
| Workflow | `.github/get-shit-done/workflows/autonomous.md` |

No new agents are needed.

### Orchestration Flow

```
┌─────────────────────────────────────────────────┐
│              gsd-autonomous                      │
│                                                  │
│  1. Bootstrap (gsd-tools.cjs init)               │
│  2. Read ROADMAP.md → ordered phase list         │
│                                                  │
│  ┌─── For each phase ───────────────────────┐    │
│  │                                           │    │
│  │  3. DISCUSS                               │    │
│  │     → Propose answers to grey areas       │    │
│  │     → Skip open-ended user questions      │    │
│  │                                           │    │
│  │  4. PLAN                                  │    │
│  │     → researcher → planner → checker      │    │
│  │     (delegate to existing workflows)      │    │
│  │                                           │    │
│  │  5. EXECUTE                               │    │
│  │     → Wave-based parallel execution       │    │
│  │     (delegate to existing workflow)        │    │
│  │                                           │    │
│  │  6. Update STATE.md, advance phase        │    │
│  └───────────────────────────────────────────┘    │
│                                                  │
│  7. Audit milestone                              │
│  8. Complete milestone                           │
│  9. Cleanup                                      │
└─────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Discuss override** — Instead of surfacing open-ended questions, the autonomous workflow should analyze context and propose concrete answers to grey areas. The user reviews a summary rather than answering questions interactively.

2. **Delegate, don't duplicate** — Plan and execute steps invoke existing `plan-phase` and `execute-phase` workflows directly. The autonomous workflow is purely an orchestration layer.

3. **Gate suppression** — Set all `gates.*` to `false` for the duration of autonomous execution. Restore original values on completion or failure.

4. **Failure handling** — If any phase fails, pause autonomous execution, write a detailed failure context to STATE.md, and surface the issue for human intervention.

5. **State continuity** — On resume after failure, read STATE.md to determine which phase to continue from. Do not re-execute completed phases.

6. **Reuse `gsd-tools.cjs`** — All state transitions, atomic commits, and context loading go through the existing tooling. No parallel state management.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Grey-area proposals may be wrong | Log all autonomous decisions; allow post-hoc review before milestone completion. |
| Runaway execution on large roadmaps | Add optional phase-count limit and elapsed-time guard. |
| State corruption on mid-phase failure | Atomic commits per plan ensure partial work is recoverable. |
| Agent model costs for many phases | Use `gsd-set-profile` budget profile for research/check agents; reserve quality profile for execution. |

---

## 8. Next Steps

1. **Create the skill and command definitions** following existing patterns.
2. **Write the `autonomous.md` workflow** with the orchestration loop.
3. **Implement discuss-override logic** that proposes grey-area answers from codebase context.
4. **Add failure-resume capability** by reading STATE.md on startup.
5. **Test on a small milestone** (2–3 phases) before running on full roadmaps.
