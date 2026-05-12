'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const projection = require(path.join(
  __dirname,
  '..',
  'get-shit-done',
  'bin',
  'lib',
  'shell-command-projection.cjs',
));
const install = require(path.join(__dirname, '..', 'bin', 'install.js'));

function createTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-home-3441-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('bug #3441: PATH guidance is projected from typed shell action IR', () => {
  test('projection module exports PATH action projection helper', () => {
    assert.equal(typeof projection.projectPathActionProjection, 'function');
  });

  test('formatSdkPathDiagnostic exposes structured shellActions alongside rendered actionLines', () => {
    const ir = install.formatSdkPathDiagnostic({
      shimDir: 'C:\\Users\\me\\AppData\\Roaming\\npm',
      platform: 'win32',
      runDir: 'C:\\some\\path',
    });

    assert.ok(Array.isArray(ir.shellActions), 'shellActions must be an array');
    assert.ok(ir.shellActions.length >= 3, `expected 3+ shell actions, got ${ir.shellActions.length}`);
    assert.equal(ir.shellActions[0].label, 'PowerShell');
    assert.equal(typeof ir.shellActions[0].command, 'string');
    assert.equal(
      ir.actionLines.some((line) => line.startsWith('PowerShell:')),
      true,
      `rendered action lines should include shell labels: ${JSON.stringify(ir.actionLines)}`,
    );
  });

  test('persistent PATH export guidance is projected via the same seam', () => {
    const posix = projection.projectPathActionProjection({
      mode: 'persist',
      targetDir: '/tmp/with quote',
      platform: 'linux',
    });
    assert.ok(Array.isArray(posix.shellActions));
    assert.equal(posix.shellActions.length, 2);
    assert.equal(posix.shellActions[0].label, 'zsh');
    assert.equal(posix.shellActions[1].label, 'bash');
    assert.ok(posix.shellActions[0].command.includes('~/.zshrc'));
    assert.ok(posix.shellActions[1].command.includes('~/.bashrc'));
  });

  test('POSIX repair mode escapes double-quoted shell metacharacters', () => {
    const projected = projection.projectPathActionProjection({
      mode: 'repair',
      targetDir: '/tmp/qa\\"$HOME`tick',
      platform: 'linux',
    });
    assert.equal(projected.shellActions.length, 1);
    assert.equal(
      projected.shellActions[0].command,
      'export PATH="/tmp/qa\\\\\\"\\$HOME\\`tick:$PATH"',
    );
  });

  test('POSIX persist mode escapes single quotes for rc-file echo commands', () => {
    const projected = projection.projectPathActionProjection({
      mode: 'persist',
      targetDir: "/tmp/O'Neil/bin",
      platform: 'linux',
    });
    assert.equal(projected.shellActions[0].command.includes("/tmp/O'\\''Neil/bin"), true);
    assert.equal(projected.shellActions[1].command.includes("/tmp/O'\\''Neil/bin"), true);
  });

  test('maybeSuggestPathExport renders commands projected by path-action seam', () => {
    const home = createTempHome();
    const originalPath = process.env.PATH;
    try {
      const globalBin = path.join(home, '.npm-global', 'bin');
      fs.mkdirSync(globalBin, { recursive: true });
      fs.writeFileSync(path.join(home, '.zshrc'), 'export PATH="$HOME/.cargo/bin:$PATH"\n');
      process.env.PATH = '';

      const expected = projection.projectPathActionProjection({
        mode: 'persist',
        targetDir: globalBin,
        platform: process.platform,
      });

      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(' '));
      try {
        install.maybeSuggestPathExport(globalBin, home);
      } finally {
        console.log = originalLog;
      }

      const joined = logs.join('\n');
      for (const action of expected.shellActions) {
        assert.ok(
          joined.includes(action.command),
          `expected installer output to include projected command: ${action.command}\nOutput:\n${joined}`,
        );
      }
    } finally {
      if (originalPath == null) delete process.env.PATH;
      else process.env.PATH = originalPath;
      cleanup(home);
    }
  });
});
