# Coding Conventions

**Analysis Date:** 2026-02-20

## Naming Patterns

**Files:**
- kebab-case for JavaScript files (`gsd-tools.cjs`, `gsd-statusline.js`, `gsd-check-update.js`)
- kebab-case with `.md` extension for commands, agents, workflows (`execute-phase.md`, `gsd-executor.md`)
- Test files: `*.test.cjs` co-located with source (`gsd-tools.test.cjs` alongside `gsd-tools.cjs`)

**Functions:**
- camelCase for all functions (`safeReadFile`, `loadConfig`, `parseJsonc`, `expandTilde`)
- UPPER_CASE for constant objects (`MODEL_PROFILES`, `HOOKS_TO_COPY`)
- Descriptive verb-noun patterns (`generateManifest`, `copyWithPathReplacement`, `verifyInstalled`)

**Variables:**
- camelCase for variables (`configPath`, `targetDir`, `phaseDir`)
- UPPER_CASE for constants (`PATCHES_DIR_NAME`, `MANIFEST_NAME`, `DIST_DIR`)
- Descriptive names preferred (`settingsPath`, `statuslineCommand` over `sp`, `cmd`)

**Types:**
- No TypeScript in codebase - pure JavaScript/CommonJS
- JSDoc comments used for function documentation where present

## Code Style

**Formatting:**
- No Prettier/ESLint configuration detected
- 2-space indentation throughout
- Single quotes for strings
- Semicolons required
- ~80-100 character line length observed

**Module System:**
- CommonJS (`require`/`module.exports`) for Node.js scripts
- `.cjs` extension used for explicit CommonJS in gsd-tools
- `.js` extension for hooks and build scripts
- Package writes `{"type":"commonjs"}` to prevent ESM inheritance issues

## Import Organization

**Order:**
1. Node.js built-ins (`fs`, `path`, `os`, `crypto`, `child_process`)
2. No external dependencies in runtime code (zero dependencies by design)
3. Local requires (`require('../package.json')`)

**Example pattern:**
```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
```

**No Path Aliases:**
- All imports use relative paths or built-in modules
- No path aliases or module resolution configuration

## Error Handling

**Patterns:**
- try/catch for file operations with silent fallback
- Return null/empty object on read failures, not throw
- `process.exit(1)` for CLI errors after printing message
- Graceful degradation - continue with defaults when config missing

**Error Types:**
```javascript
// Silent fallback for missing files
function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// CLI errors exit with message
if (!value) {
  console.error(`  ${yellow}--config-dir requires a path${reset}`);
  process.exit(1);
}
```

**JSON Parsing:**
- Wrap `JSON.parse()` in try/catch
- Return empty object `{}` or array `[]` on parse failure
- Custom JSONC parser for OpenCode compatibility (handles comments/trailing commas)

## Logging

**Framework:**
- `console.log()` for CLI output
- ANSI color codes for terminal styling

**Color Constants:**
```javascript
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';
```

**Patterns:**
- Success: `${green}✓${reset}` prefix
- Warning: `${yellow}⚠${reset}` or `${yellow}i${reset}` prefix
- Status messages with colorized paths/values
- Silent operation for hooks (no console output on success)

## Comments

**When to Comment:**
- Explain why, not what: `// Ensure cache directory exists`
- Document complex algorithms: `// Scale: 80% real usage = 100% displayed`
- Section headers with ASCII art dividers for major blocks

**Section Headers:**
```javascript
// ─── Model Profile Table ─────────────────────────────────────────────────────
// ─── Helpers ──────────────────────────────────────────────────────────────────
```

**JSDoc:**
- Used for public functions with `@param`, `@returns` tags
- Not required for internal helpers

**TODO Comments:**
- Not observed in codebase - issues tracked in GitHub

## Function Design

**Size:**
- Functions typically 10-50 lines
- Large operations split into helper functions
- Main CLI logic can be longer (install function ~500 lines)

**Parameters:**
- Prefer explicit named parameters over options objects
- Default values via `||` or `??` operators
- Boolean flags from CLI parsed early and passed through

**Return Values:**
- Explicit returns, no implicit undefined
- JSON output for CLI tools parsed by callers
- Return early pattern for guard clauses

**Example pattern:**
```javascript
function getGlobalDir(runtime, explicitDir = null) {
  if (runtime === 'opencode') {
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    return getOpencodeGlobalDir();
  }
  // ... more cases
  return path.join(os.homedir(), '.claude');
}
```

## Module Design

**Exports:**
- Single-file scripts (no module exports needed)
- gsd-tools.cjs is a CLI tool invoked via `node`, not imported

**File Structure:**
- Helper functions at top
- Main logic/command routing at bottom
- Constants and lookup tables near top after imports

## Markdown Conventions

**YAML Frontmatter:**
- Required for commands, agents, and workflows
- Fields: `name`, `description`, `tools`/`allowed-tools`, `color` (optional)

**Example command frontmatter:**
```yaml
---
name: gsd:execute-phase
description: Execute all plans in a phase with wave-based parallelization
argument-hint: "<phase-number> [--gaps-only]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - TodoWrite
  - AskUserQuestion
---
```

**XML Tags in Markdown:**
- Used extensively for structured content in agents/commands
- `<objective>`, `<context>`, `<process>`, `<tasks>`, `<step>`, `<role>`
- Self-closing tags not used; always `<tag>...</tag>`

**Section Hierarchy:**
- `#` for document title
- `##` for major sections
- `###` for subsections
- Tables for structured data (options, mappings, comparisons)

## Commit Message Conventions

**Format:**
```
{type}({scope}): {description}

- {detail 1}
- {detail 2}

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Test additions/changes
- `refactor`: Code cleanup
- `chore`: Config, tooling, dependencies

**Scope:**
- Phase number for execution commits: `feat(03-01):`
- Component name for other changes: `docs(readme):`

---

*Convention analysis: 2026-02-20*
