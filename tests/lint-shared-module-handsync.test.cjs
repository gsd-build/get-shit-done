'use strict';

/**
 * Tests for scripts/lint-shared-module-handsync.cjs — Phase 6 of #3524 (#3575).
 *
 * Three cases:
 *   1. No new drift pair: lint exits 0 on the current repo tree (all cooperating
 *      siblings on the allowlist; migrateMeBacklog pairs do not fail).
 *   2. Intentional new drift: synthesize a fixture tree with an unlisted
 *      foo-test.cjs / foo-test.ts pair, assert exit 1 + typed error JSON.
 *   3. Allowlist entry honored: same pair as case 2, but with a cooperatingSiblings
 *      allowlist entry present, assert exit 0.
 *
 * Assertions use the lint's --json mode: the production code emits a typed IR
 * (ok / reason / errors / warnings / counts), and tests parse and assert on
 * structured fields rather than substring-matching stderr/stdout (per
 * CONTRIBUTING.md "Prohibited: Raw Text Matching on Test Outputs").
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const LINT_SCRIPT = path.join(__dirname, '..', 'scripts', 'lint-shared-module-handsync.cjs');
const ALLOWLIST_PATH = path.join(__dirname, '..', 'scripts', 'shared-module-handsync-allowlist.json');
const REPO_ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// Helper: run the lint script in --json mode and parse the result.
// Returns { status, payload } where payload is the parsed JSON IR (or null
// if the lint emitted no JSON, which would be a test-infrastructure bug).
// ---------------------------------------------------------------------------
function runLintJson(extraArgs = []) {
  const result = spawnSync(process.execPath, [LINT_SCRIPT, '--json', ...extraArgs], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
  let payload = null;
  try {
    payload = JSON.parse(result.stdout.trim());
  } catch {
    // Leave payload as null; tests assert on payload presence.
  }
  return { status: result.status, payload };
}

// ---------------------------------------------------------------------------
// Helper: create an isolated fixture tree for testing
//
// Layout:
//   <tmpDir>/
//     get-shit-done/bin/lib/<cjsName>.cjs
//     sdk/src/query/<tsName>.ts    (if tsInQuery === true)
//     sdk/src/<tsName>.ts          (if tsInQuery === false)
//     scripts/shared-module-handsync-allowlist.json  (custom allowlist)
// ---------------------------------------------------------------------------
function createFixture({ cjsName, tsName, tsInQuery = true, allowlistExtra = {} }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-lint-handsync-'));

  const cjsDir = path.join(tmpDir, 'get-shit-done', 'bin', 'lib');
  fs.mkdirSync(cjsDir, { recursive: true });

  const tsDir = tsInQuery
    ? path.join(tmpDir, 'sdk', 'src', 'query')
    : path.join(tmpDir, 'sdk', 'src');
  fs.mkdirSync(tsDir, { recursive: true });

  const scriptsDir = path.join(tmpDir, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });

  fs.writeFileSync(path.join(cjsDir, `${cjsName}.cjs`), `'use strict';\n// fixture cjs\n`);
  fs.writeFileSync(path.join(tsDir, `${tsName}.ts`), `// fixture ts\nexport {};\n`);

  const realAllowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  const fixtureAllowlist = {
    cooperatingSiblings: [
      ...(realAllowlist.cooperatingSiblings || []),
      ...(allowlistExtra.cooperatingSiblings || []),
    ],
    migrateMeBacklog: [
      ...(realAllowlist.migrateMeBacklog || []),
      ...(allowlistExtra.migrateMeBacklog || []),
    ],
  };
  fs.writeFileSync(
    path.join(scriptsDir, 'shared-module-handsync-allowlist.json'),
    JSON.stringify(fixtureAllowlist, null, 2)
  );

  return tmpDir;
}

function cleanupFixture(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Case 1: No new drift pair — exits 0 on current repo tree
// ---------------------------------------------------------------------------
describe('lint-shared-module-handsync: current repo tree', () => {
  test('exits 0 with the real allowlist and current repo tree', () => {
    const { status, payload } = runLintJson();
    assert.strictEqual(status, 0);
    assert.ok(payload, 'expected JSON payload on stdout');
    assert.strictEqual(payload.ok, true);
  });

  test('reports cooperating sibling count and zero unauthorized pairs', () => {
    const { payload } = runLintJson();
    assert.ok(payload);
    assert.strictEqual(typeof payload.cooperatingCount, 'number');
    assert.ok(payload.cooperatingCount > 0, 'expected at least one cooperating sibling');
    // No errors field on success — only warnings (backlog) may be present
    assert.strictEqual(payload.ok, true);
  });

  test('script has no syntax errors', () => {
    const result = spawnSync(process.execPath, ['--check', LINT_SCRIPT], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0);
  });
});

// ---------------------------------------------------------------------------
// Case 2: Intentional new drift — exits 1 with informative typed error
// ---------------------------------------------------------------------------
describe('lint-shared-module-handsync: intentional new drift pair', () => {
  test('exits 1 when an unlisted cjs/ts pair exists', () => {
    const tmpDir = createFixture({ cjsName: 'foo-test', tsName: 'foo-test', tsInQuery: true });
    try {
      const { status, payload } = runLintJson(['--root', tmpDir]);
      assert.strictEqual(status, 1);
      assert.ok(payload);
      assert.strictEqual(payload.ok, false);
      assert.strictEqual(payload.reason, 'unauthorized_pairs');
    } finally {
      cleanupFixture(tmpDir);
    }
  });

  test('typed error payload names the unauthorized pair', () => {
    const tmpDir = createFixture({ cjsName: 'foo-test', tsName: 'foo-test', tsInQuery: true });
    try {
      const { payload } = runLintJson(['--root', tmpDir]);
      assert.ok(payload && Array.isArray(payload.errors));
      assert.strictEqual(payload.errors.length, 1);
      const [entry] = payload.errors;
      assert.match(entry.relCjs, /foo-test\.cjs$/);
      assert.ok(Array.isArray(entry.tsPaths));
      assert.ok(entry.tsPaths.some((p) => /foo-test\.ts$/.test(p)));
    } finally {
      cleanupFixture(tmpDir);
    }
  });

  test('exits 1 for unlisted pair in sdk/src/<name>.ts (non-query) position', () => {
    const tmpDir = createFixture({ cjsName: 'bar-test', tsName: 'bar-test', tsInQuery: false });
    try {
      const { status, payload } = runLintJson(['--root', tmpDir]);
      assert.strictEqual(status, 1);
      assert.ok(payload);
      assert.strictEqual(payload.ok, false);
      assert.strictEqual(payload.reason, 'unauthorized_pairs');
    } finally {
      cleanupFixture(tmpDir);
    }
  });
});

// ---------------------------------------------------------------------------
// Case 3: Allowlist entry honored — exits 0 when pair IS on cooperatingSiblings
// ---------------------------------------------------------------------------
describe('lint-shared-module-handsync: allowlist entry honored', () => {
  test('exits 0 when pair is in cooperatingSiblings allowlist', () => {
    const cjsName = 'baz-cooperating';
    const tsName = 'baz-cooperating';
    const tmpDir = createFixture({
      cjsName,
      tsName,
      tsInQuery: true,
      allowlistExtra: {
        cooperatingSiblings: [
          {
            cjs: `get-shit-done/bin/lib/${cjsName}.cjs`,
            ts: `sdk/src/query/${tsName}.ts`,
            classification: 'cooperating-sibling',
            justification: 'Test fixture: synthetic cooperating sibling for lint test.',
          },
        ],
      },
    });
    try {
      const { status, payload } = runLintJson(['--root', tmpDir]);
      assert.strictEqual(status, 0);
      assert.ok(payload);
      assert.strictEqual(payload.ok, true);
    } finally {
      cleanupFixture(tmpDir);
    }
  });

  // Regression guard: the lint matches on the (cjs, ts) PAIR, not on the
  // cjs path alone. An allowlist entry whose ts points to a different path
  // than the actual ts sibling on disk must NOT silently pass the pair.
  test('rejects pair when TS path differs from allowlist entry', () => {
    const cjsName = 'foo-wrong-ts';
    const tsName = 'foo-wrong-ts';
    const tmpDir = createFixture({
      cjsName,
      tsName,
      tsInQuery: true, // creates sdk/src/query/foo-wrong-ts.ts on disk
      allowlistExtra: {
        cooperatingSiblings: [
          {
            cjs: `get-shit-done/bin/lib/${cjsName}.cjs`,
            // Allowlist points at sdk/src/<name>.ts — different location.
            // Lint must reject because the on-disk pair is unauthorized.
            ts: `sdk/src/${tsName}.ts`,
            classification: 'cooperating-sibling',
            justification: 'Test: validates pair-aware matching enforces ts path.',
          },
        ],
      },
    });
    try {
      const { status, payload } = runLintJson(['--root', tmpDir]);
      assert.strictEqual(status, 1, 'must fail when ts path mismatches');
      assert.ok(payload);
      assert.strictEqual(payload.ok, false);
      assert.strictEqual(payload.reason, 'unauthorized_pairs');
    } finally {
      cleanupFixture(tmpDir);
    }
  });

  test('exits 0 (no error) when pair is in migrateMeBacklog allowlist', () => {
    const cjsName = 'qux-backlog';
    const tsName = 'qux-backlog';
    const tmpDir = createFixture({
      cjsName,
      tsName,
      tsInQuery: true,
      allowlistExtra: {
        migrateMeBacklog: [
          {
            cjs: `get-shit-done/bin/lib/${cjsName}.cjs`,
            ts: `sdk/src/query/${tsName}.ts`,
            classification: 'drift-anti-pattern',
            justification: 'Test fixture: synthetic backlog pair for lint test.',
            trackedIn: 'test only',
          },
        ],
      },
    });
    try {
      const { status, payload } = runLintJson(['--root', tmpDir]);
      assert.strictEqual(status, 0);
      assert.ok(payload);
      assert.strictEqual(payload.ok, true);
      // The backlog pair should be reported in warnings (not errors)
      assert.ok(Array.isArray(payload.warnings));
      assert.ok(
        payload.warnings.some((w) => /qux-backlog\.cjs$/.test(w.relCjs)),
        'expected qux-backlog in warnings'
      );
    } finally {
      cleanupFixture(tmpDir);
    }
  });

  // Regression guard for #3632: when a cjs has TWO ts siblings sharing the
  // same basename (e.g. sdk/src/foo.ts AND sdk/src/query/foo.ts) and only
  // ONE pair is allowlisted, the unallowlisted sibling must still be reported.
  // Prior bug: .some() at the cjs level returned true on the allowlisted
  // pair, short-circuiting and silently dropping the unallowlisted sibling.
  test('reports unallowlisted ts sibling when another ts sibling for the same cjs IS allowlisted (#3632)', () => {
    const cjsName = 'multi-sibling';
    const tsName = 'multi-sibling';
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-lint-multi-'));
    try {
      const cjsDir = path.join(tmpDir, 'get-shit-done', 'bin', 'lib');
      fs.mkdirSync(cjsDir, { recursive: true });
      const tsDirRoot = path.join(tmpDir, 'sdk', 'src');
      const tsDirQuery = path.join(tmpDir, 'sdk', 'src', 'query');
      fs.mkdirSync(tsDirQuery, { recursive: true });
      const scriptsDir = path.join(tmpDir, 'scripts');
      fs.mkdirSync(scriptsDir, { recursive: true });

      // One cjs, two ts siblings on disk (same basename, different paths).
      fs.writeFileSync(path.join(cjsDir, `${cjsName}.cjs`), `'use strict';\n`);
      fs.writeFileSync(path.join(tsDirRoot, `${tsName}.ts`), `export {};\n`);
      fs.writeFileSync(path.join(tsDirQuery, `${tsName}.ts`), `export {};\n`);

      // Allowlist ONLY the sdk/src/<name>.ts pair. The sdk/src/query/<name>.ts
      // sibling is intentionally NOT allowlisted and must be reported.
      fs.writeFileSync(
        path.join(scriptsDir, 'shared-module-handsync-allowlist.json'),
        JSON.stringify(
          {
            cooperatingSiblings: [
              {
                cjs: `get-shit-done/bin/lib/${cjsName}.cjs`,
                ts: `sdk/src/${tsName}.ts`,
                classification: 'cooperating-sibling',
                justification: 'Test: only the non-query sibling is allowlisted.',
              },
            ],
            migrateMeBacklog: [],
          },
          null,
          2
        )
      );

      const { status, payload } = runLintJson(['--root', tmpDir]);
      assert.strictEqual(
        status,
        1,
        'must fail: the sdk/src/query/<name>.ts sibling is not allowlisted'
      );
      assert.ok(payload);
      assert.strictEqual(payload.ok, false);
      assert.strictEqual(payload.reason, 'unauthorized_pairs');
      assert.ok(Array.isArray(payload.errors) && payload.errors.length >= 1);
      const reportedTs = payload.errors.flatMap((e) => e.tsPaths);
      assert.ok(
        reportedTs.some((p) => /sdk\/src\/query\/multi-sibling\.ts$/.test(p)),
        `expected query sibling in errors, got: ${JSON.stringify(reportedTs)}`
      );
      // The allowlisted sibling must NOT appear in errors.
      assert.ok(
        !reportedTs.some((p) => /^sdk\/src\/multi-sibling\.ts$/.test(p)),
        `allowlisted sibling sdk/src/multi-sibling.ts must not be flagged, got: ${JSON.stringify(reportedTs)}`
      );
    } finally {
      cleanupFixture(tmpDir);
    }
  });

  test('generated .cjs files are excluded from pair detection', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-lint-gen-'));
    try {
      const cjsDir = path.join(tmpDir, 'get-shit-done', 'bin', 'lib');
      fs.mkdirSync(cjsDir, { recursive: true });
      const tsDir = path.join(tmpDir, 'sdk', 'src', 'query');
      fs.mkdirSync(tsDir, { recursive: true });
      const scriptsDir = path.join(tmpDir, 'scripts');
      fs.mkdirSync(scriptsDir, { recursive: true });

      // A .generated.cjs file + matching TS — should NOT trigger lint error
      fs.writeFileSync(path.join(cjsDir, 'my-module.generated.cjs'), `'use strict';\n`);
      fs.writeFileSync(path.join(tsDir, 'my-module.ts'), `export {};\n`);

      fs.writeFileSync(
        path.join(scriptsDir, 'shared-module-handsync-allowlist.json'),
        JSON.stringify({ cooperatingSiblings: [], migrateMeBacklog: [] }, null, 2)
      );

      const { status, payload } = runLintJson(['--root', tmpDir]);
      assert.strictEqual(status, 0);
      assert.ok(payload);
      assert.strictEqual(payload.ok, true);
    } finally {
      cleanupFixture(tmpDir);
    }
  });
});
