/**
 * GSD Tools Tests - kimi-config.cjs
 *
 * Tests for Kimi CLI adapter: tool name conversion, skill conversion,
 * agent YAML conversion, and integration with copyCommandsAsKimiSkills.
 */

// Enable test exports from install.js (skips main CLI logic)
process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  convertKimiToolName,
  convertClaudeToKimiSkill,
  convertClaudeToKimiAgent,
} = require('../bin/install.js');

// ─── convertKimiToolName ─────────────────────────────────────────────────────

describe('convertKimiToolName', () => {
  test('maps file tools to kimi_cli.tools.file module', () => {
    assert.strictEqual(convertKimiToolName('Read'), 'kimi_cli.tools.file:ReadFile');
    assert.strictEqual(convertKimiToolName('Write'), 'kimi_cli.tools.file:WriteFile');
    assert.strictEqual(convertKimiToolName('Edit'), 'kimi_cli.tools.file:StrReplaceFile');
    assert.strictEqual(convertKimiToolName('Glob'), 'kimi_cli.tools.file:Glob');
    assert.strictEqual(convertKimiToolName('Grep'), 'kimi_cli.tools.file:Grep');
    assert.strictEqual(convertKimiToolName('ReadMediaFile'), 'kimi_cli.tools.file:ReadMediaFile');
  });

  test('maps Bash to Shell', () => {
    assert.strictEqual(convertKimiToolName('Bash'), 'kimi_cli.tools.shell:Shell');
  });

  test('maps web tools', () => {
    assert.strictEqual(convertKimiToolName('WebSearch'), 'kimi_cli.tools.web:SearchWeb');
    assert.strictEqual(convertKimiToolName('WebFetch'), 'kimi_cli.tools.web:FetchURL');
  });

  test('maps interaction tools', () => {
    assert.strictEqual(convertKimiToolName('TodoWrite'), 'kimi_cli.tools.todo:SetTodoList');
    assert.strictEqual(convertKimiToolName('AskUserQuestion'), 'kimi_cli.tools.ask_user:AskUserQuestion');
    assert.strictEqual(convertKimiToolName('Task'), 'kimi_cli.tools.multiagent:Task');
  });

  test('returns null for MCP tools', () => {
    assert.strictEqual(convertKimiToolName('mcp__context7__search'), null);
    assert.strictEqual(convertKimiToolName('mcp__plugin_supabase_supabase__list_tables'), null);
    assert.strictEqual(convertKimiToolName('mcp__'), null);
  });

  test('returns null for unknown tools', () => {
    assert.strictEqual(convertKimiToolName('UnknownTool'), null);
    assert.strictEqual(convertKimiToolName('Agent'), null);
    assert.strictEqual(convertKimiToolName('ExitPlanMode'), null);
  });
});

// ─── convertClaudeToKimiSkill ────────────────────────────────────────────────

