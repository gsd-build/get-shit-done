/**
 * Augment conversion regression tests.
 *
 * Ensures Augment frontmatter names are emitted as plain identifiers
 * (without surrounding quotes), so Augment does not treat quotes as
 * literal parts of skill/subagent names.
 */

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  convertClaudeCommandToAugmentSkill,
  convertClaudeAgentToAugmentAgent,
  convertClaudeToAugmentMarkdown,
} = require('../bin/install.js');

describe('convertClaudeCommandToAugmentSkill', () => {
  test('writes unquoted Augment skill name in frontmatter', () => {
    const input = `---
name: quick
description: Execute a quick task
---

<objective>
Test body
</objective>
`;

    const result = convertClaudeCommandToAugmentSkill(input, 'gsd-quick');
    const nameMatch = result.match(/^name:\s*(.+)$/m);

    assert.ok(nameMatch, 'frontmatter contains name field');
    assert.strictEqual(nameMatch[1], 'gsd-quick', 'skill name is plain scalar');
    assert.ok(!result.includes('name: "gsd-quick"'), 'quoted skill name is not emitted');
  });

  test('preserves slash for slash commands in markdown body', () => {
    const input = `---
name: gsd:plan-phase
description: Plan a phase
---

Next:
/gsd:execute-phase 17
/gsd-help
gsd:progress
`;

    const result = convertClaudeCommandToAugmentSkill(input, 'gsd-plan-phase');
    // Slash commands: /gsd:execute-phase -> /gsd-execute-phase
    assert.ok(result.includes('/gsd-execute-phase 17'), 'slash command gsd: -> gsd-');
    assert.ok(result.includes('/gsd-help'), '/gsd-help preserved');
    assert.ok(result.includes('gsd-progress'), 'bare gsd: -> gsd-');
  });

  test('includes augment_skill_adapter block', () => {
    const input = `---
name: test
description: A test skill
---

Body content.
`;

    const result = convertClaudeCommandToAugmentSkill(input, 'gsd-test');
    assert.ok(result.includes('<augment_skill_adapter>'), 'adapter header present');
    assert.ok(result.includes('</augment_skill_adapter>'), 'adapter footer present');
    assert.ok(result.includes('launch-process'), 'launch-process tool mentioned');
    assert.ok(result.includes('str-replace-editor'), 'str-replace-editor tool mentioned');
  });

  test('converts tool names to Augment format', () => {
    const input = `---
name: test
description: Test
---

Use Bash() to run commands.
Use Edit() to modify files.
Use Read() to view files.
`;

    const result = convertClaudeCommandToAugmentSkill(input, 'gsd-test');
    assert.ok(result.includes('launch-process('), 'Bash converted to launch-process');
    assert.ok(result.includes('str-replace-editor('), 'Edit converted to str-replace-editor');
    assert.ok(result.includes('view('), 'Read converted to view');
  });
});

describe('convertClaudeAgentToAugmentAgent', () => {
  test('converts agent frontmatter with unquoted name', () => {
    const input = `---
name: gsd-bugfix
description: "Fix bugs automatically"
tools: Read, Write, Edit, Bash
color: green
---

<role>
You are a bug fixer.
</role>
`;

    const result = convertClaudeAgentToAugmentAgent(input);
    const nameMatch = result.match(/^name:\s*(.+)$/m);

    assert.ok(nameMatch, 'frontmatter contains name field');
    assert.strictEqual(nameMatch[1], 'gsd-bugfix', 'agent name is plain scalar');
    assert.ok(!result.includes('name: "gsd-bugfix"'), 'quoted agent name is not emitted');
  });

  test('removes color and skills from frontmatter', () => {
    const input = `---
name: gsd-test
description: Test agent
color: blue
skills:
  - some-skill
tools: Read, Write
---

<role>
Test role
</role>
`;

    const result = convertClaudeAgentToAugmentAgent(input);

    assert.ok(result.includes('name: gsd-test'), 'name preserved');
    assert.ok(result.includes('description:'), 'description preserved');
    assert.ok(!result.includes('color:'), 'color removed');
    assert.ok(!result.includes('skills:'), 'skills removed');
  });

  test('replaces CLAUDE.md with .augment/rules/', () => {
    const input = `---
name: gsd-test
description: Test
---

See CLAUDE.md for details.
`;

    const result = convertClaudeAgentToAugmentAgent(input);
    assert.ok(result.includes('.augment/rules/'), 'CLAUDE.md replaced with .augment/rules/');
    assert.ok(!result.includes('CLAUDE.md'), 'CLAUDE.md reference removed');
  });
});

describe('convertClaudeToAugmentMarkdown', () => {
  test('replaces Claude Code with Augment', () => {
    const input = 'Use Claude Code tools for this task.';
    const result = convertClaudeToAugmentMarkdown(input);
    assert.strictEqual(result, 'Use Augment tools for this task.');
  });

  test('replaces .claude/skills/ with .augment/skills/', () => {
    const input = 'Check .claude/skills/ for more info.';
    const result = convertClaudeToAugmentMarkdown(input);
    assert.strictEqual(result, 'Check .augment/skills/ for more info.');
  });

  test('normalizes gsd: to gsd-', () => {
    const input = 'Run /gsd:new-project for new projects.';
    const result = convertClaudeToAugmentMarkdown(input);
    assert.strictEqual(result, 'Run /gsd-new-project for new projects.');
  });
});