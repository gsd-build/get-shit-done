#!/usr/bin/env node
'use strict';

/**
 * Deterministic latest-version check for /gsd-update (#2992).
 *
 * The /gsd-update workflow's check_latest_version step was previously
 * prescribed in LLM-driven prose ("run `npm view get-shit-done-cc
 * version`"). The executing model could shortcut the prescription and
 * invent npm queries against wrong-shaped names (`@get-shit-done/cli`,
 * `get-shit-done-cli`, `gsd`), all of which 404 or — worse — return an
 * unrelated typosquat package.
 *
 * This script makes the package name a CONSTANT in code, not a free
 * choice at execution time. The workflow calls it via `npm run
 * check-latest-version -- --json` and parses the structured response.
 *
 * Tests assert on the typed CHECK_REASON enum and the structured result
 * record, never on console prose. See CONTRIBUTING.md "Prohibited: Raw
 * Text Matching on Test Outputs".
 */

const { execNpm } = require('./lib/shell-command-projection.cjs');

// Hardcoded. Do not parameterise — the whole point of this script is that
// the package name is not a runtime choice for the caller.
const PACKAGE_NAME = 'get-shit-done-cc';

const CHECK_REASON = Object.freeze({
  OK: 'ok',
  FAIL_NPM_FAILED: 'fail_npm_failed',
  FAIL_INVALID_OUTPUT: 'fail_invalid_output',
});

const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

/**
 * Pure-ish: takes an injected spawn function so tests don't actually run npm.
 * In production, defaults to execNpm() from the shell-projection seam.
 */
function checkLatestVersion(opts = {}) {
  // Default path routes through the shell-projection seam (execNpm owns the
  // Windows shell-flag policy and timeout default). The injection point
  // remains spawnSync-shaped for test compatibility — the adapter below
  // translates { exitCode } → { status } so the consumer logic is unchanged.
  // Bounded at 15s so a hung registry doesn't block /gsd-update (#2993 CR).
  const defaultSpawn = () => {
    const r = execNpm(['view', PACKAGE_NAME, 'version'], { timeout: 15_000 });
    return {
      status: r.exitCode,
      stdout: r.stdout,
      stderr: r.stderr,
      signal: r.signal,
      error: r.error,
    };
  };
  const spawn = opts.spawn || defaultSpawn;

  const r = spawn();
  if (!r || r.status !== 0) {
    // Distinguish timeout (status null, signal set, stderr empty) from a
    // genuine npm failure. Without this, both surfaced as "npm exited
    // non-zero" and the operator couldn't tell which (#2993 CR).
    let detail;
    if (r && r.signal) {
      detail = `npm timed out (signal: ${r.signal})`;
    } else if (r && r.stderr) {
      detail = r.stderr.trim();
    } else {
      detail = 'npm exited non-zero';
    }
    return {
      ok: false,
      reason: CHECK_REASON.FAIL_NPM_FAILED,
      detail,
    };
  }
  const version = (r.stdout || '').trim();
  if (!SEMVER_RE.test(version)) {
    return {
      ok: false,
      reason: CHECK_REASON.FAIL_INVALID_OUTPUT,
      detail: version || '(empty)',
    };
  }
  return { ok: true, version, reason: CHECK_REASON.OK };
}

function main() {
  const json = process.argv.includes('--json');
  const r = checkLatestVersion();
  if (json) {
    process.stdout.write(JSON.stringify(r) + '\n');
  } else if (r.ok) {
    process.stdout.write(r.version + '\n');
  } else {
    process.stderr.write(`check-latest-version: ${r.reason}: ${r.detail}\n`);
  }
  process.exit(r.ok ? 0 : 1);
}

if (require.main === module) main();

module.exports = { checkLatestVersion, CHECK_REASON, PACKAGE_NAME };
