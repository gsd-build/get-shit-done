/**
 * GSD Tools Tests - Copilot Install Plumbing
 *
 * Tests for Copilot runtime directory resolution, config paths,
 * and integration with the multi-runtime installer.
 *
 * Requirements: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06
 */

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');

const {
  getDirName,
  getGlobalDir,
  getConfigDirFromHome,
  claudeToCopilotTools,
  convertCopilotToolName,
  convertClaudeToCopilotContent,
  convertClaudeCommandToCopilotSkill,
  convertClaudeAgentToCopilotAgent,
  copyCommandsAsCopilotSkills,
  GSD_COPILOT_INSTRUCTIONS_MARKER,
  GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER,
  mergeCopilotInstructions,
  stripGsdFromCopilotInstructions,
  writeManifest,
  reportLocalPatches,
} = require('../bin/install.js');

// ─── getDirName ─────────────────────────────────────────────────────────────────

describe('getDirName (Copilot)', () => {
  test('returns .github for copilot', () => {
    assert.strictEqual(getDirName('copilot'), '.github');
  });

  test('does not break existing runtimes', () => {
    assert.strictEqual(getDirName('claude'), '.claude');
    assert.strictEqual(getDirName('opencode'), '.opencode');
    assert.strictEqual(getDirName('gemini'), '.gemini');
    assert.strictEqual(getDirName('codex'), '.codex');
  });
});

// ─── getGlobalDir ───────────────────────────────────────────────────────────────

describe('getGlobalDir (Copilot)', () => {
  test('returns ~/.copilot with no env var or explicit dir', () => {
    const original = process.env.COPILOT_CONFIG_DIR;
    try {
      delete process.env.COPILOT_CONFIG_DIR;
      const result = getGlobalDir('copilot');
      assert.strictEqual(result, path.join(os.homedir(), '.copilot'));
    } finally {
      if (original !== undefined) {
        process.env.COPILOT_CONFIG_DIR = original;
      } else {
        delete process.env.COPILOT_CONFIG_DIR;
      }
    }
  });

  test('returns explicit dir when provided', () => {
    const result = getGlobalDir('copilot', '/custom/path');
    assert.strictEqual(result, '/custom/path');
  });

  test('respects COPILOT_CONFIG_DIR env var', () => {
    const original = process.env.COPILOT_CONFIG_DIR;
    try {
      process.env.COPILOT_CONFIG_DIR = '~/custom-copilot';
      const result = getGlobalDir('copilot');
      assert.strictEqual(result, path.join(os.homedir(), 'custom-copilot'));
    } finally {
      if (original !== undefined) {
        process.env.COPILOT_CONFIG_DIR = original;
      } else {
        delete process.env.COPILOT_CONFIG_DIR;
      }
    }
  });

  test('explicit dir takes priority over COPILOT_CONFIG_DIR', () => {
    const original = process.env.COPILOT_CONFIG_DIR;
    try {
      process.env.COPILOT_CONFIG_DIR = '~/env-path';
      const result = getGlobalDir('copilot', '/explicit/path');
      assert.strictEqual(result, '/explicit/path');
    } finally {
      if (original !== undefined) {
        process.env.COPILOT_CONFIG_DIR = original;
      } else {
        delete process.env.COPILOT_CONFIG_DIR;
      }
    }
  });

  test('does not break existing runtimes', () => {
    assert.strictEqual(getGlobalDir('claude'), path.join(os.homedir(), '.claude'));
    assert.strictEqual(getGlobalDir('codex'), path.join(os.homedir(), '.codex'));
  });
});

// ─── getConfigDirFromHome ───────────────────────────────────────────────────────

describe('getConfigDirFromHome (Copilot)', () => {
  test('returns .github path string for local (isGlobal=false)', () => {
    assert.strictEqual(getConfigDirFromHome('copilot', false), "'.github'");
  });

  test('returns .copilot path string for global (isGlobal=true)', () => {
    assert.strictEqual(getConfigDirFromHome('copilot', true), "'.copilot'");
  });

  test('does not break existing runtimes', () => {
    assert.strictEqual(getConfigDirFromHome('opencode', true), "'.config', 'opencode'");
    assert.strictEqual(getConfigDirFromHome('claude', true), "'.claude'");
    assert.strictEqual(getConfigDirFromHome('gemini', true), "'.gemini'");
    assert.strictEqual(getConfigDirFromHome('codex', true), "'.codex'");
  });
});

// ─── Source code integration checks ─────────────────────────────────────────────

