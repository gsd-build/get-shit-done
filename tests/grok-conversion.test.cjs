/**
 * Grok Build frontmatter / command / agent conversion tests.
 *
 * Phase 1 skeleton only — conversion functions (convertClaudeToGrokFrontmatter,
 * convertClaudeCommandToGrokSkill, convertClaudeAgentToGrokAgent, etc.) will be
 * implemented in Phase 2.
 *
 * Grok uses a frontmatter schema very close to Claude's (name, description,
 * permission_mode, tools) but may have minor differences in allowed keys or
 * output format expectations.
 */

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

// Placeholder requires (will be populated when conversion fns are added to install.js exports)
const conversions = require('../bin/install.js');

describe('Grok conversion (Phase 2+ placeholder)', () => {
  test('skeleton — grok-conversion.test.cjs created for Phase 1', () => {
    assert.ok(true);
    // Future tests will cover:
    // - frontmatter key passthrough + permission_mode mapping
    // - /gsd:* slash command projection to Grok hook JSON or skill surface
    // - agent file naming gsd-*.md with Grok frontmatter
  });
});
