import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { SECRET_CONFIG_KEYS, isSecretKey, maskSecret, maskIfSecret } from './secrets.js';
// Parity check against the CJS module.
import secretsCjs from '../../../get-shit-done/bin/lib/secrets.cjs';

describe('Bug #2997: SDK secrets module', () => {
  it('SECRET_CONFIG_KEYS exposes the documented set (locked)', () => {
    assert.deepEqual([...SECRET_CONFIG_KEYS].sort(), ['brave_search', 'exa_search', 'firecrawl']);
  });

  it('isSecretKey returns true for each registered secret', () => {
    for (const k of SECRET_CONFIG_KEYS) {
      assert.equal(isSecretKey(k), true, `${k} should be a secret`);
    }
  });

  it('isSecretKey returns false for unrelated keys', () => {
    for (const k of ['model_profile', 'commit_docs', 'workflow.plan_bounce', 'unknown_key']) {
      assert.equal(isSecretKey(k), false);
    }
  });

  it('maskSecret renders the convention ****<last-4> for ≥8-char strings', () => {
    assert.equal(maskSecret('BSA-secret-key-abcd1234'), '****1234');
    assert.equal(maskSecret('12345678'), '****5678');
  });

  it('maskSecret renders **** with no tail for <8-char strings', () => {
    assert.equal(maskSecret('short'), '****');
    assert.equal(maskSecret('abc'), '****');
    assert.equal(maskSecret('1234567'), '****');
  });

  it('maskSecret renders (unset) for null/undefined/empty', () => {
    assert.equal(maskSecret(null), '(unset)');
    assert.equal(maskSecret(undefined), '(unset)');
    assert.equal(maskSecret(''), '(unset)');
  });

  it('maskIfSecret passes non-secret values through unchanged', () => {
    assert.equal(maskIfSecret('model_profile', 'quality'), 'quality');
    assert.equal(maskIfSecret('commit_docs', true), true);
  });

  it('maskIfSecret masks secret values', () => {
    assert.equal(maskIfSecret('brave_search', 'BSA-1234567890'), '****7890');
    assert.equal(maskIfSecret('firecrawl', null), '(unset)');
  });

  // Parity with the CJS module — single source of truth via test enforcement,
  // not import. Ensures SDK and CJS can never drift on the masking rule.
  describe('CJS parity (#2997)', () => {
    it('SECRET_CONFIG_KEYS matches the CJS set exactly', () => {
      const cjsKeys = [...secretsCjs.SECRET_CONFIG_KEYS].sort();
      const tsKeys = [...SECRET_CONFIG_KEYS].sort();
      assert.deepEqual(tsKeys, cjsKeys);
    });

    for (const sample of ['', 'a', 'abc', '12345678', 'BSA-1234567890', null, undefined]) {
      it(`maskSecret(${JSON.stringify(sample)}) matches CJS output`, () => {
        assert.equal(maskSecret(sample), secretsCjs.maskSecret(sample));
      });
    }
  });
});
