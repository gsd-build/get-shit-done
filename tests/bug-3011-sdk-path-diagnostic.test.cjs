'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Regression test for #3011: SDK not found.
 *
 * Reporter (Windows / PowerShell 7) ran `npx get-shit-done-cc@latest`,
 * upgrade reported success, but `gsd-sdk` could not be resolved by Claude
 * Code, Git Bash, PowerShell, or WSL. The previous diagnostic was a
 * generic "not on your PATH" with no actionable info; the user couldn't
 * find where the shim was written or how to add it to PATH for each shell.
 *
 * Fix: formatSdkPathDiagnostic() returns a typed IR with the shim
 * location, platform-specific PATH-export commands, and an npx-note
 * when running under an `_npx` cache. The console renderer in install.js
 * just emits each line; tests assert on the IR fields directly.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { formatSdkPathDiagnostic } = require(path.join(__dirname, '..', 'bin', 'install.js'));

describe('Bug #3011: formatSdkPathDiagnostic — Windows shim location and PATH commands', () => {
  test('emits shim location line when shimDir is provided', () => {
    const ir = formatSdkPathDiagnostic({
      shimDir: 'C:\\Users\\me\\AppData\\Roaming\\npm',
      platform: 'win32',
      runDir: 'C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\get-shit-done-cc\\bin',
    });
    assert.equal(ir.shimLocationLine,
      'Shim written to: C:\\Users\\me\\AppData\\Roaming\\npm');
  });

  test('Windows action lines include all three shell flavors (PowerShell, cmd.exe, Git Bash)', () => {
    const ir = formatSdkPathDiagnostic({
      shimDir: 'C:\\Users\\me\\AppData\\Roaming\\npm',
      platform: 'win32',
      runDir: 'C:\\some\\path',
    });
    const labels = ir.actionLines.map(l => l.split(':')[0].trim());
    assert.ok(labels.some(l => l === 'PowerShell'), `expected PowerShell line, got: ${JSON.stringify(labels)}`);
    assert.ok(labels.some(l => l === 'cmd.exe'),    `expected cmd.exe line, got: ${JSON.stringify(labels)}`);
    assert.ok(labels.some(l => l === 'Git Bash'),   `expected Git Bash line, got: ${JSON.stringify(labels)}`);
  });

  test('Git Bash command translates Windows backslashes to forward slashes', () => {
    const ir = formatSdkPathDiagnostic({
      shimDir: 'C:\\Users\\me\\AppData\\Roaming\\npm',
      platform: 'win32',
      runDir: 'C:\\some\\path',
    });
    const gitBash = ir.actionLines.find(l => l.startsWith('Git Bash'));
    assert.ok(gitBash);
    // Git Bash uses POSIX path syntax; backslashes would not work in bash.
    assert.equal(gitBash.includes('\\'), false,
      `Git Bash line must not contain backslashes: ${gitBash}`);
    assert.ok(gitBash.includes('C:/Users/me/AppData/Roaming/npm'),
      `Git Bash line must contain forward-slash path: ${gitBash}`);
  });

  test('PowerShell command preserves Windows backslashes in the embedded path', () => {
    const ir = formatSdkPathDiagnostic({
      shimDir: 'C:\\Users\\me\\AppData\\Roaming\\npm',
      platform: 'win32',
      runDir: 'C:\\some\\path',
    });
    const ps = ir.actionLines.find(l => l.startsWith('PowerShell'));
    assert.ok(ps);
    // PowerShell uses native Windows paths.
    assert.ok(ps.includes('C:\\Users\\me\\AppData\\Roaming\\npm'),
      `PowerShell line must contain Windows-style path: ${ps}`);
  });

  test("paths containing a single quote are escaped for each shell (#3014 CR)", () => {
    // CR finding: a real Windows username like "O'Neil" would generate
    // unparseable commands. PowerShell single-quote escape is '' (doubled);
    // bash within outer single-quotes uses '\'' to embed a literal quote;
    // POSIX export within double-quotes leaves single quotes alone.
    const ir = formatSdkPathDiagnostic({
      shimDir: "C:\\Users\\O'Neil\\AppData\\Roaming\\npm",
      platform: 'win32',
      runDir: 'C:\\some\\path',
    });
    const ps      = ir.actionLines.find(l => l.startsWith('PowerShell'));
    const cmd     = ir.actionLines.find(l => l.startsWith('cmd.exe'));
    const gitBash = ir.actionLines.find(l => l.startsWith('Git Bash'));
    // PowerShell: literal quote escape is doubled
    assert.ok(ps.includes("C:\\Users\\O''Neil\\AppData\\Roaming\\npm"),
      `PowerShell line must double single quotes: ${ps}`);
    // cmd.exe (which delegates to powershell) uses the same PS-escape
    assert.ok(cmd.includes("C:\\Users\\O''Neil\\AppData\\Roaming\\npm"),
      `cmd.exe line must double single quotes (delegates to PowerShell): ${cmd}`);
    // Git Bash: '\'' escape inside outer single-quoted echo
    assert.ok(gitBash.includes("C:/Users/O'\\''Neil/AppData/Roaming/npm"),
      `Git Bash line must escape single quote with '\\\\'': ${gitBash}`);
  });
});

