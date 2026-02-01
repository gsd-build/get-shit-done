# Coding Conventions

**Analysis Date:** 2026-02-01

## Naming Patterns

**Files:**
- Markdown files: kebab-case (e.g., `execute-phase.md`, `gsd-check-update.js`)
- JavaScript/Node.js files: kebab-case for executable scripts, camelCase for functions
- Command files: `gsd:kebab-case` format with corresponding markdown files like `commands/gsd/execute-phase.md`
- Workflow/template/reference files: kebab-case (e.g., `verify-phase.md`, `summary.md`, `ui-brand.md`)
- Agent files: `gsd-{agent-name}.md` (e.g., `gsd-executor.md`, `gsd-planner.md`)

**Functions/Variables:**
- JavaScript functions: camelCase (e.g., `getDirName()`, `expandTilde()`, `getGlobalDir()`)
- Bash/shell variables: CAPS_UNDERSCORES (e.g., `PLAN_START_TIME`, `COMMIT_PLANNING_DOCS`, `BRANCHING_STRATEGY`)
- Helper functions in scripts: camelCase with brief names

**Types/Classes:**
- Not applicable in primary JavaScript (Node.js scripts)
- XML tag names in markdown: kebab-case (e.g., `<execution_context>`, `<step name="load_plan">`)

**Constants:**
- Environment variables: CAPS_UNDERSCORES (e.g., `OPENCODE_CONFIG_DIR`, `CLAUDE_CONFIG_DIR`)
- CLI argument flags: kebab-case with double-dash prefix (e.g., `--config-dir`, `--global`, `--local`, `--force-statusline`)

## Code Style

**Formatting:**
- No explicit formatter configured (eslint, prettier not present)
- Indentation: 2 spaces (observed in all JavaScript files)
- Line width: Flexible, pragmatic (no strict column limit)
- Semicolons: Present (semicolon-terminated statements)

**Linting:**
- No linting configuration detected in repository
- Code style relies on convention and review practices
- GSD-STYLE.md serves as the authoritative style reference for the system itself

**Language & Tone in Documentation:**
- Imperative voice: "Execute tasks", "Create file", "Read STATE.md"
- No filler words: Avoid "Let me", "Just", "Simply", "Basically", "I'd be happy to"
- No sycophancy: Avoid "Great!", "Awesome!", "Excellent!", "I'd love to help"
- Direct instructions, technical precision, brevity with substance
- Temporal language banned in implementation docs (current state only). Exception: CHANGELOG.md, MIGRATION.md, git commits

## Import Organization

**Order in JavaScript/Node.js:**
```javascript
// 1. Core Node.js modules
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// 2. Package dependencies
// (none in primary install.js)

// 3. Local modules/requires
const pkg = require('../package.json');
```

**Pattern in bin/install.js:**
- All imports at top of file
- Core modules first (fs, path, os, readline)
- Package dependencies next (not present in current codebase)
- Local requires last (package.json)
- No path aliases or custom resolution

## Error Handling

**Patterns observed:**
- Try-catch blocks for critical operations: Used in update check (`try { } catch (e) {}`)
- Graceful degradation on failures: Returns default values when operations fail (e.g., version check defaults to '0.0.0')
- Process.exit(1) for CLI errors: Used when argument validation fails
- Explicit null/undefined checks before operations
- No throw statements in background processes
- Error messages prefixed with color codes (yellow for warnings) when output to console

**Example pattern from gsd-check-update.js:**
```javascript
let installed = '0.0.0';
try {
  if (fs.existsSync(projectVersionFile)) {
    installed = fs.readFileSync(projectVersionFile, 'utf8').trim();
  } else if (fs.existsSync(globalVersionFile)) {
    installed = fs.readFileSync(globalVersionFile, 'utf8').trim();
  }
} catch (e) {}
```

## Logging

**Framework:** Native console object (no logging library)

**Patterns:**
- console.log() for normal output
- console.warn() for warnings and non-fatal issues
- Console output in CLI scripts uses ANSI color codes:
  - `cyan = '\x1b[36m'` for headings/highlights
  - `green = '\x1b[32m'` for success/positive
  - `yellow = '\x1b[33m'` for warnings
  - `dim = '\x1b[2m'` for secondary text
  - `reset = '\x1b[0m'` to clear formatting
- Color codes applied inline to strings, reset after colored text
- Background processes (spawned) use `stdio: 'ignore'` to suppress output

**Example from bin/install.js:**
```javascript
console.log(banner);  // Includes color codes
console.warn(`Warning: ${hook} not found, skipping`);
```

## Comments

**When to Comment:**
- Block comments for complex logic explaining the "why"
- Function-level JSDoc-style comments for public functions in scripts
- Sparse inline comments, relying on clear function names and structure

**Style:**
- Single-line comments: `// Comment`
- Block comments: Multi-line with `/* ... */`
- Comments explain intent, not obvious code
- No commented-out code left in production

**Example from bin/install.js:**
```javascript
// Colors
const cyan = '\x1b[36m';

/**
 * Get the global config directory for a runtime
 * @param {string} runtime - 'claude', 'opencode', or 'gemini'
 * @param {string|null} explicitDir - Explicit directory from --config-dir flag
 */
function getGlobalDir(runtime, explicitDir = null) {
  // Implementation
}
```

