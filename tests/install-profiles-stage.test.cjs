'use strict';
/**
 * Tests for stageSkillsForProfile and stageAgentsForProfile.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  stageSkillsForProfile,
  stageAgentsForProfile,
  stageSkillsForRuntimeAsSkills,
  cleanupStagedSkills,
  resolveProfile,
  loadSkillsManifest,
  STAGED_DIRS,
} = require('../get-shit-done/bin/lib/install-profiles.cjs');
const { createTempDir, cleanup } = require('./helpers.cjs');

const REAL_COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');
const REAL_AGENTS_DIR = path.join(__dirname, '..', 'agents');

function createFixtureSkillsDir() {
  const tmp = createTempDir('gsd-stage-profile-');
  for (const name of ['plan-phase', 'execute-phase', 'autonomous', 'progress', 'help', 'phase']) {
    fs.writeFileSync(path.join(tmp, `${name}.md`), `# ${name}\n`);
  }
  return tmp;
}

function createFixtureAgentsDir() {
  const tmp = createTempDir('gsd-agents-profile-');
  for (const name of ['gsd-planner', 'gsd-executor', 'gsd-code-reviewer']) {
    fs.writeFileSync(path.join(tmp, `${name}.md`), `# ${name}\n`);
  }
  return tmp;
}

describe('stageSkillsForRuntimeAsSkills', () => {
  test('is exported as a function', () => {
    assert.strictEqual(typeof stageSkillsForRuntimeAsSkills, 'function');
  });

  test('registers stagedDir in STAGED_DIRS after staging', (t) => {
    const src = createTempDir('gsd-rta-src-');
    let stagedDir;
    t.after(() => {
      cleanup(src);
      if (stagedDir) cleanupStagedSkills();
    });
    fs.writeFileSync(path.join(src, 'alpha.md'), '# alpha\n');
    cleanupStagedSkills();
    const converter = (content, _skillName) => content;
    stagedDir = stageSkillsForRuntimeAsSkills(src, { skills: '*' }, converter, 'gsd-');
    assert.ok(STAGED_DIRS.has(stagedDir), 'stagedDir must be in STAGED_DIRS');
  });

  test('non-existent srcCommandsDir returns srcCommandsDir unchanged', () => {
    const ghost = path.join(require('os').tmpdir(), 'gsd-rta-no-exist-' + Date.now());
    const converter = (content, _skillName) => content;
    const result = stageSkillsForRuntimeAsSkills(ghost, { skills: '*' }, converter, 'gsd-');
    assert.strictEqual(result, ghost);
  });

  test('empty prefix produces <stem>/SKILL.md without prefix segment', (t) => {
    const src = createTempDir('gsd-rta-src-');
    let stagedDir;
    t.after(() => {
      cleanup(src);
      if (stagedDir) cleanupStagedSkills();
    });
    fs.writeFileSync(path.join(src, 'phase.md'), '# phase\n');
    const converter = (content, _skillName) => content;
    stagedDir = stageSkillsForRuntimeAsSkills(src, { skills: '*' }, converter, '');
    const entries = fs.readdirSync(stagedDir);
    assert.deepStrictEqual(entries, ['phase']);
    const content = fs.readFileSync(path.join(stagedDir, 'phase', 'SKILL.md'), 'utf8');
    assert.strictEqual(content, '# phase\n');
  });

  test('converter is called with (content, skillName) for each kept skill', (t) => {
    const src = createTempDir('gsd-rta-src-');
    let stagedDir;
    t.after(() => {
      cleanup(src);
      if (stagedDir) cleanupStagedSkills();
    });
    fs.writeFileSync(path.join(src, 'alpha.md'), '# alpha\n');
    fs.writeFileSync(path.join(src, 'beta.md'), '# beta\n');
    const calls = [];
    const converter = (content, skillName) => {
      calls.push([content, skillName]);
      return content;
    };
    stagedDir = stageSkillsForRuntimeAsSkills(src, { skills: '*' }, converter, 'x-');
    assert.strictEqual(calls.length, 2);
    const callMap = Object.fromEntries(calls.map(([c, n]) => [n, c]));
    assert.strictEqual(callMap['x-alpha'], '# alpha\n');
    assert.strictEqual(callMap['x-beta'], '# beta\n');
  });

  test('skills Set filters: only matching stems land in stagedDir', (t) => {
    const src = createTempDir('gsd-rta-src-');
    let stagedDir;
    t.after(() => {
      cleanup(src);
      if (stagedDir) cleanupStagedSkills();
    });
    for (const name of ['alpha', 'beta', 'phase']) {
      fs.writeFileSync(path.join(src, `${name}.md`), `# ${name}\n`);
    }
    const converter = (content, _skillName) => content;
    stagedDir = stageSkillsForRuntimeAsSkills(src, { skills: new Set(['phase']) }, converter, 'gsd-');
    const entries = fs.readdirSync(stagedDir).sort();
    assert.deepStrictEqual(entries, ['gsd-phase']);
  });

  test('skills === "*" stages all md files as <prefix><stem>/SKILL.md', (t) => {
    const src = createTempDir('gsd-rta-src-');
    let stagedDir;
    t.after(() => {
      cleanup(src);
      if (stagedDir) cleanupStagedSkills();
    });
    for (const name of ['alpha', 'beta', 'gamma']) {
      fs.writeFileSync(path.join(src, `${name}.md`), `# ${name}\n`);
    }
    const converter = (content, _skillName) => content;
    stagedDir = stageSkillsForRuntimeAsSkills(src, { skills: '*' }, converter, 'gsd-');
    const entries = fs.readdirSync(stagedDir).sort();
    assert.deepStrictEqual(entries, ['gsd-alpha', 'gsd-beta', 'gsd-gamma']);
    for (const name of ['alpha', 'beta', 'gamma']) {
      const content = fs.readFileSync(path.join(stagedDir, `gsd-${name}`, 'SKILL.md'), 'utf8');
      assert.strictEqual(content, `# ${name}\n`);
    }
  });
});

describe('stageSkillsForProfile', () => {
  test('full profile (skills === "*") returns srcDir unchanged', (t) => {
    const src = createFixtureSkillsDir();
    t.after(() => cleanup(src));
    const result = stageSkillsForProfile(src, { skills: '*', agents: new Set() });
    assert.strictEqual(result, src);
  });

  test('profile with Set copies only member files', (t) => {
    const src = createFixtureSkillsDir();
    let staged;
    t.after(() => {
      cleanup(src);
      if (staged) cleanupStagedSkills();
    });
    const skills = new Set(['plan-phase', 'help', 'phase']);
    staged = stageSkillsForProfile(src, { skills, agents: new Set() });
    assert.notStrictEqual(staged, src);
    const files = fs.readdirSync(staged).sort();
    assert.deepStrictEqual(files, ['help.md', 'phase.md', 'plan-phase.md']);
  });

  test('preserves file content byte-for-byte', (t) => {
    const src = createFixtureSkillsDir();
    const content = '# plan-phase special content\n\nsome body\n';
    fs.writeFileSync(path.join(src, 'plan-phase.md'), content);
    let staged;
    t.after(() => {
      cleanup(src);
      if (staged) cleanupStagedSkills();
    });
    const skills = new Set(['plan-phase']);
    staged = stageSkillsForProfile(src, { skills, agents: new Set() });
    const copied = fs.readFileSync(path.join(staged, 'plan-phase.md'), 'utf8');
    assert.strictEqual(copied, content);
  });

  test('non-existent srcDir returns srcDir unchanged', () => {
    const ghost = path.join(require('os').tmpdir(), 'gsd-no-exist-' + Date.now());
    const result = stageSkillsForProfile(ghost, { skills: new Set(['help']), agents: new Set() });
    assert.strictEqual(result, ghost);
  });

  test('empty skills Set produces empty staged dir', (t) => {
    const src = createFixtureSkillsDir();
    let staged;
    t.after(() => {
      cleanup(src);
      if (staged) cleanupStagedSkills();
    });
    staged = stageSkillsForProfile(src, { skills: new Set(), agents: new Set() });
    const files = fs.readdirSync(staged);
    assert.deepStrictEqual(files, []);
  });
});

describe('stageAgentsForProfile', () => {
  test('full profile (skills === "*") returns srcDir unchanged', (t) => {
    const src = createFixtureAgentsDir();
    t.after(() => cleanup(src));
    const result = stageAgentsForProfile(src, { skills: '*', agents: new Set() });
    assert.strictEqual(result, src);
  });

  test('non-full profile with empty agents Set produces empty staged dir', (t) => {
    const src = createFixtureAgentsDir();
    let staged;
    t.after(() => {
      cleanup(src);
      if (staged) cleanupStagedSkills();
    });
    staged = stageAgentsForProfile(src, { skills: new Set(['help']), agents: new Set() });
    const files = fs.readdirSync(staged);
    assert.deepStrictEqual(files, [], 'no agents for non-full profile by default');
  });

  test('non-full profile with agents Set copies only member agent files', (t) => {
    const src = createFixtureAgentsDir();
    let staged;
    t.after(() => {
      cleanup(src);
      if (staged) cleanupStagedSkills();
    });
    const agents = new Set(['gsd-planner']);
    staged = stageAgentsForProfile(src, { skills: new Set(['plan-phase']), agents });
    const files = fs.readdirSync(staged).sort();
    assert.deepStrictEqual(files, ['gsd-planner.md']);
  });

  test('non-existent srcAgentsDir returns srcAgentsDir unchanged', () => {
    const ghost = path.join(require('os').tmpdir(), 'gsd-agents-no-exist-' + Date.now());
    const result = stageAgentsForProfile(ghost, { skills: new Set(), agents: new Set() });
    assert.strictEqual(result, ghost);
  });

  test('standard profile — stageAgentsForProfile copies exactly the agents in resolvedProfile.agents', (t) => {
    // Uses the real agents dir and commands dir
    if (!fs.existsSync(REAL_AGENTS_DIR) || !fs.existsSync(REAL_COMMANDS_DIR)) return;
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const resolved = resolveProfile({ modes: ['standard'], manifest });
    assert.ok(resolved.agents instanceof Set && resolved.agents.size > 0,
      'standard profile must have >0 agents (plan-phase calls gsd-planner etc)');
    let staged;
    t.after(() => {
      if (staged) cleanupStagedSkills();
    });
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
  });

  test('full profile staging returns real agents dir unchanged', () => {
    if (!fs.existsSync(REAL_AGENTS_DIR)) return;
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const resolved = resolveProfile({ modes: ['full'], manifest });
    const result = stageAgentsForProfile(REAL_AGENTS_DIR, resolved);
    assert.strictEqual(result, REAL_AGENTS_DIR);
  });
});
