// allow-test-rule: source-text-is-the-product
// These docs tables are the shipped operator surface for runtime model tiers.

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { catalog, KNOWN_RUNTIMES } = require('../get-shit-done/bin/lib/model-catalog.cjs');

const ROOT = path.join(__dirname, '..');
const SETTINGS_ADVANCED = fs.readFileSync(path.join(ROOT, 'get-shit-done', 'workflows', 'settings-advanced.md'), 'utf8');
const CONFIG_DOC = fs.readFileSync(path.join(ROOT, 'docs', 'CONFIGURATION.md'), 'utf8');

describe('model catalog runtime defaults parity (#3229)', () => {
  test('known runtimes include hermes and match catalog keys', () => {
    assert.ok(KNOWN_RUNTIMES.has('hermes'));
    assert.deepStrictEqual([...KNOWN_RUNTIMES].sort(), Object.keys(catalog.runtimeTierDefaults).sort());
  });

  test('settings-advanced runtime defaults table matches catalog for concrete runtimes', () => {
    for (const [runtime, tiers] of Object.entries(catalog.runtimeTierDefaults)) {
      if (!tiers.opus) continue; // Group B runtimes intentionally have no built-ins
      assert.ok(SETTINGS_ADVANCED.includes(`| \`${runtime}\``), `settings-advanced.md missing ${runtime} row`);
      for (const alias of ['opus', 'sonnet', 'haiku']) {
        const entry = tiers[alias];
        assert.ok(entry?.model, `${runtime}.${alias} missing model in catalog`);
        assert.ok(
          SETTINGS_ADVANCED.includes(`\`${entry.model}\``),
          `settings-advanced.md missing ${runtime}.${alias} model ${entry.model}`,
        );
      }
    }
  });

  test('CONFIGURATION runtime defaults table matches catalog for concrete runtimes', () => {
    for (const [runtime, tiers] of Object.entries(catalog.runtimeTierDefaults)) {
      if (!tiers.opus) continue;
      assert.ok(CONFIG_DOC.includes(`| \`${runtime}\``), `CONFIGURATION.md missing ${runtime} row`);
      for (const alias of ['opus', 'sonnet', 'haiku']) {
        const entry = tiers[alias];
        assert.ok(
          CONFIG_DOC.includes(`\`${entry.model}\``),
          `CONFIGURATION.md missing ${runtime}.${alias} model ${entry.model}`,
        );
      }
    }
  });

  test('Group B runtimes remain documented as having no built-in defaults', () => {
    const groupB = ['kilo', 'cline', 'cursor', 'windsurf', 'augment', 'trae', 'codebuddy', 'antigravity'];
    for (const runtime of groupB) {
      const tiers = catalog.runtimeTierDefaults[runtime];
      assert.equal(tiers.opus, null);
      assert.equal(tiers.sonnet, null);
      assert.equal(tiers.haiku, null);
    }
    assert.ok(SETTINGS_ADVANCED.includes('Group B'));
    assert.ok(CONFIG_DOC.includes('Group B'));
  });
});
