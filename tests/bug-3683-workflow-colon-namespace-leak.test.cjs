// allow-test-rule: source-text-is-the-product
// Workflow and reference `.md` files are deployed verbatim as part of the
// get-shit-done skill payload — their staged text IS the runtime contract
// loaded by Claude Code. Asserting that staged bodies lack `/gsd:<cmd>`
// colon refs is a behavioral test of the install transform, not
// source-grep theater.

/**
 * Regression for #3683 — installed workflow/reference bodies leak `/gsd:<cmd>`
 * colon refs for Claude Code local installs.
 *
 * Root cause: `copyWithPathReplacement` in `bin/install.js` guarded the
 * `normalizeAgentBodyForRuntime` call behind `if (isCommand)`, so the
 * `get-shit-done/` directory (workflows, references — all `isCommand=false`)
 * was copied without applying the hyphen-namespace normalizer. Static prose
 * in `get-shit-done/workflows/*.md` and `get-shit-done/references/*.md`
 * (e.g. discuss-phase.md referencing `/gsd:plan-phase`) therefore reached
 * the model verbatim, causing it to echo the retired colon form.
 *
 * Fix surface:
 *   Remove the `if (isCommand)` guard so `normalizeAgentBodyForRuntime` is
 *   called unconditionally in `copyWithPathReplacement`. The function
 *   self-gates on `shouldNormalizeHyphenNamespaceInAgentBody(runtime)` and
 *   is a no-op for colon-canonical runtimes (Gemini, Codex, etc.).
 *
 * User repro path: `/gsd-discuss-phase` output ends with `/gsd:nextcommand`
 * because discuss-phase.md (7 colon refs) is not normalized at install time.
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
 * Run `node install.js --gemini --local --no-sdk` in tmpDir.
 * GSD_TEST_MODE must be cleared so the install() main block executes.
 */
function runGeminiLocalInstall(cwd) {
  const env = { ...process.env };
  delete env.GSD_TEST_MODE;
  execFileSync(process.execPath, [INSTALL_PATH, '--gemini', '--local', '--no-sdk'], {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });
}

/**
 * Build the roster regex that matches `gsd:<known-cmd>` references.
 * Mirrors the pattern used by the Cycle 1 command test.
 */
function buildRosterRegex(cmdNames) {
  const sorted = [...cmdNames].sort((a, b) => b.length - a.length);
  return new RegExp(
    `(?<![a-zA-Z0-9_-])gsd:(${sorted.join('|')})(?=[^a-zA-Z0-9_-]|$)`,
  );
}

/**
 * Walk a directory recursively and collect .md files whose body matches regex.
 */
function collectOffenders(dir, regex) {
  const offenders = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (regex.test(content)) {
          offenders.push(fullPath);
        }
      }
    }
  };
  walk(dir);
  return offenders;
}

