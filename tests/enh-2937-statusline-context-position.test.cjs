'use strict';

/**
 * Enhancement #2937 — statusline opt-in `context_position` config.
 *
 * Asserts that:
 *   - VALID_CONFIG_KEYS registers statusline.context_position (parity guard)
 *   - Default (no config) renders ctx at tail — "end" layout
 *   - Explicit "end" is byte-identical to default (regression guard)
 *   - Explicit "front" puts ctx after model, before first " │ "
 *   - Empty ctx with "front" leaves no stray separator
 *   - Invalid value (e.g. "middle") silently falls back to "end" at runtime
 *   - gsdUpdate warning stays leftmost in both "front" and "end" modes
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { composeStatusline } = require('../hooks/gsd-statusline.js');
const { VALID_CONFIG_KEYS } = require('../get-shit-done/bin/lib/config-schema.cjs');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ── Parity guard ─────────────────────────────────────────────────────────────

test('config schema registers statusline.context_position', () => {
  assert.ok(
    VALID_CONFIG_KEYS.has('statusline.context_position'),
    'statusline.context_position must be in VALID_CONFIG_KEYS',
  );
});

// ── Default / "end" layout ───────────────────────────────────────────────────

test('default (no position arg) renders ctx at tail — end layout', () => {
  const ctx = ' \x1b[32m████░░░░░░ 40%\x1b[0m';
  const out = composeStatusline({ model: 'Claude', dirname: 'myproject', ctx });
  // ctx should appear after dirname, not before first │
  const dirIdx = out.indexOf('myproject');
  const ctxIdx = out.indexOf(ctx);
  assert.ok(ctxIdx > dirIdx, `ctx should be after dirname; got: ${out}`);
});

test('explicit "end" is byte-identical to default', () => {
  const ctx = ' \x1b[32m████░░░░░░ 40%\x1b[0m';
  const args = { model: 'Claude', dirname: 'myproject', ctx };
  const defaultOut = composeStatusline(args);
  const endOut = composeStatusline({ ...args, position: 'end' });
  assert.strictEqual(endOut, defaultOut, 'explicit "end" must equal default output');
});

test('"end" with middle segment places ctx after dirname', () => {
  const ctx = ' \x1b[32m████░░░░░░ 40%\x1b[0m';
  const out = composeStatusline({ model: 'Claude', ctx, middle: 'doing work', dirname: 'proj', position: 'end' });
  const dirIdx = out.indexOf('proj');
  const ctxIdx = out.indexOf(ctx);
  assert.ok(ctxIdx > dirIdx, `ctx should be after dirname in end mode; got: ${out}`);
});

// ── "front" layout ───────────────────────────────────────────────────────────

test('"front" puts ctx after model name, before first │', () => {
  const ctx = ' \x1b[32m████░░░░░░ 40%\x1b[0m';
  const out = composeStatusline({ model: 'Claude', dirname: 'myproject', ctx, position: 'front' });
  const firstPipe = out.indexOf(' │ ');
  const ctxIdx = out.indexOf(ctx);
  assert.ok(ctxIdx !== -1, `ctx should appear in output; got: ${out}`);
  assert.ok(ctxIdx < firstPipe, `ctx should come before first │ in front mode; got: ${out}`);
});

test('"front" with middle segment: ctx after model, before first │', () => {
  const ctx = ' \x1b[32m████░░░░░░ 40%\x1b[0m';
  const out = composeStatusline({ model: 'Claude', ctx, middle: 'doing work', dirname: 'proj', position: 'front' });
  const firstPipe = out.indexOf(' │ ');
  const ctxIdx = out.indexOf(ctx);
  assert.ok(ctxIdx < firstPipe, `ctx must precede first │; got: ${out}`);
});

// ── Empty ctx ────────────────────────────────────────────────────────────────

test('empty ctx + "front" renders no stray separator', () => {
  const out = composeStatusline({ model: 'Claude', dirname: 'myproject', ctx: '', position: 'front' });
  // Should not have double-separator or leading │
  assert.ok(!out.includes(' │  │ '), `stray separator found; got: ${out}`);
  // Should still contain the single separator between model area and dirname
  assert.ok(out.includes(' │ '), `expected at least one separator; got: ${out}`);
});

test('empty ctx + "end" renders no stray separator', () => {
  const out = composeStatusline({ model: 'Claude', dirname: 'myproject', ctx: '', position: 'end' });
  assert.ok(!out.includes(' │  │ '), `stray separator found; got: ${out}`);
});

// ── Invalid value fallback ───────────────────────────────────────────────────

test('invalid position value silently falls back to "end" layout', () => {
  const ctx = ' \x1b[32m████░░░░░░ 40%\x1b[0m';
  const invalid = composeStatusline({ model: 'Claude', dirname: 'myproject', ctx, position: 'middle' });
  const end = composeStatusline({ model: 'Claude', dirname: 'myproject', ctx, position: 'end' });
  assert.strictEqual(invalid, end, `invalid position should produce same output as "end"; got: ${invalid}`);
});

test('invalid position "banana" silently falls back to "end"', () => {
  const ctx = ' \x1b[33m██████░░░░ 60%\x1b[0m';
  const invalid = composeStatusline({ model: 'Claude', dirname: 'proj', ctx, position: 'banana' });
  const end = composeStatusline({ model: 'Claude', dirname: 'proj', ctx, position: 'end' });
  assert.strictEqual(invalid, end, `invalid "banana" should fall back to "end"; got: ${invalid}`);
});

// ── gsdUpdate leftmost invariant ─────────────────────────────────────────────

test('gsdUpdate warning is leftmost in "end" mode', () => {
  const gsdUpdate = '\x1b[33m⬆ /gsd:update\x1b[0m │ ';
  const out = composeStatusline({ gsdUpdate, model: 'Claude', dirname: 'proj', position: 'end' });
  assert.ok(out.startsWith(gsdUpdate), `gsdUpdate should be leftmost in end mode; got: ${out}`);
});

test('gsdUpdate warning is leftmost in "front" mode', () => {
  const gsdUpdate = '\x1b[33m⬆ /gsd:update\x1b[0m │ ';
  const ctx = ' \x1b[32m████░░░░░░ 40%\x1b[0m';
  const out = composeStatusline({ gsdUpdate, model: 'Claude', dirname: 'proj', ctx, position: 'front' });
  assert.ok(out.startsWith(gsdUpdate), `gsdUpdate should be leftmost in front mode; got: ${out}`);
});

// ── CLI write-path enforcement (config-set rejects invalid enum) ─────────────
// Locked design: hard reject at config-set time AND silent fallback at runtime.
// The runtime fallback is covered by the "Invalid position value silently falls
// back" tests above. This test covers the other half — that the CLI write path
// actually refuses to persist an invalid value in the first place.

test('config-set rejects invalid statusline.context_position', () => {
  const tmpDir = createTempProject();
  try {
    const r = runGsdTools(
      ['config-set', 'statusline.context_position', 'middle'],
      tmpDir,
    );
    assert.equal(
      r.success,
      false,
      `config-set should exit non-zero on invalid enum; got success=${r.success}, output=${r.output}`,
    );
    assert.ok(
      /statusline\.context_position|Invalid/i.test(r.error),
      `stderr must reference key or "Invalid"; got: ${r.error}`,
    );
  } finally {
    cleanup(tmpDir);
  }
});
