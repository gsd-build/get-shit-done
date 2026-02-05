# Coding Conventions

**Analysis Date:** 2026-02-05

## Naming Patterns

**Files:**
- kebab-case for all files: `gsd-statusline.js`, `build-hooks.js`, `install.js`
- XML-based markdown files in `get-shit-done/` use same pattern: `execute-phase.md`, `plan-checker.md`

**Functions:**
- camelCase for function names: `expandTilde()`, `getGlobalDir()`, `processAttribution()`, `buildHookCommand()`
- Prefix helper functions with verb: `readSettings()`, `writeSettings()`, `copyWithPathReplacement()`, `verifyInstalled()`

**Variables:**
- camelCase for runtime variables: `hasGlobal`, `selectedRuntimes`, `explicitConfigDir`, `targetDir`, `pathPrefix`
- CAPS_UNDERSCORE only for command-line argument names or configuration constants: `HOOKS_TO_COPY`, `HOOKS_DIR`, `DIST_DIR`
- Private/internal variables: prefix with underscore if needed (not observed in codebase, camelCase is standard)

**Constants:**
- CAPS_UNDERSCORE for configuration constants: `HOOKS_TO_COPY`, `HOOKS_DIR`, `DIST_DIR`
- colorNameToHex, claudeToOpencodeTools, claudeToGeminiTools — Map object names use camelCase
- Color constants in string form: `cyan`, `green`, `yellow`, `dim`, `reset` (lowercase)

**Types/Classes:**
- XML tags in markdown: kebab-case: `<execution_context>`, `<success_criteria>`, `<checkpoint_types>`
- Type attributes: colon separator: `type="auto"`, `type="checkpoint:human-verify"`
- Step name attributes: snake_case: `name="load_project_state"`, `name="validate_inputs"`

## Code Style

**Formatting:**
- No explicit formatter configured (no .eslintrc, .prettierrc, or eslint.config found)
- Manual formatting conventions observed in source code
- 2-space indentation throughout codebase
- Semicolons present (semicolon style)
- No trailing commas in single-line constructs

**Linting:**
- No automated linting tool configured
- Code follows Node.js conventions implicitly
- Error handling uses try/catch blocks with silent failures on file system operations

**Spacing & Line Length:**
- Functions separated by blank lines
- Comments preserved with `//` syntax
- No strict line length enforcement observed (lines can exceed 100 chars)

## Import Organization

**Node.js Modules:**
```javascript
// Order observed in codebase:
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { spawn } = require('child_process');
```

**Pattern:**
1. Built-in Node.js modules first (fs, path, os, readline, child_process, etc.)
2. No third-party npm dependencies in executable scripts
3. Local imports from package.json (`const pkg = require('../package.json');`)
4. Constants/maps follow imports

**No ES6 imports:** Entire codebase uses CommonJS `require()` syntax exclusively

## Error Handling

**Patterns:**
- Try/catch blocks wrap file system operations and JSON parsing
- Silent failures on non-critical operations:
  ```javascript
  try {
    // operation
  } catch (e) {
    // Silently fail - don't break statusline on parse errors
  }
  ```
- Explicit error messages for critical failures using process.exit(1):
  ```javascript
  if (!fs.existsSync(srcFile)) {
    console.error(`  ${yellow}✗${reset} Failed to install`);
    process.exit(1);
  }
  ```
- Return empty objects/arrays as defaults on parse failure:
  ```javascript
  function readSettings(settingsPath) {
    if (fs.existsSync(settingsPath)) {
      try {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (e) {
        return {};
      }
    }
    return {};
  }
  ```

**Exit Codes:**
- `0` for success
- `1` for errors (validation, installation failure, critical issues)

## Logging

**Framework:** Plain Node.js `console` object

**Patterns:**
- Status messages prefixed with color codes: `${green}✓${reset}`, `${yellow}⚠${reset}`
- Multi-line output uses structured sections with dividers
- Silent failures on non-critical operations (file system, JSON parsing)
- Informational output to stdout, errors to console.error()

**Example:**
```javascript
console.log(`  ${green}✓${reset} Installed commands/gsd`);
console.error(`  ${yellow}✗${reset} Failed to install ${description}`);
```

## Comments