// ---------------------------------------------------------------------------
// Suite — integration: staged get-shit-done/workflows/ and references/ must
// have no colon-namespace refs for claude, and must preserve them for gemini.
// ---------------------------------------------------------------------------
describe('bug #3683 — workflow/reference colon-namespace leak (Claude local install)', () => {

  // Shared Claude local install used by W and R suites.
  // Consolidating to a single install halves disk I/O for this file and
  // reduces concurrent load on CI runners — preventing timing interference
  // with concurrently-running tests (e.g. the TOCTOU barrier tests in
  // locking-bugs-1909-1916-1925-1927.test.cjs).
  let claudeTmpDir;
  const cmdNames = readCmdNames();
  const rosterRegex = buildRosterRegex(cmdNames);

  // Shared claude local install — used by W (workflow/reference clean-slate) and
  // R (routing-block positive assertion) sub-suites. G suite runs its own separate
  // gemini install and does not depend on claudeTmpDir.
  before(() => {
    claudeTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3683-claude-'));
    runClaudeLocalInstall(claudeTmpDir);
  });

  after(() => {
    if (claudeTmpDir) {
      fs.rmSync(claudeTmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  // -------------------------------------------------------------------------
  // W — real local claude install: workflow + reference bodies are clean
  // -------------------------------------------------------------------------
  describe('W — integration: staged workflows and references contain no colon-namespace refs', () => {

    test('W0: staged get-shit-done/workflows/ directory exists after install', () => {
      const workflowsDir = path.join(claudeTmpDir, '.claude', 'get-shit-done', 'workflows');
      assert.ok(
        fs.existsSync(workflowsDir),
        `get-shit-done/workflows/ must be created by local claude install at ${workflowsDir}`,
      );
    });

    test('W1: staged get-shit-done/references/ directory exists after install', () => {
      const refsDir = path.join(claudeTmpDir, '.claude', 'get-shit-done', 'references');
      assert.ok(
        fs.existsSync(refsDir),
        `get-shit-done/references/ must be created by local claude install at ${refsDir}`,
      );
    });

    test('W2: focused repro — staged discuss-phase.md has zero /gsd: colon refs', () => {
      // User-reported repro: /gsd-discuss-phase output ends with /gsd:nextcommand
      // because discuss-phase.md ships 7 colon refs that were not normalized.
      const stagedFile = path.join(
        claudeTmpDir, '.claude', 'get-shit-done', 'workflows', 'discuss-phase.md',
      );
      assert.ok(
        fs.existsSync(stagedFile),
        `discuss-phase.md must exist in staged get-shit-done/workflows/`,
      );
      const content = fs.readFileSync(stagedFile, 'utf-8');
      const colonMatches = content.match(/gsd:[a-z][a-z0-9-]*/g) || [];
      // Filter to known-command refs only
      const knownColonRefs = colonMatches.filter(m => {
        const cmd = m.slice(4); // strip 'gsd:'
        return cmdNames.includes(cmd);
      });
      assert.deepEqual(
        knownColonRefs,
        [],
        `discuss-phase.md still contains colon-namespace refs that install must normalize: ${knownColonRefs.join(', ')}`,
      );
    });

    test('W3: no staged workflow body contains /gsd:<known-cmd> colon refs', () => {
      const workflowsDir = path.join(claudeTmpDir, '.claude', 'get-shit-done', 'workflows');
      assert.ok(fs.existsSync(workflowsDir), 'workflows/ must exist for this check to be meaningful');

      const offenders = collectOffenders(workflowsDir, rosterRegex);
      const relOffenders = offenders.map(f => path.relative(claudeTmpDir, f));

      assert.deepEqual(
        relOffenders,
        [],
        `Staged workflow bodies still contain roster colon refs (e.g. /gsd:plan-phase). ` +
        `Install must normalize these to /gsd-<cmd> for claude runtime. Offenders: ${relOffenders.join(', ')}`,
      );
    });

    test('W4: no staged reference body contains /gsd:<known-cmd> colon refs', () => {
      const refsDir = path.join(claudeTmpDir, '.claude', 'get-shit-done', 'references');
      assert.ok(fs.existsSync(refsDir), 'references/ must exist for this check to be meaningful');

      const offenders = collectOffenders(refsDir, rosterRegex);
      const relOffenders = offenders.map(f => path.relative(claudeTmpDir, f));

      assert.deepEqual(
        relOffenders,
        [],
        `Staged reference bodies still contain roster colon refs. ` +
        `Install must normalize these to /gsd-<cmd> for claude runtime. Offenders: ${relOffenders.join(', ')}`,
      );
    });
  });

  // -------------------------------------------------------------------------
  // R — #3646 routing-block positive assertion: ▶-prefixed lines use hyphen
  //
  // User repro: workflow output ends with "▶ /gsd:validate-phase {N}" (colon
  // form) which does not resolve in Claude Code — the installed skill is
  // /gsd-validate-phase (hyphen). Workflows emit routing blocks verbatim, so
  // the colon form reaches the model and is echoed to the user unchanged.
  //
  // This suite checks the POSITIVE invariant: lines starting with ▶ that
  // reference a GSD slash command must use /gsd-<cmd> (hyphen) in the staged
  // output. This is a stricter assertion than W3 (which only checks absence
  // of colon globally) because it confirms the routing-position strings were
  // NOT omitted — they must be present AND use the correct form.
  //
  // Source files with known ▶-prefixed routing-block colon refs (#3646):
  //   - get-shit-done/workflows/validate-phase.md:151 ▶ Next: /gsd:audit-milestone
  //   - get-shit-done/workflows/validate-phase.md:158 ▶ Retry: /gsd:validate-phase
  //   - get-shit-done/workflows/secure-phase.md:140   ▶ Fix mitigations: /gsd:secure-phase
  //   - get-shit-done/workflows/secure-phase.md:158   ▶ /gsd:validate-phase
  //   - get-shit-done/workflows/secure-phase.md:159   ▶ /gsd:verify-work
  // -------------------------------------------------------------------------
  describe('R — #3646 routing-block: ▶-prefixed lines use hyphen form in staged claude install', () => {
    // Uses the shared claudeTmpDir from the parent describe block — no separate install needed.

    /**
     * Collect all lines starting with the ▶ routing marker from a file.
     * Returns an array of { lineNo, text } objects.
     */
    function collectRoutingLines(filePath) {
      if (!fs.existsSync(filePath)) return [];
      return fs.readFileSync(filePath, 'utf-8')
        .split(/\r?\n/)
        .map((text, i) => ({ lineNo: i + 1, text }))
        .filter(({ text }) => text.startsWith('▶'));
    }

    test('R1: staged validate-phase.md routing block uses /gsd-<cmd> hyphen form', () => {
      const stagedFile = path.join(
        claudeTmpDir, '.claude', 'get-shit-done', 'workflows', 'validate-phase.md',
      );
      assert.ok(
        fs.existsSync(stagedFile),
        `validate-phase.md must exist in staged get-shit-done/workflows/`,
      );
      const routingLines = collectRoutingLines(stagedFile);
      // Exactly two known routing lines (▶ Next / ▶ Retry).
      const gsdRoutingLines = routingLines.filter(({ text }) => /\/gsd[-:]/.test(text));
      assert.strictEqual(
        gsdRoutingLines.length,
        2,
        `validate-phase.md must have exactly 2 ▶-routing lines referencing a /gsd- command — ` +
        `found ${gsdRoutingLines.length}: ${JSON.stringify(gsdRoutingLines)}`,
      );
      // Positive: every routing line that references gsd must use the hyphen form.
      for (const { lineNo, text } of gsdRoutingLines) {
        assert.ok(
          /\/gsd-[a-z]/.test(text),
          `validate-phase.md line ${lineNo}: ▶-routing line must use /gsd-<cmd> hyphen form, got: ${JSON.stringify(text)}`,
        );
        // Negative: must not contain the colon form.
        assert.ok(
          !/\/gsd:[a-z]/.test(text),
          `validate-phase.md line ${lineNo}: ▶-routing line must not contain /gsd:<cmd> colon form, got: ${JSON.stringify(text)}`,
        );
        // Token-level: extract real command tokens (/gsd-<cmd> starting with a
        // lowercase letter) and assert none contain an embedded colon.
        // Skips documentation placeholder tokens like /gsd-[command].
        const rawTokens = text.match(/\/gsd[^\s]*/g) || [];
        for (const token of rawTokens) {
          assert.ok(
            !token.includes(':'),
            `validate-phase.md line ${lineNo}: /gsd token "${token}" must not contain a colon — embedded colon detected (e.g. /gsd-validate:phase), got: ${JSON.stringify(text)}`,
          );
        }
      }
    });

    test('R2: staged secure-phase.md routing block uses /gsd-<cmd> hyphen form', () => {
      const stagedFile = path.join(
        claudeTmpDir, '.claude', 'get-shit-done', 'workflows', 'secure-phase.md',
      );
      assert.ok(
        fs.existsSync(stagedFile),
        `secure-phase.md must exist in staged get-shit-done/workflows/`,
      );
      const routingLines = collectRoutingLines(stagedFile);
      // Exactly three known routing lines (fix-mitigations, validate-phase, verify-work).
      const gsdRoutingLines = routingLines.filter(({ text }) => /\/gsd[-:]/.test(text));
      assert.strictEqual(
        gsdRoutingLines.length,
        3,
        `secure-phase.md must have exactly 3 ▶-routing lines referencing a /gsd- command — ` +
        `found ${gsdRoutingLines.length}: ${JSON.stringify(gsdRoutingLines)}`,
      );
      for (const { lineNo, text } of gsdRoutingLines) {
        assert.ok(
          /\/gsd-[a-z]/.test(text),
          `secure-phase.md line ${lineNo}: ▶-routing line must use /gsd-<cmd> hyphen form, got: ${JSON.stringify(text)}`,
        );
        assert.ok(
          !/\/gsd:[a-z]/.test(text),
          `secure-phase.md line ${lineNo}: ▶-routing line must not contain /gsd:<cmd> colon form, got: ${JSON.stringify(text)}`,
        );
        // Token-level: extract all /gsd... tokens and assert none contain an
        // embedded colon (catches /gsd-validate:phase etc).
        // Skips documentation placeholder tokens like /gsd-[command].
        const rawTokens = text.match(/\/gsd[^\s]*/g) || [];
        for (const token of rawTokens) {
          assert.ok(
            !token.includes(':'),
            `secure-phase.md line ${lineNo}: /gsd token "${token}" must not contain a colon — embedded colon detected (e.g. /gsd-validate:phase), got: ${JSON.stringify(text)}`,
          );
        }
      }
    });

    test('R3: all staged workflow routing blocks use hyphen form (cross-file sweep)', () => {
      // R3 unique value vs W3:
      //   W3 catches overt /gsd:<cmd> at file level (any line).
      //   R3 adds:
      //     (a) ▶-line-scoped assertion (catches drift specifically in routing-block context)
      //     (b) embedded-colon token check (e.g. /gsd-validate:phase partial-conversion artifacts)
      //         not detectable by W3's file-level regex
      // Sweeps both workflows/ and references/ so routing blocks in reference files
      // are covered alongside workflow files.
      const gsdDir = path.join(claudeTmpDir, '.claude', 'get-shit-done');
      const workflowsDir = path.join(gsdDir, 'workflows');
      assert.ok(fs.existsSync(workflowsDir), 'workflows/ must exist for R3 to be meaningful');

      const colonOffenders = [];
      const embeddedColonOffenders = [];
      const walk = (d) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const fullPath = path.join(d, entry.name);
          if (entry.isDirectory()) { walk(fullPath); continue; }
          if (!entry.name.endsWith('.md')) continue;
          const lines = fs.readFileSync(fullPath, 'utf-8').split(/\r?\n/);
          const rel = path.relative(claudeTmpDir, fullPath);
          lines.forEach((text, i) => {
            if (!text.startsWith('▶')) return;
            // Negative: must not contain overt /gsd:<cmd> colon form.
            if (/\/gsd:[a-z]/.test(text)) {
              colonOffenders.push(`${rel}:${i + 1}: ${text.trim()}`);
            }
            // Token-level: check each /gsd... token for an embedded colon.
            // Catches cases like /gsd-validate:phase where normalizer half-converted.
            // Documentation placeholder tokens like /gsd-[command] are skipped
            // because their tokens will not contain a colon.
            const tokens = text.match(/\/gsd[^\s]*/g) || [];
            for (const token of tokens) {
              if (token.includes(':')) {
                embeddedColonOffenders.push(`${rel}:${i + 1}: token "${token}" in "${text.trim()}"`);
              }
            }
          });
        }
      };
      // Walk both workflows/ and references/ — routing blocks can appear in either.
      walk(workflowsDir);
      const refsDir = path.join(gsdDir, 'references');
      if (fs.existsSync(refsDir)) walk(refsDir);

      assert.deepEqual(
        colonOffenders,
        [],
        `Staged workflows contain ▶-routing lines with /gsd:<cmd> colon form — ` +
        `these must resolve to /gsd-<cmd> for Claude Code skills-based install. ` +
        `Offenders:\n  ${colonOffenders.join('\n  ')}`,
      );
      assert.deepEqual(
        embeddedColonOffenders,
        [],
        `Staged workflows contain ▶-routing lines with /gsd tokens that have an embedded ` +
        `colon (e.g. /gsd-validate:phase) — normalizer may have partially converted a token. ` +
        `Offenders:\n  ${embeddedColonOffenders.join('\n  ')}`,
      );
    });
  });

  // -------------------------------------------------------------------------
  // G — negative: gemini install must PRESERVE colon form (no-op normalizer)
  // -------------------------------------------------------------------------
  describe('G — negative: staged gemini workflows preserve colon-namespace refs', () => {
    let tmpDir;
    const cmdNames = readCmdNames();
    const rosterRegex = buildRosterRegex(cmdNames);

    before(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3683-gem-'));
      runGeminiLocalInstall(tmpDir);
    });

    after(() => {
      if (tmpDir) {
        fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    });

    test('G0: staged gemini get-shit-done/workflows/ directory exists after install', () => {
      const workflowsDir = path.join(tmpDir, '.gemini', 'get-shit-done', 'workflows');
      assert.ok(
        fs.existsSync(workflowsDir),
        `gemini get-shit-done/workflows/ must be created at ${workflowsDir}`,
      );
    });

    test('G1: gemini discuss-phase.md preserves colon form (normalizer is a no-op for gemini)', () => {
      // Gemini registers /gsd:<cmd> as its canonical form — normalization
      // must NOT fire for this runtime. Verify colon refs survive unchanged.
      const stagedFile = path.join(
        tmpDir, '.gemini', 'get-shit-done', 'workflows', 'discuss-phase.md',
      );
      assert.ok(
        fs.existsSync(stagedFile),
        `gemini discuss-phase.md must exist in staged get-shit-done/workflows/`,
      );
      const content = fs.readFileSync(stagedFile, 'utf-8');
      // The source has 7 colon refs; at least one must be present in gemini output.
      const colonMatches = content.match(/gsd:[a-z][a-z0-9-]*/g) || [];
      const knownColonRefs = colonMatches.filter(m => cmdNames.includes(m.slice(4)));
      assert.ok(
        knownColonRefs.length > 0,
        `gemini staged discuss-phase.md must preserve /gsd:<cmd> colon refs — ` +
        `they are Gemini's canonical command namespace and must not be rewritten to hyphen form`,
      );
    });

    test('G2: gemini workflows are not over-normalized (no /gsd-- double-hyphen artifacts)', () => {
      const workflowsDir = path.join(tmpDir, '.gemini', 'get-shit-done', 'workflows');
      if (!fs.existsSync(workflowsDir)) return; // guard — G0 already asserts existence
      const doubleHyphenRegex = /\/gsd--[a-z]/;
      const garbled = collectOffenders(workflowsDir, doubleHyphenRegex);
      const relGarbled = garbled.map(f => path.relative(tmpDir, f));
      assert.deepEqual(
        relGarbled,
        [],
        `Gemini staged workflows contain /gsd-- double-hyphen artifacts — normalizer ran when it should not have. Garbled: ${relGarbled.join(', ')}`,
      );
    });
  });
});
