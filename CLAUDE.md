# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Get Shit Done Together (GSD) is a meta-prompting and context engineering system for Claude Code, OpenCode, and Gemini CLI. It solves "context rot" — quality degradation as Claude fills its context window — through structured planning, multi-agent orchestration, and atomic execution.

Published to npm as `get-shit-done-together`. Users install via `npx get-shit-done-together`.

## Development Commands

```bash
# Install dependencies
pnpm install

# Local development: link globally and run installer
pnpm dev:local

# Build hooks (copies JS files to hooks/dist/)
pnpm build:hooks

# Test installer locally (installs to ./.claude/)
node bin/install.js --claude --local

# Publish to npm (auto-runs build:hooks via prepublishOnly)
pnpm publish
```

## Architecture

### Core Components

**bin/install.js** — The installer and uninstaller. Handles:
- Multi-runtime support (Claude Code, OpenCode, Gemini CLI)
- Path replacement for global/local installs (`~/.claude/` → actual paths)
- Frontmatter conversion between runtimes (Claude YAML → OpenCode permissions → Gemini TOML)
- Settings.json hook registration
- Orphaned file cleanup from previous versions

**commands/gsd/** — Slash commands (`.md` files with YAML frontmatter). Each command:
- Has `allowed-tools:` specifying what the command can use
- Uses `@path` syntax to include context files
- Contains XML-structured prompts for Claude

**agents/** — Subagent definitions (`gsd-*.md`). Spawned by commands via the Task tool:
- `gsd-executor` — Executes plans with atomic commits
- `gsd-planner` — Creates task plans with verification
- `gsd-phase-researcher` / `gsd-project-researcher` — Domain research
- `gsd-verifier` — Post-execution verification
- `gsd-debugger` — Systematic debugging with persistent state

**get-shit-done/** — Reference docs, templates, and workflows:
- `references/` — Guidelines (questioning, git, model profiles, TDD)
- `templates/` — Document templates (PROJECT.md, PLAN.md, STATE.md, etc.)
- `workflows/` — Multi-step workflow instructions

**hooks/** — Claude Code hooks:
- `gsd-statusline.js` — Shows model, task, and context usage
- `gsd-check-update.js` — Version check on session start
- Built to `hooks/dist/` for installation

**docs/** — User-facing documentation:
- `concepts/` — Core concepts (projects, milestones, phases, plans)
- `reference/` — Technical reference (commands, agents, templates)
- `guides/` — How-to guides (getting-started, workflows)
- `overview.md` — System overview and quick reference

### Key Patterns

**Frontmatter Conversion** — The installer converts Claude Code frontmatter for other runtimes:
- Claude: `allowed-tools:` YAML array
- OpenCode: `tools:` object with boolean values, lowercase tool names, `gsd:` → `gsd-` in paths
- Gemini: TOML format, snake_case tool names, MCP tools excluded (auto-discovered)

**Path Replacement** — All commands/agents use `~/.claude/` as the canonical path. The installer replaces this with the actual installation path at install time.

**XML Prompt Structure** — Commands and agents use XML tags (`<role>`, `<process>`, `<execution_context>`) for structured prompts that Claude processes reliably.

**State Management** — Projects use `.planning/` directory with:
- `STATE.md` — Current position, decisions, blockers
- `config.json` — Workflow settings (mode, depth, model profile)
- Per-phase artifacts (RESEARCH.md, PLAN.md, SUMMARY.md)

## Release Process

From CONTRIBUTING.md:
- Branch → PR → Merge (no `develop` branch)
- Use conventional commits: `feat(scope):`, `fix(scope):`, `docs(scope):`
- Tag sparingly: MAJOR for breaking, MINOR for features, batch PATCH for fixes
- Pre-release tags (`-alpha.1`, `-beta.1`) for risky features

## File Naming

- Commands: `commands/gsd/{command-name}.md`
- Agents: `agents/gsd-{agent-name}.md`
- Hooks: `hooks/gsd-{hook-name}.js`
- Templates: `get-shit-done/templates/{name}.md`

## Maintaining This File

Keep CLAUDE.md updated when:
- Adding new commands, agents, or hooks
- Changing the installer's behavior or supported runtimes
- Modifying frontmatter formats or conversion logic
- Adding new directories or changing project structure
- Updating development workflows or build processes

This file is the primary onboarding context for AI assistants working on this codebase.

## Documentation

User-facing documentation lives in `docs/`. Keep docs updated when:
- Adding or modifying commands → update `docs/reference/commands.md`
- Adding or modifying agents → update `docs/reference/agents.md`
- Adding or modifying templates → update `docs/reference/templates.md`
- Changing workflows or concepts → update relevant `docs/concepts/` or `docs/guides/` files

See `docs/README.md` for the full documentation structure.
