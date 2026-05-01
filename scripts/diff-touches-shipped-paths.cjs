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

function isShipped(diffPath, shipPrefixes) {
  // Normalize Windows-style separators just in case (git always emits
  // forward slashes, but a developer running this locally on a different
  // tool's output shouldn't get a false negative).
  const p = diffPath.replace(/\\/g, '/');
  return shipPrefixes.some((s) => p === s || p.startsWith(s + '/'));
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
      const hit = paths.some((p) => isShipped(p, shipPrefixes));
      process.exit(hit ? EXIT_SHIPPED : EXIT_NOT_SHIPPED);
    } catch (err) {
      fail('classification failed', err);
    }
  });
}

if (require.main === module) {
  main();
}

module.exports = { loadShipPrefixes, isShipped, EXIT_SHIPPED, EXIT_NOT_SHIPPED, EXIT_ERROR };
