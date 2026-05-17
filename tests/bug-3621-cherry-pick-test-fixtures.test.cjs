/**
 * Regression test for bug #3621
 *
 * The release-sdk hotfix cherry-pick loop's `fix:`/`chore:` prefix filter
 * and the shipped-paths classifier together excluded a test-fixture update
 * that was required to align CI with a cherry-picked production fix.
 *
 * Concrete failure shape (v1.42.3 hotfix, run 25949422676):
 *   - Commit 36534059 fix(3562) was picked. It changed the installer to
 *     materialize gsd-named SKILL.md files under the codex skills dir.
 *   - Commit 08848df8 (docs(3562) prefix) was POLICY_SKIPPED by the prefix
 *     filter. It bundled the matching test-fixture correction (removing an
 *     "if (runtime === 'codex') return new Set()" short-circuit in
 *     tests/install-minimal-all-runtimes.test.cjs).
 *   - Result: hotfix branch has new production behavior + stale test
 *     assertion → 3 tests fail.
 *
 * Two-part fix:
 *   1. release-sdk.yml prefix filter now includes test: commits.
 *   2. scripts/diff-touches-shipped-paths.cjs treats tests/-rooted paths
 *      and sdk/src vitest specs (.test.ts / .spec.ts and friends) as
 *      CI-gating-equivalent so a test: commit that touches only those
 *      paths passes the shipped-paths gate.
 *
 * Without both halves the bundling failure mode persists.
 */

'use strict';

// allow-test-rule: source-text-is-the-product
// release-sdk.yml IS the product for hotfix automation; this test reads
// the workflow's prefix-filter regex line directly because the regex IS
// the behavior contract — there is no runtime that consumes it.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..');
const WORKFLOW_PATH = path.join(REPO_ROOT, '.github', 'workflows', 'release-sdk.yml');
const CLASSIFIER_PATH = path.join(REPO_ROOT, 'scripts', 'diff-touches-shipped-paths.cjs');
const { isCiGating } = require('../scripts/diff-touches-shipped-paths.cjs');

function workflowText() {
  return fs.readFileSync(WORKFLOW_PATH, 'utf8');
}

function runClassifier(stdin, cwd) {
  return spawnSync(process.execPath, [CLASSIFIER_PATH], {
    cwd,
    input: stdin,
    encoding: 'utf8',
  });
}

function writeMinimalPkg(tmp, files) {
  fs.writeFileSync(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'test-pkg', version: '0.0.0', files }, null, 2),
  );
}

describe('bug-3621: release-sdk hotfix accepts `test:` commits', () => {
  test('candidate-loop regex includes test: prefix alongside fix:/chore:', () => {
    const text = workflowText();
    // The regex must accept all three prefixes — fix, chore, test — with
    // optional (scope) and optional ! for breaking. Asserted by extracting
    // the literal regex line.
    const regexLine = text.split('\n').find((l) => l.includes("grep -qE '^(") && l.includes(')(\\([^)]+\\))?!?: '));
    assert.ok(regexLine, 'release-sdk.yml must contain the candidate-prefix regex line');
    assert.ok(
      /\^\(fix\|chore\|test\)/.test(regexLine),
      `prefix regex must include fix|chore|test (got: ${regexLine.trim()})`,
    );
  });

  test('regex does NOT silently drop fix: or chore: while adding test:', () => {
    const text = workflowText();
    const regexLine = text.split('\n').find((l) => l.includes("grep -qE '^("));
    assert.ok(regexLine.includes('fix|chore|test'), 'must keep fix and chore as before');
    assert.ok(!regexLine.includes('feat|'), 'must NOT silently add feat: — features are not hotfix-eligible');
    assert.ok(!regexLine.includes('docs|'), 'must NOT silently add docs: — docs commits remain POLICY_SKIPPED');
  });
});

