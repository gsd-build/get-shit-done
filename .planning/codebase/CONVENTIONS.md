# Coding Conventions

**Analysis Date:** 2026-02-06

## Naming Patterns

**Files:**
- PascalCase for tool/module files: `search.ts`, `decisions.ts`, `patterns.ts`
- UPPERCASE for config files: `YAML` filenames when referenced
- Descriptive names reflecting functionality: `gsd-memory`, `extractors`, `tools`
- Test files follow source names with `.test.ts` suffix: `search.test.ts` mirrors `search.ts`

**Functions:**
- camelCase for all function names: `findDecisions()`, `extractFrontmatter()`, `enrichResult()`
- Verb-first pattern for action functions: `search()`, `register()`, `extractSummary()`
- Helpers prefixed with verb: `extractRequires()`, `extractTechStack()`, `formatCompleted()`
- Private functions remain camelCase: `enrichResult()`, `getDocumentType()`, `extractPhase()`

**Variables:**
- camelCase for all variable names: `allResults`, `searchResults`, `projectName`
- Descriptive names reflecting purpose: `planningPath`, `qmdCollection`, `documentCount`
- Array variables often plural: `projects`, `results`, `summaryFiles`, `allPatterns`
- Constants in camelCase (not UPPER_CASE): `limit`, `projectName`

**Types and Interfaces:**
- PascalCase for all interface names: `SearchResult`, `DecisionResult`, `SummaryData`
- Suffixes indicate purpose: `Options` for function params, `Result` for return values, `Data` for structured data
- Example interfaces: `SearchOptions`, `RegisterOptions`, `DecisionOptions`, `TechStackEntry`, `ResearchData`

## Code Style

**Formatting:**
- 2-space indentation (inferred from tsconfig and code structure)
- No explicit linter config found; relies on TypeScript strict mode
- Single quotes in code, template literals for interpolation
- Consistent spacing around operators and after keywords

**TypeScript Configuration:**
- Target: ES2022
- Strict mode enabled: `"strict": true`
- ESM imports with `.js` extensions: `import { search } from './tools/search.js'`
- Module resolution: NodeNext for native ESM support
- Declaration files generated: `declaration: true`

**Null Handling:**
- Defensive programming: Check for existence with `existsSync()` before reading
- Optional chaining for possibly-undefined values: `d.rationale?.toLowerCase()`
- Empty returns on missing data: `return []` instead of null
- Type casting used when needed: `args?.query as string`

## Import Organization

**Order:**
1. Standard library imports: `import { readFileSync } from 'fs'`
2. Third-party packages: `import { Server } from '@modelcontextprotocol/sdk/server/index.js'`
3. Local module imports: `import { search } from './tools/search.js'`
4. Type-only imports when needed: `import type { SearchResult }`

**Path Aliases:**
- No path aliases configured; uses relative paths throughout
- Consistent relative pathing from module to imports: `'../registry.js'`, `'../../src/tools/search.js'`
- Always includes `.js` extension for ESM compatibility

**Export Style:**
- Named exports preferred: `export function search()`, `export interface SearchResult`
- Interfaces exported alongside implementations
- Consistent function-first, types-second order
- Index files for barrel exports: `src/extractors/index.ts`

## Error Handling

**Patterns:**
- Silent try-catch for file operations: `try { ... } catch { return [] }`
- Graceful fallbacks: QMD search falls back to grep if not available
- Return empty collections on error: `return []`, `return {}`, `return decisions`
- Error objects normalized: `error instanceof Error ? error.message : String(error)`

**Specific Strategies:**
- File read failures caught and skipped silently in directory traversal
- Registry parse errors return empty object/array rather than throwing
- QMD unavailability returns `{ success: false, reason: 'qmd_not_available' }`
- No explicit error throwing in tool functions; instead return error properties

