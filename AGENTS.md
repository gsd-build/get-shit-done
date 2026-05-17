# Repository Guidelines

## Active Discussions

For current work on **Grok Build compatibility** and multi-runtime synchronization across Grok Build, Claude Code, Gemini CLI, and Codex, see:

- `docs/discussions/grok-build-support-2026-05.md`

## Project Structure & Module Organization

This repository ships GSD as a Node.js CLI and SDK. Root package entry points live in `bin/`, scripts in `scripts/`, runtime hooks in `hooks/`, command definitions in `commands/gsd/`, and workflow/template content in `get-shit-done/`. Agent role files are in `agents/`; docs are in `docs/`; logos and terminal images are in `assets/`. Root tests are in `tests/*.test.cjs`. The TypeScript SDK is isolated under `sdk/`, with source and Vitest tests in `sdk/src/`.

## Build, Test, and Development Commands

Use Node.js `>=22`.

- `npm install`: install root dependencies.
- `npm test`: builds the SDK first, then runs root `node:test` suites via `scripts/run-tests.cjs`.
- `npm run test:coverage`: runs root tests with `c8` and enforces 70% line coverage for included CommonJS library files.
- `npm run build:hooks`: rebuilds generated hook artifacts.
- `npm run build:sdk`: installs SDK dependencies and builds TypeScript.
- `cd sdk && npm test`: runs SDK Vitest unit and integration projects.
- `cd sdk && npm run build`: type-checks and emits `sdk/dist/`.

## Coding Style & Naming Conventions

Match the existing style in the edited area. Root JavaScript is CommonJS, generally strict-mode, two-space indentation, semicolons, `const`/`let`, and `node:` imports for built-ins. SDK code is strict TypeScript using ESM/`NodeNext`. Keep command, workflow, and test filenames kebab-case, for example `commands/gsd/plan-phase.md` and `tests/bug-2396-makefile-test-priority.test.cjs`. Agent files use `gsd-*.md`. Avoid unrelated formatting and unnecessary dependencies.

## Testing Guidelines

Root tests use Node’s built-in `node:test` and `node:assert/strict`; do not add Jest, Mocha, or Chai. Prefer helpers from `tests/helpers.cjs` for temporary projects, cleanup, and CLI execution. Name root tests `*.test.cjs`; run one with `node --test tests/name.test.cjs`. SDK tests use Vitest with `*.test.ts` for unit tests and `*.integration.test.ts` for integration tests.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commit prefixes such as `fix:`, `feat:`, and `ci:`, often with issue references: `fix(#2623): resolve parent .planning root...`. Keep commits scoped and descriptive.

Every PR must link an approved or confirmed issue with `Closes #123`, `Fixes #123`, or `Resolves #123`. Use the matching template in `.github/PULL_REQUEST_TEMPLATE/`. Include behavior changes, root cause when relevant, test evidence, affected platforms/runtimes, and update `CHANGELOG.md` or docs for user-facing changes.

## Security & Configuration Tips

Do not commit secrets, local config, or generated worktree artifacts. Before release-facing changes, run the relevant scan scripts in `scripts/`, especially `secret-scan.sh`, `base64-scan.sh`, and `prompt-injection-scan.sh`.
