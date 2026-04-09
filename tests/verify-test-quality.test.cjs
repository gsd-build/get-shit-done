/**
 * Tests for the audit_test_quality step in verify-phase.md
 *
 * Validates that the verifier's test quality audit detects:
 * - Disabled tests (it.skip) covering requirements
 * - Circular tests (system generating its own expected values)
 * - Weak assertions on requirement-linked tests
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup } = require('./helpers.cjs');

describe('audit_test_quality step', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  describe('disabled test detection', () => {
    test('detects it.skip in test files', () => {
      const testDir = path.join(tmpDir, 'tests');
      fs.mkdirSync(testDir, { recursive: true });

      fs.writeFileSync(path.join(testDir, 'parity.test.js'), [
        'describe("parity", () => {',
        '  it.skip("matches PHP output", async () => {',
        '    expect(result).toBeCloseTo(155.96, 2);',
        '  });',
        '});',
      ].join('\n'));

      const content = fs.readFileSync(path.join(testDir, 'parity.test.js'), 'utf8');
      const skipPatterns = /it\.skip|describe\.skip|test\.skip|xit\(|xdescribe\(|xtest\(/g;
      const matches = content.match(skipPatterns);

      assert.ok(matches, 'Should detect skip patterns');
      assert.strictEqual(matches.length, 1);
    });

    test('detects multiple skip patterns across frameworks', () => {
      const testDir = path.join(tmpDir, 'tests');
      fs.mkdirSync(testDir, { recursive: true });

      fs.writeFileSync(path.join(testDir, 'multi.test.js'), [
        'describe.skip("suite", () => {});',
        'xit("old jasmine", () => {});',
        'test.skip("jest skip", () => {});',
        'it.todo("not implemented");',
      ].join('\n'));

      const content = fs.readFileSync(path.join(testDir, 'multi.test.js'), 'utf8');
      const skipPatterns = /it\.skip|describe\.skip|test\.skip|xit\(|xdescribe\(|xtest\(|it\.todo|test\.todo/g;
      const matches = content.match(skipPatterns);

      assert.ok(matches, 'Should detect all skip variants');
      assert.strictEqual(matches.length, 4);
    });

    test('does not flag active tests as skipped', () => {
      const testDir = path.join(tmpDir, 'tests');
      fs.mkdirSync(testDir, { recursive: true });

      fs.writeFileSync(path.join(testDir, 'active.test.js'), [
        'describe("active suite", () => {',
        '  it("does the thing", () => {',
        '    expect(result).toBe(true);',
        '  });',
        '  test("also works", () => {',
        '    expect(other).toBe(42);',
        '  });',
        '});',
      ].join('\n'));

      const content = fs.readFileSync(path.join(testDir, 'active.test.js'), 'utf8');
      const skipPatterns = /it\.skip|describe\.skip|test\.skip|xit\(|xdescribe\(|xtest\(|it\.todo|test\.todo/g;
      const matches = content.match(skipPatterns);

      assert.strictEqual(matches, null, 'Active tests should not match skip patterns');
    });
  });

  describe('circular test detection', () => {
    test('detects script that imports system-under-test and writes fixtures', () => {
      const testDir = path.join(tmpDir, 'tests');
      fs.mkdirSync(testDir, { recursive: true });

      fs.writeFileSync(path.join(testDir, 'captureBaseline.js'), [
        'import { CalculationService } from "../server/services/calculationService.js";',
        'import { writeFileSync } from "fs";',
        '',
        'const result = await CalculationService.execute(input);',
        'fixture.expectedOutput = result.value;',
        'writeFileSync("fixtures/data.json", JSON.stringify(fixture));',
      ].join('\n'));

      const content = fs.readFileSync(path.join(testDir, 'captureBaseline.js'), 'utf8');

      const importsSystem = /import.*(?:Service|Engine|Calculator|Controller)/.test(content);
      const writesFiles = /writeFileSync|writeFile|fs\.write/.test(content);

      assert.ok(importsSystem, 'Should detect system-under-test import');
      assert.ok(writesFiles, 'Should detect file writing');
      assert.ok(importsSystem && writesFiles, 'Script that imports SUT and writes fixtures is CIRCULAR');
    });

    test('does not flag test helpers that only read fixtures', () => {
      const testDir = path.join(tmpDir, 'tests');
      fs.mkdirSync(testDir, { recursive: true });

      fs.writeFileSync(path.join(testDir, 'loadFixtures.js'), [
        'import { readFileSync } from "fs";',
        'export function loadFixture(name) {',
        '  return JSON.parse(readFileSync(`fixtures/${name}.json`, "utf8"));',
        '}',
      ].join('\n'));

      const content = fs.readFileSync(path.join(testDir, 'loadFixtures.js'), 'utf8');

      const importsSystem = /import.*(?:Service|Engine|Calculator|Controller)/.test(content);
      const writesFiles = /writeFileSync|writeFile|fs\.write/.test(content);

      assert.ok(!importsSystem, 'Should not flag read-only helper as importing SUT');
      assert.ok(!writesFiles, 'Should not flag read-only helper as writing files');
    });
  });

  describe('assertion strength classification', () => {
    test('classifies existence-only assertions as INSUFFICIENT for value requirements', () => {
      const assertions = [
        'expect(result).toBeDefined()',
        'expect(result).not.toBeNull()',
        'assert.ok(result)',
      ];

      const existencePattern = /toBeDefined|not\.toBeNull|assert\.ok\(/;
      const valuePattern = /toEqual|toBeCloseTo|strictEqual|deepStrictEqual/;

      for (const assertion of assertions) {
        assert.ok(existencePattern.test(assertion), `"${assertion}" should match existence pattern`);
        assert.ok(!valuePattern.test(assertion), `"${assertion}" should NOT match value pattern`);
      }
    });

    test('classifies value assertions as sufficient', () => {
      const assertions = [
        'expect(result).toBeCloseTo(155.96, 2)',
        'expect(result).toEqual({ amount: 100 })',
        'assert.strictEqual(result, 42)',
      ];

      const valuePattern = /toEqual|toBeCloseTo|strictEqual|deepStrictEqual/;

      for (const assertion of assertions) {
        assert.ok(valuePattern.test(assertion), `"${assertion}" should match value pattern`);
      }
    });
  });

  describe('provenance classification', () => {
    test('fixture with legacy system comment classified as VALID', () => {
      const fixture = {
        legacyId: 10341,
        comment: 'Real PHP fixture - output from legacy system',
        dbDependent: true,
        expectedOutput: { value: 155.96 },
      };

      const hasLegacySource = /legacy|php|real|manual|captured from/i.test(fixture.comment || '');
      assert.ok(hasLegacySource, 'Comment referencing legacy system = VALID provenance');
    });

    test('fixture with synthetic/baseline comment classified as SUSPECT', () => {
      const fixture = {
        legacyId: null,
        comment: 'Synthetic offline fixture - computed from known algorithm',
        dbDependent: false,
        expectedOutput: { value: 1240.68 },
      };

      const hasSyntheticSource = /synthetic|computed|baseline|generated|captured from engine/i.test(fixture.comment || '');
      const hasLegacySource = /legacy|php|real output|manual capture/i.test(fixture.comment || '');

      assert.ok(hasSyntheticSource, 'Comment indicating synthetic source detected');
      assert.ok(!hasLegacySource, 'Should NOT be classified as legacy source');
    });

    test('fixture with no comment classified as UNKNOWN', () => {
      const fixture = {
        expectedOutput: { value: 42 },
      };

      const hasAnyProvenance = (fixture.comment || '').length > 0;
      assert.ok(!hasAnyProvenance, 'No comment = UNKNOWN provenance');
    });
  });
});