describe('Source code integration (Copilot)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'install.js'), 'utf8');

  test('CLI-01: --copilot flag parsing exists', () => {
    assert.ok(src.includes("args.includes('--copilot')"), '--copilot flag parsed');
  });

  test('CLI-03: --all array includes copilot', () => {
    assert.ok(
      src.includes("'claude', 'opencode', 'gemini', 'codex', 'copilot'"),
      '--all includes copilot as 5th runtime'
    );
  });

  test('CLI-06: banner text includes Copilot', () => {
    assert.ok(src.includes('Copilot by'), 'banner mentions Copilot');
  });

  test('CLI-06: help text includes --copilot', () => {
    assert.ok(src.includes('--copilot'), 'help text has --copilot option');
  });

  test('CLI-02: promptRuntime has Copilot as option 5', () => {
    assert.ok(src.includes("choice === '5'"), 'choice 5 exists');
    // Verify choice 5 maps to copilot (the line after choice === '5' should reference copilot)
    const choice5Index = src.indexOf("choice === '5'");
    const nextLines = src.substring(choice5Index, choice5Index + 100);
    assert.ok(nextLines.includes('copilot'), 'choice 5 maps to copilot');
  });

  test('CLI-02: promptRuntime has All as option 6', () => {
    assert.ok(src.includes("choice === '6'"), 'choice 6 exists');
    const choice6Index = src.indexOf("choice === '6'");
    const nextLines = src.substring(choice6Index, choice6Index + 150);
    assert.ok(nextLines.includes('copilot'), 'choice 6 (All) includes copilot');
  });

  test('isCopilot variable exists in install function', () => {
    assert.ok(src.includes("const isCopilot = runtime === 'copilot'"), 'isCopilot defined');
  });

  test('hooks are skipped for Copilot', () => {
    assert.ok(src.includes('!isCodex && !isCopilot'), 'hooks skip check includes copilot');
  });

  test('--both flag unchanged (still claude + opencode only)', () => {
    // Verify the else-if-hasBoth maps to ['claude', 'opencode'] — NOT including copilot
    const bothUsage = src.indexOf('} else if (hasBoth)');
    assert.ok(bothUsage > 0, 'hasBoth usage exists');
    const bothSection = src.substring(bothUsage, bothUsage + 200);
    assert.ok(bothSection.includes("['claude', 'opencode']"), '--both maps to claude+opencode');
    assert.ok(!bothSection.includes('copilot'), '--both does NOT include copilot');
  });
});

// ─── convertCopilotToolName ─────────────────────────────────────────────────────

describe('convertCopilotToolName', () => {
  test('maps Read to read', () => {
    assert.strictEqual(convertCopilotToolName('Read'), 'read');
  });

  test('maps Write to edit', () => {
    assert.strictEqual(convertCopilotToolName('Write'), 'edit');
  });

  test('maps Edit to edit (same as Write)', () => {
    assert.strictEqual(convertCopilotToolName('Edit'), 'edit');
  });

  test('maps Bash to execute', () => {
    assert.strictEqual(convertCopilotToolName('Bash'), 'execute');
  });

  test('maps Grep to search', () => {
    assert.strictEqual(convertCopilotToolName('Grep'), 'search');
  });

  test('maps Glob to search (same as Grep)', () => {
    assert.strictEqual(convertCopilotToolName('Glob'), 'search');
  });

  test('maps Task to agent', () => {
    assert.strictEqual(convertCopilotToolName('Task'), 'agent');
  });

  test('maps WebSearch to web', () => {
    assert.strictEqual(convertCopilotToolName('WebSearch'), 'web');
  });

  test('maps WebFetch to web (same as WebSearch)', () => {
    assert.strictEqual(convertCopilotToolName('WebFetch'), 'web');
  });

  test('maps TodoWrite to todo', () => {
    assert.strictEqual(convertCopilotToolName('TodoWrite'), 'todo');
  });

  test('maps AskUserQuestion to ask_user', () => {
    assert.strictEqual(convertCopilotToolName('AskUserQuestion'), 'ask_user');
  });

  test('maps SlashCommand to skill', () => {
    assert.strictEqual(convertCopilotToolName('SlashCommand'), 'skill');
  });

  test('maps mcp__context7__ prefix to io.github.upstash/context7/', () => {
    assert.strictEqual(
      convertCopilotToolName('mcp__context7__resolve-library-id'),
      'io.github.upstash/context7/resolve-library-id'
    );
  });

  test('maps mcp__context7__* wildcard', () => {
    assert.strictEqual(
      convertCopilotToolName('mcp__context7__*'),
      'io.github.upstash/context7/*'
    );
  });

  test('lowercases unknown tools as fallback', () => {
    assert.strictEqual(convertCopilotToolName('SomeNewTool'), 'somenewtool');
  });

  test('mapping constant has 13 entries (12 direct + mcp handled separately)', () => {
    assert.strictEqual(Object.keys(claudeToCopilotTools).length, 12);
  });
});

// ─── convertClaudeToCopilotContent ──────────────────────────────────────────────

