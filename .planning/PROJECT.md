# Get Shit Done (GSD)

## What This Is

A meta-prompting, context engineering and spec-driven development system for AI coding assistants. GSD provides structured workflows (questioning → research → requirements → roadmap → planning → execution → verification) that transform ideas into shipped code through AI-orchestrated phases. Currently supports Claude Code, OpenCode, Gemini, and Codex runtimes.

## Core Value

Structured, spec-driven AI development that takes projects from idea to shipped code through deterministic workflows — ensuring nothing is lost between phases and every decision is traceable.

## Current Milestone: v1.23 Copilot CLI Support

**Goal:** Make the installation process compatible with GitHub Copilot CLI, adding it as a 5th supported runtime alongside Claude Code, OpenCode, Gemini, and Codex.

**Target features:**
- Add "copilot" as a recognized runtime in `bin/install.js`
- Copy/generate the correct files to `.github/` directory structure for Copilot
- Support both global and local installation modes for Copilot
- Handle Copilot-specific configuration (skills, agents, hooks)

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

### Active

- [ ] GitHub Copilot CLI runtime support in installer
- [ ] Copilot-specific file structure generation (`.github/skills/`, `.github/agents/`)
- [ ] Copilot installation testing and validation

### Out of Scope

- Modifying existing runtime support (Claude, OpenCode, Gemini, Codex) — working fine
- Adding new GSD workflows or commands — separate milestone
- Web UI or dashboard — not in scope

## Context

- The `.github/skills/` and `.github/agents/` directory structures for Copilot already exist in this repository as reference implementations
- The installer uses a pattern-based approach: each runtime has directory resolution, file copying, hook registration, and uninstall logic
- Testing will be done in a separate `/tmp` directory to avoid modifying the project directory
- Zero production dependencies — all runtime code uses Node.js built-ins only

## Constraints

- **Tech stack**: Pure Node.js (CommonJS), no external dependencies at runtime
- **Compatibility**: Must not break existing runtime installations
- **Testing**: Use `/tmp` directory for installation testing, not the project directory
- **Node.js**: >= 16.7.0 (per `package.json` engines field)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Add copilot as 5th runtime | Users need GSD in Copilot CLI alongside other AI assistants | — Pending |
| Test in /tmp directory | Avoid modifying the project directory during development | — Pending |
| Research-first approach | Understand current installer patterns before implementing | — Pending |

---
*Last updated: 2026-03-02 after initialization*
