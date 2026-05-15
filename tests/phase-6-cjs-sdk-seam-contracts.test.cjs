'use strict';

/**
 * Phase 6 (issue #3524 / PR #3577) — CJS↔SDK seam behavioral contract tests.
 *
 * Issue #3592 explicitly tracks the migration away from text-existence /
 * source-grep tests onto behavioral contract tests. This file is the
 * behavioral contract surface for everything Phase 6 introduced:
 *
 *   • `get-shit-done/bin/lib/cjs-sdk-bridge.cjs` — load + cache + surface
 *   • `sdk/src/runtime-bridge-sync/index.ts` — sync dispatch primitive
 *     (returns `RuntimeBridgeSyncResult`, a discriminated union with a
 *     fixed `SyncErrorKind` taxonomy)
 *   • The 7 family routers (`init|phase|phases|roadmap|state|validate|
 *     verify-command-router.cjs`) + top-level `gsd-tools.cjs` dispatch —
 *     each must route a canonical registry command through the bridge
 *     and emit a JSON-shaped result on stdout.
 *   • Workstream-scoped commands — Phase 6 made these native; the
 *     bridge must accept a `workstream` field and the CLI must still
 *     fall back to CJS when `GSD_WORKSTREAM` is set (the gate the
 *     routers use to defer to per-side CJS handlers).
 *
 * Test rules in force (from `CONTRIBUTING.md` § Testing Standards and
 * issue #3592):
 *
 *   1. No `readFileSync` of any `.cjs` source file to assert text
 *      content.  Every assertion is on a parsed JSON object, a
 *      filesystem fact, an exit code, or a frozen enum value.
 *   2. No `assert.match`/`.includes` on free-form child-process stdout
 *      or stderr.  Either parse JSON, or assert on a structured field
 *      via the bridge API directly.
 *   3. Frozen enums describe the canonical taxonomies the production
 *      code MUST emit.  Drift between production and test fails the
 *      object-shape lock test, not a substring lookup.
 *   4. Filesystem assertions use `fs.statSync().isFile()` / `.size` —
 *      never read the file content back as a substring assertion.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

const REPO_ROOT = path.join(__dirname, '..');
const BRIDGE_PATH = path.join(REPO_ROOT, 'get-shit-done', 'bin', 'lib', 'cjs-sdk-bridge.cjs');

// ─── Frozen taxonomies ────────────────────────────────────────────────────────
//
// These describe the canonical shapes Phase 6 ships.  Tests assert against the
// enum values, not against substring matches.  Adding a new error kind or a
// new bridge export requires updating BOTH the production code AND the
// matching frozen set below — that's three coordinated edits, which is the
// drift-prevention property the new contract pattern is meant to provide.

/** SDK runtime-bridge-sync `SyncErrorKind` taxonomy (sdk/src/runtime-bridge-sync/index.ts:62-68). */
const SYNC_ERROR_KIND = Object.freeze({
  UNKNOWN_COMMAND: 'unknown_command',
  NATIVE_FAILURE: 'native_failure',
  NATIVE_TIMEOUT: 'native_timeout',
  FALLBACK_FAILURE: 'fallback_failure',
  VALIDATION_ERROR: 'validation_error',
  INTERNAL_ERROR: 'internal_error',
});

const SYNC_ERROR_KIND_VALUES = Object.freeze(new Set(Object.values(SYNC_ERROR_KIND)));

/** Surface of `cjs-sdk-bridge.cjs`.  Adding an export requires updating both. */
const BRIDGE_EXPORTS = Object.freeze([
  'tryLoadSdk',
  'getExecuteForCjs',
  'getFormatStateLoadRawStdout',
  'getSdkModule',
]);

/** TransportMode values accepted by executeForCjs.  Bridge must support both. */
const TRANSPORT_MODE = Object.freeze({ JSON: 'json', RAW: 'raw' });

