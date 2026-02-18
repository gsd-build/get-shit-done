# Technology Stack

**Project:** declare-cc (Declare)
**Researched:** 2026-02-15
**Overall confidence:** MEDIUM (versions verified via npm registry; web search unavailable for ecosystem trend validation)

## Design Philosophy: Zero-Dependency Core, Vendored When Needed

GSD's current architecture is zero-dependency at runtime (only esbuild as devDep). This is a **deliberate strength** for a meta-prompting tool that installs into AI coding assistants' config directories. Declare should preserve this philosophy for its core, but the DAG engine is complex enough to warrant a small, carefully chosen dependency set that gets **bundled via esbuild** into a single distributable file.

**Principle:** Runtime dependencies are bundled (not installed). The published npm package stays zero-dependency. Users never run `npm install` in their `.claude/` directory.

## Recommended Stack

### Runtime & Language

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | >= 18.0.0 | Runtime | LTS baseline. Node 16 (GSD's current minimum) is EOL. Node 18 gives native `fetch`, `structuredClone`, `node:test`, stable ES modules. Node 22+ is current LTS but 18 keeps broad compat. | HIGH |
| JavaScript (CommonJS) | ES2022 | Language | GSD uses CJS throughout for compatibility with Claude Code/OpenCode/Gemini config directories. TypeScript adds build complexity for a tool that lives in `~/.claude/`. Keep CJS source, use JSDoc type annotations for IDE support. | HIGH |
| esbuild | ^0.27.0 | Bundler | Already in GSD. Bundles dependencies into single CJS files. Sub-second builds. | HIGH (verified: 0.27.3 latest) |

**Why not TypeScript:** Declare's files live inside `~/.claude/get-shit-done/` and get executed directly by `node`. Adding a TS compile step means either: (a) shipping compiled JS anyway (then why TS?), or (b) requiring a build on install (fragile). JSDoc + `@ts-check` gives 80% of TS benefits with 0% build overhead.

**Why not ESM:** Claude Code's hook system runs files with `node`. GSD already writes a `{"type":"commonjs"}` package.json to force CJS mode. OpenCode and Gemini also expect CJS. Switching to ESM gains nothing and risks breakage.

### DAG Engine (Critical Decision)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Custom DAG (recommended)** | n/a | Core DAG operations | Declare's DAG is domain-specific (3 layers: declarations/milestones/actions) with integrity/alignment tracking. A general-purpose graph library adds abstraction without matching the domain. The operations needed (topological sort, cycle detection, dependency resolution, critical path) are well-documented algorithms implementable in ~300 lines. | HIGH |
| toposort | ^2.0.2 | Topological sorting utility | If you want a tested toposort rather than hand-rolling: tiny (no deps), stable, does one thing well. Use as internal utility, not as the DAG itself. | MEDIUM (verified: 2.0.2 latest) |

**Alternatives considered and rejected:**

| Library | Version | Why Not |
|---------|---------|---------|
| graphlib | 2.1.8 | Last published 2020. Stable but unmaintained. General-purpose graph that doesn't model Declare's 3-layer hierarchy. Would require wrapping every operation anyway. |
| dagre | 0.8.5 | Layout library (for visualization), not a data structure. Wrong tool. |
| @dagrejs/graphlib | unknown | Fork of graphlib. LOW confidence on maintenance status (could not verify). |

**Recommendation:** Build a `DeclareDag` class that stores nodes (declarations, milestones, actions) and edges (causal dependencies) using adjacency lists. Implement: `addNode`, `addEdge`, `removeNode`, `topologicalSort`, `detectCycles`, `dependenciesOf`, `dependentsOf`, `criticalPath`, `layerOf`. Use `toposort` internally if desired, or implement Kahn's algorithm directly (40 lines).

**Rationale:** The DAG is Declare's core differentiator. Outsourcing it to a general-purpose library means fighting impedance mismatch forever. The algorithms are simple; the domain modeling is the hard part.

### Markdown & Frontmatter Processing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| gray-matter | ^4.0.3 | YAML frontmatter parsing | De facto standard. 40M+ weekly downloads. Handles YAML/JSON/TOML frontmatter. GSD already has hand-rolled frontmatter parsing in gsd-tools.cjs -- gray-matter replaces that with a tested, edge-case-handling library. | HIGH (verified: 4.0.3 latest) |
| yaml | ^2.8.2 | YAML serialization | Modern YAML 1.2 parser/stringifier. Needed for structured config files beyond frontmatter (DAG state, integrity logs). gray-matter uses js-yaml internally but `yaml` (v2) is the modern replacement with better error messages. | HIGH (verified: 2.8.2 latest) |

**Why gray-matter over hand-rolled:** GSD's current frontmatter parsing in gsd-tools.cjs is ~100 lines of regex. It works but breaks on edge cases (multiline values, nested objects, escaped delimiters). gray-matter handles all of these. Since we bundle with esbuild, the dependency is invisible to users.

**Why not remark/unified:** Declare doesn't need to parse/transform markdown ASTs. It reads frontmatter metadata and writes markdown templates. Full AST parsing is overkill.

### State Management & Persistence

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Markdown files + frontmatter** | n/a | Primary state storage | Continuity with GSD. Human-readable, git-diffable, AI-agent-readable. Declare's state lives in `.planning/` as markdown with YAML frontmatter. | HIGH |
| **JSON files** | n/a | Structured config | For machine-only config (DAG adjacency lists, integrity checksums). `.planning/config.json` and `.planning/dag.json`. | HIGH |
| zod | ^4.3.6 | Schema validation | Validates DAG state, config files, frontmatter schemas at runtime. Catches corrupted state before it propagates. TypeScript-first but works perfectly with JSDoc. | MEDIUM (verified: 4.3.6 latest) |

**Why not SQLite/LevelDB:** Declare's data is small (project plans, not analytics). Files are inspectable by humans and AI agents. Git integration means file-based state gets versioned for free. A database adds complexity without benefit at this scale.

**Why zod over ajv:** Zod's API is more ergonomic for defining schemas inline. Ajv is faster but Declare validates config on load (once per session), not in hot paths. Zod v4 has significantly improved performance regardless. Both bundle fine with esbuild.

### Git Integration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Node.js child_process** | built-in | Git operations | GSD's current approach: shell out to `git` directly. Simple, no dependencies, full git CLI access. Declare needs: commit, diff, log, status, branch operations. | HIGH |

**Why not simple-git (3.31.1):** GSD already has working git integration via `child_process.execSync`. simple-git is a wrapper that adds 200KB+ bundled size for a nicer API. The operations Declare needs (commit planning docs, check status, read log) are simple enough that raw `git` commands are clearer. Keep GSD's approach.

**Exception:** If Declare adds complex git operations (e.g., DAG-aware merge conflict resolution), reconsider simple-git at that point.

### CLI Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **No CLI framework** | n/a | Command routing | Declare's commands are invoked via Claude Code slash commands (`/declare:future`, `/declare:align`), not as standalone CLI. The "CLI" is `node gsd-tools.cjs <subcommand> [args]` -- a single entry point with subcommand dispatch. Commander/yargs are designed for user-facing CLIs with help text, flags, and validation. Declare doesn't need that. | HIGH |

**Why not commander (14.0.3):** Declare is a meta-prompting engine, not a user-facing CLI. Commands are dispatched by AI agents reading markdown instructions, not humans typing `--help`. The current pattern (switch on `process.argv[2]`) is sufficient and adds zero overhead.

**Why not citty/cleye:** Same reasoning. These solve a problem Declare doesn't have.

### Testing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| node:test | built-in | Test runner | Built into Node 18+. GSD already uses `node --test`. No dependency needed. Supports describe/it, beforeEach/afterEach, mocking. | HIGH |
| node:assert | built-in | Assertions | Built-in. Strict mode (`assert.strict`) covers all assertion needs. | HIGH |

**Why not vitest/jest:** Adding a test framework dependency for a tool that runs inside `~/.claude/` is unnecessary weight. `node:test` is mature and sufficient.

### Terminal Output & Colors

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **ANSI escape codes** | n/a | Terminal colors | GSD already uses raw ANSI codes (see install.js: `\x1b[36m` for cyan, etc.). 10 lines of constants vs. a dependency. Declare's terminal output goes to AI agent logs, not fancy user interfaces. | HIGH |

**Why not chalk (5.x) / picocolors (1.x):** Declare's output is primarily consumed by AI agents parsing text, not humans admiring colors. Raw ANSI is sufficient and keeps the zero-dependency philosophy.

### Hashing & Integrity

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| node:crypto | built-in | Integrity checksums | SHA-256 hashing for the honor protocol (commitment tracking, drift detection). GSD already uses `crypto.createHash`. | HIGH |

## Supporting Libraries (Bundle via esbuild)

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| gray-matter | ^4.0.3 | Frontmatter CRUD | Parsing/writing declaration files, milestone files, action plans | HIGH |
| yaml | ^2.8.2 | YAML beyond frontmatter | DAG state serialization, config files, structured logs | HIGH |
| zod | ^4.3.6 | Runtime validation | Validating DAG state, config, frontmatter schemas on load | MEDIUM |
| toposort | ^2.0.2 | Topological ordering | DAG scheduling, dependency resolution (optional -- can hand-roll) | MEDIUM |

**Total bundled size estimate:** ~150KB minified (gray-matter ~30KB, yaml ~60KB, zod ~50KB, toposort ~2KB). Acceptable for a tool that loads once per session.

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| TypeScript | Adds build step for files that execute directly in `~/.claude/`. JSDoc + `@ts-check` gives type safety without compilation. |
| ESM | Claude Code/OpenCode/Gemini config dirs expect CJS. GSD writes `{"type":"commonjs"}` for a reason. |
| commander / yargs / citty | Declare is not a user-facing CLI. It's an AI-agent-invoked toolchain. |
| chalk / picocolors | Output is for AI agents. Raw ANSI codes are sufficient. |
| graphlib / dagre | General-purpose graph libraries don't model Declare's 3-layer DAG. Build domain-specific. |
| SQLite / LevelDB | File-based state is human-readable, git-diffable, and AI-inspectable. |
| simple-git | child_process is simpler for the operations needed. |
| jest / vitest | node:test is built-in and sufficient. |
| remark / unified | Don't need markdown AST manipulation. Just frontmatter + templates. |
| React / Ink | This is not a TUI. It's a meta-prompting engine. |

## Installation

```bash
# Production dependencies (bundled via esbuild, not installed by users)
npm install gray-matter@^4.0.3 yaml@^2.8.2 zod@^4.3.6 toposort@^2.0.2

# Dev dependencies
npm install -D esbuild@^0.27.0
```

```javascript
// esbuild.config.js -- bundles everything into single CJS file
require('esbuild').buildSync({
  entryPoints: ['src/declare-tools.js'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/declare-tools.cjs',
  external: [], // Bundle everything
  minify: false, // Keep readable for debugging
});
```

## Migration Path from GSD

| GSD Component | Declare Equivalent | Migration |
|---------------|-------------------|-----------|
| `gsd-tools.cjs` (2000+ lines) | `declare-tools.cjs` (modular) | Split into modules: dag.js, state.js, git.js, frontmatter.js, validation.js. Bundle with esbuild. |
| Hand-rolled frontmatter parsing | gray-matter | Drop-in replacement. Same YAML output. |
| Linear phase numbering (1, 1.1, 2...) | DAG node IDs | Phases become nodes with explicit dependency edges instead of implicit ordering. |
| `STATE.md` flat fields | `STATE.md` + `dag.json` | State.md stays human-readable. dag.json stores adjacency list + metadata. |
| `ROADMAP.md` ordered list | `CONSTELLATION.md` DAG visualization | Declarations at top, milestones in middle, actions at bottom. Topological order. |
| `config.json` | `config.json` + zod schema | Same file, validated on load. |

## Architecture Note

The stack recommendation assumes Declare follows GSD's distribution model: files installed into `~/.claude/get-shit-done/` (or equivalent for other runtimes) via `npx`. If Declare changes to a standalone CLI that users install globally, the "no CLI framework" and "no chalk" recommendations should be revisited.

## Confidence Assessment

| Decision | Confidence | Reason |
|----------|------------|--------|
| Node.js + CJS | HIGH | Proven by GSD, matches runtime constraints |
| Custom DAG over graphlib | HIGH | Domain mismatch is clear from GSD codebase analysis |
| gray-matter + yaml | HIGH | Versions verified via npm, de facto standards |
| zod for validation | MEDIUM | Verified version, but could use simpler validation for a tool this size |
| No CLI framework | HIGH | Architecture analysis confirms AI-agent invocation pattern |
| esbuild bundling | HIGH | Already in GSD, proven approach |
| toposort | MEDIUM | Useful but trivially replaceable with hand-rolled Kahn's algorithm |

## Sources

- npm registry (verified via `npm view`): graphlib 2.1.8, gray-matter 4.0.3, commander 14.0.3, simple-git 3.31.1, yaml 2.8.2, esbuild 0.27.3, zod 4.3.6, toposort 2.0.2, dagre 0.8.5
- GSD source code analysis: `/Users/guilherme/Projects/get-shit-done/bin/install.js`, `/Users/guilherme/Projects/get-shit-done/get-shit-done/bin/gsd-tools.cjs`
- Node.js LTS schedule (training data, MEDIUM confidence): Node 18 LTS, Node 22 current LTS

## Gaps

- **Could not verify** `@dagrejs/graphlib` fork status (WebSearch unavailable). LOW confidence on whether a maintained graphlib alternative exists.
- **Could not verify** current npm weekly download counts or ecosystem trends. Recommendations based on training data knowledge of library popularity.
- **Could not verify** whether newer DAG-specific npm packages have emerged in late 2025/early 2026. The custom DAG recommendation stands regardless, but worth a manual check.
