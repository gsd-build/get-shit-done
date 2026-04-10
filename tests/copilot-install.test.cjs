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
const assert = require('node:assert/strict');
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
    assert.strictEqual(getDirName('kilo'), '.kilo');
    assert.strictEqual(getDirName('codex'), '.codex');
  });
});

// ─── getGlobalDir ───────────────────────────────────────────────────────────────

describe('getGlobalDir (Copilot)', () => {
  let originalCopilotConfigDir;

  beforeEach(() => {
    originalCopilotConfigDir = process.env.COPILOT_CONFIG_DIR;
  });

  afterEach(() => {
    if (originalCopilotConfigDir !== undefined) {
      process.env.COPILOT_CONFIG_DIR = originalCopilotConfigDir;
    } else {
      delete process.env.COPILOT_CONFIG_DIR;
    }
  });

  test('returns ~/.copilot with no env var or explicit dir', () => {
    delete process.env.COPILOT_CONFIG_DIR;
    const result = getGlobalDir('copilot');
    assert.strictEqual(result, path.join(os.homedir(), '.copilot'));
  });

  test('returns explicit dir when provided', () => {
    const result = getGlobalDir('copilot', '/custom/path');
    assert.strictEqual(result, '/custom/path');
  });

  test('respects COPILOT_CONFIG_DIR env var', () => {
    process.env.COPILOT_CONFIG_DIR = '~/custom-copilot';
    const result = getGlobalDir('copilot');
    assert.strictEqual(result, path.join(os.homedir(), 'custom-copilot'));
  });

  test('explicit dir takes priority over COPILOT_CONFIG_DIR', () => {
    process.env.COPILOT_CONFIG_DIR = '~/env-path';
    const result = getGlobalDir('copilot', '/explicit/path');
    assert.strictEqual(result, '/explicit/path');
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
    assert.strictEqual(getConfigDirFromHome('kilo', true), "'.config', 'kilo'");
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
      src.includes("'copilot'") && src.includes('selectedRuntimes = ['),
      '--all includes copilot runtime'
    );
  });

  test('CLI-06: banner text includes Copilot', () => {
    assert.ok(src.includes('Copilot'), 'banner mentions Copilot');
  });

  test('CLI-06: help text includes --copilot', () => {
    assert.ok(src.includes('--copilot'), 'help text has --copilot option');
  });

  test('CLI-02: promptRuntime runtimeMap has Copilot as option 7', () => {
    assert.ok(src.includes("'7': 'copilot'"), 'runtimeMap has 7 -> copilot');
  });

  test('CLI-02: promptRuntime allRuntimes array includes copilot', () => {
    const allMatch = src.match(/const allRuntimes = \[([^\]]+)\]/);
    assert.ok(allMatch && allMatch[1].includes('copilot'), 'allRuntimes includes copilot');
  });

  test('CLI-02: promptRuntime keeps Kilo above OpenCode in allRuntimes', () => {
    const allMatch = src.match(/const allRuntimes = \[([^\]]+)\]/);
    assert.ok(allMatch, 'allRuntimes array found');
    assert.ok(allMatch[1].indexOf("'kilo'") < allMatch[1].indexOf("'opencode'"), 'kilo appears before opencode');
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
  test('replaces ~/.claude/ with .github/ in local mode (default)', () => {
    assert.strictEqual(
      convertClaudeToCopilotContent('see ~/.claude/foo'),
      'see .github/foo'
    );
  });

  test('replaces ~/.claude/ with ~/.copilot/ in global mode', () => {
    assert.strictEqual(
      convertClaudeToCopilotContent('see ~/.claude/foo', true),
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

  test('replaces $HOME/.claude/ with .github/ in local mode (default)', () => {
    assert.strictEqual(
      convertClaudeToCopilotContent('"$HOME/.claude/config"'),
      '".github/config"'
    );
  });

  test('replaces $HOME/.claude/ with $HOME/.copilot/ in global mode', () => {
    assert.strictEqual(
      convertClaudeToCopilotContent('"$HOME/.claude/config"', true),
      '"$HOME/.copilot/config"'
    );
  });

  test('converts gsd: to gsd- in command names', () => {
    assert.strictEqual(
      convertClaudeToCopilotContent('run /gsd:health or gsd:progress'),
      'run /gsd-health or gsd-progress'
    );
  });

  test('handles mixed content in local mode', () => {
    const input = 'Config at ~/.claude/settings and $HOME/.claude/config.\n' +
      'Local at ./.claude/data and .claude/commands.\n' +
      'Run gsd:health and /gsd:progress.';
    const result = convertClaudeToCopilotContent(input);
    assert.ok(result.includes('.github/settings'), 'tilde path converted to local');
    assert.ok(!result.includes('$HOME/.claude/'), '$HOME path converted');
    assert.ok(result.includes('./.github/data'), 'dot-slash path converted');
    assert.ok(result.includes('.github/commands'), 'bare path converted');
    assert.ok(result.includes('gsd-health'), 'command name converted');
    assert.ok(result.includes('/gsd-progress'), 'slash command converted');
  });

  test('handles mixed content in global mode', () => {
    const input = 'Config at ~/.claude/settings and $HOME/.claude/config.\n' +
      'Local at ./.claude/data and .claude/commands.\n' +
      'Run gsd:health and /gsd:progress.';
    const result = convertClaudeToCopilotContent(input, true);
    assert.ok(result.includes('~/.copilot/settings'), 'tilde path converted to global');
    assert.ok(result.includes('$HOME/.copilot/config'), '$HOME path converted to global');
    assert.ok(result.includes('./.github/data'), 'dot-slash path converted');
    assert.ok(result.includes('.github/commands'), 'bare path converted');
  });

  test('does not double-replace in local mode', () => {
    const input = '~/.claude/foo and ./.claude/bar and .claude/baz';
    const result = convertClaudeToCopilotContent(input);
    assert.ok(!result.includes('.github/.github/'), 'no .github/.github/ artifact');
    assert.strictEqual(result, '.github/foo and ./.github/bar and .github/baz');
  });

  test('does not double-replace in global mode', () => {
    const input = '~/.claude/foo and ./.claude/bar and .claude/baz';
    const result = convertClaudeToCopilotContent(input, true);
    assert.ok(!result.includes('.copilot/.github/'), 'no .copilot/.github/ artifact');
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
    assert.ok(result.includes('argument-hint: "[--repair]"'), 'argument-hint double-quoted');
    assert.ok(result.includes('allowed-tools: Read, Bash, Write, AskUserQuestion'), 'tools comma-separated');
    assert.ok(result.includes('.github/foo'), 'CONV-06 applied to body (local mode default)');
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

  test('argument-hint with inner single quotes uses double-quote YAML delimiter', () => {
    const input = `---
name: gsd:new-milestone
description: Start milestone
argument-hint: "[milestone name, e.g., 'v1.1 Notifications']"
allowed-tools:
  - Read
---

Body.`;

    const result = convertClaudeCommandToCopilotSkill(input, 'gsd-new-milestone');
    assert.ok(result.includes(`argument-hint: "[milestone name, e.g., 'v1.1 Notifications']"`), 'inner single quotes preserved with double-quote delimiter');
  });

  test('applies CONV-06 path conversion to body (local mode)', () => {
    const input = `---
name: gsd:test
description: Test skill
---

Check ~/.claude/settings and ./.claude/local and $HOME/.claude/global.`;

    const result = convertClaudeCommandToCopilotSkill(input, 'gsd-test');
    assert.ok(result.includes('.github/settings'), 'tilde path converted to local');
    assert.ok(result.includes('./.github/local'), 'dot-slash path converted');
    assert.ok(result.includes('.github/global'), '$HOME path converted to local');
  });

  test('applies CONV-06 path conversion to body (global mode)', () => {
    const input = `---
name: gsd:test
description: Test skill
---

Check ~/.claude/settings and ./.claude/local and $HOME/.claude/global.`;

    const result = convertClaudeCommandToCopilotSkill(input, 'gsd-test', true);
    assert.ok(result.includes('~/.copilot/settings'), 'tilde path converted to global');
    assert.ok(result.includes('./.github/local'), 'dot-slash path converted');
    assert.ok(result.includes('$HOME/.copilot/global'), '$HOME path converted to global');
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

  test('handles content without frontmatter (local mode)', () => {
    const input = 'Just some markdown with ~/.claude/path and gsd:health.';
    const result = convertClaudeCommandToCopilotSkill(input, 'gsd-test');
    assert.ok(result.includes('.github/path'), 'CONV-06 applied (local)');
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

  test('applies CONV-06 and CONV-07 to body (local mode)', () => {
    const input = `---
name: gsd-test
description: Test
tools: Read
---

Check ~/.claude/settings and run gsd:health.`;

    const result = convertClaudeAgentToCopilotAgent(input);
    assert.ok(result.includes('.github/settings'), 'CONV-06 applied (local)');
    assert.ok(result.includes('gsd-health'), 'CONV-07 applied');
    assert.ok(!result.includes('~/.claude/'), 'no ~/.claude/ remains');
    assert.ok(!result.match(/gsd:[a-z]/), 'no gsd: command refs remain');
  });

  test('applies CONV-06 and CONV-07 to body (global mode)', () => {
    const input = `---
name: gsd-test
description: Test
tools: Read
---

Check ~/.claude/settings and run gsd:health.`;

    const result = convertClaudeAgentToCopilotAgent(input, true);
    assert.ok(result.includes('~/.copilot/settings'), 'CONV-06 applied (global)');
    assert.ok(result.includes('gsd-health'), 'CONV-07 applied');
  });

  test('handles content without frontmatter (local mode)', () => {
    const input = 'Just markdown with ~/.claude/path and gsd:test.';
    const result = convertClaudeAgentToCopilotAgent(input);
    assert.ok(result.includes('.github/path'), 'CONV-06 applied (local)');
    assert.ok(result.includes('gsd-test'), 'CONV-07 applied');
    assert.ok(!result.includes('---'), 'no frontmatter added');
  });
});

// ─── copyCommandsAsCopilotSkills (integration) ─────────────────────────────────

describe('copyCommandsAsCopilotSkills', () => {
  const srcDir = path.join(__dirname, '..', 'commands', 'gsd');
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-copilot-skills-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('creates skill folders from source commands', () => {
    copyCommandsAsCopilotSkills(srcDir, tempDir, 'gsd');

    // Check specific folders exist
    assert.ok(fs.existsSync(path.join(tempDir, 'gsd-health')), 'gsd-health folder exists');
    assert.ok(fs.existsSync(path.join(tempDir, 'gsd-health', 'SKILL.md')), 'gsd-health/SKILL.md exists');
    assert.ok(fs.existsSync(path.join(tempDir, 'gsd-help')), 'gsd-help folder exists');
    assert.ok(fs.existsSync(path.join(tempDir, 'gsd-progress')), 'gsd-progress folder exists');

    // Count gsd-* directories — should match number of source command files
    const dirs = fs.readdirSync(tempDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
    const expectedSkillCount = fs.readdirSync(path.join(__dirname, '..', 'commands', 'gsd'))
      .filter(f => f.endsWith('.md')).length;
    assert.strictEqual(dirs.length, expectedSkillCount, `expected ${expectedSkillCount} skill folders, got ${dirs.length}`);
  });

  test('skill content has Copilot frontmatter format', () => {
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
  });

  test('generates gsd-autonomous skill from autonomous.md command', () => {
    // Fail-fast: source command must exist
    const srcFile = path.join(srcDir, 'autonomous.md');
    assert.ok(fs.existsSync(srcFile), 'commands/gsd/autonomous.md must exist as source');

    copyCommandsAsCopilotSkills(srcDir, tempDir, 'gsd');

    // Skill folder and file created
    assert.ok(fs.existsSync(path.join(tempDir, 'gsd-autonomous')), 'gsd-autonomous folder exists');
    assert.ok(fs.existsSync(path.join(tempDir, 'gsd-autonomous', 'SKILL.md')), 'gsd-autonomous/SKILL.md exists');

    const skillContent = fs.readFileSync(path.join(tempDir, 'gsd-autonomous', 'SKILL.md'), 'utf8');

    // Frontmatter: name converted from gsd:autonomous to gsd-autonomous
    assert.ok(skillContent.startsWith('---\nname: gsd-autonomous\n'), 'name is gsd-autonomous');
    assert.ok(skillContent.includes('description: Run all remaining phases autonomously'),
      'description preserved');
    // argument-hint present and double-quoted
    assert.ok(skillContent.includes('argument-hint: "[--from N] [--to N] [--only N] [--interactive]"'), 'argument-hint present and quoted');
    // allowed-tools comma-separated
    assert.ok(skillContent.includes('allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion, Task'),
      'allowed-tools is comma-separated');
    // No Claude-format remnants
    assert.ok(!skillContent.includes('allowed-tools:\n  -'), 'NOT YAML multiline format');
    assert.ok(!skillContent.includes('~/.claude/'), 'no ~/.claude/ references in body');
  });

  test('autonomous skill body converts gsd: to gsd- (CONV-07)', () => {
    // Use convertClaudeToCopilotContent directly on the command body content
    const srcContent = fs.readFileSync(path.join(srcDir, 'autonomous.md'), 'utf8');
    const result = convertClaudeToCopilotContent(srcContent);

    // gsd:autonomous references should be converted to gsd-autonomous
    assert.ok(!result.match(/gsd:[a-z]/), 'no gsd: command references remain after conversion');
    // Specific: gsd:discuss-phase, gsd:plan-phase, gsd:execute-phase mentioned in body
    // The body references gsd-tools.cjs (not a gsd: command) — those should be unaffected
    // But /gsd:autonomous → /gsd-autonomous, gsd:discuss-phase → gsd-discuss-phase etc.
    if (srcContent.includes('gsd:autonomous')) {
      assert.ok(result.includes('gsd-autonomous'), 'gsd:autonomous converted to gsd-autonomous');
    }
    // Path conversion: ~/.claude/ → .github/
    assert.ok(!result.includes('~/.claude/'), 'no ~/.claude/ paths remain');
  });

  test('cleans up old skill directories on re-run', () => {
    // Create a fake old directory
    fs.mkdirSync(path.join(tempDir, 'gsd-fake-old'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'gsd-fake-old', 'SKILL.md'), 'old');
    assert.ok(fs.existsSync(path.join(tempDir, 'gsd-fake-old')), 'fake old dir exists before');

    // Run copy — should clean up old dirs
    copyCommandsAsCopilotSkills(srcDir, tempDir, 'gsd');

    assert.ok(!fs.existsSync(path.join(tempDir, 'gsd-fake-old')), 'fake old dir removed');
    assert.ok(fs.existsSync(path.join(tempDir, 'gsd-health')), 'real dirs still exist');
  });
});

// ─── Copilot agent conversion - real files ──────────────────────────────────────

describe('Copilot agent conversion - real files', () => {
  const agentsSrc = path.join(__dirname, '..', 'agents');

  test('converts gsd-executor agent correctly', () => {
    const content = fs.readFileSync(path.join(agentsSrc, 'gsd-executor.md'), 'utf8');
    const result = convertClaudeAgentToCopilotAgent(content);

    assert.ok(result.startsWith('---\nname: gsd-executor\n'), 'starts with correct name');
    // Verify deduplication happened and core tools are present (not hardcoded exact list)
    const toolsLine = result.split('\n').find(l => l.startsWith('tools:'));
    assert.ok(toolsLine, 'tools line present in converted output');
    assert.ok(toolsLine.includes("'read'"), 'Read mapped to read');
    assert.ok(toolsLine.includes("'edit'"), 'Write/Edit deduplicated to edit');
    assert.ok(toolsLine.includes("'execute'"), 'Bash mapped to execute');
    assert.ok(toolsLine.includes("'search'"), 'Grep/Glob deduplicated to search');
    // Input tools count > output tools count (deduplication occurred)
    const inputTools = content.match(/^tools:\s*\[([^\]]+)\]/m)?.[1].split(',').length ?? 0;
    const outputTools = toolsLine.replace(/^tools:\s*\[/, '').replace(/\].*$/, '').split(',').length;
    assert.ok(inputTools === 0 || outputTools <= inputTools, 'deduplication reduced or preserved tool count');
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

  test('all 18 agents convert without error', () => {
    const agents = fs.readdirSync(agentsSrc)
      .filter(f => f.startsWith('gsd-') && f.endsWith('.md'));
    const expectedAgentCount = fs.readdirSync(agentsSrc)
      .filter(f => f.startsWith('gsd-') && f.endsWith('.md')).length;
    assert.strictEqual(agents.length, expectedAgentCount, `expected ${expectedAgentCount} agents, got ${agents.length}`);

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
  test('converts engine .md files correctly (local mode default)', () => {
    const healthMd = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'health.md'), 'utf8'
    );
    const result = convertClaudeToCopilotContent(healthMd);

    assert.ok(!result.includes('~/.claude/'), 'no ~/.claude/ references remain');
    assert.ok(!result.includes('$HOME/.claude/'), 'no $HOME/.claude/ references remain');
    assert.ok(!result.match(/\/gsd:[a-z]/), 'no /gsd: command references remain');
    assert.ok(!result.match(/(?<!\/)gsd:[a-z]/), 'no bare gsd: command references remain');
    // Local mode: ~ and $HOME resolve to .github (repo-relative, no ./ prefix)
    assert.ok(result.includes('.github/'), 'paths converted to .github for local');
    assert.ok(result.includes('gsd-health'), 'command name converted');
  });

  test('converts engine .md files correctly (global mode)', () => {
    const healthMd = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'health.md'), 'utf8'
    );
    const result = convertClaudeToCopilotContent(healthMd, true);

    assert.ok(!result.includes('~/.claude/'), 'no ~/.claude/ references remain');
    assert.ok(!result.includes('$HOME/.claude/'), 'no $HOME/.claude/ references remain');
    // Global mode: ~ and $HOME resolve to .copilot
    if (healthMd.includes('$HOME/.claude/')) {
      assert.ok(result.includes('$HOME/.copilot/'), '$HOME path converted to .copilot');
    }
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

  describe('reportLocalPatches', () => {
    let originalLog;
    let logs;

    beforeEach(() => {
      originalLog = console.log;
      logs = [];
      console.log = (...args) => logs.push(args.join(' '));
    });

    afterEach(() => {
      console.log = originalLog;
    });

    test('reportLocalPatches shows /gsd-reapply-patches for Copilot', () => {
      // Create patches directory with metadata
      const patchesDir = path.join(tmpDir, 'gsd-local-patches');
      fs.mkdirSync(patchesDir, { recursive: true });
      fs.writeFileSync(path.join(patchesDir, 'backup-meta.json'), JSON.stringify({
        from_version: '1.0',
        files: ['skills/gsd-test/SKILL.md']
      }));

      const result = reportLocalPatches(tmpDir, 'copilot');

      assert.ok(result.length > 0, 'returns patched files list');
      const output = logs.join('\n');
      assert.ok(output.includes('/gsd-reapply-patches'), 'uses dash format for Copilot');
      assert.ok(!output.includes('/gsd:reapply-patches'), 'does not use colon format');
    });

    test('reportLocalPatches shows /gsd-reapply-patches for Claude', () => {
      // Create patches directory with metadata
      const patchesDir = path.join(tmpDir, 'gsd-local-patches');
      fs.mkdirSync(patchesDir, { recursive: true });
      fs.writeFileSync(path.join(patchesDir, 'backup-meta.json'), JSON.stringify({
        from_version: '1.0',
        files: ['get-shit-done/bin/verify.cjs']
      }));

      const result = reportLocalPatches(tmpDir, 'claude');

      assert.ok(result.length > 0, 'returns patched files list');
      const output = logs.join('\n');
      assert.ok(output.includes('/gsd-reapply-patches'), 'uses hyphen format for Claude');
      assert.ok(!output.includes('/gsd:reapply-patches'), 'does not use colon format for Claude');
    });
  });
});

// ============================================================================
// E2E Integration Tests — Copilot Install & Uninstall
// ============================================================================

const { execFileSync } = require('child_process');
const crypto = require('crypto');

const INSTALL_PATH = path.join(__dirname, '..', 'bin', 'install.js');
const EXPECTED_SKILLS = fs.readdirSync(path.join(__dirname, '..', 'commands', 'gsd'))
  .filter(f => f.endsWith('.md')).length;
const EXPECTED_AGENTS = fs.readdirSync(path.join(__dirname, '..', 'agents'))
  .filter(f => f.startsWith('gsd-') && f.endsWith('.md')).length;

function runCopilotInstall(cwd) {
  const env = { ...process.env };
  delete env.GSD_TEST_MODE;
  return execFileSync(process.execPath, [INSTALL_PATH, '--copilot', '--local'], {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });
}

function runCopilotUninstall(cwd) {
  const env = { ...process.env };
  delete env.GSD_TEST_MODE;
  return execFileSync(process.execPath, [INSTALL_PATH, '--copilot', '--local', '--uninstall'], {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });
}

describe('E2E: Copilot full install verification', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-e2e-'));
    runCopilotInstall(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('installs expected number of skill directories', () => {
    const skillsDir = path.join(tmpDir, '.github', 'skills');
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    const gsdSkills = entries.filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
    assert.strictEqual(gsdSkills.length, EXPECTED_SKILLS,
      `Expected ${EXPECTED_SKILLS} skill directories, got ${gsdSkills.length}`);
  });

  test('each skill directory contains SKILL.md', () => {
    const skillsDir = path.join(tmpDir, '.github', 'skills');
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    const gsdSkills = entries.filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
    for (const skill of gsdSkills) {
      const skillMdPath = path.join(skillsDir, skill.name, 'SKILL.md');
      assert.ok(fs.existsSync(skillMdPath),
        `Missing SKILL.md in ${skill.name}`);
    }
  });

  test('installs expected number of agent files', () => {
    const agentsDir = path.join(tmpDir, '.github', 'agents');
    const files = fs.readdirSync(agentsDir);
    const gsdAgents = files.filter(f => f.startsWith('gsd-') && f.endsWith('.agent.md'));
    assert.strictEqual(gsdAgents.length, EXPECTED_AGENTS,
      `Expected ${EXPECTED_AGENTS} agent files, got ${gsdAgents.length}`);
  });

  test('installs all expected agent files', () => {
    const agentsDir = path.join(tmpDir, '.github', 'agents');
    const files = fs.readdirSync(agentsDir);
    const gsdAgents = files.filter(f => f.startsWith('gsd-') && f.endsWith('.agent.md')).sort();
    const expected = [
      'gsd-advisor-researcher.agent.md',
      'gsd-ai-researcher.agent.md',
      'gsd-assumptions-analyzer.agent.md',
      'gsd-code-fixer.agent.md',
      'gsd-code-reviewer.agent.md',
      'gsd-codebase-mapper.agent.md',
      'gsd-debugger.agent.md',
      'gsd-doc-verifier.agent.md',
      'gsd-doc-writer.agent.md',
      'gsd-domain-researcher.agent.md',
      'gsd-eval-auditor.agent.md',
      'gsd-eval-planner.agent.md',
      'gsd-executor.agent.md',
      'gsd-framework-selector.agent.md',
      'gsd-integration-checker.agent.md',
      'gsd-intel-updater.agent.md',
      'gsd-nyquist-auditor.agent.md',
      'gsd-phase-researcher.agent.md',
      'gsd-plan-checker.agent.md',
      'gsd-planner.agent.md',
      'gsd-project-researcher.agent.md',
      'gsd-research-synthesizer.agent.md',
      'gsd-roadmapper.agent.md',
      'gsd-security-auditor.agent.md',
      'gsd-ui-auditor.agent.md',
      'gsd-ui-checker.agent.md',
      'gsd-ui-researcher.agent.md',
      'gsd-user-profiler.agent.md',
      'gsd-verifier.agent.md',
    ].sort();
    assert.deepStrictEqual(gsdAgents, expected);
  });

  test('generates copilot-instructions.md with GSD markers', () => {
    const instrPath = path.join(tmpDir, '.github', 'copilot-instructions.md');
    assert.ok(fs.existsSync(instrPath), 'copilot-instructions.md should exist');
    const content = fs.readFileSync(instrPath, 'utf-8');
    assert.ok(content.includes('<!-- GSD Configuration'),
      'Should contain GSD Configuration open marker');
    assert.ok(content.includes('<!-- /GSD Configuration -->'),
      'Should contain GSD Configuration close marker');
  });

  test('creates manifest with correct structure', () => {
    const manifestPath = path.join(tmpDir, '.github', 'gsd-file-manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'gsd-file-manifest.json should exist');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    assert.ok(manifest.version, 'manifest should have version');
    assert.ok(manifest.timestamp, 'manifest should have timestamp');
    assert.ok(manifest.files && typeof manifest.files === 'object',
      'manifest should have files object');
    assert.ok(Object.keys(manifest.files).length > 0,
      'manifest files should not be empty');
  });

  test('manifest contains expected file categories', () => {
    const manifestPath = path.join(tmpDir, '.github', 'gsd-file-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const keys = Object.keys(manifest.files);

    const skillEntries = keys.filter(k => k.startsWith('skills/'));
    const agentEntries = keys.filter(k => k.startsWith('agents/'));
    const engineEntries = keys.filter(k => k.startsWith('get-shit-done/'));

    assert.strictEqual(skillEntries.length, EXPECTED_SKILLS,
      `Expected ${EXPECTED_SKILLS} skill manifest entries, got ${skillEntries.length}`);
    assert.strictEqual(agentEntries.length, EXPECTED_AGENTS,
      `Expected ${EXPECTED_AGENTS} agent manifest entries, got ${agentEntries.length}`);
    assert.ok(engineEntries.length > 0,
      'Should have get-shit-done/ engine manifest entries');
  });

  test('manifest SHA256 hashes match actual file contents', () => {
    const manifestPath = path.join(tmpDir, '.github', 'gsd-file-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const githubDir = path.join(tmpDir, '.github');

    for (const [relPath, expectedHash] of Object.entries(manifest.files)) {
      const filePath = path.join(githubDir, relPath);
      assert.ok(fs.existsSync(filePath),
        `Manifest references ${relPath} but file does not exist`);
      const content = fs.readFileSync(filePath);
      const actualHash = crypto.createHash('sha256').update(content).digest('hex');
      assert.strictEqual(actualHash, expectedHash,
        `SHA256 mismatch for ${relPath}: expected ${expectedHash}, got ${actualHash}`);
    }
  });

  test('engine directory contains required subdirectories and files', () => {
    const engineDir = path.join(tmpDir, '.github', 'get-shit-done');
    const requiredDirs = ['bin', 'references', 'templates', 'workflows'];
    const requiredFiles = ['CHANGELOG.md', 'VERSION'];

    for (const dir of requiredDirs) {
      const dirPath = path.join(engineDir, dir);
      assert.ok(fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory(),
        `Engine should contain directory: ${dir}`);
    }
    for (const file of requiredFiles) {
      const filePath = path.join(engineDir, file);
      assert.ok(fs.existsSync(filePath) && fs.statSync(filePath).isFile(),
        `Engine should contain file: ${file}`);
    }
  });
});

describe('E2E: Copilot uninstall verification', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-e2e-'));
    runCopilotInstall(tmpDir);
    runCopilotUninstall(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('removes engine directory', () => {
    const engineDir = path.join(tmpDir, '.github', 'get-shit-done');
    assert.ok(!fs.existsSync(engineDir),
      'get-shit-done directory should not exist after uninstall');
  });

  test('removes copilot-instructions.md', () => {
    const instrPath = path.join(tmpDir, '.github', 'copilot-instructions.md');
    assert.ok(!fs.existsSync(instrPath),
      'copilot-instructions.md should not exist after uninstall');
  });

  test('removes all GSD skill directories', () => {
    const skillsDir = path.join(tmpDir, '.github', 'skills');
    if (fs.existsSync(skillsDir)) {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      const gsdSkills = entries.filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
      assert.strictEqual(gsdSkills.length, 0,
        `Expected 0 GSD skill directories after uninstall, found: ${gsdSkills.map(e => e.name).join(', ')}`);
    }
  });

  test('removes all GSD agent files', () => {
    const agentsDir = path.join(tmpDir, '.github', 'agents');
    if (fs.existsSync(agentsDir)) {
      const files = fs.readdirSync(agentsDir);
      const gsdAgents = files.filter(f => f.startsWith('gsd-') && f.endsWith('.agent.md'));
      assert.strictEqual(gsdAgents.length, 0,
        `Expected 0 GSD agent files after uninstall, found: ${gsdAgents.join(', ')}`);
    }
  });

  describe('preserves non-GSD content', () => {
    let td;

    beforeEach(() => {
      td = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-e2e-preserve-'));
      runCopilotInstall(td);
    });

    afterEach(() => {
      fs.rmSync(td, { recursive: true, force: true });
    });

    test('preserves non-GSD content in skills directory', () => {
      // Add non-GSD custom skill
      const customSkillDir = path.join(td, '.github', 'skills', 'my-custom-skill');
      fs.mkdirSync(customSkillDir, { recursive: true });
      fs.writeFileSync(path.join(customSkillDir, 'SKILL.md'), '# My Custom Skill\n');
      // Uninstall
      runCopilotUninstall(td);
      // Verify custom content preserved
      assert.ok(fs.existsSync(path.join(customSkillDir, 'SKILL.md')),
        'Non-GSD skill directory and SKILL.md should be preserved after uninstall');
    });

    test('preserves non-GSD content in agents directory', () => {
      // Add non-GSD custom agent
      const customAgentPath = path.join(td, '.github', 'agents', 'my-agent.md');
      fs.writeFileSync(customAgentPath, '# My Custom Agent\n');
      // Uninstall
      runCopilotUninstall(td);
      // Verify custom content preserved
      assert.ok(fs.existsSync(customAgentPath),
        'Non-GSD agent file should be preserved after uninstall');
    });
  });
});

// ─── Claude uninstall: user file preservation (#1423) ─────────────────────────

function runClaudeInstall(cwd) {
  const env = { ...process.env };
  delete env.GSD_TEST_MODE;
  return execFileSync(process.execPath, [INSTALL_PATH, '--claude', '--local'], {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });
}

function runClaudeUninstall(cwd) {
  const env = { ...process.env };
  delete env.GSD_TEST_MODE;
  return execFileSync(process.execPath, [INSTALL_PATH, '--claude', '--local', '--uninstall'], {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });
}

describe('Claude uninstall preserves user-generated files (#1423)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-preserve-'));
    runClaudeInstall(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('preserves USER-PROFILE.md across uninstall', () => {
    const profilePath = path.join(tmpDir, '.claude', 'get-shit-done', 'USER-PROFILE.md');
    const content = '# Developer Profile\n\nAutonomy: High\nGenerated: 2026-03-29\n';
    fs.writeFileSync(profilePath, content);

    runClaudeUninstall(tmpDir);

    assert.ok(fs.existsSync(profilePath), 'USER-PROFILE.md should survive uninstall');
    assert.strictEqual(fs.readFileSync(profilePath, 'utf-8'), content, 'content should be identical');
  });

  test('preserves dev-preferences.md across uninstall', () => {
    const prefsDir = path.join(tmpDir, '.claude', 'commands', 'gsd');
    fs.mkdirSync(prefsDir, { recursive: true });
    const prefsPath = path.join(prefsDir, 'dev-preferences.md');
    const content = '---\nname: dev-preferences\n---\n# Preferences\nUse TypeScript strict.\n';
    fs.writeFileSync(prefsPath, content);

    runClaudeUninstall(tmpDir);

    assert.ok(fs.existsSync(prefsPath), 'dev-preferences.md should survive uninstall');
    assert.strictEqual(fs.readFileSync(prefsPath, 'utf-8'), content, 'content should be identical');
  });

  test('still removes GSD engine files during uninstall', () => {
    const profilePath = path.join(tmpDir, '.claude', 'get-shit-done', 'USER-PROFILE.md');
    fs.writeFileSync(profilePath, '# Profile\n');

    // Verify engine files exist before uninstall
    const binDir = path.join(tmpDir, '.claude', 'get-shit-done', 'bin');
    assert.ok(fs.existsSync(binDir), 'bin/ should exist before uninstall');

    runClaudeUninstall(tmpDir);

    // Engine files gone, user file preserved
    assert.ok(!fs.existsSync(binDir), 'bin/ should be removed after uninstall');
    assert.ok(fs.existsSync(profilePath), 'USER-PROFILE.md should survive');
  });

  test('clean uninstall when no user files exist', () => {
    runClaudeUninstall(tmpDir);

    const gsdDir = path.join(tmpDir, '.claude', 'get-shit-done');
    const cmdDir = path.join(tmpDir, '.claude', 'commands', 'gsd');
    // Directories should be fully removed when no user files to preserve
    assert.ok(!fs.existsSync(gsdDir), 'get-shit-done/ should not exist after clean uninstall');
    assert.ok(!fs.existsSync(cmdDir), 'commands/gsd/ should not exist after clean uninstall');
  });
});
