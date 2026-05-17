'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { routeRoadmapCommand } = require('../get-shit-done/bin/lib/roadmap-command-router.cjs');

// These tests exercise the CJS dispatch path of the router. Since #3577 the
// router prefers the SDK bridge when sdk/dist is present, which would bypass
// the mocked `roadmap` handlers below. The router gates SDK dispatch on
// `process.env.GSD_WORKSTREAM` being unset, so set it here to deterministically
// take the CJS path that the mocks model.
let _prevWorkstream;
before(() => {
  _prevWorkstream = process.env.GSD_WORKSTREAM;
  process.env.GSD_WORKSTREAM = 'test-unit';
});
after(() => {
  if (_prevWorkstream === undefined) delete process.env.GSD_WORKSTREAM;
  else process.env.GSD_WORKSTREAM = _prevWorkstream;
});

describe('roadmap-command-router', () => {
  test('routes roadmap analyze', () => {
    const calls = [];
    const roadmap = {
      cmdRoadmapAnalyze: (cwd, raw) => calls.push({ cwd, raw }),
    };

    routeRoadmapCommand({
      roadmap,
      args: ['roadmap', 'analyze'],
      cwd: '/tmp/proj',
      raw: true,
      error: (msg) => {
        throw new Error(msg);
      },
    });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { cwd: '/tmp/proj', raw: true });
  });

  test('routes roadmap get-phase and update-plan-progress with phase arg', () => {
    const calls = [];
    const roadmap = {
      cmdRoadmapGetPhase: (cwd, phase, raw) => calls.push({ kind: 'get', cwd, phase, raw }),
      cmdRoadmapUpdatePlanProgress: (cwd, phase, raw) => calls.push({ kind: 'update', cwd, phase, raw }),
    };

    routeRoadmapCommand({
      roadmap,
      args: ['roadmap', 'get-phase', '10'],
      cwd: '/tmp/proj',
      raw: false,
      error: (msg) => {
        throw new Error(msg);
      },
    });

    routeRoadmapCommand({
      roadmap,
      args: ['roadmap', 'update-plan-progress', '10'],
      cwd: '/tmp/proj',
      raw: false,
      error: (msg) => {
        throw new Error(msg);
      },
    });

    assert.deepEqual(calls, [
      { kind: 'get', cwd: '/tmp/proj', phase: '10', raw: false },
      { kind: 'update', cwd: '/tmp/proj', phase: '10', raw: false },
    ]);
  });

  test('errors on unknown roadmap subcommand', () => {
    let message = null;
    routeRoadmapCommand({
      roadmap: {},
      args: ['roadmap', 'nonsense'],
      cwd: '/tmp/proj',
      raw: false,
      error: (msg) => {
        message = msg;
      },
    });

    assert.equal(message, 'Unknown roadmap subcommand. Available: analyze, get-phase, update-plan-progress, annotate-dependencies');
  });
});
