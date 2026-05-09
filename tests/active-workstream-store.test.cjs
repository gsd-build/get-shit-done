const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  validateWorkstreamName,
  parseCliWorkstream,
  resolveActiveWorkstream,
  applyResolvedWorkstreamEnv,
} = require('../get-shit-done/bin/lib/active-workstream-store.cjs');

describe('active-workstream-store', () => {
  test('validateWorkstreamName accepts canonical names', () => {
    assert.equal(validateWorkstreamName('alpha'), true);
    assert.equal(validateWorkstreamName('alpha_2'), true);
    assert.equal(validateWorkstreamName('alpha-2'), true);
  });

  test('validateWorkstreamName rejects invalid names', () => {
    assert.equal(validateWorkstreamName('alpha beta'), false);
    assert.equal(validateWorkstreamName('../alpha'), false);
    assert.equal(validateWorkstreamName('alpha/beta'), false);
  });

  test('parseCliWorkstream parses --ws=<name>', () => {
    const parsed = parseCliWorkstream(['state', 'json', '--ws=alpha', '--raw']);
    assert.equal(parsed.value, 'alpha');
    assert.equal(parsed.source, 'cli');
    assert.deepEqual(parsed.args, ['state', 'json', '--raw']);
  });

  test('parseCliWorkstream parses --ws <name>', () => {
    const parsed = parseCliWorkstream(['state', 'json', '--ws', 'alpha', '--raw']);
    assert.equal(parsed.value, 'alpha');
    assert.equal(parsed.source, 'cli');
    assert.deepEqual(parsed.args, ['state', 'json', '--raw']);
  });

  test('parseCliWorkstream throws on missing value', () => {
    assert.throws(
      () => parseCliWorkstream(['state', 'json', '--ws']),
      /Missing value for --ws/
    );
  });

  test('resolveActiveWorkstream precedence: cli > env > store', () => {
    const cli = resolveActiveWorkstream('/repo', ['state', 'json', '--ws', 'cli-ws'], {
      GSD_WORKSTREAM: 'env-ws',
    }, {
      getStored: () => 'store-ws',
    });
    assert.equal(cli.ws, 'cli-ws');
    assert.equal(cli.source, 'cli');

    const env = resolveActiveWorkstream('/repo', ['state', 'json'], {
      GSD_WORKSTREAM: 'env-ws',
    }, {
      getStored: () => 'store-ws',
    });
    assert.equal(env.ws, 'env-ws');
    assert.equal(env.source, 'env');

    const store = resolveActiveWorkstream('/repo', ['state', 'json'], {
      GSD_WORKSTREAM: '',
    }, {
      getStored: () => 'store-ws',
    });
    assert.equal(store.ws, 'store-ws');
    assert.equal(store.source, 'store');
  });

  test('resolveActiveWorkstream returns none when no source provides a workstream', () => {
    const resolved = resolveActiveWorkstream('/repo', ['state', 'json'], {
      GSD_WORKSTREAM: '',
    }, {
      getStored: () => null,
    });
    assert.equal(resolved.ws, null);
    assert.equal(resolved.source, 'none');
  });

  test('resolveActiveWorkstream rejects invalid selected name', () => {
    assert.throws(
      () => resolveActiveWorkstream('/repo', ['state', 'json', '--ws', 'bad/name']),
      /Invalid workstream name/
    );
  });

  test('applyResolvedWorkstreamEnv sets env only when ws exists', () => {
    const env = { GSD_WORKSTREAM: 'old' };
    applyResolvedWorkstreamEnv({ ws: null }, env);
    assert.equal(env.GSD_WORKSTREAM, 'old');

    applyResolvedWorkstreamEnv({ ws: 'new-ws' }, env);
    assert.equal(env.GSD_WORKSTREAM, 'new-ws');
  });
});

