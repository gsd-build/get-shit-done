// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Regression test for #2396: hardcoded host-level test commands bypass
 * container-only project Makefiles.
 *
 * Fix: execute-phase.md, verify-phase.md, and audit-fix.md must check for
 * Makefile with a test target (and other wrappers) before falling through
 * to hardcoded language-sniffed commands.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const EXECUTE_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
const VERIFY_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'verify-phase.md');
const AUDIT_FIX_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'audit-fix.md');

function assertMakefileCheckBeforeNpmTest(filePath, label) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Must check for Makefile with test target
  const hasMakefileCheck = /Makefile.*grep.*test:|grep.*test:.*Makefile/s.test(content) ||
    (content.includes('Makefile') && content.includes('"^test:"'));
  assert.ok(
    hasMakefileCheck,
    `${label}: must check for Makefile with test: target before falling through to hardcoded commands`
  );

  // make test must appear before npm test in the file
  const makeTestIdx = content.indexOf('make test');
  const npmTestIdx = content.indexOf('npm test');
  assert.ok(makeTestIdx !== -1, `${label}: must contain "make test"`);
  assert.ok(npmTestIdx !== -1, `${label}: must still contain "npm test" as fallback`);
  assert.ok(
    makeTestIdx < npmTestIdx,
    `${label}: "make test" must appear before "npm test" (Makefile takes priority)`
  );
}

function assertConfigGetBeforeMakefile(filePath, label) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Must check workflow.test_command config before Makefile sniff.
  // Verify within each bash code block: the workflow.test_command lookup
  // appears before the Makefile grep in the same block.
  assert.ok(
    content.includes('workflow.test_command'),
    `${label}: must check workflow.test_command config before Makefile/language sniff`
  );

  // Extract bash blocks to check ordering within each block.
  // Use the actual Makefile test ([ -f "Makefile" ]) not just the word "Makefile"
  // (which appears in comments before the config-get call).
  const bashBlockRe = /```bash([\s\S]*?)```/g;
  let match;
  let anyBlockCorrectlyOrdered = false;
  while ((match = bashBlockRe.exec(content)) !== null) {
    const block = match[1];
    if (block.includes('workflow.test_command') && block.includes('[ -f "Makefile"')) {
      const configIdx = block.indexOf('workflow.test_command');
      const makefileIdx = block.indexOf('[ -f "Makefile"');
      if (configIdx < makefileIdx) {
        anyBlockCorrectlyOrdered = true;
        break;
      }
    }
  }
  assert.ok(
    anyBlockCorrectlyOrdered,
    `${label}: within a bash block, workflow.test_command config check must appear before Makefile test ([ -f "Makefile" ])`
  );
}

describe('bug-2396: Makefile test target must take priority over hardcoded commands', () => {
  test('execute-phase.md exists', () => {
    assert.ok(fs.existsSync(EXECUTE_PHASE_PATH), 'execute-phase.md should exist');
  });

  test('verify-phase.md exists', () => {
    assert.ok(fs.existsSync(VERIFY_PHASE_PATH), 'verify-phase.md should exist');
  });

  test('audit-fix.md exists', () => {
    assert.ok(fs.existsSync(AUDIT_FIX_PATH), 'audit-fix.md should exist');
  });

  test('execute-phase.md: Makefile check precedes npm test (post-merge gate)', () => {
    assertMakefileCheckBeforeNpmTest(EXECUTE_PHASE_PATH, 'execute-phase.md');
  });

  test('verify-phase.md: Makefile check precedes npm test', () => {
    assertMakefileCheckBeforeNpmTest(VERIFY_PHASE_PATH, 'verify-phase.md');
  });

  test('audit-fix.md: Makefile check precedes npm test', () => {
    assertMakefileCheckBeforeNpmTest(AUDIT_FIX_PATH, 'audit-fix.md');
  });

  test('execute-phase.md: workflow.test_command config checked first (within bash block)', () => {
    assertConfigGetBeforeMakefile(EXECUTE_PHASE_PATH, 'execute-phase.md');
  });

  test('verify-phase.md: workflow.test_command config checked first (within bash block)', () => {
    assertConfigGetBeforeMakefile(VERIFY_PHASE_PATH, 'verify-phase.md');
  });

  test('audit-fix.md: workflow.test_command config checked first (within bash block)', () => {
    assertConfigGetBeforeMakefile(AUDIT_FIX_PATH, 'audit-fix.md');
  });
});
