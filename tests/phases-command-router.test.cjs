'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { routePhasesCommand } = require('../get-shit-done/bin/lib/phases-command-router.cjs');

// These tests exercise the CJS dispatch path of the router. Since #3577 the
// router prefers the SDK bridge when sdk/dist is present, which would bypass
// the mocked `phase`/`milestone` handlers below. The router gates SDK
// dispatch on `process.env.GSD_WORKSTREAM` being unset, so set it for these
// tests to deterministically take the CJS path that the mocks model.
let _prevWorkstream;
before(() => {
  _prevWorkstream = process.env.GSD_WORKSTREAM;
  process.env.GSD_WORKSTREAM = 'test-unit';
});
after(() => {
  if (_prevWorkstream === undefined) delete process.env.GSD_WORKSTREAM;
  else process.env.GSD_WORKSTREAM = _prevWorkstream;
});

describe('phases-command-router', () => {
  test('routes phases list with parsed options', () => {
    const calls = [];
    const phase = {
      cmdPhasesList: (cwd, options, raw) => calls.push({ cwd, options, raw }),
    };

    routePhasesCommand({
      phase,
      milestone: {},
      args: ['phases', 'list', '--type', 'plans', '--phase', '10', '--include-archived'],
      cwd: '/tmp/proj',
      raw: true,
      error: (msg) => {
        throw new Error(msg);
      },
    });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      cwd: '/tmp/proj',
      options: { type: 'plans', phase: '10', includeArchived: true },
      raw: true,
    });
  });

  test('routes phases clear with trailing args', () => {
    const calls = [];
    const milestone = {
      cmdPhasesClear: (cwd, raw, trailing) => calls.push({ cwd, raw, trailing }),
    };

    routePhasesCommand({
      phase: {},
      milestone,
      args: ['phases', 'clear', '--confirm'],
      cwd: '/tmp/proj',
      raw: false,
      error: (msg) => {
        throw new Error(msg);
      },
    });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      cwd: '/tmp/proj',
      raw: false,
      trailing: ['--confirm'],
    });
  });

  test('errors on unknown phases subcommand', () => {
    let message = null;
    routePhasesCommand({
      phase: {},
      milestone: {},
      args: ['phases', 'archive'],
      cwd: '/tmp/proj',
      raw: false,
      error: (msg) => {
        message = msg;
      },
    });

    assert.equal(message, 'Unknown phases subcommand. Available: list, clear');
  });
});
