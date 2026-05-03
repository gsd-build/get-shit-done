'use strict';

// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Do not copy this pattern.

/**
 * Bug #2524: gsd-sdk query --ws <name> silently ignores the workstream flag.
 *
 * This file is structural/static coverage only (source-file assertions).
 * Runtime forwarding coverage for the query adapter path lives in:
 *   sdk/src/query/query-cli-adapter.test.ts
 *
 * Uses static source-file text assertions (no sdk/dist/ build required in CI).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const helpersTs = fs.readFileSync(
  path.join(__dirname, '../sdk/src/query/helpers.ts'),
  'utf-8',
);
const registryTs = fs.readFileSync(
  path.join(__dirname, '../sdk/src/query/registry.ts'),
  'utf-8',
);
const cliTs = fs.readFileSync(
  path.join(__dirname, '../sdk/src/cli.ts'),
  'utf-8',
);

// ─── Layer 3: planningPaths() accepts workstream ───────────────────────────

describe('planningPaths() workstream support', () => {
  test('planningPaths signature includes optional workstream parameter', () => {
    assert.ok(
      helpersTs.includes('planningPaths(projectDir: string, workstream?: string)'),
      'planningPaths must accept an optional workstream parameter',
    );
  });

  test('planningPaths uses relPlanningPath(workstream) to compute the base path', () => {
    assert.ok(
      helpersTs.includes('relPlanningPath(workstream)'),
      'planningPaths must call relPlanningPath(workstream) to scope the base path',
    );
  });

  test('planningPaths imports relPlanningPath from workstream-utils', () => {
    assert.ok(
      helpersTs.includes('relPlanningPath'),
      'helpers.ts must import/use relPlanningPath from workstream-utils',
    );
  });
});

// ─── Layer 2: QueryRegistry.dispatch() accepts workstream ─────────────────

describe('QueryRegistry.dispatch() workstream threading', () => {
  test('dispatch method signature includes workstream parameter', () => {
    assert.ok(
      registryTs.includes('workstream?: string'),
      'dispatch() must accept an optional workstream parameter',
    );
  });

  test('dispatch forwards workstream to the handler as third argument', () => {
    assert.ok(
      registryTs.includes('handler(args, projectDir, workstream)'),
      'dispatch() must pass workstream as the third argument to the handler',
    );
  });

  test('QueryHandler type accepts a third workstream argument', () => {
    // QueryHandler type is defined in utils.ts, but registry.ts imports and uses it
    const utilsTs = fs.readFileSync(
      path.join(__dirname, '../sdk/src/query/utils.ts'),
      'utf-8',
    );
    assert.ok(
      utilsTs.includes('workstream?: string') && utilsTs.includes('QueryHandler'),
      'QueryHandler type must include an optional workstream parameter',
    );
  });
});

// ─── Layer 1: CLI forwards args.ws to registry.dispatch() ─────────────────

describe('CLI forwards --ws to registry.dispatch()', () => {

  test('cli.ts defines a ws field in ParsedCliArgs', () => {
    assert.ok(
      cliTs.includes('ws: string | undefined'),
      'ParsedCliArgs must have a ws field typed as string | undefined',
    );
  });

  test('cli.ts parses --ws flag from query argv', () => {
    assert.ok(
      cliTs.includes("if (a === '--ws' && argv[i + 1])"),
      'cli.ts query permissive parser must handle the --ws flag',
    );
  });

});
