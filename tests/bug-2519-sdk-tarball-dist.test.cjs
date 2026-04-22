/**
 * Regression test for #2519: @gsd-build/sdk tarball shipped without dist/
 *
 * The published 0.1.0 tarball lacked a `files` whitelist including `dist/` and
 * a `prepublishOnly` hook to build `dist/` before publish. As a result the
 * tarball contained only source and the declared `bin` target `./dist/cli.js`
 * was absent at install time, breaking every `gsd-sdk query …` call.
 *
 * This test guards sdk/package.json so future edits cannot silently drop
 * either safeguard.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SDK_PACKAGE_JSON = path.join(__dirname, '..', 'sdk', 'package.json');

describe('bug #2519: sdk/package.json ships dist/ in tarball', () => {
  const pkg = JSON.parse(fs.readFileSync(SDK_PACKAGE_JSON, 'utf-8'));

  test('has a files whitelist (array) so publish is explicit', () => {
    assert.ok(
      Array.isArray(pkg.files),
      'sdk/package.json must declare a `files` array so the tarball contents are explicit',
    );
    assert.ok(
      pkg.files.length > 0,
      '`files` array must not be empty',
    );
  });

  test('files whitelist includes dist/ so compiled output is published', () => {
    assert.ok(Array.isArray(pkg.files), '`files` must be an array');
    const includesDist = pkg.files.some((entry) => {
      if (typeof entry !== 'string') return false;
      const normalized = entry.replace(/\\/g, '/').replace(/^\.\//, '');
      return /^dist(?:$|\/|\/\*\*|\/\*\*\/\*)/.test(normalized);
    });
    assert.ok(
      includesDist,
      `sdk/package.json \`files\` must include "dist" so the published tarball contains the compiled CLI (bin target ./dist/cli.js). Found: ${JSON.stringify(pkg.files)}`,
    );
  });

  test('has prepublishOnly script that runs a build', () => {
    assert.ok(
      pkg.scripts && typeof pkg.scripts === 'object',
      'sdk/package.json must have a `scripts` object',
    );
    const prepub = pkg.scripts.prepublishOnly;
    assert.ok(
      typeof prepub === 'string' && prepub.length > 0,
      'sdk/package.json must define `scripts.prepublishOnly` so dist/ is (re)built before every publish',
    );
    // Must invoke a build — either `npm run build`, `tsc`, or similar.
    const looksLikeBuild = /\b(build|tsc)\b/.test(prepub);
    assert.ok(
      looksLikeBuild,
      `scripts.prepublishOnly must run a build command (e.g. "npm run build" or "tsc"). Got: ${JSON.stringify(prepub)}`,
    );
  });

  test('bin target lives under dist/ (sanity: the thing files+prepublish must ship)', () => {
    assert.ok(pkg.bin, 'sdk/package.json must declare a `bin` field');
    const binValues = typeof pkg.bin === 'string'
      ? [pkg.bin]
      : Object.values(pkg.bin);
    assert.ok(
      binValues.some((p) => typeof p === 'string' && p.includes('dist/')),
      `bin target must reference dist/ — otherwise the files+prepublishOnly guard is pointless. Got: ${JSON.stringify(pkg.bin)}`,
    );
  });
});
