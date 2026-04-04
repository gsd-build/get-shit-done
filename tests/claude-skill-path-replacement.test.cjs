/**
 * GSD Tests - Claude skill path replacement in copyCommandsAsClaudeSkills
 *
 * Verifies that copyCommandsAsClaudeSkills rewrites ~/.claude/ and
 * $HOME/.claude/ paths in deployed SKILL.md files when a non-default
 * pathPrefix is supplied (local installs).  Also verifies that the
 * global pathPrefix (~/.claude/) is effectively a no-op.
 *
 * Regression test for #1734.
 */

process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  copyCommandsAsClaudeSkills,
} = require('../bin/install.js');

/**
 * Create a temporary directory with a mock command .md file.
 * Returns { srcDir, skillsDir, cleanup }.
 */
function scaffold(content) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-claude-skill-'));
  const srcDir = path.join(tmpDir, 'commands');
  const skillsDir = path.join(tmpDir, 'skills');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(skillsDir, { recursive: true });
  fs.writeFileSync(path.join(srcDir, 'example.md'), content);
  return {
    tmpDir,
    srcDir,
    skillsDir,
    cleanup() {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

// ─── Local install: paths are rewritten ─────────────────────────────────────

describe('copyCommandsAsClaudeSkills path replacement (local install)', () => {
  // A local install resolves to an absolute path like /project/.claude/
  // The regex replaces ~/.claude/ with that pathPrefix value.
  const localPrefix = '/tmp/myproject/.claude/';

  test('rewrites ~/.claude/ paths to local pathPrefix', (t) => {
    const source = [
      '---',
      'description: test command',
      '---',
      'Run: node "~/.claude/get-shit-done/bin/gsd-tools.cjs"',
    ].join('\n');

    const { srcDir, skillsDir, cleanup } = scaffold(source);
    t.after(cleanup);

    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', localPrefix, 'claude', false);

    const skillFile = path.join(skillsDir, 'gsd-example', 'SKILL.md');
    assert.ok(fs.existsSync(skillFile), 'SKILL.md should exist');

    const output = fs.readFileSync(skillFile, 'utf8');
    assert.ok(
      output.includes('/tmp/myproject/.claude/get-shit-done/bin/gsd-tools.cjs'),
      `Expected local path prefix in output, got:\n${output}`
    );
    assert.ok(
      !output.includes('~/.claude/'),
      `Should not contain ~/.claude/ after local replacement, got:\n${output}`
    );
  });

  test('rewrites $HOME/.claude/ paths to local pathPrefix', (t) => {
    const source = [
      '---',
      'description: test command',
      '---',
      'See $HOME/.claude/get-shit-done/workflows/foo.md for details.',
    ].join('\n');

    const { srcDir, skillsDir, cleanup } = scaffold(source);
    t.after(cleanup);

    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', localPrefix, 'claude', false);

    const skillFile = path.join(skillsDir, 'gsd-example', 'SKILL.md');
    const output = fs.readFileSync(skillFile, 'utf8');
    assert.ok(
      output.includes('/tmp/myproject/.claude/get-shit-done/workflows/foo.md'),
      `Expected local path prefix in output, got:\n${output}`
    );
    assert.ok(
      !output.includes('$HOME/.claude/'),
      `Should not contain $HOME/.claude/ after local replacement, got:\n${output}`
    );
  });

  test('rewrites both tilde and $HOME paths in the same file', (t) => {
    const source = [
      '---',
      'description: mixed paths',
      '---',
      'Tool: node "~/.claude/get-shit-done/bin/gsd-tools.cjs"',
      'Workflow: $HOME/.claude/get-shit-done/workflows/bar.md',
    ].join('\n');

    const { srcDir, skillsDir, cleanup } = scaffold(source);
    t.after(cleanup);

    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', localPrefix, 'claude', false);

    const skillFile = path.join(skillsDir, 'gsd-example', 'SKILL.md');
    const output = fs.readFileSync(skillFile, 'utf8');
    assert.ok(
      !output.includes('~/.claude/'),
      `Should not contain ~/.claude/ in output`
    );
    assert.ok(
      !output.includes('$HOME/.claude/'),
      `Should not contain $HOME/.claude/ in output`
    );
    // Both should now use the local prefix
    const matches = output.match(/\/tmp\/myproject\/\.claude\//g);
    assert.ok(
      matches && matches.length >= 2,
      `Expected at least 2 occurrences of local prefix, got: ${matches ? matches.length : 0}`
    );
  });
});

// ─── Global install: paths are unchanged (no-op) ───────────────────────────

describe('copyCommandsAsClaudeSkills path replacement (global install)', () => {
  const globalPrefix = '~/.claude/';

  test('global pathPrefix (~/.claude/) is a no-op for tilde paths', (t) => {
    const source = [
      '---',
      'description: global test',
      '---',
      'Run: node "~/.claude/get-shit-done/bin/gsd-tools.cjs"',
    ].join('\n');

    const { srcDir, skillsDir, cleanup } = scaffold(source);
    t.after(cleanup);

    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', globalPrefix, 'claude', true);

    const skillFile = path.join(skillsDir, 'gsd-example', 'SKILL.md');
    const output = fs.readFileSync(skillFile, 'utf8');
    assert.ok(
      output.includes('~/.claude/get-shit-done/bin/gsd-tools.cjs'),
      `Global install should preserve ~/.claude/ paths, got:\n${output}`
    );
  });

  test('global $HOME pathPrefix replaces $HOME with itself (no-op)', (t) => {
    const homePrefix = '$HOME/.claude/';
    const source = [
      '---',
      'description: global home test',
      '---',
      'See $HOME/.claude/get-shit-done/workflows/foo.md for details.',
    ].join('\n');

    const { srcDir, skillsDir, cleanup } = scaffold(source);
    t.after(cleanup);

    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', homePrefix, 'claude', true);

    const skillFile = path.join(skillsDir, 'gsd-example', 'SKILL.md');
    const output = fs.readFileSync(skillFile, 'utf8');
    assert.ok(
      output.includes('$HOME/.claude/get-shit-done/workflows/foo.md'),
      `Global install should preserve $HOME/.claude/ paths, got:\n${output}`
    );
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe('copyCommandsAsClaudeSkills path replacement edge cases', () => {
  test('content with no path references is unchanged', (t) => {
    const source = [
      '---',
      'description: no paths here',
      '---',
      'This command has no path references at all.',
    ].join('\n');

    const { srcDir, skillsDir, cleanup } = scaffold(source);
    t.after(cleanup);

    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', '.claude/get-shit-done/', 'claude', false);

    const skillFile = path.join(skillsDir, 'gsd-example', 'SKILL.md');
    const output = fs.readFileSync(skillFile, 'utf8');
    assert.ok(
      output.includes('This command has no path references at all.'),
      `Body content should be preserved`
    );
  });

  test('non-.md files in source dir are skipped', (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-claude-skip-'));
    const srcDir = path.join(tmpDir, 'commands');
    const skillsDir = path.join(tmpDir, 'skills');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'ignored.txt'), 'should be ignored');
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', '.claude/get-shit-done/', 'claude', false);

    // No skill directory should be created for the .txt file
    const entries = fs.readdirSync(skillsDir);
    assert.strictEqual(entries.length, 0, `No skills should be created for non-.md files`);
  });

  test('missing source directory does not throw', (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-claude-nodir-'));
    const skillsDir = path.join(tmpDir, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    // Should not throw when srcDir does not exist
    assert.doesNotThrow(() => {
      copyCommandsAsClaudeSkills(
        path.join(tmpDir, 'nonexistent'),
        skillsDir,
        'gsd',
        '.claude/get-shit-done/',
        'claude',
        false
      );
    });
  });
});
