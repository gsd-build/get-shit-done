/**
 * Tests for skill-manifest command
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

function writeSkill(rootDir, name, description, body = '') {
  const skillDir = path.join(rootDir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    '---',
    '',
    body || `# ${name}`,
  ].join('\n'));
}

describe('skill-manifest', () => {
  let tmpDir;
  let homeDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    homeDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-skill-manifest-home-'));

    writeSkill(path.join(tmpDir, '.claude', 'skills'), 'project-claude', 'Project Claude skill');
    writeSkill(path.join(tmpDir, '.claude', 'skills'), 'gsd-help', 'Installed GSD skill');
    writeSkill(path.join(tmpDir, '.agents', 'skills'), 'project-agents', 'Project agent skill');
    writeSkill(path.join(tmpDir, '.codex', 'skills'), 'project-codex', 'Project Codex skill');

    writeSkill(path.join(homeDir, '.claude', 'skills'), 'global-claude', 'Global Claude skill');
    writeSkill(path.join(homeDir, '.codex', 'skills'), 'global-codex', 'Global Codex skill');
    writeSkill(
      path.join(homeDir, '.claude', 'get-shit-done', 'skills'),
      'legacy-import',
      'Deprecated import-only skill'
    );

    fs.mkdirSync(path.join(homeDir, '.claude', 'commands', 'gsd'), { recursive: true });
    fs.writeFileSync(path.join(homeDir, '.claude', 'commands', 'gsd', 'help.md'), '# legacy');
  });

  afterEach(() => {
    cleanup(tmpDir);
    cleanup(homeDir);
  });

  test('returns normalized inventory across canonical roots', () => {
    const result = runGsdTools(['skill-manifest'], tmpDir, { HOME: homeDir });
    assert.ok(result.success, `Command should succeed: ${result.error || result.output}`);

    const manifest = JSON.parse(result.output);
    assert.ok(Array.isArray(manifest.skills), 'skills should be an array');
    assert.ok(Array.isArray(manifest.roots), 'roots should be an array');
    assert.ok(manifest.installation && typeof manifest.installation === 'object', 'installation summary present');
    assert.ok(manifest.counts && typeof manifest.counts === 'object', 'counts summary present');

    const skillNames = manifest.skills.map((skill) => skill.name).sort();
    assert.deepStrictEqual(skillNames, [
      'global-claude',
      'global-codex',
      'gsd-help',
      'legacy-import',
      'project-agents',
      'project-claude',
      'project-codex',
    ]);

    const codexSkill = manifest.skills.find((skill) => skill.name === 'project-codex');
    assert.deepStrictEqual(
      {
        root: codexSkill.root,
        scope: codexSkill.scope,
        installed: codexSkill.installed,
        deprecated: codexSkill.deprecated,
      },
      {
        root: '.codex/skills',
        scope: 'project',
        installed: true,
        deprecated: false,
      }
    );

    const importedSkill = manifest.skills.find((skill) => skill.name === 'legacy-import');
    assert.deepStrictEqual(
      {
        root: importedSkill.root,
        scope: importedSkill.scope,
        installed: importedSkill.installed,
        deprecated: importedSkill.deprecated,
      },
      {
        root: '.claude/get-shit-done/skills',
        scope: 'import-only',
        installed: false,
        deprecated: true,
      }
    );

    const gsdSkill = manifest.skills.find((skill) => skill.name === 'gsd-help');
    assert.strictEqual(gsdSkill.installed, true);

    const legacyRoot = manifest.roots.find((root) => root.scope === 'legacy-commands');
    assert.ok(legacyRoot, 'legacy commands root should be reported');
    assert.strictEqual(legacyRoot.present, true);

    assert.strictEqual(manifest.installation.gsd_skills_installed, true);
    assert.strictEqual(manifest.installation.legacy_claude_commands_installed, true);
    assert.strictEqual(manifest.counts.skills, 7);
  });

  test('writes manifest to .planning/skill-manifest.json when --write flag is used', () => {
    const result = runGsdTools(['skill-manifest', '--write'], tmpDir, { HOME: homeDir });
    assert.ok(result.success, `Command should succeed: ${result.error || result.output}`);

    const manifestPath = path.join(tmpDir, '.planning', 'skill-manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'skill-manifest.json should be written to .planning/');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    assert.ok(Array.isArray(manifest.skills));
    assert.ok(manifest.installation);
  });
});
