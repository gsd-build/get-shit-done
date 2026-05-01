'use strict';

/**
 * Enhancement #2937 — statusline `context_position` flag.
 *
 * Asserts that:
 *   - default (flag absent) layout puts the context meter at the END of the
 *     line, after the directory name (byte-identical to prior behavior)
 *   - statusline.context_position="end" produces the same default layout
 *   - statusline.context_position="front" puts the context meter immediately
 *     after the model name, before the GSD-state segment
 *   - composeStatusline handles the no-middle case for both positions
 *   - the config key is registered in the schema so /gsd-settings can surface it
 *   - invalid values (e.g. "middle") fall back to default 'end' behavior
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const statusline = require('../hooks/gsd-statusline.js');
const { VALID_CONFIG_KEYS } = require('../get-shit-done/bin/lib/config-schema.cjs');

const CTX = ' \x1b[32m███░░░░░░░ 30%\x1b[0m';

function makeProject({ position }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'enh-2937-'));
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  if (position !== undefined) {
    fs.writeFileSync(
      path.join(dir, '.planning', 'config.json'),
      JSON.stringify({ statusline: { context_position: position } }),
    );
  }
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function buildInput(dir) {
  return {
    model: { display_name: 'Claude' },
    workspace: { current_dir: dir },
    session_id: 'test-session',
  };
}

test('config schema registers statusline.context_position', () => {
  assert.ok(
    VALID_CONFIG_KEYS.has('statusline.context_position'),
    'statusline.context_position must be in VALID_CONFIG_KEYS',
  );
});

test('composeStatusline default position is "end" (back-compat)', () => {
  const out = statusline.composeStatusline({
    model: 'Claude',
    ctx: CTX,
    middle: '\x1b[2mph 1/3\x1b[0m',
    dirname: 'project',
  });
  // ctx must appear after dirname
  const ctxIdx = out.indexOf(CTX);
  const dirIdx = out.indexOf('project');
  assert.ok(ctxIdx > dirIdx, `ctx must come after dirname in 'end' mode; got: ${out}`);
});

test('composeStatusline position=front puts ctx immediately after model', () => {
  const out = statusline.composeStatusline({
    model: 'Claude',
    ctx: CTX,
    middle: '\x1b[2mph 1/3\x1b[0m',
    dirname: 'project',
    position: 'front',
  });
  const modelIdx = out.indexOf('Claude');
  const ctxIdx = out.indexOf(CTX);
  const middleIdx = out.indexOf('ph 1/3');
  assert.ok(modelIdx < ctxIdx, `model must come before ctx; got: ${out}`);
  assert.ok(ctxIdx < middleIdx, `ctx must come before middle in 'front' mode; got: ${out}`);
});

test('composeStatusline position=end with no middle keeps ctx at end', () => {
  const out = statusline.composeStatusline({
    model: 'Claude',
    ctx: CTX,
    middle: null,
    dirname: 'project',
    position: 'end',
  });
  assert.ok(out.endsWith(CTX), `ctx must be at end when middle absent; got: ${out}`);
});

test('composeStatusline position=front with no middle puts ctx after model', () => {
  const out = statusline.composeStatusline({
    model: 'Claude',
    ctx: CTX,
    middle: null,
    dirname: 'project',
    position: 'front',
  });
  const modelIdx = out.indexOf('Claude');
  const ctxIdx = out.indexOf(CTX);
  const dirIdx = out.indexOf('project');
  assert.ok(modelIdx < ctxIdx && ctxIdx < dirIdx, `expected model -> ctx -> dirname; got: ${out}`);
});

test('renderStatusline default (flag absent) keeps ctx at end', () => {
  const { dir, cleanup } = makeProject({});
  try {
    const out = statusline.renderStatusline(buildInput(dir), CTX);
    const ctxIdx = out.indexOf(CTX);
    const dirIdx = out.indexOf(path.basename(dir));
    assert.ok(ctxIdx > dirIdx, `default must be 'end' mode; got: ${out}`);
  } finally {
    cleanup();
  }
});

test('renderStatusline with context_position="front" moves ctx before dirname', () => {
  const { dir, cleanup } = makeProject({ position: 'front' });
  try {
    const out = statusline.renderStatusline(buildInput(dir), CTX);
    const ctxIdx = out.indexOf(CTX);
    const dirIdx = out.indexOf(path.basename(dir));
    assert.ok(ctxIdx < dirIdx, `'front' mode must place ctx before dirname; got: ${out}`);
  } finally {
    cleanup();
  }
});

test('renderStatusline with context_position="end" matches default', () => {
  const a = makeProject({});
  const b = makeProject({ position: 'end' });
  try {
    const outDefault = statusline.renderStatusline(buildInput(a.dir), CTX);
    const outExplicit = statusline.renderStatusline(buildInput(b.dir), CTX);
    // Strip the dirname (different temp paths) for comparison
    const stripDir = (s, dir) => s.replace(path.basename(dir), 'DIR');
    assert.strictEqual(stripDir(outDefault, a.dir), stripDir(outExplicit, b.dir));
  } finally {
    a.cleanup(); b.cleanup();
  }
});

test('renderStatusline rejects invalid values and falls back to "end"', () => {
  const { dir, cleanup } = makeProject({ position: 'middle' });
  try {
    const out = statusline.renderStatusline(buildInput(dir), CTX);
    const ctxIdx = out.indexOf(CTX);
    const dirIdx = out.indexOf(path.basename(dir));
    assert.ok(ctxIdx > dirIdx, `invalid value must fall back to 'end'; got: ${out}`);
  } finally {
    cleanup();
  }
});
