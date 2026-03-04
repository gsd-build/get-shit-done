/**
 * GSD Tools Tests - install-flow.test.cjs
 *
 * Tests for install/uninstall flow functions: copyWithPathReplacement,
 * copyFlattenedCommands, cleanupOrphanedFiles, and getDirName.
 * Uses temp directories for all file-system operations.
 */

// Enable test exports from install.js (skips main CLI logic)
process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  getDirName,
  copyWithPathReplacement,
  copyFlattenedCommands,
  cleanupOrphanedFiles,
} = require('../bin/install.js');

// ─── getDirName ──────────────────────────────────────────────────────────────

describe('getDirName', () => {
  test("'claude' returns '.claude'", () => {
    assert.strictEqual(getDirName('claude'), '.claude');
  });

  test("'opencode' returns '.opencode'", () => {
    assert.strictEqual(getDirName('opencode'), '.opencode');
  });

  test("'gemini' returns '.gemini'", () => {
    assert.strictEqual(getDirName('gemini'), '.gemini');
  });

  test("'codex' returns '.codex'", () => {
    assert.strictEqual(getDirName('codex'), '.codex');
  });
});

// ─── copyWithPathReplacement ─────────────────────────────────────────────────

describe('copyWithPathReplacement (claude runtime)', () => {
  let tmpDir, srcDir, destDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-flow-'));
    srcDir = path.join(tmpDir, 'src');
    destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(srcDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('copies .md file and replaces ~/.claude/ with pathPrefix', () => {
    fs.writeFileSync(path.join(srcDir, 'test.md'), 'See ~/.claude/foo');
    copyWithPathReplacement(srcDir, destDir, '/test/path/', 'claude');

    const content = fs.readFileSync(path.join(destDir, 'test.md'), 'utf8');
    assert.ok(content.includes('/test/path/foo'), 'replaces ~/.claude/ with pathPrefix');
    assert.ok(!content.includes('~/.claude/'), 'removes original ~/.claude/ reference');
  });

  test('copies .md file and replaces ./.claude/ with ./dirName/', () => {
    fs.writeFileSync(path.join(srcDir, 'test.md'), 'Path: ./.claude/commands');
    copyWithPathReplacement(srcDir, destDir, '/test/path/', 'claude');

    const content = fs.readFileSync(path.join(destDir, 'test.md'), 'utf8');
    assert.ok(content.includes('./.claude/commands'), 'claude keeps ./.claude/ (same dir name)');
  });

  test('copies non-.md files as-is (binary copy)', () => {
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff]);
    fs.writeFileSync(path.join(srcDir, 'icon.png'), binaryData);
    copyWithPathReplacement(srcDir, destDir, '/test/path/', 'claude');

    const result = fs.readFileSync(path.join(destDir, 'icon.png'));
    assert.deepStrictEqual(result, binaryData, 'binary file copied unchanged');
  });

  test('copies .txt file as-is', () => {
    const txtContent = 'Just a text file with ~/.claude/ reference';
    fs.writeFileSync(path.join(srcDir, 'readme.txt'), txtContent);
    copyWithPathReplacement(srcDir, destDir, '/test/path/', 'claude');

    const result = fs.readFileSync(path.join(destDir, 'readme.txt'), 'utf8');
    assert.strictEqual(result, txtContent, 'non-.md text file copied without path replacement');
  });

  test('recurses into subdirectories', () => {
    const subDir = path.join(srcDir, 'subdir');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'nested.md'), 'See ~/.claude/bar');
    copyWithPathReplacement(srcDir, destDir, '/test/path/', 'claude');

    const nestedPath = path.join(destDir, 'subdir', 'nested.md');
    assert.ok(fs.existsSync(nestedPath), 'nested file exists in dest');
    const content = fs.readFileSync(nestedPath, 'utf8');
    assert.ok(content.includes('/test/path/bar'), 'path replacement applied in nested file');
  });

  test('cleans dest directory before copying (removes old files)', () => {
    // Create a stale file in destDir before the copy
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, 'stale.md'), 'old content');
    fs.writeFileSync(path.join(srcDir, 'new.md'), 'new content');

    copyWithPathReplacement(srcDir, destDir, '/test/path/', 'claude');

    assert.ok(!fs.existsSync(path.join(destDir, 'stale.md')), 'stale file removed');
    assert.ok(fs.existsSync(path.join(destDir, 'new.md')), 'new file exists');
  });
});

