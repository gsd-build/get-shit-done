# Testing Patterns

**Analysis Date:** 2026-02-06

## Test Framework

**Runner:**
- Vitest 1.0.0
- Config: `gsd-memory/vitest.config.ts`

**Assertion Library:**
- Vitest built-in assertions via `expect()`

**Run Commands:**
```bash
npm run test              # Run all unit tests (non-integration)
npm run test:watch       # Watch mode for development
npm run test:integration # Run integration tests only
```

**Test Files Location:**
- Unit tests: `gsd-memory/tests/**/*.test.ts`
- Integration tests excluded from default runs: `vitest.config.ts` uses `exclude: ['tests/integration/**']`
- Integration tests run separately: `vitest.integration.config.ts` uses `include: ['tests/integration/**/*.test.ts']`

## Test File Organization

**Location:**
- Co-located with fixtures: All test files in `gsd-memory/tests/` subdirectory matching source structure
- Fixture directory: `gsd-memory/tests/fixtures/` for sample data files

**Naming:**
- Suffix pattern: `.test.ts` for unit tests
- Mirror source structure: `src/tools/search.ts` → `tests/tools/search.test.ts`
- Shared setup: `tests/setup.ts` provides fixture utilities

**Structure:**
```
gsd-memory/
├── tests/
│   ├── fixtures/           # Test data and mock files
│   ├── setup.ts            # Test utilities (readFixture, getMockPlanningPath)
│   ├── tools/              # Tool tests
│   │   ├── search.test.ts
│   │   ├── decisions.test.ts
│   │   └── ...
│   ├── extractors/         # Extractor tests
│   │   ├── frontmatter.test.ts
│   │   ├── summary.test.ts
│   │   └── ...
│   ├── integration/        # Integration tests
│   │   ├── mcp-server.test.ts
│   │   ├── end-to-end.test.ts
│   │   └── qmd-wrapper.test.ts
│   └── qmd-wrapper.test.ts # Functional QMD tests
```

## Test Structure

**Suite Organization:**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { search } from '../../src/tools/search.js';

describe('search tool', () => {
  beforeEach(() => {
    // Setup per test
    vi.spyOn(registry, 'getAllProjects').mockReturnValue([...]);
  });

  afterEach(() => {
    // Cleanup per test
    vi.restoreAllMocks();
  });

  it('returns enriched results with GSD context', async () => {
    const results = await search({ query: 'test' });
    expect(Array.isArray(results)).toBe(true);
  });
});
```

**Patterns:**

**Setup Pattern:**
- `beforeEach()` creates fresh state for each test
- Mocking registry to inject test fixtures: `vi.spyOn(registry, 'getAllProjects').mockReturnValue([...])`
- Temp directories created for file system tests: `fs.mkdirSync(testDir, { recursive: true })`

**Teardown Pattern:**
- `afterEach()` restores all mocks: `vi.restoreAllMocks()`
- Cleanup temp files: `if (fs.existsSync(testDir)) { fs.rmSync(testDir, { recursive: true }); }`
- Restores bound functions to original: `qmd.isAvailable = originalIsAvailable`

**Assertion Pattern:**
- Straightforward expectations: `expect(results).toEqual([])`, `expect(results.length).toBeLessThanOrEqual(2)`
- Property checks for complex objects: `expect(results[0]).toHaveProperty('content')`
- Type checks: `expect(typeof available).toBe('boolean')`
- Conditional assertions for optional data: `if (results.length > 0) { expect(results[0]).toHaveProperty(...) }`

## Mocking

**Framework:** Vitest's built-in `vi` module

**Patterns:**

```typescript
// Mock function return value
vi.spyOn(registry, 'getAllProjects').mockReturnValue([
  {
    name: 'test-project',
    path: '/path/to/project',
    registeredAt: new Date().toISOString()
  }
]);

// Mock async function
vi.spyOn(qmd, 'isAvailable').mockResolvedValue(false);

// Restore all mocks after test
afterEach(() => {
  vi.restoreAllMocks();
});
```

**What to Mock:**
- External dependencies: Registry reads, file system checks, QMD availability
- Functions with side effects: File I/O, process execution
- System calls: `which qmd`, `execSync` commands
- Date-dependent values: Use fixed dates in test setup

**What NOT to Mock:**
- Core business logic like extractors: Test them with real data
- Pure functions: Allow them to execute naturally
- String parsing and transformation: Verify with actual content
- Data structure transformations: Exercise the real code path

**Fixture Usage:**
```typescript
import { readFixture, getMockPlanningPath } from '../setup.js';

// Read sample data
const summary = readFixture('sample-summary.md');
const result = extractFrontmatter(summary);

// Use mock project path
const mockPath = getMockPlanningPath();
```

## Fixtures and Factories

**Test Data:**

Located in `gsd-memory/tests/fixtures/`:
- `sample-summary.md` - Complete SUMMARY.md with frontmatter and content
- `sample-research.md` - RESEARCH.md with domain-specific content
- `sample-project.md` - PROJECT.md with decisions table
- `mock-planning/` - Complete mock project directory with `.planning` structure

**Pattern from Code:**
```typescript
// Frontmatter extractor test with real SUMMARY data
it('extracts from real SUMMARY.md fixture', () => {
  const summary = readFixture('sample-summary.md');
  const result = extractFrontmatter(summary);

  expect(result.phase).toBe('01-foundation');
  expect(result['key-decisions']).toBeDefined();
});

