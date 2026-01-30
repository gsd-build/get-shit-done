# Repository Guidelines

## Project Structure & Module Organization
- `bin/` contains the CLI entry point (`bin/install.js`) used by the published npm package.
- `commands/gsd/` defines slash commands (thin wrappers around workflows).
- `get-shit-done/` holds core content: `workflows/`, `templates/`, and `references/`.
- `agents/` contains subagent prompts.
- `hooks/` contains runtime hooks; build output goes to `hooks/dist/`.
- `scripts/` contains build utilities; `assets/` stores images and media.
- Project docs live at the root (`README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `GSD-STYLE.md`).

## Build, Test, and Development Commands
- `npm run build:hooks` — copies hook scripts into `hooks/dist/` (used before publish).
- `node bin/install.js --claude --local` — installs the CLI into the local project (`./.claude/`) for testing changes.
- `npx get-shit-done-cc` — runs the installed CLI.
- `npm test` — mentioned in CONTRIBUTING, but no test script exists yet; add one when introducing tests.

## Coding Style & Naming Conventions
- JavaScript uses CommonJS and 2-space indentation (see `bin/install.js`).
- Follow `GSD-STYLE.md`: imperative voice, concise phrasing, no filler, no sycophancy.
- Naming conventions:
  - Files: kebab-case (e.g., `execute-phase.md`).
  - Commands: `gsd:kebab-case`.
  - XML tags: kebab-case; step names: snake_case.
  - Bash variables: `CAPS_UNDERSCORES`.
- Avoid temporal language in implementation docs (allowed in `CHANGELOG.md`, migrations, and commits).

## Testing Guidelines
- There is no automated test suite or test file pattern in this repo today.
- If adding tests, add a `package.json` script (e.g., `test`) and document the command in `CONTRIBUTING.md`.

## Commit & Pull Request Guidelines
- Use conventional commits: `type(scope): description` (types: feat, fix, docs, refactor, chore, revert).
- Branch names: `feat/…`, `fix/…`, `docs/…`, `refactor/…`, `hotfix/…`.
- PRs are required for `main`; include a brief What/Why/Testing/Breaking Changes section and update `CHANGELOG.md` for user-facing changes.
- Ensure Windows path behavior is considered before merging.
