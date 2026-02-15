# Get Shit Done (GSD)

Get Shit Done is a planning-first workflow system for AI coding agents. This repository packages the core GSD engine, workflow templates, runtime command surfaces, and a Codex prompt layer.

## What Is In This Repository

- `commands/gsd/`: command source files used by runtime installers
- `get-shit-done/bin/gsd-tools.js`: core CLI utilities and state/workflow helpers
- `get-shit-done/workflows/`: end-to-end command workflows
- `get-shit-done/templates/`: planning and state templates
- `get-shit-done/references/`: supporting reference docs
- `agents/`: role-specific agent instruction files
- `hooks/` and `scripts/build-hooks.js`: hook sources and build pipeline
- `.codex/prompts/` and `.codex/skills/`: Codex-native prompt and skill layer

## Install

Prerequisite: Node.js `>=16.7.0`.

```bash
npx @ahmed118glitch/get-shit-done-codex@latest --path .
```

Common examples:

```bash
# Install Codex files into the current project directory
npx @ahmed118glitch/get-shit-done-codex@latest --path .

# Install into an explicit target folder:
npx @ahmed118glitch/get-shit-done-codex@latest --path /path/to/project

# Install shared copy under your home directory as well:
npx @ahmed118glitch/get-shit-done-codex@latest --global

# Run the runtime installer from this scoped package (examples):
npx --yes --package=@ahmed118glitch/get-shit-done-codex@latest get-shit-done-cc --all --global
npx --yes --package=@ahmed118glitch/get-shit-done-codex@latest get-shit-done-cc --claude --local
```

Global install writes prompts to `~/.codex/prompts` (not nested).

## Verify Install

```bash
# Project prompts
ls ./.codex/prompts/gsd-*.md

# Global prompts (if you used --global)
ls ~/.codex/prompts/gsd-*.md
```

## Runtime Command Surface

- Claude Code and Gemini CLI use `/gsd:<command>` (example: `/gsd:help`)
- OpenCode uses `/gsd-<command>` (example: `/gsd-help`)
- Codex prompt files are in `.codex/prompts/gsd-*.md`

## Quick Workflow

Use the command surface above (`/gsd:<command>`, `/gsd-<command>`, or Codex `gsd-*` prompts).

1. Start a project with `new-project`
2. Plan a phase with `plan-phase`
3. Execute the phase with `execute-phase`
4. Verify with `verify-work`
5. Repeat per phase or milestone

Installed commands create and update planning artifacts under `.planning/` (for example: `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`).

## Source Paths vs Installed Paths

Repository source paths:

- `commands/gsd/*`
- `get-shit-done/workflows/*`
- `get-shit-done/templates/*`

Installed runtime targets:

- Claude global: `~/.claude`
- OpenCode global: `~/.config/opencode` (or platform XDG equivalent)
- Gemini global: `~/.gemini`
- Codex global prompts/skills: `~/.codex/prompts`, `~/.codex/skills`
- Local mode: runtime folders in the current project

## Development

```bash
npm test
npm run build:hooks
```

Keep command and workflow behavior aligned across `commands/gsd/` and `get-shit-done/workflows/` when making changes.

## Security

Report vulnerabilities privately via `SECURITY.md`.

## License

MIT (`LICENSE`).
