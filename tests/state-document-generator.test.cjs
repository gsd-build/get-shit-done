'use strict';

/**
 * Parity test — verifies that state-document.generated.cjs produces identical
 * results to the compiled SDK ESM output for all exported functions.
 *
 * SDK side: require('../sdk/dist/query/state-document.js') via createRequire
 * CJS side: require('../get-shit-done/bin/lib/state-document.generated.cjs')
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

// The SDK dist is ESM; wrap with createRequire targeting the project root so
// Node resolves the path correctly from this CJS context.
const requireFromRoot = createRequire(__filename);

// CJS side — direct require works fine
const cjs = requireFromRoot('../get-shit-done/bin/lib/state-document.generated.cjs');

describe('state-document-generator parity: stateReplaceFieldWithFallback', async () => {
  const sdk = await import('../sdk/dist/query/state-document.js');

  const fixtures = [
    {
      label: 'primary hit',
      content: 'Status: old\nState: backup',
      primary: 'Status',
      fallback: 'State',
      value: 'new',
      expected: 'Status: new\nState: backup',
    },
    {
      label: 'fallback hit',
      content: 'Other: something\nState: backup',
      primary: 'Status',
      fallback: 'State',
      value: 'new',
      expected: 'Other: something\nState: new',
    },
    {
      label: 'neither hit returns unchanged content',
      content: 'Other: something\nAnother: value',
      primary: 'Status',
      fallback: 'State',
      value: 'new',
      expected: 'Other: something\nAnother: value',
    },
  ];

  for (const { label, content, primary, fallback, value, expected } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.stateReplaceFieldWithFallback(content, primary, fallback, value);
      const cjsResult = cjs.stateReplaceFieldWithFallback(content, primary, fallback, value);
      assert.strictEqual(sdkResult, expected, `SDK: ${label}`);
      assert.strictEqual(cjsResult, expected, `CJS: ${label}`);
      assert.strictEqual(sdkResult, cjsResult, `SDK/CJS parity: ${label}`);
    });
  }
});

describe('state-document-generator parity: normalizeStateStatus', async () => {
  const sdk = await import('../sdk/dist/query/state-document.js');

  const fixtures = [
    { label: 'paused via "paused"', status: 'paused', expected: 'paused' },
    { label: 'paused via "stopped"', status: 'stopped', expected: 'paused' },
    { label: 'paused via non-null pausedAt', status: 'active', pausedAt: '2024-01-01', expected: 'paused' },
    { label: 'executing via "executing"', status: 'executing', expected: 'executing' },
    { label: 'executing via "in progress"', status: 'in progress', expected: 'executing' },
    { label: 'executing via "ready to execute"', status: 'ready to execute', expected: 'executing' },
    { label: 'planning via "planning"', status: 'planning', expected: 'planning' },
    { label: 'discussing via "discussing"', status: 'discussing', expected: 'discussing' },
    { label: 'verifying via "verif"', status: 'verifying', expected: 'verifying' },
    { label: 'completed via "complete"', status: 'completed', expected: 'completed' },
    { label: 'completed via "done"', status: 'done', expected: 'completed' },
    { label: 'unknown fallback', status: 'something-else', expected: 'something-else' },
    { label: 'null status', status: null, expected: 'unknown' },
  ];

  for (const { label, status, pausedAt, expected } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.normalizeStateStatus(status, pausedAt);
      const cjsResult = cjs.normalizeStateStatus(status, pausedAt);
      assert.strictEqual(sdkResult, expected, `SDK: ${label}`);
      assert.strictEqual(cjsResult, expected, `CJS: ${label}`);
      assert.strictEqual(sdkResult, cjsResult, `SDK/CJS parity: ${label}`);
    });
  }
});

describe('state-document-generator parity: computeProgressPercent', async () => {
  const sdk = await import('../sdk/dist/query/state-document.js');

  const fixtures = [
    { label: 'only plans data', cp: 3, tp: 10, cf: null, tf: null, expected: 30 },
    { label: 'only phases data', cp: null, tp: null, cf: 2, tf: 4, expected: 50 },
    { label: 'both present uses min', cp: 8, tp: 10, cf: 3, tf: 10, expected: 30 },
    { label: 'neither returns null', cp: null, tp: null, cf: null, tf: null, expected: null },
    { label: 'total of 0 treated as no data', cp: 0, tp: 0, cf: null, tf: null, expected: null },
  ];

  for (const { label, cp, tp, cf, tf, expected } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.computeProgressPercent(cp, tp, cf, tf);
      const cjsResult = cjs.computeProgressPercent(cp, tp, cf, tf);
      assert.strictEqual(sdkResult, expected, `SDK: ${label}`);
      assert.strictEqual(cjsResult, expected, `CJS: ${label}`);
      assert.strictEqual(sdkResult, cjsResult, `SDK/CJS parity: ${label}`);
    });
  }
});

describe('state-document-generator parity: shouldPreserveExistingProgress', async () => {
  const sdk = await import('../sdk/dist/query/state-document.js');

  const fixtures = [
    {
      label: 'existing exceeds derived on total_phases → true',
      existing: { total_phases: 10 },
      derived: { total_phases: 5 },
      expected: true,
    },
    {
      label: 'derived exceeds existing → false',
      existing: { total_phases: 5 },
      derived: { total_phases: 10 },
      expected: false,
    },
    {
      label: 'malformed input (non-object) → false',
      existing: null,
      derived: { total_phases: 5 },
      expected: false,
    },
    {
      label: 'both null → false',
      existing: null,
      derived: null,
      expected: false,
    },
  ];

  for (const { label, existing, derived, expected } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.shouldPreserveExistingProgress(existing, derived);
      const cjsResult = cjs.shouldPreserveExistingProgress(existing, derived);
      assert.strictEqual(sdkResult, expected, `SDK: ${label}`);
      assert.strictEqual(cjsResult, expected, `CJS: ${label}`);
      assert.strictEqual(sdkResult, cjsResult, `SDK/CJS parity: ${label}`);
    });
  }
});

describe('state-document-generator parity: normalizeProgressNumbers', async () => {
  const sdk = await import('../sdk/dist/query/state-document.js');

  const fixtures = [
    {
      label: 'coerces all five tracked keys to numbers',
      input: { total_phases: '10', completed_phases: '3', total_plans: '5', completed_plans: '2', percent: '60' },
      expected: { total_phases: 10, completed_phases: 3, total_plans: 5, completed_plans: 2, percent: 60 },
    },
    {
      label: 'non-object null returned unchanged',
      input: null,
      expected: null,
    },
    {
      label: 'extra keys preserved untouched',
      input: { total_phases: '4', extra_key: 'hello' },
      expected: { total_phases: 4, extra_key: 'hello' },
    },
  ];

  for (const { label, input, expected } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.normalizeProgressNumbers(input);
      const cjsResult = cjs.normalizeProgressNumbers(input);
      assert.deepStrictEqual(sdkResult, expected, `SDK: ${label}`);
      assert.deepStrictEqual(cjsResult, expected, `CJS: ${label}`);
      assert.deepStrictEqual(sdkResult, cjsResult, `SDK/CJS parity: ${label}`);
    });
  }
});

// SDK ESM side — dynamically import so we can test both; wrap in a top-level
// async test suite.
describe('state-document-generator parity: stateExtractField', async () => {
  const sdk = await import('../sdk/dist/query/state-document.js');

  const fixtures = [
    {
      label: 'bold pattern',
      content: 'Some content\n**FieldName:** the value\nMore content',
      fieldName: 'FieldName',
      expected: 'the value',
    },
    {
      label: 'plain pattern',
      content: 'Some content\nFieldName: the value\nMore content',
      fieldName: 'FieldName',
      expected: 'the value',
    },
    {
      label: 'missing field returns null',
      content: 'Some content\nOtherField: something\nMore content',
      fieldName: 'FieldName',
      expected: null,
    },
  ];

  for (const { label, content, fieldName, expected } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.stateExtractField(content, fieldName);
      const cjsResult = cjs.stateExtractField(content, fieldName);
      assert.strictEqual(sdkResult, expected, `SDK: ${label}`);
      assert.strictEqual(cjsResult, expected, `CJS: ${label}`);
      assert.strictEqual(sdkResult, cjsResult, `SDK/CJS parity: ${label}`);
    });
  }
});

describe('state-document-generator parity: stateReplaceField', async () => {
  const sdk = await import('../sdk/dist/query/state-document.js');

  const fixtures = [
    {
      label: 'bold replace',
      content: 'Some content\n**Status:** old value\nMore content',
      fieldName: 'Status',
      newValue: 'new value',
      expected: 'Some content\n**Status:** new value\nMore content',
    },
    {
      label: 'plain replace',
      content: 'Some content\nStatus: old value\nMore content',
      fieldName: 'Status',
      newValue: 'new value',
      expected: 'Some content\nStatus: new value\nMore content',
    },
    {
      label: 'missing field returns null',
      content: 'Some content\nOtherField: something\nMore content',
      fieldName: 'Status',
      newValue: 'new value',
      expected: null,
    },
  ];

  for (const { label, content, fieldName, newValue, expected } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.stateReplaceField(content, fieldName, newValue);
      const cjsResult = cjs.stateReplaceField(content, fieldName, newValue);
      assert.strictEqual(sdkResult, expected, `SDK: ${label}`);
      assert.strictEqual(cjsResult, expected, `CJS: ${label}`);
      assert.strictEqual(sdkResult, cjsResult, `SDK/CJS parity: ${label}`);
    });
  }
});