describe('convertClaudeToKimiSkill', () => {
  test('converts slash commands to /skill: syntax (template literal regression)', () => {
    const input = `---
name: gsd-test
description: Test skill
---

Run /gsd:execute-phase to proceed, then /gsd:verify-work.`;

    const result = convertClaudeToKimiSkill(input, 'gsd-test');
    assert.ok(result.includes('/skill:gsd-execute-phase'), 'converts execute-phase');
    assert.ok(result.includes('/skill:gsd-verify-work'), 'converts verify-work');
    assert.ok(!result.includes('/gsd:execute-phase'), 'removes original slash command');
    // Regression: template literal must interpolate — not emit raw backtick string
    assert.ok(!result.includes('`/skill:gsd-'), 'no backtick-wrapped syntax');
    assert.ok(!result.includes('${cmd}'), 'no un-interpolated ${cmd}');
  });

  test('rewrites frontmatter to name + description only', () => {
    const input = `---
name: gsd-plan-phase
description: Create a detailed plan
tools: Read, Write, Bash
color: purple
---

Body content here.`;

    const result = convertClaudeToKimiSkill(input, 'gsd-plan-phase');
    assert.ok(result.startsWith('---\n'), 'starts with frontmatter delimiter');
    assert.ok(result.includes('name: gsd-plan-phase'), 'has skill name');
    assert.ok(result.includes('description: Create a detailed plan'), 'has description');
    assert.ok(!result.includes('tools:'), 'drops tools from frontmatter');
    assert.ok(!result.includes('color:'), 'drops color from frontmatter');
  });

  test('preserves body content after frontmatter', () => {
    const input = `---
name: gsd-debug
description: Debug session
---

## Instructions

Do the thing.`;

    const result = convertClaudeToKimiSkill(input, 'gsd-debug');
    assert.ok(result.includes('## Instructions'), 'body preserved');
    assert.ok(result.includes('Do the thing.'), 'body text preserved');
  });

  test('converts Claude tool references in body text', () => {
    const input = `---
name: gsd-test
description: Test
---

Use Read("file") and Write("file") and Bash("cmd").
Also TodoWrite("todos") and WebSearch("query") and WebFetch("url").
Edit("file") too.`;

    const result = convertClaudeToKimiSkill(input, 'gsd-test');
    assert.ok(result.includes('ReadFile('), 'Read → ReadFile');
    assert.ok(result.includes('WriteFile('), 'Write → WriteFile');
    assert.ok(result.includes('StrReplaceFile('), 'Edit → StrReplaceFile');
    assert.ok(result.includes('Shell('), 'Bash → Shell');
    assert.ok(result.includes('SetTodoList('), 'TodoWrite → SetTodoList');
    assert.ok(result.includes('SearchWeb('), 'WebSearch → SearchWeb');
    assert.ok(result.includes('FetchURL('), 'WebFetch → FetchURL');
  });

  test('works with content that has no frontmatter', () => {
    const input = 'Simple content with /gsd:help slash command.';
    const result = convertClaudeToKimiSkill(input, 'gsd-help');
    assert.ok(result.includes('/skill:gsd-help'), 'converts slash command');
    assert.ok(result.includes('name: gsd-help'), 'adds frontmatter with skill name');
  });

  test('preserves description when frontmatter has none', () => {
    const input = `---
name: gsd-minimal
---

Minimal skill content.`;

    const result = convertClaudeToKimiSkill(input, 'gsd-minimal');
    assert.ok(result.includes('name: gsd-minimal'), 'has name');
    assert.ok(!result.includes('description:'), 'no description field when absent');
  });
});

// ─── convertClaudeToKimiAgent ────────────────────────────────────────────────

describe('convertClaudeToKimiAgent', () => {
  const sampleAgent = `---
name: gsd-executor
description: Executes GSD plans with atomic commits
tools: Read, Write, Edit, Bash, Grep, Glob
color: yellow
---

<role>
You are a GSD plan executor.
</role>

Execute the plan step by step.`;

  test('returns null for content without frontmatter', () => {
    assert.strictEqual(convertClaudeToKimiAgent('Just plain content'), null);
    assert.strictEqual(convertClaudeToKimiAgent(''), null);
  });

  test('returns object with yaml and systemPrompt properties', () => {
    const result = convertClaudeToKimiAgent(sampleAgent);
    assert.ok(result !== null, 'returns non-null');
    assert.ok(typeof result.yaml === 'string', 'has yaml string');
    assert.ok(typeof result.systemPrompt === 'string', 'has systemPrompt string');
  });

  test('yaml starts with version: 1', () => {
    const result = convertClaudeToKimiAgent(sampleAgent);
    assert.ok(result.yaml.startsWith('version: 1\n'), 'yaml starts with version: 1');
  });

  test('yaml includes agent name and description', () => {
    const result = convertClaudeToKimiAgent(sampleAgent);
    assert.ok(result.yaml.includes('name: gsd-executor'), 'has name');
    assert.ok(result.yaml.includes('description: Executes GSD plans with atomic commits'), 'has description');
  });

  test('yaml maps tools to kimi module paths', () => {
    const result = convertClaudeToKimiAgent(sampleAgent);
    assert.ok(result.yaml.includes('"kimi_cli.tools.file:ReadFile"'), 'maps Read');
    assert.ok(result.yaml.includes('"kimi_cli.tools.file:WriteFile"'), 'maps Write');
    assert.ok(result.yaml.includes('"kimi_cli.tools.file:StrReplaceFile"'), 'maps Edit');
    assert.ok(result.yaml.includes('"kimi_cli.tools.shell:Shell"'), 'maps Bash');
    assert.ok(result.yaml.includes('"kimi_cli.tools.file:Grep"'), 'maps Grep');
    assert.ok(result.yaml.includes('"kimi_cli.tools.file:Glob"'), 'maps Glob');
  });

  test('yaml excludes MCP tools from tools list', () => {
    const agentWithMcp = `---
name: gsd-researcher
description: Research agent
tools: Read, Bash, mcp__context7__search, mcp__supabase__query
---

Researcher body.`;
    const result = convertClaudeToKimiAgent(agentWithMcp);
    assert.ok(!result.yaml.includes('mcp__'), 'excludes MCP tools');
    assert.ok(result.yaml.includes('"kimi_cli.tools.file:ReadFile"'), 'keeps valid tools');
  });

  test('yaml sets system_prompt_path to ./<name>.md', () => {
    const result = convertClaudeToKimiAgent(sampleAgent);
    assert.ok(result.yaml.includes('system_prompt_path: ./gsd-executor.md'), 'has correct system_prompt_path');
  });

  test('systemPrompt contains agent body content', () => {
    const result = convertClaudeToKimiAgent(sampleAgent);
    assert.ok(result.systemPrompt.includes('<role>'), 'body in systemPrompt');
    assert.ok(result.systemPrompt.includes('Execute the plan step by step.'), 'body text in systemPrompt');
  });

  test('escapes ${VAR} patterns in systemPrompt', () => {
    const agentWithVars = `---
name: gsd-test
description: Test
tools: Read
---

The value is \${SOME_VAR} and also \${OTHER}.`;

    const result = convertClaudeToKimiAgent(agentWithVars);
    assert.ok(result.systemPrompt.includes('$SOME_VAR'), 'escapes ${SOME_VAR} to $SOME_VAR');
    assert.ok(result.systemPrompt.includes('$OTHER'), 'escapes ${OTHER} to $OTHER');
    assert.ok(!result.systemPrompt.includes('${'), 'no remaining ${} patterns');
  });

  test('handles agent with no tools field', () => {
    const noTools = `---
name: gsd-minimal
description: Minimal agent
---

Body only.`;
    const result = convertClaudeToKimiAgent(noTools);
    assert.ok(result !== null, 'returns non-null');
    assert.ok(!result.yaml.includes('tools:'), 'no tools section when none provided');
  });
});

