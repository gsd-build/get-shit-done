// allow-test-rule: source-text-is-the-product
// Command `.md` files — their staged text IS the runtime contract loaded by
// Claude Code. Asserting that staged bodies lack `/gsd:<cmd>` colon refs is
// a behavioral test of the install transform, not source-grep theater.

/**
 * Regression for #3683 — installed command bodies leak `/gsd:<cmd>` colon refs
 * for Claude Code local installs.
 *
 * Root cause: `bin/install.js` command install path (`copyWithPathReplacement`,
 * around line 8296 in the `else` branch) copies each command `.md` body without
 * applying the hyphen-namespace normalizer that the agent install loop gained in
 * PR #3677. Static prose in `commands/gsd/*.md` (e.g. plan-phase.md referencing
 * `/gsd:execute-phase`) therefore reaches the model verbatim, causing the model
 * to echo the retired colon form at workflow boundaries.
 *
 * Fix surface:
 *   Call `normalizeAgentBodyForRuntime` (or an equivalent helper) in the command
 *   staging path after all other rewrites but before writeFileSync, mirroring
 *   the agent install loop fix from #3677.
 *
 * This test guards the behavioral integration: run a real local claude install
 * into a temp dir, then assert that no staged command body contains a
 * `/gsd:<known-cmd>` colon ref.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const INSTALL_PATH = path.join(REPO_ROOT, 'bin', 'install.js');

const install = require(INSTALL_PATH);
const { readCmdNames } = require(path.join(REPO_ROOT, 'scripts', 'fix-slash-commands.cjs'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run `node install.js --claude --local --no-sdk` in tmpDir.
 * GSD_TEST_MODE must be cleared so the install() main block executes.
 */
function runClaudeLocalInstall(cwd) {
  const env = { ...process.env };
  delete env.GSD_TEST_MODE;
  execFileSync(process.execPath, [INSTALL_PATH, '--claude', '--local', '--no-sdk'], {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });
}

/**
 * Build the roster regex that matches `/gsd:<known-cmd>` or `gsd:<known-cmd>`
 * (with appropriate word boundaries). Mirrors the pattern used in bug-3677.
 */
function buildRosterRegex(cmdNames) {
  const sorted = [...cmdNames].sort((a, b) => b.length - a.length);
  return new RegExp(
    `(?<![a-zA-Z0-9_-])gsd:(${sorted.join('|')})(?=[^a-zA-Z0-9_-]|$)`,
  );
}

