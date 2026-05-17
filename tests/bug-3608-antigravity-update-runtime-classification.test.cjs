// allow-test-rule: source-text-is-the-product
// update.md is loaded verbatim by the runtime as the /gsd-update workflow.
// The bash blocks inside it ARE the deployed program — the agent runs them.
// Asserting on the structural shape of those bash arrays is asserting on the
// deployed contract, identical to asserting on a workflow's instructions.

/**
 * Bug #3608: get-shit-done/workflows/update.md does not model Antigravity as
 * a first-class runtime, so /gsd-update invoked from an Antigravity install
 * (~/.gemini/antigravity) classifies the runtime as base Gemini.
 *
 * The installer (bin/install.js) and SDK already treat Antigravity as a
 * distinct runtime with its own config dir (~/.gemini/antigravity), env var
 * (ANTIGRAVITY_CONFIG_DIR), and CLI flag (--antigravity). update.md must
 * agree, or /gsd-update routes Antigravity installs through the base Gemini
 * path.
 *
 * Order matters: every bash array / env-var ladder / scan list that contains
 * a Gemini entry MUST list the more-specific Antigravity entry first.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const UPDATE_MD = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'update.md');

function readUpdateMd() {
  return fs.readFileSync(UPDATE_MD, 'utf-8');
}

// Parse a single bash array literal from a line like:
//   RUNTIME_DIRS=( "claude:.claude" "gemini:.gemini" ... )
// Returns the entries as an ordered list of "runtime:dir" strings.
function parseBashArray(content, varName) {
  const re = new RegExp(`${varName}=\\(\\s*([^)]*?)\\s*\\)`, 'm');
  const m = content.match(re);
  if (!m) return null;
  return [...m[1].matchAll(/"([^"]+)"/g)].map((mm) => mm[1]);
}

// Extract the runtime tokens (the part before ':') in declaration order.
function runtimeTokens(entries) {
  return entries.map((e) => e.split(':')[0]);
}

function firstIndex(arr, token) {
  return arr.indexOf(token);
}

describe('bug #3608: update.md models Antigravity as a first-class runtime', () => {
  const content = readUpdateMd();

  test('RUNTIME_DIRS contains antigravity before gemini', () => {
    const entries = parseBashArray(content, 'RUNTIME_DIRS');
    assert.ok(entries, 'RUNTIME_DIRS array literal not found in update.md');

    const tokens = runtimeTokens(entries);
    const antIdx = firstIndex(tokens, 'antigravity');
    const gemIdx = firstIndex(tokens, 'gemini');

    assert.notStrictEqual(antIdx, -1, 'RUNTIME_DIRS missing antigravity entry');
    assert.notStrictEqual(gemIdx, -1, 'RUNTIME_DIRS missing gemini entry');
    assert.ok(
      antIdx < gemIdx,
      `antigravity must precede gemini in RUNTIME_DIRS (got antigravity@${antIdx}, gemini@${gemIdx}). ` +
        `Order matters: classification iterates this list and the first match wins.`,
    );
  });

  test('RUNTIME_DIRS antigravity entry points at .gemini/antigravity', () => {
    const entries = parseBashArray(content, 'RUNTIME_DIRS');
    assert.ok(entries);

    const ant = entries.find((e) => e.startsWith('antigravity:'));
    assert.ok(ant, 'antigravity entry missing');
    assert.strictEqual(
      ant,
      'antigravity:.gemini/antigravity',
      `antigravity entry must be exactly "antigravity:.gemini/antigravity" to match the installer ` +
        `(bin/install.js line ~404: ~/.gemini/antigravity)`,
    );
  });

  test('PREFERRED_RUNTIME env-var inference recognizes ANTIGRAVITY_CONFIG_DIR before GEMINI_CONFIG_DIR', () => {
    // Extract the inference block — the if/elif ladder that maps env vars to runtime.
    // Match from the comment marker through the closing `fi` of the inference block.
    const blockMatch = content.match(
      /If runtime is still unknown, infer from runtime env vars[\s\S]*?\r?\nfi\r?\n/,
    );
    assert.ok(blockMatch, 'env-var inference block not found');

    const block = blockMatch[0];
    const antPos = block.indexOf('ANTIGRAVITY_CONFIG_DIR');
    const gemPos = block.indexOf('GEMINI_CONFIG_DIR');

    assert.notStrictEqual(
      antPos,
      -1,
      'env-var inference must check ANTIGRAVITY_CONFIG_DIR (used by bin/install.js)',
    );
    assert.notStrictEqual(gemPos, -1, 'env-var inference must check GEMINI_CONFIG_DIR');
    assert.ok(
      antPos < gemPos,
      `ANTIGRAVITY_CONFIG_DIR must be checked before GEMINI_CONFIG_DIR ` +
        `(got antigravity@${antPos}, gemini@${gemPos}) — otherwise an Antigravity ` +
        `install with both env vars set falls through to gemini.`,
    );
  });

  test('ENV_RUNTIME_DIRS appends an antigravity entry when ANTIGRAVITY_CONFIG_DIR is set', () => {
    // Match the `if [ -n "$ANTIGRAVITY_CONFIG_DIR" ]; then` block and require an
    // `ENV_RUNTIME_DIRS+=( "antigravity:..." )` push inside it. The pushed value
    // may contain nested `"$VAR"` quotes (bash command substitution), so we
    // don't try to match the full string literal — just the leading runtime
    // tag `"antigravity:`.
    const re = /if \[ -n "\$ANTIGRAVITY_CONFIG_DIR" \];\s*then\s+ENV_RUNTIME_DIRS\+=\(\s*"antigravity:/;
    assert.match(
      content,
      re,
      'expected `if [ -n "$ANTIGRAVITY_CONFIG_DIR" ]; then ENV_RUNTIME_DIRS+=( "antigravity:..." )`',
    );
  });

  test('local-scope scan dir list includes .gemini/antigravity before .gemini', () => {
    // Lines like:  for dir in .claude .config/opencode .opencode .gemini ...
    // The first iteration of the local scan ranges over a hardcoded list.
    const forLoops = [...content.matchAll(/for dir in ([^;]+); do/g)];
    assert.ok(forLoops.length > 0, 'no `for dir in ...; do` scan loops found');

    for (const m of forLoops) {
      const tokens = m[1].trim().split(/\s+/);
      const antIdx = tokens.indexOf('.gemini/antigravity');
      const gemIdx = tokens.indexOf('.gemini');
      if (gemIdx === -1) continue; // scan loop without .gemini — irrelevant
      assert.notStrictEqual(
        antIdx,
        -1,
        `scan loop "for dir in ${m[1].trim()}" mentions .gemini but not .gemini/antigravity — ` +
          `the more-specific Antigravity dir must be present`,
      );
      assert.ok(
        antIdx < gemIdx,
        `scan loop "for dir in ${m[1].trim()}": .gemini/antigravity (idx ${antIdx}) must precede .gemini (idx ${gemIdx})`,
      );
    }
  });

  test('path-to-runtime classification documents /.gemini/antigravity/ before /.gemini/', () => {
    // The markdown bullet list near the top of get_installed_version step.
    // We assert the antigravity bullet exists and appears before the gemini bullet
    // in the file (textual order = evaluation order in the prose contract).
    const antBullet = content.search(/Path contains `\/\.gemini\/antigravity\/?` -> `antigravity`/);
    const gemBullet = content.search(/Path contains `\/\.gemini\/` -> `gemini`/);

    assert.notStrictEqual(
      antBullet,
      -1,
      'classification bullet for /.gemini/antigravity/ -> antigravity is missing',
    );
    assert.notStrictEqual(gemBullet, -1, 'classification bullet for /.gemini/ -> gemini is missing');
    assert.ok(
      antBullet < gemBullet,
      'antigravity bullet must precede gemini bullet in path-classification list',
    );
  });
});
