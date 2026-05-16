#!/usr/bin/env node
/**
 * Used by the release-sdk hotfix cherry-pick loop to decide whether a
 * candidate commit can possibly change what ships in the npm package.
 *
 * Reads a newline-separated list of paths from stdin (typically the
 * output of `git diff-tree --no-commit-id --name-only -r <SHA>`) and
 * exits with one of three codes so the workflow can distinguish a
 * legitimate "skip this commit" signal from a classifier failure.
 *
 * "Shipped" = the union of:
 *   - package.json (always included by `npm pack`, regardless of `files`)
 *   - every entry in package.json `files`, treated as either an exact
 *     file match or a directory prefix (matching `npm pack` semantics).
 *   - CI-gating test paths: `tests/<anything>` plus
 *     `sdk/src/<anything>/<name>.test.<ts|cjs|mjs|js>` and `.spec.` variants
 *     — these don't ship in the tarball, but they gate the hotfix-branch
 *     test job. A test fixture update that aligns with a cherry-picked
 *     production fix MUST be pickable or CI fails on the hotfix run.
 *     #3621 — root cause of the v1.42.3 hotfix red CI.
 *
 * `package-lock.json` is intentionally NOT considered shipped — `npm pack`
 * excludes it from the tarball unless it's explicitly in `files`, and at
 * the time of writing this repo's `files` whitelist does not include it.
 *
 * Exit codes (the workflow MUST treat these distinctly — bug #2983):
 *   0  at least one path is shipped       → cherry-pick is meaningful
 *   1  no shipped paths                   → CI / test / docs / planning
 *                                            only; hotfix loop skips
 *   2  classifier error                   → bad/missing package.json,
 *                                            I/O failure, or any
 *                                            uncaught exception. The
 *                                            workflow MUST fail-fast on
 *                                            this code rather than
 *                                            treating it as a skip.
 *
 * Why distinct codes: Node's default exit code for uncaught throws is 1,
 * which would otherwise be indistinguishable from the legitimate "no
 * shipped paths" result. CodeRabbit on PR #2981 / bug #2983.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EXIT_SHIPPED = 0;
const EXIT_NOT_SHIPPED = 1;
const EXIT_ERROR = 2;

function loadShipPrefixes(pkgPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const files = Array.isArray(pkg.files) ? pkg.files : [];
  return ['package.json', ...files];
}

// #3621: paths that gate hotfix-branch CI even though they don't appear
// in the npm tarball. When a cherry-picked production fix changes behavior
// that an existing test on the v1.42.2 base asserts against, the matching
// test fixture from `main` must also be cherry-picked or CI fails on the
// hotfix run (exactly what happened on v1.42.3 — production fix(3562) was
// picked, the bundled test-fixture correction in commit 08848df8 was not).
// Combined with the `test:` prefix being added to the candidate-loop regex
// in release-sdk.yml, this lets `test(####):` fixture-alignment commits be
// cherry-picked alongside their production counterparts.
function isCiGating(diffPath) {
  if (diffPath.startsWith('tests/')) return true;
  // SDK vitest specs live next to source. Production source ships via
  // sdk/dist/ (already in package.json `files`); the test files are what's
  // missing from that surface.
  if (diffPath.startsWith('sdk/src/') && /\.(test|spec)\.(ts|cjs|mjs|js)$/.test(diffPath)) return true;
  return false;
}

function isShipped(diffPath, shipPrefixes) {
  // Normalize Windows-style separators just in case (git always emits
  // forward slashes, but a developer running this locally on a different
  // tool's output shouldn't get a false negative).
  const p = diffPath.replace(/\\/g, '/');
  return shipPrefixes.some((s) => p === s || p.startsWith(s + '/'));
}

// #2980: commits that touch `.github/workflows/*` cannot be cherry-picked
// onto a hotfix branch because the default GITHUB_TOKEN lacks the
// `workflow` permission and the push step fails. Detect them upfront so a
// `test:`-eligible commit bundling a workflow edit still gets skipped.
function isPushBlocking(diffPath) {
  return diffPath.replace(/\\/g, '/').startsWith('.github/workflows/');
}

function fail(message, err) {
  process.stderr.write(`diff-touches-shipped-paths: ${message}\n`);
  if (err && err.stack) process.stderr.write(`${err.stack}\n`);
  process.exit(EXIT_ERROR);
}

function main() {
  // Surface ANY uncaught failure as exit 2 (classifier error) rather
  // than letting Node's default-1 shadow the legitimate
  // "no shipped paths" result. Bug #2983.
  process.on('uncaughtException', (err) => fail('uncaught exception', err));
  process.on('unhandledRejection', (err) => fail('unhandled rejection', err));

  let shipPrefixes;
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    shipPrefixes = loadShipPrefixes(pkgPath);
  } catch (err) {
    return fail(`failed to read package.json from ${process.cwd()}`, err);
  }

  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('error', (err) => fail('stdin read error', err));
  process.stdin.on('data', (chunk) => {
    buf += chunk;
  });
  process.stdin.on('end', () => {
    try {
      const paths = buf.split('\n').map((s) => s.trim()).filter(Boolean);
      // #2980 still wins over #3621: any commit touching .github/workflows/*
      // is unpickable regardless of other content because the push step
      // fails on workflow scope rejection. Check this first.
      if (paths.some(isPushBlocking)) {
        process.exit(EXIT_NOT_SHIPPED);
      }
      if (paths.some((p) => isShipped(p, shipPrefixes))) {
        process.exit(EXIT_SHIPPED);
      }
      // #3621: a commit whose only relevant paths are CI-gating tests is
      // still pickable — it can change whether the hotfix CI passes even
      // though it doesn't change what the npm tarball ships.
      if (paths.some(isCiGating)) {
        process.exit(EXIT_SHIPPED);
      }
      process.exit(EXIT_NOT_SHIPPED);
    } catch (err) {
      fail('classification failed', err);
    }
  });
}

if (require.main === module) {
  main();
}

module.exports = { loadShipPrefixes, isShipped, isCiGating, isPushBlocking, EXIT_SHIPPED, EXIT_NOT_SHIPPED, EXIT_ERROR };
