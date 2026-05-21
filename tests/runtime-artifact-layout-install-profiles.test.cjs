'use strict';
/**
 * Consolidated tests for the Runtime Artifact Layout Module — install-profiles parity (ADR-3660).
 *
 * Covers:
 *   - stageSkillsForProfile / stageAgentsForProfile / stageSkillsForRuntimeAsSkills
 *   - resolveProfile — transitive closure + PROFILES map
 *   - loadSkillsManifest — frontmatter parsing
 *   - readActiveProfile / writeActiveProfile — marker persistence
 *
 * Sources consolidated (4 files deleted):
 *   tests/install-profiles-stage.test.cjs
 *   tests/install-profiles-resolve.test.cjs
 *   tests/install-profiles-manifest.test.cjs
 *   tests/install-profiles-marker.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  stageSkillsForProfile,
  stageAgentsForProfile,
  stageSkillsForRuntimeAsSkills,
  cleanupStagedSkills,
  resolveProfile,
  loadSkillsManifest,
  readActiveProfile,
  writeActiveProfile,
  PROFILES,
  STAGED_DIRS,
} = require('../get-shit-done/bin/lib/install-profiles.cjs');
const { createTempDir, cleanup } = require('./helpers.cjs');

const REAL_COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');
const REAL_AGENTS_DIR = path.join(__dirname, '..', 'agents');

// ─── helpers ────────────────────────────────────────────────────────────────

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'gsd-ip-'));
}

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

function writeSkill(dir, stem, frontmatter) {
  const content = `---\n${frontmatter}\n---\n\n# body\n`;
  fs.writeFileSync(path.join(dir, `${stem}.md`), content);
}

// ─── stageSkillsForRuntimeAsSkills ──────────────────────────────────────────

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
    const ghost = path.join(os.tmpdir(), 'gsd-rta-no-exist-' + Date.now());
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

// ─── stageSkillsForProfile ───────────────────────────────────────────────────

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
    const ghost = path.join(os.tmpdir(), 'gsd-no-exist-' + Date.now());
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

// ─── stageAgentsForProfile ───────────────────────────────────────────────────

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
    const ghost = path.join(os.tmpdir(), 'gsd-agents-no-exist-' + Date.now());
    const result = stageAgentsForProfile(ghost, { skills: new Set(), agents: new Set() });
    assert.strictEqual(result, ghost);
  });

  test('standard profile — stageAgentsForProfile copies exactly the agents in resolvedProfile.agents', (t) => {
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
    for (const stem of stagedFiles) {
      assert.ok(resolved.agents.has(stem), `staged agent ${stem} not in resolved.agents`);
    }
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

// ─── PROFILES map + resolveProfile ──────────────────────────────────────────

describe('PROFILES map', () => {
  test('PROFILES is frozen', () => {
    assert.ok(Object.isFrozen(PROFILES));
  });

  test('PROFILES has core, standard, full keys', () => {
    assert.ok('core' in PROFILES, 'PROFILES.core missing');
    assert.ok('standard' in PROFILES, 'PROFILES.standard missing');
    assert.ok('full' in PROFILES, 'PROFILES.full missing');
  });

  test('PROFILES.core contains the 8 main-loop skills (including phase and surface)', () => {
    const core = PROFILES.core;
    assert.ok(Array.isArray(core), 'core should be an array');
    const sorted = [...core].sort();
    assert.deepStrictEqual(sorted, [
      'discuss-phase',
      'execute-phase',
      'help',
      'new-project',
      'phase',
      'plan-phase',
      'surface',
      'update',
    ]);
  });

  test('PROFILES.full is the sentinel "*"', () => {
    assert.strictEqual(PROFILES.full, '*');
  });

  test('PROFILES.standard contains at least the core skills', () => {
    const core = new Set(PROFILES.core);
    const standard = PROFILES.standard;
    assert.ok(Array.isArray(standard), 'standard should be an array');
    for (const s of core) {
      assert.ok(standard.includes(s), `standard should include core skill: ${s}`);
    }
  });

  test('PROFILES.standard has at least 10 skills', () => {
    assert.ok(PROFILES.standard.length >= 10, `standard should have >=10 skills, got ${PROFILES.standard.length}`);
  });
});

describe('resolveProfile', () => {
  test('defaults to full when called with no modes arg', () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const result = resolveProfile({ manifest });
    assert.strictEqual(result.name, 'full');
    assert.strictEqual(result.skills, '*');
  });

  test('resolves core profile — returns 8+ skills, all base stems present', () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const result = resolveProfile({ modes: ['core'], manifest });
    assert.strictEqual(result.name, 'core');
    assert.ok(result.skills instanceof Set, 'skills should be a Set');
    // core has 8 base skills (includes surface as of #3735).
    assert.ok(result.skills.size >= 8, `core closure should have >=8 skills, got ${result.skills.size}`);
    for (const s of PROFILES.core) {
      assert.ok(result.skills.has(s), `core closure should include ${s}`);
    }
    assert.ok(result.skills.has('phase'), 'core closure must include phase');
  });

  test('resolves standard profile — superset of core', () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const coreResult = resolveProfile({ modes: ['core'], manifest });
    const stdResult = resolveProfile({ modes: ['standard'], manifest });
    assert.strictEqual(stdResult.name, 'standard');
    assert.ok(stdResult.skills instanceof Set);
    assert.ok(stdResult.skills.size >= coreResult.skills.size, 'standard should have >= skills than core');
    for (const s of coreResult.skills) {
      assert.ok(stdResult.skills.has(s), `standard must include core skill: ${s}`);
    }
  });

  test('resolves full profile — returns sentinel', () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const result = resolveProfile({ modes: ['full'], manifest });
    assert.strictEqual(result.name, 'full');
    assert.strictEqual(result.skills, '*');
  });

  test('composable profiles — core,standard union is same as standard', () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const stdResult = resolveProfile({ modes: ['standard'], manifest });
    const composed = resolveProfile({ modes: ['core', 'standard'], manifest });
    assert.ok(composed.name.includes('core') && composed.name.includes('standard'),
      `composed name should include both, got: ${composed.name}`);
    for (const s of stdResult.skills) {
      assert.ok(composed.skills.has(s), `composed should include standard skill: ${s}`);
    }
  });

  test('transitive closure: skill that requires phase pulls in phase', () => {
    const manifest = new Map([
      ['discuss-phase', ['phase']],
      ['phase', []],
      ['help', []],
    ]);
    const miniProfiles = { core: ['discuss-phase', 'help'], full: '*', standard: ['discuss-phase', 'help'] };
    const result = resolveProfile({ modes: ['core'], manifest, _profilesOverride: miniProfiles });
    assert.ok(result.skills.has('phase'), 'phase should be pulled in via closure from discuss-phase');
    assert.ok(result.skills.has('discuss-phase'));
    assert.ok(result.skills.has('help'));
  });

  test('deep transitive closure works (A→B→C pulls in C)', () => {
    const manifest = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', []],
    ]);
    const miniProfiles = { core: ['a'], full: '*', standard: ['a'] };
    const result = resolveProfile({ modes: ['core'], manifest, _profilesOverride: miniProfiles });
    assert.ok(result.skills.has('a'));
    assert.ok(result.skills.has('b'));
    assert.ok(result.skills.has('c'));
  });

  test('result has agents Set', () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const result = resolveProfile({ modes: ['core'], manifest });
    assert.ok(result.agents instanceof Set, 'result should have agents Set');
  });

  test('standard — agents Set is non-empty; gsd-planner and gsd-plan-checker present', () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const result = resolveProfile({ modes: ['standard'], manifest });
    assert.ok(result.agents instanceof Set, 'agents should be a Set');
    assert.ok(result.agents.size > 0, `standard profile should have >0 agents, got ${result.agents.size}`);
    assert.ok(result.agents.has('gsd-planner'), 'standard should include gsd-planner');
    assert.ok(result.agents.has('gsd-plan-checker'), 'standard should include gsd-plan-checker');
  });

  test('full — agents is a Set (full staging uses srcDir directly)', () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const result = resolveProfile({ modes: ['full'], manifest });
    assert.strictEqual(result.skills, '*');
    assert.ok(result.agents instanceof Set, 'agents should still be a Set for full');
  });

  test('agents are derived from real manifest body text (gsd-planner from plan-phase)', () => {
    const realManifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const result = resolveProfile({ modes: ['standard'], manifest: realManifest });
    assert.ok(result.agents.has('gsd-planner'), 'gsd-planner should be derived from plan-phase body');
  });

  test('agents transitively closed — plan-phase in standard brings its agents', () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const result = resolveProfile({ modes: ['standard'], manifest });
    assert.ok(result.agents.has('gsd-planner'));
  });
});

// ─── loadSkillsManifest ──────────────────────────────────────────────────────

describe('loadSkillsManifest', () => {
  test('returns a Map', () => {
    const dir = tmpDir('gsd-manifest-fixture-');
    try {
      const m = loadSkillsManifest(dir);
      assert.ok(m instanceof Map, 'should return a Map');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('skill with no requires: frontmatter maps to empty array', () => {
    const dir = tmpDir('gsd-manifest-fixture-');
    try {
      writeSkill(dir, 'help', 'name: gsd:help\ndescription: Help text');
      const m = loadSkillsManifest(dir);
      assert.ok(m.has('help'), 'help should be in manifest');
      assert.deepStrictEqual(m.get('help'), []);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('skill with requires: single value maps to array of one', () => {
    const dir = tmpDir('gsd-manifest-fixture-');
    try {
      writeSkill(dir, 'add-tests', 'name: gsd:add-tests\ndescription: Add tests\nrequires: [phase]');
      const m = loadSkillsManifest(dir);
      assert.ok(m.has('add-tests'));
      assert.deepStrictEqual(m.get('add-tests'), ['phase']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('skill with requires: multiple values maps to full array', () => {
    const dir = tmpDir('gsd-manifest-fixture-');
    try {
      writeSkill(dir, 'plan-phase', 'name: gsd:plan-phase\ndescription: Plan\nrequires: [discuss-phase, phase, review, update]');
      const m = loadSkillsManifest(dir);
      assert.deepStrictEqual(m.get('plan-phase'), ['discuss-phase', 'phase', 'review', 'update']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('ignores non-.md files in the dir', () => {
    const dir = tmpDir('gsd-manifest-fixture-');
    try {
      writeSkill(dir, 'help', 'name: gsd:help\ndescription: Help');
      fs.writeFileSync(path.join(dir, 'README.txt'), 'not a skill');
      fs.writeFileSync(path.join(dir, 'notes.json'), '{}');
      const m = loadSkillsManifest(dir);
      assert.ok(m.has('help'));
      assert.ok(!m.has('README'));
      assert.ok(!m.has('notes'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('empty dir returns empty Map', () => {
    const dir = tmpDir('gsd-manifest-fixture-');
    try {
      const m = loadSkillsManifest(dir);
      assert.strictEqual(m.size, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('skill with requires: empty array maps to empty array', () => {
    const dir = tmpDir('gsd-manifest-fixture-');
    try {
      writeSkill(dir, 'explore', 'name: gsd:explore\ndescription: Explore\nrequires: []');
      const m = loadSkillsManifest(dir);
      assert.deepStrictEqual(m.get('explore'), []);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('loads real commands/gsd/ directory: >=60 skills, discuss-phase deps correct, help has no requires', () => {
    const m = loadSkillsManifest(REAL_COMMANDS_DIR);
    // Use prefix/set assertion, not a hardcoded count — avoids stale-count anti-pattern
    assert.ok(m.size >= 60, `expected >=60 skills, got ${m.size}`);
    const depsDP = m.get('discuss-phase');
    assert.ok(Array.isArray(depsDP), 'discuss-phase should be in manifest');
    assert.ok(depsDP.includes('phase'), 'discuss-phase should require phase');
    assert.ok(depsDP.includes('config'), 'discuss-phase should require config');
    assert.deepStrictEqual(m.get('help'), []);
  });
});

// ─── readActiveProfile / writeActiveProfile ──────────────────────────────────

describe('readActiveProfile / writeActiveProfile', () => {
  test('write then read round-trips the profile name', () => {
    const dir = tmpDir('gsd-marker-');
    try {
      writeActiveProfile(dir, 'standard');
      assert.strictEqual(readActiveProfile(dir), 'standard');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('round-trips "core" profile', () => {
    const dir = tmpDir('gsd-marker-');
    try {
      writeActiveProfile(dir, 'core');
      assert.strictEqual(readActiveProfile(dir), 'core');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('round-trips composed profiles "core,audit"', () => {
    const dir = tmpDir('gsd-marker-');
    try {
      writeActiveProfile(dir, 'core,audit');
      assert.strictEqual(readActiveProfile(dir), 'core,audit');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('round-trips "full"', () => {
    const dir = tmpDir('gsd-marker-');
    try {
      writeActiveProfile(dir, 'full');
      assert.strictEqual(readActiveProfile(dir), 'full');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('missing marker file returns null (not throws)', () => {
    const dir = tmpDir('gsd-marker-');
    try {
      const result = readActiveProfile(dir);
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('non-existent directory returns null (not throws)', () => {
    const ghost = path.join(os.tmpdir(), 'gsd-marker-no-exist-' + Date.now());
    const result = readActiveProfile(ghost);
    assert.strictEqual(result, null);
  });

  test('corrupt marker content (invalid chars) returns null', () => {
    const dir = tmpDir('gsd-marker-');
    try {
      fs.writeFileSync(path.join(dir, '.gsd-profile'), 'profile with spaces and !!!\n');
      const result = readActiveProfile(dir);
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('empty marker file returns null', () => {
    const dir = tmpDir('gsd-marker-');
    try {
      fs.writeFileSync(path.join(dir, '.gsd-profile'), '');
      const result = readActiveProfile(dir);
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('writeActiveProfile creates the directory if it does not exist', () => {
    const base = tmpDir('gsd-marker-base-');
    const nested = path.join(base, 'skills', '.claude');
    try {
      writeActiveProfile(nested, 'standard');
      assert.ok(fs.existsSync(nested), 'directory should be created');
      assert.strictEqual(readActiveProfile(nested), 'standard');
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  test('overwrites a previously written profile', () => {
    const dir = tmpDir('gsd-marker-');
    try {
      writeActiveProfile(dir, 'core');
      writeActiveProfile(dir, 'full');
      assert.strictEqual(readActiveProfile(dir), 'full');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
