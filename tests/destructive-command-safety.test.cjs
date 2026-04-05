/**
 * GSD Tools Tests - Destructive Command Safety Guards (#1818)
 *
 * Verifies that destructive commands reject unknown flags, require --confirm,
 * and that the global --help guard prevents execution.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── Helper: create a project with phase directories ─────────────────────────

function createProjectWithPhases(tmpDir) {
  const phasesDir = path.join(tmpDir, '.planning', 'phases');
  fs.mkdirSync(path.join(phasesDir, '01-foundation'), { recursive: true });
  fs.writeFileSync(path.join(phasesDir, '01-foundation', '01-01-PLAN.md'), '# Plan');
  fs.mkdirSync(path.join(phasesDir, '02-api'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    '# Roadmap\n### Phase 1: Foundation\n**Goal:** Setup\n### Phase 2: API\n**Goal:** Build\n'
  );
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    '# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n**Total Phases:** 2\n'
  );
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
    '# Requirements\n\n- [ ] User auth\n'
  );
}

// ─── Global --help guard ─────────────────────────────────────────────────────

describe('global --help guard (#1818)', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  const destructiveCommands = [
    'phases clear --help',
    'phase remove 1 --help',
    'milestone complete v1.0 --help',
    'workstream complete test --help',
    'frontmatter set file.md --help',
    'todo complete file.md --help',
    'validate health --help',
    'generate-claude-md --help',
  ];

  for (const cmd of destructiveCommands) {
    test(`"${cmd}" shows help without executing`, () => {
      createProjectWithPhases(tmpDir);
      const result = runGsdTools(cmd, tmpDir);
      assert.ok(result.success, `should exit cleanly, got error: ${result.error}`);
      assert.ok(result.output.includes('Usage:'), `should show usage, got: ${result.output}`);
    });
  }

  test('--help with --raw returns JSON', () => {
    const result = runGsdTools('phases clear --help --raw', tmpDir);
    assert.ok(result.success);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.help, true);
  });
});

// ─── Unknown flag rejection ──────────────────────────────────────────────────

describe('unknown flag rejection (#1818)', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); createProjectWithPhases(tmpDir); });
  afterEach(() => { cleanup(tmpDir); });

  test('phases clear rejects unknown flags', () => {
    const result = runGsdTools('phases clear --dry-run', tmpDir);
    assert.ok(!result.success);
    assert.ok(result.error.includes('Unknown flag'));
  });

  test('phase remove rejects unknown flags', () => {
    const result = runGsdTools('phase remove 1 --confirm --dry-run', tmpDir);
    assert.ok(!result.success);
    assert.ok(result.error.includes('Unknown flag'));
  });

  test('phase complete rejects unknown flags', () => {
    const result = runGsdTools('phase complete 1 --verbose', tmpDir);
    assert.ok(!result.success);
    assert.ok(result.error.includes('Unknown flag'));
  });

  test('milestone complete rejects unknown flags', () => {
    const result = runGsdTools('milestone complete v1.0 --confirm --typo', tmpDir);
    assert.ok(!result.success);
    assert.ok(result.error.includes('Unknown flag'));
  });

  test('workstream complete rejects unknown flags', () => {
    const result = runGsdTools('workstream complete test --confirm --bogus', tmpDir);
    assert.ok(!result.success);
    assert.ok(result.error.includes('Unknown flag'));
  });

  test('workstream create rejects unknown flags', () => {
    const result = runGsdTools('workstream create test --bogus', tmpDir);
    assert.ok(!result.success);
    assert.ok(result.error.includes('Unknown flag'));
  });

  test('validate health rejects unknown flags', () => {
    const result = runGsdTools('validate health --bogus', tmpDir);
    assert.ok(!result.success);
    assert.ok(result.error.includes('Unknown flag'));
  });

  test('generate-claude-md rejects unknown flags', () => {
    const result = runGsdTools('generate-claude-md --bogus', tmpDir);
    assert.ok(!result.success);
    assert.ok(result.error.includes('Unknown flag'));
  });

  test('write-profile rejects unknown flags', () => {
    const result = runGsdTools('write-profile --input /tmp/test.json --bogus', tmpDir);
    assert.ok(!result.success);
    assert.ok(result.error.includes('Unknown flag'));
  });

  test('frontmatter set rejects unknown flags', () => {
    const mdFile = path.join(tmpDir, '.planning', 'STATE.md');
    const relFile = path.relative(tmpDir, mdFile);
    const result = runGsdTools(`frontmatter set ${relFile} --field status --value done --bogus`, tmpDir);
    assert.ok(!result.success);
    assert.ok(result.error.includes('Unknown flag'));
  });

  test('todo complete rejects unknown flags', () => {
    const result = runGsdTools('todo complete test.md --bogus', tmpDir);
    assert.ok(!result.success);
    assert.ok(result.error.includes('Unknown flag'));
  });
});

// ─── --confirm requirement for critical commands ─────────────────────────────

describe('--confirm requirement for critical commands (#1818)', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); createProjectWithPhases(tmpDir); });
  afterEach(() => { cleanup(tmpDir); });

  test('phases clear requires --confirm when directories exist', () => {
    const result = runGsdTools('phases clear', tmpDir);
    assert.ok(!result.success);
    assert.ok(result.error.includes('--confirm'));
    // Directories must survive
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'phases', '01-foundation')));
  });

  test('phase remove requires --confirm', () => {
    const result = runGsdTools('phase remove 2', tmpDir);
    assert.ok(!result.success);
    assert.ok(result.error.includes('--confirm'));
    // Directory must survive
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'phases', '02-api')));
  });

  test('milestone complete requires --confirm', () => {
    const result = runGsdTools('milestone complete v1.0 --name Test', tmpDir);
    assert.ok(!result.success);
    assert.ok(result.error.includes('--confirm'));
  });

  test('workstream complete requires --confirm', () => {
    // Create a workstream to complete
    const wsDir = path.join(tmpDir, '.planning', 'workstreams', 'test-ws');
    fs.mkdirSync(path.join(wsDir, 'phases'), { recursive: true });
    fs.writeFileSync(path.join(wsDir, 'STATE.md'), '# State\n');

    const result = runGsdTools(['workstream', 'complete', 'test-ws', '--raw'], tmpDir);
    assert.ok(!result.success);
    assert.ok(result.error.includes('--confirm'));
    // Workstream must survive
    assert.ok(fs.existsSync(wsDir));
  });
});