describe('convertClaudeToCopilotContent', () => {
  test('replaces ~/.claude/ with ~/.copilot/', () => {
    assert.strictEqual(
      convertClaudeToCopilotContent('see ~/.claude/foo'),
      'see ~/.copilot/foo'
    );
  });

  test('replaces ./.claude/ with ./.github/', () => {
    assert.strictEqual(
      convertClaudeToCopilotContent('at ./.claude/bar'),
      'at ./.github/bar'
    );
  });

  test('replaces bare .claude/ with .github/', () => {
    assert.strictEqual(
      convertClaudeToCopilotContent('in .claude/baz'),
      'in .github/baz'
    );
  });

  test('replaces $HOME/.claude/ with $HOME/.copilot/', () => {
    assert.strictEqual(
      convertClaudeToCopilotContent('"$HOME/.claude/config"'),
      '"$HOME/.copilot/config"'
    );
  });

  test('converts gsd: to gsd- in command names', () => {
    assert.strictEqual(
      convertClaudeToCopilotContent('run /gsd:health or gsd:progress'),
      'run /gsd-health or gsd-progress'
    );
  });

  test('handles mixed content with all patterns', () => {
    const input = 'Config at ~/.claude/settings and $HOME/.claude/config.\n' +
      'Local at ./.claude/data and .claude/commands.\n' +
      'Run gsd:health and /gsd:progress.';
    const result = convertClaudeToCopilotContent(input);
    assert.ok(result.includes('~/.copilot/settings'), 'tilde path converted');
    assert.ok(result.includes('$HOME/.copilot/config'), '$HOME path converted');
    assert.ok(result.includes('./.github/data'), 'dot-slash path converted');
    assert.ok(result.includes('.github/commands'), 'bare path converted');
    assert.ok(result.includes('gsd-health'), 'command name converted');
    assert.ok(result.includes('/gsd-progress'), 'slash command converted');
  });

  test('does not double-replace (no .copilot/.github/ artifacts)', () => {
    const input = '~/.claude/foo and ./.claude/bar and .claude/baz';
    const result = convertClaudeToCopilotContent(input);
    assert.ok(!result.includes('.copilot/.github/'), 'no .copilot/.github/ artifact');
    assert.ok(!result.includes('.github/.github/'), 'no .github/.github/ artifact');
    assert.strictEqual(result, '~/.copilot/foo and ./.github/bar and .github/baz');
  });

  test('preserves content with no matches', () => {
    assert.strictEqual(
      convertClaudeToCopilotContent('hello world'),
      'hello world'
    );
  });
});

// ─── convertClaudeCommandToCopilotSkill ─────────────────────────────────────────

describe('convertClaudeCommandToCopilotSkill', () => {
  test('converts frontmatter with all fields', () => {
    const input = `---
name: gsd:health
description: Diagnose planning directory health
argument-hint: [--repair]
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

Body content here referencing ~/.claude/foo and gsd:health.`;

    const result = convertClaudeCommandToCopilotSkill(input, 'gsd-health');
    assert.ok(result.startsWith('---\nname: gsd-health\n'), 'name uses param');
    assert.ok(result.includes('description: Diagnose planning directory health'), 'description preserved');
    assert.ok(result.includes("argument-hint: '[--repair]'"), 'argument-hint single-quoted');
    assert.ok(result.includes('allowed-tools: Read, Bash, Write, AskUserQuestion'), 'tools comma-separated');
    assert.ok(result.includes('~/.copilot/foo'), 'CONV-06 applied to body');
    assert.ok(result.includes('gsd-health'), 'CONV-07 applied to body');
    assert.ok(!result.includes('gsd:health'), 'no gsd: references remain');
  });

  test('handles skill without allowed-tools', () => {
    const input = `---
name: gsd:help
description: Show available GSD commands
---

Help content.`;

    const result = convertClaudeCommandToCopilotSkill(input, 'gsd-help');
    assert.ok(result.includes('name: gsd-help'), 'name set');
    assert.ok(result.includes('description: Show available GSD commands'), 'description preserved');
    assert.ok(!result.includes('allowed-tools:'), 'no allowed-tools line');
  });

  test('handles skill without argument-hint', () => {
    const input = `---
name: gsd:progress
description: Show project progress
allowed-tools:
  - Read
  - Bash
---

Progress body.`;

    const result = convertClaudeCommandToCopilotSkill(input, 'gsd-progress');
    assert.ok(!result.includes('argument-hint:'), 'no argument-hint line');
    assert.ok(result.includes('allowed-tools: Read, Bash'), 'tools present');
  });

  test('applies CONV-06 path conversion to body', () => {
    const input = `---
name: gsd:test
description: Test skill
---

Check ~/.claude/settings and ./.claude/local and $HOME/.claude/global.`;

    const result = convertClaudeCommandToCopilotSkill(input, 'gsd-test');
    assert.ok(result.includes('~/.copilot/settings'), 'tilde path converted');
    assert.ok(result.includes('./.github/local'), 'dot-slash path converted');
    assert.ok(result.includes('$HOME/.copilot/global'), '$HOME path converted');
  });

  test('applies CONV-07 command name conversion to body', () => {
    const input = `---
name: gsd:test
description: Test skill
---

Run gsd:health and /gsd:progress for diagnostics.`;

    const result = convertClaudeCommandToCopilotSkill(input, 'gsd-test');
    assert.ok(result.includes('gsd-health'), 'gsd:health converted');
    assert.ok(result.includes('/gsd-progress'), '/gsd:progress converted');
    assert.ok(!result.match(/gsd:[a-z]/), 'no gsd: command refs remain');
  });

  test('handles content without frontmatter', () => {
    const input = 'Just some markdown with ~/.claude/path and gsd:health.';
    const result = convertClaudeCommandToCopilotSkill(input, 'gsd-test');
    assert.ok(result.includes('~/.copilot/path'), 'CONV-06 applied');
    assert.ok(result.includes('gsd-health'), 'CONV-07 applied');
    assert.ok(!result.includes('---'), 'no frontmatter added');
  });

  test('preserves agent field in frontmatter', () => {
    const input = `---
name: gsd:execute-phase
description: Execute a phase
agent: gsd-planner
allowed-tools:
  - Read
  - Bash
---

Body.`;

    const result = convertClaudeCommandToCopilotSkill(input, 'gsd-execute-phase');
    assert.ok(result.includes('agent: gsd-planner'), 'agent field preserved');
  });
});