**Error Information:**
- User-facing errors include path: `Path does not exist: ${options.path}`
- Detailed context in result objects: `{ success: false, error: "message", data?: unknown }`
- Reason codes for programmatic handling: `'qmd_not_available'`, `'create_failed'`, `'index_failed'`

## Logging

**Framework:** console (minimal)

**Patterns:**
- Only two console calls in entire src: `console.error()` for startup messages
- Server startup: `console.error('GSD Memory MCP server started')`
- Fatal errors logged to stderr: `console.error('Fatal error:', error)`
- No debug logging in production code
- Tests may add logging but production code is silent

**Philosophy:**
- Operate silently when successful
- Only log to stderr for startup/shutdown and fatal errors
- Return structured result objects instead of logging state

## Comments

**When to Comment:**
- Function-level JSDoc for public APIs (tools, extractors)
- Complex regex patterns: `const tableRows = section.match(/\|[^|]+\|[^|]+\|/g);` would benefit from comment
- Non-obvious logic like phase extraction from path patterns
- Business logic explaining why decisions are made

**JSDoc/TSDoc:**
- Consistent use above public functions
- Describe what function does, not how: `// Search across all registered GSD projects`
- Document parameters with `@param` and returns with `@returns` when complexity warrants
- Example from code: `/** Extract YAML frontmatter from markdown content */`

**Inline Comments:**
- Brief explanations after code: `// Skip header and separator rows`
- Used sparingly; code is self-documenting
- Mark intentional gaps: `// Return empty if directory can't be read`

## Function Design

**Size:**
- Most functions 20-60 lines
- Utility functions like `enrichResult()`, `getDocumentType()` are 5-20 lines
- Complex extractors (research, project) reach 100-150 lines but broken into helpers
- No single function exceeds 170 lines

**Parameters:**
- Options object pattern for multiple params: `search(options: SearchOptions)`
- Interfaces for options standardize function signatures
- Optional params in interfaces marked with `?`: `query?: string`, `project?: string`
- Required params separated from optional in interface definitions

**Return Values:**
- Promise-based for async work: `async function findDecisions(...): Promise<DecisionResult[]>`
- Structured result objects with success flag: `{ success: boolean, error?: string, data?: unknown }`
- Array results for collections: `DecisionResult[]`, `PatternResult[]`
- Empty array on no results: `return []` (not null)

**Control Flow:**
- Early returns for validation: Check existence before processing
- Filter patterns for optional features: `options.project ? filter : all`
- Slice for limits: `return results.slice(0, limit)`
- Array methods favored: `.map()`, `.filter()`, `.find()`, `.some()`

## Module Design

**Exports:**
- Tool modules export main function: `export function search()`, `export async function findDecisions()`
- Extractor modules export both data interface and extraction function
- Registry exports utilities: `registerProject()`, `getAllProjects()`, `updateProjectIndexTime()`
- Index file re-exports for entry point

**Barrel Files:**
- `src/extractors/index.ts` lists all exported functions for convenient importing
- Tools directory has no barrel file; imports are direct
- Main entry point `src/index.ts` defines MCP tools array and request handlers

**Module Coupling:**
- Tools depend on extractors and registry: `src/tools/*.ts` imports from `../extractors/*.ts`
- Extractors depend on frontmatter parser only
- Registry is standalone file system module
- QMD is standalone wrapper with no dependencies on other modules

## Type System

**Interface Design:**
- Frontmatter-sourced data interfaces: `SummaryData`, `ResearchData`, `ProjectData`
- Tool input/output interfaces: `SearchOptions`, `SearchResult`, `DecisionResult`
- Infrastructure interfaces: `RegisteredProject`, `Registry`, `QmdStatus`
- Minimal inheritance; composition through included interfaces

**Generic Usage:**
- No extensive generic types
- `Record<string, unknown>` for flexible object typing during frontmatter parsing
- `unknown` type for untyped JSON data from frontmatter

---

*Convention analysis: 2026-02-06*
