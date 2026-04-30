'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { routePhasesCommand } = require('../get-shit-done/bin/lib/phases-command-router.cjs');

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
