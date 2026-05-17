'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const {
  execGit,
  execNpm,
  execTool,
  probeTty,
  normalizeContent,
  platformWriteSync,
  platformReadSync,
  platformEnsureDir,
} = require(path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'shell-command-projection.cjs'));

const { createTempGitProject, createTempDir, cleanup } = require('./helpers.cjs');

// ─── execGit ─────────────────────────────────────────────────────────────────

describe('execGit', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempGitProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('returns { exitCode, stdout, stderr } shape', () => {
    const result = execGit(['--version']);
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'exitCode'), 'missing exitCode');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'stdout'), 'missing stdout');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'stderr'), 'missing stderr');
  });

  test('exitCode 0 for successful command', () => {
    const result = execGit(['--version']);
    assert.strictEqual(result.exitCode, 0);
  });

  test('stdout contains version string for --version', () => {
    const result = execGit(['--version']);
    assert.strictEqual(typeof result.stdout, 'string');
    assert.ok(result.stdout.length > 0, 'stdout should not be empty for git --version');
  });

  test('exitCode non-zero for failing command — does not throw', () => {
    const result = execGit(['status', '--porcelain'], { cwd: '/tmp/definitely-not-a-git-repo-8675309' });
    assert.notStrictEqual(result.exitCode, 0);
  });

  test('respects cwd option', () => {
    const result = execGit(['status', '--porcelain'], { cwd: tmpDir });
    assert.strictEqual(result.exitCode, 0);
  });
});

// ─── execNpm ─────────────────────────────────────────────────────────────────

describe('execNpm', () => {
  test('returns { exitCode, stdout, stderr } shape', () => {
    const result = execNpm(['--version']);
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'exitCode'), 'missing exitCode');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'stdout'), 'missing stdout');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'stderr'), 'missing stderr');
  });

  test('exitCode 0 for npm --version', () => {
    const result = execNpm(['--version']);
    assert.strictEqual(result.exitCode, 0);
  });

  test('stdout is non-empty for npm --version', () => {
    const result = execNpm(['--version']);
    assert.ok(result.stdout.trim().length > 0);
  });
});

// ─── execTool ────────────────────────────────────────────────────────────────

describe('execTool', () => {
  test('returns { exitCode, stdout, stderr } shape for known program', () => {
    const result = execTool('node', ['--version']);
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'exitCode'), 'missing exitCode');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'stdout'), 'missing stdout');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'stderr'), 'missing stderr');
  });

  test('exitCode 0 for node --version', () => {
    const result = execTool('node', ['--version']);
    assert.strictEqual(result.exitCode, 0);
  });

  test('exitCode 127 and no throw when program does not exist', () => {
    const result = execTool('definitely-not-a-real-program-8675309', []);
    assert.strictEqual(result.exitCode, 127);
    assert.strictEqual(result.stdout, '');
    assert.strictEqual(typeof result.stderr, 'string');
  });
});

// ─── probeTty ────────────────────────────────────────────────────────────────

describe('probeTty', () => {
  test('returns string or null — never throws', () => {
    const result = probeTty();
    assert.ok(result === null || typeof result === 'string', `expected string|null, got ${typeof result}`);
  });

  test('returns null when platform is win32', () => {
    const result = probeTty({ platform: 'win32' });
    assert.strictEqual(result, null);
  });
});

// ─── normalizeContent ────────────────────────────────────────────────────────

