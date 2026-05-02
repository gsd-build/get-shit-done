// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('MCP tool usage in GSD agents', () => {
  const agentFiles = [
    path.join(__dirname, '..', 'agents', 'gsd-executor.md'),
    path.join(__dirname, '..', 'agents', 'gsd-planner.md'),
  ];

  for (const agentFile of agentFiles) {
    const name = path.basename(agentFile);

    test(`${name} mentions MCP tool usage`, () => {
      const content = fs.readFileSync(agentFile, 'utf-8');
      const hasMcpGuidance =
        content.toLowerCase().includes('mcp') ||
        content.includes('context7') ||
        content.includes('available tools') ||
        content.includes('MCP tool');
      assert.ok(hasMcpGuidance, `${name} should mention MCP tool availability/usage`);
    });
  }

  test('gsd-executor.md explicitly instructs to use available MCP tools', () => {
    const content = fs.readFileSync(agentFiles[0], 'utf-8');
    assert.ok(
      content.includes('MCP') || content.includes('mcp__'),
      'executor should reference MCP tools'
    );
  });
});