// ─── convertClaudeAgentToCopilotAgent ───────────────────────────────────────────

describe('convertClaudeAgentToCopilotAgent', () => {
  test('maps and deduplicates tools', () => {
    const input = `---
name: gsd-executor
description: Executes GSD plans
tools: Read, Write, Edit, Bash, Grep, Glob
color: yellow
---

Agent body.`;

    const result = convertClaudeAgentToCopilotAgent(input);
    assert.ok(result.includes("tools: ['read', 'edit', 'execute', 'search']"), 'tools mapped and deduped');
  });

  test('formats tools as JSON array', () => {
    const input = `---
name: gsd-test
description: Test agent
tools: Read, Bash
---

Body.`;

    const result = convertClaudeAgentToCopilotAgent(input);
    assert.ok(result.match(/tools: \['[a-z_]+'(, '[a-z_]+')*\]/), 'tools formatted as JSON array');
  });

  test('preserves name description and color', () => {
    const input = `---
name: gsd-executor
description: Executes GSD plans with atomic commits
tools: Read, Bash
color: yellow
---

Body.`;

    const result = convertClaudeAgentToCopilotAgent(input);
    assert.ok(result.includes('name: gsd-executor'), 'name preserved');
    assert.ok(result.includes('description: Executes GSD plans with atomic commits'), 'description preserved');
    assert.ok(result.includes('color: yellow'), 'color preserved');
  });

  test('handles mcp__context7__ tools', () => {
    const input = `---
name: gsd-researcher
description: Research agent
tools: Read, Bash, mcp__context7__resolve-library-id
color: cyan
---

Body.`;

    const result = convertClaudeAgentToCopilotAgent(input);
    assert.ok(result.includes('io.github.upstash/context7/resolve-library-id'), 'mcp tool mapped');
    assert.ok(!result.includes('mcp__context7__'), 'no mcp__ prefix remains');
  });

  test('handles agent with no tools field', () => {
    const input = `---
name: gsd-empty
description: Empty agent
color: green
---

Body.`;

    const result = convertClaudeAgentToCopilotAgent(input);
    assert.ok(result.includes('tools: []'), 'missing tools produces []');
  });

  test('applies CONV-06 and CONV-07 to body', () => {
    const input = `---
name: gsd-test
description: Test
tools: Read
---

Check ~/.claude/settings and run gsd:health.`;

    const result = convertClaudeAgentToCopilotAgent(input);
    assert.ok(result.includes('~/.copilot/settings'), 'CONV-06 applied');
    assert.ok(result.includes('gsd-health'), 'CONV-07 applied');
    assert.ok(!result.includes('~/.claude/'), 'no ~/.claude/ remains');
    assert.ok(!result.match(/gsd:[a-z]/), 'no gsd: command refs remain');
  });

  test('handles content without frontmatter', () => {
    const input = 'Just markdown with ~/.claude/path and gsd:test.';
    const result = convertClaudeAgentToCopilotAgent(input);
    assert.ok(result.includes('~/.copilot/path'), 'CONV-06 applied');
    assert.ok(result.includes('gsd-test'), 'CONV-07 applied');
    assert.ok(!result.includes('---'), 'no frontmatter added');
  });
});