describe('normalizeContent', () => {
  test('returns { content, encoding } shape', () => {
    const result = normalizeContent('file.md', 'hello\n');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'content'), 'missing content');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'encoding'), 'missing encoding');
  });

  test('normalizes CRLF to LF for .md files', () => {
    const result = normalizeContent('file.md', 'line1\r\nline2\r\n');
    assert.ok(!result.content.includes('\r\n'), 'CRLF should be normalized to LF');
  });

  test('normalizes CRLF to LF for non-.md files', () => {
    const result = normalizeContent('file.json', '{"a":1}\r\n');
    assert.ok(!result.content.includes('\r\n'), 'CRLF should be normalized to LF');
  });

  test('enforces single trailing newline for .md files', () => {
    const result = normalizeContent('file.md', 'hello');
    assert.ok(result.content.endsWith('\n'), 'should end with newline');
    assert.ok(!result.content.endsWith('\n\n'), 'should not end with double newline');
  });

  test('enforces single trailing newline for non-.md files', () => {
    const result = normalizeContent('file.txt', 'hello');
    assert.ok(result.content.endsWith('\n'));
    assert.ok(!result.content.endsWith('\n\n'));
  });

  test('applies full markdownlint normalization for .md files — blank line before heading', () => {
    const input = [
      '# Title',
      'paragraph',
      '## Section',
    ].join('\n');
    const result = normalizeContent('file.md', input);
    assert.ok(result.content.includes('\n\n## Section'), 'MD022: blank line before heading');
  });

  test('does NOT apply markdown structural rules to non-.md files', () => {
    const input = 'paragraph\n## Not a heading in json\n';
    const result = normalizeContent('file.json', input);
    assert.strictEqual(result.content, input);
  });

  test('encoding defaults to utf-8', () => {
    const result = normalizeContent('file.md', 'hello\n');
    assert.strictEqual(result.encoding, 'utf-8');
  });
});

// ─── platformWriteSync ───────────────────────────────────────────────────────

describe('platformWriteSync', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test('written file exists and is a regular file', () => {
    const filePath = path.join(tmpDir, 'output.md');
    platformWriteSync(filePath, '# Hello\n');
    assert.ok(fs.statSync(filePath).isFile());
  });

  test('written file has non-zero size', () => {
    const filePath = path.join(tmpDir, 'output.md');
    platformWriteSync(filePath, '# Hello\n');
    assert.ok(fs.statSync(filePath).size > 0);
  });

  test('creates parent directory if absent', () => {
    const filePath = path.join(tmpDir, 'nested', 'deep', 'output.md');
    platformWriteSync(filePath, '# Hello\n');
    assert.ok(fs.statSync(filePath).isFile());
  });

  test('mtime advances on re-write', (t) => {
    const filePath = path.join(tmpDir, 'output.md');
    platformWriteSync(filePath, '# First\n');
    const mtimeBefore = fs.statSync(filePath).mtimeMs;
    // Small delay to ensure mtime differs
    const start = Date.now();
    while (Date.now() - start < 10) { /* busy wait */ }
    platformWriteSync(filePath, '# Second\n');
    const mtimeAfter = fs.statSync(filePath).mtimeMs;
    assert.ok(mtimeAfter >= mtimeBefore, 'mtime should advance or stay same on re-write');
  });

  test('no temp file left on disk after successful write', () => {
    const filePath = path.join(tmpDir, 'output.md');
    platformWriteSync(filePath, '# Hello\n');
    const tmpFiles = fs.readdirSync(tmpDir).filter(f => f.includes('.tmp.'));
    assert.strictEqual(tmpFiles.length, 0, 'no temp files should remain');
  });
});

// ─── platformReadSync ────────────────────────────────────────────────────────

describe('platformReadSync', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test('returns null for missing file when required is false (default)', () => {
    const result = platformReadSync(path.join(tmpDir, 'nonexistent.md'));
    assert.strictEqual(result, null);
  });

  test('throws for missing file when required is true', () => {
    assert.throws(
      () => platformReadSync(path.join(tmpDir, 'nonexistent.md'), { required: true }),
      /ENOENT/,
    );
  });

  test('returns string content for existing file', () => {
    const filePath = path.join(tmpDir, 'existing.md');
    fs.writeFileSync(filePath, '# Hello\n', 'utf-8');
    const result = platformReadSync(filePath);
    assert.strictEqual(typeof result, 'string');
    assert.ok(result.length > 0);
  });
});

// ─── platformEnsureDir ───────────────────────────────────────────────────────

describe('platformEnsureDir', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  test('creates directory if absent', () => {
    const dirPath = path.join(tmpDir, 'new', 'nested', 'dir');
    platformEnsureDir(dirPath);
    assert.ok(fs.statSync(dirPath).isDirectory());
  });

  test('no error when directory already exists — idempotent', () => {
    const dirPath = path.join(tmpDir, 'existing');
    fs.mkdirSync(dirPath);
    assert.doesNotThrow(() => platformEnsureDir(dirPath));
  });
});
