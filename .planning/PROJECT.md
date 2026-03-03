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

### Active

(None — planning next milestone)

### Out of Scope

- Adding new GSD workflows or commands — separate milestone
- Web UI or dashboard — not in scope
- Copilot hook system — Copilot CLI has no lifecycle events
- Conflict detection for non-GSD files in `.github/` — deferred (QUAL-02)

## Context

- Shipped v1.23 with Copilot as 5th runtime: 30 commits, +10,425 lines across 42 files
- Tech stack: Pure Node.js CommonJS, zero production dependencies
- `bin/install.js` is ~2,700 lines — single-file monolithic installer
- 566 total tests passing (104 Copilot-specific)
- Copilot uses `.github/` for local installs, `~/.copilot/` for global
- Skills use folder-per-skill structure (`.github/skills/gsd-*/SKILL.md`)
- Agents use `.agent.md` extension with JSON array tools format

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

---
*Last updated: 2026-03-03 after v1.23 milestone*
