# Coding Conventions

**Analysis Date:** 2025-07-14

## Naming Patterns

**Files:**
- Source modules: `kebab-case.cjs` — e.g., `core.cjs`, `frontmatter.cjs`, `gsd-tools.cjs`
- Test files: `kebab-case.test.cjs` — mirror source file names: `core.test.cjs`, `state.test.cjs`
- Build scripts: `kebab-case.cjs` or `kebab-case.js` — e.g., `run-tests.cjs`, `build-hooks.js`
- Agent definitions: `gsd-{role}.md` — e.g., `gsd-executor.md`, `gsd-planner.md`
- Command definitions: `kebab-case.md` — e.g., `execute-phase.md`, `plan-phase.md`
- Workflow/template files: `kebab-case.md` — e.g., `execute-phase.md`, `discovery-phase.md`
- Template data files: `kebab-case.md` or `kebab-case.json` — e.g., `config.json`, `state.md`
- Hook scripts: `gsd-kebab-case.js` — e.g., `gsd-context-monitor.js`, `gsd-statusline.js`

**Functions:**
- Use `camelCase` for all function names
- Command handler functions: `cmd{Module}{Action}` — e.g., `cmdStateLoad`, `cmdConfigSet`, `cmdPhaseAdd`
- Internal utility functions: `{verb}{Noun}Internal` — e.g., `resolveModelInternal`, `findPhaseInternal`, `generateSlugInternal`
- Helper functions: `{verb}{Noun}` — e.g., `safeReadFile`, `loadConfig`, `escapeRegex`, `comparePhaseNum`
- State helpers: `state{Verb}{Noun}` — e.g., `stateExtractField`, `stateReplaceField`

**Variables:**
- Use `camelCase` for local variables and parameters: `tmpDir`, `phaseDir`, `configPath`
- Use `UPPER_SNAKE_CASE` for module-level constants: `MODEL_PROFILES`, `FRONTMATTER_SCHEMAS`, `WARNING_THRESHOLD`, `TOOLS_PATH`
- Boolean variables use `is`/`has`/`can` prefixes: `isDecimal`, `hasCheckpoints`, `commitsExist`, `phasesArchived`
- Path variables end with `Path` or `Dir`: `statePath`, `roadmapPath`, `phasesDir`, `tmpDir`

**Types:**
- Not applicable — project uses plain JavaScript (CommonJS), no TypeScript

**Module Exports:**
- Use `module.exports = { fn1, fn2, ... }` at the bottom of each file
- Export all public functions as a single object literal
- Internal-only helpers are not exported (they remain file-scoped)

## Code Style

**Formatting:**
- No automated formatter configured (no Prettier, no ESLint)
- Indentation: 2 spaces throughout all `.cjs` and `.js` files
- Semicolons: always used (consistent across codebase)
- String quotes: single quotes for JavaScript strings
- Template literals: used for string interpolation (backticks)
- Trailing commas: used in multi-line objects and arrays
- Max line width: no enforced limit, but lines generally stay under 120 characters
- Blank lines: used to separate logical sections within functions

**Linting:**
- No ESLint or any linter configured
- No `.editorconfig` file
- Code quality enforced through tests and review, not tooling

## Import Organization

**Order:**
1. Node.js built-in modules: `require('fs')`, `require('path')`, `require('child_process')`, `require('os')`
2. Internal project modules: `require('./core.cjs')`, `require('./frontmatter.cjs')`, `require('./state.cjs')`

**Pattern:**
- Destructured imports preferred: `const { loadConfig, output, error } = require('./core.cjs');`
- Full module imports for builtins: `const fs = require('fs');`
- All imports at file top, grouped by origin
- No path aliases — all relative paths

**Module System:**
- CommonJS (`require`/`module.exports`) exclusively — no ESM `import/export`
- File extension: `.cjs` for all source and test files (explicit CommonJS)
- Entry point `gsd-tools.cjs` uses `#!/usr/bin/env node` shebang

## Error Handling

**Patterns:**

1. **Fatal errors via `error()` helper** — terminates process with stderr message:
```javascript
// In get-shit-done/bin/lib/core.cjs
function error(message) {
  process.stderr.write('Error: ' + message + '\n');
  process.exit(1);
}

// Usage in command handlers:
if (!phase) {
  error('phase required for init execute-phase');
}
```

2. **Graceful fallback via try/catch with defaults** — for config loading, file reads:
```javascript
function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}
```

3. **Silent catch blocks** — used for optional operations (empty `catch {}` blocks):
```javascript
try {
  const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
  // process entries...
} catch {}
```

4. **Result objects for soft errors** — instead of throwing, return error in JSON:
```javascript
if (!fs.existsSync(statePath)) {
  output({ error: 'STATE.md not found' }, raw);
  return;
}
```

