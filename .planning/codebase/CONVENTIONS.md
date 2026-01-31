# Coding Conventions

**Analysis Date:** 2026-01-31

## Naming Patterns

**Files:**
- Kebab-case for all files: `gsd-statusline.js`, `gsd-check-update.js`, `build-hooks.js`, `execute-phase.md`, `add-phase.md`
- Hooks follow pattern: `gsd-{purpose}.js`
- Commands follow pattern: `gsd-{action}.md`
- Markdown files use kebab-case with descriptive names

**Functions:**
- camelCase for all function names: `getGlobalDir()`, `expandTilde()`, `convertToolName()`, `parseConfigDirArg()`, `readSettings()`
- Descriptive names indicating purpose and return type
- Conversion functions prefixed with `convert`: `convertToolName()`, `convertClaudeToOpencodeFrontmatter()`, `convertClaudeToGeminiAgent()`
- Helper functions follow utility pattern: `buildHookCommand()`, `verifyInstalled()`, `cleanupOrphanedFiles()`

**Variables:**
- camelCase for all variables: `homeDir`, `cwd`, `cacheFile`, `configDir`, `runtimeLabel`, `explicitDir`
- Meaningful names reflecting content or purpose
- Boolean variables often use `has`, `is`, or `should` prefix: `hasGlobal`, `isGlobal`, `shouldInstallStatusline`, `forceStatusline`

**Constants:**
- CAPS_UNDERSCORES for all module-level constants: `HOOKS_DIR`, `DIST_DIR`, `HOOKS_TO_COPY`, `HOME_DIR`
- Object constants for mappings: `colorNameToHex`, `claudeToOpencodeTools`, `claudeToGeminiTools`

**Markdown/XML Elements:**
- XML tags in kebab-case (documented in GSD-STYLE.md): `<objective>`, `<execution_context>`, `<process>`, `<step>`
- Step names in snake_case: `name="load_project_state"`, `name="parse_requirements"`
- YAML frontmatter fields in kebab-case: `allowed-tools:`, `argument-hint:`, `name:`, `description:`

## Code Style

**Formatting:**
- No formatter configured (no .prettierrc, .eslintrc, or biome.json)
- 2-space indentation (observed throughout codebase)
- Consistent spacing around operators and after commas
- Strings use single quotes ('') except in template literals
- Comments use inline `//` style

**Module System:**
- CommonJS `require()` for imports: `const fs = require('fs');`
- No ES modules (`import`/`export`) used
- Functions declared with `function` keyword or `const varName = (params) => {}`
- Module-level functions not explicitly exported (scripts run directly)

**Linting:**
- No linting configuration present
- No ESLint, Prettier, or other formatters configured
- Relies on manual consistency

## Import Organization

**Order (top to bottom):**

1. Node.js built-ins (fs, path, os, readline, child_process, etc.)
2. Local module constants
3. Function declarations
4. Execution code (if script is runnable)

**Example from `bin/install.js`:**
```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Colors (ANSI escape codes)
const cyan = '\x1b[36m';
const blue = '\x1b[34m';
// ... more constants

// Get version from package.json
const pkg = require('../package.json');

// Parse args and runtime selection
const args = process.argv.slice(2);
// ... setup code

// Helper functions
function getDirName(runtime) { ... }
function getOpencodeGlobalDir() { ... }
// ... more functions
```

## Error Handling

**Validation First:**
- Validate arguments and configuration before operations
- Check existence of files/directories before reading or copying
- Return early on validation failure

**Try-Catch Pattern:**
```javascript
function readSettings(settingsPath) {
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      return {};  // Graceful fallback
    }
  }
  return {};
}
```

**Exit on Fatal Error:**
- Use `process.exit(1)` for unrecoverable errors
- Example: Missing required argument in `parseConfigDirArg()` exits immediately

**Collect Failures Pattern:**
- Gather multiple errors and report together at end
- Used in installation when multiple steps may fail independently
- Example: `failures` array collecting failed installations, reported in summary

**User-Facing Error Output:**
- Use `console.error()` with colored output
- Format: `${yellow}✗${reset}` for visual emphasis
- Include context about what failed and why

## Logging

**Framework:** Console (native Node.js)

**Output Methods:**
- `console.log()` — User-facing output, status updates, UI
- `console.error()` — Errors, warnings, failure messages
- `console.warn()` — Build warnings (e.g., missing files)

**Styling with ANSI Color Codes:**
```javascript
const cyan = '\x1b[36m';
const blue = '\x1b[34m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

console.log(`${cyan}Text${reset}`);  // Cyan text
console.log(`${dim}dimmed${reset}`);  // Dimmed (gray) text
```

**Patterns:**

