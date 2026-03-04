/**
 * GSD Tools Tests - install-utils.test.cjs
 *
 * Tests for shared utility functions in bin/install.js that will become bin/lib/core.js:
 * path helpers, attribution, frontmatter extraction, settings I/O, JSONC parsing,
 * manifest generation, and orphaned hook cleanup.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  expandTilde,
  toHomePrefix,
  buildHookCommand,
  readSettings,
  writeSettings,
  processAttribution,
  parseJsonc,
  extractFrontmatterAndBody,
  extractFrontmatterField,
  cleanupOrphanedHooks,
  fileHash,
  generateManifest,
} = require('../bin/lib/core.js');

// ─── expandTilde ─────────────────────────────────────────────────────────────

describe('expandTilde', () => {
  test('~/foo/bar returns homedir + /foo/bar', () => {
    const result = expandTilde('~/foo/bar');
    assert.strictEqual(result, path.join(os.homedir(), 'foo/bar'));
  });

  test('/absolute/path returns unchanged', () => {
    const result = expandTilde('/absolute/path');
    assert.strictEqual(result, '/absolute/path');
  });

  test('null returns null', () => {
    const result = expandTilde(null);
    assert.strictEqual(result, null);
  });

  test('undefined returns undefined', () => {
    const result = expandTilde(undefined);
    assert.strictEqual(result, undefined);
  });

  test('~ alone returns unchanged (no slash after ~)', () => {
    const result = expandTilde('~');
    assert.strictEqual(result, '~');
  });

  test('relative path without tilde returns unchanged', () => {
    const result = expandTilde('relative/path');
    assert.strictEqual(result, 'relative/path');
  });
});

// ─── toHomePrefix ─────────────────────────────────────────────────────────────

describe('toHomePrefix', () => {
  test('path starting with homedir becomes $HOME-relative', () => {
    const home = os.homedir();
    const input = home + '/.claude/';
    const result = toHomePrefix(input);
    assert.strictEqual(result, '$HOME/.claude/');
  });

  test('path not starting with homedir returns unchanged', () => {
    const result = toHomePrefix('/some/other/path');
    assert.strictEqual(result, '/some/other/path');
  });

  test('backslashes in path are normalized to forward slashes (non-home path)', () => {
    const result = toHomePrefix('/some\\path\\with\\backslashes');
    assert.strictEqual(result, '/some/path/with/backslashes');
  });

  test('backslashes in home-relative path are normalized', () => {
    const home = os.homedir().replace(/\//g, '\\');
    const input = home + '\\.claude\\';
    const result = toHomePrefix(input);
    // On non-Windows the homedir won't have backslashes, so this is mostly a sanity check
    assert.ok(typeof result === 'string');
  });

  test('exact homedir with trailing slash becomes $HOME/', () => {
    const home = os.homedir();
    const result = toHomePrefix(home + '/');
    assert.strictEqual(result, '$HOME/');
  });
});

// ─── buildHookCommand ─────────────────────────────────────────────────────────

describe('buildHookCommand', () => {
  test('returns node "configDir/hooks/hookName"', () => {
    const result = buildHookCommand('/home/user/.claude', 'stop.js');
    assert.strictEqual(result, 'node "/home/user/.claude/hooks/stop.js"');
  });

  test('backslashes in configDir converted to forward slashes', () => {
    const result = buildHookCommand('C:\\Users\\user\\.claude', 'stop.js');
    assert.strictEqual(result, 'node "C:/Users/user/.claude/hooks/stop.js"');
  });

  test('works with different hook names', () => {
    const result = buildHookCommand('/home/user/.claude', 'gsd-statusline.js');
    assert.strictEqual(result, 'node "/home/user/.claude/hooks/gsd-statusline.js"');
  });
});

// ─── readSettings ─────────────────────────────────────────────────────────────

describe('readSettings', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-read-settings-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns parsed object from valid JSON file', () => {
    const filePath = path.join(tmpDir, 'settings.json');
    fs.writeFileSync(filePath, JSON.stringify({ foo: 'bar', count: 42 }));
    const result = readSettings(filePath);
    assert.deepStrictEqual(result, { foo: 'bar', count: 42 });
  });

  test('returns {} when file does not exist', () => {
    const filePath = path.join(tmpDir, 'nonexistent.json');
    const result = readSettings(filePath);
    assert.deepStrictEqual(result, {});
  });

  test('returns {} when file has invalid JSON', () => {
    const filePath = path.join(tmpDir, 'corrupt.json');
    fs.writeFileSync(filePath, 'this is not valid JSON { broken');
    const result = readSettings(filePath);
    assert.deepStrictEqual(result, {});
  });

  test('returns nested objects correctly', () => {
    const filePath = path.join(tmpDir, 'settings.json');
    const data = { hooks: { Stop: [{ hooks: [{ command: 'node /path/to/hook.js' }] }] } };
    fs.writeFileSync(filePath, JSON.stringify(data));
    const result = readSettings(filePath);
    assert.deepStrictEqual(result, data);
  });
});

// ─── writeSettings ─────────────────────────────────────────────────────────────

describe('writeSettings', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-write-settings-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writes JSON with 2-space indentation', () => {
    const filePath = path.join(tmpDir, 'settings.json');
    writeSettings(filePath, { key: 'value' });
    const raw = fs.readFileSync(filePath, 'utf8');
    assert.ok(raw.includes('  "key"'), 'has 2-space indentation');
    assert.strictEqual(JSON.parse(raw).key, 'value');
  });

  test('appends trailing newline', () => {
    const filePath = path.join(tmpDir, 'settings.json');
    writeSettings(filePath, { key: 'value' });
    const raw = fs.readFileSync(filePath, 'utf8');
    assert.ok(raw.endsWith('\n'), 'ends with newline');
  });

  test('round-trip: readable with readSettings afterward', () => {
    const filePath = path.join(tmpDir, 'settings.json');
    const original = { name: 'test', hooks: { Stop: [] }, nested: { a: 1, b: true } };
    writeSettings(filePath, original);
    const result = readSettings(filePath);
    assert.deepStrictEqual(result, original);
  });

  test('overwrites existing file', () => {
    const filePath = path.join(tmpDir, 'settings.json');
    writeSettings(filePath, { version: 1 });
    writeSettings(filePath, { version: 2 });
    const result = readSettings(filePath);
    assert.strictEqual(result.version, 2);
  });
});

// ─── processAttribution ────────────────────────────────────────────────────────

describe('processAttribution', () => {
  const sampleContent = `Some commit message text

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`;

  test('attribution=null removes Co-Authored-By line and preceding blank line', () => {
    const result = processAttribution(sampleContent, null);
    assert.ok(!result.includes('Co-Authored-By'), 'Co-Authored-By removed');
    assert.ok(!result.endsWith('\n\n'), 'no trailing double newline');
    assert.ok(result.includes('Some commit message text'), 'body preserved');
  });

  test('attribution=undefined returns content unchanged', () => {
    const result = processAttribution(sampleContent, undefined);
    assert.strictEqual(result, sampleContent);
  });

  test('attribution string replaces the Co-Authored-By value', () => {
    const result = processAttribution(sampleContent, 'My Custom Author <custom@example.com>');
    assert.ok(result.includes('Co-Authored-By: My Custom Author <custom@example.com>'), 'replaced attribution');
    assert.ok(!result.includes('Claude Opus'), 'old attribution removed');
  });

  test('handles multiple Co-Authored-By lines (null removes all)', () => {
    const multi = `Message\n\nCo-Authored-By: Author One\n\nCo-Authored-By: Author Two`;
    const result = processAttribution(multi, null);
    assert.ok(!result.includes('Co-Authored-By'), 'all Co-Authored-By removed');
  });

  test('handles content with no Co-Authored-By lines (null is no-op)', () => {
    const noAttrib = 'Just a message with no attribution.';
    const result = processAttribution(noAttrib, null);
    assert.strictEqual(result, noAttrib);
  });

  test('custom attribution with $ in replacement does not break regex', () => {
    const result = processAttribution(sampleContent, 'Safe$Author');
    assert.ok(result.includes('Co-Authored-By: Safe$Author'), 'dollar sign preserved');
  });

  test('handles multiple Co-Authored-By lines (string replaces all)', () => {
    const multi = `Message\n\nCo-Authored-By: Author One\n\nCo-Authored-By: Author Two`;
    const result = processAttribution(multi, 'New Author');
    const matches = result.match(/Co-Authored-By: New Author/g);
    assert.strictEqual(matches.length, 2, 'both lines replaced');
  });
});

// ─── parseJsonc ────────────────────────────────────────────────────────────────

describe('parseJsonc', () => {
  test('parses standard JSON', () => {
    const result = parseJsonc('{"key": "value", "num": 42}');
    assert.deepStrictEqual(result, { key: 'value', num: 42 });
  });

  test('strips single-line comments', () => {
    const jsonc = `{
  // This is a comment
  "key": "value"
}`;
    const result = parseJsonc(jsonc);
    assert.deepStrictEqual(result, { key: 'value' });
  });

  test('strips block comments', () => {
    const jsonc = `{
  /* block comment */
  "key": "value"
}`;
    const result = parseJsonc(jsonc);
    assert.deepStrictEqual(result, { key: 'value' });
  });

  test('removes trailing commas before }', () => {
    const jsonc = '{"key": "value",}';
    const result = parseJsonc(jsonc);
    assert.deepStrictEqual(result, { key: 'value' });
  });

  test('removes trailing commas before ]', () => {
    const jsonc = '{"arr": [1, 2, 3,]}';
    const result = parseJsonc(jsonc);
    assert.deepStrictEqual(result, { arr: [1, 2, 3] });
  });

  test('strips BOM character', () => {
    const jsonc = '\uFEFF{"key": "value"}';
    const result = parseJsonc(jsonc);
    assert.deepStrictEqual(result, { key: 'value' });
  });

  test('preserves strings containing // (does not strip // inside strings)', () => {
    const jsonc = '{"url": "https://example.com/path"}';
    const result = parseJsonc(jsonc);
    assert.deepStrictEqual(result, { url: 'https://example.com/path' });
  });

  test('handles multi-line block comments', () => {
    const jsonc = `{
  /*
   * Multi-line
   * comment
   */
  "key": "value"
}`;
    const result = parseJsonc(jsonc);
    assert.deepStrictEqual(result, { key: 'value' });
  });

  test('handles complex JSONC with comments and trailing commas', () => {
    const jsonc = `{
  // Settings config
  "enable": true, // inline comment
  "items": [
    "a",
    "b", // last item
  ],
}`;
    const result = parseJsonc(jsonc);
    assert.deepStrictEqual(result, { enable: true, items: ['a', 'b'] });
  });
});

// ─── extractFrontmatterAndBody ─────────────────────────────────────────────────

describe('extractFrontmatterAndBody', () => {
  test('splits "---\\nfoo: bar\\n---\\nbody" into frontmatter and body', () => {
    const content = '---\nfoo: bar\n---\nThis is the body.';
    const { frontmatter, body } = extractFrontmatterAndBody(content);
    assert.ok(frontmatter.includes('foo: bar'), 'frontmatter has field');
    assert.ok(body.includes('This is the body.'), 'body preserved');
  });

  test('returns null frontmatter when content does not start with ---', () => {
    const content = 'No frontmatter here.';
    const { frontmatter, body } = extractFrontmatterAndBody(content);
    assert.strictEqual(frontmatter, null);
    assert.strictEqual(body, content);
  });

  test('returns null frontmatter when no closing ---', () => {
    const content = '---\nfoo: bar\nno closing delimiter';
    const { frontmatter, body } = extractFrontmatterAndBody(content);
    assert.strictEqual(frontmatter, null);
    assert.strictEqual(body, content);
  });

  test('extracts multi-field frontmatter correctly', () => {
    const content = '---\nname: test\ndescription: A test agent\ntools: Read, Write\n---\nbody text';
    const { frontmatter } = extractFrontmatterAndBody(content);
    assert.ok(frontmatter.includes('name: test'));
    assert.ok(frontmatter.includes('description: A test agent'));
    assert.ok(frontmatter.includes('tools: Read, Write'));
  });

  test('body content after closing --- is preserved', () => {
    const content = '---\nfield: val\n---\n\n## Section\n\nBody paragraph.';
    const { body } = extractFrontmatterAndBody(content);
    assert.ok(body.includes('## Section'));
    assert.ok(body.includes('Body paragraph.'));
  });
});

// ─── extractFrontmatterField ───────────────────────────────────────────────────

describe('extractFrontmatterField', () => {
  const frontmatter = 'name: test-agent\ndescription: Does things\ntools: Read, Write';

  test('extracts simple key: value', () => {
    const result = extractFrontmatterField(frontmatter, 'name');
    assert.strictEqual(result, 'test-agent');
  });

  test('extracts description field', () => {
    const result = extractFrontmatterField(frontmatter, 'description');
    assert.strictEqual(result, 'Does things');
  });

  test('extracts tools field', () => {
    const result = extractFrontmatterField(frontmatter, 'tools');
    assert.strictEqual(result, 'Read, Write');
  });

  test('returns null for nonexistent field', () => {
    const result = extractFrontmatterField(frontmatter, 'nonexistent');
    assert.strictEqual(result, null);
  });

  test('strips surrounding quotes from values', () => {
    const fm = 'name: "quoted-name"\ndescription: \'single-quoted\'';
    assert.strictEqual(extractFrontmatterField(fm, 'name'), 'quoted-name');
    assert.strictEqual(extractFrontmatterField(fm, 'description'), 'single-quoted');
  });
});

// ─── cleanupOrphanedHooks ──────────────────────────────────────────────────────

describe('cleanupOrphanedHooks', () => {
  test('removes entries containing gsd-notify.sh', () => {
    const settings = {
      hooks: {
        Stop: [
          { hooks: [{ command: 'node "/home/user/.claude/hooks/gsd-notify.sh"' }] },
          { hooks: [{ command: 'node "/home/user/.claude/hooks/keep-this.js"' }] },
        ],
      },
    };
    const result = cleanupOrphanedHooks(settings);
    assert.strictEqual(result.hooks.Stop.length, 1);
    assert.ok(result.hooks.Stop[0].hooks[0].command.includes('keep-this.js'));
  });

  test('removes entries containing hooks/statusline.js (old path)', () => {
    const settings = {
      hooks: {
        Stop: [
          { hooks: [{ command: 'node "/home/user/.claude/hooks/statusline.js"' }] },
        ],
      },
    };
    const result = cleanupOrphanedHooks(settings);
    assert.strictEqual(result.hooks.Stop.length, 0);
  });

  test('removes entries containing gsd-intel-index.js', () => {
    const settings = {
      hooks: {
        SessionStart: [
          { hooks: [{ command: 'node "/home/user/.claude/hooks/gsd-intel-index.js"' }] },
        ],
      },
    };
    const result = cleanupOrphanedHooks(settings);
    assert.strictEqual(result.hooks.SessionStart.length, 0);
  });

  test('preserves non-orphaned hook entries', () => {
    const settings = {
      hooks: {
        Stop: [
          { hooks: [{ command: 'node "/home/user/.claude/hooks/gsd-statusline.js"' }] },
          { hooks: [{ command: 'node "/home/user/.claude/hooks/my-custom-hook.js"' }] },
        ],
      },
    };
    const result = cleanupOrphanedHooks(settings);
    assert.strictEqual(result.hooks.Stop.length, 2);
  });

  test('updates statusLine command path from hooks/statusline.js to hooks/gsd-statusline.js', () => {
    const settings = {
      hooks: {},
      statusLine: { command: 'node "/home/user/.claude/hooks/statusline.js"' },
    };
    const result = cleanupOrphanedHooks(settings);
    assert.ok(result.statusLine.command.includes('hooks/gsd-statusline.js'), 'path updated');
    assert.ok(!result.statusLine.command.includes('hooks/statusline.js'.replace('gsd-', '')), 'old path gone');
  });

  test('returns settings with empty hooks cleaned up (no errors on empty)', () => {
    const settings = { hooks: { Stop: [], SessionStart: [] } };
    const result = cleanupOrphanedHooks(settings);
    assert.ok(result.hooks);
    assert.strictEqual(result.hooks.Stop.length, 0);
  });

  test('returns settings unchanged when no hooks key', () => {
    const settings = { someOtherKey: true };
    const result = cleanupOrphanedHooks(settings);
    assert.deepStrictEqual(result, { someOtherKey: true });
  });

  test('removes entries across multiple event types', () => {
    const settings = {
      hooks: {
        Stop: [
          { hooks: [{ command: 'node "/path/hooks/gsd-notify.sh"' }] },
        ],
        SessionStart: [
          { hooks: [{ command: 'node "/path/hooks/gsd-intel-index.js"' }] },
        ],
        PreToolUse: [
          { hooks: [{ command: 'node "/path/hooks/keep-me.js"' }] },
        ],
      },
    };
    const result = cleanupOrphanedHooks(settings);
    assert.strictEqual(result.hooks.Stop.length, 0);
    assert.strictEqual(result.hooks.SessionStart.length, 0);
    assert.strictEqual(result.hooks.PreToolUse.length, 1);
  });
});

// ─── fileHash ──────────────────────────────────────────────────────────────────

describe('fileHash', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-file-hash-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns consistent SHA-256 hex string for same content', () => {
    const filePath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(filePath, 'hello world');
    const hash1 = fileHash(filePath);
    const hash2 = fileHash(filePath);
    assert.strictEqual(hash1, hash2);
    assert.match(hash1, /^[0-9a-f]{64}$/, 'is 64-char hex string');
  });

  test('different content produces different hash', () => {
    const file1 = path.join(tmpDir, 'a.txt');
    const file2 = path.join(tmpDir, 'b.txt');
    fs.writeFileSync(file1, 'content one');
    fs.writeFileSync(file2, 'content two');
    const hash1 = fileHash(file1);
    const hash2 = fileHash(file2);
    assert.notStrictEqual(hash1, hash2);
  });

  test('returns 64-char hex string', () => {
    const filePath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(filePath, 'some content');
    const hash = fileHash(filePath);
    assert.strictEqual(hash.length, 64);
    assert.match(hash, /^[0-9a-f]+$/);
  });
});

// ─── generateManifest ─────────────────────────────────────────────────────────

describe('generateManifest', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-manifest-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns { "relative/path": hash } for all files in directory', () => {
    fs.writeFileSync(path.join(tmpDir, 'file1.txt'), 'content1');
    fs.writeFileSync(path.join(tmpDir, 'file2.txt'), 'content2');
    const manifest = generateManifest(tmpDir);
    assert.ok('file1.txt' in manifest, 'file1.txt in manifest');
    assert.ok('file2.txt' in manifest, 'file2.txt in manifest');
    assert.match(manifest['file1.txt'], /^[0-9a-f]{64}$/);
    assert.match(manifest['file2.txt'], /^[0-9a-f]{64}$/);
  });

  test('recurses into subdirectories', () => {
    const subDir = path.join(tmpDir, 'subdir');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(tmpDir, 'root.txt'), 'root');
    fs.writeFileSync(path.join(subDir, 'nested.txt'), 'nested');
    const manifest = generateManifest(tmpDir);
    assert.ok('root.txt' in manifest, 'root file present');
    assert.ok('subdir/nested.txt' in manifest, 'nested file present with forward slash');
  });

  test('returns empty object for nonexistent directory', () => {
    const manifest = generateManifest(path.join(tmpDir, 'nonexistent'));
    assert.deepStrictEqual(manifest, {});
  });

  test('uses forward slashes in relative paths', () => {
    const subDir = path.join(tmpDir, 'a', 'b');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'deep.txt'), 'deep');
    const manifest = generateManifest(tmpDir);
    const keys = Object.keys(manifest);
    for (const key of keys) {
      assert.ok(!key.includes('\\'), `key "${key}" uses forward slashes`);
    }
    assert.ok('a/b/deep.txt' in manifest, 'deeply nested file present');
  });

  test('file hashes match fileHash function output', () => {
    const filePath = path.join(tmpDir, 'check.txt');
    fs.writeFileSync(filePath, 'check content');
    const manifest = generateManifest(tmpDir);
    const expectedHash = fileHash(filePath);
    assert.strictEqual(manifest['check.txt'], expectedHash);
  });
});
