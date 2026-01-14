# Coding Conventions

**Analysis Date:** 2025-01-14

## Naming Patterns

**Files:**
- kebab-case for all JavaScript files (install.js, config-manager.js, agent-bridge.js)
- kebab-case.md for Markdown documents
- UPPERCASE.md for important project files (README.md)

**Functions:**
- camelCase for all functions
- No special prefix for async functions
- handleEventName for event handlers (though not extensively used)

**Variables:**
- camelCase for variables
- No UPPER_SNAKE_CASE constants found
- No underscore prefix (private members not indicated)

**Types:**
- PascalCase for class names (EditorDetector, ConfigManager, OpenCodeIntegrationTester)
- Not applicable for interfaces/types (no TypeScript detected)

## Code Style

**Formatting:**
- Manual formatting, no automated tools detected
- 2 spaces indentation consistently used
- Single quotes for all string literals
- Semicolons required at end of statements

**Linting:**
- No ESLint configuration found
- No automated linting tools configured
- Code follows manual JavaScript conventions

## Import Organization

**Order:**
1. Node.js built-in modules (fs, path, child_process)
2. External npm packages (commander, chalk, fs-extra)
3. Relative imports (./utils, ../config)
4. No type imports (no TypeScript)

**Grouping:**
- Blank lines between different types of imports
- Alphabetical within each group
- Related imports grouped together

**Path Aliases:**
- No path aliases configured
- Relative imports used throughout

## Error Handling

**Patterns:**
- Console.error for error logging
- Process.exit(1) for fatal errors
- No try/catch blocks found in analyzed code
- Errors handled by throwing and letting process crash

**Error Types:**
- Runtime errors and exceptions
- File system errors (ENOENT, EACCES)
- Process execution errors
- Logging errors to stderr before exit

## Logging

**Framework:**
- Console logging (console.log, console.error)
- No structured logging framework
- Basic output to stdout/stderr

**Patterns:**
- console.log for normal output
- console.error for errors
- Colored output using chalk library
- Simple string formatting

## Comments

**When to Comment:**
- JSDoc style for class/module descriptions
- Inline comments for complex logic
- Sparse commenting overall
- Comments explain code purpose and structure

**JSDoc/TSDoc:**
- Used for class documentation
- Basic descriptions without detailed @param/@returns tags
- Not extensively used throughout codebase

**TODO Comments:**
- Not found in analyzed code
- No standardized TODO format

## Function Design

**Size:**
- Functions vary in size (some very large like install.js)
- No clear size limits enforced
- Complex functions contain multiple responsibilities

**Parameters:**
- Variable parameter counts
- Object destructuring used in some places
- No clear parameter limit guidelines

**Return Values:**
- Explicit returns
- Some functions return objects, others undefined
- Error conditions handled by throwing

## Module Design

**Exports:**
- CommonJS module.exports for classes and functions
- Named exports and default exports mixed
- Some modules export single class, others multiple utilities

**Barrel Files:**
- Not used (no index.js files for directory exports)
- Direct imports from specific files

---

*Convention analysis: 2025-01-14*
*Update when patterns change*