# Coding Conventions

**Analysis Date:** 2026-01-24

## Naming Patterns

**Files:**
- Shell scripts: `gsd-[name].js` or `gsd-[name].sh` (kebab-case with gsd prefix)
- Markdown files: `kebab-case.md` (lowercase with hyphens)
- Subdirectories within commands: `commands/gsd/[name].md` (flat or nested)
- Example: `bin/install.js`, `hooks/gsd-statusline.js`, `scripts/build-hooks.js`

**Functions:**
- camelCase for JavaScript functions
- Examples: `getGlobalDir()`, `expandTilde()`, `buildHookCommand()`, `copyWithPathReplacement()`
- Private/internal functions use underscore prefix sparingly; mostly used in JavaScript

**Variables:**
- JavaScript: camelCase for local variables and parameters
  - Examples: `hasGlobal`, `selectedRuntimes`, `settingsPath`, `configDir`
- Bash: UPPERCASE_UNDERSCORES for environment/exported variables
  - Examples: `HOOKS_DIR`, `DIST_DIR`, `PHASE_ARG`, `MODEL_PROFILE`
- Constants in JavaScript: UPPERCASE_UNDERSCORES
  - Examples: `cyan`, `yellow`, `green` (ANSI color codes)

**Types:**
- Not applicable (no TypeScript in this codebase)
- XML tags in Markdown: kebab-case (semantic tags)
  - Examples: `<execution_context>`, `<core_principle>`, `<step name="load_project_state">`

**Classes/Objects:**
- JSON objects use camelCase for keys where possible
- Error handling follows functional patterns (return objects, throw on critical errors)

## Code Style

**Formatting:**
- No linter or formatter configured (eslint/prettier not in package.json)
- Manual formatting follows Node.js conventions
- 2-space indentation in JavaScript (observed in all files)
- No semicolons at end of lines (rare use observed)

**Linting:**
- No eslint configured
- Code style is enforced through review, not automation

## Import Organization

**Order (JavaScript files):**
1. Built-in Node.js modules (`const fs = require('fs')`)
2. Third-party packages (none in this project)
3. Local/relative imports (very few in this project)

**Path Aliases:**
- No path aliases configured
- Relative requires used: `require('../package.json')`
- Absolute paths used in file operations (cross-platform safety)

**Example from `/Users/trekkie/projects/get-shit-done/bin/install.js`:**
```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Colors (constants)
const cyan = '\x1b[36m';
const green = '\x1b[32m';
```

## Error Handling

**Patterns:**
- Silent failure with try/catch for non-critical operations
  - Example: `try { return JSON.parse(...) } catch (e) { return {} }`
- Explicit errors (console.error + process.exit(1)) for CLI validation failures
  - Example: `console.error(...); process.exit(1);` for invalid flags
- Callback-style error handling for readline operations
- Spawn processes with `stdio: 'ignore'` for background operations
  - Example in update check hook: silent background process, no output capture

**Example from `gsd-statusline.js`:**
```javascript
try {
  const data = JSON.parse(input);
  // ... process
} catch (e) {
  // Silent fail - don't break statusline on parse errors
}
```

**Example from `install.js`:**
```javascript
if (!nextArg || nextArg.startsWith('-')) {
  console.error(`  ${yellow}--config-dir requires a path argument${reset}`);
  process.exit(1);
}
```

## Logging

**Framework:** None - uses `console` directly

