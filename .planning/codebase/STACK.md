# Technology Stack

**Analysis Date:** 2025-07-18

## Languages

**Primary:**
- JavaScript (CommonJS) — All runtime code: CLI tools, hooks, installer, test runner
- Markdown — Commands, workflows, agents, templates, references (~254 `.md` files)

**Secondary:**
- YAML (embedded) — GitHub Actions workflows, agent frontmatter, plan/summary frontmatter parsed by custom parser in `get-shit-done/bin/lib/frontmatter.cjs`
- JSON — Configuration (`config.json`), `package.json`, lockfile

**No TypeScript, no ESM.** The entire codebase uses CommonJS (`require`/`module.exports`) with `.cjs` extension for library modules and `.js` for entry points.

## Runtime

**Environment:**
- Node.js >= 16.7.0 (declared in `package.json` `engines` field)
- CI tests against Node 18, 20, 22 on Ubuntu, macOS, and Windows

**Package Manager:**
- npm (lockfileVersion 3)
- Lockfile: `package-lock.json` present (82 packages total including transitive deps)

**Zero production dependencies.** Only Node.js built-in modules are used at runtime:
- `fs`, `path`, `os`, `readline`, `crypto`, `child_process`
- `fetch` (global, available Node 18+; used for Brave Search API)

## Frameworks

**Core:**
- None — Pure Node.js with no framework. The system is a meta-prompting/context-engineering tool, not a web application.

**Testing:**
- Node.js built-in test runner (`node --test`) — Used via `scripts/run-tests.cjs`
- c8 ^11.0.0 — Coverage tool (Istanbul-based, requires Node 20+)

**Build/Dev:**
- esbuild ^0.24.0 — Listed as devDependency but currently only used conceptually; `scripts/build-hooks.js` simply copies hook files to `hooks/dist/` without bundling

## Key Dependencies

**devDependencies only (zero production deps):**
- `c8` ^11.0.0 — Code coverage collection and enforcement (70% line coverage threshold)
- `esbuild` ^0.24.0 — Build tooling (available for future bundling needs)

**Critical built-in modules:**
- `child_process` (`execSync`, `spawn`) — Git operations, npm version checks, background processes
- `fs` — All file I/O for `.planning/` directory management, markdown parsing, config reading
- `crypto` — Used in `bin/install.js` for hash computation during installation

## Configuration

**Project-level configuration:**
- `.planning/config.json` — Per-project GSD settings (model profile, branching strategy, parallelization, workflow toggles)
- Template: `get-shit-done/templates/config.json`
- Created by `config-ensure-section` command in `get-shit-done/bin/lib/config.cjs`

**User-level configuration:**
- `~/.gsd/defaults.json` — Global user defaults merged into project config
- `~/.gsd/brave_api_key` — Brave Search API key file (alternative to env var)

**Runtime host configuration (installed into target projects):**
- `.claude/` directory — Claude Code commands/hooks/agents
- `.opencode/` directory — OpenCode configuration
- `.gemini/` directory — Gemini CLI configuration
- `.codex/` directory — Codex CLI configuration
- `.github/skills/` directory — GitHub Copilot skills

**Environment variables:**
- `BRAVE_API_KEY` — Optional, enables web search functionality
- `NODE_V8_COVERAGE` — Propagated by test runner for c8 coverage collection

**Build configuration:**
- `package.json` `scripts.build:hooks` → `node scripts/build-hooks.js` (copies hooks to `hooks/dist/`)
- `package.json` `scripts.prepublishOnly` → runs `build:hooks` before npm publish
- `package.json` `scripts.test` → `node scripts/run-tests.cjs`
- `package.json` `scripts.test:coverage` → `c8 --check-coverage --lines 70 ...`

## Platform Requirements

**Development:**
- Node.js >= 16.7.0 (18+ recommended for `fetch` support and c8 coverage)
- npm for package management
- Git (required — many operations shell out to `git` via `execSync`)

**Production/Distribution:**
- Published to npm as `get-shit-done-cc`
- Binary entry point: `bin/install.js` (runs as `npx get-shit-done-cc`)
- Cross-platform: macOS, Linux, Windows (CI-validated)
- No native modules, no compilation step needed

**Target AI runtimes (where GSD installs into):**
- Claude Code (primary)
- OpenCode
- Gemini CLI
- Codex CLI
- GitHub Copilot (via `.github/skills/` and `.github/agents/`)

## Architecture Notes for Stack

**Module system:** All library code uses CommonJS (`.cjs`). The CLI router `get-shit-done/bin/gsd-tools.cjs` (588 lines) dispatches to 11 library modules in `get-shit-done/bin/lib/`:
- `core.cjs` (432 lines) — Shared utilities, model profiles, git helpers
- `phase.cjs` (878 lines) — Phase CRUD and lifecycle
- `verify.cjs` (773 lines) — Verification suite
- `init.cjs` (710 lines) — Compound init commands for workflow bootstrapping
- `state.cjs` (680 lines) — STATE.md operations
- `commands.cjs` (548 lines) — Standalone utility commands including web search
- `frontmatter.cjs` (299 lines) — Custom YAML frontmatter parser (no external YAML library)
- `roadmap.cjs` (298 lines) — Roadmap parsing
- `milestone.cjs` (267 lines) — Milestone lifecycle
- `template.cjs` (222 lines) — Template selection and fill
- `config.cjs` (162 lines) — Config CRUD

**Installer:** `bin/install.js` (2376 lines) — Large interactive CLI installer that copies commands, workflows, agents, hooks, and templates into target project directories for multiple AI runtimes.

---

*Stack analysis: 2025-07-18*
