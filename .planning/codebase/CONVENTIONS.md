# Coding Conventions

**Analysis Date:** 2026-01-31

## Naming Patterns

**Files:**
- kebab-case for markdown files: `execute-phase.md`, `gsd-codebase-mapper.md`
- kebab-case for JavaScript files: `gsd-check-update.js`, `build-hooks.js`
- UPPERCASE.md for key documents: `GSD-STYLE.md`, `README.md`, `CHANGELOG.md`

**Functions:**
- camelCase for function names: `convertToolName()`, `getGlobalDir()`, `expandTilde()`
- snake_case for step names in XML: `name="load_project_state"`, `name="parse_focus"`
- Descriptive names: `buildHookCommand()`, `cleanupOrphanedFiles()`

**Variables:**
- camelCase for JavaScript variables: `selectedRuntimes`, `explicitConfigDir`, `isOpencode`
- CAPS_UNDERSCORES for bash variables: `PHASE_ARG`, `PLAN_START_TIME`, `MODEL_PROFILE`
- Descriptive names: `runtimeLabel`, `targetDir`, `pathPrefix`

**Types:**
- No TypeScript detected — JavaScript only (CommonJS)

**Commands:**
- Format: `gsd:kebab-case` (e.g., `gsd:new-project`, `gsd:execute-phase`)

**XML Tags:**
- kebab-case for semantic containers: `<execution_context>`, `<success_criteria>`, `<required_reading>`
- Semantic purpose tags only (not generic like `<section>`): `<objective>`, `<process>`, `<step>`

## Code Style

**Formatting:**
- None detected — no ESLint, Prettier, or Biome configuration files found
- Code appears manually formatted with consistent 2-space indentation
- No automatic formatting tool configured

**Linting:**
- None detected — no ESLint configuration found
- No linting rules enforced

**Indentation:**
- 2 spaces for JavaScript files (observed in `bin/install.js`, `hooks/*.js`, `scripts/*.js`)
- Consistent spacing in markdown files

**Line Length:**
- No enforced limit observed
- Long lines present in some files (e.g., `bin/install.js` has lines >100 chars)

## Import Organization

**JavaScript (CommonJS):**
- Uses `require()` statements
- Node.js built-ins first: `const fs = require('fs'); const path = require('path');`
- Local modules after: `const pkg = require('../package.json');`
- No import sorting pattern enforced

**Example from `bin/install.js`:**
```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const pkg = require('../package.json');
```

**Path Aliases:**
- None detected — relative paths used throughout

## Error Handling

**Patterns:**
- Try/catch blocks for file operations: `try { ... } catch (e) {}`
- Silent failures in some cases (e.g., `hooks/gsd-statusline.js` catches parse errors silently)
- Error messages use console.error with color codes: `console.error(\`  ${yellow}✗${reset} Failed...\`)`

**Example from `bin/install.js`:**
```javascript
try {
  return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
} catch (e) {
  return {};
}
```

**Error Messages:**
- Color-coded terminal output using ANSI escape codes
- Format: `${yellow}⚠${reset} Warning message` or `${green}✓${reset} Success message`

## Logging

**Framework:** `console.log`, `console.error` (Node.js built-in)

**Patterns:**
- Color-coded output using ANSI escape codes
- Success: `${green}✓${reset} Message`
- Warning: `${yellow}⚠${reset} Message`
- Error: `${yellow}✗${reset} Message`
- Info: `${cyan}Text${reset}`

**When to Log:**
- Installation progress messages
- Status updates during operations
- Silent failures in hooks (no logging on error)

## Comments

**When to Comment:**
- JSDoc-style comments for functions: `/** ... */`
- Inline comments for complex logic: `// ...`
- Section headers in long files: `// Colors`, `// Helper functions`
- No comment style guide enforced

**JSDoc/TSDoc:**
- JSDoc-style used for function documentation:
```javascript
/**
 * Get the global config directory for a runtime
 * @param {string} runtime - 'claude', 'opencode', or 'gemini'
 * @param {string|null} explicitDir - Explicit directory from --config-dir flag
 */
```

**Comment Style:**
- Single-line: `// Comment`
- Multi-line: `/** ... */` for function docs
- No TSDoc (TypeScript not used)

## Function Design

**Size:**
- Functions vary in length — some are 50+ lines (e.g., `install()` in `bin/install.js`)
- No enforced size limit

**Parameters:**
- Descriptive parameter names: `runtime`, `isGlobal`, `explicitConfigDir`
- Optional parameters handled with defaults: `explicitDir = null`

**Return Values:**
- Objects returned for complex results: `{ settingsPath, settings, statuslineCommand, runtime }`
- Boolean returns for simple checks: `return true;` or `return false;`
- Some functions return nothing (side effects only)

## Module Design

**Exports:**
- CommonJS pattern: No explicit `module.exports` in files examined
- Scripts are executed directly (shebang: `#!/usr/bin/env node`)
- Functions are defined but not exported (scripts, not modules)

**Barrel Files:**
- Not used — each file is standalone

**File Structure:**
- Single-purpose files: `gsd-check-update.js` (update checking), `gsd-statusline.js` (statusline)
- Large orchestration files: `bin/install.js` (1400+ lines, handles installation)

## Markdown Conventions

**YAML Frontmatter:**
- Required for commands and agents
- Format:
```yaml
---
name: gsd:command-name
description: One-line description
allowed-tools: [Read, Write, Bash]
---
```

**XML Tags:**
- Semantic containers: `<objective>`, `<process>`, `<step>`
- Attributes: `name="snake_case"`, `type="checkpoint:human-verify"`
- No generic tags like `<section>` or `<content>`

**Language & Tone:**
- Imperative voice: "Execute tasks", "Create file"
- No filler: Absent "Let me", "Just", "Simply"
- No sycophancy: Absent "Great!", "Awesome!"
- Direct, technical precision

**File References:**
- Use backticks: `` `src/path/file.ts` ``
- Always include actual file paths, not descriptions

## Code Organization

**Directory Structure:**
- `bin/` — executable scripts
- `hooks/` — hook scripts (run by Claude Code/OpenCode/Gemini)
- `scripts/` — build/utility scripts
- `agents/` — agent definitions (markdown)
- `commands/` — command definitions (markdown)
- `get-shit-done/` — workflows, templates, references (markdown)

**Shebang:**
- All executable JavaScript files: `#!/usr/bin/env node`

**File Extensions:**
- `.js` for JavaScript
- `.md` for markdown documentation
- `.json` for configuration

## Git Conventions

**Commit Format:**
```
{type}({phase}-{plan}): {description}
```

**Commit Types:**
- `feat` — New feature
- `fix` — Bug fix
- `test` — Tests only (TDD RED)
- `refactor` — Code cleanup (TDD REFACTOR)
- `docs` — Documentation/metadata
- `chore` — Config/dependencies

**Rules:**
- One commit per task during execution
- Stage files individually (never `git add .`)
- Include Co-Authored-By line for AI contributions

---
*Convention analysis: 2026-01-31*
