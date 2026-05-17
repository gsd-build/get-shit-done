'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const migration = require(path.join(
  __dirname,
  '..',
  'get-shit-done',
  'bin',
  'lib',
  'installer-migrations',
  '002-codex-legacy-hooks-json.cjs',
));

describe('bug #3442: codex legacy hooks.json migration consumes shared managed-hook policy', () => {
  test('plan prunes managed codex hook commands including legacy alias', () => {
    const configDir = '/Users/me/.codex';
    const hooksJson = {
      hooks: [
        { command: '"/usr/local/bin/node" "/Users/me/.codex/hooks/gsd-check-update.js"' },
        { command: '"/usr/local/bin/node" "/Users/me/.codex/hooks/gsd-update-check.js"' },
        { command: '"/usr/local/bin/node" "/Users/me/.codex/hooks/custom-hook.js"' },
      ],
    };

    const actions = migration.plan({
      configDir,
      readJson: () => ({ exists: true, error: null, value: hooksJson }),
    });

    assert.equal(actions.length, 1);
    assert.equal(actions[0].type, 'rewrite-json');
    assert.equal(actions[0].relPath, 'hooks.json');
    assert.deepEqual(actions[0].value, {
      hooks: [
        { command: '"/usr/local/bin/node" "/Users/me/.codex/hooks/custom-hook.js"' },
      ],
    });
  });

  test('plan preserves similarly named commands outside the managed hooks directory', () => {
    const configDir = '/Users/me/.codex';
    const hooksJson = {
      hooks: [
        { command: '"/usr/local/bin/node" "/tmp/other/hooks/gsd-check-update.js"' },
      ],
    };

    const actions = migration.plan({
      configDir,
      readJson: () => ({ exists: true, error: null, value: hooksJson }),
    });

    assert.deepEqual(actions, []);
  });
});