Success indicators:
```javascript
console.log(`  ${green}✓${reset} Installed commands/gsd`);
```

Error indicators:
```javascript
console.error(`  ${yellow}✗${reset} Failed to install ${description}: ${e.message}`);
```

Warnings:
```javascript
console.error(`  ${yellow}⚠${reset} Directory does not exist: ${locationLabel}`);
```

Status messages:
```javascript
console.log(`  Installing for ${cyan}${runtimeLabel}${reset} to ${cyan}${locationLabel}${reset}\n`);
```

**When to Log:**
- Log major operations (install steps, file copies, verification)
- Log user-facing decisions (prompts, configuration)
- Log completion/failure of installation phases
- Don't log every internal operation

## Comments

**JSDoc for Functions:**
```javascript
/**
 * Get the global config directory for a runtime
 * @param {string} runtime - 'claude', 'opencode', or 'gemini'
 * @param {string|null} explicitDir - Explicit directory from --config-dir flag
 */
function getGlobalDir(runtime, explicitDir = null) { ... }
```

Include:
- One-line description
- @param with type and description for each parameter
- @returns with type and description

**Inline Comments:**
- Explain *why* not what
- Example: `// Scale: 80% real usage = 100% displayed` — explains the conversion logic
- Use for complex algorithms or non-obvious logic
- Place above code block being explained

**Special Comments:**
- `// TODO:` or `// FIXME:` for known issues
- `// NOTE:` for important context

## Function Design

**Size Guidelines:**
- Single responsibility: function does one thing
- Typical length: 5-40 lines (shorter preferred)
- Examples: `expandTilde()` is 6 lines, `getDirName()` is 4 lines

**Parameters:**
- Use defaults for optional parameters: `explicitDir = null`, `runtime = 'claude'`
- Validate parameters early in function
- Limit to 3-4 parameters; use objects for more

**Return Values:**
```javascript
// Explicit return values
function getGlobalDir(runtime, explicitDir = null) {
  if (runtime === 'opencode') {
    if (explicitDir) {
      return expandTilde(explicitDir);  // Return early
    }
    return getOpencodeGlobalDir();
  }
  // ...
}

// Null fallback for optional operations
function readSettings(settingsPath) {
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      return {};  // Safe fallback
    }
  }
  return {};
}
```

## Module Design

**Global Constants:**
- Define at module top level after requires
- Organize logically (colors, mappings, configuration)
- Use uppercase names for constants

**Mapping Objects:**
Used for conversions and lookups:
```javascript
const colorNameToHex = {
  cyan: '#00FFFF',
  red: '#FF0000',
  // ...
};

const claudeToOpencodeTools = {
  AskUserQuestion: 'question',
  SlashCommand: 'skill',
  TodoWrite: 'todowrite',
};
```

**Configuration Objects:**
Settings and state are passed as plain objects:
```javascript
// Read settings
const settings = readSettings(settingsPath);

// Modify settings
settings.statusline = statuslineCommand;

// Write back
writeSettings(settingsPath, settings);
```

**Helper Functions:**
Utility functions handle specific tasks:
- File I/O: `readSettings()`, `writeSettings()`, `copyFlattenedCommands()`
- Path handling: `expandTilde()`, `buildHookCommand()`
- Verification: `verifyInstalled()`, `verifyFileInstalled()`
- Conversion: `convertToolName()`, `convertClaudeToOpencodeFrontmatter()`

## Markdown/YAML Conventions

**Frontmatter Structure:**
```yaml
---
name: gsd:command-name
description: One-line description
argument-hint: "<required>" or "[optional]"
allowed-tools: [Read, Write, Bash, Glob]
color: cyan
---
```

**YAML List Format:**
```yaml
allowed-tools:
  - Read
  - Write
  - Bash
```

**Markdown Content:**
- Use markdown headers for section organization
- XML tags for semantic structure (not hierarchy)
- Code blocks with language identifier: ` ```javascript`, ` ```bash`

## GSD-Specific Patterns

From GSD-STYLE.md (enforced conventions):

**Imperative Voice:**
- "Execute tasks", "Create file", "Read STATE.md" (not "The file should be created")

**No Filler Language:**
Avoid: "Let me", "Just", "Simply", "Basically", "I'd be happy to"

**No Sycophancy:**
Avoid: "Great!", "Awesome!", "Excellent!" (use factual statements instead)

**Brevity with Substance:**
- Good: "JWT auth with refresh rotation using jose library"
- Bad: "Authentication implemented"

**Temporal Language Banned in Implementation Docs:**
- Don't use: "We changed X", "Previously", "No longer", "Instead of"
- Exception: CHANGELOG.md, MIGRATION.md, git commits

---

*Convention analysis: 2026-01-31*
