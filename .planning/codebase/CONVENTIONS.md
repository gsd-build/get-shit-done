# Coding Conventions

**Analysis Date:** 2025-01-10

## Naming Patterns

**Files:**
- kebab-case for all files (command-handler.js, user-service.md)
- *.md for Markdown documents
- *.js for JavaScript source files

**Functions:**
- camelCase for all functions
- Examples: parseConfigDirArg, expandTilde, copyWithPathReplacement

**Variables:**
- camelCase for variables
- Examples: hasGlobal, hasLocal, explicitConfigDir

**Types:**
- Not applicable (JavaScript, no TypeScript)

## Code Style

**Formatting:**
- 2 space indentation
- Mixed quotes (single and double quotes used)
- Inconsistent semicolons
- Unix line endings

**Linting:**
- No linting tools configured
- Manual code style enforcement

## Import Organization

**Order:**
- Node.js built-ins first
- Local modules second

**Grouping:**
- Built-ins separated from local imports

**Path Aliases:**
- No path aliases configured

## Error Handling

**Patterns:**
- No structured error handling in installation scripts
- Fail-fast approach with basic error messages

**Error Types:**
- File system errors not caught
- Installation failures result in unhandled exceptions

## Logging

**Framework:**
- Console methods (console.log, console.error)
- No structured logging library

**Patterns:**
- Direct console output for user feedback
- No persistent logging

## Comments

**When to Comment:**
- JSDoc style /** */ for function documentation
- Single-line // for implementation notes

**JSDoc/TSDoc:**
- Basic JSDoc with descriptions
- No parameter or return type documentation

**TODO Comments:**
- Not found in codebase

## Function Design

**Size:**
- Functions kept reasonably small
- Installation logic is the main complexity

**Parameters:**
- Function parameters use descriptive names
- No complex parameter objects

**Return Values:**
- Direct return values
- No Result<T, E> patterns

## Module Design

**Exports:**
- CommonJS exports (module.exports)
- Single export per file

**Barrel Files:**
- Not used

---

*Convention analysis: 2025-01-10*
*Update when patterns change*