'use strict';

/**
 * Claude global-skill SKILL.md body must use hyphen-form `/gsd-<cmd>` (#3583).
 *
 * History:
 *   #3443 re-established `/gsd:<cmd>` as canonical in source. Non-Claude
 *   runtimes convert at install time. Claude global skill installs surface
 *   commands under hyphen-form `name:` (see #2808), so body references must
 *   agree with the slash-picker invocation form the end user sees.
 *
 * Asymmetry the fix closes:
 *   The Copilot adapter rewrites `/gsd:` → `/gsd-` in body via
 *   `convertClaudeToCopilotContent` at bin/install.js:1598. The Claude
 *   skill adapter previously emitted body unchanged, leaving routing
 *   hints like "Next step: /gsd:discuss-phase" that Claude Code rejects
 *   as "Unknown command" on global skill installs.
 */

// MUST be set before requiring bin/install.js so the installer's top-level
// code short-circuits instead of running a full install during test load.
process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  convertClaudeCommandToClaudeSkill,
} = require('../bin/install.js');

describe('convertClaudeCommandToClaudeSkill body rewrite (#3583)', () => {
  test('rewrites /gsd:<cmd> to /gsd-<cmd> in body so it matches frontmatter name', () => {
    const input = [
      '---',
      'name: should-be-overwritten',
      'description: Test command',
      '---',
      '',
      'Next step',
      '',
      '/gsd:discuss-phase 1     # discuss Phase 1',
    ].join('\n');
    const out = convertClaudeCommandToClaudeSkill(input, 'gsd-discuss-phase', null);
    assert.ok(out.includes('name: gsd-discuss-phase'),
      `frontmatter name must be hyphen form, got:\n${out}`);
    assert.ok(out.includes('/gsd-discuss-phase'),
      `body must use hyphen form, got:\n${out}`);
    assert.ok(!out.includes('/gsd:discuss-phase'),
      `colon form must not survive in body, got:\n${out}`);
  });

  test('rewrites multiple body occurrences in one conversion', () => {
    const input = [
      '---',
      'name: x',
      'description: Test',
      '---',
      '',
      'First /gsd:discuss-phase 1 then /gsd:plan-phase 1 then /gsd:execute-phase 1.',
    ].join('\n');
    const out = convertClaudeCommandToClaudeSkill(input, 'gsd-x', null);
    assert.ok(out.includes('/gsd-discuss-phase'));
    assert.ok(out.includes('/gsd-plan-phase'));
    assert.ok(out.includes('/gsd-execute-phase'));
    assert.ok(!out.match(/\/gsd:[a-z]/), `no colon form may remain in body, got:\n${out}`);
  });

  test('leaves non-command identifiers in body alone (gsd-sdk, gsd-tools)', () => {
    const input = [
      '---',
      'name: x',
      'description: Test',
      '---',
      '',
      'Use /gsd-sdk query and node bin/gsd-tools.cjs.',
    ].join('\n');
    const out = convertClaudeCommandToClaudeSkill(input, 'gsd-x', null);
    assert.ok(out.includes('/gsd-sdk'), 'gsd-sdk must remain untouched');
    assert.ok(out.includes('bin/gsd-tools.cjs'), 'gsd-tools must remain untouched');
  });

  test('idempotent on body that already uses hyphen form', () => {
    const input = [
      '---',
      'name: x',
      'description: Test',
      '---',
      '',
      'Already-converted: /gsd-plan-phase 1.',
    ].join('\n');
    const out = convertClaudeCommandToClaudeSkill(input, 'gsd-x', null);
    assert.ok(out.includes('/gsd-plan-phase'),
      'hyphen form must survive a re-conversion');
    assert.ok(!out.match(/\/gsd:[a-z]/),
      'no colon form must be introduced');
  });

  test('passthrough when input has no frontmatter (no rewrite path)', () => {
    const input = 'Plain text with /gsd:plan-phase reference.';
    const out = convertClaudeCommandToClaudeSkill(input, 'gsd-x', null);
    // Documented behavior at install.js: bail early if no frontmatter.
    // This guards against accidentally rewriting bodies that lack the YAML
    // header — those are not skill files and should pass through verbatim.
    assert.strictEqual(out, input);
  });
});