**Patterns:**
- `console.log()` for normal output and status messages
- `console.error()` for error conditions
- Color codes for visual hierarchy:
  - `cyan` (\x1b[36m) - primary labels, commands
  - `green` (\x1b[32m) - success (✓), completed operations
  - `yellow` (\x1b[33m) - warnings, prompts (⚠, ⬆)
  - `dim` (\x1b[2m) - secondary text, hints
  - `reset` (\x1b[0m) - color reset
- Verbose with context: error messages include reason and suggestions
  - Example: "Failed to install [component]: [reason]. Try running: [command]"

**No debug logs:** Production code only, no debug mode

## Comments

**When to Comment:**
- Function headers documenting purpose and parameters (JSDoc style)
- Complex logic explaining the "why" not the "what"
- Important edge cases or cross-platform considerations
- Example: explaining Windows UNC path handling, OpenCode config directory resolution

**JSDoc/TSDoc:**
- Used selectively for public functions and complex logic
- Full JSDoc blocks for functions with parameters
- Example from `install.js`:
```javascript
/**
 * Get the global config directory for OpenCode
 * OpenCode follows XDG Base Directory spec and uses ~/.config/opencode/
 * Priority: OPENCODE_CONFIG_DIR > dirname(OPENCODE_CONFIG) > XDG_CONFIG_HOME/opencode > ~/.config/opencode
 */
function getOpencodeGlobalDir() {
  // implementation
}
```

## Function Design

**Size:** Highly variable, functions range from 5-50 lines
- Small utility functions: 5-10 lines (e.g., `expandTilde()`)
- Medium functions: 15-30 lines (e.g., `readSettings()`, `verifyInstalled()`)
- Large procedural functions: 40-100+ lines (e.g., `install()`, `convertClaudeToOpencodeFrontmatter()`)
- Logic split when handling multiple concerns (e.g., separate functions for OpenCode vs Claude Config)

**Parameters:**
- Minimal parameters (1-3 common)
- Optional parameters use defaults: `function(..., optional = null)`
- State passed explicitly (no global state in functions)
- Example: `function install(isGlobal, runtime = 'claude')`

**Return Values:**
- Objects returned for compound results: `{ settingsPath, settings, statuslineCommand, runtime }`
- Null/undefined for missing optional data
- Errors handled with exception or early return
- Void functions when side effects are the goal (file operations, console output)

## Module Design

**Exports:**
- No explicit exports (scripts are executed directly, not imported)
- All functions are internal to their files
- Entry points: `bin/install.js`, `scripts/build-hooks.js`, `hooks/gsd-*.js`

**Barrel Files:**
- Not applicable (no module exports)
- Flat structure: one file = one script

## Markdown Document Conventions

**YAML Frontmatter (Commands):**
- `name: gsd:kebab-case` — command identifier with colon
- `description: One line` — what the command does
- `argument-hint: "[optional] or <required>"` — argument spec
- `agent: gsd-agent-name` — spawned subagent (if applicable)
- `allowed-tools: [list]` — Claude Code tools this command uses

**Example from `/Users/trekkie/projects/get-shit-done/commands/gsd/plan-phase.md`:**
```yaml
---
name: gsd:plan-phase
description: Create detailed execution plan for a phase (PLAN.md) with verification loop
argument-hint: "[phase] [--research] [--skip-research] [--gaps] [--skip-verify]"
agent: gsd-planner
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
---
```

**Semantic XML Tags (Document Structure):**
- `<objective>` — What the document accomplishes
- `<execution_context>` — @-references to required context
- `<context>` — Dynamic/parameterized content
- `<process>` — Container for step-by-step execution
- `<step>` — Individual execution step (attributes: `name` (snake_case), `priority` (optional))
- `<purpose>` — What this workflow accomplishes
- `<when_to_use>` — Decision criteria for using this
- `<required_reading>` — Prerequisite documents
- `<core_principle>` — Key architectural insight
- `<verification>`, `<action>`, `<done>` — Task structure

**Markdown Headers Within XML:**
Used for content organization, not structure:
```markdown
<objective>
## Primary Goal
Build authentication system

## Success Criteria
- Users can log in
</objective>
```

**NOT used:** Generic `<section>`, `<item>`, `<content>` tags

## Language & Tone (Markdown)

**Imperative Voice:**
- "Execute tasks", "Create file", "Read STATE.md"
- Not: "Execution is performed", "The file should be created"

**No Filler:**
- Absent: "Let me", "Just", "Simply", "Basically", "I'd be happy to"
- Present: Direct instructions, technical precision

**No Sycophancy:**
- Absent: "Great!", "Awesome!", "Excellent!", "I'd love to help"
- Present: Factual statements, verification results, direct answers

**Brevity with Substance:**
- One-liners include actionable detail
- Good: "JWT auth with refresh rotation using jose library"
- Bad: "Phase complete" or "Authentication implemented"

## Path Handling (Cross-Platform)

**Rules:**
- Use `path` module for all path operations (not string concatenation)
- `path.join()` for combining paths
- Use forward slashes in cross-platform context strings
- `path.replace(/\\/g, '/')` when forcing Unix-style paths for commands
- Expand `~` with `os.homedir()` explicitly (shell doesn't expand in Node env vars)
- Absolute paths preferred for file operations (no assumptions about cwd)

**Example from `install.js`:**
```javascript
function expandTilde(filePath) {
  if (filePath && filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}
```

## Interactive Input

**Pattern:**
- Use `readline.createInterface()` for prompts
- Track answered state to prevent double-execution on Ctrl+C
- Default selection in brackets: `Choice [1]: `
- Options numbered, color-coded with cyan

**Example:**
```javascript
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let answered = false;
rl.on('close', () => {
  if (!answered) {
    console.log(`\n  ${yellow}Installation cancelled${reset}\n`);
    process.exit(0);
  }
});

rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
  answered = true;
  rl.close();
  const choice = answer.trim() || '1';
  // process choice
});
```

---

*Convention analysis: 2026-01-24*
