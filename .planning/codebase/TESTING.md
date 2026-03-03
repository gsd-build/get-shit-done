# Testing Patterns

**Analysis Date:** 2025-07-14

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`) — no external test framework
- Config: No config file — uses `scripts/run-tests.cjs` as custom runner
- Node.js >= 16.7.0 required (per `package.json` engines)

**Assertion Library:**
- `node:assert` (built-in) — uses `assert.strictEqual`, `assert.deepStrictEqual`, `assert.ok`

**Coverage Tool:**
- `c8` v11.x — V8 native coverage via `NODE_V8_COVERAGE`
- Coverage target: 70% line coverage enforced on `get-shit-done/bin/lib/*.cjs`

**Run Commands:**
```bash
npm test                    # Run all tests (via scripts/run-tests.cjs)
npm run test:coverage       # Run tests with c8 coverage, 70% line threshold
```

## Test File Organization

**Location:**
- All tests in `tests/` directory at project root (separate from source)
- Source: `get-shit-done/bin/lib/*.cjs`
- Tests: `tests/*.test.cjs`

**Naming:**
- Test files: `{module-name}.test.cjs` — mirrors source module name
- Helpers: `helpers.cjs` — shared test utilities

**Structure:**
```
tests/
├── helpers.cjs                 # Shared test utilities (runGsdTools, createTempProject, cleanup)
├── codex-config.test.cjs       # Tests for bin/install.js Codex adapter functions
├── commands.test.cjs           # Tests for lib/commands.cjs
├── config.test.cjs             # Tests for lib/config.cjs
├── core.test.cjs               # Tests for lib/core.cjs (unit tests of pure functions)
├── dispatcher.test.cjs         # Tests for gsd-tools.cjs routing/error paths
├── frontmatter.test.cjs        # Tests for lib/frontmatter.cjs (pure functions)
├── frontmatter-cli.test.cjs    # CLI integration tests for frontmatter subcommands
├── init.test.cjs               # Tests for lib/init.cjs
├── milestone.test.cjs          # Tests for lib/milestone.cjs
├── phase.test.cjs              # Tests for lib/phase.cjs (largest test file: 1463 lines)
├── roadmap.test.cjs            # Tests for lib/roadmap.cjs
├── state.test.cjs              # Tests for lib/state.cjs
├── verify.test.cjs             # Tests for lib/verify.cjs
└── verify-health.test.cjs      # Tests for validate-health command
```

**Test Count:** 462 tests across 88 suites (all passing)

**File Sizes (lines):**
- `phase.test.cjs`: 1463 (largest)
- `state.test.cjs`: 1254
- `commands.test.cjs`: 1188
- `verify.test.cjs`: 1013
- `init.test.cjs`: 849
- Total: ~9,900 lines of test code

## Test Structure

**Suite Organization:**
```javascript
/**
 * GSD Tools Tests - {Module Name}
 *
 * {Brief description of what's tested}
 * {Any regression IDs: REG-01, REG-02, etc.}
 *
 * Requirements: {TEST-XX}
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('{command or function name}', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('{descriptive test name}', () => {
    // Arrange: create files/state
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '...');

    // Act: run command
    const result = runGsdTools('state-snapshot', tmpDir);

    // Assert
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.current_phase, '03');
  });
});
```

**Patterns:**
- `describe()` blocks group by command name or function name
- Nested `describe()` used for sub-categories (e.g., "override precedence", "edge cases")
- `test()` names are descriptive sentences, not camelCase
- Each `describe()` block has its own `beforeEach`/`afterEach` for temp directory lifecycle
- Arrange-Act-Assert pattern (implicit, not commented)

## Test Types

**Two distinct test patterns exist:**

### 1. CLI Integration Tests (majority of tests)

These test the full CLI pipeline by spawning `gsd-tools.cjs` as a child process:

```javascript
// From tests/config.test.cjs
test('creates config.json with expected structure and types', () => {
  const result = runGsdTools('config-ensure-section', tmpDir);
  assert.ok(result.success, `Command failed: ${result.error}`);

  const output = JSON.parse(result.output);
  assert.strictEqual(output.created, true);

  const config = readConfig(tmpDir);
  assert.strictEqual(typeof config.model_profile, 'string');
  assert.strictEqual(typeof config.commit_docs, 'boolean');
});
```

**Characteristics:**
- Execute the CLI binary via `execSync`/`execFileSync`
- Parse JSON stdout as the result
- Verify both stdout output AND filesystem side effects
- Use real temp directories with real file I/O
- Test the full dispatch path through `gsd-tools.cjs`

### 2. Unit Tests (pure function tests)

These import and test functions directly without spawning a process:

```javascript
// From tests/core.test.cjs
const { escapeRegex, normalizePhaseName, comparePhaseNum } = require('../get-shit-done/bin/lib/core.cjs');

describe('normalizePhaseName', () => {
  test('pads single digit', () => {
    assert.strictEqual(normalizePhaseName('1'), '01');
  });

  test('handles letter suffix', () => {
    assert.strictEqual(normalizePhaseName('1A'), '01A');
  });
});
```

**Characteristics:**
- Direct `require()` of source modules
- No process spawning
- Test pure functions in isolation
- Used for: `core.cjs` utilities, `frontmatter.cjs` parser/serializer

### 3. Tests Requiring Git

Some tests need a git repository:

```javascript
// From tests/helpers.cjs
function createTempGitProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
  fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project\n\nTest project.\n');
  execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "initial commit"', { cwd: tmpDir, stdio: 'pipe' });
  return tmpDir;
}
```

Used by: `verify.test.cjs` (commit verification), `commands.test.cjs` (commit command)

## Test Helpers (`tests/helpers.cjs`)

**`runGsdTools(args, cwd)`:**
```javascript
function runGsdTools(args, cwd = process.cwd()) {
  try {
    let result;
    if (Array.isArray(args)) {
      // Shell-bypass: safe for JSON and dollar signs
      result = execFileSync(process.execPath, [TOOLS_PATH, ...args], {
        cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      });
    } else {
      // Shell-interpreted: for simple commands
      result = execSync(`node "${TOOLS_PATH}" ${args}`, {
        cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      });
    }
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}
```

- **String args**: passed through shell (simple commands)
- **Array args**: uses `execFileSync` to bypass shell (safe for JSON/special chars)
- Returns `{ success, output, error }` — never throws

**`createTempProject()`:**
- Creates temp directory with `fs.mkdtempSync`
- Creates `.planning/phases/` directory structure
- Returns temp directory path

**`createTempGitProject()`:**
- Same as above plus `git init`, config, and initial commit
- Used when tests need to verify git operations

**`cleanup(tmpDir)`:**
- `fs.rmSync(tmpDir, { recursive: true, force: true })`
- Called in `afterEach` of every test suite

## Mocking

**Framework:** None — no mocking library used

**Approach:** Tests use real filesystem operations on temp directories instead of mocking:

```javascript
// Instead of mocking fs.readFileSync, tests create real files:
fs.writeFileSync(
  path.join(tmpDir, '.planning', 'ROADMAP.md'),
  '# Roadmap v1.0\n### Phase 1: Foundation\n**Goal:** Set up infrastructure\n'
);
```

**What IS mocked (via environment):**
- `process.env.GSD_TEST_MODE = '1'` — enables test exports from `bin/install.js`
- Working directory overridden via `--cwd` flag or `cwd` parameter
- No mock for `execSync`, `fs`, or any Node.js builtins

**What is NOT mocked:**
- Filesystem (all real I/O on temp directories)
- Git (real `git init`, `git commit` in test fixtures)
- Child process execution (real `node` subprocess spawning)

**Tests touching real home directory:**
Some config tests interact with `~/.gsd/` directory. They use save/restore patterns:
```javascript
test('merges user defaults from defaults.json', () => {
  const defaultsFile = path.join(os.homedir(), '.gsd', 'defaults.json');
  let existingDefaults = null;
  if (fs.existsSync(defaultsFile)) {
    existingDefaults = fs.readFileSync(defaultsFile, 'utf-8');
  }
  try {
    fs.writeFileSync(defaultsFile, JSON.stringify({ model_profile: 'quality' }));
    // ... test logic ...
  } finally {
    // Restore original
    if (existingDefaults !== null) {
      fs.writeFileSync(defaultsFile, existingDefaults, 'utf-8');
    } else {
      try { fs.unlinkSync(defaultsFile); } catch {}
    }
  }
});
```

## Fixtures and Factories

**Test Data:**
Inline fixture creation within each test — no shared fixture files:

```javascript
// Helper function pattern for complex fixtures
function validPlanContent({ wave = 1, dependsOn = '[]', autonomous = 'true', extraTasks = '' } = {}) {
  return [
    '---',
    'phase: 01-test',
    'plan: 01',
    'type: execute',
    `wave: ${wave}`,
    `depends_on: ${dependsOn}`,
    'files_modified: [some/file.ts]',
    `autonomous: ${autonomous}`,
    'must_haves:',
    '  truths:',
    '    - "something is true"',
    '---',
    '',
    '<tasks>',
    '<task type="auto">',
    '  <name>Task 1: Do something</name>',
    '  <files>some/file.ts</files>',
    '  <action>Do the thing</action>',
    '  <verify><automated>echo ok</automated></verify>',
    '  <done>Thing is done</done>',
    '</task>',
    extraTasks,
    '</tasks>',
  ].join('\n');
}
```

**Per-suite helpers:**
```javascript
// From verify-health.test.cjs
function writeMinimalRoadmap(tmpDir, phases = ['1']) {
  const lines = phases.map(n => `### Phase ${n}: Phase ${n} Description`).join('\n');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `# Roadmap\n\n${lines}\n`);
}

function writeMinimalProjectMd(tmpDir) { /* ... */ }
function writeMinimalStateMd(tmpDir, content) { /* ... */ }
function writeValidConfigJson(tmpDir) { /* ... */ }
```

**Location:**
- Helper functions defined at top of each test file
- Shared helpers only in `tests/helpers.cjs`
- No separate fixtures directory
- No JSON fixture files

## Coverage

**Requirements:**
- 70% line coverage enforced on `get-shit-done/bin/lib/*.cjs`
- Enforced via `c8 --check-coverage --lines 70`
- Only library files included (`--include 'get-shit-done/bin/lib/*.cjs'`)
- Test files excluded (`--exclude 'tests/**'`)

**View Coverage:**
```bash
npm run test:coverage              # Run with coverage check (fails if <70%)
npx c8 report --reporter text      # View text report after coverage run
npx c8 report --reporter html      # Generate HTML report in coverage/
```

**Coverage scope:**
- Only `get-shit-done/bin/lib/*.cjs` files (11 modules)
- Does not cover: `bin/install.js`, `hooks/*.js`, `scripts/*.cjs`

## Regression Testing

**Pattern:** Regression tests are labeled with IDs and include the bug description:

```javascript
// Bug: loadConfig previously omitted model_overrides from return value
test('returns model_overrides when present (REG-01)', () => {
  writeConfig({ model_overrides: { 'gsd-executor': 'opus' } });
  const config = loadConfig(tmpDir);
  assert.deepStrictEqual(config.model_overrides, { 'gsd-executor': 'opus' });
});

// Bug: getRoadmapPhaseInternal was missing from module.exports
test('is exported from core.cjs (REG-02)', () => {
  assert.strictEqual(typeof getRoadmapPhaseInternal, 'function');
});

// REG-04: quoted comma inline array edge case (documents known limitation)
test('handles quoted commas in inline arrays — REG-04 known limitation', () => {
  const content = '---\nkey: ["a, b", c]\n---\n';
  const result = extractFrontmatter(content);
  // Documents CURRENT (buggy) behavior, not desired behavior
  assert.ok(result.key.length > 2, 'REG-04: split produces more items than intended');
});
```

**Known regression IDs:**
- `REG-01`: `loadConfig` missing `model_overrides` in return value
- `REG-02`: `getRoadmapPhaseInternal` missing from `module.exports`
- `REG-04`: `extractFrontmatter` inline array splits on commas inside quotes

## Common Patterns

**Standard assertion for successful CLI command:**
```javascript
const result = runGsdTools('command-name arg1 arg2', tmpDir);
assert.ok(result.success, `Command failed: ${result.error}`);
const output = JSON.parse(result.output);
assert.strictEqual(output.some_field, expectedValue);
```

**Standard assertion for expected failure:**
```javascript
const result = runGsdTools('config-get nonexistent_key', tmpDir);
assert.strictEqual(result.success, false);
assert.ok(
  result.error.includes('Key not found'),
  `Expected "Key not found" in error: ${result.error}`
);
```

**Array args for shell-unsafe inputs:**
```javascript
// Use array form when args contain JSON, $, or special characters
const result = runGsdTools([
  'frontmatter', 'merge', filePath,
  '--data', JSON.stringify({ phase: '02', tags: ['a', 'b'] })
], tmpDir);
```

**Verifying filesystem side effects:**
```javascript
const result = runGsdTools('config-set model_profile quality', tmpDir);
assert.ok(result.success);

// Verify the file was actually modified
const config = JSON.parse(fs.readFileSync(
  path.join(tmpDir, '.planning', 'config.json'), 'utf-8'
));
assert.strictEqual(config.model_profile, 'quality');
```

## Test Runner Details

**Custom runner (`scripts/run-tests.cjs`):**
```javascript
const files = readdirSync(testDir)
  .filter(f => f.endsWith('.test.cjs'))
  .sort()
  .map(f => join('tests', f));

execFileSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  env: { ...process.env },
});
```

- Cross-platform: avoids shell glob expansion (Windows compatible)
- Discovers all `*.test.cjs` files in `tests/` directory
- Passes `NODE_V8_COVERAGE` environment for c8 integration
- Runs tests alphabetically by filename
- No parallel test execution — sequential file processing
- Each test file may run its own suites in parallel (Node.js test runner default)

## E2E Tests

**Not used.** All tests are either:
- Unit tests (direct function imports)
- CLI integration tests (subprocess execution against temp directories)

No browser testing, no Playwright/Cypress, no HTTP endpoint testing.

---

*Testing analysis: 2025-07-14*