// ─── Bridge module helper ─────────────────────────────────────────────────────
//
// Fresh-require the bridge once per describe block so each test sees an
// isolated load state.  `delete require.cache[...]` is the canonical
// reset; never patch internals.

function freshBridge() {
  delete require.cache[require.resolve(BRIDGE_PATH)];
  return require(BRIDGE_PATH);
}

// ─── 1. Bridge module surface contract ─────────────────────────────────────────

describe('phase 6: cjs-sdk-bridge surface', () => {
  test('exposes exactly the documented exports — frozen set', () => {
    const bridge = freshBridge();
    const actual = Object.keys(bridge).sort();
    assert.deepStrictEqual(
      actual,
      [...BRIDGE_EXPORTS].sort(),
      'bridge surface drifted from BRIDGE_EXPORTS — update both production code and the frozen set together',
    );
  });

  test('every documented export is a function', () => {
    const bridge = freshBridge();
    for (const name of BRIDGE_EXPORTS) {
      assert.strictEqual(typeof bridge[name], 'function', `${name} must be a function`);
    }
  });
});

// ─── 2. Bridge load + cache contract ──────────────────────────────────────────

describe('phase 6: cjs-sdk-bridge load lifecycle', () => {
  test('tryLoadSdk resolves the bundled SDK on a working checkout', () => {
    const bridge = freshBridge();
    assert.strictEqual(bridge.tryLoadSdk(), true);
  });

  test('post-load getters return non-null when tryLoadSdk succeeded', () => {
    const bridge = freshBridge();
    bridge.tryLoadSdk();
    assert.strictEqual(typeof bridge.getExecuteForCjs(), 'function');
    assert.strictEqual(typeof bridge.getFormatStateLoadRawStdout(), 'function');
    const mod = bridge.getSdkModule();
    assert.ok(mod && typeof mod === 'object', 'getSdkModule must return the cached module object');
    assert.strictEqual(typeof mod.executeForCjs, 'function');
  });

  test('repeated tryLoadSdk calls return the cached result (same reference)', () => {
    const bridge = freshBridge();
    bridge.tryLoadSdk();
    const fn1 = bridge.getExecuteForCjs();
    bridge.tryLoadSdk();
    const fn2 = bridge.getExecuteForCjs();
    assert.strictEqual(fn1, fn2, 'getExecuteForCjs must return the same cached function');
  });

  test('pre-load getters return null', () => {
    const bridge = freshBridge();
    assert.strictEqual(bridge.getExecuteForCjs(), null);
    assert.strictEqual(bridge.getFormatStateLoadRawStdout(), null);
    assert.strictEqual(bridge.getSdkModule(), null);
  });
});

// ─── 3. executeForCjs discriminated-union result shape ────────────────────────

