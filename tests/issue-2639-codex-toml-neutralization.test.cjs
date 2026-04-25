/**
 * Regression: issue #2639 — Codex install generated agent TOMLs with stale
 * Claude-specific references (CLAUDE.md, .claude/skills/, .claudeignore).
 *
 * RCA: `installCodexConfig()` applied a narrow path-only regex pass before
 * calling `generateCodexAgentToml()`, bypassing the full
 * `convertClaudeToCodexMarkdown()` + `neutralizeAgentReferences(..., 'AGENTS.md')`
 * pipeline used on the .md emit path. Fix routes the TOML path through the
 * same pipeline and extends the pipeline to cover bare `.claude/skills/`,
 * `.claude/commands/`, `.claude/agents/`, and `.claudeignore`.
 */

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { installCodexConfig } = require('../bin/install.js');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2639-'));
}

function writeAgentFixture(agentsSrc, name, body) {
  const content = `---
name: ${name}
description: Test agent for #2639
---

${body}
`;
  fs.writeFileSync(path.join(agentsSrc, `${name}.md`), content);
}

describe('#2639 — Codex TOML emit routes through full neutralization pipeline', () => {
  let tmpDir;
  let agentsSrc;
  let targetDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
    agentsSrc = path.join(tmpDir, 'agents');
    targetDir = path.join(tmpDir, 'codex');
    fs.mkdirSync(agentsSrc, { recursive: true });
    fs.mkdirSync(targetDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('strips CLAUDE.md, .claude/skills/, .claude/commands/, .claude/agents/, and .claudeignore from emitted TOML', () => {
    writeAgentFixture(agentsSrc, 'gsd-code-reviewer', [
      '**Project instructions:** Read `./CLAUDE.md` if it exists.',
      '',
      '**CLAUDE.md enforcement:** If `./CLAUDE.md` exists, treat it as hard constraints.',
      '',
      '**Project skills:** Check `.claude/skills/` or `.agents/skills/` directory.',
      '',
      'Also check `.claude/commands/` and `.claude/agents/` for definitions.',
      '',
      'DO respect .gitignore and .claudeignore. Do not review ignored files.',
      '',
      'Claude will refuse the task if policy violated.',
    ].join('\n'));

    installCodexConfig(targetDir, agentsSrc);

    const tomlPath = path.join(targetDir, 'agents', 'gsd-code-reviewer.toml');
    assert.ok(fs.existsSync(tomlPath), 'per-agent TOML written');
    const toml = fs.readFileSync(tomlPath, 'utf8');

    assert.ok(!toml.includes('CLAUDE.md'), 'no CLAUDE.md references remain in TOML');
    assert.ok(!toml.includes('.claude/skills/'), 'no .claude/skills/ references remain');
    assert.ok(!toml.includes('.claude/commands/'), 'no .claude/commands/ references remain');
    assert.ok(!toml.includes('.claude/agents/'), 'no .claude/agents/ references remain');
    assert.ok(!toml.includes('.claudeignore'), 'no .claudeignore references remain');

    assert.ok(toml.includes('AGENTS.md'), 'AGENTS.md substituted for CLAUDE.md');
    assert.ok(
      toml.includes('.codex/skills/') || toml.includes('.agents/skills/'),
      'skills path neutralized'
    );

    // Standalone "Claude" agent-name references replaced
    assert.ok(!/\bClaude\b(?! Code| Opus| Sonnet| Haiku| native| based)/.test(toml),
      'standalone Claude agent-name references replaced');
  });

  test('preserves Claude product/model names (Claude Code, Claude Opus) in TOML', () => {
    writeAgentFixture(agentsSrc, 'gsd-executor', [
      'This agent runs under Claude Code with the Claude Opus 4 model.',
      'Do not confuse with Claude Sonnet or Claude Haiku.',
    ].join('\n'));

    installCodexConfig(targetDir, agentsSrc);
    const toml = fs.readFileSync(path.join(targetDir, 'agents', 'gsd-executor.toml'), 'utf8');

    assert.ok(toml.includes('Claude Code'), 'Claude Code product name preserved');
    assert.ok(toml.includes('Claude Opus'), 'Claude Opus model name preserved');
  });
});
