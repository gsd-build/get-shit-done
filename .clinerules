# GSD — Get Shit Done

## What This Project Is
GSD is a structured AI development workflow system. It coordinates AI agents through planning phases, not direct code edits.

## Core Rule: Never Edit Outside a GSD Workflow
Do not make direct repo edits. All changes must go through a GSD workflow:
- `/gsd:plan-phase` → plan the work
- `/gsd:execute-phase` → build it
- `/gsd:verify-work` → verify results

## Architecture
- `get-shit-done/bin/lib/` — Core Node.js library (CommonJS .cjs, no external deps)
- `get-shit-done/workflows/` — Workflow definition files (.md)
- `agents/` — Agent definition files (.md)
- `commands/gsd/` — Slash command definitions (.md)
- `tests/` — Test files (.test.cjs, node:test + node:assert)

## Coding Standards
- **CommonJS only** — use `require()`, never `import`
- **No external dependencies in core** — only Node.js built-ins
- **Test framework** — `node:test` and `node:assert` ONLY, never Jest/Mocha/Chai
- **File extensions** — `.cjs` for all test and lib files

## Safety
- Use `execFileSync` (array args) not `execSync` (string interpolation)
- Validate user-provided paths with `validatePath()` from `get-shit-done/bin/lib/security.cjs`
