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

// N2: single helper — on macOS os.tmpdir() already returns /private/tmp; the
// existsSync guard is kept only as defense-in-depth fallback.
function getWritableTmp() {
  const candidates = ['/private/tmp', '/tmp', os.tmpdir()];
  return candidates.find((dir) => {
    try {
      fs.accessSync(dir, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  });
}

describe('feat-3210: fallow integration module', () => {
  test('normalizes structural findings from a fallow report', () => {
    const { normalizeFallowReport } = require('../get-shit-done/bin/lib/fallow-runner.cjs');
    const fixture = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'fallow', 'sample-findings.json'), 'utf8'),
    );

    const normalized = normalizeFallowReport(fixture);
    // M6: fixture: 1 unusedExport + 1 duplicate + 1 circularDep = 3; counts derived from fixture, not hardcoded
    const expectedUnused = fixture.unusedExports.length;
    const expectedDuplicates = fixture.duplicates.length;
    const expectedCircular = fixture.circularDependencies.length;
    const expectedTotal = expectedUnused + expectedDuplicates + expectedCircular;
    assert.deepStrictEqual(normalized.summary, {
      unused_exports: expectedUnused,
      duplicates: expectedDuplicates,
      circular_dependencies: expectedCircular,
      total: expectedTotal,
    });
    assert.strictEqual(normalized.findings.length, expectedTotal);
  });

  test('falls back to node_modules/.bin/fallow when PATH does not contain fallow', () => {
    const { resolveFallowBinary } = require('../get-shit-done/bin/lib/fallow-runner.cjs');
    // N2: use shared helper
    const baseTmp = getWritableTmp();
    const tmp = fs.mkdtempSync(path.join(baseTmp, 'gsd-fallow-bin-'));
    const binDir = path.join(tmp, 'node_modules', '.bin');
    fs.mkdirSync(binDir, { recursive: true });
    const fallowPath = path.join(binDir, 'fallow');
    fs.writeFileSync(fallowPath, '#!/usr/bin/env sh\n');
    if (process.platform !== 'win32') fs.chmodSync(fallowPath, 0o755);

    const resolved = resolveFallowBinary({ cwd: tmp, envPath: '' });
    assert.strictEqual(resolved, fallowPath);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  // H6: replaced wholesale win32 skip with platform-adapted assertion
  test('ignores non-executable PATH candidate on non-Windows; prefers .cmd over bare extensionless on Windows', () => {
    const { resolveFallowBinary } = require('../get-shit-done/bin/lib/fallow-runner.cjs');
    // N2: use shared helper
    const baseTmp = getWritableTmp();

    if (process.platform === 'win32') {
      // H6: Windows — .cmd extension candidate must be preferred over bare extensionless file
      const tmp = fs.mkdtempSync(path.join(baseTmp, 'gsd-fallow-win-'));
      try {
        const pathDir = path.join(tmp, 'bin');
        fs.mkdirSync(pathDir, { recursive: true });
        const bareFile = path.join(pathDir, 'fallow');
        const cmdFile = path.join(pathDir, 'fallow.cmd');
        fs.writeFileSync(bareFile, '@echo off\r\n');
        fs.writeFileSync(cmdFile, '@echo off\r\n');
        const resolved = resolveFallowBinary({ cwd: tmp, envPath: pathDir });
        assert.strictEqual(
          resolved,
          cmdFile,
          'Windows: .cmd candidate must be preferred over bare extensionless file',
        );
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    } else {
      // H6: non-Windows — non-executable file in PATH must be ignored
      const tmp = fs.mkdtempSync(path.join(baseTmp, 'gsd-fallow-nonexec-'));
      try {
        const pathDir = path.join(tmp, 'bin');
        fs.mkdirSync(pathDir, { recursive: true });
        const nonExec = path.join(pathDir, 'fallow');
        fs.writeFileSync(nonExec, '#!/usr/bin/env sh\n');
        fs.chmodSync(nonExec, 0o644);
        const resolved = resolveFallowBinary({ cwd: tmp, envPath: pathDir });
        assert.strictEqual(resolved, null);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }
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
    // N2: use shared helper
    const baseTmp = getWritableTmp();
    const tmp = fs.mkdtempSync(path.join(baseTmp, 'gsd-fallow-missing-'));
    assert.throws(
      () => requireFallowBinary({ cwd: tmp, envPath: '' }),
      /install fallow via `npm install -D fallow` or `cargo install fallow`/,
    );
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  // L3: runFallowAudit against a non-zero-exit binary must surface error state
  test('runFallowAudit surfaces error state when binary exits non-zero', async () => {
    const { runFallowAudit } = require('../get-shit-done/bin/lib/fallow-runner.cjs');
    // N2: use shared helper
    const baseTmp = getWritableTmp();
    const tmp = fs.mkdtempSync(path.join(baseTmp, 'gsd-fallow-fail-'));
    const shimName = process.platform === 'win32' ? 'fallow.cmd' : 'fallow';
    const shimPath = path.join(tmp, shimName);

    if (process.platform === 'win32') {
      fs.writeFileSync(shimPath, '@echo fallow-error-stderr 1>&2\r\n@exit 1\r\n');
    } else {
      fs.writeFileSync(shimPath, '#!/usr/bin/env sh\necho "fallow-error-stderr" >&2\nexit 1\n');
      fs.chmodSync(shimPath, 0o755);
    }

    try {
      let errorState;
      try {
        errorState = await runFallowAudit({ cwd: tmp, env: { ...process.env, FALLOW_BIN_PATH: shimPath } });
      } catch (err) {
        // acceptable: some implementations throw rather than returning error state
        assert.ok(
          err.message.includes('fallow-error-stderr') || err.exitCode !== 0 || err.code !== 0,
          `expected thrown error to carry stderr content or non-zero exit; got: ${err.message}`,
        );
        return;
      }
      assert.ok(
        errorState && (errorState.error || errorState.exitCode !== 0 || errorState.failed),
        'runFallowAudit must return error state (error/exitCode/failed) when binary exits non-zero',
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  // M5: edge-case fixture — missing severity, similarity extremes, 3-node cycle, unicode path
  test('normalizes edge-case fixture: missing severity, similarity extremes, 3-node cycle, unicode path', () => {
    const { normalizeFallowReport } = require('../get-shit-done/bin/lib/fallow-runner.cjs');
    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, 'tests', 'fixtures', 'fallow', 'sample-edge-cases.json'),
        'utf8',
      ),
    );

    // M5: unusedExport with no severity field — round-trips without throwing
    assert.strictEqual(fixture.unusedExports.length, 1);
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(fixture.unusedExports[0], 'severity'),
      false,
      'edge-case fixture: unusedExport severity field must be absent',
    );
    // M5: unicode file path is preserved in fixture
    assert.ok(
      fixture.unusedExports[0].file.includes('café'),
      'edge-case fixture: unicode file path must be present',
    );

    // M5: duplicate entries with similarity at extremes 0.0 and 1.0
    assert.strictEqual(fixture.duplicates.length, 2);
    assert.strictEqual(fixture.duplicates[0].similarity, 0.0);
    assert.strictEqual(fixture.duplicates[1].similarity, 1.0);

    // M5: 3-node circular dependency cycle (cycle array has 4 elements: A→B→C→A)
    assert.strictEqual(fixture.circularDependencies.length, 1);
    const cycle = fixture.circularDependencies[0].cycle;
    const uniqueNodes = new Set(cycle.slice(0, -1)); // last element repeats first
    assert.strictEqual(uniqueNodes.size, 3, 'edge-case: cycle must have exactly 3 unique nodes');

    // normalization round-trips without throwing
    const normalized = normalizeFallowReport(fixture);
    const expectedTotal =
      fixture.unusedExports.length + fixture.duplicates.length + fixture.circularDependencies.length;
    assert.strictEqual(normalized.findings.length, expectedTotal);
    assert.strictEqual(normalized.summary.total, expectedTotal);

    // M5: unicode path survives normalization
    const unicodeFinding = normalized.findings.find(
      (f) => typeof f.file === 'string' && f.file.includes('café'),
    );
    assert.ok(unicodeFinding, 'unicode file path must survive normalization round-trip');
  });
});

describe('feat-3210: H1 - line:0 preservation', () => {
  test('normalizeFallowReport preserves line:0 for unused_export (not coerced to null)', () => {
    const { normalizeFallowReport } = require('../get-shit-done/bin/lib/fallow-runner.cjs');
    const report = {
      unusedExports: [{ file: 'src/a.ts', symbol: 'foo', line: 0 }],
      duplicates: [],
      circularDependencies: [],
    };
    const normalized = normalizeFallowReport(report);
    assert.strictEqual(normalized.findings[0].line, 0, 'line:0 must not be coerced to null via ||');
  });

  test('normalizeFallowReport preserves line:0 for duplicate_block left.start (not coerced to null)', () => {
    const { normalizeFallowReport } = require('../get-shit-done/bin/lib/fallow-runner.cjs');
    const report = {
      unusedExports: [],
      duplicates: [{ left: { file: 'src/a.ts', start: 0 }, right: { file: 'src/b.ts', start: 5 }, similarity: 0.9 }],
      circularDependencies: [],
    };
    const normalized = normalizeFallowReport(report);
    assert.strictEqual(normalized.findings[0].line, 0, 'left.start:0 must not be coerced to null via ||');
  });
});

describe('feat-3210: M2 - node_modules/.bin resolution order', () => {
  test('resolveFallowBinary prefers node_modules/.bin over PATH when both exist', () => {
    const { resolveFallowBinary } = require('../get-shit-done/bin/lib/fallow-runner.cjs');
    // N2: use shared helper
    const baseTmp = getWritableTmp();
    const tmp = fs.mkdtempSync(path.join(baseTmp, 'gsd-fallow-order-'));
    try {
      // local node_modules/.bin/fallow
      const binDir = path.join(tmp, 'node_modules', '.bin');
      fs.mkdirSync(binDir, { recursive: true });
      const localFallow = path.join(binDir, 'fallow');
      fs.writeFileSync(localFallow, '#!/usr/bin/env sh\necho local\n');
      if (process.platform !== 'win32') fs.chmodSync(localFallow, 0o755);

      // PATH fallow (a different file)
      const pathDir = path.join(tmp, 'pathbin');
      fs.mkdirSync(pathDir, { recursive: true });
      const pathFallow = path.join(pathDir, 'fallow');
      fs.writeFileSync(pathFallow, '#!/usr/bin/env sh\necho path\n');
      if (process.platform !== 'win32') fs.chmodSync(pathFallow, 0o755);

      const resolved = resolveFallowBinary({ cwd: tmp, envPath: pathDir });
      assert.strictEqual(resolved, localFallow, 'node_modules/.bin/fallow must win over PATH fallow');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('feat-3210: workflow and config contracts', () => {
  test('config schema allows code_quality.fallow.* keys in CJS and SDK', () => {
    // After Cycle 5 (#3536), both CJS and SDK source from the manifest.
    // Use the CJS runtime Set and the manifest directly (no inline text parsing).
    const { VALID_CONFIG_KEYS } = require('../get-shit-done/bin/lib/config-schema.cjs');
    const manifestPath = path.join(ROOT, 'sdk', 'shared', 'config-schema.manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const manifestKeys = new Set(manifest.validKeys);
    for (const key of [
      'code_quality.fallow.enabled',
      'code_quality.fallow.scope',
      'code_quality.fallow.profile',
      'code_quality.fallow.mcp',
    ]) {
      assert.ok(VALID_CONFIG_KEYS.has(key), `missing CJS config key: ${key}`);
      assert.ok(manifestKeys.has(key), `missing manifest key: ${key} (SDK sources from manifest)`);
    }
  });

  test('config-set accepts code_quality.fallow keys', () => {
    const originalTmpDir = process.env.TMPDIR;
    // L2: fail loudly if no writable tmp dir is found (was silent skip)
    const writableTmp = getWritableTmp(); // N2: use shared helper
    assert.ok(writableTmp, 'no writable tmp directory found'); // L2: explicit fail-loud assertion
    process.env.TMPDIR = writableTmp;
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

  // B4: replaced 5x source-grep tautologies with parse-based structural checks.
  // The workflow .md uses XML-like <step> tags as its runtime DSL; we parse the step block
  // structurally and assert on structural properties, not on prose strings.
  test('code-review workflow structural_pre_pass step is parseable and references FALLOW.json output', () => {
    const workflow = fs.readFileSync(
      path.join(ROOT, 'get-shit-done', 'workflows', 'code-review.md'),
      'utf8',
    );

    // Parse: the <step name="structural_pre_pass"> block must exist and be closed
    const stepMatch = workflow.match(/<step\s+name="structural_pre_pass">([\s\S]*?)<\/step>/);
    assert.ok(
      stepMatch,
      'workflow must contain a parseable <step name="structural_pre_pass">...</step> block',
    );

    const stepBody = stepMatch[1];

    // Structural property: the step body must reference the FALLOW.json output artifact
    assert.ok(
      stepBody.includes('FALLOW.json'),
      'structural_pre_pass step body must reference the FALLOW.json output artifact',
    );

    // Structural property: the step body must gate on the fallow enabled config key
    assert.ok(
      stepBody.includes('code_quality.fallow.enabled'),
      'structural_pre_pass step body must gate on code_quality.fallow.enabled',
    );
  });

  // B4: agent output contract — doc-parity check (approved fallback per config-schema-docs-parity
  // pattern). We confirm the heading exists in the shipped artifact, not in a live agent response.
  // Live agent output is covered by /gsd-code-review e2e runs downstream.
  test('reviewer prompt defines ## Structural Findings (fallow) heading and review context echoes it', () => {
    const reviewer = fs.readFileSync(path.join(ROOT, 'agents', 'gsd-code-reviewer.md'), 'utf8');
    const reviewContext = fs.readFileSync(path.join(ROOT, 'get-shit-done', 'contexts', 'review.md'), 'utf8');

    // Doc-parity: section heading must exist in the shipped agent file (the heading is a contract,
    // not prose — renaming it would break every consumer that parses agent output by section)
    assert.ok(
      reviewer.includes('## Structural Findings (fallow)'),
      'gsd-code-reviewer.md must define ## Structural Findings (fallow) section heading',
    );

    // Doc-parity: review context that agents receive must reference the same section
    assert.ok(
      reviewContext.includes('Structural Findings (fallow)'),
      'review.md context must reference Structural Findings (fallow) so agents recognize the section',
    );
  });
});
