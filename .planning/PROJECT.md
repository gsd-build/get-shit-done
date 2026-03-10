# Get Shit Done (GSD)

## What This Is

A meta-prompting, context engineering and spec-driven development system for AI coding assistants. GSD provides structured workflows (questioning → research → requirements → roadmap → planning → execution → verification) that transform ideas into shipped code through AI-orchestrated phases. Supports Claude Code, OpenCode, Gemini, Codex, and Copilot runtimes.

## Core Value

Structured, spec-driven AI development that takes projects from idea to shipped code through deterministic workflows — ensuring nothing is lost between phases and every decision is traceable.

## Requirements

### Validated

- ✓ Multi-runtime installer (`bin/install.js`) supporting Claude Code, OpenCode, Gemini, Codex — existing
- ✓ CLI tools layer (`gsd-tools.cjs`) with atomic operations — existing
- ✓ Workflow orchestration via markdown-driven workflows — existing
- ✓ Agent definitions with specialized roles — existing
- ✓ Template system for config, research, planning artifacts — existing
- ✓ Hook system for pre/post execution — existing
- ✓ State management via `.planning/` directory — existing
- ✓ Git integration for atomic commits — existing
- ✓ GitHub Copilot CLI runtime support in installer — v1.23
- ✓ Copilot file structure generation (`.github/skills/`, `.github/agents/`, `copilot-instructions.md`) — v1.23
- ✓ Copilot installation testing and validation (104 tests, 15 E2E) — v1.23
- ✓ Autonomous skill (`gsd-autonomous`) chaining discuss → plan → execute → verify per phase — v1.24
- ✓ Grey area resolution with proposed answers grouped by area, user accepts/changes per area — v1.24
- ✓ Seamless phase transitions — only stops for explicit user decisions — v1.24
- ✓ Full milestone lifecycle automation from first phase to cleanup — v1.24

### Active

(None — milestone v1.24 complete, next milestone not yet started)

### Out of Scope

- Web UI or dashboard — not in scope
- Copilot hook system — Copilot CLI has no lifecycle events
- Conflict detection for non-GSD files in `.github/` — deferred (QUAL-02)

## Latest Shipped: v1.24 Autonomous Skill

**Shipped:** 2026-03-10 — Created `gsd-autonomous` skill that runs the full milestone lifecycle autonomously. 4 phases, 5 plans, 743-line workflow. Smart discuss proposes grey area answers, verification routing auto-continues or surfaces decisions, lifecycle automation handles audit→complete→cleanup.

## Context

- Shipped v1.24 with autonomous milestone execution: 41 commits, +6,139 lines across 33 files
- Shipped v1.23 with Copilot as 5th runtime: 30 commits, +10,425 lines across 42 files
- Tech stack: Pure Node.js CommonJS, zero production dependencies
- `bin/install.js` is ~2,700 lines — single-file monolithic installer
- 645 total tests passing (104 Copilot-specific, 2 autonomous-specific)
- Copilot uses `.github/` for local installs, `~/.copilot/` for global
- Skills use folder-per-skill structure (`.github/skills/gsd-*/SKILL.md`)
- Agents use `.agent.md` extension with JSON array tools format
- `gsd-autonomous` uses Skill() flat calls to avoid deep nesting (Issue #686)

## Constraints

- **Tech stack**: Pure Node.js (CommonJS), no external dependencies at runtime
- **Compatibility**: Must not break existing runtime installations
- **Testing**: Use `/tmp` directory for installation testing, not the project directory
- **Node.js**: >= 16.7.0 (per `package.json` engines field)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Add copilot as 5th runtime | Users need GSD in Copilot CLI alongside other AI assistants | ✓ Good — 31 skills, 11 agents, full lifecycle |
| Copilot local = `.github/`, global = `~/.copilot/` | Copilot reads from `.github/` in repos, global at `~/.copilot/` | ✓ Good — follows Copilot conventions |
| Tool mapping only for agents, not skills | Skills use original Claude tool names; agents need mapped names | ✓ Good — clean separation |
| CONV-09 router skill discarded | Not needed — Copilot auto-discovers skills from folder structure | ✓ Good — removed unnecessary complexity |
| Paired HTML markers for instructions | Unlike Codex single-marker-to-EOF, Copilot uses open+close markers | ✓ Good — cleaner merge/strip |
| `isGlobal` parameter on converters | Local vs global installs need different path mappings | ✓ Good — fixed critical path bug |
| `yamlQuote()` for argument-hint | Single quotes broke YAML when values contained inner `'` | ✓ Good — uses JSON.stringify |
| QUAL-02 deferred | Conflict detection doesn't exist for any runtime | — Deferred to future milestone |
| Skill() flat calls for autonomous | Task() deep nesting caused runtime freezes (Issue #686) | ✓ Good — 5 flat Skill() calls work reliably |
| Inline smart discuss | Replace open-ended Q&A with batch table proposals per area | ✓ Good — faster UX, identical CONTEXT.md output |
| --no-transition on execute-phase | Prevent execute-phase from auto-chaining via transition.md | ✓ Good — autonomous controls its own flow |
| VERIFICATION.md routing | Parse status frontmatter for auto-continue vs human decision | ✓ Good — 3 states cover all cases |

---
*Last updated: 2026-03-10 after v1.24 milestone completion*
