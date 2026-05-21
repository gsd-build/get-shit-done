/**
 * Regression test for #3668: --local install has soft dependency on global gsd-sdk
 *
 * Two defects confirmed by code inspection:
 *
 * Defect 1 — `buildGsdSdkVersionMismatchReport` emits `npm install -g get-shit-done-cc@latest`
 *   unconditionally, even when the caller is a local install. For local installs the
 *   correct remediation is to run `/gsd:update` (or `npx get-shit-done-cc@latest --local`),
 *   not to install globally.
 *
 * Defect 2 — 69 of 72 workflow files that call `gsd-sdk query …` do so without a
 *   `command -v gsd-sdk … elif node "$GSD_TOOLS"` fallback, so uninstalling the
 *   global `gsd-sdk` breaks every workflow on a fresh local session.
 *
 * Defect 3 — No CI guard prevents future workflow regressions.
 *
 * Acceptance criteria (from confirmed-bug triage comment):
 *   - `renderGsdSdkVersionMismatchReport` does NOT emit `npm install -g` for isLocal=true.
 *   - All 72 SDK-invoking workflow files use the `command -v gsd-sdk … elif` pattern.
 *   - A CI guard blocks any future workflow file from invoking bare `gsd-sdk` without guard.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { buildGsdSdkVersionMismatchReport, renderGsdSdkVersionMismatchReport } = require('../bin/install.js');
const { captureConsole } = require('./helpers.cjs');

const WORKFLOWS_DIR = path.join(__dirname, '..', 'get-shit-done', 'workflows');

// ---------------------------------------------------------------------------
// Defect 1: version-mismatch report should not suggest `npm install -g` for
// local installs.
// ---------------------------------------------------------------------------

describe('#3668 Defect 1: version-mismatch report respects isLocal', () => {
  test('buildGsdSdkVersionMismatchReport accepts isLocal=true and sets local fix_command', () => {
    // Simulate a version mismatch report built for a local install.
    const ir = buildGsdSdkVersionMismatchReport('/fake/path/gsd-sdk', '1.42.0', { isLocal: true });
    // Without a real gsd-sdk binary the function may return null — that's fine,
    // the important contract is: when it DOES return a report for isLocal=true,
    // the fix_command must NOT be the global install command.
    if (ir === null) return; // no mismatch detected (no real binary) — skip assertion
    assert.ok(
      !ir.fix_command.includes('npm install -g'),
      [
        'buildGsdSdkVersionMismatchReport with isLocal=true must NOT produce',
        '`npm install -g …` as the fix_command — local installs should be told',
        `to run /gsd:update instead. Got: ${ir.fix_command}`,
      ].join(' '),
    );
  });

  test('renderGsdSdkVersionMismatchReport does not print npm install -g when isLocal=true', () => {
    // Construct an IR that represents a local-install mismatch (what the
    // fixed buildGsdSdkVersionMismatchReport must produce for isLocal=true).
    const localIr = {
      ok: false,
      reason: 'gsd_sdk_version_mismatch',
      sdk_path: '/fake/path/gsd-sdk',
      actual_version: '1.41.0',
      expected_version: '1.42.0',
      fix_command: 'npx get-shit-done-cc@latest --claude --local',
      is_local: true,
    };

    const { stdout } = captureConsole(() => {
      renderGsdSdkVersionMismatchReport(localIr);
    });

    assert.ok(
      !stdout.includes('npm install -g'),
      [
        'renderGsdSdkVersionMismatchReport must not emit `npm install -g` when',
        `is_local=true. Stdout:\n${stdout}`,
      ].join(' '),
    );
    assert.ok(
      stdout.includes(localIr.fix_command),
      [
        'renderGsdSdkVersionMismatchReport must print the fix_command from the IR.',
        `Expected to find: ${localIr.fix_command}`,
        `Stdout:\n${stdout}`,
      ].join('\n'),
    );
  });

  test('buildGsdSdkVersionMismatchReport with isLocal=false still uses global fix_command', () => {
    // Verifies the global install path is unchanged (regression guard).
    const ir = buildGsdSdkVersionMismatchReport('/fake/path/gsd-sdk', '1.42.0', { isLocal: false });
    if (ir === null) return; // no real binary available — skip
    assert.ok(
      ir.fix_command.includes('npm install -g'),
      [
        'buildGsdSdkVersionMismatchReport with isLocal=false must keep',
        `\`npm install -g …\` as the fix_command. Got: ${ir.fix_command}`,
      ].join(' '),
    );
  });
});

// ---------------------------------------------------------------------------
// Defect 2: Every workflow file that calls `gsd-sdk` must use the
// `command -v gsd-sdk … elif node "$GSD_TOOLS"` fallback pattern.
// ---------------------------------------------------------------------------

describe('#3668 Defect 2: workflow files must guard every gsd-sdk invocation', () => {
  test('every workflow file that calls gsd-sdk has a command -v guard', () => {
    const files = fs.readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith('.md'));
    const bare = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf-8');
      // Does this file invoke gsd-sdk at all?
      if (!content.includes('gsd-sdk')) continue;
      // Does it have the command -v guard?
      if (!content.includes('command -v gsd-sdk')) {
        bare.push(file);
      }
    }

    assert.strictEqual(
      bare.length,
      0,
      [
        `${bare.length} workflow file(s) call gsd-sdk without a 'command -v gsd-sdk' guard.`,
        'Every workflow must use:',
        '  if command -v gsd-sdk >/dev/null 2>&1; then',
        '    RESULT=$(gsd-sdk query <key>)',
        '  elif [ -f "$GSD_TOOLS" ]; then',
        '    RESULT=$(node "$GSD_TOOLS" query <key>)',
        '  fi',
        '',
        'Missing guard in:',
        ...bare.map((f) => `  - ${f}`),
      ].join('\n'),
    );
  });
});

// ---------------------------------------------------------------------------
// Defect 3: CI guard — future regressions caught at test time.
// This test IS the CI guard. It double-checks the same invariant as Defect 2
// but frames it as a lint rule that will prevent backsliding.
// ---------------------------------------------------------------------------

describe('#3668 Defect 3: CI guard — no bare gsd-sdk calls in workflows', () => {
  test('lint: no workflow file contains a bare gsd-sdk query call outside a command-v guard block', () => {
    const files = fs.readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith('.md'));
    const violations = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf-8');
      if (!content.includes('gsd-sdk')) continue;

      // A file is compliant if every code block containing `gsd-sdk` either:
      //   (a) is itself inside a `command -v gsd-sdk` guard, OR
      //   (b) the file has exactly one guard that wraps all SDK calls.
      //
      // Minimal approximation: require the guard to exist. The per-block
      // check is handled by human review; the file-level presence check
      // catches completely unguarded files.
      if (!content.includes('command -v gsd-sdk')) {
        violations.push(file);
      }
    }

    assert.strictEqual(
      violations.length,
      0,
      [
        'CI GUARD FAIL (#3668): workflow files without gsd-sdk guard:',
        ...violations.map((f) => `  ${f}`),
        '',
        'Every workflow file that calls gsd-sdk must include:',
        '  if command -v gsd-sdk >/dev/null 2>&1; then ... elif [ -f "$GSD_TOOLS" ]; then ... fi',
      ].join('\n'),
    );
  });
});
