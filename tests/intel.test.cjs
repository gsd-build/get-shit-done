/**
 * Tests for get-shit-done/bin/lib/intel.cjs
 *
 * Covers: query, status, diff, validate, snapshot, patch-meta,
 * extract-exports, enabled/disabled gating, and CLI routing via gsd-tools.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

const {
  intelQuery,
  intelStatus,
  intelDiff,
  intelValidate,
  intelSnapshot,
  intelPatchMeta,
  intelExtractExports,
  ensureIntelDir,
  isIntelEnabled,
  INTEL_FILES,
} = require('../get-shit-done/bin/lib/intel.cjs');

// ─── Helpers ────────────────────────────────────────────────────────────────

function enableIntel(planningDir) {
  const configPath = path.join(planningDir, 'config.json');
  const config = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {};
  config.intel = { enabled: true };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

function writeIntelJson(planningDir, filename, data) {
  const intelPath = path.join(planningDir, 'intel');
  fs.mkdirSync(intelPath, { recursive: true });
  fs.writeFileSync(
    path.join(intelPath, filename),
    JSON.stringify(data, null, 2),
    'utf8'
  );
}

function writeIntelMd(planningDir, filename, content) {
  const intelPath = path.join(planningDir, 'intel');
  fs.mkdirSync(intelPath, { recursive: true });
  fs.writeFileSync(path.join(intelPath, filename), content, 'utf8');
}

// ─── Disabled gating ────────────────────────────────────────────────────────

describe('intel disabled gating', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    planningDir = path.join(tmpDir, '.planning');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('isIntelEnabled returns false when no config.json exists', () => {
    assert.strictEqual(isIntelEnabled(planningDir), false);
  });

  test('isIntelEnabled returns false when intel.enabled is not set', () => {
    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }),
      'utf8'
    );
    assert.strictEqual(isIntelEnabled(planningDir), false);
  });

  test('isIntelEnabled returns true when intel.enabled is true', () => {
    enableIntel(planningDir);
    assert.strictEqual(isIntelEnabled(planningDir), true);
  });

  test('intelQuery returns disabled response when intel is off', () => {
    const result = intelQuery('test', planningDir);
    assert.strictEqual(result.disabled, true);
    assert.ok(result.message.includes('disabled'));
  });

  test('intelStatus returns disabled response when intel is off', () => {
    const result = intelStatus(planningDir);
    assert.strictEqual(result.disabled, true);
  });

  test('intelDiff returns disabled response when intel is off', () => {
    const result = intelDiff(planningDir);
    assert.strictEqual(result.disabled, true);
  });

  test('intelValidate returns disabled response when intel is off', () => {
    const result = intelValidate(planningDir);
    assert.strictEqual(result.disabled, true);
  });
});

// ─── ensureIntelDir ─────────────────────────────────────────────────────────

describe('ensureIntelDir', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    planningDir = path.join(tmpDir, '.planning');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates intel directory if it does not exist', () => {
    const intelPath = ensureIntelDir(planningDir);
    assert.ok(fs.existsSync(intelPath));
    assert.ok(intelPath.endsWith('intel'));
  });

  test('returns existing intel directory without error', () => {
    fs.mkdirSync(path.join(planningDir, 'intel'), { recursive: true });
    const intelPath = ensureIntelDir(planningDir);
    assert.ok(fs.existsSync(intelPath));
  });
});

// ─── intelQuery ─────────────────────────────────────────────────────────────

describe('intelQuery', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    planningDir = path.join(tmpDir, '.planning');
    enableIntel(planningDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns empty matches when no intel files exist', () => {
    const result = intelQuery('anything', planningDir);
    assert.strictEqual(result.total, 0);
    assert.deepStrictEqual(result.matches, []);
    assert.strictEqual(result.term, 'anything');
  });

  test('finds matches in JSON file keys', () => {
    writeIntelJson(planningDir, 'files.json', {
      _meta: { updated_at: new Date().toISOString() },
      entries: {
        'src/auth/controller.ts': { size: 1024, type: 'typescript' },
        'src/utils/logger.ts': { size: 512, type: 'typescript' },
      },
    });

    const result = intelQuery('auth', planningDir);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.matches[0].source, 'files.json');
    assert.strictEqual(result.matches[0].entries[0].key, 'src/auth/controller.ts');
  });

  test('finds matches in JSON file values', () => {
    writeIntelJson(planningDir, 'deps.json', {
      _meta: { updated_at: new Date().toISOString() },
      entries: {
        express: { version: '4.18.0', type: 'runtime', used_by: ['src/server.ts'] },
      },
    });

    const result = intelQuery('express', planningDir);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.matches[0].entries[0].key, 'express');
  });

  test('search is case-insensitive', () => {
    writeIntelJson(planningDir, 'files.json', {
      entries: {
        'src/AuthController.ts': { type: 'typescript' },
      },
    });

    const result = intelQuery('authcontroller', planningDir);
    assert.strictEqual(result.total, 1);
  });

  test('finds matches in arch.md text', () => {
    writeIntelMd(planningDir, 'arch.md', [
      '# Architecture',
      '',
      'The system uses a layered architecture with REST API endpoints.',
      'Authentication is handled by JWT tokens.',
    ].join('\n'));

    const result = intelQuery('JWT', planningDir);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.matches[0].source, 'arch.md');
  });

  test('searches across multiple intel files', () => {
    writeIntelJson(planningDir, 'files.json', {
      entries: { 'src/auth.ts': { exports: ['authenticate'] } },
    });
    writeIntelJson(planningDir, 'apis.json', {
      entries: { '/api/auth': { method: 'POST', handler: 'authenticate' } },
    });

    const result = intelQuery('auth', planningDir);
    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.matches.length, 2);
  });
});

// ─── intelStatus ────────────────────────────────────────────────────────────

describe('intelStatus', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    planningDir = path.join(tmpDir, '.planning');
    enableIntel(planningDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('reports missing files as stale', () => {
    const result = intelStatus(planningDir);
    assert.strictEqual(result.overall_stale, true);
    assert.strictEqual(result.files['files.json'].exists, false);
    assert.strictEqual(result.files['files.json'].stale, true);
  });

  test('reports fresh files as not stale', () => {
    writeIntelJson(planningDir, 'files.json', {
      _meta: { updated_at: new Date().toISOString() },
      entries: {},
    });

    const result = intelStatus(planningDir);
    assert.strictEqual(result.files['files.json'].exists, true);
    assert.strictEqual(result.files['files.json'].stale, false);
  });

  test('reports old files as stale', () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    writeIntelJson(planningDir, 'files.json', {
      _meta: { updated_at: oldDate },
      entries: {},
    });

    const result = intelStatus(planningDir);
    assert.strictEqual(result.files['files.json'].stale, true);
    assert.strictEqual(result.overall_stale, true);
  });
});

// ─── intelDiff ──────────────────────────────────────────────────────────────

describe('intelDiff', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    planningDir = path.join(tmpDir, '.planning');
    enableIntel(planningDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns no_baseline when no snapshot exists', () => {
    const result = intelDiff(planningDir);
    assert.strictEqual(result.no_baseline, true);
  });

  test('detects added files since snapshot', () => {
    // Save an empty snapshot
    const intelPath = ensureIntelDir(planningDir);
    fs.writeFileSync(
      path.join(intelPath, '.last-refresh.json'),
      JSON.stringify({ hashes: {}, timestamp: new Date().toISOString(), version: 1 }),
      'utf8'
    );

    // Add a file after snapshot
    writeIntelJson(planningDir, 'files.json', { entries: {} });

    const result = intelDiff(planningDir);
    assert.ok(result.added.includes('files.json'));
  });

  test('detects changed files since snapshot', () => {
    // Write initial file
    writeIntelJson(planningDir, 'files.json', { entries: { a: 1 } });

    // Take snapshot
    intelSnapshot(planningDir);

    // Modify file
    writeIntelJson(planningDir, 'files.json', { entries: { a: 1, b: 2 } });

    const result = intelDiff(planningDir);
    assert.ok(result.changed.includes('files.json'));
  });
});

// ─── intelSnapshot ──────────────────────────────────────────────────────────

describe('intelSnapshot', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    planningDir = path.join(tmpDir, '.planning');
    enableIntel(planningDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('saves snapshot with file hashes', () => {
    writeIntelJson(planningDir, 'files.json', { entries: {} });

    const result = intelSnapshot(planningDir);
    assert.strictEqual(result.saved, true);
    assert.strictEqual(result.files, 1);
    assert.ok(result.timestamp);

    const snapshot = JSON.parse(
      fs.readFileSync(path.join(planningDir, 'intel', '.last-refresh.json'), 'utf8')
    );
    assert.ok(snapshot.hashes['files.json']);
  });
});

// ─── intelValidate ──────────────────────────────────────────────────────────

describe('intelValidate', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    planningDir = path.join(tmpDir, '.planning');
    enableIntel(planningDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('reports errors for missing files', () => {
    const result = intelValidate(planningDir);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some(e => e.includes('does not exist')));
  });

  test('reports warnings for missing _meta.updated_at', () => {
    writeIntelJson(planningDir, 'files.json', { entries: {} });
    writeIntelJson(planningDir, 'apis.json', { entries: {} });
    writeIntelJson(planningDir, 'deps.json', { entries: {} });
    writeIntelJson(planningDir, 'stack.json', { entries: {} });
    writeIntelMd(planningDir, 'arch.md', '# Architecture\n');

    const result = intelValidate(planningDir);
    assert.strictEqual(result.valid, true);
    assert.ok(result.warnings.some(w => w.includes('missing _meta.updated_at')));
  });

  test('reports invalid JSON as error', () => {
    const intelPath = path.join(planningDir, 'intel');
    fs.mkdirSync(intelPath, { recursive: true });
    fs.writeFileSync(path.join(intelPath, 'files.json'), 'not valid json', 'utf8');
    writeIntelJson(planningDir, 'apis.json', { entries: {} });
    writeIntelJson(planningDir, 'deps.json', { entries: {} });
    writeIntelJson(planningDir, 'stack.json', { entries: {} });
    writeIntelMd(planningDir, 'arch.md', '# Architecture\n');

    const result = intelValidate(planningDir);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('invalid JSON')));
  });

  test('passes validation with complete fresh intel', () => {
    const now = new Date().toISOString();
    writeIntelJson(planningDir, 'files.json', {
      _meta: { updated_at: now },
      entries: {},
    });
    writeIntelJson(planningDir, 'apis.json', {
      _meta: { updated_at: now },
      entries: {},
    });
    writeIntelJson(planningDir, 'deps.json', {
      _meta: { updated_at: now },
      entries: {},
    });
    writeIntelJson(planningDir, 'stack.json', {
      _meta: { updated_at: now },
      entries: {},
    });
    writeIntelMd(planningDir, 'arch.md', '# Architecture\n');

    const result = intelValidate(planningDir);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });
});

// ─── intelPatchMeta ─────────────────────────────────────────────────────────

describe('intelPatchMeta', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    planningDir = path.join(tmpDir, '.planning');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('patches _meta.updated_at and increments version', () => {
    writeIntelJson(planningDir, 'files.json', {
      _meta: { updated_at: '2025-01-01T00:00:00Z', version: 1 },
      entries: {},
    });

    const filePath = path.join(planningDir, 'intel', 'files.json');
    const result = intelPatchMeta(filePath);

    assert.strictEqual(result.patched, true);

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.strictEqual(data._meta.version, 2);
    assert.notStrictEqual(data._meta.updated_at, '2025-01-01T00:00:00Z');
  });

  test('creates _meta if missing', () => {
    writeIntelJson(planningDir, 'files.json', { entries: {} });

    const filePath = path.join(planningDir, 'intel', 'files.json');
    const result = intelPatchMeta(filePath);

    assert.strictEqual(result.patched, true);

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.ok(data._meta.updated_at);
    assert.strictEqual(data._meta.version, 1);
  });

  test('returns error for missing file', () => {
    const result = intelPatchMeta('/nonexistent/file.json');
    assert.strictEqual(result.patched, false);
    assert.ok(result.error.includes('not found'));
  });

  test('returns error for invalid JSON', () => {
    const filePath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(filePath, 'not json', 'utf8');

    const result = intelPatchMeta(filePath);
    assert.strictEqual(result.patched, false);
    assert.ok(result.error.includes('Invalid JSON'));
  });
});

// ─── intelExtractExports ────────────────────────────────────────────────────

describe('intelExtractExports', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('extracts CJS module.exports object keys', () => {
    const filePath = path.join(tmpDir, 'example.cjs');
    fs.writeFileSync(filePath, [
      "'use strict';",
      'function doStuff() {}',
      'function helper() {}',
      'module.exports = {',
      '  doStuff,',
      '  helper,',
      '};',
    ].join('\n'), 'utf8');

    const result = intelExtractExports(filePath);
    assert.strictEqual(result.method, 'module.exports');
    assert.ok(result.exports.includes('doStuff'));
    assert.ok(result.exports.includes('helper'));
  });

  test('extracts ESM named exports', () => {
    const filePath = path.join(tmpDir, 'example.mjs');
    fs.writeFileSync(filePath, [
      'export function greet() {}',
      'export const VERSION = "1.0";',
      'export class Widget {}',
    ].join('\n'), 'utf8');

    const result = intelExtractExports(filePath);
    assert.strictEqual(result.method, 'esm');
    assert.ok(result.exports.includes('greet'));
    assert.ok(result.exports.includes('VERSION'));
    assert.ok(result.exports.includes('Widget'));
  });

  test('extracts ESM export block', () => {
    const filePath = path.join(tmpDir, 'example.js');
    fs.writeFileSync(filePath, [
      'function foo() {}',
      'function bar() {}',
      'export { foo, bar };',
    ].join('\n'), 'utf8');

    const result = intelExtractExports(filePath);
    assert.ok(result.exports.includes('foo'));
    assert.ok(result.exports.includes('bar'));
  });

  test('returns empty exports for nonexistent file', () => {
    const result = intelExtractExports('/nonexistent/file.js');
    assert.deepStrictEqual(result.exports, []);
    assert.strictEqual(result.method, 'none');
  });
});

// ─── CLI routing via gsd-tools ──────────────────────────────────────────────

describe('gsd-tools intel subcommands', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('intel status returns disabled message when not enabled', () => {
    const result = runGsdTools(['intel', 'status'], tmpDir);
    assert.strictEqual(result.success, true);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.disabled, true);
  });

  test('intel query returns disabled message when not enabled', () => {
    const result = runGsdTools(['intel', 'query', 'test'], tmpDir);
    assert.strictEqual(result.success, true);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.disabled, true);
  });

  test('intel status returns file status when enabled', () => {
    enableIntel(path.join(tmpDir, '.planning'));
    const result = runGsdTools(['intel', 'status'], tmpDir);
    assert.strictEqual(result.success, true);
    const output = JSON.parse(result.output);
    assert.ok(output.files);
    assert.strictEqual(output.overall_stale, true);
  });

  test('intel validate reports errors for missing files when enabled', () => {
    enableIntel(path.join(tmpDir, '.planning'));
    const result = runGsdTools(['intel', 'validate'], tmpDir);
    assert.strictEqual(result.success, true);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.valid, false);
    assert.ok(output.errors.length > 0);
  });
});
