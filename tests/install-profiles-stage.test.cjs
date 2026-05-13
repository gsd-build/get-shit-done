'use strict';
/**
 * Tests for stageSkillsForProfile and stageAgentsForProfile.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  stageSkillsForProfile,
  stageAgentsForProfile,
  cleanupStagedSkills,
  resolveProfile,
  loadSkillsManifest,
} = require('../get-shit-done/bin/lib/install-profiles.cjs');

const REAL_COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');
const REAL_AGENTS_DIR = path.join(__dirname, '..', 'agents');

function createFixtureSkillsDir() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-profile-'));
  for (const name of ['plan-phase', 'execute-phase', 'autonomous', 'progress', 'help', 'phase']) {
    fs.writeFileSync(path.join(tmp, `${name}.md`), `# ${name}\n`);
  }
  return tmp;
}

function createFixtureAgentsDir() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-agents-profile-'));
  for (const name of ['gsd-planner', 'gsd-executor', 'gsd-code-reviewer']) {
    fs.writeFileSync(path.join(tmp, `${name}.md`), `# ${name}\n`);
  }
  return tmp;
}

describe('stageSkillsForProfile', () => {
  test('full profile (skills === "*") returns srcDir unchanged', () => {
    const src = createFixtureSkillsDir();
    try {
      const result = stageSkillsForProfile(src, { skills: '*', agents: new Set() });
      assert.strictEqual(result, src);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  });

  test('profile with Set copies only member files', () => {
    const src = createFixtureSkillsDir();
    let staged;
    try {
      const skills = new Set(['plan-phase', 'help', 'phase']);
      staged = stageSkillsForProfile(src, { skills, agents: new Set() });
      assert.notStrictEqual(staged, src);
      const files = fs.readdirSync(staged).sort();
      assert.deepStrictEqual(files, ['help.md', 'phase.md', 'plan-phase.md']);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      if (staged) cleanupStagedSkills();
    }
  });

  test('preserves file content byte-for-byte', () => {
    const src = createFixtureSkillsDir();
    const content = '# plan-phase special content\n\nsome body\n';
    fs.writeFileSync(path.join(src, 'plan-phase.md'), content);
    let staged;
    try {
      const skills = new Set(['plan-phase']);
      staged = stageSkillsForProfile(src, { skills, agents: new Set() });
      const copied = fs.readFileSync(path.join(staged, 'plan-phase.md'), 'utf8');
      assert.strictEqual(copied, content);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      if (staged) cleanupStagedSkills();
    }
  });

  test('non-existent srcDir returns srcDir unchanged', () => {
    const ghost = path.join(os.tmpdir(), 'gsd-no-exist-' + Date.now());
    const result = stageSkillsForProfile(ghost, { skills: new Set(['help']), agents: new Set() });
    assert.strictEqual(result, ghost);
  });

  test('empty skills Set produces empty staged dir', () => {
    const src = createFixtureSkillsDir();
    let staged;
    try {
      staged = stageSkillsForProfile(src, { skills: new Set(), agents: new Set() });
      const files = fs.readdirSync(staged);
      assert.deepStrictEqual(files, []);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      if (staged) cleanupStagedSkills();
    }
  });
});

describe('stageAgentsForProfile', () => {
  test('full profile (skills === "*") returns srcDir unchanged', () => {
    const src = createFixtureAgentsDir();
    try {
      const result = stageAgentsForProfile(src, { skills: '*', agents: new Set() });
      assert.strictEqual(result, src);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  });

  test('non-full profile with empty agents Set produces empty staged dir', () => {
    const src = createFixtureAgentsDir();
    let staged;
    try {
      staged = stageAgentsForProfile(src, { skills: new Set(['help']), agents: new Set() });
      const files = fs.readdirSync(staged);
      assert.deepStrictEqual(files, [], 'no agents for non-full profile by default');
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      if (staged) cleanupStagedSkills();
    }
  });

  test('non-full profile with agents Set copies only member agent files', () => {
    const src = createFixtureAgentsDir();
    let staged;
    try {
      const agents = new Set(['gsd-planner']);
      staged = stageAgentsForProfile(src, { skills: new Set(['plan-phase']), agents });
      const files = fs.readdirSync(staged).sort();
      assert.deepStrictEqual(files, ['gsd-planner.md']);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      if (staged) cleanupStagedSkills();
    }
  });

  test('non-existent srcAgentsDir returns srcAgentsDir unchanged', () => {
    const ghost = path.join(os.tmpdir(), 'gsd-agents-no-exist-' + Date.now());
    const result = stageAgentsForProfile(ghost, { skills: new Set(), agents: new Set() });
    assert.strictEqual(result, ghost);
  });

  test('standard profile — stageAgentsForProfile copies exactly the agents in resolvedProfile.agents', () => {
    // Uses the real agents dir and commands dir
    if (!fs.existsSync(REAL_AGENTS_DIR) || !fs.existsSync(REAL_COMMANDS_DIR)) return;
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const resolved = resolveProfile({ modes: ['standard'], manifest });
    assert.ok(resolved.agents instanceof Set && resolved.agents.size > 0,
      'standard profile must have >0 agents (plan-phase calls gsd-planner etc)');
    let staged;
    try {
      staged = stageAgentsForProfile(REAL_AGENTS_DIR, resolved);
      const stagedFiles = new Set(
        fs.readdirSync(staged).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3))
      );
      // Every file staged must be in resolved.agents
      for (const stem of stagedFiles) {
        assert.ok(resolved.agents.has(stem), `staged agent ${stem} not in resolved.agents`);
      }
      // Every agent in resolved.agents that exists in the real dir must be staged
      for (const agentStem of resolved.agents) {
        const exists = fs.existsSync(path.join(REAL_AGENTS_DIR, `${agentStem}.md`));
        if (exists) {
          assert.ok(stagedFiles.has(agentStem), `resolved agent ${agentStem} missing from staged dir`);
        }
      }
    } finally {
      if (staged) cleanupStagedSkills();
    }
  });

  test('full profile staging returns real agents dir unchanged', () => {
    if (!fs.existsSync(REAL_AGENTS_DIR)) return;
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const resolved = resolveProfile({ modes: ['full'], manifest });
    const result = stageAgentsForProfile(REAL_AGENTS_DIR, resolved);
    assert.strictEqual(result, REAL_AGENTS_DIR);
  });
});
