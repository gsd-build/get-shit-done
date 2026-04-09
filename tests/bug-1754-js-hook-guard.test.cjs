/**
 * Regression tests for bug #1754
 *
 * The installer must NOT register .js hook entries in settings.json when the
 * corresponding .js file does not exist at the target path. The original bug:
 * on fresh installs where hooks/dist/ was missing from the npm package (as in
 * v1.32.0), the hook copy step produced no files, yet the registration step
 * ran unconditionally for .js hooks — leaving users with "PreToolUse:Bash
 * hook error" on every tool invocation.
 *
 * The .sh hooks already had fs.existsSync() guards (added in #1817). This
 * test verifies the same defensive pattern exists for all .js hooks.
 */

'use strict';

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const INSTALL_SRC = path.join(__dirname, '..', 'bin', 'install.js');

const JS_HOOKS = [
  { name: 'gsd-check-update.js',      registrationAnchor: 'hasGsdUpdateHook' },
  { name: 'gsd-context-monitor.js',   registrationAnchor: 'hasContextMonitorHook' },
  { name: 'gsd-prompt-guard.js',      registrationAnchor: 'hasPromptGuardHook' },
  { name: 'gsd-read-guard.js',        registrationAnchor: 'hasReadGuardHook' },
  { name: 'gsd-workflow-guard.js',    registrationAnchor: 'hasWorkflowGuardHook' },
];

describe('bug #1754: .js hook registration guards', () => {
  let src;

  before(() => {
    src = fs.readFileSync(INSTALL_SRC, 'utf-8');
  });

  for (const { name, registrationAnchor } of JS_HOOKS) {
    describe(`${name} registration`, () => {
      test(`install.js checks file existence before registering ${name}`, () => {
        // Find the registration block by locating the "has...Hook" variable
        const anchorIdx = src.indexOf(registrationAnchor);
        assert.ok(
          anchorIdx !== -1,
          `${registrationAnchor} variable not found in install.js`
        );

        // Extract a window around the registration block to find the guard
        const blockStart = anchorIdx;
        const blockEnd = Math.min(src.length, anchorIdx + 1200);
        const block = src.slice(blockStart, blockEnd);

        // The block must contain an fs.existsSync check for the hook file
        assert.ok(
          block.includes('fs.existsSync') || block.includes('existsSync'),
          `install.js must call fs.existsSync on the target path before registering ${name} ` +
          `in settings.json. Without this guard, hooks are registered even when the .js file ` +
          `was never copied (the root cause of #1754).`
        );
      });

      test(`install.js emits a warning when ${name} is missing`, () => {
        // The hook file name (without extension) should appear in a warning message
        const hookBaseName = name.replace('.js', '');
        const warnPattern = `Skipped`;
        const anchorIdx = src.indexOf(registrationAnchor);
        const block = src.slice(anchorIdx, Math.min(src.length, anchorIdx + 1200));

        assert.ok(
          block.includes(warnPattern) && block.includes(hookBaseName),
          `install.js must emit a skip warning when ${name} is not found at the target path`
        );
      });
    });
  }

  test('all .js hooks use the same guard pattern as .sh hooks', () => {
    // Count existsSync calls in the hook registration section.
    // There should be guards for all JS hooks plus the existing SH hooks.
    // This test ensures new hooks added in the future follow the same pattern.
    const registrationSection = src.slice(
      src.indexOf('// Configure SessionStart hook'),
      src.indexOf('return { settingsPath, settings, statuslineCommand')
    );

    // Count unique hook file existence checks (pattern: path.join(targetDir, 'hooks', 'gsd-*.js'))
    const jsGuards = (registrationSection.match(/gsd-[\w-]+\.js.*not found at target/g) || []);
    const shGuards = (registrationSection.match(/gsd-[\w-]+\.sh.*not found at target/g) || []);

    assert.ok(
      jsGuards.length >= JS_HOOKS.length,
      `Expected at least ${JS_HOOKS.length} .js hook guards, found ${jsGuards.length}. ` +
      `Every .js hook registration must check file existence before registering.`
    );

    assert.ok(
      shGuards.length >= 3,
      `Expected at least 3 .sh hook guards (validate-commit, session-state, phase-boundary), ` +
      `found ${shGuards.length}.`
    );
  });
});
