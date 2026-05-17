'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Ratchet-style lint guard against Windows-test-parity regressions.
 *
 * PR #3649 cleared ~270 Windows-only test failures from the chunking fix
 * in #3597 surfaced. Each cluster reduced to a handful of repeating
 * patterns. This guard prevents the patterns from being re-introduced.
 *
 * Strategy: per-pattern offender list is snapshotted at the count present
 * at the time of PR #3649. The test fails if a NEW file is added that
 * matches the anti-pattern (count grows above the baseline). Existing
 * offenders are acknowledged as technical debt that can be cleared
 * incrementally without blocking this PR.
 *
 * When you fix an existing offender, lower the corresponding BASELINE
 * count by 1. When CI breaks because BASELINE is set higher than the
 * actual offender count, lower BASELINE to match (one-way ratchet down).
 *
 * Scope: tests/ only. Production-code Windows-compat is enforced via
 * behavioural tests (see no-unconditional-win32-skip.test.cjs).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TESTS_DIR = path.join(__dirname);
const SELF = path.basename(__filename);

// ── Baseline counts after PR #3649 batch ─────────────────────────────────
// Set these to the exact number of offending files at the time of merge.
// Each rule must not exceed its baseline; CI fails when a new offender appears.
// Decrement when an existing offender is fixed.
const BASELINE = {
  splitNewlineOnFileContent: 3,
  fenceRegexLiteralNewline: 2,
  frontmatterAnchorLiteralNewline: 5,
  hardcodedTmpToFsCall: 0,
  bareNpmExecWithoutShell: 0,
  stubsHomeNoUserProfile: 8,
  rmSyncNoMaxRetries: 95,
};

function listTestFiles() {
  return fs.readdirSync(TESTS_DIR)
    .filter((f) => /\.(test|spec)\.cjs$/.test(f))
    .filter((f) => f !== SELF)
    .map((f) => path.join(TESTS_DIR, f));
}

function readFileText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// Strip line comments and block comments before pattern matching to avoid
// false-positives in commentary describing the very pattern we forbid.
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function countMatchingFiles(predicate) {
  let count = 0;
  const offenders = [];
  for (const file of listTestFiles()) {
    const text = stripComments(readFileText(file));
    if (predicate(text, file)) {
      count += 1;
      offenders.push(path.basename(file));
    }
  }
  return { count, offenders };
}

function ratchetAssert(rule, actualCount, baselineCount, offenders, guidance) {
  if (actualCount > baselineCount) {
    const newCount = actualCount - baselineCount;
    assert.fail(
      `Windows-parity guard "${rule}": ${actualCount} offenders, baseline is ${baselineCount} ` +
      `(+${newCount} new). New occurrences of this anti-pattern were added. ` +
      `${guidance}\n\nFull offender list (${actualCount}):\n  ` +
      offenders.join('\n  '),
    );
  }
}

