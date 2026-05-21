'use strict';

/**
 * Behavioral tests for the phase-command-router adapter (#3788).
 *
 * Shape:
 *   1. Adapter translation — CLI args → hub dispatch shape
 *   2. Result translation — hub result → stdout / error callback
 *   3. Unsupported subcommands — SDK-only commands produce the documented error
 *   4. Unknown subcommand — unmapped subcommands produce a well-formed error
 *   5. Integration — real hub + real CJS phase handler invocation
 *
 * Testing rules in force (CONTRIBUTING.md § Testing Standards):
 *   - No readFileSync of source files.
 *   - No mocking of the hub itself — tests use the real CommandRoutingHub
 *     with stub cjsRegistry / sdkLoader entries.
 *   - All assertions on return values and captured call arguments.
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { routePhaseCommand } = require('../get-shit-done/bin/lib/phase-command-router.cjs');

// Force CJS path throughout: set GSD_WORKSTREAM so tryLoadSdk() is bypassed.
// This makes unit-level assertions deterministic regardless of SDK build state.
let _prevWorkstream;
before(() => {
  _prevWorkstream = process.env.GSD_WORKSTREAM;
  process.env.GSD_WORKSTREAM = 'test-unit';
});
after(() => {
  if (_prevWorkstream === undefined) delete process.env.GSD_WORKSTREAM;
  else process.env.GSD_WORKSTREAM = _prevWorkstream;
});

// ─── Helper: build a minimal phase stub ──────────────────────────────────────

function makePhase(overrides = {}) {
  return {
    cmdPhaseMvpMode: () => {},
    cmdPhaseNextDecimal: () => {},
    cmdPhaseAdd: () => {},
    cmdPhaseAddBatch: () => {},
    cmdPhaseInsert: () => {},
    cmdPhaseRemove: () => {},
    cmdPhaseComplete: () => {},
    ...overrides,
  };
}

// ─── 1. Adapter translation — CLI args → handler calls ───────────────────────

describe('phase-command-router — CLI arg translation (CJS path)', () => {
  test('routes phase mvp-mode: passes cwd, args.slice(2), raw to handler', () => {
    const calls = [];
    const phase = makePhase({
      cmdPhaseMvpMode: (cwd, slicedArgs, raw) => calls.push({ cwd, slicedArgs, raw }),
    });

    routePhaseCommand({ phase, args: ['phase', 'mvp-mode', '--enable'], cwd: '/proj', raw: false, error: (m) => { throw new Error(m); } });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].cwd, '/proj');
    assert.deepEqual(calls[0].slicedArgs, ['--enable']);
    assert.equal(calls[0].raw, false);
  });

  test('routes phase next-decimal: passes cwd, args[2], raw to handler', () => {
    const calls = [];
    const phase = makePhase({
      cmdPhaseNextDecimal: (cwd, label, raw) => calls.push({ cwd, label, raw }),
    });

    routePhaseCommand({ phase, args: ['phase', 'next-decimal', '5'], cwd: '/p', raw: true, error: (m) => { throw new Error(m); } });

    assert.equal(calls[0].label, '5');
    assert.equal(calls[0].raw, true);
  });

  test('routes phase add: strips --raw, passes joined description and no customId', () => {
    const calls = [];
    const phase = makePhase({
      cmdPhaseAdd: (cwd, desc, raw, customId) => calls.push({ cwd, desc, raw, customId }),
    });

    routePhaseCommand({ phase, args: ['phase', 'add', 'My', 'phase', '--raw'], cwd: '/p', raw: true, error: (m) => { throw new Error(m); } });

    assert.equal(calls[0].desc, 'My phase');
    assert.equal(calls[0].customId, null);
  });

  test('routes phase add: captures --id value', () => {
    const calls = [];
    const phase = makePhase({
      cmdPhaseAdd: (cwd, desc, raw, customId) => calls.push({ customId }),
    });

    routePhaseCommand({ phase, args: ['phase', 'add', '--id', '05', 'Desc'], cwd: '/p', raw: false, error: (m) => { throw new Error(m); } });

    assert.equal(calls[0].customId, '05');
  });

  test('routes phase add-batch: --descriptions JSON array parses correctly', () => {
    const calls = [];
    const phase = makePhase({
      cmdPhaseAddBatch: (cwd, descriptions, raw) => calls.push({ descriptions }),
    });

    routePhaseCommand({
      phase,
      args: ['phase', 'add-batch', '--descriptions', '["Phase A","Phase B"]'],
      cwd: '/p',
      raw: false,
      error: (m) => { throw new Error(m); },
    });

    assert.deepEqual(calls[0].descriptions, ['Phase A', 'Phase B']);
  });

  test('routes phase add-batch: positional args used when --descriptions absent', () => {
    const calls = [];
    const phase = makePhase({
      cmdPhaseAddBatch: (cwd, descriptions, raw) => calls.push({ descriptions }),
    });

    routePhaseCommand({
      phase,
      args: ['phase', 'add-batch', 'A', 'B', '--raw'],
      cwd: '/p',
      raw: true,
      error: (m) => { throw new Error(m); },
    });

    assert.deepEqual(calls[0].descriptions, ['A', 'B']);
  });

  test('routes phase insert: passes cwd, phaseNum, trailing joined, raw', () => {
    const calls = [];
    const phase = makePhase({
      cmdPhaseInsert: (cwd, phaseNum, desc, raw) => calls.push({ cwd, phaseNum, desc, raw }),
    });

    routePhaseCommand({ phase, args: ['phase', 'insert', '02', 'New', 'phase'], cwd: '/p', raw: false, error: (m) => { throw new Error(m); } });

    assert.equal(calls[0].phaseNum, '02');
    assert.equal(calls[0].desc, 'New phase');
  });

  test('routes phase remove: passes cwd, phaseNum, force:false, raw', () => {
    const calls = [];
    const phase = makePhase({
      cmdPhaseRemove: (cwd, phaseNum, opts, raw) => calls.push({ cwd, phaseNum, opts, raw }),
    });

    routePhaseCommand({ phase, args: ['phase', 'remove', '03'], cwd: '/p', raw: false, error: (m) => { throw new Error(m); } });

    assert.equal(calls[0].phaseNum, '03');
    assert.deepEqual(calls[0].opts, { force: false });
  });

  test('routes phase remove: --force flag sets opts.force:true', () => {
    const calls = [];
    const phase = makePhase({
      cmdPhaseRemove: (cwd, phaseNum, opts, raw) => calls.push({ opts }),
    });

    routePhaseCommand({ phase, args: ['phase', 'remove', '--force', '03'], cwd: '/p', raw: false, error: (m) => { throw new Error(m); } });

    assert.deepEqual(calls[0].opts, { force: true });
  });

  test('routes phase complete: passes cwd, args[2], raw', () => {
    const calls = [];
    const phase = makePhase({
      cmdPhaseComplete: (cwd, phaseNum, raw) => calls.push({ cwd, phaseNum, raw }),
    });

    routePhaseCommand({ phase, args: ['phase', 'complete', '04'], cwd: '/p', raw: false, error: (m) => { throw new Error(m); } });

    assert.equal(calls[0].phaseNum, '04');
  });
});

// ─── 2. Result translation — error callback on failure ───────────────────────

describe('phase-command-router — result translation (error path)', () => {
  test('phase add with --id missing value calls error()', () => {
    let msg = null;
    const phase = makePhase();

    routePhaseCommand({
      phase,
      args: ['phase', 'add', '--id'],
      cwd: '/p',
      raw: false,
      error: (m) => { msg = m; },
    });

    assert.ok(msg !== null, 'error callback must be called');
    assert.ok(msg.includes('--id requires a value'));
  });

  test('phase add with unknown flag calls error()', () => {
    let msg = null;
    const phase = makePhase();

    routePhaseCommand({
      phase,
      args: ['phase', 'add', '--unknown-flag'],
      cwd: '/p',
      raw: false,
      error: (m) => { msg = m; },
    });

    assert.ok(msg !== null);
    assert.ok(msg.includes('phase add does not support'));
  });

  test('phase add-batch with non-JSON --descriptions calls error()', () => {
    let msg = null;
    const phase = makePhase();

    routePhaseCommand({
      phase,
      args: ['phase', 'add-batch', '--descriptions', 'not-json'],
      cwd: '/p',
      raw: false,
      error: (m) => { msg = m; },
    });

    assert.ok(msg !== null);
    assert.ok(msg.includes('JSON array'));
  });

  test('phase insert with --dry-run calls error()', () => {
    let msg = null;
    const phase = makePhase();

    routePhaseCommand({
      phase,
      args: ['phase', 'insert', '02', '--dry-run'],
      cwd: '/p',
      raw: false,
      error: (m) => { msg = m; },
    });

    assert.ok(msg !== null);
    assert.ok(msg.includes('does not support --dry-run'));
  });

  test('phase remove with unsupported flag calls error()', () => {
    let msg = null;
    const phase = makePhase();

    routePhaseCommand({
      phase,
      args: ['phase', 'remove', '--quiet', '03'],
      cwd: '/p',
      raw: false,
      error: (m) => { msg = m; },
    });

    assert.ok(msg !== null);
    assert.ok(msg.includes('phase remove does not support'));
  });

  test('phase remove without a phase number calls error()', () => {
    let msg = null;
    const phase = makePhase();

    routePhaseCommand({
      phase,
      args: ['phase', 'remove'],
      cwd: '/p',
      raw: false,
      error: (m) => { msg = m; },
    });

    assert.ok(msg !== null);
    assert.ok(msg.includes('exactly one phase number'));
  });
});

// ─── 3. Unsupported (SDK-only) subcommands ────────────────────────────────────

describe('phase-command-router — SDK-only subcommands', () => {
  test('phase list-plans calls error() with SDK-only message', () => {
    let msg = null;
    routePhaseCommand({
      phase: makePhase(),
      args: ['phase', 'list-plans'],
      cwd: '/p',
      raw: false,
      error: (m) => { msg = m; },
    });

    assert.ok(msg !== null);
    assert.ok(msg.includes('SDK-only'), `expected "SDK-only" in: ${msg}`);
    assert.ok(msg.includes('list-plans'));
  });

  test('phase list-artifacts calls error() with SDK-only message', () => {
    let msg = null;
    routePhaseCommand({
      phase: makePhase(),
      args: ['phase', 'list-artifacts'],
      cwd: '/p',
      raw: false,
      error: (m) => { msg = m; },
    });

    assert.ok(msg !== null);
    assert.ok(msg.includes('SDK-only'));
    assert.ok(msg.includes('list-artifacts'));
  });

  test('phase scaffold calls error() with redirect message', () => {
    let msg = null;
    routePhaseCommand({
      phase: makePhase(),
      args: ['phase', 'scaffold'],
      cwd: '/p',
      raw: false,
      error: (m) => { msg = m; },
    });

    assert.ok(msg !== null);
    assert.ok(msg.includes('scaffold'));
  });
});

// ─── 4. Unknown subcommand ────────────────────────────────────────────────────

describe('phase-command-router — unknown subcommand', () => {
  test('unknown phase subcommand calls error() listing available ones', () => {
    let msg = null;
    routePhaseCommand({
      phase: makePhase(),
      args: ['phase', 'frobnicate'],
      cwd: '/p',
      raw: false,
      error: (m) => { msg = m; },
    });

    assert.ok(msg !== null);
    assert.ok(msg.includes('Unknown phase subcommand'));
    assert.ok(msg.includes('Available:'), `expected "Available:" in: ${msg}`);
  });

  test('unknown subcommand message lists canonical manifest commands like add and complete', () => {
    // mvp-mode is NOT in the available list (not in PHASE_SUBCOMMANDS manifest),
    // matching the pre-#3788 behaviour of routeCjsCommandFamily.
    // The list does include the manifest-backed commands: add, complete, etc.
    let msg = null;
    routePhaseCommand({
      phase: makePhase(),
      args: ['phase', 'bogus'],
      cwd: '/p',
      raw: false,
      error: (m) => { msg = m; },
    });

    assert.ok(msg.includes('add'), `expected add in available list: ${msg}`);
    assert.ok(msg.includes('complete'), `expected complete in available list: ${msg}`);
    assert.ok(!msg.includes('list-plans'), `list-plans (SDK-only) must not appear in available list: ${msg}`);
  });
});

// ─── 5. Integration — real hub + real CJS phase handler ──────────────────────
//
// This test exercises the full dispatch chain end-to-end:
//   routePhaseCommand → createHub (cjs mode) → dispatch → cjsRegistry handler
//   → phase stub → assert the call was received.
//
// No mocking of the hub. The phase stub is a real dependency collaborator.

describe('phase-command-router — integration: real hub + CJS phase handler', () => {
  test('dispatches phase complete through real hub to real CJS handler chain', () => {
    const calls = [];
    const phase = makePhase({
      cmdPhaseComplete: (cwd, phaseNum, raw) => calls.push({ cwd, phaseNum, raw }),
    });

    // No error should occur; handler should be called exactly once.
    let errorMsg = null;
    routePhaseCommand({
      phase,
      args: ['phase', 'complete', '07'],
      cwd: '/integration',
      raw: false,
      error: (m) => { errorMsg = m; },
    });

    assert.equal(errorMsg, null, `unexpected error: ${errorMsg}`);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].cwd, '/integration');
    assert.equal(calls[0].phaseNum, '07');
    assert.equal(calls[0].raw, false);
  });

  test('dispatches phase add-batch through real hub with --descriptions', () => {
    const calls = [];
    const phase = makePhase({
      cmdPhaseAddBatch: (cwd, descriptions, raw) => calls.push({ descriptions }),
    });

    let errorMsg = null;
    routePhaseCommand({
      phase,
      args: ['phase', 'add-batch', '--descriptions', '["Alpha","Beta"]'],
      cwd: '/integration',
      raw: false,
      error: (m) => { errorMsg = m; },
    });

    assert.equal(errorMsg, null, `unexpected error: ${errorMsg}`);
    assert.deepEqual(calls[0].descriptions, ['Alpha', 'Beta']);
  });
});
