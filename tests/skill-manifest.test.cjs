/**
 * Tests for skill-manifest command
 * TDD: RED phase — tests written before implementation
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('skill-manifest', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('skill-manifest command exists and returns JSON', () => {
    // Create a skills directory with one skill
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: test-skill',
      'description: A test skill',
      '---',
      '',
      '# Test Skill',
    ].join('\n'));

    const result = runGsdTools(['skill-manifest', '--skills-dir', path.join(tmpDir, '.claude', 'skills')], tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || result.output}`);

    const manifest = JSON.parse(result.output);
    assert.ok(Array.isArray(manifest), 'Manifest should be an array');
  });

  test('generates manifest with correct structure from SKILL.md frontmatter', () => {
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'my-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: my-skill',
      'description: Does something useful',
      '---',
      '',
      '# My Skill',
      '',
      'TRIGGER when: user asks about widgets',
    ].join('\n'));

    const result = runGsdTools(['skill-manifest', '--skills-dir', path.join(tmpDir, '.claude', 'skills')], tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || result.output}`);

    const manifest = JSON.parse(result.output);
    assert.strictEqual(manifest.length, 1);
    assert.strictEqual(manifest[0].name, 'my-skill');
    assert.strictEqual(manifest[0].description, 'Does something useful');
    assert.strictEqual(manifest[0].path, 'my-skill');
  });

  test('empty skills directory produces empty manifest', () => {
    const skillsDir = path.join(tmpDir, '.claude', 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });

    const result = runGsdTools(['skill-manifest', '--skills-dir', skillsDir], tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || result.output}`);

    const manifest = JSON.parse(result.output);
    assert.ok(Array.isArray(manifest), 'Manifest should be an array');
    assert.strictEqual(manifest.length, 0);
  });

  test('skills without SKILL.md are skipped', () => {
    const skillsDir = path.join(tmpDir, '.claude', 'skills');
    // Skill with SKILL.md
    const goodDir = path.join(skillsDir, 'good-skill');
    fs.mkdirSync(goodDir, { recursive: true });
    fs.writeFileSync(path.join(goodDir, 'SKILL.md'), [
      '---',
      'name: good-skill',
      'description: Has a SKILL.md',
      '---',
      '',
      '# Good Skill',
    ].join('\n'));

    // Skill without SKILL.md (just a directory)
    const badDir = path.join(skillsDir, 'bad-skill');
    fs.mkdirSync(badDir, { recursive: true });
    fs.writeFileSync(path.join(badDir, 'README.md'), '# No SKILL.md here');

    const result = runGsdTools(['skill-manifest', '--skills-dir', skillsDir], tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || result.output}`);

    const manifest = JSON.parse(result.output);
    assert.strictEqual(manifest.length, 1);
    assert.strictEqual(manifest[0].name, 'good-skill');
  });

  test('manifest includes frontmatter fields from SKILL.md', () => {
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'rich-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: rich-skill',
      'description: A richly documented skill',
      '---',
      '',
      '# Rich Skill',
      '',
      'TRIGGER when: user mentions databases',
      'DO NOT TRIGGER when: user asks about frontend',
    ].join('\n'));

    const result = runGsdTools(['skill-manifest', '--skills-dir', path.join(tmpDir, '.claude', 'skills')], tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || result.output}`);

    const manifest = JSON.parse(result.output);
    assert.strictEqual(manifest.length, 1);

    const skill = manifest[0];
    assert.strictEqual(skill.name, 'rich-skill');
    assert.strictEqual(skill.description, 'A richly documented skill');
    assert.strictEqual(skill.path, 'rich-skill');
    // triggers extracted from body text
    assert.ok(Array.isArray(skill.triggers), 'triggers should be an array');
    assert.ok(skill.triggers.length > 0, 'triggers should have at least one entry');
    assert.ok(skill.triggers.some(t => t.includes('databases')), 'triggers should mention databases');
  });

  test('multiple skills are all included in manifest', () => {
    const skillsDir = path.join(tmpDir, '.claude', 'skills');

    for (const name of ['alpha', 'beta', 'gamma']) {
      const dir = path.join(skillsDir, name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'SKILL.md'), [
        '---',
        `name: ${name}`,
        `description: The ${name} skill`,
        '---',
        '',
        `# ${name}`,
      ].join('\n'));
    }

    const result = runGsdTools(['skill-manifest', '--skills-dir', skillsDir], tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || result.output}`);

    const manifest = JSON.parse(result.output);
    assert.strictEqual(manifest.length, 3);
    const names = manifest.map(s => s.name).sort();
    assert.deepStrictEqual(names, ['alpha', 'beta', 'gamma']);
  });

  test('writes manifest to .planning/skill-manifest.json when --write flag is used', () => {
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'write-test');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: write-test',
      'description: Tests write mode',
      '---',
      '',
      '# Write Test',
    ].join('\n'));

    const result = runGsdTools(['skill-manifest', '--skills-dir', path.join(tmpDir, '.claude', 'skills'), '--write'], tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || result.output}`);

    const manifestPath = path.join(tmpDir, '.planning', 'skill-manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'skill-manifest.json should be written to .planning/');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    assert.strictEqual(manifest.length, 1);
    assert.strictEqual(manifest[0].name, 'write-test');
  });

  test('nonexistent skills directory returns empty manifest', () => {
    const result = runGsdTools(['skill-manifest', '--skills-dir', path.join(tmpDir, 'nonexistent')], tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || result.output}`);

    const manifest = JSON.parse(result.output);
    assert.ok(Array.isArray(manifest), 'Manifest should be an array');
    assert.strictEqual(manifest.length, 0);
  });

  test('files in skills directory are ignored (only subdirectories scanned)', () => {
    const skillsDir = path.join(tmpDir, '.claude', 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    // A file, not a directory
    fs.writeFileSync(path.join(skillsDir, 'not-a-skill.md'), '# Not a skill');

    // A valid skill directory
    const skillDir = path.join(skillsDir, 'real-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: real-skill',
      'description: A real skill',
      '---',
      '',
      '# Real Skill',
    ].join('\n'));

    const result = runGsdTools(['skill-manifest', '--skills-dir', skillsDir], tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || result.output}`);

    const manifest = JSON.parse(result.output);
    assert.strictEqual(manifest.length, 1);
    assert.strictEqual(manifest[0].name, 'real-skill');
  });
});