// ─── Integration: copyCommandsAsKimiSkills ───────────────────────────────────

describe('copyCommandsAsKimiSkills (integration)', () => {
  let tmpSkillsDir;
  const commandsSrc = path.join(__dirname, '..', 'commands');
  const hasCommands = fs.existsSync(commandsSrc);

  beforeEach(() => {
    tmpSkillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-kimi-skills-'));
  });

  afterEach(() => {
    fs.rmSync(tmpSkillsDir, { recursive: true, force: true });
  });

  (hasCommands ? test : test.skip)('installs skills to XDG-style skills dir', () => {
    const { copyCommandsAsKimiSkills } = require('../bin/install.js');
    copyCommandsAsKimiSkills(commandsSrc, tmpSkillsDir, 'gsd', 'gsd', 'kimi');

    const skillDirs = fs.readdirSync(tmpSkillsDir);
    assert.ok(skillDirs.length > 0, 'at least one skill installed');

    // Each skill is in its own gsd-<name>/ directory
    for (const dir of skillDirs) {
      assert.ok(dir.startsWith('gsd-'), `skill dir starts with gsd-: ${dir}`);
      const skillFile = path.join(tmpSkillsDir, dir, 'SKILL.md');
      assert.ok(fs.existsSync(skillFile), `SKILL.md exists in ${dir}`);
    }
  });

  (hasCommands ? test : test.skip)('each SKILL.md uses /skill: syntax (not /gsd:)', () => {
    const { copyCommandsAsKimiSkills } = require('../bin/install.js');
    copyCommandsAsKimiSkills(commandsSrc, tmpSkillsDir, 'gsd', 'gsd', 'kimi');

    const skillDirs = fs.readdirSync(tmpSkillsDir);
    for (const dir of skillDirs) {
      const skillFile = path.join(tmpSkillsDir, dir, 'SKILL.md');
      const content = fs.readFileSync(skillFile, 'utf8');
      assert.ok(!content.includes('/gsd:'), `no /gsd: in ${dir}/SKILL.md`);
    }
  });

  (hasCommands ? test : test.skip)('SKILL.md has kimi-style frontmatter', () => {
    const { copyCommandsAsKimiSkills } = require('../bin/install.js');
    copyCommandsAsKimiSkills(commandsSrc, tmpSkillsDir, 'gsd', 'gsd', 'kimi');

    const skillDirs = fs.readdirSync(tmpSkillsDir);
    const helpDir = skillDirs.find(d => d === 'gsd-help');
    if (helpDir) {
      const content = fs.readFileSync(path.join(tmpSkillsDir, helpDir, 'SKILL.md'), 'utf8');
      assert.ok(content.startsWith('---\n'), 'starts with frontmatter');
      assert.ok(content.includes('name: gsd-help'), 'has skill name in frontmatter');
      assert.ok(!content.includes('tools:'), 'no tools key in frontmatter');
      assert.ok(!content.includes('color:'), 'no color key in frontmatter');
    }
  });
});