// ─── copyCommandsAsCopilotSkills (integration) ─────────────────────────────────

describe('copyCommandsAsCopilotSkills', () => {
  const srcDir = path.join(__dirname, '..', 'commands', 'gsd');

  test('creates skill folders from source commands', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-copilot-skills-'));
    try {
      copyCommandsAsCopilotSkills(srcDir, tempDir, 'gsd');

      // Check specific folders exist
      assert.ok(fs.existsSync(path.join(tempDir, 'gsd-health')), 'gsd-health folder exists');
      assert.ok(fs.existsSync(path.join(tempDir, 'gsd-health', 'SKILL.md')), 'gsd-health/SKILL.md exists');
      assert.ok(fs.existsSync(path.join(tempDir, 'gsd-help')), 'gsd-help folder exists');
      assert.ok(fs.existsSync(path.join(tempDir, 'gsd-progress')), 'gsd-progress folder exists');

      // Count gsd-* directories — should be 31
      const dirs = fs.readdirSync(tempDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
      assert.strictEqual(dirs.length, 31, `expected 31 skill folders, got ${dirs.length}`);
    } finally {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  test('skill content has Copilot frontmatter format', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-copilot-skills-'));
    try {
      copyCommandsAsCopilotSkills(srcDir, tempDir, 'gsd');

      const skillContent = fs.readFileSync(path.join(tempDir, 'gsd-health', 'SKILL.md'), 'utf8');
      // Frontmatter format checks
      assert.ok(skillContent.startsWith('---\nname: gsd-health\n'), 'starts with name: gsd-health');
      assert.ok(skillContent.includes('allowed-tools: Read, Bash, Write, AskUserQuestion'),
        'allowed-tools is comma-separated');
      assert.ok(!skillContent.includes('allowed-tools:\n  -'), 'NOT YAML multiline format');
      // CONV-06/07 applied
      assert.ok(!skillContent.includes('~/.claude/'), 'no ~/.claude/ references');
      assert.ok(!skillContent.match(/gsd:[a-z]/), 'no gsd: command references');
    } finally {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  test('cleans up old skill directories on re-run', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-copilot-skills-'));
    try {
      // Create a fake old directory
      fs.mkdirSync(path.join(tempDir, 'gsd-fake-old'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'gsd-fake-old', 'SKILL.md'), 'old');
      assert.ok(fs.existsSync(path.join(tempDir, 'gsd-fake-old')), 'fake old dir exists before');

      // Run copy — should clean up old dirs
      copyCommandsAsCopilotSkills(srcDir, tempDir, 'gsd');

      assert.ok(!fs.existsSync(path.join(tempDir, 'gsd-fake-old')), 'fake old dir removed');
      assert.ok(fs.existsSync(path.join(tempDir, 'gsd-health')), 'real dirs still exist');
    } finally {
      fs.rmSync(tempDir, { recursive: true });
    }
  });
});

// ─── Copilot agent conversion - real files ──────────────────────────────────────

describe('Copilot agent conversion - real files', () => {
  const agentsSrc = path.join(__dirname, '..', 'agents');

  test('converts gsd-executor agent correctly', () => {
    const content = fs.readFileSync(path.join(agentsSrc, 'gsd-executor.md'), 'utf8');
    const result = convertClaudeAgentToCopilotAgent(content);

    assert.ok(result.startsWith('---\nname: gsd-executor\n'), 'starts with correct name');
    // 6 Claude tools (Read, Write, Edit, Bash, Grep, Glob) → 4 after dedup
    assert.ok(result.includes("tools: ['read', 'edit', 'execute', 'search']"),
      'tools mapped and deduplicated (6→4)');
    assert.ok(result.includes('color: yellow'), 'color preserved');
    assert.ok(!result.includes('~/.claude/'), 'no ~/.claude/ in body');
  });

  test('converts agent with mcp wildcard tools correctly', () => {
    const content = fs.readFileSync(path.join(agentsSrc, 'gsd-phase-researcher.md'), 'utf8');
    const result = convertClaudeAgentToCopilotAgent(content);

    const toolsLine = result.split('\n').find(l => l.startsWith('tools:'));
    assert.ok(toolsLine.includes('io.github.upstash/context7/*'), 'mcp wildcard mapped in tools');
    assert.ok(!toolsLine.includes('mcp__context7__'), 'no mcp__ prefix in tools line');
    assert.ok(toolsLine.includes("'web'"), 'WebSearch/WebFetch deduplicated to web');
    assert.ok(toolsLine.includes("'read'"), 'Read mapped');
  });

  test('all 11 agents convert without error', () => {
    const agents = fs.readdirSync(agentsSrc)
      .filter(f => f.startsWith('gsd-') && f.endsWith('.md'));
    assert.strictEqual(agents.length, 11, `expected 11 agents, got ${agents.length}`);

    for (const agentFile of agents) {
      const content = fs.readFileSync(path.join(agentsSrc, agentFile), 'utf8');
      const result = convertClaudeAgentToCopilotAgent(content);
      assert.ok(result.startsWith('---\n'), `${agentFile} should have frontmatter`);
      assert.ok(result.includes('tools:'), `${agentFile} should have tools field`);
      assert.ok(!result.includes('~/.claude/'), `${agentFile} should not contain ~/.claude/`);
    }
  });
});

// ─── Copilot content conversion - engine files ─────────────────────────────────

describe('Copilot content conversion - engine files', () => {
  test('converts engine .md files correctly', () => {
    const healthMd = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'health.md'), 'utf8'
    );
    const result = convertClaudeToCopilotContent(healthMd);

    assert.ok(!result.includes('~/.claude/'), 'no ~/.claude/ references remain');
    assert.ok(!result.includes('$HOME/.claude/'), 'no $HOME/.claude/ references remain');
    assert.ok(!result.match(/\/gsd:[a-z]/), 'no /gsd: command references remain');
    assert.ok(!result.match(/(?<!\/)gsd:[a-z]/), 'no bare gsd: command references remain');
    // Verify positive conversions
    assert.ok(result.includes('$HOME/.copilot/'), '$HOME path converted to .copilot');
    assert.ok(result.includes('gsd-health'), 'command name converted');
  });

  test('converts engine .cjs files correctly', () => {
    const verifyCjs = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'verify.cjs'), 'utf8'
    );
    const result = convertClaudeToCopilotContent(verifyCjs);

    assert.ok(!result.match(/gsd:[a-z]/), 'no gsd: references remain');
    assert.ok(result.includes('gsd-new-project'), 'gsd:new-project converted');
    assert.ok(result.includes('gsd-health'), 'gsd:health converted');
  });
});