describe('Windows test-parity lint guards (ratchet baseline: PR #3649)', () => {
  // ── G1 — CRLF: file-content split on literal '\n' ─────────────────────
  test('split-on-newline after readFileSync (use /\\r?\\n/)', () => {
    const { count, offenders } = countMatchingFiles((text) => {
      return /\.readFileSync\s*\([^)]*\)[^;]*\.split\(\s*['"]\\n['"]\s*\)/.test(text);
    });
    ratchetAssert(
      'splitNewlineOnFileContent', count, BASELINE.splitNewlineOnFileContent, offenders,
      "Replace .split('\\n') with .split(/\\r?\\n/) so the test tolerates CRLF " +
      "checkout (autocrlf=true on Windows leaves trailing \\r on every line).",
    );
  });

  // ── G2 — CRLF: ```bash|sh\n fence regex on file content ──────────────
  test('markdown-fence regex with literal \\n after ```bash/sh', () => {
    const { count, offenders } = countMatchingFiles((text) => {
      return /\/[^/]*```(?:bash|sh)\\n[^/]*\//.test(text);
    });
    ratchetAssert(
      'fenceRegexLiteralNewline', count, BASELINE.fenceRegexLiteralNewline, offenders,
      "Use /```(?:bash|sh)\\r?\\n([\\s\\S]*?)```/g — Windows CRLF makes the byte after " +
      "`bash` be \\r, the regex never matches, and bash-block extraction returns empty.",
    );
  });

  // ── G3 — CRLF: frontmatter regex with literal '\n' ────────────────────
  test('frontmatter regex anchors on /^---\\n/', () => {
    const { count, offenders } = countMatchingFiles((text) => {
      return /\/\^---\\n/.test(text);
    });
    ratchetAssert(
      'frontmatterAnchorLiteralNewline', count, BASELINE.frontmatterAnchorLiteralNewline, offenders,
      "Use /^---\\r?\\n/ — on Windows the byte after --- is \\r, not \\n, so the " +
      "anchor fails to match and parseFrontmatter returns null/{}.",
    );
  });

  // ── G4 — POSIX-tmp: hardcoded '/tmp/' literal passed to fs.* ─────────
  test('fs.* call receives a hardcoded "/tmp/..." literal', () => {
    const { count, offenders } = countMatchingFiles((text) => {
      return /\bfs\.[A-Za-z]+\s*\([^)]*['"]\/tmp\/[^'"]+['"][^)]*\)/.test(text);
    });
    ratchetAssert(
      'hardcodedTmpToFsCall', count, BASELINE.hardcodedTmpToFsCall, offenders,
      "Use os.tmpdir() — on Windows '/tmp/foo' becomes 'D:\\tmp\\foo' where D:\\tmp " +
      "doesn't exist by default → ENOENT.",
    );
  });

  // ── G5 — npm.cmd: bare 'npm' to exec*Sync without shell:true ─────────
  test('bare npm exec without shell-true Windows fallback', () => {
    const { count, offenders } = countMatchingFiles((text) => {
      const re = /\b(?:execFileSync|spawnSync)\s*\(\s*['"]npm['"]\s*,[^)]*\)/g;
      const matches = text.match(re) || [];
      return matches.some((m) =>
        !/shell\s*:\s*true/.test(m) && !/shell\s*:\s*isWindows/.test(m),
      );
    });
    ratchetAssert(
      'bareNpmExecWithoutShell', count, BASELINE.bareNpmExecWithoutShell, offenders,
      "On Windows npm is npm.cmd — pass {shell: process.platform === 'win32'} or " +
      "use npm.cmd directly, otherwise execFileSync errors ENOENT.",
    );
  });

  // ── G6 — Test stubs HOME without USERPROFILE ─────────────────────────
  test('test stubs process.env.HOME but never references USERPROFILE', () => {
    const { count, offenders } = countMatchingFiles((text) => {
      return /process\.env\.HOME\s*=\s*/.test(text) && !/USERPROFILE/.test(text);
    });
    ratchetAssert(
      'stubsHomeNoUserProfile', count, BASELINE.stubsHomeNoUserProfile, offenders,
      "On Windows os.homedir() reads USERPROFILE (not HOME). Tests redirecting ~ " +
      "must override both, or the SUT sees the real user's home.",
    );
  });

  // ── G7 — rmSync cleanup without retry budget ─────────────────────────
  test('test teardown rmSync without maxRetries', () => {
    const { count, offenders } = countMatchingFiles((text) => {
      const re = /fs\.rmSync\s*\([^)]*recursive\s*:\s*true[^)]*force\s*:\s*true[^)]*\)/g;
      const matches = text.match(re) || [];
      return matches.some((m) => !/maxRetries/.test(m));
    });
    ratchetAssert(
      'rmSyncNoMaxRetries', count, BASELINE.rmSyncNoMaxRetries, offenders,
      "Use helpers.cleanup() (shared 5s retry budget) or pass " +
      "{maxRetries: 10, retryDelay: 100} — Windows AV scanners can hold handles for " +
      "seconds after a process exits, surfacing as flaky EBUSY teardown failures.",
    );
  });
});