describe('Bug #3011: formatSdkPathDiagnostic — POSIX action lines', () => {
  test('emits a single export PATH line on Linux', () => {
    const ir = formatSdkPathDiagnostic({
      shimDir: '/home/me/.local/bin',
      platform: 'linux',
      runDir: '/home/me/.local/lib/node_modules/get-shit-done-cc/bin',
    });
    const exports_ = ir.actionLines.filter(l => l.startsWith('export PATH='));
    assert.equal(exports_.length, 1, `expected 1 export line, got: ${JSON.stringify(ir.actionLines)}`);
    assert.equal(exports_[0], 'export PATH="/home/me/.local/bin:$PATH"');
  });

  test('emits a single export PATH line on macOS (darwin)', () => {
    const ir = formatSdkPathDiagnostic({
      shimDir: '/usr/local/bin',
      platform: 'darwin',
      runDir: '/usr/local/lib/node_modules/get-shit-done-cc/bin',
    });
    assert.ok(ir.actionLines.some(l => l === 'export PATH="/usr/local/bin:$PATH"'));
  });
});

describe('Bug #3011: formatSdkPathDiagnostic — fallback when shimDir is null', () => {
  test('shimLocationLine is empty', () => {
    const ir = formatSdkPathDiagnostic({
      shimDir: null,
      platform: 'win32',
      runDir: 'C:\\some\\path',
    });
    assert.equal(ir.shimLocationLine, '');
  });

  test('action lines fall back to npm install -g advice', () => {
    const ir = formatSdkPathDiagnostic({
      shimDir: null,
      platform: 'win32',
      runDir: 'C:\\some\\path',
    });
    assert.ok(ir.actionLines.some(l => l.includes('npm install -g get-shit-done-cc')));
  });
});

describe('Bug #3011: formatSdkPathDiagnostic — npx-cache detection', () => {
  test('detects POSIX npx cache path', () => {
    const ir = formatSdkPathDiagnostic({
      shimDir: '/home/me/.local/bin',
      platform: 'linux',
      runDir: '/home/me/.npm/_npx/abc123/node_modules/get-shit-done-cc/bin',
    });
    assert.equal(ir.isNpx, true);
    assert.ok(ir.npxNoteLines.length >= 2,
      `expected npx note lines, got: ${JSON.stringify(ir.npxNoteLines)}`);
    assert.ok(ir.npxNoteLines.some(l => l.includes('npx')));
    assert.ok(ir.npxNoteLines.some(l => l.includes('npm install -g')));
  });

  test('detects Windows npx cache path', () => {
    const ir = formatSdkPathDiagnostic({
      shimDir: 'C:\\Users\\me\\AppData\\Roaming\\npm',
      platform: 'win32',
      runDir: 'C:\\Users\\me\\AppData\\Local\\npm-cache\\_npx\\abc123\\node_modules\\get-shit-done-cc\\bin',
    });
    assert.equal(ir.isNpx, true);
  });

  test('non-npx invocation leaves npxNoteLines empty', () => {
    const ir = formatSdkPathDiagnostic({
      shimDir: 'C:\\Users\\me\\AppData\\Roaming\\npm',
      platform: 'win32',
      runDir: 'C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\get-shit-done-cc\\bin',
    });
    assert.equal(ir.isNpx, false);
    assert.deepEqual(ir.npxNoteLines, []);
  });
});

describe('Bug #3011: formatSdkPathDiagnostic — actionable shape contract', () => {
  test('returns the documented IR shape for any input', () => {
    const ir = formatSdkPathDiagnostic({
      shimDir: '/x',
      platform: 'linux',
      runDir: '/y',
    });
    assert.equal(typeof ir.shimLocationLine, 'string');
    assert.ok(Array.isArray(ir.actionLines));
    assert.ok(Array.isArray(ir.npxNoteLines));
    assert.equal(typeof ir.isNpx, 'boolean');
    assert.equal(typeof ir.isWin32, 'boolean');
  });
});
