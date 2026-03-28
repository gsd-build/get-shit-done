# Contributing to GSD

## Getting Started

```bash
# Clone the repo
git clone https://github.com/gsd-build/get-shit-done.git
cd get-shit-done

# Install dependencies
npm install

# Run tests
npm test
```

## Pull Request Guidelines

- **One concern per PR** — bug fixes, features, and refactors should be separate PRs
- **No drive-by formatting** — don't reformat code unrelated to your change
- **Link issues** — use `Fixes #123` or `Closes #123` in PR body for auto-close
- **CI must pass** — all matrix jobs (Ubuntu, macOS, Windows × Node 22, 24) must be green

## Testing Standards

All tests use Node.js built-in test runner (`node:test`) and assertion library (`node:assert`). **Do not use Jest, Mocha, Chai, or any external test framework.**

### Required Imports

```javascript
const { describe, it, test, beforeEach, afterEach, before, after } = require('node:test');
const assert = require('node:assert/strict');
```

### Setup and Cleanup: Use Hooks, Not try/finally

**Always use `beforeEach`/`afterEach` for setup and cleanup.** Do not use `try/finally` blocks for test cleanup — they are verbose, error-prone, and can mask test failures.

```javascript
// GOOD — hooks handle setup/cleanup
describe('my feature', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('does the thing', () => {
    // test body focuses only on the assertion
    assert.strictEqual(result, expected);
  });
});
```

```javascript
// BAD — try/finally is verbose and masks failures
test('does the thing', () => {
  const tmpDir = createTempProject();
  try {
    // test body
    assert.strictEqual(result, expected);
  } finally {
    cleanup(tmpDir);
  }
});
```

### Use Centralized Test Helpers

Import helpers from `tests/helpers.cjs` instead of inlining temp directory creation:

```javascript
const { createTempProject, createTempGitProject, createTempDir, cleanup, runGsdTools } = require('./helpers.cjs');
```

| Helper | Creates | Use When |
|--------|---------|----------|
| `createTempProject(prefix?)` | tmpDir with `.planning/phases/` | Testing GSD tools that need planning structure |
| `createTempGitProject(prefix?)` | Same + git init + initial commit | Testing git-dependent features |
| `createTempDir(prefix?)` | Bare temp directory | Testing features that don't need `.planning/` |
| `cleanup(tmpDir)` | Removes directory recursively | Always use in `afterEach` |
| `runGsdTools(args, cwd, env?)` | Executes gsd-tools.cjs | Testing CLI commands |

### Test Structure

```javascript
describe('featureName', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Additional setup specific to this suite
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('handles normal case', () => {
    // Arrange
    // Act
    // Assert
  });

  test('handles edge case', () => {
    // ...
  });

  describe('sub-feature', () => {
    // Nested describes can have their own hooks
    beforeEach(() => {
      // Additional setup for sub-feature
    });

    test('sub-feature works', () => {
      // ...
    });
  });
});
```

### Node.js Version Compatibility

Tests must pass on:
- **Node 22** (LTS)
- **Node 24** (Current)

Forward-compatible with Node 26. Do not use:
- Deprecated APIs
- Version-specific features not available in Node 22

Safe to use:
- `node:test` — stable since Node 18, fully featured in 22+
- `describe`/`it`/`test` — all supported
- `beforeEach`/`afterEach`/`before`/`after` — all supported
- `t.plan()` — available since Node 22.2
- Snapshot testing — available since Node 22.3

### Assertions

Use `node:assert/strict` for strict equality by default:

```javascript
const assert = require('node:assert/strict');

assert.strictEqual(actual, expected);      // ===
assert.deepStrictEqual(actual, expected);  // deep ===
assert.ok(value);                          // truthy
assert.throws(() => { ... }, /pattern/);   // throws
assert.rejects(async () => { ... });       // async throws
```

### Running Tests

```bash
# Run all tests
npm test

# Run a single test file
node --test tests/core.test.cjs

# Run with coverage
npm run test:coverage
```

## Code Style

- **CommonJS** (`.cjs`) — the project uses `require()`, not ESM `import`
- **No external dependencies in core** — `gsd-tools.cjs` and all lib files use only Node.js built-ins
- **Conventional commits** — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`

## File Structure

```
bin/install.js          — Installer (multi-runtime)
get-shit-done/
  bin/lib/              — Core library modules (.cjs)
  workflows/            — Workflow definitions (.md)
  references/           — Reference documentation (.md)
  templates/            — File templates
agents/                 — Agent definitions (.md)
commands/gsd/           — Slash command definitions (.md)
tests/                  — Test files (.test.cjs)
  helpers.cjs           — Shared test utilities
docs/                   — User-facing documentation
```

## Security

- **Path validation** — use `validatePath()` from `security.cjs` for any user-provided paths
- **No shell injection** — use `execFileSync` (array args) over `execSync` (string interpolation)
- **No `${{ }}` in GitHub Actions `run:` blocks** — bind to `env:` mappings first