## XML Tag Conventions (Markdown Documents)

**Semantic containers only** - XML tags serve semantic purposes. Use Markdown headers for hierarchy within.

**Common tags used in GSD system:**
- `<objective>` — What/why/when a task accomplishes
- `<execution_context>` — @-references to workflows, templates, references
- `<context>` — Dynamic content: $ARGUMENTS, bash output, @file refs
- `<process>` — Container for sequential steps
- `<step>` — Individual execution step with `name` (snake_case) and optional `priority` attributes
- `<purpose>` — What a workflow accomplishes
- `<trigger>` or `<when_to_use>` — Decision criteria for workflow use
- `<required_reading>` — Prerequisite files to read
- `<role>` — Agent role definition
- `<execution_flow>` — Container for execution steps
- `<if mode="...">` — Conditional logic blocks
- `<task type="auto|checkpoint:human-verify|checkpoint:decision">` — Execution units

**Frontmatter format (YAML with dashes):**
```markdown
---
name: gsd:command-name
description: One-line description
argument-hint: "<required>" or "[optional]"
allowed-tools: [Read, Write, Bash, Glob, Grep]
phase: XX-name
plan: YY
---
```

## Summary Frontmatter Format

Every SUMMARY.md includes structured metadata:
```yaml
---
phase: XX-name
plan: YY
subsystem: [category: auth, payments, ui, api, database, infra, testing]
tags: [searchable tech keywords]
requires:
  - phase: [prior phase]
    provides: [what that phase provided]
provides:
  - [what this phase delivered]
affects: [phases that need this context]
tech-stack:
  added: [libraries/tools added]
  patterns: [architectural patterns]
key-files:
  created: [files created]
  modified: [files modified]
key-decisions:
  - "Decision text"
patterns-established:
  - "Pattern: description"
duration: Xmin
completed: YYYY-MM-DD
---
```

## Function Design

**Size:** Functions kept concise, single responsibility (observed in install.js helpers)

**Parameters:**
- Explicit parameters, no excessive defaults
- Boolean flags separated from data parameters
- Runtime-specific logic parameterized (runtime: 'claude' | 'opencode' | 'gemini')

**Return Values:**
- Explicit returns with clear type
- Graceful defaults on error (return null or default value)
- No implicit undefined returns
- Consistent return types (string, boolean, object)

## Module Design

**Exports:**
- Node.js uses CommonJS require/module.exports pattern
- Single responsibility per script file
- Helper functions internally scoped, primary function at end

**Structure in build-hooks.js:**
```javascript
function build() {
  // Main function body
}

build();  // Executed immediately
```

**Entry points:**
- Executable scripts start with shebang: `#!/usr/bin/env node`
- process.argv parsing for CLI arguments
- Color constants defined early for console output

## Bash Conventions (in Markdown documents)

**Variable naming:** CAPS_UNDERSCORES

**Command chaining:**
- `&&` for sequential operations that depend on previous success
- `;` for operations that run regardless of previous result
- Inline variable interpolation: `${VAR_NAME}`
- Grep filters with quoted patterns to prevent shell expansion

**Error handling in bash:**
- Check file existence with `[ -f "$file" ]`
- Use `2>/dev/null` to suppress error output
- Command substitution with `$(command)` for clarity
- Null coalescing with `|| default_value`

**Example pattern from execute-phase workflow:**
```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

## Architecture File Patterns

**@-reference system:**
- Static references (always load): `@~/.claude/get-shit-done/workflows/file.md`
- Conditional references (if exists): `@.planning/DISCOVERY.md (if exists)`
- Project-relative references: `@.planning/STATE.md`

**Placeholder conventions in templates:**
- Square brackets: `[Project Name]`, `[Description]`
- Curly braces: `{phase}-{plan}-PLAN.md`

## Commit Conventions

**Format:** `{type}({scope}): {description}`

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `test` — Tests only (TDD RED)
- `refactor` — Code cleanup (TDD REFACTOR)
- `docs` — Documentation/metadata
- `chore` — Config/dependencies

**Scope:** Typically phase-plan format (e.g., `02-authentication`, `03-01`)

**Execution:**
- One commit per task during execution
- Stage files individually (never `git add .`)
- Include Co-Authored-By line: `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`
- Atomic commits enable reverting individual tasks

## Anti-Patterns to Avoid

**Enterprise Patterns (Banned):**
- Story points, sprint ceremonies, RACI matrices
- Human dev time estimates (days/weeks)
- Team coordination, knowledge transfer docs

**Vague Task Descriptions (Banned):**
- "Add authentication" ✗
- "Implement auth" ✗
- "Fix bugs" ✗
- "Update docs" ✗

**Good task descriptions:**
- "Create login endpoint with JWT using jose library"
- "Add password hashing with bcrypt on registration"
- "Implement protected route middleware"

**Temporal Language (Banned in implementation docs):**
- "We changed X to Y" ✗
- "Previously" ✗
- Exception: CHANGELOG.md, MIGRATION.md, git commits

---

*Convention analysis: 2026-02-01*
