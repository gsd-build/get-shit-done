'use strict';

/**
 * Parity test — verifies that schema-detect.generated.cjs produces identical
 * results to the compiled SDK ESM output for all exported functions.
 *
 * SDK side: import('../sdk/dist/query/schema-detect.js')
 * CJS side: require('../get-shit-done/bin/lib/schema-detect.generated.cjs')
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

const requireFromRoot = createRequire(__filename);

// CJS side — direct require works fine
const cjs = requireFromRoot('../get-shit-done/bin/lib/schema-detect.generated.cjs');

// ── detectSchemaFiles ─────────────────────────────────────────────────────

describe('schema-detect-generator parity: detectSchemaFiles', async () => {
  const sdk = await import('../sdk/dist/query/schema-detect.js');

  const fixtures = [
    {
      label: 'detects prisma schema',
      files: ['prisma/schema.prisma'],
      expectedDetected: true,
      expectedOrms: ['prisma'],
    },
    {
      label: 'detects drizzle schema',
      files: ['drizzle/schema.ts'],
      expectedDetected: true,
      expectedOrms: ['drizzle'],
    },
    {
      label: 'detects supabase migration',
      files: ['supabase/migrations/001_init.sql'],
      expectedDetected: true,
      expectedOrms: ['supabase'],
    },
    {
      label: 'detects payload collection',
      files: ['src/collections/Users.ts'],
      expectedDetected: true,
      expectedOrms: ['payload'],
    },
    {
      label: 'detects typeorm entity',
      files: ['src/entities/User.ts'],
      expectedDetected: true,
      expectedOrms: ['typeorm'],
    },
    {
      label: 'no schema files returns not detected',
      files: ['src/components/Button.tsx', 'src/styles/main.css'],
      expectedDetected: false,
      expectedOrms: [],
    },
    {
      label: 'multiple ORMs detected',
      files: ['prisma/schema.prisma', 'drizzle/schema.ts'],
      expectedDetected: true,
      expectedOrms: ['prisma', 'drizzle'],
    },
    {
      label: 'normalizes Windows backslash paths',
      files: ['prisma\\schema.prisma'],
      expectedDetected: true,
      expectedOrms: ['prisma'],
    },
    {
      label: 'empty file list returns not detected',
      files: [],
      expectedDetected: false,
      expectedOrms: [],
    },
  ];

  for (const { label, files, expectedDetected, expectedOrms } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.detectSchemaFiles(files);
      const cjsResult = cjs.detectSchemaFiles(files);

      assert.strictEqual(sdkResult.detected, expectedDetected, `SDK detected: ${label}`);
      assert.deepStrictEqual(sdkResult.orms.sort(), expectedOrms.sort(), `SDK orms: ${label}`);

      assert.strictEqual(cjsResult.detected, expectedDetected, `CJS detected: ${label}`);
      assert.deepStrictEqual(cjsResult.orms.sort(), expectedOrms.sort(), `CJS orms: ${label}`);

      // SDK and CJS must agree on detected and orms
      assert.strictEqual(sdkResult.detected, cjsResult.detected, `SDK/CJS parity detected: ${label}`);
      assert.deepStrictEqual(sdkResult.orms.sort(), cjsResult.orms.sort(), `SDK/CJS parity orms: ${label}`);
    });
  }
});

// ── checkSchemaDrift ──────────────────────────────────────────────────────

describe('schema-detect-generator parity: checkSchemaDrift', async () => {
  const sdk = await import('../sdk/dist/query/schema-detect.js');

  const fixtures = [
    {
      label: 'no schema files — no drift',
      changedFiles: ['src/components/Button.tsx'],
      executionLog: '',
      options: {},
      expectedDriftDetected: false,
      expectedBlocking: false,
    },
    {
      label: 'prisma changed with push evidence — no drift',
      changedFiles: ['prisma/schema.prisma'],
      executionLog: 'running: npx prisma db push --accept-data-loss',
      options: {},
      expectedDriftDetected: false,
      expectedBlocking: false,
    },
    {
      label: 'prisma changed without push — drift blocking',
      changedFiles: ['prisma/schema.prisma'],
      executionLog: 'tsc && vitest run',
      options: {},
      expectedDriftDetected: true,
      expectedBlocking: true,
    },
    {
      label: 'drift with skipCheck=true — not blocking',
      changedFiles: ['prisma/schema.prisma'],
      executionLog: 'tsc && vitest run',
      options: { skipCheck: true },
      expectedDriftDetected: true,
      expectedBlocking: false,
    },
  ];

  for (const { label, changedFiles, executionLog, options, expectedDriftDetected, expectedBlocking } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.checkSchemaDrift(changedFiles, executionLog, options);
      const cjsResult = cjs.checkSchemaDrift(changedFiles, executionLog, options);

      assert.strictEqual(sdkResult.driftDetected, expectedDriftDetected, `SDK driftDetected: ${label}`);
      assert.strictEqual(sdkResult.blocking, expectedBlocking, `SDK blocking: ${label}`);

      assert.strictEqual(cjsResult.driftDetected, expectedDriftDetected, `CJS driftDetected: ${label}`);
      assert.strictEqual(cjsResult.blocking, expectedBlocking, `CJS blocking: ${label}`);

      // Full structural parity between SDK and CJS
      assert.deepStrictEqual(sdkResult, cjsResult, `SDK/CJS parity: ${label}`);
    });
  }
});

// ── detectSchemaOrm (CJS-only compat export) ──────────────────────────────

describe('schema-detect-generator parity: detectSchemaOrm (CJS compat)', () => {
  test('returns ORM info for known orm', () => {
    const info = cjs.detectSchemaOrm('prisma');
    assert.ok(info !== null, 'prisma orm info should not be null');
    assert.ok(typeof info.pushCommand === 'string', 'pushCommand should be string');
    assert.ok(Array.isArray(info.evidencePatterns), 'evidencePatterns should be array');
  });

  test('returns null for unknown orm', () => {
    const info = cjs.detectSchemaOrm('unknown_orm');
    assert.strictEqual(info, null, 'unknown orm should return null');
  });

  test('returns info for all 5 known ORMs', () => {
    const orms = ['payload', 'prisma', 'drizzle', 'supabase', 'typeorm'];
    for (const orm of orms) {
      const info = cjs.detectSchemaOrm(orm);
      assert.ok(info !== null, `${orm} info should not be null`);
    }
  });
});

// ── SCHEMA_PATTERNS and ORM_INFO exports (compat) ────────────────────────

describe('schema-detect-generator: SCHEMA_PATTERNS and ORM_INFO exported', () => {
  test('SCHEMA_PATTERNS is an array', () => {
    assert.ok(Array.isArray(cjs.SCHEMA_PATTERNS), 'SCHEMA_PATTERNS should be an array');
    assert.ok(cjs.SCHEMA_PATTERNS.length > 0, 'SCHEMA_PATTERNS should not be empty');
  });

  test('ORM_INFO has known orm keys', () => {
    const orms = ['payload', 'prisma', 'drizzle', 'supabase', 'typeorm'];
    for (const orm of orms) {
      assert.ok(orm in cjs.ORM_INFO, `ORM_INFO should have key: ${orm}`);
    }
  });
});