describe('copyWithPathReplacement (opencode runtime)', () => {
  let tmpDir, srcDir, destDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-flow-oc-'));
    srcDir = path.join(tmpDir, 'src');
    destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(srcDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('applies convertClaudeToOpencodeFrontmatter and path replacement', () => {
    const content = [
      '---',
      'description: Test command',
      'tools: AskUserQuestion',
      '---',
      'Body with ~/.claude/ path',
    ].join('\n');
    fs.writeFileSync(path.join(srcDir, 'cmd.md'), content);

    copyWithPathReplacement(srcDir, destDir, '/oc/path/', 'opencode');

    const result = fs.readFileSync(path.join(destDir, 'cmd.md'), 'utf8');
    // OpenCode frontmatter conversion changes AskUserQuestion -> question
    assert.ok(result.includes('question: true'), 'tool name converted to opencode format');
    // Path replacement still occurs
    assert.ok(result.includes('/oc/path/'), 'path replacement applied');
    assert.ok(!result.includes('~/.claude/'), 'original path removed');
  });

  test('replaces ./.claude/ with ./.opencode/ for opencode', () => {
    fs.writeFileSync(path.join(srcDir, 'test.md'), 'local ref: ./.claude/foo');
    copyWithPathReplacement(srcDir, destDir, '/oc/path/', 'opencode');

    const result = fs.readFileSync(path.join(destDir, 'test.md'), 'utf8');
    assert.ok(result.includes('./.opencode/foo'), 'local path uses .opencode dir');
  });
});

describe('copyWithPathReplacement (gemini runtime, isCommand=true)', () => {
  let tmpDir, srcDir, destDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-flow-gem-'));
    srcDir = path.join(tmpDir, 'src');
    destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(srcDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('converts .md to .toml file (isCommand=true)', () => {
    const content = [
      '---',
      'description: Test Gemini command',
      '---',
      'Body text with ~/.claude/ path',
    ].join('\n');
    fs.writeFileSync(path.join(srcDir, 'cmd.md'), content);

    copyWithPathReplacement(srcDir, destDir, '/gem/path/', 'gemini', true);

    // Source .md -> dest .toml
    assert.ok(!fs.existsSync(path.join(destDir, 'cmd.md')), '.md file not in dest');
    assert.ok(fs.existsSync(path.join(destDir, 'cmd.toml')), '.toml file created');

    const tomlContent = fs.readFileSync(path.join(destDir, 'cmd.toml'), 'utf8');
    assert.ok(tomlContent.includes('description ='), 'toml has description field');
    assert.ok(tomlContent.includes('prompt ='), 'toml has prompt field');
  });
});

describe('copyWithPathReplacement (gemini runtime, isCommand=false)', () => {
  let tmpDir, srcDir, destDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-flow-gem2-'));
    srcDir = path.join(tmpDir, 'src');
    destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(srcDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('copies .md files with path replacement (no TOML conversion)', () => {
    fs.writeFileSync(path.join(srcDir, 'agent.md'), 'See ~/.claude/agents');
    copyWithPathReplacement(srcDir, destDir, '/gem/path/', 'gemini', false);

    assert.ok(fs.existsSync(path.join(destDir, 'agent.md')), '.md file preserved');
    assert.ok(!fs.existsSync(path.join(destDir, 'agent.toml')), 'no .toml created');

    const content = fs.readFileSync(path.join(destDir, 'agent.md'), 'utf8');
    assert.ok(content.includes('/gem/path/agents'), 'path replacement applied');
  });
});

describe('copyWithPathReplacement (codex runtime)', () => {
  let tmpDir, srcDir, destDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-flow-cx-'));
    srcDir = path.join(tmpDir, 'src');
    destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(srcDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('applies convertClaudeToCodexMarkdown (/gsd: -> $gsd-)', () => {
    fs.writeFileSync(path.join(srcDir, 'skill.md'), 'Run /gsd:execute-phase to proceed');
    copyWithPathReplacement(srcDir, destDir, '/cx/path/', 'codex');

    const result = fs.readFileSync(path.join(destDir, 'skill.md'), 'utf8');
    assert.ok(result.includes('$gsd-execute-phase'), 'slash command converted to skill mention');
    assert.ok(!result.includes('/gsd:execute-phase'), 'original slash command removed');
  });

  test('path replacement applied before codex conversion', () => {
    fs.writeFileSync(path.join(srcDir, 'skill.md'), 'Path: ~/.claude/foo');
    copyWithPathReplacement(srcDir, destDir, '/cx/path/', 'codex');

    const result = fs.readFileSync(path.join(destDir, 'skill.md'), 'utf8');
    assert.ok(result.includes('/cx/path/foo'), 'path replacement applied');
  });

  test('replaces ./.claude/ with ./.codex/ for codex', () => {
    fs.writeFileSync(path.join(srcDir, 'test.md'), 'local ref: ./.claude/foo');
    copyWithPathReplacement(srcDir, destDir, '/cx/path/', 'codex');

    const result = fs.readFileSync(path.join(destDir, 'test.md'), 'utf8');
    assert.ok(result.includes('./.codex/foo'), 'local path uses .codex dir');
  });
});

// ─── copyFlattenedCommands ────────────────────────────────────────────────────

describe('copyFlattenedCommands', () => {
  let tmpDir, srcDir, destDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-flow-flat-'));
    srcDir = path.join(tmpDir, 'src');
    destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(srcDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('flattens help.md to gsd-help.md', () => {
    const mdContent = '---\ndescription: Test\n---\nBody with ~/.claude/ path';
    fs.writeFileSync(path.join(srcDir, 'help.md'), mdContent);

    copyFlattenedCommands(srcDir, destDir, 'gsd', '/test/', 'claude');

    assert.ok(fs.existsSync(path.join(destDir, 'gsd-help.md')), 'gsd-help.md created');
  });

  test('flattens nested debug/start.md to gsd-debug-start.md', () => {
    const debugDir = path.join(srcDir, 'debug');
    fs.mkdirSync(debugDir);
    fs.writeFileSync(path.join(debugDir, 'start.md'), '---\ndescription: Start\n---\nContent');

    copyFlattenedCommands(srcDir, destDir, 'gsd', '/test/', 'claude');

    assert.ok(fs.existsSync(path.join(destDir, 'gsd-debug-start.md')), 'gsd-debug-start.md created');
  });

  test('applies path replacement during flatten', () => {
    fs.writeFileSync(path.join(srcDir, 'cmd.md'), '---\ndescription: Test\n---\nSee ~/.claude/foo');

    copyFlattenedCommands(srcDir, destDir, 'gsd', '/test/', 'claude');

    const content = fs.readFileSync(path.join(destDir, 'gsd-cmd.md'), 'utf8');
    assert.ok(content.includes('/test/foo'), 'path replaced in flattened file');
    assert.ok(!content.includes('~/.claude/'), 'original path removed');
  });

  test('removes old gsd-*.md before copying (clean install)', () => {
    // Create a stale gsd-old.md in destDir
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, 'gsd-old.md'), 'stale command');
    // Create a non-gsd file that should survive
    fs.writeFileSync(path.join(destDir, 'other-cmd.md'), 'user command');

    fs.writeFileSync(path.join(srcDir, 'new.md'), '---\ndescription: New\n---\nContent');

    copyFlattenedCommands(srcDir, destDir, 'gsd', '/test/', 'claude');

    assert.ok(!fs.existsSync(path.join(destDir, 'gsd-old.md')), 'stale gsd-*.md removed');
    assert.ok(fs.existsSync(path.join(destDir, 'other-cmd.md')), 'non-gsd file preserved');
    assert.ok(fs.existsSync(path.join(destDir, 'gsd-new.md')), 'new gsd file created');
  });

  test('creates dest directory if it does not exist', () => {
    fs.writeFileSync(path.join(srcDir, 'help.md'), '---\ndescription: Help\n---\nContent');

    // Ensure destDir does NOT exist
    assert.ok(!fs.existsSync(destDir), 'destDir should not exist before call');

    copyFlattenedCommands(srcDir, destDir, 'gsd', '/test/', 'claude');

    assert.ok(fs.existsSync(destDir), 'destDir created by function');
    assert.ok(fs.existsSync(path.join(destDir, 'gsd-help.md')), 'file written to new destDir');
  });

  test('does nothing if srcDir does not exist', () => {
    const nonExistentSrc = path.join(tmpDir, 'no-such-dir');
    // Should not throw
    assert.doesNotThrow(() => {
      copyFlattenedCommands(nonExistentSrc, destDir, 'gsd', '/test/', 'claude');
    });
  });
});

// ─── cleanupOrphanedFiles ────────────────────────────────────────────────────

describe('cleanupOrphanedFiles', () => {
  let tmpDir, configDir, hooksDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-flow-orphan-'));
    configDir = path.join(tmpDir, 'config');
    hooksDir = path.join(configDir, 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('removes hooks/gsd-notify.sh if it exists', () => {
    const filePath = path.join(hooksDir, 'gsd-notify.sh');
    fs.writeFileSync(filePath, '#!/bin/bash\necho notify');

    cleanupOrphanedFiles(configDir);

    assert.ok(!fs.existsSync(filePath), 'gsd-notify.sh removed');
  });

  test('removes hooks/statusline.js if it exists', () => {
    const filePath = path.join(hooksDir, 'statusline.js');
    fs.writeFileSync(filePath, '// old statusline');

    cleanupOrphanedFiles(configDir);

    assert.ok(!fs.existsSync(filePath), 'statusline.js removed');
  });

  test('does not error on missing files', () => {
    // hooksDir exists but orphaned files do not
    assert.doesNotThrow(() => {
      cleanupOrphanedFiles(configDir);
    });
  });

  test('does not remove other hook files (gsd-statusline.js preserved)', () => {
    const keepPath = path.join(hooksDir, 'gsd-statusline.js');
    fs.writeFileSync(keepPath, '// current statusline');

    cleanupOrphanedFiles(configDir);

    assert.ok(fs.existsSync(keepPath), 'gsd-statusline.js preserved');
  });

  test('removes both orphaned files when both exist', () => {
    const notifyPath = path.join(hooksDir, 'gsd-notify.sh');
    const statuslinePath = path.join(hooksDir, 'statusline.js');
    const keepPath = path.join(hooksDir, 'gsd-statusline.js');

    fs.writeFileSync(notifyPath, '#!/bin/bash');
    fs.writeFileSync(statuslinePath, '// old');
    fs.writeFileSync(keepPath, '// current');

    cleanupOrphanedFiles(configDir);

    assert.ok(!fs.existsSync(notifyPath), 'gsd-notify.sh removed');
    assert.ok(!fs.existsSync(statuslinePath), 'statusline.js removed');
    assert.ok(fs.existsSync(keepPath), 'gsd-statusline.js kept');
  });
});