describe('bug-3621: shipped-paths classifier treats test paths as CI-gating', () => {
  test('isCiGating recognizes tests/** as CI-gating', () => {
    assert.equal(isCiGating('tests/bug-foo.test.cjs'), true);
    assert.equal(isCiGating('tests/helpers.cjs'), true);
    assert.equal(isCiGating('tests/fixtures/adversarial/roadmap/duplicate-keys.md'), true);
  });

  test('isCiGating recognizes sdk/src vitest specs as CI-gating', () => {
    assert.equal(isCiGating('sdk/src/query/init.test.ts'), true);
    assert.equal(isCiGating('sdk/src/query/init.spec.ts'), true);
    assert.equal(isCiGating('sdk/src/golden/golden.integration.test.ts'), true);
  });

  test('isCiGating rejects non-test sdk/src paths (those ship via sdk/dist)', () => {
    assert.equal(isCiGating('sdk/src/query/init.ts'), false);
    assert.equal(isCiGating('sdk/src/config.ts'), false);
  });

  test('isCiGating rejects paths that merely contain "test" in their name', () => {
    // Guard against /test/ false positives.
    assert.equal(isCiGating('docs/test-strategy.md'), false);
    assert.equal(isCiGating('bin/install-test-helper.js'), false);
    // .test.md is not a recognized spec extension here.
    assert.equal(isCiGating('docs/install.test.md'), false);
  });

  test('classifier exits 0 for a test-only diff (the v1.42.3 case)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-3621-classifier-'));
    try {
      writeMinimalPkg(tmp, ['bin', 'sdk/dist']);
      const result = runClassifier('tests/install-minimal-all-runtimes.test.cjs\n', tmp);
      assert.equal(
        result.status,
        0,
        `tests/** path must classify as shipped-equivalent (status=${result.status}, stderr=${result.stderr})`,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('classifier exits 0 for a mixed test+docs diff (the v1.42.3 commit shape)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-3621-classifier-mixed-'));
    try {
      writeMinimalPkg(tmp, ['bin', 'sdk/dist']);
      const stdin = [
        'README.md',
        'docs/CONFIGURATION.md',
        'docs/USER-GUIDE.md',
        'tests/install-minimal-all-runtimes.test.cjs',
        'tests/installer-migration-install-integration.test.cjs',
      ].join('\n') + '\n';
      const result = runClassifier(stdin, tmp);
      assert.equal(
        result.status,
        0,
        `mixed docs+test diff must classify as shipped-equivalent because at least one path is CI-gating (status=${result.status})`,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('classifier still exits 1 for a pure docs-only diff (no test paths)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-3621-classifier-docs-only-'));
    try {
      writeMinimalPkg(tmp, ['bin', 'sdk/dist']);
      const stdin = 'README.md\ndocs/CONFIGURATION.md\n';
      const result = runClassifier(stdin, tmp);
      assert.equal(
        result.status,
        1,
        `pure docs-only diff must remain NOT_SHIPPED — they aren't CI-gating either (status=${result.status})`,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('classifier still exits 0 for a normal shipped-path diff (pre-fix behavior preserved)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-3621-classifier-shipped-'));
    try {
      writeMinimalPkg(tmp, ['bin', 'sdk/dist']);
      const result = runClassifier('bin/install.js\n', tmp);
      assert.equal(result.status, 0, 'shipped-path classification must not regress');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('classifier still exits 1 for CI-only workflow diffs (.github/** is neither shipped nor CI-gating)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-3621-classifier-ci-'));
    try {
      writeMinimalPkg(tmp, ['bin', 'sdk/dist']);
      const result = runClassifier('.github/workflows/release-sdk.yml\n', tmp);
      assert.equal(
        result.status,
        1,
        'workflow-only changes must remain NOT_SHIPPED — they\'d otherwise fail the push step (default GITHUB_TOKEN lacks workflow scope, #2980)',
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('push-blocking guard wins: workflow + test bundle classifies as NOT_SHIPPED (preserves #2980)', () => {
    // The canonical #2980 case is a `fix(release-sdk):` commit touching
    // both the workflow file and its regression test. Under #3621 the test
    // path alone would otherwise satisfy the CI-gating check; the
    // .github/workflows/* push-blocker must still skip the whole commit.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-3621-classifier-pushblock-'));
    try {
      writeMinimalPkg(tmp, ['bin', 'sdk/dist']);
      const stdin = [
        '.github/workflows/release-sdk.yml',
        'tests/bug-2980-hotfix-only-picks-shipping-changes.test.cjs',
        'CHANGELOG.md',
      ].join('\n') + '\n';
      const result = runClassifier(stdin, tmp);
      assert.equal(
        result.status,
        1,
        '#2980 preservation: bundle with .github/workflows/* must skip regardless of test paths in the same commit',
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