**Guidelines:**
- Use `error()` for unrecoverable parameter validation failures
- Use `safeReadFile()` when file absence is expected
- Use silent `catch {}` for optional side effects (archive lookups, optional metadata)
- Return `{ error: ... }` in JSON output for operational failures the caller should handle
- Never use `throw` for flow control — process exits or returns error objects

## Output Pattern

**All commands output via the `output()` function:**
```javascript
function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));
  } else {
    const json = JSON.stringify(result, null, 2);
    if (json.length > 50000) {
      const tmpPath = path.join(require('os').tmpdir(), `gsd-${Date.now()}.json`);
      fs.writeFileSync(tmpPath, json, 'utf-8');
      process.stdout.write('@file:' + tmpPath);
    } else {
      process.stdout.write(json);
    }
  }
  process.exit(0);
}
```

- Default: JSON to stdout, then `process.exit(0)`
- With `--raw` flag: raw string value to stdout (for shell script consumption)
- Large payloads (>50KB): written to tmpfile, path emitted with `@file:` prefix
- Errors: always go to stderr via `error()`, then `process.exit(1)`

## Logging

**Framework:** None — raw `process.stdout.write()` and `process.stderr.write()`

**Patterns:**
- No console.log in library code
- `process.stdout.write()` for structured output
- `process.stderr.write()` for error messages
- `console.log()` used only in build scripts (`scripts/build-hooks.js`)

## Comments

**When to Comment:**
- Section dividers: visual separators using Unicode box-drawing characters:
```javascript
// ─── Path helpers ────────────────────────────────────────────────────────────
// ─── Model Profile Table ─────────────────────────────────────────────────────
// ─── State Progression Engine ────────────────────────────────────────────────
```
- Module-level JSDoc for file purpose:
```javascript
/**
 * Core — Shared utilities, constants, and internal helpers
 */
```
- Inline comments for non-obvious logic (regex patterns, phase numbering rules):
```javascript
// No letter sorts before letter: 12 < 12A < 12B
// Segment-by-segment decimal comparison: 12A < 12A.1 < 12A.1.2 < 12A.2
```
- Regression comments reference issue IDs:
```javascript
// Bug: loadConfig previously omitted model_overrides from return value
// Related upstream PRs: #756, #783
```

**JSDoc/TSDoc:**
- Minimal JSDoc usage — only for complex functions or module headers
- No TypeScript types or @param annotations
- Sparse doc comments: only `writeStateMd()` has a full JSDoc explaining its contract

## Function Design

**Size:** Most functions are 20–60 lines. Complex command handlers (`cmdMilestoneComplete`, `cmdValidateHealth`) reach 100–200 lines. No functions exceed ~250 lines.

**Parameters:**
- `cwd` (string) is always the first parameter for functions operating on the filesystem
- `raw` (boolean) is always the last parameter — controls `--raw` output mode
- `options` objects used for multi-parameter commands: `{ phase, name, force }`
- Individual string parameters for simple commands: `cmdStateUpdate(cwd, field, value)`

**Return Values:**
- Command handlers never return values — they call `output()` which exits the process
- Internal utility functions return the computed value or `null` for not-found cases
- Boolean results use `true`/`false`, not truthy/falsy

## Module Design

**Exports:**
- Each library module exports all public functions as a single `module.exports = { ... }` object
- Functions meant only for internal file use are not exported
- Constants like `MODEL_PROFILES`, `FRONTMATTER_SCHEMAS` are exported alongside functions

**Barrel Files:**
- No barrel files — each module is imported directly
- The dispatcher (`gsd-tools.cjs`) imports from all modules individually

**Module Responsibilities:**
- `core.cjs`: Shared utilities, constants, path/git/phase helpers
- `config.cjs`: Config CRUD operations
- `state.cjs`: STATE.md read/write/progression
- `phase.cjs`: Phase CRUD, lifecycle operations
- `commands.cjs`: Standalone utility commands (slug, timestamp, todo, commit, etc.)
- `frontmatter.cjs`: YAML frontmatter parsing/serialization
- `verify.cjs`: Verification suite and health validation
- `milestone.cjs`: Milestone and requirements lifecycle
- `roadmap.cjs`: Roadmap parsing and updates
- `init.cjs`: Compound init commands for workflow bootstrapping
- `template.cjs`: Template selection and fill operations

## Markdown Content Conventions

**Agent files (`agents/*.md`):**
- YAML frontmatter with `name`, `description`, `tools`, `color` fields
- Use XML-like tags for structure: `<role>`, `<project_context>`, `<objective>`
- Consistent section ordering across all agent definitions

**Command files (`commands/gsd/*.md`):**
- YAML frontmatter with `name`, `description`, `argument-hint`, `allowed-tools`
- Use `<objective>`, `<execution_context>`, `<context>` XML tags
- Reference external files via `@~/.claude/get-shit-done/...` paths

**Workflow files (`get-shit-done/workflows/*.md`):**
- Pure markdown with structured sections
- Prescriptive step-by-step instructions for Claude Code to follow

---

*Convention analysis: 2025-07-14*