**When to Comment:**
- JSDoc-style comments for functions with complex logic (observed in `bin/install.js`)
- Inline comments only for non-obvious behavior
- Comments explain WHY, not WHAT (code is self-documenting)

**JSDoc/TSDoc:**
- Used for public functions and complex helpers:
  ```javascript
  /**
   * Get the global config directory for OpenCode
   * OpenCode follows XDG Base Directory spec and uses ~/.config/opencode/
   * Priority: OPENCODE_CONFIG_DIR > dirname(OPENCODE_CONFIG) > XDG_CONFIG_HOME/opencode > ~/.config/opencode
   */
  function getOpencodeGlobalDir() {
  ```
- Parameter and return types documented when behavior is non-obvious

## Function Design

**Size:** Functions average 10-40 lines in executable code
- Larger functions (100+ lines) are broken into smaller helper functions
- Complex logic extracted into named helper functions for clarity

**Parameters:**
- Single object parameter for functions with multiple options:
  ```javascript
  copyWithPathReplacement(srcDir, destDir, pathPrefix, runtime)
  ```
- Destructuring for complex objects (not heavily used in this codebase)
- Default parameters for optional values:
  ```javascript
  function getGlobalDir(runtime, explicitDir = null)
  ```

**Return Values:**
- Functions either return result or null/undefined
- Map objects return values directly (e.g., colorNameToHex)
- Callback-driven functions return void (used with readline for interactive prompts)

## Module Design

**Exports:**
- No explicit exports in executable scripts (bin/install.js is CLI)
- Scripts use process.argv for arguments
- Helper functions defined as named functions (not arrow functions)

**Barrel Files:** Not used in this codebase (no index.js re-exports observed)

**Patterns Observed:**
- Self-executing main logic at end of file:
  ```javascript
  if (hasGlobal && hasLocal) {
    console.error(...);
    process.exit(1);
  } else if (selectedRuntimes.length > 0) {
    installAllRuntimes(selectedRuntimes, hasGlobal, false);
  }
  ```

## Special Conventions

**XML Markdown Hybrid:**
- Files in `get-shit-done/` are Markdown with embedded XML tags
- XML tags are semantic containers: `<objective>`, `<execution_context>`, `<process>`
- Markdown used for content hierarchy within XML tags
- @-references for lazy loading: `@~/.claude/get-shit-done/workflows/execute-phase.md`
- No nested XML (use Markdown headers for hierarchy)

**YAML Frontmatter in Commands:**
```yaml
---
name: gsd:command-name
description: One-line description
argument-hint: "<required>" or "[optional]"
allowed-tools: [Read, Write, Bash, Glob, Grep]
---
```
- Used only in `commands/gsd/*.md` files
- Standard metadata for command registration

**Language & Tone (GSD-STYLE.md compliance):**
- Imperative voice: "Execute tasks", "Create file", "Read STATE.md"
- No filler: "Let me", "Just", "Simply", "Basically" are banned
- No sycophancy: "Great!", "Awesome!", "I'd love to help" are banned
- Direct, technical, concise
- Temporal language banned (except in CHANGELOG.md, git commits): "We changed", "Previously", "No longer" are not used

## Cross-Cutting Concerns

**Validation:**
- Input validation at function entry:
  ```javascript
  if (!fs.existsSync(srcDir)) {
    return; // Silent return for missing optional directories
  }
  ```
- Argument validation with process.exit(1) for invalid CLI args

**Configuration:**
- Environment variables checked with null coalescing: `process.env.CLAUDE_CONFIG_DIR || default`
- Settings stored in JSON files (settings.json)
- Path expansion function for ~ home directory: `expandTilde()`

**File Operations:**
- All file I/O uses `fs` (Promises API not used in this codebase)
- Directory creation with recursive flag: `fs.mkdirSync(dir, { recursive: true })`
- File cleanup before copying: `fs.rmSync(destDir, { recursive: true })`

**String Processing:**
- ANSI color codes inline: `\x1b[32m` (green), `\x1b[33m` (yellow)
- Regex for pattern matching: `/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i` for hex color validation
- Safe string replacement with dollar-sign escaping: `replacement.replace(/\$/g, '$$$$')`

---

*Convention analysis: 2026-02-05*