// File system test with temp directory
beforeEach(() => {
  testDir = path.join(os.tmpdir(), `gsd-qmd-test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });

  fs.writeFileSync(
    path.join(testDir, 'test1.md'),
    `---
phase: 01
tags: [auth, jwt]
---
# Authentication Module
...`
  );
});
```

**Location:**
- Fixture files: `gsd-memory/tests/fixtures/`
- Fixture helpers: `gsd-memory/tests/setup.ts`
- Setup utilities: `readFixture(filename)`, `getMockPlanningPath()`, `getFixturePath(filename)`

## Coverage

**Requirements:** Not enforced by configuration

**View Coverage:**
```bash
npm run test -- --coverage  # If coverage provider configured
```

**Coverage Configuration (vitest.config.ts):**
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['src/**/*.ts'],
  exclude: ['src/index.ts']
}
```

**Observed Gaps:**
- `src/index.ts` intentionally excluded (MCP server entry point)
- No coverage reports generated by default
- Tools are well-tested but some edge cases may be uncovered

## Test Types

**Unit Tests:**
- Scope: Individual functions and modules
- Approach: Test with mocked dependencies
- Location: `tests/tools/`, `tests/extractors/`
- Example: `search.test.ts` tests search function with mocked registry
- Typical: 5-15 test cases per module testing input variations and edge cases

**Integration Tests:**
- Scope: Multiple modules working together
- Approach: More realistic setup, fewer mocks
- Location: `tests/integration/`
- Examples:
  - `qmd-wrapper.test.ts`: Tests QMD wrapper with real file I/O, real grep fallback
  - `mcp-server.test.ts`: Tests MCP server tool dispatch
  - `end-to-end.test.ts`: Full project registration and search flow
- Configuration: `vitest.integration.config.ts` with longer timeout (30s)

**E2E Tests:**
- Not separated; integration tests serve this purpose
- Example flow tested in `integration/end-to-end.test.ts`:
  1. Register a project
  2. Index it (or mock indexing)
  3. Search for content
  4. Verify results contain expected data

## Common Patterns

**Async Testing:**

```typescript
// Simple async test
it('returns enriched results', async () => {
  const results = await search({ query: 'test' });
  expect(Array.isArray(results)).toBe(true);
});

// With Promise.all
it('enriches multiple projects', async () => {
  const enrichedProjects = await Promise.all(
    projects.map(async (p) => {
      const status = await qmd.status(p.qmdCollection);
      return { ...p, documentCount: status.documentCount };
    })
  );
  expect(enrichedProjects).toBeDefined();
});
```

**Error Testing:**

```typescript
// Testing graceful error handling
it('returns empty array for non-existent project', async () => {
  const results = await search({
    query: 'test',
    project: 'non-existent-project'
  });
  expect(results).toEqual([]);
});

// Testing validation
it('returns error when path does not exist', async () => {
  const result = await register({ path: '/does/not/exist' });
  expect(result.success).toBe(false);
  expect(result.error).toBeDefined();
});

// Testing graceful fallback
it('returns graceful error when QMD unavailable', async () => {
  vi.spyOn(qmd, 'isAvailable').mockResolvedValue(false);
  const result = await qmd.createCollection({ ... });
  expect(result.success).toBe(false);
  expect(result.reason).toBe('qmd_not_available');
});
```

**File System Testing:**

```typescript
// Creating temporary test structure
beforeEach(() => {
  testDir = path.join(os.tmpdir(), `test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });

  // Create nested directories
  const nestedDir = path.join(testDir, 'docs', 'api');
  fs.mkdirSync(nestedDir, { recursive: true });
  fs.writeFileSync(path.join(nestedDir, 'nested.md'), '# Content');
});

// Test file discovery
it('finds markdown files recursively', () => {
  const files = qmd.findMarkdownFiles(testDir);
  expect(files.some(f => f.endsWith('nested.md'))).toBe(true);
});

// Test exclusions
it('excludes node_modules and hidden directories', () => {
  const nmDir = path.join(testDir, 'node_modules');
  fs.mkdirSync(nmDir, { recursive: true });
  fs.writeFileSync(path.join(nmDir, 'package.md'), '# Package');

  const files = qmd.findMarkdownFiles(testDir);
  expect(files.some(f => f.includes('node_modules'))).toBe(false);
});

// Cleanup
afterEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
});
```

**Data Transformation Testing:**

```typescript
// Testing extraction with complex frontmatter
it('extracts nested objects', () => {
  const md = `---
tech-stack:
  added:
    - jose: 5.2.0
    - bcrypt: 5.1.1
---
# Content`;
  const result = extractFrontmatter(md);
  expect(result['tech-stack'].added).toHaveLength(2);
  expect(result['tech-stack'].added[0]).toHaveProperty('jose', '5.2.0');
});

// Testing malformed data handling
it('handles malformed YAML gracefully', () => {
  const md = `---
invalid: [unclosed
---
# Content`;
  expect(() => extractFrontmatter(md)).not.toThrow();
  expect(extractFrontmatter(md)).toEqual({});
});
```

## Test Execution Environment

**Vitest Configuration:**
- Environment: Node.js
- Globals enabled: `globals: true` (can use `describe`, `it`, `expect` without imports)
- Includes: `tests/**/*.test.ts`
- Excludes: `tests/integration/**` (in default config)

**TypeScript Compilation:**
- Source: `src/**/*.ts`
- Output: `dist/`
- Strict mode active during tests
- ESM module system (`"type": "module"` in package.json)

---

*Testing analysis: 2026-02-06*
