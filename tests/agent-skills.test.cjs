/**
 * GSD Tools Tests - Agent Skills Injection
 *
 * CLI integration tests for the `agent-skills` command that reads
 * `agent_skills` from .planning/config.json and returns a formatted
 * skills block for injection into Task() prompts.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── helpers ──────────────────────────────────────────────────────────────────

function writeConfig(tmpDir, obj) {
  const configPath = path.join(tmpDir, '.planning', 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(obj, null, 2), 'utf-8');
}

function readConfig(tmpDir) {
  const configPath = path.join(tmpDir, '.planning', 'config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// ─── agent-skills command ────────────────────────────────────────────────────

describe('agent-skills command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns empty when no config exists', () => {
    // No config.json at all
    const result = runGsdTools(['agent-skills', 'gsd-executor'], tmpDir, { HOME: tmpDir, USERPROFILE: tmpDir });
    // Should succeed with empty output (no skills configured)
    assert.strictEqual(result.output, '');
  });

  test('returns empty when config has no agent_skills section', () => {
    writeConfig(tmpDir, { model_profile: 'balanced' });
    const result = runGsdTools(['agent-skills', 'gsd-executor'], tmpDir, { HOME: tmpDir, USERPROFILE: tmpDir });
    assert.strictEqual(result.output, '');
  });

  test('returns empty for unconfigured agent type', () => {
    writeConfig(tmpDir, {
      agent_skills: {
        'gsd-executor': ['skills/test-skill'],
      },
    });
    const result = runGsdTools(['agent-skills', 'gsd-planner'], tmpDir, { HOME: tmpDir, USERPROFILE: tmpDir });
    assert.strictEqual(result.output, '');
  });

  test('returns formatted block for configured agent with array of paths', () => {
    // Create the skill directories with SKILL.md files
    const skillDir = path.join(tmpDir, 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill\n');

    writeConfig(tmpDir, {
      agent_skills: {
        'gsd-executor': ['skills/test-skill'],
      },
    });

    const result = runGsdTools(['agent-skills', 'gsd-executor'], tmpDir, { HOME: tmpDir, USERPROFILE: tmpDir });
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(result.output.includes('<agent_skills>'), 'Should contain <agent_skills> tag');
    assert.ok(result.output.includes('</agent_skills>'), 'Should contain closing tag');
    assert.ok(result.output.includes('skills/test-skill/SKILL.md'), 'Should contain skill path');
  });

  test('returns formatted block for configured agent with single string path', () => {
    const skillDir = path.join(tmpDir, 'skills', 'my-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# My Skill\n');

    writeConfig(tmpDir, {
      agent_skills: {
        'gsd-executor': 'skills/my-skill',
      },
    });

    const result = runGsdTools(['agent-skills', 'gsd-executor'], tmpDir, { HOME: tmpDir, USERPROFILE: tmpDir });
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(result.output.includes('skills/my-skill/SKILL.md'), 'Should contain skill path');
  });

  test('handles multiple skill paths', () => {
    const skill1 = path.join(tmpDir, 'skills', 'skill-a');
    const skill2 = path.join(tmpDir, 'skills', 'skill-b');
    fs.mkdirSync(skill1, { recursive: true });
    fs.mkdirSync(skill2, { recursive: true });
    fs.writeFileSync(path.join(skill1, 'SKILL.md'), '# Skill A\n');
    fs.writeFileSync(path.join(skill2, 'SKILL.md'), '# Skill B\n');

    writeConfig(tmpDir, {
      agent_skills: {
        'gsd-executor': ['skills/skill-a', 'skills/skill-b'],
      },
    });

    const result = runGsdTools(['agent-skills', 'gsd-executor'], tmpDir, { HOME: tmpDir, USERPROFILE: tmpDir });
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(result.output.includes('skills/skill-a/SKILL.md'), 'Should contain first skill');
    assert.ok(result.output.includes('skills/skill-b/SKILL.md'), 'Should contain second skill');
  });

  test('warns for nonexistent skill path but does not error', () => {
    writeConfig(tmpDir, {
      agent_skills: {
        'gsd-executor': ['skills/nonexistent'],
      },
    });

    const result = runGsdTools(['agent-skills', 'gsd-executor'], tmpDir, { HOME: tmpDir, USERPROFILE: tmpDir });
    // Should not crash — returns empty output (the missing skill is skipped)
    assert.ok(result.success, 'Command should succeed even with missing skill paths');
    // Should not include the missing skill in the output
    assert.ok(!result.output.includes('skills/nonexistent/SKILL.md'),
      'Should not include nonexistent skill in output');
  });

  test('validates path safety — rejects traversal attempts', () => {
    writeConfig(tmpDir, {
      agent_skills: {
        'gsd-executor': ['../../../etc/passwd'],
      },
    });

    const result = runGsdTools(['agent-skills', 'gsd-executor'], tmpDir, { HOME: tmpDir, USERPROFILE: tmpDir });
    // Should not include traversal path in output
    assert.ok(!result.output.includes('/etc/passwd'), 'Should not include traversal path');
  });

  test('returns empty when no agent type argument provided', () => {
    const result = runGsdTools(['agent-skills'], tmpDir, { HOME: tmpDir, USERPROFILE: tmpDir });
    // Should succeed with empty output — no agent type means no skills to return
    assert.ok(result.success, 'Command should succeed');
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed, '', 'Should return empty string');
  });
});

// ─── config-ensure-section includes agent_skills ────────────────────────────

describe('config-ensure-section with agent_skills', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('new configs include agent_skills key', () => {
    const result = runGsdTools('config-ensure-section', tmpDir, { HOME: tmpDir, USERPROFILE: tmpDir });
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.ok('agent_skills' in config, 'config should have agent_skills key');
    assert.deepStrictEqual(config.agent_skills, {}, 'agent_skills should default to empty object');
  });
});

// ─── config-set agent_skills ─────────────────────────────────────────────────

describe('config-set agent_skills', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Ensure config exists first
    runGsdTools('config-ensure-section', tmpDir, { HOME: tmpDir, USERPROFILE: tmpDir });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('can set agent_skills via dot notation', () => {
    const result = runGsdTools(
      ['config-set', 'agent_skills.gsd-executor', '["skills/my-skill"]'],
      tmpDir,
      { HOME: tmpDir, USERPROFILE: tmpDir }
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.deepStrictEqual(
      config.agent_skills['gsd-executor'],
      ['skills/my-skill'],
      'Should store array of skill paths'
    );
  });
});

// ─── global: prefix support (#1992) ──────────────────────────────────────────

describe('agent-skills global: prefix', () => {
  let tmpDir;
  let fakeHome;
  let globalSkillsDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create a fake HOME with ~/.claude/skills/ structure
    fakeHome = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-1992-home-'));
    globalSkillsDir = path.join(fakeHome, '.claude', 'skills');
    fs.mkdirSync(globalSkillsDir, { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
    fs.rmSync(fakeHome, { recursive: true, force: true });
  });

  function createGlobalSkill(name) {
    const skillDir = path.join(globalSkillsDir, name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `# ${name}\nGlobal skill content.\n`);
    return skillDir;
  }

  test('global:valid-skill resolves to $HOME/.claude/skills/valid-skill/SKILL.md', () => {
    createGlobalSkill('valid-skill');
    writeConfig(tmpDir, {
      agent_skills: { 'gsd-executor': ['global:valid-skill'] },
    });

    const result = runGsdTools(['agent-skills', 'gsd-executor'], tmpDir, { HOME: fakeHome, USERPROFILE: fakeHome });
    assert.ok(result.output.includes('valid-skill/SKILL.md'), `should reference the global skill: ${result.output}`);
    assert.ok(result.output.includes('<agent_skills>'), 'should emit agent_skills block');
  });

  test('global:invalid!name is rejected by regex and skipped', () => {
    writeConfig(tmpDir, {
      agent_skills: { 'gsd-executor': ['global:invalid!name'] },
    });

    const result = runGsdTools(['agent-skills', 'gsd-executor'], tmpDir, { HOME: fakeHome, USERPROFILE: fakeHome });
    // No valid skills → empty output, command succeeds
    assert.strictEqual(result.output, '', 'should skip invalid name without crashing');
  });

  test('global:missing-skill is skipped when directory is absent', () => {
    // Do NOT create the skill directory
    writeConfig(tmpDir, {
      agent_skills: { 'gsd-executor': ['global:missing-skill'] },
    });

    const result = runGsdTools(['agent-skills', 'gsd-executor'], tmpDir, { HOME: fakeHome, USERPROFILE: fakeHome });
    assert.strictEqual(result.output, '', 'should skip missing skill gracefully');
  });

  test('mix of global: and project-relative paths both resolve correctly', () => {
    createGlobalSkill('shadcn');

    // Create a project-relative skill
    const projectSkillDir = path.join(tmpDir, 'skills', 'local-skill');
    fs.mkdirSync(projectSkillDir, { recursive: true });
    fs.writeFileSync(path.join(projectSkillDir, 'SKILL.md'), '# local\n');

    writeConfig(tmpDir, {
      agent_skills: { 'gsd-executor': ['global:shadcn', 'skills/local-skill'] },
    });

    const result = runGsdTools(['agent-skills', 'gsd-executor'], tmpDir, { HOME: fakeHome, USERPROFILE: fakeHome });
    assert.ok(result.output.includes('shadcn/SKILL.md'), 'should include global shadcn');
    assert.ok(result.output.includes('skills/local-skill/SKILL.md'), 'should include project-relative skill');
  });

  test('global: with empty name produces clear warning and skips', () => {
    writeConfig(tmpDir, {
      agent_skills: { 'gsd-executor': ['global:'] },
    });

    const result = runGsdTools(['agent-skills', 'gsd-executor'], tmpDir, { HOME: fakeHome, USERPROFILE: fakeHome });
    assert.strictEqual(result.output, '', 'should skip empty global: prefix');
    // The warning goes to stderr — cannot assert on it through runGsdTools's output field,
    // but the command must not crash and must return empty.
  });
});
