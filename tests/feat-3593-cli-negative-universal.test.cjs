/**
 * Universal CLI negative-matrix sweep across the seven command families
 * named in #3593: phase, roadmap, state, config, workstream, init,
 * validate.
 *
 * The full per-case matrix for each family belongs in dedicated files
 * (the `config` family is the template — see
 * `feat-3593-cli-negative-config.test.cjs`). This file pins a much
 * narrower contract that EVERY family must satisfy:
 *
 *   1. Bare top-level command with no subcommand: must not crash with
 *      a V8 stack trace, must exit non-zero (or, where the bare form
 *      is legitimate, return a clean payload).
 *   2. Unknown subcommand at command depth: must emit a typed reason
 *      under --json-errors and must not crash.
 *   3. Shell-metacharacter as an argv element: must not be executed.
 *      Sentinel-file probe in the project temp dir proves this.
 *
 * Future per-family files will deepen each family's matrix; this file
 * is the floor.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runCli } = require('./helpers/cli-negative.cjs');
const { createTempProject, createTempGitProject, cleanup } = require('./helpers.cjs');

/**
 * Each entry names a top-level command, a representative subcommand
 * (for the "unknown sub" probe), and the temp-project factory.
 *
 * The `representativeSubcommand` is not asserted on directly — it
 * exists so the test layout reads "for each family, run probe X" and
 * so a future maintainer adding a family doesn't need to invent one.
 */
const FAMILIES = [
  { name: 'phase',      bare: ['phase'],      unknown: ['phase', 'this-sub-does-not-exist'],      projectFactory: createTempProject },
  { name: 'roadmap',    bare: ['roadmap'],    unknown: ['roadmap', 'this-sub-does-not-exist'],    projectFactory: createTempProject },
  { name: 'state',      bare: ['state'],      unknown: ['state', 'this-sub-does-not-exist'],      projectFactory: createTempProject },
  { name: 'config',     bare: ['config'],     unknown: ['config', 'this-sub-does-not-exist'],     projectFactory: createTempProject },
  { name: 'workstream', bare: ['workstream'], unknown: ['workstream', 'this-sub-does-not-exist'], projectFactory: createTempGitProject },
  { name: 'init',       bare: ['init'],       unknown: ['init', 'this-sub-does-not-exist'],       projectFactory: createTempProject },
  { name: 'validate',   bare: ['validate'],   unknown: ['validate', 'this-sub-does-not-exist'],   projectFactory: createTempProject },
];

describe('feat-3593: bare top-level command does not crash', () => {
  for (const fam of FAMILIES) {
    test(`${fam.name}: bare invocation exits cleanly without a stack trace`, (t) => {
      const projectDir = fam.projectFactory(`cli-neg-univ-bare-${fam.name}-`);
      t.after(() => cleanup(projectDir));
      const result = runCli(fam.bare, { cwd: projectDir });
      assert.equal(result.hasStackTrace, false, `${fam.name} bare must not leak a V8 stack frame`);
      assert.equal(result.signal, null, `${fam.name} bare must not be killed by a signal`);
      // We do not pin exit code here: some families legitimately treat the
      // bare form as a list/status command (status 0); others reject it as
      // a usage error (status ≠ 0). What we pin is "no crash."
    });
  }
});

describe('feat-3593: unknown subcommand emits a typed reason', () => {
  for (const fam of FAMILIES) {
    test(`${fam.name}: unknown subcommand fails with reason set and no stack trace`, (t) => {
      const projectDir = fam.projectFactory(`cli-neg-univ-unk-${fam.name}-`);
      t.after(() => cleanup(projectDir));
      const result = runCli(fam.unknown, { cwd: projectDir });
      assert.notEqual(result.status, 0, `${fam.name} unknown sub must exit non-zero`);
      assert.equal(result.hasStackTrace, false, `${fam.name} unknown sub must not leak a stack frame`);
      // When --json-errors is on, every typed-failure path lands a non-empty
      // reason string from ERROR_REASON. A null reason here means the family
      // is using throw/console.error somewhere — a TDD signal to wire that
      // failure path through error(msg, ERROR_REASON.X).
      assert.equal(typeof result.reason, 'string', `${fam.name}: reason must be a typed enum string (got: ${result.reason})`);
      assert.notEqual(result.reason, '', `${fam.name}: reason must be non-empty`);
    });
  }
});

describe('feat-3593: shell-metacharacter argv values are NOT executed', () => {
  for (const fam of FAMILIES) {
    test(`${fam.name}: shell-payload as subcommand argv does NOT execute the payload`, (t) => {
      const projectDir = fam.projectFactory(`cli-neg-univ-shell-${fam.name}-`);
      t.after(() => cleanup(projectDir));
      // Place the payload where the subcommand value goes. The payload
      // would, if shell-interpreted, create a sentinel file in the
      // project dir. Argv-based invocation must treat it as opaque text.
      const sentinelPayload = `$(touch ${projectDir}/INJ-${fam.name})`;
      const argv = [fam.name, sentinelPayload];
      const result = runCli(argv, { cwd: projectDir });
      // No stack trace — opaque text must not crash.
      assert.equal(result.hasStackTrace, false, `${fam.name}: shell payload must not crash`);
      // The sentinel file must NOT exist. We check the project dir's
      // listing rather than fs.existsSync of a single path so the test
      // surfaces any spelling drift.
      const entries = fs.readdirSync(projectDir);
      const sentinels = entries.filter((n) => n.startsWith('INJ-'));
      assert.deepEqual(
        sentinels,
        [],
        `${fam.name}: shell payload was executed — sentinel files exist: ${sentinels.join(', ')}`,
      );
    });
  }
});

// ─── Cross-family invariants on the global --cwd flag ──────────────────────

test('--cwd with an empty value fails the same way regardless of command family', () => {
  for (const fam of FAMILIES) {
    const result = runCli(['--cwd', '', ...fam.bare], { cwd: process.cwd() });
    assert.notEqual(result.status, 0, `${fam.name}: empty --cwd must fail`);
    assert.equal(result.hasStackTrace, false, `${fam.name}: empty --cwd must not crash`);
    assert.equal(result.reason, 'usage', `${fam.name}: empty --cwd reason should be 'usage', got: ${result.reason}`);
  }
});

test('--cwd pointing at a non-existent path fails uniformly across families', () => {
  const nonExistent = path.join(require('os').tmpdir(), 'cli-neg-univ-no-such-' + Date.now() + '-' + Math.random());
  assert.equal(fs.existsSync(nonExistent), false, 'pre-check: temp path must not exist');
  for (const fam of FAMILIES) {
    const result = runCli(['--cwd', nonExistent, ...fam.bare], { cwd: process.cwd() });
    assert.notEqual(result.status, 0, `${fam.name}: invalid --cwd must fail`);
    assert.equal(result.hasStackTrace, false);
    assert.equal(result.reason, 'usage', `${fam.name}: invalid --cwd reason should be 'usage'`);
  }
});
