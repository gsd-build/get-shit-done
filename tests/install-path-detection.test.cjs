/**
 * Regression test for #2620 — installer should not suggest adding an absolute
 * PATH export when the user's rc file already contains a HOME-relative entry
 * that covers the same directory.
 *
 * Covers `homePathCoveredByRc(globalBin, homeDir, rcFileNames?)` which parses
 * each rc file's `export PATH=` lines, substitutes `$HOME` / `${HOME}` / `~`,
 * and returns true when any resolved PATH entry equals globalBin.
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const INSTALL_PATH = path.join(__dirname, '..', 'bin', 'install.js');

function loadInstaller() {
  process.env.GSD_TEST_MODE = '1';
  delete require.cache[require.resolve(INSTALL_PATH)];
  return require(INSTALL_PATH);
}

function createTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-home-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('installer HOME-relative PATH detection (#2620)', () => {
  let installer;
  before(() => {
    installer = loadInstaller();
  });

  test('homePathCoveredByRc is exported', () => {
    assert.strictEqual(
      typeof installer.homePathCoveredByRc,
      'function',
      'bin/install.js must export homePathCoveredByRc for #2620',
    );
  });

  test('detects $HOME/.npm-global/bin pattern', () => {
    const home = createTempHome();
    try {
      fs.writeFileSync(
        path.join(home, '.zshrc'),
        'export PATH="$HOME/.npm-global/bin:$PATH"\n',
      );
      const globalBin = path.join(home, '.npm-global', 'bin');
      assert.strictEqual(installer.homePathCoveredByRc(globalBin, home), true);
    } finally {
      cleanup(home);
    }
  });

  test('detects ${HOME}/.npm-global/bin pattern', () => {
    const home = createTempHome();
    try {
      fs.writeFileSync(
        path.join(home, '.bashrc'),
        'export PATH="${HOME}/.npm-global/bin:$PATH"\n',
      );
      const globalBin = path.join(home, '.npm-global', 'bin');
      assert.strictEqual(installer.homePathCoveredByRc(globalBin, home), true);
    } finally {
      cleanup(home);
    }
  });

  test('detects ~/.npm-global/bin tilde form', () => {
    const home = createTempHome();
    try {
      fs.writeFileSync(
        path.join(home, '.profile'),
        'export PATH=~/.npm-global/bin:$PATH\n',
      );
      const globalBin = path.join(home, '.npm-global', 'bin');
      assert.strictEqual(installer.homePathCoveredByRc(globalBin, home), true);
    } finally {
      cleanup(home);
    }
  });

  test('detects absolute path that exactly matches globalBin', () => {
    const home = createTempHome();
    try {
      const globalBin = path.join(home, '.npm-global', 'bin');
      fs.writeFileSync(
        path.join(home, '.zshrc'),
        `export PATH="${globalBin}:$PATH"\n`,
      );
      assert.strictEqual(installer.homePathCoveredByRc(globalBin, home), true);
    } finally {
      cleanup(home);
    }
  });

  test('returns false when rc files exist but do not cover globalBin', () => {
    const home = createTempHome();
    try {
      fs.writeFileSync(
        path.join(home, '.zshrc'),
        'export PATH="$HOME/.cargo/bin:$PATH"\nexport FOO=bar\n',
      );
      const globalBin = path.join(home, '.npm-global', 'bin');
      assert.strictEqual(installer.homePathCoveredByRc(globalBin, home), false);
    } finally {
      cleanup(home);
    }
  });

  test('returns false when no rc files exist', () => {
    const home = createTempHome();
    try {
      const globalBin = path.join(home, '.npm-global', 'bin');
      assert.strictEqual(installer.homePathCoveredByRc(globalBin, home), false);
    } finally {
      cleanup(home);
    }
  });

  test('swallows unreadable rc files without throwing', () => {
    const home = createTempHome();
    try {
      const rc = path.join(home, '.zshrc');
      fs.mkdirSync(rc); // directory where a file is expected — reading throws
      const globalBin = path.join(home, '.npm-global', 'bin');
      assert.doesNotThrow(() => installer.homePathCoveredByRc(globalBin, home));
      assert.strictEqual(installer.homePathCoveredByRc(globalBin, home), false);
    } finally {
      cleanup(home);
    }
  });

  test('ignores commented-out export PATH lines', () => {
    const home = createTempHome();
    try {
      fs.writeFileSync(
        path.join(home, '.zshrc'),
        '# export PATH="$HOME/.npm-global/bin:$PATH"\n',
      );
      const globalBin = path.join(home, '.npm-global', 'bin');
      assert.strictEqual(installer.homePathCoveredByRc(globalBin, home), false);
    } finally {
      cleanup(home);
    }
  });

  test('matches globalBin regardless of trailing slash', () => {
    const home = createTempHome();
    try {
      fs.writeFileSync(
        path.join(home, '.zshrc'),
        'export PATH="$HOME/.npm-global/bin/:$PATH"\n',
      );
      const globalBin = path.join(home, '.npm-global', 'bin');
      assert.strictEqual(installer.homePathCoveredByRc(globalBin, home), true);
    } finally {
      cleanup(home);
    }
  });

  // CodeRabbit finding: bare relative PATH segments (e.g. `bin`) must not be
  // resolved against $HOME. Relative segments depend on the shell's cwd at
  // lookup time and are unrelated to $HOME/bin.
  test('does not treat bare relative PATH segment as HOME-relative', () => {
    const home = createTempHome();
    try {
      fs.writeFileSync(
        path.join(home, '.zshrc'),
        'export PATH="bin:$PATH"\n',
      );
      const globalBin = path.join(home, 'bin');
      assert.strictEqual(
        installer.homePathCoveredByRc(globalBin, home),
        false,
        'relative PATH segments must not be resolved against $HOME',
      );
    } finally {
      cleanup(home);
    }
  });

  test('does not treat nested relative PATH segment as HOME-relative', () => {
    const home = createTempHome();
    try {
      fs.writeFileSync(
        path.join(home, '.zshrc'),
        'export PATH="node_modules/.bin:$PATH"\n',
      );
      const globalBin = path.join(home, 'node_modules', '.bin');
      assert.strictEqual(
        installer.homePathCoveredByRc(globalBin, home),
        false,
      );
    } finally {
      cleanup(home);
    }
  });

  // CodeRabbit actionable 1 + nitpick: the installer's PATH-export
  // suggestion banner must be suppressed when an rc file already covers
  // globalBin via a HOME-relative entry.
  test('maybeSuggestPathExport suppresses suggestion when rc covers globalBin', () => {
    const home = createTempHome();
    try {
      const globalBin = path.join(home, '.npm-global', 'bin');
      fs.mkdirSync(globalBin, { recursive: true });
      fs.writeFileSync(
        path.join(home, '.zshrc'),
        'export PATH="$HOME/.npm-global/bin:$PATH"\n',
      );

      const logs = [];
      const origLog = console.log;
      console.log = (...args) => { logs.push(args.join(' ')); };
      try {
        installer.maybeSuggestPathExport(globalBin, home);
      } finally {
        console.log = origLog;
      }

      const joined = logs.join('\n');
      assert.ok(
        !/echo 'export PATH=/.test(joined),
        `installer should not emit absolute export suggestion; got:\n${joined}`,
      );
    } finally {
      cleanup(home);
    }
  });

  test('maybeSuggestPathExport emits suggestion when rc does not cover globalBin', () => {
    const home = createTempHome();
    try {
      const globalBin = path.join(home, '.npm-global', 'bin');
      fs.mkdirSync(globalBin, { recursive: true });
      fs.writeFileSync(
        path.join(home, '.zshrc'),
        'export PATH="$HOME/.cargo/bin:$PATH"\n',
      );

      const logs = [];
      const origLog = console.log;
      console.log = (...args) => { logs.push(args.join(' ')); };
      try {
        installer.maybeSuggestPathExport(globalBin, home);
      } finally {
        console.log = origLog;
      }

      const joined = logs.join('\n');
      assert.ok(
        /echo 'export PATH=/.test(joined),
        `installer should emit absolute export suggestion when rc does not cover globalBin; got:\n${joined}`,
      );
    } finally {
      cleanup(home);
    }
  });

  test('maybeSuggestPathExport is a no-op when globalBin already on process.env.PATH', () => {
    const home = createTempHome();
    const origPath = process.env.PATH;
    try {
      const globalBin = path.join(home, '.npm-global', 'bin');
      fs.mkdirSync(globalBin, { recursive: true });
      process.env.PATH = `${globalBin}${path.delimiter}${origPath || ''}`;

      const logs = [];
      const origLog = console.log;
      console.log = (...args) => { logs.push(args.join(' ')); };
      try {
        installer.maybeSuggestPathExport(globalBin, home);
      } finally {
        console.log = origLog;
      }

      assert.strictEqual(logs.length, 0, `expected no output when on PATH; got:\n${logs.join('\n')}`);
    } finally {
      if (origPath === undefined) delete process.env.PATH; else process.env.PATH = origPath;
      cleanup(home);
    }
  });
});
