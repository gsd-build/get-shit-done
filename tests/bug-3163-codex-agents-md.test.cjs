'use strict';

/**
 * Bug #3163: generate-claude-md should write to AGENTS.md on Codex runtime.
 *
 * When config.runtime === 'codex' (or GSD_RUNTIME=codex), the generate-claude-md
 * handler must resolve the output path to AGENTS.md, not CLAUDE.md.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('bug #3163: generate-claude-md uses AGENTS.md for Codex runtime', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      '# Test Project\n\nA Codex-hosted project.\n',
      'utf-8'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('writes to AGENTS.md when config.runtime is codex and no --output given', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ runtime: 'codex', claude_md_path: './CLAUDE.md' }),
      'utf-8'
    );

    const result = runGsdTools('generate-claude-md', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const realTmpDir = fs.realpathSync(tmpDir);
    const expectedAgentsPath = path.join(realTmpDir, 'AGENTS.md');

    // The returned path must be AGENTS.md, not CLAUDE.md
    assert.strictEqual(parsed.claude_md_path, expectedAgentsPath,
      `Expected output path to be AGENTS.md but got: ${parsed.claude_md_path}`
    );
    // AGENTS.md must exist on disk
    assert.ok(fs.existsSync(expectedAgentsPath), 'AGENTS.md must exist after generation');
    // CLAUDE.md must NOT be created
    assert.ok(!fs.existsSync(path.join(realTmpDir, 'CLAUDE.md')), 'CLAUDE.md must not be created for Codex runtime');
  });

  test('writes to AGENTS.md when GSD_RUNTIME=codex env var is set (env takes precedence over config)', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    // Config says runtime: claude but env overrides to codex
    fs.writeFileSync(
      configPath,
      JSON.stringify({ runtime: 'claude', claude_md_path: './CLAUDE.md' }),
      'utf-8'
    );

    const result = runGsdTools('generate-claude-md', tmpDir, { HOME: tmpDir, GSD_RUNTIME: 'codex' });
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const realTmpDir = fs.realpathSync(tmpDir);
    const expectedAgentsPath = path.join(realTmpDir, 'AGENTS.md');

    assert.strictEqual(parsed.claude_md_path, expectedAgentsPath,
      `Expected output path to be AGENTS.md but got: ${parsed.claude_md_path}`
    );
    assert.ok(fs.existsSync(expectedAgentsPath), 'AGENTS.md must exist after generation');
    assert.ok(!fs.existsSync(path.join(realTmpDir, 'CLAUDE.md')), 'CLAUDE.md must not be created when GSD_RUNTIME=codex');
  });

  test('--output flag overrides runtime detection when explicitly provided', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ runtime: 'codex', claude_md_path: './CLAUDE.md' }),
      'utf-8'
    );

    // When --output is explicitly provided, it must be honoured regardless of runtime
    const result = runGsdTools(
      ['generate-claude-md', '--output', 'EXPLICIT-OUTPUT.md'],
      tmpDir,
      { HOME: tmpDir }
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const realTmpDir = fs.realpathSync(tmpDir);
    assert.strictEqual(
      parsed.claude_md_path,
      path.join(realTmpDir, 'EXPLICIT-OUTPUT.md'),
      `Expected explicit --output to be honoured, got: ${parsed.claude_md_path}`
    );
  });

  test('non-codex runtime still writes to CLAUDE.md', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ runtime: 'claude', claude_md_path: './CLAUDE.md' }),
      'utf-8'
    );

    const result = runGsdTools('generate-claude-md', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `Command failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const realTmpDir = fs.realpathSync(tmpDir);
    assert.strictEqual(
      parsed.claude_md_path,
      path.join(realTmpDir, 'CLAUDE.md'),
      `Expected CLAUDE.md for claude runtime, got: ${parsed.claude_md_path}`
    );
    assert.ok(fs.existsSync(path.join(realTmpDir, 'CLAUDE.md')), 'CLAUDE.md must exist for claude runtime');
    assert.ok(!fs.existsSync(path.join(realTmpDir, 'AGENTS.md')), 'AGENTS.md must not be created for claude runtime');
  });
});
