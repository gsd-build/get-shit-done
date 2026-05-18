// allow-test-rule: source-text-is-the-product
// The GitHub Actions YAML is the deployed runtime contract. These tests assert
// on the parsed IR (line-tokenised YAML structure) — not on prose or rendered
// output — to lock the wiring without testing GHA execution semantics.

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW_PATH = path.join(__dirname, '..', '.github', 'workflows', 'install-smoke.yml');

/**
 * Minimal structural extractor for this specific YAML shape.
 * Returns an object with:
 *   { onTriggers: string[], steps: Array<{ name?: string, run?: string }> }
 *
 * Strategy:
 *   1. Collect top-level `on:` keys by scanning lines after `^on:` until the
 *      next top-level key.
 *   2. Collect step `run:` blocks by scanning all `    - name:` / `      run:`
 *      entries.  No full YAML parse needed — we only need substring presence.
 */
function parseWorkflowStructure(src) {
  const lines = src.split('\n');

  // --- Extract on: trigger keys ---
  const onTriggers = [];
  let inOn = false;
  for (const line of lines) {
    if (/^on:/.test(line)) { inOn = true; continue; }
    if (inOn) {
      // A new top-level key ends the `on:` block
      if (/^[a-zA-Z]/.test(line) && !line.startsWith(' ')) { inOn = false; continue; }
      // Direct children of `on:` are trigger names at 2-space indent
      const m = line.match(/^  ([a-zA-Z_][a-zA-Z0-9_]*):/);
      if (m) onTriggers.push(m[1]);
    }
  }

  // --- Extract PR path filters ---
  const prPaths = [];
  let inPrPaths = false;
  let inPullRequest = false;
  for (const line of lines) {
    if (/^  pull_request:/.test(line)) { inPullRequest = true; continue; }
    if (inPullRequest) {
      if (/^    paths:/.test(line)) { inPrPaths = true; continue; }
      if (inPrPaths) {
        const m = line.match(/^      - '(.+)'/);
        if (m) { prPaths.push(m[1]); continue; }
        // End of paths list
        if (/^    [a-zA-Z]/.test(line)) inPrPaths = false;
      }
      // End of pull_request block
      if (/^  [a-zA-Z]/.test(line) && !line.startsWith('    ')) inPullRequest = false;
    }
  }

  // --- Extract all step names + run blocks ---
  const steps = [];
  let currentStep = null;
  let inRun = false;
  let runLines = [];

  for (const line of lines) {
    // Step boundary: 6-space "- name:" or "- uses:"
    if (/^      - name:/.test(line)) {
      if (currentStep && runLines.length) {
        currentStep.run = runLines.join('\n');
      }
      if (currentStep) steps.push(currentStep);
      currentStep = { name: line.replace(/^      - name:\s*/, '').trim() };
      inRun = false;
      runLines = [];
      continue;
    }
    if (/^      - uses:/.test(line)) {
      if (currentStep && runLines.length) {
        currentStep.run = runLines.join('\n');
      }
      if (currentStep) steps.push(currentStep);
      currentStep = { uses: line.replace(/^      - uses:\s*/, '').trim() };
      inRun = false;
      runLines = [];
      continue;
    }
    // uses: field inside a named step (e.g. "- name: Foo\n  uses: actions/...")
    if (currentStep && /^        uses:\s/.test(line)) {
      currentStep.uses = line.replace(/^        uses:\s*/, '').trim();
      continue;
    }
    // run: block inside a step
    if (currentStep && /^        run:\s*\|/.test(line)) {
      inRun = true;
      runLines = [];
      continue;
    }
    if (currentStep && /^        run:\s*(?!\|)/.test(line)) {
      // Inline run (no |)
      currentStep.run = line.replace(/^        run:\s*/, '').trim();
      inRun = false;
      continue;
    }
    if (inRun) {
      // Lines deeper than 8 spaces belong to the run block
      if (/^          /.test(line) || line.trim() === '') {
        runLines.push(line);
      } else {
        inRun = false;
      }
    }
  }
  // Flush final step
  if (currentStep) {
    if (runLines.length) currentStep.run = runLines.join('\n');
    steps.push(currentStep);
  }

  return { onTriggers, prPaths, steps };
}

describe('install-smoke.yml structural wiring', () => {
  const src = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
  const { onTriggers, prPaths, steps } = parseWorkflowStructure(src);

  test('workflow_call trigger is present (release.yml integration preserved)', () => {
    assert.ok(
      onTriggers.includes('workflow_call'),
      `Expected 'workflow_call' in on: triggers. Found: ${JSON.stringify(onTriggers)}`
    );
  });

  test('lifecycle smoke step calls release-tarball-smoke.cjs', () => {
    const smokeStep = steps.find(s => s.run && s.run.includes('release-tarball-smoke.cjs'));
    assert.ok(
      smokeStep,
      'Expected a step whose run block includes "release-tarball-smoke.cjs". ' +
      'Steps found: ' + JSON.stringify(steps.map(s => s.name || s.uses))
    );
  });

  test('lifecycle smoke step invokes script with --json flag', () => {
    const smokeStep = steps.find(s => s.run && s.run.includes('release-tarball-smoke.cjs'));
    assert.ok(smokeStep, 'No lifecycle smoke step found');
    assert.ok(
      smokeStep.run.includes('--json'),
      `Expected --json in lifecycle smoke run block. Got: ${smokeStep.run}`
    );
  });

  test('lifecycle smoke result is checked via jq', () => {
    const smokeStep = steps.find(s => s.run && s.run.includes('release-tarball-smoke.cjs'));
    assert.ok(smokeStep, 'No lifecycle smoke step found');
    assert.ok(
      smokeStep.run.includes('jq'),
      `Expected jq invocation in lifecycle smoke run block. Got: ${smokeStep.run}`
    );
  });

  test('PR path filter includes scripts/release-tarball-smoke.cjs', () => {
    assert.ok(
      prPaths.includes('scripts/release-tarball-smoke.cjs'),
      `Expected 'scripts/release-tarball-smoke.cjs' in PR paths filter. Found: ${JSON.stringify(prPaths)}`
    );
  });

  test('PR path filter includes tests/release-tarball-smoke.install.test.cjs', () => {
    assert.ok(
      prPaths.includes('tests/release-tarball-smoke.install.test.cjs'),
      `Expected 'tests/release-tarball-smoke.install.test.cjs' in PR paths filter. Found: ${JSON.stringify(prPaths)}`
    );
  });

  test('artifact upload step is present for failure debugging', () => {
    const uploadStep = steps.find(
      s => s.uses && s.uses.startsWith('actions/upload-artifact')
    );
    assert.ok(
      uploadStep,
      'Expected an actions/upload-artifact step for lifecycle smoke failure debugging. ' +
      'Steps (name + uses): ' + JSON.stringify(steps.map(s => ({ name: s.name, uses: s.uses })))
    );
  });
});
