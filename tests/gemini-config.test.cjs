/**
 * GSD Tools Tests - Gemini agent conversion
 *
 * Verifies Gemini-specific agent frontmatter conversion removes
 * unsupported fields while preserving converted tools and body text.
 */

process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { convertClaudeToGeminiAgent } = require('../bin/install.js');

describe('convertClaudeToGeminiAgent', () => {
  test('drops unsupported skills frontmatter while keeping converted tools', () => {
    const input = `---
name: gsd-codebase-mapper
description: Explores codebase and writes structured analysis documents.
tools: Read, Bash, Grep, Glob, Write
color: cyan
skills:
  - gsd-mapper-workflow
---

<role>
Use \${PHASE} in shell examples.
</role>`;

    const result = convertClaudeToGeminiAgent(input);
    const frontmatter = result.split('---')[1] || '';

    assert.ok(frontmatter.includes('name: gsd-codebase-mapper'), 'keeps name');
    assert.ok(frontmatter.includes('description: Explores codebase and writes structured analysis documents.'), 'keeps description');
    assert.ok(frontmatter.includes('tools:'), 'adds Gemini tools array');
    assert.ok(frontmatter.includes('  - read_file'), 'maps Read -> read_file');
    assert.ok(frontmatter.includes('  - run_shell_command'), 'maps Bash -> run_shell_command');
    assert.ok(frontmatter.includes('  - search_file_content'), 'maps Grep -> search_file_content');
    assert.ok(frontmatter.includes('  - glob'), 'maps Glob -> glob');
    assert.ok(frontmatter.includes('  - write_file'), 'maps Write -> write_file');
    assert.ok(!frontmatter.includes('color:'), 'drops unsupported color field');
    assert.ok(!frontmatter.includes('skills:'), 'drops unsupported skills field');
    assert.ok(!frontmatter.includes('gsd-mapper-workflow'), 'drops skills list items');
    assert.ok(result.includes('$PHASE'), 'escapes ${PHASE} shell variable for Gemini');
    assert.ok(!result.includes('${PHASE}'), 'removes Gemini template-string pattern');
  });
});