// ─── Copilot instructions merge/strip ──────────────────────────────────────────

describe('Copilot instructions merge/strip', () => {
  let tmpDir;

  const gsdContent = '- Follow project conventions\n- Use structured workflows';

  function makeGsdBlock(content) {
    return GSD_COPILOT_INSTRUCTIONS_MARKER + '\n' + content.trim() + '\n' + GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER;
  }

  describe('mergeCopilotInstructions', () => {
    let tmpMergeDir;

    beforeEach(() => {
      tmpMergeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-merge-'));
    });

    afterEach(() => {
      fs.rmSync(tmpMergeDir, { recursive: true, force: true });
    });

    test('creates file from scratch when none exists', () => {
      const filePath = path.join(tmpMergeDir, 'copilot-instructions.md');
      mergeCopilotInstructions(filePath, gsdContent);

      assert.ok(fs.existsSync(filePath), 'file was created');
      const result = fs.readFileSync(filePath, 'utf8');
      assert.ok(result.includes(GSD_COPILOT_INSTRUCTIONS_MARKER), 'has opening marker');
      assert.ok(result.includes(GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER), 'has closing marker');
      assert.ok(result.includes('Follow project conventions'), 'has GSD content');
    });

    test('replaces GSD section when both markers present', () => {
      const filePath = path.join(tmpMergeDir, 'copilot-instructions.md');
      const oldContent = '# User Setup\n\n' +
        makeGsdBlock('- Old GSD content') +
        '\n\n# User Notes\n';
      fs.writeFileSync(filePath, oldContent);

      mergeCopilotInstructions(filePath, gsdContent);
      const result = fs.readFileSync(filePath, 'utf8');

      assert.ok(result.includes('# User Setup'), 'user content before preserved');
      assert.ok(result.includes('# User Notes'), 'user content after preserved');
      assert.ok(!result.includes('Old GSD content'), 'old GSD content removed');
      assert.ok(result.includes('Follow project conventions'), 'new GSD content inserted');
    });

    test('appends to existing file when no markers present', () => {
      const filePath = path.join(tmpMergeDir, 'copilot-instructions.md');
      const userContent = '# My Custom Instructions\n\nDo things my way.\n';
      fs.writeFileSync(filePath, userContent);

      mergeCopilotInstructions(filePath, gsdContent);
      const result = fs.readFileSync(filePath, 'utf8');

      assert.ok(result.includes('# My Custom Instructions'), 'original content preserved');
      assert.ok(result.includes('Do things my way.'), 'original text preserved');
      assert.ok(result.includes(GSD_COPILOT_INSTRUCTIONS_MARKER), 'GSD block appended');
      assert.ok(result.includes('Follow project conventions'), 'GSD content appended');
      // Verify separator exists
      assert.ok(result.includes('Do things my way.\n\n' + GSD_COPILOT_INSTRUCTIONS_MARKER),
        'double newline separator before GSD block');
    });

    test('handles file that is GSD-only (re-creates cleanly)', () => {
      const filePath = path.join(tmpMergeDir, 'copilot-instructions.md');
      const gsdOnly = makeGsdBlock('- Old instructions') + '\n';
      fs.writeFileSync(filePath, gsdOnly);

      const newContent = '- Updated instructions';
      mergeCopilotInstructions(filePath, newContent);
      const result = fs.readFileSync(filePath, 'utf8');

      assert.ok(!result.includes('Old instructions'), 'old content removed');
      assert.ok(result.includes('Updated instructions'), 'new content present');
      assert.ok(result.includes(GSD_COPILOT_INSTRUCTIONS_MARKER), 'has opening marker');
      assert.ok(result.includes(GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER), 'has closing marker');
    });

    test('preserves user content before and after markers', () => {
      const filePath = path.join(tmpMergeDir, 'copilot-instructions.md');
      const content = '# My Setup\n\n' +
        makeGsdBlock('- old content') +
        '\n\n# My Notes\n';
      fs.writeFileSync(filePath, content);

      mergeCopilotInstructions(filePath, gsdContent);
      const result = fs.readFileSync(filePath, 'utf8');

      assert.ok(result.includes('# My Setup'), 'content before markers preserved');
      assert.ok(result.includes('# My Notes'), 'content after markers preserved');
      assert.ok(result.includes('Follow project conventions'), 'new GSD content between markers');
      // Verify ordering: before → GSD → after
      const setupIdx = result.indexOf('# My Setup');
      const markerIdx = result.indexOf(GSD_COPILOT_INSTRUCTIONS_MARKER);
      const notesIdx = result.indexOf('# My Notes');
      assert.ok(setupIdx < markerIdx, 'user setup comes before GSD block');
      assert.ok(markerIdx < notesIdx, 'GSD block comes before user notes');
    });
  });

  describe('stripGsdFromCopilotInstructions', () => {
    test('returns null when content is GSD-only', () => {
      const content = makeGsdBlock('- GSD instructions only') + '\n';
      const result = stripGsdFromCopilotInstructions(content);
      assert.strictEqual(result, null, 'returns null for GSD-only content');
    });

    test('returns cleaned content when user content exists before markers', () => {
      const content = '# My Setup\n\nCustom rules here.\n\n' +
        makeGsdBlock('- GSD stuff') + '\n';
      const result = stripGsdFromCopilotInstructions(content);

      assert.ok(result !== null, 'does not return null');
      assert.ok(result.includes('# My Setup'), 'user content preserved');
      assert.ok(result.includes('Custom rules here.'), 'user text preserved');
      assert.ok(!result.includes(GSD_COPILOT_INSTRUCTIONS_MARKER), 'opening marker removed');
      assert.ok(!result.includes(GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER), 'closing marker removed');
      assert.ok(!result.includes('GSD stuff'), 'GSD content removed');
    });

    test('returns cleaned content when user content exists after markers', () => {
      const content = makeGsdBlock('- GSD stuff') + '\n\n# My Notes\n\nPersonal notes.\n';
      const result = stripGsdFromCopilotInstructions(content);

      assert.ok(result !== null, 'does not return null');
      assert.ok(result.includes('# My Notes'), 'user content after preserved');
      assert.ok(result.includes('Personal notes.'), 'user text after preserved');
      assert.ok(!result.includes(GSD_COPILOT_INSTRUCTIONS_MARKER), 'opening marker removed');
      assert.ok(!result.includes('GSD stuff'), 'GSD content removed');
    });

    test('returns cleaned content preserving both before and after', () => {
      const content = '# Before\n\n' + makeGsdBlock('- GSD middle') + '\n\n# After\n';
      const result = stripGsdFromCopilotInstructions(content);

      assert.ok(result !== null, 'does not return null');
      assert.ok(result.includes('# Before'), 'content before preserved');
      assert.ok(result.includes('# After'), 'content after preserved');
      assert.ok(!result.includes('GSD middle'), 'GSD content removed');
      assert.ok(!result.includes(GSD_COPILOT_INSTRUCTIONS_MARKER), 'markers removed');
    });

    test('returns original content when no markers found', () => {
      const content = '# Just user content\n\nNo GSD markers here.\n';
      const result = stripGsdFromCopilotInstructions(content);
      assert.strictEqual(result, content, 'returns content unchanged');
    });
  });
});

