#!/usr/bin/env node
/**
 * Used by the release-sdk hotfix cherry-pick loop to decide whether a
 * candidate commit can possibly change what ships in the npm package.
 *
 * Reads a newline-separated list of paths from stdin (typically the
 * output of `git diff-tree --no-commit-id --name-only -r <SHA>`) and
 * exits 0 if any path is part of the npm tarball's shipped contents,
 * 1 otherwise.
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
 * Exit codes:
 *   0  at least one path is shipped → cherry-pick is meaningful
 *   1  no shipped paths             → CI / test / docs / planning-only;
 *                                     hotfix loop skips the commit
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

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

function main() {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const shipPrefixes = loadShipPrefixes(pkgPath);

  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buf += chunk;
  });
  process.stdin.on('end', () => {
    const paths = buf.split('\n').map((s) => s.trim()).filter(Boolean);
    const hit = paths.some((p) => isShipped(p, shipPrefixes));
    process.exit(hit ? 0 : 1);
  });
}

if (require.main === module) {
  main();
}

module.exports = { loadShipPrefixes, isShipped };