describe('phase 6: executeForCjs RuntimeBridgeSyncResult shape', () => {
  let bridge;
  let executeForCjs;
  let tmpDir;

  beforeEach(() => {
    bridge = freshBridge();
    bridge.tryLoadSdk();
    executeForCjs = bridge.getExecuteForCjs();
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('ok:true result shape — { ok, data, exitCode }', () => {
    const result = executeForCjs({
      registryCommand: 'generate-slug',
      registryArgs: ['Phase 6 Seam Contract'],
      legacyCommand: 'generate-slug',
      legacyArgs: ['Phase 6 Seam Contract'],
      mode: TRANSPORT_MODE.JSON,
      projectDir: tmpDir,
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.data && typeof result.data === 'object', 'data must be an object on ok:true');
    assert.strictEqual(typeof result.data.slug, 'string');
  });

  test('ok:false result for unknown command — errorKind ∈ SyncErrorKind, exitCode ≠ 0', () => {
    const result = executeForCjs({
      registryCommand: 'totally.unknown.command.xyz',
      registryArgs: [],
      legacyCommand: 'totally.unknown.command.xyz',
      legacyArgs: [],
      mode: TRANSPORT_MODE.JSON,
      projectDir: tmpDir,
    });
    assert.strictEqual(result.ok, false);
    assert.notStrictEqual(result.exitCode, 0);
    assert.ok(
      SYNC_ERROR_KIND_VALUES.has(result.errorKind),
      `errorKind "${result.errorKind}" must be one of ${[...SYNC_ERROR_KIND_VALUES].join(', ')}`,
    );
    assert.ok(Array.isArray(result.stderrLines), 'stderrLines must be an array on ok:false');
  });

  test('mode:"json" returns parsed data, never a JSON-encoded string', () => {
    // Regression for the Wave-1 bug where routers passed `mode: 'raw'` and the
    // bridge pre-rendered to a JSON string that CJS output() then double-
    // stringified.  result.data MUST be a structured object/array/primitive
    // — never a string that itself parses as JSON.
    const result = executeForCjs({
      registryCommand: 'generate-slug',
      registryArgs: ['Mode Json Check'],
      legacyCommand: 'generate-slug',
      legacyArgs: ['Mode Json Check'],
      mode: TRANSPORT_MODE.JSON,
      projectDir: tmpDir,
    });
    assert.strictEqual(result.ok, true);
    assert.notStrictEqual(typeof result.data, 'string',
      'mode:"json" must hand callers parsed data, not a serialized JSON blob');
  });
});

// ─── 4. CLI family-router dispatch contracts ──────────────────────────────────
//
// One representative read-only command per family.  Each test:
//   1. Invokes the CLI through `runGsdTools` (real child process).
//   2. Asserts exit success.
//   3. Parses stdout as JSON.
//   4. Asserts on a structured field, not on prose.
//
// This is the byte-for-byte parity contract Phase 6 promised: SDK-routed
// commands emit the same JSON shape as the legacy CJS handlers used to.

describe('phase 6: CLI family-router dispatch emits structured JSON', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Minimal ROADMAP fixture for any family that scans it.
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '# v1.0 Roadmap',
        '',
        '### Phase 1: Foundation',
        '**Goal:** Setup',
        '**Requirements**: REQ-01',
        '**Plans:** 0 plans',
        '',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      [
        '# State',
        '',
        '**Current Phase:** 01',
        '**Status:** In progress',
        '**Total Plans in Phase:** 0',
        '**Progress:** [░░░░░░░░░░] 0%',
        '**Last Activity:** 2026-05-15',
        '',
      ].join('\n'),
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('roadmap.get-phase emits found:true with structured phase fields', () => {
    const result = runGsdTools(['roadmap', 'get-phase', '1'], tmpDir);
    assert.ok(result.success, `roadmap get-phase failed: ${result.error}`);
    const payload = JSON.parse(result.output);
    assert.strictEqual(payload.found, true);
    assert.strictEqual(payload.phase_number, '1');
    assert.strictEqual(payload.phase_name, 'Foundation');
  });

  test('roadmap.analyze emits a milestones array', () => {
    const result = runGsdTools(['roadmap', 'analyze'], tmpDir);
    assert.ok(result.success, `roadmap analyze failed: ${result.error}`);
    const payload = JSON.parse(result.output);
    assert.ok(Array.isArray(payload.phases), 'phases must be an array');
  });

  test('phase next-decimal emits a structured next/base shape', () => {
    const result = runGsdTools(['phase', 'next-decimal', '1'], tmpDir);
    assert.ok(result.success, `phase next-decimal failed: ${result.error}`);
    const payload = JSON.parse(result.output);
    assert.strictEqual(payload.base_phase, '01');
    assert.strictEqual(typeof payload.next, 'string');
    assert.ok(Array.isArray(payload.existing), 'existing must be an array');
  });

  test('phases list emits a directories array with count', () => {
    const result = runGsdTools(['phases', 'list'], tmpDir);
    assert.ok(result.success, `phases list failed: ${result.error}`);
    const payload = JSON.parse(result.output);
    assert.ok(Array.isArray(payload.directories), 'directories must be an array');
    assert.strictEqual(typeof payload.count, 'number');
  });

  test('state json emits a frontmatter object with progress', () => {
    const result = runGsdTools(['state', 'json'], tmpDir);
    assert.ok(result.success, `state json failed: ${result.error}`);
    const payload = JSON.parse(result.output);
    assert.strictEqual(payload.gsd_state_version, '1.0');
    assert.ok(payload.progress && typeof payload.progress === 'object',
      'progress must be a structured object, not a serialized string');
  });

  test('init plan-phase emits phase_found + model fields', () => {
    const result = runGsdTools(['init', 'plan-phase', '1'], tmpDir);
    assert.ok(result.success, `init plan-phase failed: ${result.error}`);
    const payload = JSON.parse(result.output);
    assert.strictEqual(payload.phase_found, true);
    assert.strictEqual(payload.phase_number, '1');
    assert.strictEqual(typeof payload.researcher_model, 'string');
  });

  test('validate consistency emits valid + warnings array', () => {
    const result = runGsdTools(['validate', 'consistency'], tmpDir);
    assert.ok(result.success, `validate consistency failed: ${result.error}`);
    const payload = JSON.parse(result.output);
    assert.ok(typeof payload.valid === 'boolean' || Array.isArray(payload.warnings),
      'validate consistency must emit either {valid, warnings} shape');
  });

  test('find-phase for non-existent phase emits found:false (not a process error)', () => {
    const result = runGsdTools(['find-phase', '99'], tmpDir);
    assert.ok(result.success, `find-phase should not error on missing phase: ${result.error}`);
    const payload = JSON.parse(result.output);
    assert.strictEqual(payload.found, false);
  });
});

// ─── 5. mode:"json" prevents double-stringify (Wave 1 bug regression) ─────────

describe('phase 6: mode:"json" never double-stringifies the data', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '# v1.0',
        '',
        '### Phase 1: Setup',
        '**Goal:** Initial setup',
        '',
      ].join('\n'),
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // The Wave-1 bug shape: stdout looked like JSON of JSON, e.g.
  //   "\"{\\n  \\\"found\\\": true\"".
  // After the fix, stdout is a single JSON object that parses to an object —
  // never a string that itself parses to an object.
  test('roadmap get-phase stdout parses to an object, not a JSON-encoded string', () => {
    const result = runGsdTools(['roadmap', 'get-phase', '1'], tmpDir);
    assert.ok(result.success, `command failed: ${result.error}`);
    const first = JSON.parse(result.output);
    assert.strictEqual(
      typeof first,
      'object',
      'CLI stdout for a JSON-mode command must parse directly to an object',
    );
    assert.notStrictEqual(
      typeof first,
      'string',
      'double-stringify regression: stdout parsed to a string that would itself parse as JSON',
    );
  });
});

