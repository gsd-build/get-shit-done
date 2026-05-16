'use strict';

/**
 * Regression test for #3588 — production dependency tree must not carry
 * high or moderate npm-audit advisories.
 *
 * Strategy: run `npm audit --omit=dev --json` against both the root
 * workspace and the embedded SDK package and assert that the metadata
 * vulnerability counts are zero across info/low/moderate/high/critical.
 *
 * The test is intentionally strict — any advisory of any severity (other
 * than 'low' if the maintainer accepts it; that branch is left explicit
 * here) blocks CI. If a future advisory lands without an upstream patch,
 * either bump the patched transitive (preferred), or annotate the
 * acceptance below with a justification AND a link to the upstream tracker.
 *
 * Skips automatically when `node_modules/` is absent (a fresh checkout
 * before `npm install`) so the test does not falsely report on developer
 * machines mid-setup.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SDK = path.join(ROOT, 'sdk');

function auditProductionVulns(cwd) {
  if (!fs.existsSync(path.join(cwd, 'node_modules'))) {
    return null; // signal "skip" to caller
  }
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  let out;
  try {
    out = execFileSync(
      npmCmd,
      ['audit', '--omit=dev', '--json'],
      { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }
    );
  } catch (e) {
    // `npm audit` exits non-zero when advisories are present; the JSON is
    // still on stdout in that case. Recover and let the assertion classify.
    if (e && typeof e.stdout !== 'undefined') {
      out = Buffer.isBuffer(e.stdout) ? e.stdout.toString('utf-8') : String(e.stdout);
    } else {
      throw e;
    }
  }
  const parsed = JSON.parse(out);
  // `null` is reserved for the "node_modules missing → skip" signal above.
  // Any other unexpected JSON shape is a real failure of the audit harness
  // (npm changed its output format, audit aborted before metadata, etc.) —
  // throw so the test fails loudly instead of skipping silently.
  if (parsed && parsed.metadata && parsed.metadata.vulnerabilities) {
    return parsed.metadata.vulnerabilities;
  }
  throw new Error(`Unexpected npm audit JSON shape in ${cwd}: missing metadata.vulnerabilities`);
}

describe('#3588: npm audit --omit=dev reports zero advisories', () => {
  test('root workspace production tree has no advisories', { timeout: 90_000 }, (t) => {
    const vulns = auditProductionVulns(ROOT);
    if (vulns === null) {
      t.skip('node_modules/ not present — run `npm install` before this test');
      return;
    }
    assert.strictEqual(vulns.critical, 0, `expected 0 critical; got ${vulns.critical}`);
    assert.strictEqual(vulns.high, 0, `expected 0 high; got ${vulns.high}`);
    assert.strictEqual(vulns.moderate, 0, `expected 0 moderate; got ${vulns.moderate}`);
    // Low advisories are not explicitly forbidden by the #3588 acceptance
    // criterion but the issue listed only high/moderate as actual findings —
    // tighten if any future low advisory is introduced.
    assert.strictEqual(vulns.low, 0, `expected 0 low; got ${vulns.low}`);
  });

  test('sdk/ production tree has no advisories', { timeout: 90_000 }, (t) => {
    const vulns = auditProductionVulns(SDK);
    if (vulns === null) {
      t.skip('sdk/node_modules/ not present — run `npm ci` inside sdk/ before this test');
      return;
    }
    assert.strictEqual(vulns.critical, 0, `expected 0 critical; got ${vulns.critical}`);
    assert.strictEqual(vulns.high, 0, `expected 0 high; got ${vulns.high}`);
    assert.strictEqual(vulns.moderate, 0, `expected 0 moderate; got ${vulns.moderate}`);
    assert.strictEqual(vulns.low, 0, `expected 0 low; got ${vulns.low}`);
  });
});
