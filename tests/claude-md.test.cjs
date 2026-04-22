/**
 * CLAUDE.md generation and new-project workflow tests
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('generate-claude-md', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates CLAUDE.md with workflow enforcement section', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Test Project\n\n## What This Is\n\nA small test project.\n'
    );

    const result = runGsdTools('generate-claude-md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.action, 'created');
    assert.strictEqual(output.sections_total, 6);
    assert.ok(output.sections_generated.includes('workflow'));

    const claudePath = path.join(tmpDir, 'CLAUDE.md');
    const content = fs.readFileSync(claudePath, 'utf-8');
    assert.ok(content.includes('## GSD Workflow Enforcement'));
    assert.ok(content.includes('/gsd:quick'));
    assert.ok(content.includes('/gsd:debug'));
    assert.ok(content.includes('/gsd:execute-phase'));
    assert.ok(content.includes('Do not make direct repo edits outside a GSD workflow'));
  });

  test('adds workflow enforcement section when updating an existing CLAUDE.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Test Project\n\n## What This Is\n\nA small test project.\n'
    );
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '## Local Notes\n\nKeep this intro.\n');

    const result = runGsdTools('generate-claude-md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.action, 'updated');

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('## Local Notes'));
    assert.ok(content.includes('## GSD Workflow Enforcement'));
  });
});

describe('new-project workflow includes CLAUDE.md generation', () => {
  const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'new-project.md');
  const commandsPath = path.join(__dirname, '..', 'docs', 'COMMANDS.md');

  test('new-project workflow generates instruction file before final commit', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('generate-claude-md'));
    // Codex fix: workflow now uses $INSTRUCTION_FILE (AGENTS.md for Codex, CLAUDE.md otherwise)
    assert.ok(
      content.includes('.planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md "$INSTRUCTION_FILE"'),
      'final roadmap commit should stage ROADMAP, STATE, REQUIREMENTS, and instruction file'
    );
  });

  test('new-project artifacts reference instruction file variable', () => {
    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    const commandsContent = fs.readFileSync(commandsPath, 'utf-8');

    // Codex fix: hardcoded CLAUDE.md replaced with $INSTRUCTION_FILE variable
    assert.ok(workflowContent.includes('| Project guide  | `$INSTRUCTION_FILE`'));
    assert.ok(workflowContent.includes('- `$INSTRUCTION_FILE`'));
    assert.ok(commandsContent.includes('`CLAUDE.md`'));
  });
});

describe('generate-claude-md skills section', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Test Project\n\n## What This Is\n\nA test project.\n'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('includes skills fallback when no skills directories exist', () => {
    const result = runGsdTools('generate-claude-md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.sections_fallback.includes('skills'));

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('<!-- GSD:skills-start'));
    assert.ok(content.includes('<!-- GSD:skills-end -->'));
    assert.ok(content.includes('No project skills found. Add skills to any of'));
  });

  test('discovers skills from .claude/skills/ directory', () => {
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'api-payments');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: api-payments\ndescription: Payment gateway integration.\n---\n\n# API Payments\n'
    );

    const result = runGsdTools('generate-claude-md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.sections_generated.includes('skills'));
    assert.ok(!output.sections_fallback.includes('skills'));

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('api-payments'));
    assert.ok(content.includes('Payment gateway integration'));
    assert.ok(content.includes('## Project Skills'));
  });

  test('discovers skills from .agents/skills/ directory', () => {
    const skillDir = path.join(tmpDir, '.agents', 'skills', 'data-sync');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: data-sync\ndescription: ERP synchronization flows.\n---\n\n# Data Sync\n'
    );

    const result = runGsdTools('generate-claude-md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('data-sync'));
    assert.ok(content.includes('ERP synchronization flows'));
  });

  test('discovers skills from .codex/skills/ directory and ignores deprecated import-only roots', () => {
    const codexSkillDir = path.join(tmpDir, '.codex', 'skills', 'automation');
    fs.mkdirSync(codexSkillDir, { recursive: true });
    fs.writeFileSync(
      path.join(codexSkillDir, 'SKILL.md'),
      '---\nname: automation\ndescription: Project Codex skill.\n---\n\n# Automation\n'
    );

    const homeDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-claude-skills-home-'));
    fs.mkdirSync(path.join(homeDir, '.claude', 'get-shit-done', 'skills', 'import-only'), { recursive: true });
    fs.writeFileSync(
      path.join(homeDir, '.claude', 'get-shit-done', 'skills', 'import-only', 'SKILL.md'),
      '---\nname: import-only\ndescription: Deprecated import-only skill.\n---\n'
    );

    const originalHome = process.env.HOME;
    process.env.HOME = homeDir;

    try {
      const result = runGsdTools('generate-claude-md', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
      assert.ok(content.includes('automation'));
      assert.ok(content.includes('Project Codex skill'));
      assert.ok(!content.includes('import-only'));
    } finally {
      process.env.HOME = originalHome;
      cleanup(homeDir);
    }
  });

  test('skips gsd- prefixed skill directories', () => {
    const gsdSkillDir = path.join(tmpDir, '.claude', 'skills', 'gsd-plan-phase');
    const userSkillDir = path.join(tmpDir, '.claude', 'skills', 'my-feature');
    fs.mkdirSync(gsdSkillDir, { recursive: true });
    fs.mkdirSync(userSkillDir, { recursive: true });
    fs.writeFileSync(
      path.join(gsdSkillDir, 'SKILL.md'),
      '---\nname: gsd-plan-phase\ndescription: GSD internal skill.\n---\n'
    );
    fs.writeFileSync(
      path.join(userSkillDir, 'SKILL.md'),
      '---\nname: my-feature\ndescription: Custom project skill.\n---\n'
    );

    const result = runGsdTools('generate-claude-md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(!content.includes('gsd-plan-phase'));
    assert.ok(content.includes('my-feature'));
    assert.ok(content.includes('Custom project skill'));
  });

  test('handles multi-line description in frontmatter', () => {
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'complex-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: complex-skill\ndescription: First line of description.\n  Continued on second line.\n  And a third line.\n---\n'
    );

    const result = runGsdTools('generate-claude-md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('First line of description'));
    assert.ok(content.includes('Continued on second line'));
    assert.ok(content.includes('And a third line'));
  });

  test('deduplicates skills found in multiple directories', () => {
    // Same skill in both .claude/skills/ and .agents/skills/
    const dir1 = path.join(tmpDir, '.claude', 'skills', 'shared-skill');
    const dir2 = path.join(tmpDir, '.agents', 'skills', 'shared-skill');
    fs.mkdirSync(dir1, { recursive: true });
    fs.mkdirSync(dir2, { recursive: true });
    const skillContent = '---\nname: shared-skill\ndescription: Appears twice.\n---\n';
    fs.writeFileSync(path.join(dir1, 'SKILL.md'), skillContent);
    fs.writeFileSync(path.join(dir2, 'SKILL.md'), skillContent);

    const result = runGsdTools('generate-claude-md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    const matches = content.match(/shared-skill/g);
    // Should appear exactly twice: once in name column, once in path column (single row)
    assert.strictEqual(matches.length, 2);
  });

  test('updates existing skills section on regeneration', () => {
    // First generation — no skills
    runGsdTools('generate-claude-md', tmpDir);
    let content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('No project skills found'));

    // Add a skill and regenerate
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'new-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: new-skill\ndescription: Just added.\n---\n'
    );

    const result = runGsdTools('generate-claude-md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(!content.includes('No project skills found'));
    assert.ok(content.includes('new-skill'));
    assert.ok(content.includes('Just added'));
  });

  test('skills section appears between architecture and workflow', () => {
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'ordering-test');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: ordering-test\ndescription: Verify section order.\n---\n'
    );

    const result = runGsdTools('generate-claude-md', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    const archIdx = content.indexOf('## Architecture');
    const skillsIdx = content.indexOf('## Project Skills');
    const workflowIdx = content.indexOf('## GSD Workflow Enforcement');
    assert.ok(archIdx < skillsIdx, 'Skills section should come after Architecture');
    assert.ok(skillsIdx < workflowIdx, 'Skills section should come before Workflow Enforcement');
  });
});