// ─── Copilot uninstall skill removal ───────────────────────────────────────────

describe('Copilot uninstall skill removal', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-uninstall-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('identifies gsd-* skill directories for removal', () => {
    // Create Copilot-like skills directory structure
    const skillsDir = path.join(tmpDir, 'skills');
    fs.mkdirSync(path.join(skillsDir, 'gsd-foo'), { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'gsd-foo', 'SKILL.md'), '# Foo');
    fs.mkdirSync(path.join(skillsDir, 'gsd-bar'), { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'gsd-bar', 'SKILL.md'), '# Bar');
    fs.mkdirSync(path.join(skillsDir, 'custom-skill'), { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'custom-skill', 'SKILL.md'), '# Custom');

    // Test the pattern: read skills, filter gsd-* entries
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    const gsdSkills = entries
      .filter(e => e.isDirectory() && e.name.startsWith('gsd-'))
      .map(e => e.name);
    const nonGsdSkills = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('gsd-'))
      .map(e => e.name);

    assert.deepStrictEqual(gsdSkills.sort(), ['gsd-bar', 'gsd-foo'], 'identifies gsd-* skills');
    assert.deepStrictEqual(nonGsdSkills, ['custom-skill'], 'preserves non-gsd skills');
  });

  test('cleans GSD section from copilot-instructions.md on uninstall', () => {
    const content = '# My Setup\n\nMy custom rules.\n\n' +
      GSD_COPILOT_INSTRUCTIONS_MARKER + '\n' +
      '- GSD managed content\n' +
      GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER + '\n';

    const result = stripGsdFromCopilotInstructions(content);

    assert.ok(result !== null, 'does not return null when user content exists');
    assert.ok(result.includes('# My Setup'), 'user content preserved');
    assert.ok(result.includes('My custom rules.'), 'user text preserved');
    assert.ok(!result.includes('GSD managed content'), 'GSD content removed');
    assert.ok(!result.includes(GSD_COPILOT_INSTRUCTIONS_MARKER), 'markers removed');
  });

  test('deletes copilot-instructions.md when GSD-only on uninstall', () => {
    const content = GSD_COPILOT_INSTRUCTIONS_MARKER + '\n' +
      '- Only GSD content\n' +
      GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER + '\n';

    const result = stripGsdFromCopilotInstructions(content);

    assert.strictEqual(result, null, 'returns null signaling file deletion');
  });
});

