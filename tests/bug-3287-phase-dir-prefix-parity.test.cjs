'use strict';
/**
 * Regression test for #3287 — phase-dir prefix parity across creation paths.
 *
 * Projects with `project_code` set in `.planning/config.json` must get the
 * same `<CODE>-<NN>-<slug>` directory shape from ALL phase-creation paths,
 * not just from `phase.add` / `phase.insert`.
 *
 * Three tests:
 *   A — sanity: `phase.add` emits the prefixed dir (already works).
 *   B — init phase-op exposes `expected_phase_dir` with the prefix when
 *       the directory does not yet exist (first-touch path for /gsd-discuss-phase).
 *   C — init plan-phase exposes `expected_phase_dir` with the prefix when
 *       the directory does not yet exist (first-touch path for /gsd-plan-phase).
 *
 * Tests B and C are RED until the fix lands.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── shared fixture ──────────────────────────────────────────────────────────

function makeXRProject(tmpDir) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ project_code: 'XR' }),
  );
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    [
      '# Roadmap v1.0',
      '',
      '### Phase 1: Foundation',
      '**Goal:** Setup project',
      '**Plans:** 0 plans',
      '',
      '---',
      '',
    ].join('\n'),
  );
}

// ─── Test A — sanity: phase.add honours project_code ─────────────────────────

describe('bug-3287 — phase.add emits project_code prefix (sanity)', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('phase.add creates XR-02-<slug> when project_code is XR', () => {
    makeXRProject(tmpDir);

    const result = runGsdTools('phase add auth service', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `phase.add failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 2, 'phase number should be 2');

    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    const dirs = fs.readdirSync(phasesDir);
    const prefixedDirs = dirs.filter(d => d.startsWith('XR-'));
    assert.ok(
      prefixedDirs.length > 0,
      `Expected at least one XR- prefixed dir, got: ${JSON.stringify(dirs)}`,
    );
    assert.ok(
      dirs.some(d => d === 'XR-02-auth-service'),
      `Expected XR-02-auth-service, got: ${JSON.stringify(dirs)}`,
    );
  });
});

// ─── Test B — init phase-op exposes expected_phase_dir with prefix ────────────

describe('bug-3287 — init phase-op exposes expected_phase_dir with project_code prefix', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('returns expected_phase_dir with XR- prefix when phase directory does not exist', () => {
    makeXRProject(tmpDir);

    // Phase 1 is in the roadmap but has no directory yet — the first-touch path
    const result = runGsdTools('init phase-op 1', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `init phase-op failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_found, true, 'phase should be found in roadmap');
    assert.strictEqual(output.phase_dir, null, 'phase_dir should be null (no dir yet)');

    // The fix: expected_phase_dir must carry the project_code prefix
    assert.ok(
      typeof output.expected_phase_dir === 'string',
      `expected_phase_dir should be a string, got: ${JSON.stringify(output.expected_phase_dir)}`,
    );
    assert.ok(
      output.expected_phase_dir.includes('XR-'),
      `expected_phase_dir should contain XR- prefix, got: "${output.expected_phase_dir}"`,
    );
    assert.ok(
      output.expected_phase_dir.includes('foundation'),
      `expected_phase_dir should contain the phase slug, got: "${output.expected_phase_dir}"`,
    );
  });

  test('expected_phase_dir is null when no project_code is set', () => {
    // No project_code — expected_phase_dir should still be present but without prefix
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({}),
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n\n---\n',
    );

    const result = runGsdTools('init phase-op 1', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `init phase-op failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_dir, null);
    assert.ok(
      typeof output.expected_phase_dir === 'string',
      `expected_phase_dir should be a string even without project_code, got: ${JSON.stringify(output.expected_phase_dir)}`,
    );
    // Without project_code, should have no prefix — just NN-slug
    assert.ok(
      !output.expected_phase_dir.match(/^[A-Z][A-Z0-9]*-/),
      `expected_phase_dir should have NO prefix without project_code, got: "${output.expected_phase_dir}"`,
    );
  });
});

// ─── Test C — init plan-phase exposes expected_phase_dir with prefix ──────────

describe('bug-3287 — init plan-phase exposes expected_phase_dir with project_code prefix', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('returns expected_phase_dir with XR- prefix when phase directory does not exist', () => {
    makeXRProject(tmpDir);

    // Phase 1 is in the roadmap but has no directory yet — the first-touch path
    const result = runGsdTools('init plan-phase 1', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `init plan-phase failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_found, true, 'phase should be found in roadmap');
    assert.strictEqual(output.phase_dir, null, 'phase_dir should be null (no dir yet)');

    // The fix: expected_phase_dir must carry the project_code prefix
    assert.ok(
      typeof output.expected_phase_dir === 'string',
      `expected_phase_dir should be a string, got: ${JSON.stringify(output.expected_phase_dir)}`,
    );
    assert.ok(
      output.expected_phase_dir.includes('XR-'),
      `expected_phase_dir should contain XR- prefix, got: "${output.expected_phase_dir}"`,
    );
    assert.ok(
      output.expected_phase_dir.includes('foundation'),
      `expected_phase_dir should contain the phase slug, got: "${output.expected_phase_dir}"`,
    );
  });

  test('expected_phase_dir omits prefix when project_code is not set', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({}),
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n\n---\n',
    );

    const result = runGsdTools('init plan-phase 1', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `init plan-phase failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_dir, null);
    assert.ok(
      typeof output.expected_phase_dir === 'string',
      `expected_phase_dir should be a string, got: ${JSON.stringify(output.expected_phase_dir)}`,
    );
    assert.ok(
      !output.expected_phase_dir.match(/^[A-Z][A-Z0-9]*-/),
      `expected_phase_dir should have NO prefix without project_code, got: "${output.expected_phase_dir}"`,
    );
  });
});
