/**
 * Regression test for bug #2506
 *
 * /gsd-settings presents Quality/Balanced/Budget model profiles without any
 * warning that on non-Claude runtimes (Codex, Gemini CLI, etc.) these profiles
 * select Claude model tiers and have no effect on actual agent model selection.
 *
 * Fix: settings.md must include a non-Claude runtime note instructing users to
 * use "Inherit" or configure model_overrides manually, and the Inherit option
 * description must explicitly call out non-Claude runtimes.
 *
 * Closes: #2506
 */

'use strict';

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'settings.md');

describe('bug #2506: settings.md non-Claude runtime warning for model profiles', () => {
  let content;

  before(() => {
    content = fs.readFileSync(SETTINGS_PATH, 'utf-8');
  });

  test('settings.md contains a non-Claude runtime note for model profiles', () => {
    assert.ok(
      content.includes('non-Claude runtime') || content.includes('non-Claude runtimes'),
      'settings.md must include a note about non-Claude runtimes and model profiles'
    );
  });

  test('non-Claude note explains profiles are no-ops without model_overrides', () => {
    assert.ok(
      content.includes('model_overrides') || content.includes('no effect'),
      'note must explain profiles have no effect on non-Claude runtimes without model_overrides'
    );
  });

  test('Inherit option description explicitly mentions non-Claude runtimes', () => {
    // The Inherit option in AskUserQuestion must call out non-Claude runtimes
    const inheritOptionMatch = content.match(/label:\s*"Inherit"[^}]*description:\s*"([^"]+)"/s);
    assert.ok(inheritOptionMatch, 'Inherit option with label/description must exist in settings.md');
    const desc = inheritOptionMatch[1];
    assert.ok(
      desc.includes('non-Claude') || desc.includes('Codex') || desc.includes('Gemini'),
      `Inherit option description must mention non-Claude runtimes; got: "${desc}"`
    );
  });
});
