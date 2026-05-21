'use strict';

/**
 * Behavioral contract tests for the CommandRoutingHub (issue #3788).
 *
 * Testing rules in force (CONTRIBUTING.md § Testing Standards):
 *   1. No readFileSync of source files. All assertions are on return values
 *      from the hub's dispatch() function.
 *   2. Stub sdkLoader / cjsRegistry / manifest — the hub is the unit under test.
 *      No real SDK load, no real CJS handler invocation (except one integration
 *      path in the phase-command-router migration tests).
 *   3. ERROR_KINDS is a frozen enum. Tests switch on its values, not string literals.
 *   4. Hub must never throw. Every error surface arrives as { ok: false, ... }.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { createHub, ERROR_KINDS } = require('../get-shit-done/bin/lib/command-routing-hub.cjs');

// ─── Frozen taxonomy lock ─────────────────────────────────────────────────────
// If the closed errorKind set drifts, this test fails before any behavioral
// test runs — making the taxonomy shift visible at the seam.
const EXPECTED_ERROR_KINDS = Object.freeze(new Set([
  'UnknownCommand',
  'InvalidArgs',
  'HandlerRefusal',
  'HandlerFailure',
  'SdkLoadFailed',
  'SdkDispatchFailed',
]));

describe('CommandRoutingHub — ERROR_KINDS taxonomy', () => {
  test('exports a frozen ERROR_KINDS object', () => {
    assert.ok(Object.isFrozen(ERROR_KINDS), 'ERROR_KINDS must be frozen');
  });

  test('ERROR_KINDS contains exactly the 6 documented values', () => {
    const actual = new Set(Object.values(ERROR_KINDS));
    assert.deepStrictEqual(actual, EXPECTED_ERROR_KINDS);
  });

  test('ERROR_KINDS keys match their values (self-documenting enum)', () => {
    for (const [key, value] of Object.entries(ERROR_KINDS)) {
      assert.equal(key, value, `ERROR_KINDS.${key} should equal '${key}' but got '${value}'`);
    }
  });
});

// ─── createHub validation ──────────────────────────────────────────────────────

describe('CommandRoutingHub — createHub validation', () => {
  test('throws synchronously on invalid mode (not sdk/cjs)', () => {
    assert.throws(() => createHub({ mode: 'invalid' }), /mode must be/);
  });

  test('throws on missing mode', () => {
    assert.throws(() => createHub({}), /mode must be/);
  });

  test('accepts mode: sdk', () => {
    const hub = createHub({ mode: 'sdk', sdkLoader: () => null });
    assert.ok(typeof hub.dispatch === 'function');
  });

  test('accepts mode: cjs', () => {
    const hub = createHub({ mode: 'cjs', cjsRegistry: {} });
    assert.ok(typeof hub.dispatch === 'function');
  });
});

// ─── Happy path — mode: sdk ───────────────────────────────────────────────────

describe('CommandRoutingHub — happy path, mode: sdk', () => {
  test('dispatch returns { ok: true, data } when SDK succeeds', () => {
    const sdkExecute = (_input) => ({ ok: true, data: { phases: ['01'] }, exitCode: 0 });
    const hub = createHub({
      mode: 'sdk',
      sdkLoader: () => sdkExecute,
      manifest: { phase: ['add', 'remove', 'complete'] },
    });

    const result = hub.dispatch({ family: 'phase', subcommand: 'add', args: ['My phase'], cwd: '/tmp/proj', raw: false });

    assert.ok(result.ok);
    assert.deepEqual(result.data, { phases: ['01'] });
  });

  test('dispatch passes registryCommand as family.subcommand to SDK', () => {
    const calls = [];
    const sdkExecute = (input) => {
      calls.push(input);
      return { ok: true, data: 'done', exitCode: 0 };
    };
    const hub = createHub({
      mode: 'sdk',
      sdkLoader: () => sdkExecute,
      manifest: { phase: ['next-decimal'] },
    });

    hub.dispatch({ family: 'phase', subcommand: 'next-decimal', args: ['--raw'], cwd: '/proj', raw: true });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].registryCommand, 'phase.next-decimal');
    assert.equal(calls[0].projectDir, '/proj');
    assert.equal(calls[0].mode, 'raw');
  });

  test('dispatch uses mode:json when raw is false', () => {
    const calls = [];
    const sdkExecute = (input) => { calls.push(input); return { ok: true, data: null, exitCode: 0 }; };
    const hub = createHub({
      mode: 'sdk',
      sdkLoader: () => sdkExecute,
    });

    hub.dispatch({ family: 'state', subcommand: 'load', args: [], cwd: '/p', raw: false });

    assert.equal(calls[0].mode, 'json');
  });
});

// ─── Happy path — mode: cjs ───────────────────────────────────────────────────

describe('CommandRoutingHub — happy path, mode: cjs', () => {
  test('dispatch returns { ok: true, data } from CJS handler result', () => {
    const hub = createHub({
      mode: 'cjs',
      cjsRegistry: {
        phase: {
          complete: (_ctx) => ({ ok: true, data: { completed: true } }),
        },
      },
      manifest: { phase: ['complete'] },
    });

    const result = hub.dispatch({ family: 'phase', subcommand: 'complete', args: ['01'], cwd: '/tmp', raw: false });

    assert.ok(result.ok);
    assert.deepEqual(result.data, { completed: true });
  });

  test('dispatch passes full context to CJS handler', () => {
    const received = [];
    const hub = createHub({
      mode: 'cjs',
      cjsRegistry: {
        roadmap: {
          analyze: (ctx) => { received.push(ctx); return { ok: true, data: null }; },
        },
      },
    });

    hub.dispatch({ family: 'roadmap', subcommand: 'analyze', args: ['--verbose'], cwd: '/myproj', raw: true });

    assert.equal(received.length, 1);
    assert.equal(received[0].family, 'roadmap');
    assert.equal(received[0].subcommand, 'analyze');
    assert.deepEqual(received[0].args, ['--verbose']);
    assert.equal(received[0].cwd, '/myproj');
    assert.equal(received[0].raw, true);
  });

  test('handler returning undefined is treated as ok:true with data:null', () => {
    const hub = createHub({
      mode: 'cjs',
      cjsRegistry: {
        state: {
          load: (_ctx) => undefined,
        },
      },
    });

    const result = hub.dispatch({ family: 'state', subcommand: 'load', args: [], cwd: '/', raw: false });

    assert.ok(result.ok);
    assert.equal(result.data, null);
  });

  test('handler returning a plain value wraps it as data payload', () => {
    const hub = createHub({
      mode: 'cjs',
      cjsRegistry: {
        verify: {
          check: (_ctx) => 'all-good',
        },
      },
    });

    const result = hub.dispatch({ family: 'verify', subcommand: 'check', args: [], cwd: '/', raw: false });

    assert.ok(result.ok);
    assert.equal(result.data, 'all-good');
  });
});

// ─── errorKind: UnknownCommand ────────────────────────────────────────────────

describe('CommandRoutingHub — errorKind: UnknownCommand', () => {
  test('unknown family in manifest returns UnknownCommand', () => {
    const hub = createHub({
      mode: 'cjs',
      cjsRegistry: {},
      manifest: { phase: ['add'] },
    });

    const result = hub.dispatch({ family: 'bogus', subcommand: 'add', args: [], cwd: '/', raw: false });

    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.UnknownCommand);
  });

  test('unknown subcommand in manifest returns UnknownCommand', () => {
    const hub = createHub({
      mode: 'cjs',
      cjsRegistry: {},
      manifest: { phase: ['add'] },
    });

    const result = hub.dispatch({ family: 'phase', subcommand: 'nonexistent', args: [], cwd: '/', raw: false });

    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.UnknownCommand);
  });

  test('missing family in cjsRegistry returns UnknownCommand (no manifest)', () => {
    const hub = createHub({
      mode: 'cjs',
      cjsRegistry: { state: { load: () => ({ ok: true, data: null }) } },
    });

    const result = hub.dispatch({ family: 'bogus-family', subcommand: 'sub', args: [], cwd: '/', raw: false });

    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.UnknownCommand);
  });

  test('missing subcommand in cjsRegistry returns UnknownCommand', () => {
    const hub = createHub({
      mode: 'cjs',
      cjsRegistry: { phase: { add: () => ({ ok: true, data: null }) } },
    });

    const result = hub.dispatch({ family: 'phase', subcommand: 'not-there', args: [], cwd: '/', raw: false });

    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.UnknownCommand);
  });
});

// ─── errorKind: InvalidArgs ───────────────────────────────────────────────────

describe('CommandRoutingHub — errorKind: InvalidArgs', () => {
  test('handler returning InvalidArgs result propagates it', () => {
    const hub = createHub({
      mode: 'cjs',
      cjsRegistry: {
        phase: {
          insert: (_ctx) => ({
            ok: false,
            errorKind: ERROR_KINDS.InvalidArgs,
            message: 'phase insert requires a phase number',
          }),
        },
      },
    });

    const result = hub.dispatch({ family: 'phase', subcommand: 'insert', args: [], cwd: '/', raw: false });

    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.InvalidArgs);
    assert.ok(result.message.includes('phase number'));
  });
});

// ─── errorKind: HandlerRefusal ────────────────────────────────────────────────

describe('CommandRoutingHub — errorKind: HandlerRefusal', () => {
  test('handler returning HandlerRefusal result propagates it', () => {
    const hub = createHub({
      mode: 'cjs',
      cjsRegistry: {
        phase: {
          'list-plans': (_ctx) => ({
            ok: false,
            errorKind: ERROR_KINDS.HandlerRefusal,
            message: 'phase list-plans is SDK-only',
          }),
        },
      },
    });

    const result = hub.dispatch({ family: 'phase', subcommand: 'list-plans', args: [], cwd: '/', raw: false });

    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.HandlerRefusal);
  });
});

// ─── errorKind: HandlerFailure ────────────────────────────────────────────────

describe('CommandRoutingHub — errorKind: HandlerFailure', () => {
  test('hub does not throw when CJS handler throws — returns HandlerFailure', () => {
    const hub = createHub({
      mode: 'cjs',
      cjsRegistry: {
        phase: {
          add: (_ctx) => { throw new Error('handler blew up'); },
        },
      },
    });

    let result;
    assert.doesNotThrow(() => {
      result = hub.dispatch({ family: 'phase', subcommand: 'add', args: ['desc'], cwd: '/', raw: false });
    });

    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.HandlerFailure);
    assert.ok(result.message.includes('handler blew up'));
  });

  test('HandlerFailure details.originalError carries the thrown error', () => {
    const originalError = new Error('boom');
    const hub = createHub({
      mode: 'cjs',
      cjsRegistry: {
        state: {
          load: (_ctx) => { throw originalError; },
        },
      },
    });

    const result = hub.dispatch({ family: 'state', subcommand: 'load', args: [], cwd: '/', raw: false });

    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.HandlerFailure);
    assert.strictEqual(result.details.originalError, originalError);
  });

  test('hub does not throw when SDK handler throws (sdk mode)', () => {
    const hub = createHub({
      mode: 'sdk',
      sdkLoader: () => (_input) => { throw new Error('sdk internal error'); },
    });

    let result;
    assert.doesNotThrow(() => {
      result = hub.dispatch({ family: 'phase', subcommand: 'add', args: [], cwd: '/', raw: false });
    });

    // SDK execution throw maps to SdkDispatchFailed (not HandlerFailure)
    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.SdkDispatchFailed);
  });
});

// ─── errorKind: SdkLoadFailed ─────────────────────────────────────────────────

describe('CommandRoutingHub — errorKind: SdkLoadFailed', () => {
  test('returns SdkLoadFailed when sdkLoader throws', () => {
    const hub = createHub({
      mode: 'sdk',
      sdkLoader: () => { throw new Error('sdk/dist not found'); },
    });

    const result = hub.dispatch({ family: 'phase', subcommand: 'add', args: [], cwd: '/', raw: false });

    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.SdkLoadFailed);
  });

  test('returns SdkLoadFailed when sdkLoader returns null', () => {
    const hub = createHub({
      mode: 'sdk',
      sdkLoader: () => null,
    });

    const result = hub.dispatch({ family: 'phase', subcommand: 'add', args: [], cwd: '/', raw: false });

    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.SdkLoadFailed);
  });

  test('returns SdkLoadFailed when sdkLoader returns a non-function', () => {
    const hub = createHub({
      mode: 'sdk',
      sdkLoader: () => 'not-a-function',
    });

    const result = hub.dispatch({ family: 'phase', subcommand: 'add', args: [], cwd: '/', raw: false });

    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.SdkLoadFailed);
  });
});

// ─── errorKind: SdkDispatchFailed ─────────────────────────────────────────────

describe('CommandRoutingHub — errorKind: SdkDispatchFailed', () => {
  test('returns SdkDispatchFailed when SDK returns ok:false', () => {
    const sdkExecute = (_input) => ({
      ok: false,
      exitCode: 1,
      errorKind: 'native_failure',
      errorDetails: { message: 'phase not found' },
    });
    const hub = createHub({
      mode: 'sdk',
      sdkLoader: () => sdkExecute,
    });

    const result = hub.dispatch({ family: 'phase', subcommand: 'complete', args: ['99'], cwd: '/', raw: false });

    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.SdkDispatchFailed);
    assert.ok(result.message.includes('phase not found'));
  });

  test('SdkDispatchFailed details.originalError is populated when SDK throws', () => {
    const sdkError = new Error('sdk crashed mid-dispatch');
    const hub = createHub({
      mode: 'sdk',
      sdkLoader: () => (_input) => { throw sdkError; },
    });

    const result = hub.dispatch({ family: 'phase', subcommand: 'add', args: [], cwd: '/', raw: false });

    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.SdkDispatchFailed);
    assert.strictEqual(result.details.originalError, sdkError);
  });

  test('no transparent fallback: SDK crash does NOT retry via CJS', () => {
    // Provide a cjsRegistry — hub should NOT call it after SDK failure.
    const cjsCalls = [];
    const hub = createHub({
      mode: 'sdk',
      sdkLoader: () => (_input) => { throw new Error('sdk dead'); },
      cjsRegistry: {
        phase: {
          add: (_ctx) => { cjsCalls.push(true); return { ok: true, data: 'cjs-result' }; },
        },
      },
    });

    const result = hub.dispatch({ family: 'phase', subcommand: 'add', args: [], cwd: '/', raw: false });

    assert.equal(cjsCalls.length, 0, 'CJS handler must not be called when mode is sdk');
    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.SdkDispatchFailed);
  });
});

// ─── mode is fixed at construction ────────────────────────────────────────────

describe('CommandRoutingHub — mode fixed at construction', () => {
  test('sdk-mode hub never calls cjsRegistry even when sdkLoader later fails', () => {
    const cjsCalls = [];
    // Start with a working sdkLoader
    let sdkShouldWork = true;
    const hub = createHub({
      mode: 'sdk',
      sdkLoader: () => {
        if (!sdkShouldWork) throw new Error('sdk unavailable');
        return (_input) => ({ ok: true, data: 'sdk-data', exitCode: 0 });
      },
      cjsRegistry: {
        phase: {
          add: (_ctx) => { cjsCalls.push(true); return { ok: true, data: 'cjs-data' }; },
        },
      },
    });

    // First dispatch: SDK works
    const first = hub.dispatch({ family: 'phase', subcommand: 'add', args: [], cwd: '/', raw: false });
    assert.ok(first.ok);
    assert.equal(first.data, 'sdk-data');
    assert.equal(cjsCalls.length, 0);

    // SDK breaks between calls — mode is still 'sdk', no fallback to cjs
    sdkShouldWork = false;
    const second = hub.dispatch({ family: 'phase', subcommand: 'add', args: [], cwd: '/', raw: false });
    assert.ok(!second.ok);
    assert.equal(second.errorKind, ERROR_KINDS.SdkLoadFailed);
    assert.equal(cjsCalls.length, 0, 'CJS handler must never be called from an sdk-mode hub');
  });

  test('cjs-mode hub never calls sdkLoader', () => {
    const sdkCalls = [];
    const hub = createHub({
      mode: 'cjs',
      sdkLoader: () => { sdkCalls.push(true); return () => ({ ok: true, data: 'sdk' }); },
      cjsRegistry: {
        phase: {
          add: (_ctx) => ({ ok: true, data: 'cjs-ok' }),
        },
      },
    });

    const result = hub.dispatch({ family: 'phase', subcommand: 'add', args: [], cwd: '/', raw: false });

    assert.ok(result.ok);
    assert.equal(result.data, 'cjs-ok');
    assert.equal(sdkCalls.length, 0, 'sdkLoader must never be called from a cjs-mode hub');
  });
});

// ─── hub never throws ─────────────────────────────────────────────────────────

describe('CommandRoutingHub — hub never throws', () => {
  test('hub does not throw even when cjsRegistry is completely absent in cjs mode', () => {
    const hub = createHub({ mode: 'cjs' });

    let result;
    assert.doesNotThrow(() => {
      result = hub.dispatch({ family: 'phase', subcommand: 'add', args: [], cwd: '/', raw: false });
    });

    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.UnknownCommand);
  });

  test('hub does not throw when sdkLoader is absent in sdk mode', () => {
    const hub = createHub({ mode: 'sdk' });

    let result;
    assert.doesNotThrow(() => {
      result = hub.dispatch({ family: 'phase', subcommand: 'add', args: [], cwd: '/', raw: false });
    });

    assert.ok(!result.ok);
    assert.equal(result.errorKind, ERROR_KINDS.SdkLoadFailed);
  });

  test('hub does not throw when dispatch receives malformed request', () => {
    const hub = createHub({ mode: 'cjs', cjsRegistry: {} });

    let result;
    assert.doesNotThrow(() => {
      // Missing family — would normally throw on string ops
      result = hub.dispatch({ family: undefined, subcommand: 'add', args: [], cwd: '/', raw: false });
    });

    // Result is an error, not a thrown exception
    assert.ok(!result.ok);
  });
});
