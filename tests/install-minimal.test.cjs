/**
 * Tests for `--minimal` install profile (#2762).
 *
 * Verifies:
 *   1. The install-profiles allowlist contains exactly the documented core
 *      main-loop skills.
 *   2. stageSkillsForMode() filters source dir entries to the allowlist when
 *      mode === 'minimal' and is a no-op for mode === 'full'.
 *   3. Filtering is by basename (mirrors how copyCommandsAs*Skills derives
 *      skill names).
 *   4. shouldInstallSkill() agrees with stageSkillsForMode().
 *
 * Note: end-to-end install tests (spawning bin/install.js with --minimal) are
 * intentionally out of scope here — they require a fully-mocked runtime config
 * dir which would duplicate antigravity-install.test.cjs scaffolding. The unit
 * tests below pin the allowlist contract; the dispatch sites in install.js
 * call stageSkillsForMode unconditionally so any breakage there shows up as
 * a stage_dir/source_dir mismatch covered by these tests.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  MINIMAL_SKILL_ALLOWLIST,
  isMinimalMode,
  shouldInstallSkill,
  stageSkillsForMode,
} = require('../get-shit-done/bin/lib/install-profiles.cjs');

describe('install-profiles: MINIMAL_SKILL_ALLOWLIST', () => {
  test('contains exactly the main-loop core (no drift without test update)', () => {
    assert.deepStrictEqual(
      [...MINIMAL_SKILL_ALLOWLIST].sort(),
      [
        'discuss-phase',
        'execute-phase',
        'help',
        'new-project',
        'plan-phase',
        'update',
      ],
    );
  });

  test('is frozen (mutations throw in strict mode)', () => {
    assert.ok(Object.isFrozen(MINIMAL_SKILL_ALLOWLIST));
  });

  test('every allowlisted skill exists in commands/gsd/', () => {
    const commandsDir = path.join(__dirname, '..', 'commands', 'gsd');
    for (const name of MINIMAL_SKILL_ALLOWLIST) {
      const file = path.join(commandsDir, `${name}.md`);
      assert.ok(
        fs.existsSync(file),
        `core skill ${name} is allowlisted but ${file} does not exist`,
      );
    }
  });
});

describe('install-profiles: isMinimalMode', () => {
  test('returns true only for the literal string "minimal"', () => {
    assert.strictEqual(isMinimalMode('minimal'), true);
    assert.strictEqual(isMinimalMode('full'), false);
    assert.strictEqual(isMinimalMode(''), false);
    assert.strictEqual(isMinimalMode(undefined), false);
    assert.strictEqual(isMinimalMode(null), false);
    assert.strictEqual(isMinimalMode('MINIMAL'), false);
  });
});

describe('install-profiles: shouldInstallSkill', () => {
  test('full mode admits every skill', () => {
    assert.strictEqual(shouldInstallSkill('plan-phase', 'full'), true);
    assert.strictEqual(shouldInstallSkill('autonomous', 'full'), true);
    assert.strictEqual(shouldInstallSkill('arbitrary-future-name', 'full'), true);
  });

  test('minimal mode admits only allowlisted skills', () => {
    for (const name of MINIMAL_SKILL_ALLOWLIST) {
      assert.strictEqual(shouldInstallSkill(name, 'minimal'), true, name);
    }
    for (const denied of ['autonomous', 'do', 'progress', 'next', 'fast', 'quick']) {
      assert.strictEqual(shouldInstallSkill(denied, 'minimal'), false, denied);
    }
  });

  test('minimal mode rejects allowlist names with .md suffix (callers must strip)', () => {
    assert.strictEqual(shouldInstallSkill('plan-phase.md', 'minimal'), false);
  });
});

describe('install-profiles: stageSkillsForMode', () => {
  function createFixtureSkillsDir() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-fixture-'));
    fs.writeFileSync(path.join(tmp, 'plan-phase.md'), '# plan-phase\n');
    fs.writeFileSync(path.join(tmp, 'execute-phase.md'), '# execute-phase\n');
    fs.writeFileSync(path.join(tmp, 'autonomous.md'), '# autonomous\n');
    fs.writeFileSync(path.join(tmp, 'do.md'), '# do\n');
    fs.writeFileSync(path.join(tmp, 'help.md'), '# help\n');
    fs.writeFileSync(path.join(tmp, 'new-project.md'), '# new-project\n');
    fs.writeFileSync(path.join(tmp, 'discuss-phase.md'), '# discuss-phase\n');
    fs.writeFileSync(path.join(tmp, 'update.md'), '# update\n');
    fs.writeFileSync(path.join(tmp, 'progress.md'), '# progress\n');
    return tmp;
  }

  test('full mode returns the original src dir unchanged', () => {
    const src = createFixtureSkillsDir();
    try {
      const result = stageSkillsForMode(src, 'full');
      assert.strictEqual(result, src);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  });

  test('minimal mode returns a new dir containing only allowlisted skills', () => {
    const src = createFixtureSkillsDir();
    let staged;
    try {
      staged = stageSkillsForMode(src, 'minimal');
      assert.notStrictEqual(staged, src);
      const stagedFiles = fs.readdirSync(staged).sort();
      assert.deepStrictEqual(stagedFiles, [
        'discuss-phase.md',
        'execute-phase.md',
        'help.md',
        'new-project.md',
        'plan-phase.md',
        'update.md',
      ]);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      if (staged) fs.rmSync(staged, { recursive: true, force: true });
    }
  });

  test('minimal mode preserves file content byte-for-byte', () => {
    const src = createFixtureSkillsDir();
    let staged;
    try {
      staged = stageSkillsForMode(src, 'minimal');
      const original = fs.readFileSync(path.join(src, 'plan-phase.md'), 'utf8');
      const copied = fs.readFileSync(path.join(staged, 'plan-phase.md'), 'utf8');
      assert.strictEqual(copied, original);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      if (staged) fs.rmSync(staged, { recursive: true, force: true });
    }
  });

  test('minimal mode against non-existent source returns the source path (caller handles missing)', () => {
    const ghost = path.join(os.tmpdir(), 'gsd-stage-does-not-exist-' + Date.now());
    const result = stageSkillsForMode(ghost, 'minimal');
    assert.strictEqual(result, ghost);
  });

  test('minimal mode skips non-md files and subdirectories', () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-mixed-'));
    let staged;
    try {
      fs.writeFileSync(path.join(src, 'plan-phase.md'), '# plan\n');
      fs.writeFileSync(path.join(src, 'README.txt'), 'not a skill\n');
      fs.mkdirSync(path.join(src, 'nested-dir'));
      fs.writeFileSync(path.join(src, 'nested-dir', 'plan-phase.md'), '# nested\n');
      staged = stageSkillsForMode(src, 'minimal');
      const stagedFiles = fs.readdirSync(staged);
      assert.deepStrictEqual(stagedFiles, ['plan-phase.md']);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      if (staged) fs.rmSync(staged, { recursive: true, force: true });
    }
  });
});