// ─── Copilot manifest and patches fixes ────────────────────────────────────────

describe('Copilot manifest and patches fixes', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-manifest-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writeManifest hashes skills for Copilot runtime', () => {
    // Create minimal get-shit-done dir (required by writeManifest)
    const gsdDir = path.join(tmpDir, 'get-shit-done', 'bin');
    fs.mkdirSync(gsdDir, { recursive: true });
    fs.writeFileSync(path.join(gsdDir, 'verify.cjs'), '// verify stub');

    // Create Copilot skills directory
    const skillDir = path.join(tmpDir, 'skills', 'gsd-test');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill\n\nA test skill.');

    const manifest = writeManifest(tmpDir, 'copilot');

    // Check manifest file was written
    const manifestPath = path.join(tmpDir, 'gsd-file-manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest file created');

    // Read and verify skills are hashed
    const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const skillKey = 'skills/gsd-test/SKILL.md';
    assert.ok(data.files[skillKey], 'skill file hashed in manifest');
    assert.ok(typeof data.files[skillKey] === 'string', 'hash is a string');
    assert.ok(data.files[skillKey].length === 64, 'hash is SHA-256 (64 hex chars)');
  });

  test('reportLocalPatches shows /gsd-reapply-patches for Copilot', () => {
    // Create patches directory with metadata
    const patchesDir = path.join(tmpDir, 'gsd-local-patches');
    fs.mkdirSync(patchesDir, { recursive: true });
    fs.writeFileSync(path.join(patchesDir, 'backup-meta.json'), JSON.stringify({
      from_version: '1.0',
      files: ['skills/gsd-test/SKILL.md']
    }));

    // Capture console output
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      const result = reportLocalPatches(tmpDir, 'copilot');

      assert.ok(result.length > 0, 'returns patched files list');
      const output = logs.join('\n');
      assert.ok(output.includes('/gsd-reapply-patches'), 'uses dash format for Copilot');
      assert.ok(!output.includes('/gsd:reapply-patches'), 'does not use colon format');
    } finally {
      console.log = originalLog;
    }
  });

  test('reportLocalPatches shows /gsd:reapply-patches for Claude (unchanged)', () => {
    // Create patches directory with metadata
    const patchesDir = path.join(tmpDir, 'gsd-local-patches');
    fs.mkdirSync(patchesDir, { recursive: true });
    fs.writeFileSync(path.join(patchesDir, 'backup-meta.json'), JSON.stringify({
      from_version: '1.0',
      files: ['get-shit-done/bin/verify.cjs']
    }));

    // Capture console output
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    try {
      const result = reportLocalPatches(tmpDir, 'claude');

      assert.ok(result.length > 0, 'returns patched files list');
      const output = logs.join('\n');
      assert.ok(output.includes('/gsd:reapply-patches'), 'uses colon format for Claude');
    } finally {
      console.log = originalLog;
    }
  });
});
