// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * GSD Tests - path replacement in install.js
 *
 * Verifies that global installs produce $HOME/ paths in .md files,
 * so that shell commands expand correctly inside double quotes.
 * ~ does NOT expand inside double quotes in POSIX shells, causing
 * MODULE_NOT_FOUND errors (see #1284).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const repoRoot = path.join(__dirname, '..');

// Simulate the pathPrefix computation from install.js (global install)
function computePathPrefix(homedir, targetDir) {
  const resolvedTarget = path.resolve(targetDir).replace(/\\/g, '/');
  const homeDir = homedir.replace(/\\/g, '/');
  if (resolvedTarget.startsWith(homeDir)) {
    return '$HOME' + resolvedTarget.slice(homeDir.length) + '/';
  }
  return resolvedTarget + '/';
}

describe('pathPrefix computation', () => {
  test('default Claude global install uses $HOME/', () => {
    const homedir = os.homedir();
    const targetDir = path.join(homedir, '.claude');
    const prefix = computePathPrefix(homedir, targetDir);
    assert.strictEqual(prefix, '$HOME/.claude/');
  });

  test('default Gemini global install uses $HOME/', () => {
    const homedir = os.homedir();
    const targetDir = path.join(homedir, '.gemini');
    const prefix = computePathPrefix(homedir, targetDir);
    assert.strictEqual(prefix, '$HOME/.gemini/');
  });

  test('custom config dir under home uses $HOME/', () => {
    const homedir = os.homedir();
    const targetDir = path.join(homedir, '.config', 'claude');
    const prefix = computePathPrefix(homedir, targetDir);
    assert.ok(prefix.startsWith('$HOME/'), `Expected $HOME/ prefix, got: ${prefix}`);
    assert.ok(!prefix.includes(homedir), `Should not contain homedir: ${homedir}`);
  });

  test('Windows-style paths produce $HOME/ not C:/', () => {
    // On Windows, path.resolve returns the input unchanged when it's already absolute.
    // Simulate the string operation directly (can't use path.resolve for Windows paths on macOS/Linux).
    const winHomedir = 'C:\\Users\\matte';
    const winTargetDir = 'C:\\Users\\matte\\.claude';
    const resolvedTarget = winTargetDir.replace(/\\/g, '/');
    const homeDir = winHomedir.replace(/\\/g, '/');
    const prefix = resolvedTarget.startsWith(homeDir)
      ? '$HOME' + resolvedTarget.slice(homeDir.length) + '/'
      : resolvedTarget + '/';
    assert.strictEqual(prefix, '$HOME/.claude/');
    assert.ok(!prefix.includes('C:'), `Should not contain drive letter, got: ${prefix}`);
  });

  test('target outside home uses absolute path', () => {
    const homedir = '/home/user';
    const targetDir = '/opt/gsd/.claude';
    // path.resolve won't change an already-absolute path on the same OS,
    // so simulate the string operation directly
    const resolvedTarget = targetDir.replace(/\\/g, '/');
    const homeDir = homedir.replace(/\\/g, '/');
    const prefix = resolvedTarget.startsWith(homeDir)
      ? '$HOME' + resolvedTarget.slice(homeDir.length) + '/'
      : resolvedTarget + '/';
    assert.strictEqual(prefix, '/opt/gsd/.claude/');
    assert.ok(!prefix.includes('$HOME'), `Should not contain $HOME for non-home paths`);
  });

  test('$HOME expands inside double-quoted shell commands', () => {
    // This is the core regression test for #1284:
    // ~ does NOT expand inside double quotes in POSIX shells,
    // but $HOME does expand inside double quotes.
    const homedir = os.homedir();
    const targetDir = path.join(homedir, '.claude');
    const prefix = computePathPrefix(homedir, targetDir);
    // Verify the prefix uses $HOME, not ~
    assert.ok(!prefix.startsWith('~/'), `pathPrefix must not use ~ (breaks in double-quoted shell commands), got: ${prefix}`);
    assert.ok(prefix.startsWith('$HOME/'), `pathPrefix must use $HOME for shell expansion, got: ${prefix}`);
  });
});

describe('source .md files have no quoted-tilde shell patterns', () => {
  function collectMdFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectMdFiles(fullPath));
      } else if (entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const dirsToCheck = ['commands', 'get-shit-done', 'agents'].map(d => path.join(repoRoot, d));
  const mdFiles = dirsToCheck.flatMap(collectMdFiles);

  test('source .md files exist', () => {
    assert.ok(mdFiles.length > 0, `Expected .md files, found ${mdFiles.length}`);
  });

  test('no .md file contains node "~/ pattern (quoted tilde breaks shell expansion)', () => {
    const quotedTildePattern = /node\s+"~\//;
    const failures = [];
    for (const file of mdFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (quotedTildePattern.test(content)) {
        failures.push(path.relative(repoRoot, file));
      }
    }
    assert.deepStrictEqual(failures, [], `Files with quoted-tilde node paths: ${failures.join(', ')}`);
  });
});

describe('installed .md files contain no resolved absolute paths', () => {
  const homedir = os.homedir();
  const targetDir = path.join(homedir, '.claude');
  const pathPrefix = computePathPrefix(homedir, targetDir);
  const claudeDirRegex = /~\/\.claude\//g;
  const claudeHomeRegex = /\$HOME\/\.claude\//g;
  const normalizedHomedir = homedir.replace(/\\/g, '/');

  function collectMdFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectMdFiles(fullPath));
      } else if (entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const dirsToCheck = ['commands', 'get-shit-done', 'agents'].map(d => path.join(repoRoot, d));
  const mdFiles = dirsToCheck.flatMap(collectMdFiles);

  test('after replacement, no .md file contains os.homedir()', () => {
    const failures = [];
    for (const file of mdFiles) {
      let content = fs.readFileSync(file, 'utf8');
      content = content.replace(claudeDirRegex, pathPrefix);
      content = content.replace(claudeHomeRegex, pathPrefix);
      if (content.includes(normalizedHomedir) && normalizedHomedir !== '$HOME') {
        failures.push(path.relative(repoRoot, file));
      }
    }
    assert.deepStrictEqual(failures, [], `Files with resolved absolute paths: ${failures.join(', ')}`);
  });
});