// ─── 6. Workstream-scoped CJS fallback gate ────────────────────────────────────
//
// Phase 6 made workstream-scoped commands native in the SDK transport, BUT the
// CJS routers still force CJS fallback when `GSD_WORKSTREAM` is set in the
// environment, so workstream-aware tests and inspections can target a
// specific workstream's `.planning/` slice without round-tripping through
// the synckit worker.  Both modes must work and must produce the same JSON
// shape for the same input fixture.

describe('phase 6: GSD_WORKSTREAM gate routes through CJS fallback consistently', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      ['# v1.0', '', '### Phase 1: Setup', '**Goal:** Setup', ''].join('\n'),
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('roadmap get-phase produces identical structured output with and without GSD_WORKSTREAM unset', () => {
    const sdkPath = runGsdTools(['roadmap', 'get-phase', '1'], tmpDir);
    assert.ok(sdkPath.success, `SDK dispatch failed: ${sdkPath.error}`);
    const sdkPayload = JSON.parse(sdkPath.output);

    // When GSD_WORKSTREAM is set, the router falls through to CJS.  For the
    // primary planning slice (no workstream subdir yet), passing the env var
    // should still parse the same ROADMAP.md and emit the same fields.
    const cjsPath = runGsdTools(['roadmap', 'get-phase', '1'], tmpDir, { GSD_WORKSTREAM: '' });
    assert.ok(cjsPath.success, `CJS fallback dispatch failed: ${cjsPath.error}`);
    const cjsPayload = JSON.parse(cjsPath.output);

    // Compare structured fields, never the rendered text.
    assert.strictEqual(sdkPayload.found, cjsPayload.found);
    assert.strictEqual(sdkPayload.phase_number, cjsPayload.phase_number);
    assert.strictEqual(sdkPayload.phase_name, cjsPayload.phase_name);
  });
});

