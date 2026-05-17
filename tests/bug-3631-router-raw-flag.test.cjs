'use strict';

/**
 * Regression tests for #3631 — SDK dispatch path in family routers must
 * forward the `--raw` flag through to `output()`.
 *
 * Before the fix, every `*-command-router.cjs` `sdkHandler` called
 * `output(result.data)` without the second positional `raw` argument or the
 * third positional `rawValue`. With `--raw` set, the SDK path therefore
 * emitted JSON-stringified data ({"next":"2.1",...}) instead of the scalar
 * the CJS path used to print (e.g. `2.1`).
 *
 * Both tests below exercise the live SDK path:
 *   1. `phase next-decimal --raw <base>` must emit the next-decimal token.
 *   2. `roadmap get-phase --raw <id>` must emit the phase's roadmap section.
 *
 * Per CONTRIBUTING.md: assertions are on structured (scalar) tokens, not
 * substring grep against full JSON.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const GSD_TOOLS = path.resolve(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

function run(args, cwd) {
  try {
    return {
      ok: true,
      stdout: execFileSync(process.execPath, [GSD_TOOLS, ...args], {
        cwd,
        encoding: 'utf-8',
        timeout: 15000,
      }),
    };
  } catch (e) {
    return {
      ok: false,
      stdout: (e.stdout && e.stdout.toString()) || '',
      stderr: (e.stderr && e.stderr.toString()) || '',
      code: e.status,
    };
  }
}

function makeFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3631-'));
  const planning = path.join(tmp, '.planning');
  fs.mkdirSync(path.join(planning, 'phases'), { recursive: true });
  fs.writeFileSync(
    path.join(planning, 'ROADMAP.md'),
    [
      '# Project Roadmap',
      '',
      '## v1',
      '',
      '### Phase 1: First',
      '',
      'Body of phase 1.',
      '',
      '### Phase 2: Second',
      '',
      'Body of phase 2.',
      '',
    ].join('\n')
  );
  // PROJECT.md anchors the planning root for callers that resolve it.
  fs.writeFileSync(path.join(planning, 'PROJECT.md'), '# Test\n');
  return tmp;
}

describe('bug #3631 — SDK family routers forward --raw to output()', () => {
  test('phase next-decimal --raw emits the scalar next-decimal token (not JSON)', () => {
    const tmp = makeFixture();
    try {
      const res = run(['phase', 'next-decimal', '--raw', '1'], tmp);
      assert.ok(
        res.ok,
        `command must succeed; got code=${res.code} stderr=${res.stderr}`
      );
      const trimmed = res.stdout.trim();
      // Scalar form — must be a phase id token like "1.1", not a JSON object.
      assert.doesNotMatch(
        trimmed,
        /^\{/,
        `--raw must not emit JSON; got: ${trimmed}`
      );
      assert.match(
        trimmed,
        /^0*\d+(?:\.\d+)?$/,
        `--raw must emit a scalar phase id; got: ${trimmed}`
      );
      // SDK and CJS both normalize the base phase before computing the next-
      // decimal token; CJS emits "1.1" while SDK normalizes "1"→"01" and emits
      // "01.1". Both are valid scalar projections — assert on parity with the
      // computed-next semantics rather than the exact padding form.
      assert.ok(
        trimmed === '1.1' || trimmed === '01.1',
        `expected next-decimal of base "1" to be 1.1 or 01.1; got: ${trimmed}`
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('roadmap get-phase --raw emits the phase section (not JSON)', () => {
    const tmp = makeFixture();
    try {
      const res = run(['roadmap', 'get-phase', '--raw', '2'], tmp);
      assert.ok(
        res.ok,
        `command must succeed; got code=${res.code} stderr=${res.stderr}`
      );
      const trimmed = res.stdout.trim();
      assert.doesNotMatch(
        trimmed,
        /^\{/,
        `--raw must not emit JSON; got: ${trimmed.slice(0, 80)}`
      );
      // Section text starts with the heading.
      assert.match(
        trimmed,
        /Phase 2:\s*Second/,
        `--raw must emit the section body containing the Phase 2 heading; got: ${trimmed.slice(0, 80)}`
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
