'use strict';

// allow-test-rule: source-text-is-the-product

process.env.GSD_TEST_MODE = '1';

const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  convertClaudeCommandToCopilotSkill,
  convertClaudeCommandToClaudeSkill,
  convertClaudeToGeminiMarkdown,
  copyCommandsAsClaudeSkills,
  localizeCommandDescription,
} = require('../bin/install.js');

const ROOT = path.join(__dirname, '..');
const EXECUTE_PHASE = path.join(ROOT, 'commands', 'gsd', 'execute-phase.md');
const ENGLISH_DESCRIPTION = 'Execute all plans in a phase with wave-based parallelization';
const PT_BR_DESCRIPTION = 'Executa todos os planos de uma fase com paralelização baseada em ondas';

function readExecutePhase() {
  return fs.readFileSync(EXECUTE_PHASE, 'utf8');
}

function withPtBrDescriptions(fn) {
  const previous = process.env.GSD_COMMAND_DESCRIPTION_LOCALE;
  process.env.GSD_COMMAND_DESCRIPTION_LOCALE = 'pt-BR';
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.GSD_COMMAND_DESCRIPTION_LOCALE;
    else process.env.GSD_COMMAND_DESCRIPTION_LOCALE = previous;
  }
}

function parseGeminiCommandToml(toml) {
  const result = {};
  for (const rawLine of toml.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([a-z_]+)\s*=\s*(.*)$/);
    if (!match) throw new Error(`Unparseable TOML line: ${rawLine}`);
    const value = match[2].trim();
    if (!value.startsWith('"')) {
      throw new Error(`Expected JSON-quoted TOML value: ${rawLine}`);
    }
    result[match[1]] = JSON.parse(value);
  }
  return result;
}

afterEach(() => {
  delete process.env.GSD_COMMAND_DESCRIPTION_LOCALE;
  delete process.env.GSD_LOCALE;
});

describe('command description localization', () => {
  test('source command descriptions remain canonical English by default', () => {
    const source = readExecutePhase();
    assert.match(source, new RegExp(`^description: ${ENGLISH_DESCRIPTION}$`, 'm'));
    assert.doesNotMatch(source, new RegExp(PT_BR_DESCRIPTION));
    assert.strictEqual(localizeCommandDescription(source, 'execute-phase'), source);
  });

  test('pt-BR localization rewrites only the frontmatter description', () => {
    withPtBrDescriptions(() => {
      const localized = localizeCommandDescription(readExecutePhase(), 'execute-phase');
      assert.match(localized, new RegExp(`^description: "${PT_BR_DESCRIPTION}"$`, 'm'));
      assert.match(localized, /^Execute all plans in a phase using wave-based parallel execution\.$/m);
    });
  });

  test('Claude skill conversion receives localized descriptions without translating the prompt', () => {
    withPtBrDescriptions(() => {
      const localized = localizeCommandDescription(readExecutePhase(), 'execute-phase');
      const skill = convertClaudeCommandToClaudeSkill(localized, 'gsd-execute-phase');
      assert.match(skill, new RegExp(`^description: "${PT_BR_DESCRIPTION}"$`, 'm'));
      assert.match(skill, /^Execute all plans in a phase using wave-based parallel execution\.$/m);
    });
  });

  test('Copilot skill conversion receives localized descriptions', () => {
    withPtBrDescriptions(() => {
      const localized = localizeCommandDescription(readExecutePhase(), 'execute-phase');
      const skill = convertClaudeCommandToCopilotSkill(localized, 'gsd-execute-phase', false);
      assert.match(skill, new RegExp(`^description: "${PT_BR_DESCRIPTION}"$`, 'm'));
    });
  });

  test('Gemini command TOML receives localized descriptions', () => {
    withPtBrDescriptions(() => {
      const localized = localizeCommandDescription(readExecutePhase(), 'execute-phase');
      const parsed = parseGeminiCommandToml(convertClaudeToGeminiMarkdown(localized, { isCommand: true }));
      assert.strictEqual(parsed.description, PT_BR_DESCRIPTION);
      assert.match(parsed.prompt, /^Execute all plans in a phase using wave-based parallel execution\./m);
    });
  });

  test('copyCommandsAsClaudeSkills localizes final installed skill files', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-pt-br-skills-'));
    try {
      withPtBrDescriptions(() => {
        copyCommandsAsClaudeSkills(
          path.join(ROOT, 'commands', 'gsd'),
          tmp,
          'gsd',
          '~/.claude/',
          'claude',
          true,
        );
      });
      const installed = fs.readFileSync(path.join(tmp, 'gsd-execute-phase', 'SKILL.md'), 'utf8');
      assert.match(installed, new RegExp(`^description: "${PT_BR_DESCRIPTION}"$`, 'm'));
    } finally {
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  });
});