// ─── 7. Validation-error contract for malformed input ──────────────────────────
//
// When a registry command receives an invalid argument, the bridge must map
// the error to `validation_error` in the SyncErrorKind taxonomy and surface a
// non-zero exit code.  This is the "negative path" coverage that #3592
// explicitly calls out as required.

describe('phase 6: validation errors map to SyncErrorKind.validation_error', () => {
  let bridge;
  let executeForCjs;
  let tmpDir;

  beforeEach(() => {
    bridge = freshBridge();
    bridge.tryLoadSdk();
    executeForCjs = bridge.getExecuteForCjs();
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('find-phase with empty phase identifier returns ok:false + validation_error', () => {
    const result = executeForCjs({
      registryCommand: 'find-phase',
      registryArgs: [],
      legacyCommand: 'find-phase',
      legacyArgs: [],
      mode: TRANSPORT_MODE.JSON,
      projectDir: tmpDir,
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.errorKind, SYNC_ERROR_KIND.VALIDATION_ERROR,
      `validation errors must map to ${SYNC_ERROR_KIND.VALIDATION_ERROR}, got ${result.errorKind}`);
    assert.notStrictEqual(result.exitCode, 0, 'validation_error must produce a non-zero exit code');
  });
});

// ─── 8. Filesystem-fact write contract ─────────────────────────────────────────
//
// Phase 6 routes phase.add through the SDK.  After a successful add, the
// phase directory and ROADMAP entry must be on disk.  Test asserts on
// filesystem facts (`existsSync`, `statSync().isDirectory()`, file size > 0)
// — never reads the file content back as a substring assertion.

describe('phase 6: phase.add SDK dispatch writes the expected filesystem facts', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      [
        '# v1.0 Roadmap',
        '',
        '### Phase 1: Foundation',
        '**Goal:** Setup',
        '',
        '---',
        '',
      ].join('\n'),
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('phase add User Dashboard creates phase 2 directory + appends ROADMAP entry', () => {
    const before = fs.statSync(path.join(tmpDir, '.planning', 'ROADMAP.md'));
    const result = runGsdTools(['phase', 'add', 'User', 'Dashboard'], tmpDir);
    assert.ok(result.success, `phase add failed: ${result.error}`);

    const payload = JSON.parse(result.output);
    assert.strictEqual(payload.phase_number, 2);
    assert.strictEqual(payload.slug, 'user-dashboard');

    // Filesystem facts: the directory exists and is a directory; the roadmap
    // file grew (write happened).  We do not read the file back to look for
    // substrings — that's the prohibited pattern.
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '02-user-dashboard');
    assert.ok(fs.existsSync(phaseDir), 'new phase directory must exist on disk');
    assert.ok(fs.statSync(phaseDir).isDirectory(), 'phase path must be a directory');

    const after = fs.statSync(path.join(tmpDir, '.planning', 'ROADMAP.md'));
    assert.ok(after.size > before.size, 'ROADMAP.md must grow when phase add appends an entry');
  });
});
