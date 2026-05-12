// allow-test-rule: source-text-is-the-product
// This test validates workflow/agent/config contracts stored in shipped .md/.ts/.cjs
// artifacts. Source text is the runtime product for those surfaces.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

const ROOT = path.resolve(__dirname, '..');

describe('feat-3210: fallow integration module', () => {
  test('normalizes structural findings from a fallow report', () => {
    const { normalizeFallowReport } = require('../get-shit-done/bin/lib/fallow-runner.cjs');
    const fixture = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'fallow', 'sample-findings.json'), 'utf8'),
    );

    const normalized = normalizeFallowReport(fixture);
    assert.deepStrictEqual(normalized.summary, {
      unused_exports: 1,
      duplicates: 1,
      circular_dependencies: 1,
      total: 3,
    });
    assert.strictEqual(normalized.findings.length, 3);
  });

  test('falls back to node_modules/.bin/fallow when PATH does not contain fallow', () => {
    const { resolveFallowBinary } = require('../get-shit-done/bin/lib/fallow-runner.cjs');
    const baseTmp = fs.existsSync('/private/tmp') ? '/private/tmp' : os.tmpdir();
    const tmp = fs.mkdtempSync(path.join(baseTmp, 'gsd-fallow-bin-'));
    const binDir = path.join(tmp, 'node_modules', '.bin');
    fs.mkdirSync(binDir, { recursive: true });
    const fallowPath = path.join(binDir, 'fallow');
    fs.writeFileSync(fallowPath, '#!/usr/bin/env sh\n');

    const resolved = resolveFallowBinary({ cwd: tmp, envPath: '' });
    assert.strictEqual(resolved, fallowPath);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('normalizes empty fallow report to zero findings', () => {
    const { normalizeFallowReport } = require('../get-shit-done/bin/lib/fallow-runner.cjs');
    const fixture = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'fallow', 'sample-empty.json'), 'utf8'),
    );
    const normalized = normalizeFallowReport(fixture);
    assert.deepStrictEqual(normalized.summary, {
      unused_exports: 0,
      duplicates: 0,
      circular_dependencies: 0,
      total: 0,
    });
    assert.deepStrictEqual(normalized.findings, []);
  });

  test('throws actionable error when fallow is enabled but binary is unavailable', () => {
    const { requireFallowBinary } = require('../get-shit-done/bin/lib/fallow-runner.cjs');
    const baseTmp = fs.existsSync('/private/tmp') ? '/private/tmp' : os.tmpdir();
    const tmp = fs.mkdtempSync(path.join(baseTmp, 'gsd-fallow-missing-'));
    assert.throws(
      () => requireFallowBinary({ cwd: tmp, envPath: '' }),
      /install fallow via `npm install -D fallow` or `cargo install fallow`/,
    );
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('feat-3210: workflow and config contracts', () => {
  test('config schema allows code_quality.fallow.* keys in CJS and SDK', () => {
    const cjsSchema = fs.readFileSync(
      path.join(ROOT, 'get-shit-done', 'bin', 'lib', 'config-schema.cjs'),
      'utf8',
    );
    const sdkSchema = fs.readFileSync(
      path.join(ROOT, 'sdk', 'src', 'query', 'config-schema.ts'),
      'utf8',
    );
    for (const key of [
      'code_quality.fallow.enabled',
      'code_quality.fallow.scope',
      'code_quality.fallow.profile',
      'code_quality.fallow.mcp',
    ]) {
      assert.ok(cjsSchema.includes(`'${key}'`), `missing CJS config key: ${key}`);
      assert.ok(sdkSchema.includes(`'${key}'`), `missing SDK config key: ${key}`);
    }
  });

  test('config-set accepts code_quality.fallow keys', () => {
    const originalTmpDir = process.env.TMPDIR;
    const tmpCandidates = ['/private/tmp', '/tmp', os.tmpdir()];
    const writableTmp = tmpCandidates.find((dir) => {
      try {
        fs.accessSync(dir, fs.constants.W_OK);
        return true;
      } catch {
        return false;
      }
    });
    if (writableTmp) process.env.TMPDIR = writableTmp;
    const tmpDir = createTempProject('gsd-fallow-config-');
    try {
      const cases = [
        ['code_quality.fallow.enabled', 'true'],
        ['code_quality.fallow.scope', 'repo'],
        ['code_quality.fallow.profile', 'strict'],
        ['code_quality.fallow.mcp', 'false'],
      ];
      for (const [key, value] of cases) {
        const result = runGsdTools(['config-set', key, value], tmpDir);
        assert.ok(result.success, `config-set failed for ${key}: ${result.error || result.output}`);
      }
    } finally {
      cleanup(tmpDir);
      if (originalTmpDir === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = originalTmpDir;
    }
  });

  test('code-review workflow includes structural_pre_pass and writes FALLOW.json', () => {
    const workflow = fs.readFileSync(
      path.join(ROOT, 'get-shit-done', 'workflows', 'code-review.md'),
      'utf8',
    );
    assert.ok(workflow.includes('<step name="structural_pre_pass">'));
    assert.ok(workflow.includes('code_quality.fallow.enabled'));
    assert.ok(workflow.includes('FALLOW.json'));
    assert.ok(workflow.includes('<structural_findings>'));
  });

  test('reviewer prompt and review context define structural findings section', () => {
    const reviewer = fs.readFileSync(path.join(ROOT, 'agents', 'gsd-code-reviewer.md'), 'utf8');
    const reviewContext = fs.readFileSync(path.join(ROOT, 'get-shit-done', 'contexts', 'review.md'), 'utf8');
    assert.ok(reviewer.includes('## Structural Findings (fallow)'));
    assert.ok(reviewer.includes('ground truth'));
    assert.ok(reviewContext.includes('Structural Findings (fallow)'));
  });
});
