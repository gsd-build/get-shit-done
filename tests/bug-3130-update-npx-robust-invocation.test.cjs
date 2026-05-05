'use strict';
// allow-test-rule: reads product workflow markdown (update.md) to verify structural invocation contract — not a source-grep test

// Regression guard for bug #3130.
//
// Two failure modes were observed with the pre-fix npx invocation form:
//   1. Cache-stale: bare `npx -y get-shit-done-cc@latest` hits npx's local
//      cache and may pull an older version instead of @latest.
//   2. Token-routing: Bash-tool wrappers misroute the `@` token in
//      `get-shit-done-cc@latest`, causing npm to error with
//      "Unknown command: get-shit-done-cc@latest".
//
// The robust form is:
//   npx -y --package=get-shit-done-cc@latest -- get-shit-done-cc $ARGS
//
// `--package=` forces a fresh registry fetch, bypassing the npx cache.
// `--` clearly delineates npx flags from the run-command, preventing
// Bash-tool @-token misrouting.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const UPDATE_WF = path.join(ROOT, 'get-shit-done', 'workflows', 'update.md');

const src = fs.readFileSync(UPDATE_WF, 'utf8');

test('bug #3130: update.md contains no bare npx invocations (cache-stale form)', () => {
  // Any occurrence of `npx -y get-shit-done-cc@latest` without `--package=`
  // is the stale form that triggers the two failure modes.
  const stale = (src.match(/npx -y get-shit-done-cc@latest[^\n]*/g) || []);
  assert.deepEqual(
    stale,
    [],
    `Stale npx forms found in update.md (must use --package= form): ${stale.join('; ')}`,
  );
});

test('bug #3130: update.md has >=3 robust npx invocations (--package= + -- separator)', () => {
  // Three sibling invocations: local, global, and unknown/fallback.
  const robust = (src.match(/npx -y --package=get-shit-done-cc@latest -- get-shit-done-cc/g) || []);
  assert.ok(
    robust.length >= 3,
    `Expected >=3 robust npx invocations in update.md, found ${robust.length}`,
  );
});
