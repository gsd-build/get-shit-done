/**
 * GSD Tools Tests - Gemini frontmatter conversion
 */

// Enable test exports from install.js (skips main CLI logic)
process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { convertClaudeToGeminiAgent } = require('../bin/install.js');

describe('convertClaudeToGeminiAgent', () => {
  test('strips skills block and keeps following top-level keys', () => {
    const input = `---
name: gsd-sample
description: Sample agent.
tools: Read, Bash
skills:
  - gsd-plan-phase-workflow
  - gsd-execute-phase-workflow
tags:
  - keep-me
color: cyan
---

Body
`;

    const output = convertClaudeToGeminiAgent(input);

    assert.ok(!output.includes('\nskills:'), 'skills key should be removed');
    assert.ok(!output.includes('gsd-plan-phase-workflow'), 'skills items should be removed');
    assert.ok(output.includes('\ntags:\n  - keep-me\n'), 'subsequent top-level keys should be preserved');
    assert.ok(output.includes('\ntools:\n  - read_file\n  - run_shell_command\n'), 'tools should be converted to Gemini names');
    assert.ok(!output.includes('\ncolor:'), 'color should be removed');
  });
});

