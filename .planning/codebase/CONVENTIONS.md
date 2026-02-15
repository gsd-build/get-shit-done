# Coding Conventions

**Analysis Date:** 2026-02-05

## Project Nature

GSD is a **meta-prompting system** — primarily markdown documentation (196 .md files) with minimal JavaScript (6 files). Conventions apply to both content authoring and code.

## Naming Patterns

**Files:**
- `kebab-case.md` for all markdown documents (`execute-phase.md`, `gsd-executor.md`)
- `kebab-case.js` for JavaScript files (`gsd-statusline.js`, `install.js`)
- `UPPERCASE.md` for important project files (`README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`)
- No TypeScript — pure JavaScript

**Markdown Documents:**
- Commands: `{command-name}.md` in `commands/gsd/`
- Workflows: `{workflow-name}.md` in `get-shit-done/workflows/`
- Templates: `{template-name}.md` in `get-shit-done/templates/`
- Agents: `gsd-{role}.md` in `agents/`

**Functions (JavaScript):**
- camelCase for all functions (`copyWithPathReplacement`, `readSettings`, `getGlobalDir`)
- No async prefix — async functions use same naming
- Handler pattern: `handleX` not used; imperative names preferred

**Variables:**
- camelCase for variables (`targetDir`, `configPath`, `selectedRuntimes`)
- UPPER_SNAKE_CASE for constants (`HOOKS_DIR`, `DIST_DIR`, `HOOKS_TO_COPY`)
- No underscore prefix for private members

**XML Tags (in Markdown):**
- `kebab-case` for tag names (`<execution_context>`, `<success_criteria>`)
- `snake_case` for `name` attributes (`name="load_project_state"`)
- Semantic containers only — no generic `<section>`, `<item>`, `<content>`

## Code Style

**Formatting:**
- No Prettier configured
- No ESLint configured
- 2-space indentation (observed in JavaScript files)
- Single quotes for strings in JavaScript
- Semicolons required

**JavaScript Patterns:**
- CommonJS modules (`require`/`module.exports`)
- Node.js standard library only (fs, path, os, readline, child_process)
- No external runtime dependencies (devDependencies only: esbuild)

**Markdown Style (from GSD-STYLE.md):**
- XML for semantic structure, Markdown headers for hierarchy within
- Imperative voice: "Execute tasks", "Create file" (not "Tasks are executed")
- No filler words: absent are "Let me", "Just", "Simply", "Basically"
- No sycophancy: absent are "Great!", "Awesome!", "I'd love to help"
- Brevity with substance: "JWT auth with refresh rotation using jose library" (not "Authentication implemented")

## Import Organization

**JavaScript (CommonJS):**
```javascript
// 1. Node.js built-in modules
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { spawn } = require('child_process');

// 2. Local modules (rare)
const pkg = require('../package.json');
```

**No Path Aliases:** Direct relative paths used throughout.

## Error Handling

**JavaScript Patterns:**
- Try/catch with silent failures for non-critical operations
- Graceful degradation preferred over error propagation
- User-facing errors printed to console with color codes

**Examples from `bin/install.js`:**
```javascript
// Silent fail pattern (non-critical)
try {
  return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
} catch (e) {
  return {};  // Graceful default
}

// User-facing error with exit
if (!nextArg || nextArg.startsWith('-')) {
  console.error(`  ${yellow}--config-dir requires a path argument${reset}`);
  process.exit(1);
}
```

**Hooks:**
- Silent fail on all errors — never break statusline or session
- No error output to stderr

## Logging

**Framework:** Console only (no logging library)

**Patterns:**
- ANSI color codes for terminal output
- Color constants defined at top of file:
  ```javascript
  const cyan = '\x1b[36m';
  const green = '\x1b[32m';
  const yellow = '\x1b[33m';
  const dim = '\x1b[2m';
  const reset = '\x1b[0m';
  ```
- Status format: `${green}✓${reset} Action completed`
- Warning format: `${yellow}⚠${reset} Warning message`
- No debug logging

## Comments

**When to Comment:**
- Function purpose via JSDoc-style comments
- Complex logic sections (e.g., color conversion, frontmatter parsing)
- Not for obvious operations

**JSDoc Style:**
```javascript
/**
 * Convert Claude Code frontmatter to opencode format
 * - Converts 'allowed-tools:' array to 'permission:' object
 * @param {string} content - Markdown file content with YAML frontmatter
 * @returns {string} - Content with converted frontmatter
 */
```

**TODO Comments:**
- Format: `// TODO: description` or `// FIXME: description`
- Not heavily used in codebase

## Function Design

**Size:**
- Functions kept reasonably short (< 100 lines typical)
- Helper functions extracted for reuse

**Parameters:**
- Positional for 1-2 parameters
- Named parameters not used (no TypeScript)
- Defaults via `|| 'default'` or `?? 'default'`

**Return Values:**
- Explicit returns
- Early returns for guard clauses
- Functions return meaningful values or void

## Module Design

**Exports:**
- Single-file scripts (no module exports needed)
- `bin/install.js` is entry point via package.json `bin` field

**Structure:**
- Constants at top
- Helper functions in middle
- Main logic at bottom
- Interactive prompts use readline with callback pattern

## Markdown Document Structure

**Slash Commands (`commands/gsd/*.md`):**
```yaml
---
name: gsd:command-name
description: One-line description
argument-hint: "<required>" or "[optional]"
allowed-tools: [Read, Write, Bash, Glob, Grep, AskUserQuestion]
---
```

Section order:
1. `<objective>` — What/why/when
2. `<execution_context>` — @-references to workflows
3. `<context>` — Dynamic content
4. `<process>` or `<step>` elements
5. `<success_criteria>` — Checklist

**Agents (`agents/gsd-*.md`):**
```yaml
---
name: gsd-agent-name
description: Purpose
tools: Read, Write, Edit, Bash, Grep, Glob
color: yellow
---
```

**Character Preservation:**
- Always preserve diacritics: ą, ę, ć, ź, ż, ó, ł, ń, ś (Polish), ü, ö, ä, ß (German), é, è, ê, ç (French)

---

*Convention analysis: 2026-02-05*
*Update when patterns change*
