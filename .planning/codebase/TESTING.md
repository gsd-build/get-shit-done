# Testing Patterns

**Analysis Date:** 2026-02-20

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`)
- Version: Node.js 16.7.0+ required (see `package.json` engines)
- Config: None - uses Node.js defaults

**Assertion Library:**
- Node.js built-in `node:assert` module
- `assert.strictEqual()`, `assert.deepStrictEqual()`, `assert.ok()` patterns

**Run Commands:**
```bash
npm test                           # Run all tests
node --test get-shit-done/bin/gsd-tools.test.js  # Direct invocation
```

## Test File Organization

**Location:**
- Co-located with source: `gsd-tools.test.cjs` alongside `gsd-tools.cjs`
- Single test file for CLI tool

**Naming:**
- `*.test.cjs` for CommonJS test files
- Same base name as source file

**Structure:**
```
get-shit-done/
└── bin/
    ├── gsd-tools.cjs       # Source
    └── gsd-tools.test.cjs  # Tests
```

## Test Structure

**Suite Organization:**
```javascript
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

describe('command-name command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('describes expected behavior', () => {
    const result = runGsdTools('command args', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.field, 'expected', 'assertion message');
  });
});
```

**Patterns:**
- One `describe` block per CLI command
- `beforeEach`/`afterEach` for temp directory setup/cleanup
- Test names describe expected behavior, not implementation

## Test Helpers

**Temp Directory Setup:**
```javascript
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

**Command Runner:**
```javascript
function runGsdTools(args, cwd = process.cwd()) {
  try {
    const result = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
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

## Mocking

**Framework:**
- No mocking framework - tests use real filesystem operations
- Temp directories isolate test state

**Patterns:**
```javascript
// Create test fixtures via filesystem
fs.writeFileSync(
  path.join(tmpDir, '.planning', 'ROADMAP.md'),
  `# Roadmap v1.0

### Phase 1: Foundation
**Goal:** Set up project infrastructure
`
);

// Create phase directories with test content
const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
fs.mkdirSync(phaseDir, { recursive: true });
fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');
```

**What to Mock:**
- Filesystem state (created via temp directories)
- No network mocking needed (CLI is file-based)

**What NOT to Mock:**
- The gsd-tools CLI itself (tested via subprocess)
- File system operations (use real fs in temp dir)

## Fixtures and Factories

**Test Data:**
```javascript
// Inline fixtures in test files
fs.writeFileSync(
  path.join(phaseDir, '01-01-SUMMARY.md'),
  `---
phase: "01"
name: "Foundation Setup"
dependency-graph:
  provides:
    - "Database schema"
    - "Auth system"
tech-stack:
  added:
    - "prisma"
    - "jose"
---

# Summary content here
`
);
```

**Location:**
- No separate fixtures directory
- Test data created inline in each test
- Frontmatter and markdown content as template literals

## Coverage

**Requirements:**
- No coverage enforcement
- No coverage tooling configured

**View Coverage:**
- Not available - would require adding `c8` or similar

## Test Types

**Unit Tests:**
- Not present - all tests are integration/CLI tests

**Integration Tests:**
- Primary test type
- Test CLI commands end-to-end via subprocess
- Verify JSON output structure and file system changes

**E2E Tests:**
- Not present

## Common Patterns

**Async Testing:**
```javascript
// Tests are synchronous - execSync used for CLI calls
test('extracts phase section from ROADMAP.md', () => {
  // Setup
  fs.writeFileSync(/* ... */);

  // Execute
  const result = runGsdTools('roadmap get-phase 1', tmpDir);

  // Assert
  assert.ok(result.success, `Command failed: ${result.error}`);
  const output = JSON.parse(result.output);
  assert.strictEqual(output.found, true);
});
```

**Error Testing:**
```javascript
test('rejects removal of phase with summaries unless --force', () => {
  // Setup phase with SUMMARY
  fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

  // Should fail without --force
  const result = runGsdTools('phase remove 1', tmpDir);
  assert.ok(!result.success, 'should fail without --force');
  assert.ok(result.error.includes('executed plan'), 'error mentions executed plans');

  // Should succeed with --force
  const forceResult = runGsdTools('phase remove 1 --force', tmpDir);
  assert.ok(forceResult.success, `Force remove failed: ${forceResult.error}`);
});
```

**JSON Output Verification:**
```javascript
test('returns structured JSON output', () => {
  const result = runGsdTools('state-snapshot', tmpDir);
  assert.ok(result.success);

  const output = JSON.parse(result.output);
  assert.strictEqual(output.current_phase, '03');
  assert.strictEqual(output.status, 'In progress');
  assert.strictEqual(output.progress_percent, 45);
});
```

**Filesystem State Verification:**
```javascript
test('creates phase directory on disk', () => {
  runGsdTools('phase add User Dashboard', tmpDir);

  assert.ok(
    fs.existsSync(path.join(tmpDir, '.planning', 'phases', '03-user-dashboard')),
    'directory should be created'
  );
});

test('updates ROADMAP.md content', () => {
  runGsdTools('phase add User Dashboard', tmpDir);

  const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
  assert.ok(roadmap.includes('### Phase 3: User Dashboard'));
});
```

## Test Categories

**By Command Group:**

| Command Group | Test Count | Coverage |
|--------------|------------|----------|
| `history-digest` | 6 tests | YAML parsing, multi-phase merging |
| `phases list` | 5 tests | Directory listing, filtering |
| `roadmap get-phase` | 7 tests | Phase extraction, malformed handling |
| `phase next-decimal` | 5 tests | Decimal phase calculation |
| `phase-plan-index` | 6 tests | Plan indexing, wave grouping |
| `state-snapshot` | 5 tests | STATE.md parsing |
| `summary-extract` | 5 tests | Frontmatter extraction |
| `init commands` | 6 tests | Workflow initialization |
| `roadmap analyze` | 3 tests | Full roadmap parsing |
| `phase add` | 2 tests | Phase creation |
| `phase insert` | 5 tests | Decimal phase insertion |
| `phase remove` | 5 tests | Phase deletion, renumbering |
| `phase complete` | 6 tests | Phase transition, requirements |
| `milestone complete` | 2 tests | Milestone archiving |
| `validate consistency` | 3 tests | Project validation |
| `progress` | (tests exist) | Progress rendering |

## Writing New Tests

**Template:**
```javascript
describe('new-command command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('succeeds with valid input', () => {
    // 1. Setup: Create required files in tmpDir
    fs.writeFileSync(path.join(tmpDir, '.planning', 'FILE.md'), 'content');

    // 2. Execute: Run the command
    const result = runGsdTools('new-command args', tmpDir);

    // 3. Assert success
    assert.ok(result.success, `Command failed: ${result.error}`);

    // 4. Parse and verify output
    const output = JSON.parse(result.output);
    assert.strictEqual(output.expected_field, 'expected_value');

    // 5. Verify filesystem changes if applicable
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'OUTPUT.md'), 'utf-8');
    assert.ok(content.includes('expected content'));
  });

  test('handles error case gracefully', () => {
    // Don't create required files

    const result = runGsdTools('new-command args', tmpDir);

    // Command should succeed but return error in JSON
    assert.ok(result.success);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'Expected error message');
  });
});
```

---

*Testing analysis: 2026-02-20*
