'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('bug #3091: sdk install guidance and agent fallbacks use query-capable CLI', () => {
  test('quick workflow install hint references get-shit-done-cc (not @gsd-build/sdk)', () => {
    const content = read('get-shit-done/workflows/quick.md');
    // After #3797: quick.md uses the standard local-first preflight which references
    // get-shit-done-cc via npx (not `npm install -g`). Either form is acceptable.
    const referencesGsdCc = content.includes('npm install -g get-shit-done-cc') ||
      content.includes('npx get-shit-done-cc');
    assert.ok(referencesGsdCc, 'quick.md install hint must reference get-shit-done-cc');
    assert.ok(!content.includes('npm install -g @gsd-build/sdk'));
  });

  test('agent docs no longer reference node_modules/@gsd-build/sdk/dist/cli.js query fallback', () => {
    const files = [
      'agents/gsd-planner.md',
      'agents/gsd-executor.md',
      'agents/gsd-plan-checker.md',
      'agents/gsd-roadmapper.md',
    ];

    const offenders = files.filter((f) => read(f).includes('@gsd-build/sdk/dist/cli.js query'));
    assert.deepStrictEqual(offenders, [], `stale @gsd-build/sdk query fallback references: ${offenders.join(', ')}`);
  });
});
