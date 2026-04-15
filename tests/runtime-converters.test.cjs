/**
 * Runtime Converter Tests — OpenCode + Kilo + Gemini
 *
 * Tests for small runtime-specific conversion functions from install.js.
 * Larger runtime test suites (Copilot, Codex, Antigravity) have their own files.
 *
 * OpenCode/Kilo: flat-runtime frontmatter converters (agent + command modes)
 *   model: inherit is NOT added (runtime uses its configured default model)
 *   but mode: subagent IS added (required by both runtimes' agents).
 * Gemini: convertClaudeToGeminiAgent (frontmatter + tool mapping + body escaping)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

process.env.GSD_TEST_MODE = '1';
const {
  convertClaudeToOpencodeFrontmatter,
  convertClaudeToKiloFrontmatter,
  convertClaudeToGeminiAgent,
  neutralizeAgentReferences,
} = require('../bin/install.js');

// Sample Claude agent frontmatter (matches actual GSD agent format)
const SAMPLE_AGENT = `---
name: gsd-executor
description: Executes GSD plans with atomic commits
tools: Read, Write, Edit, Bash, Grep, Glob
color: yellow
skills:
  - gsd-executor-workflow
# hooks:
#   PostToolUse:
#     - matcher: "Write|Edit"
#       hooks:
#         - type: command
#           command: "npx eslint --fix $FILE 2>/dev/null || true"
---

<role>
You are a GSD plan executor.
</role>`;

// Sample Claude command frontmatter (for comparison — commands work differently)
const SAMPLE_COMMAND = `---
name: gsd-execute-phase
description: Execute all plans in a phase
allowed-tools:
  - Read
  - Write
  - Bash
---

Execute the phase plan.`;

const flatRuntimeSuites = [
  {
    label: 'OpenCode',
    convert: convertClaudeToOpencodeFrontmatter,
    configDir: '.config/opencode',
  },
  {
    label: 'Kilo',
    convert: convertClaudeToKiloFrontmatter,
    configDir: '.config/kilo',
  },
];

for (const { label, convert, configDir } of flatRuntimeSuites) {
  describe(`${label} agent conversion (isAgent: true)`, () => {
    test('keeps name: field for agents', () => {
      const result = convert(SAMPLE_AGENT, { isAgent: true });
      const frontmatter = result.split('---')[1];
      assert.ok(frontmatter.includes('name: gsd-executor'), 'name: should be preserved for agents');
    });

    test('does not add model: inherit', () => {
      const result = convert(SAMPLE_AGENT, { isAgent: true });
      const frontmatter = result.split('---')[1];
      assert.ok(!frontmatter.includes('model: inherit'), 'model: inherit should NOT be added');
    });

    test('adds mode: subagent', () => {
      const result = convert(SAMPLE_AGENT, { isAgent: true });
      const frontmatter = result.split('---')[1];
      assert.ok(frontmatter.includes('mode: subagent'), 'mode: subagent should be added');
    });

    test('strips tools: field', () => {
      const result = convert(SAMPLE_AGENT, { isAgent: true });
      const frontmatter = result.split('---')[1];
      assert.ok(!frontmatter.includes('tools:'), 'tools: should be stripped for agents');
      assert.ok(!frontmatter.includes('read: true'), 'tools object should not be generated');

      if (label === 'Kilo') {
        assert.ok(frontmatter.includes('permission:'), 'Kilo agents should emit permission block');
        assert.ok(frontmatter.includes('read: allow'), 'Read should map to read: allow');
        assert.ok(frontmatter.includes('edit: allow'), 'Write/Edit should map to edit: allow');
        assert.ok(frontmatter.includes('bash: allow'), 'Bash should map to bash: allow');
        assert.ok(frontmatter.includes('grep: allow'), 'Grep should map to grep: allow');
        assert.ok(frontmatter.includes('glob: allow'), 'Glob should map to glob: allow');
        assert.ok(frontmatter.includes('task: deny'), 'unspecified permissions should be denied');
      } else {
        assert.ok(!frontmatter.includes('permission:'), 'OpenCode agents should not emit permission block');
      }
    });

    test('strips skills: array', () => {
      const result = convert(SAMPLE_AGENT, { isAgent: true });
      const frontmatter = result.split('---')[1];
      assert.ok(!frontmatter.includes('skills:'), 'skills: should be stripped');
      assert.ok(!frontmatter.includes('gsd-executor-workflow'), 'skill entries should be stripped');
    });

    test('strips color: field', () => {
      const result = convert(SAMPLE_AGENT, { isAgent: true });
      const frontmatter = result.split('---')[1];
      assert.ok(!frontmatter.includes('color:'), 'color: should be stripped for agents');
    });

    test('strips commented hooks block', () => {
      const result = convert(SAMPLE_AGENT, { isAgent: true });
      const frontmatter = result.split('---')[1];
      assert.ok(!frontmatter.includes('# hooks:'), 'commented hooks should be stripped');
      assert.ok(!frontmatter.includes('PostToolUse'), 'hook content should be stripped');
    });

    test('keeps description: field', () => {
      const result = convert(SAMPLE_AGENT, { isAgent: true });
      const frontmatter = result.split('---')[1];
      assert.ok(frontmatter.includes('description: Executes GSD plans'), 'description should be kept');
    });

    test('preserves body content', () => {
      const result = convert(SAMPLE_AGENT, { isAgent: true });
      assert.ok(result.includes('<role>'), 'body should be preserved');
      assert.ok(result.includes('You are a GSD plan executor.'), 'body content should be intact');
    });

    test('applies body text replacements', () => {
      const agentWithClaudePaths = `---
name: test-agent
description: Test
tools: Read
---

Read ~/.claude/agent-memory/ for context.
Use $HOME/.claude/skills/ for reference.
Check .claude/skills/ and .claude/agents/ locally.
Use ./.claude/hooks/gsd-statusline.js during local testing.
Fallback skills live in .agents/skills/.`;

      const result = convert(agentWithClaudePaths, { isAgent: true });
      assert.ok(result.includes(`~/${configDir}/agent-memory/`), '~/.claude should be replaced');
      assert.ok(result.includes(`$HOME/${configDir}/skills/`), '$HOME/.claude should be replaced');

      if (label === 'Kilo') {
        assert.ok(result.includes('.kilo/skills/'), '.claude/skills should be replaced for Kilo');
        assert.ok(result.includes('.kilo/agents/'), '.claude/agents should be replaced for Kilo');
        assert.ok(result.includes('./.kilo/hooks/'), './.claude should be replaced for Kilo');
        assert.ok(result.includes('Fallback skills live in .kilo/skills/.'), '.agents/skills should be rewritten to Kilo skills dir');
        assert.ok(!result.includes('.kilo/skill/'), 'singular Kilo skill dir should not be emitted');
      }
    });
  });

  describe(`${label} command conversion (isAgent: false, default)`, () => {
    test('strips name: field for commands', () => {
      const result = convert(SAMPLE_COMMAND);
      const frontmatter = result.split('---')[1];
      assert.ok(!frontmatter.includes('name:'), 'name: should be stripped for commands');
    });

    test('does not add model: or mode: for commands', () => {
      const result = convert(SAMPLE_COMMAND);
      const frontmatter = result.split('---')[1];
      assert.ok(!frontmatter.includes('model:'), 'model: should not be added for commands');
      assert.ok(!frontmatter.includes('mode:'), 'mode: should not be added for commands');
    });

    test('keeps description: for commands', () => {
      const result = convert(SAMPLE_COMMAND);
      const frontmatter = result.split('---')[1];
      assert.ok(frontmatter.includes('description:'), 'description should be kept');
    });
  });

  // ─── #2256: model_overrides support for OpenCode/Kilo agents ────────────────
  // Only test OpenCode — Kilo uses the same converter but model override injection
  // is wired only for OpenCode at the call site in install().
  if (label === 'OpenCode') {
    describe('OpenCode agent model override (modelOverride option) (#2256)', () => {
      test('adds model: field when modelOverride is provided', () => {
        const result = convert(SAMPLE_AGENT, { isAgent: true, modelOverride: 'gpt-5.3-codex' });
        const frontmatter = result.split('---')[1];
        assert.ok(frontmatter.includes('model: gpt-5.3-codex'), 'model: field must be added with override value');
      });

      test('does not add model: field when modelOverride is null', () => {
        const result = convert(SAMPLE_AGENT, { isAgent: true, modelOverride: null });
        const frontmatter = result.split('---')[1];
        assert.ok(!frontmatter.includes('model:'), 'model: field must be absent when no override');
      });

      test('does not add model: field when modelOverride is omitted', () => {
        const result = convert(SAMPLE_AGENT, { isAgent: true });
        const frontmatter = result.split('---')[1];
        assert.ok(!frontmatter.includes('model:'), 'model: field must be absent when option omitted');
      });

      test('model: field appears after mode: subagent', () => {
        const result = convert(SAMPLE_AGENT, { isAgent: true, modelOverride: 'o4-mini' });
        const frontmatter = result.split('---')[1];
        const modeIdx = frontmatter.indexOf('mode: subagent');
        const modelIdx = frontmatter.indexOf('model: o4-mini');
        assert.ok(modeIdx !== -1, 'mode: subagent must be present');
        assert.ok(modelIdx !== -1, 'model: field must be present');
        assert.ok(modelIdx > modeIdx, 'model: must appear after mode: subagent');
      });

      test('model override does not affect command conversion', () => {
        // modelOverride has no effect when isAgent is false (commands)
        const result = convert(SAMPLE_COMMAND, { modelOverride: 'gpt-5.4' });
        const frontmatter = result.split('---')[1];
        assert.ok(!frontmatter.includes('model:'), 'model: must not appear in command output');
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini CLI agent conversion (merged from gemini-config.test.cjs)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─── neutralizeAgentReferences (#766) ─────────────────────────────────────────

describe('neutralizeAgentReferences', () => {
  test('replaces standalone Claude with "the agent"', () => {
    const input = 'Claude handles these decisions. Claude should read the file.';
    const result = neutralizeAgentReferences(input, 'AGENTS.md');
    assert.ok(!result.includes('Claude handles'), 'standalone Claude replaced');
    assert.ok(result.includes('the agent handles'), 'replaced with "the agent"');
  });

  test('preserves Claude Code (product name)', () => {
    const input = 'This is a Claude Code bug. Use Claude Code settings.';
    const result = neutralizeAgentReferences(input, 'AGENTS.md');
    assert.ok(result.includes('Claude Code bug'), 'Claude Code preserved');
    assert.ok(result.includes('Claude Code settings'), 'Claude Code preserved');
  });

  test('preserves Claude model names', () => {
    const input = 'Use Claude Opus for planning. Claude Sonnet for execution. Claude Haiku for research.';
    const result = neutralizeAgentReferences(input, 'AGENTS.md');
    assert.ok(result.includes('Claude Opus'), 'Opus preserved');
    assert.ok(result.includes('Claude Sonnet'), 'Sonnet preserved');
    assert.ok(result.includes('Claude Haiku'), 'Haiku preserved');
  });

  test('replaces CLAUDE.md with runtime instruction file', () => {
    const input = 'Read CLAUDE.md for project instructions. Check ./CLAUDE.md if exists.';
    const result = neutralizeAgentReferences(input, 'AGENTS.md');
    assert.ok(result.includes('AGENTS.md'), 'CLAUDE.md -> AGENTS.md');
    assert.ok(!result.includes('CLAUDE.md'), 'no CLAUDE.md remains');
  });

  test('uses different instruction file per runtime', () => {
    const input = 'Read CLAUDE.md for instructions.';
    assert.ok(neutralizeAgentReferences(input, 'GEMINI.md').includes('GEMINI.md'));
    assert.ok(neutralizeAgentReferences(input, 'copilot-instructions.md').includes('copilot-instructions.md'));
    assert.ok(neutralizeAgentReferences(input, 'AGENTS.md').includes('AGENTS.md'));
  });

  test('removes AGENTS.md load-blocking instruction', () => {
    const input = 'Do NOT load full `AGENTS.md` files — they contain agent definitions.';
    const result = neutralizeAgentReferences(input, 'AGENTS.md');
    assert.ok(!result.includes('Do NOT load full'), 'blocking instruction removed');
  });

  test('preserves claude- prefixes (CSS classes, package names)', () => {
    const input = 'The claude-ctx session and claude-code package.';
    const result = neutralizeAgentReferences(input, 'AGENTS.md');
    assert.ok(result.includes('claude-ctx'), 'claude- prefix preserved');
    assert.ok(result.includes('claude-code'), 'claude-code preserved');
  });
});
