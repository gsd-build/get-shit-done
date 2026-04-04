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

---

## Types of Contributions

GSD accepts three types of contributions. Each type has a different process and a different bar for acceptance. **Read this section before opening anything.**

### 🐛 Fix (Bug Report)

A fix corrects something that is broken, crashes, produces wrong output, or behaves contrary to documented behavior.

**Process:**
1. Open a [Bug Report issue](https://github.com/gsd-build/get-shit-done/issues/new?template=bug_report.yml) — fill it out completely.
2. Wait for a maintainer to confirm it is a bug (label: `confirmed-bug`). For obvious, reproducible bugs this is typically fast.
3. Fix it. Write a test that would have caught the bug.
4. Open a PR using the [Fix PR template](.github/PULL_REQUEST_TEMPLATE/fix.md) — link the confirmed issue.

**Rejection reasons:** Not reproducible, works-as-designed, duplicate of an existing issue.

---

### ⚡ Enhancement

An enhancement improves an existing feature — better output, faster execution, cleaner UX, expanded edge-case handling. It does **not** add new commands, new workflows, or new concepts.

**The bar:** Enhancements must have a scoped written proposal approved by a maintainer before any code is written. A PR for an enhancement will be closed without review if the linked issue does not carry the `approved-enhancement` label.

**Process:**
1. Open an [Enhancement issue](https://github.com/gsd-build/get-shit-done/issues/new?template=enhancement.yml) with the full proposal.  The issue template requires: the problem being solved, the concrete benefit, the scope of changes, and alternatives considered.
2. **Wait for maintainer approval.** A maintainer must label the issue `approved-enhancement` before you write a single line of code. Do not open a PR against an unapproved enhancement issue — it will be closed.
3. Write the code. Keep the scope exactly as approved. If scope creep occurs, comment on the issue and get re-approval before continuing.
4. Open a PR using the [Enhancement PR template](.github/PULL_REQUEST_TEMPLATE/enhancement.md) — link the approved issue.

**Rejection reasons:** Issue not labeled `approved-enhancement`, scope exceeds what was approved, no written proposal, duplicate of existing behavior.

---

### ✨ Feature

A feature adds something new — a new command, a new workflow, a new concept, a new integration. Features have the highest bar because they add permanent maintenance burden to a solo-developer tool maintained by a small team.

**The bar:** Features require a complete written specification approved by a maintainer before any code is written. A PR for a feature will be closed without review if the linked issue does not carry the `approved-feature` label. Incomplete specs are closed, not revised by maintainers.

**Process:**
1. **Discuss first** — check [Discussions](https://github.com/gsd-build/get-shit-done/discussions) to see if the idea has been raised. If it has and was declined, don't open a new issue.
2. Open a [Feature Request issue](https://github.com/gsd-build/get-shit-done/issues/new?template=feature_request.yml) with the complete spec. The template requires: the solo-developer problem being solved, what is being added, full scope of affected files and systems, user stories, acceptance criteria, and assessment of maintenance burden.
3. **Wait for maintainer approval.** A maintainer must label the issue `approved-feature` before you write a single line of code. Approval is not guaranteed — GSD is intentionally lean and many valid ideas are declined because they conflict with the project's design philosophy.
4. Write the code. Implement exactly the approved spec. Changes to scope require re-approval.
5. Open a PR using the [Feature PR template](.github/PULL_REQUEST_TEMPLATE/feature.md) — link the approved issue.

**Rejection reasons:** Issue not labeled `approved-feature`, spec is incomplete, scope exceeds what was approved, feature conflicts with GSD's solo-developer focus, maintenance burden too high.

---

## The Issue-First Rule — No Exceptions

> **No code before approval.**

For **fixes**: open the issue, confirm it's a bug, then fix it.
For **enhancements**: open the issue, get `approved-enhancement`, then code.
For **features**: open the issue, get `approved-feature`, then code.

PRs that arrive without a properly-labeled linked issue are closed automatically. This is not a bureaucratic hurdle — it protects you from spending time on work that will be rejected, and it protects maintainers from reviewing code for changes that were never agreed to.

---

## Pull Request Guidelines

**Every PR must link to an approved issue.** PRs without a linked issue are closed without review, no exceptions.

- **Use the correct PR template** — there are separate templates for [Fix](.github/PULL_REQUEST_TEMPLATE/fix.md), [Enhancement](.github/PULL_REQUEST_TEMPLATE/enhancement.md), and [Feature](.github/PULL_REQUEST_TEMPLATE/feature.md). Using the wrong template or using the default template for a feature is a rejection reason.
- **Link with a closing keyword** — use `Closes #123`, `Fixes #123`, or `Resolves #123` in the PR body. The CI check will fail and the PR will be auto-closed if no valid issue reference is found.
- **One concern per PR** — bug fixes, enhancements, and features must be separate PRs
- **No drive-by formatting** — don't reformat code unrelated to your change
- **CI must pass** — all matrix jobs (Ubuntu, macOS, Windows × Node 22, 24) must be green
- **Scope matches the approved issue** — if your PR does more than what the issue describes, the extra changes will be asked to be removed or moved to a new issue

## Testing Standards

All tests use Node.js built-in test runner (`node:test`) and assertion library (`node:assert`). **Do not use Jest, Mocha, Chai, or any external test framework.**

### Required Imports

```javascript
const { describe, it, test, beforeEach, afterEach, before, after } = require('node:test');
const assert = require('node:assert/strict');
```

### Setup and Cleanup

There are two approved cleanup patterns. Choose the one that fits the situation.

**Pattern 1 — Shared fixtures (`beforeEach`/`afterEach`):** Use when all tests in a `describe` block share identical setup and teardown. This is the most common case.

```javascript
// GOOD — shared setup/teardown with hooks
describe('my feature', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('does the thing', () => {
    assert.strictEqual(result, expected);
  });
});
```

**Pattern 2 — Per-test cleanup (`t.after()`):** Use when individual tests require unique teardown that differs from other tests in the same block.

```javascript
// GOOD — per-test cleanup when each test needs different teardown
test('does the thing with a custom setup', (t) => {
  const tmpDir = createTempProject('custom-prefix');
  t.after(() => cleanup(tmpDir));

  assert.strictEqual(result, expected);
});
```

**Never use `try/finally` inside test bodies.** It is verbose, masks test failures, and is not an approved pattern in this project.

```javascript
// BAD — try/finally inside a test body
test('does the thing', () => {
  const tmpDir = createTempProject();
  try {
    assert.strictEqual(result, expected);
  } finally {
    cleanup(tmpDir); // masks failures — don't do this
  }
});
```

> `try/finally` is only permitted inside standalone utility or helper functions that have no access to test context.

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

### Fixture Data Formatting

Template literals inside test blocks inherit indentation from the surrounding code. This can introduce unexpected leading whitespace that breaks regex anchors and string matching. Construct multi-line fixture strings using array `join()` instead:

```javascript
// GOOD — no indentation bleed
const content = [
  'line one',
  'line two',
  'line three',
].join('\n');

// BAD — template literal inherits surrounding indentation
const content = `
  line one
  line two
  line three
`;
```

### Node.js Version Compatibility

**Node 24 is the primary CI target.** All tests must pass on Node 24. Node 22 (LTS) must remain backward-compatible — do not use APIs that are not available in Node 22.

| Version | Status |
|---------|--------|
| **Node 24** | Primary CI target — all tests must pass |
| **Node 22** | Backward compatibility required |
| Node 26 | Forward-compatible target — avoid deprecated APIs |

Do not use:
- Deprecated APIs
- Version-specific features not available in Node 22

Safe to use:
- `node:test` — stable since Node 18, fully featured in 22+
- `describe`/`it`/`test` — all supported
- `beforeEach`/`afterEach`/`before`/`after` — all supported
- `t.after()` — per-test cleanup, available in Node 22+
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

### Test Requirements by Contribution Type

The required tests differ depending on what you are contributing:

**Bug Fix:** A regression test is required. Write the test first — it must demonstrate the original failure before your fix is applied, then pass after the fix. A PR that fixes a bug without a regression test will be asked to add one. "Tests pass" does not prove correctness; it proves the bug isn't present in the tests that exist.

**Enhancement:** Tests covering the enhanced behavior are required. Update any existing tests that test the area you changed. Do not leave tests that pass but no longer accurately describe the behavior.

**Feature:** Tests are required for the primary success path and at minimum one failure scenario. Leaving gaps in test coverage for a new feature is a rejection reason.

**Behavior Change:** If your change modifies existing behavior, the existing tests covering that behavior must be updated or replaced. Leaving passing-but-incorrect tests in the suite is not acceptable — a test that passes but asserts the old (now wrong) behavior makes the suite less useful than no test at all.

### Reviewer Standards

Reviewers do not rely solely on CI to verify correctness. Before approving a PR, reviewers:

- Build locally (`npm run build` if applicable)
- Run the full test suite locally (`npm test`)
- Confirm regression tests exist for bug fixes and that they would fail without the fix
- Validate that the implementation matches what the linked issue described — green CI on the wrong implementation is not an approval signal

**"Tests pass in CI" is not sufficient for merge.** The implementation must correctly solve the problem described in the linked issue.

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
