# CLAUDE.md

> Context file for Claude Code working on this repository.

## Project Overview

**Get Shit Done (GSD)** is a meta-prompting, context engineering, and spec-driven development system for Claude Code and OpenCode. It solves context rot—the quality degradation that happens as Claude fills its context window.

- **Package:** `get-shit-done-cc` on npm
- **Version:** See `package.json`
- **Author:** TÂCHES
- **License:** MIT

## Architecture

GSD is a **slash command framework** that extends Claude Code/OpenCode with structured workflows. Every file is both implementation and specification—files teach Claude how to build software systematically.

### Core Directories

```
get-shit-done/
├── commands/           # Slash commands (gsd/*.md, video/*.md)
│   ├── gsd/            # Main GSD commands
│   └── video/          # Video workflow commands
├── agents/             # Subagent prompt definitions
├── get-shit-done/      # Core system
│   ├── workflows/      # Detailed process logic
│   ├── templates/      # Output structure templates
│   └── references/     # Deep-dive documentation
├── hooks/              # Claude Code hooks (statusline, update check)
├── bin/                # CLI installer (install.js)
├── scripts/            # Build scripts
└── assets/             # Terminal SVG, images
```

### File Hierarchy

1. **Command** → High-level objective, delegates to workflow
2. **Workflow** → Detailed process, references templates/references
3. **Template** → Concrete structure with placeholders
4. **Reference** → Deep dive on specific concept

## Key Conventions

### XML Tag Conventions

- Use semantic containers only (`<objective>`, `<action>`, `<verify>`)
- Never use generic tags (`<section>`, `<item>`, `<content>`)
- Use Markdown headers for hierarchy within XML

### Task Structure

```xml
<task type="auto">
  <name>Task N: Action-oriented name</name>
  <files>src/path/file.ts</files>
  <action>What to do and WHY</action>
  <verify>Command to prove completion</verify>
  <done>Measurable acceptance criteria</done>
</task>
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `execute-phase.md` |
| Commands | `gsd:kebab-case` | `gsd:execute-phase` |
| XML tags | kebab-case | `<execution_context>` |
| Step names | snake_case | `name="load_project_state"` |
| Bash variables | CAPS_UNDERSCORES | `PHASE_ARG` |

### Command File Structure

```yaml
---
name: gsd:command-name
description: One-line description
argument-hint: "<required>" or "[optional]"
allowed-tools: [Read, Write, Bash, Glob, Grep, AskUserQuestion]
---
```

Sections in order:
1. `<objective>` — What/why/when
2. `<execution_context>` — @-references to workflows
3. `<context>` — Dynamic content
4. `<process>` or `<step>` — Implementation
5. `<success_criteria>` — Measurable checklist

## Language & Tone

- **Imperative voice:** "Execute tasks", "Create file" (not "Execution is performed")
- **No filler:** Avoid "Let me", "Just", "Simply", "Basically"
- **No sycophancy:** Avoid "Great!", "Awesome!", "I'd love to help"
- **Brevity with substance:** "JWT auth with refresh rotation" not "Authentication implemented"

## Anti-Patterns to Avoid

### Banned Enterprise Patterns

- Story points, sprint ceremonies, RACI matrices
- Human dev time estimates (days/weeks)
- Team coordination, knowledge transfer docs
- Change management processes

### Banned Temporal Language (in implementation docs)

- "We changed X to Y", "Previously", "No longer"
- Exception: CHANGELOG.md, git commits

### Banned Generic XML

- `<section>`, `<item>`, `<content>`
- Use semantic tags instead

## Development Workflow

### Local Development

```bash
git clone https://github.com/glittercowboy/get-shit-done.git
cd get-shit-done
npm install
node bin/install.js --claude --local  # Install locally for testing
```

### Build Hooks

```bash
npm run build:hooks  # Builds hooks/dist/
```

### Testing Installation

```bash
npx get-shit-done-cc          # Interactive install
npx get-shit-done-cc --claude --local   # Non-interactive local
npx get-shit-done-cc --claude --global  # Non-interactive global
```

## Commit Conventions

Format: `{type}({scope}): {description}`

| Type | Use |
|------|-----|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `refactor` | Code change without behavior change |
| `chore` | Maintenance, dependencies |
| `revert` | Undoing previous commit |

Example: `feat(checkpoints): add rollback capability`

## Branch Strategy

- `main` — Production, always installable
- `feat/x`, `fix/x`, `docs/x` — Feature branches
- No `develop` branch, no release branches

## Release Process

```bash
npm version patch|minor|major
git push origin main --tags
npm publish
```

GitHub Actions automatically creates GitHub Releases from tags.

## Important Files

- `GSD-STYLE.md` — Comprehensive style guide
- `CONTRIBUTING.md` — Contribution guidelines
- `MAINTAINERS.md` — Release workflows
- `CHANGELOG.md` — Version history (Keep a Changelog format)

## Context Engineering Principles

- **Plans:** 2-3 tasks maximum per plan
- **Quality curve:** 0-30% context = peak, 70%+ = poor
- **Split triggers:** >3 tasks, multiple subsystems, >5 files per task
- Use subagents for autonomous work; reserve main context for user interaction

## Quick Reference: Common Commands

| Command | Purpose |
|---------|---------|
| `/gsd:new-project` | Initialize new project |
| `/gsd:plan-phase N` | Research + plan phase |
| `/gsd:execute-phase N` | Execute plans |
| `/gsd:quick` | Ad-hoc task with GSD guarantees |
| `/gsd:progress` | Current status |
| `/gsd:help` | Show all commands |