// ---------------------------------------------------------------------------
// Suite A — export surface: normalizeAgentBodyForRuntime must be exported
// (same seam used for command bodies)
// ---------------------------------------------------------------------------
describe('bug #3683 — command body colon-namespace leak (Claude local install)', () => {

  describe('A — install.js exports the normalizer seam', () => {
    test('A1: normalizeAgentBodyForRuntime is exported (reused for command bodies)', () => {
      assert.strictEqual(
        typeof install.normalizeAgentBodyForRuntime,
        'function',
        'bin/install.js must export normalizeAgentBodyForRuntime — the seam used for both agent and command body normalization',
      );
    });

    test('A2: shouldNormalizeHyphenNamespaceInAgentBody is exported and true for claude', () => {
      assert.strictEqual(
        typeof install.shouldNormalizeHyphenNamespaceInAgentBody,
        'function',
      );
      assert.strictEqual(
        install.shouldNormalizeHyphenNamespaceInAgentBody('claude'),
        true,
        'claude must normalize hyphen namespace — it is in the allow-list from #2808',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // B — pure-function coverage: normalizer rewrites command body colon refs
  // ---------------------------------------------------------------------------
  describe('B — normalizeAgentBodyForRuntime rewrites colon refs in command-body prose', () => {
    const { normalizeAgentBodyForRuntime } = install;
    const cmdNames = readCmdNames();

    test('B0: command roster is populated and includes symptom commands', () => {
      assert.ok(cmdNames.length > 0, 'readCmdNames() must return a non-empty list');
      assert.ok(cmdNames.includes('execute-phase'), 'roster must include execute-phase');
      assert.ok(cmdNames.includes('plan-phase'), 'roster must include plan-phase');
    });

    test('B1: claude — rewrites /gsd:<cmd> colon refs in command-body prose to hyphen form', () => {
      const input = [
        '## After planning',
        '',
        'Run `/gsd:execute-phase 1 --tdd` to begin execution.',
        'Then use `/gsd:verify-work 1` when done.',
      ].join('\n');
      const out = normalizeAgentBodyForRuntime(input, 'claude', cmdNames);
      assert.ok(out.includes('/gsd-execute-phase'), 'execute-phase must be rewritten to hyphen form');
      assert.ok(out.includes('/gsd-verify-work'), 'verify-work must be rewritten to hyphen form');
      assert.ok(!out.includes('/gsd:execute-phase'), 'colon form for execute-phase must be absent');
      assert.ok(!out.includes('/gsd:verify-work'), 'colon form for verify-work must be absent');
    });

    test('B2: gemini — colon refs preserved (Gemini intentionally uses colon namespace)', () => {
      const input = 'Run `/gsd:execute-phase 1` to begin.';
      const out = normalizeAgentBodyForRuntime(input, 'gemini', cmdNames);
      assert.ok(out.includes('/gsd:execute-phase'), 'Gemini must keep colon form');
      assert.ok(!out.includes('/gsd-execute-phase'), 'Gemini must not have hyphen form injected');
    });
  });

  // ---------------------------------------------------------------------------
  // E — Integration: real local claude install produces clean command bodies
  // ---------------------------------------------------------------------------
  describe('E — integration: staged commands/gsd/*.md files contain no colon-namespace refs', () => {
    let tmpDir;
    const cmdNames = readCmdNames();
    const rosterRegex = buildRosterRegex(cmdNames);

    before(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3683-'));
      runClaudeLocalInstall(tmpDir);
    });

    after(() => {
      if (tmpDir) {
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    });

    test('E0: staged commands/gsd/ directory exists after install', () => {
      const commandsDir = path.join(tmpDir, '.claude', 'commands', 'gsd');
      assert.ok(
        fs.existsSync(commandsDir),
        `commands/gsd/ must be created by local claude install at ${commandsDir}`,
      );
    });

    test('E1: no staged command body contains /gsd:<known-cmd> colon refs', () => {
      const commandsDir = path.join(tmpDir, '.claude', 'commands', 'gsd');
      assert.ok(fs.existsSync(commandsDir), 'commands/gsd/ must exist for this check to be meaningful');

      const offenders = [];

      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.name.endsWith('.md')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (rosterRegex.test(content)) {
              const rel = path.relative(tmpDir, fullPath);
              offenders.push(rel);
            }
          }
        }
      };

      walk(commandsDir);

      assert.deepEqual(
        offenders,
        [],
        `Staged command bodies still contain roster colon refs (e.g. /gsd:execute-phase). ` +
        `Install must normalize these to /gsd-<cmd> for claude runtime. Offenders: ${offenders.join(', ')}`,
      );
    });

    test('E2: idempotent — re-running install does not double-mangle already-hyphenated refs', () => {
      // Run install a second time; if the normalizer double-applies it would
      // produce garbled output like /gsd--execute-phase. Verify the directory
      // still passes the same cleanliness check after a second install.
      runClaudeLocalInstall(tmpDir);

      const commandsDir = path.join(tmpDir, '.claude', 'commands', 'gsd');
      const doubleRewriteRegex = /\/gsd--[a-z]/;
      const garbled = [];

      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.name.endsWith('.md')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (doubleRewriteRegex.test(content)) {
              garbled.push(path.relative(tmpDir, fullPath));
            }
          }
        }
      };

      walk(commandsDir);

      assert.deepEqual(
        garbled,
        [],
        `Re-install produced double-hyphen artifacts (/gsd--cmd) — normalizer is not idempotent. Garbled files: ${garbled.join(', ')}`,
      );
    });
  });
});
