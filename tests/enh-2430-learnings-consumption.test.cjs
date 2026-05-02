'use strict';

// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * Tests for #2430 — LEARNINGS.md consumption loop.
 *
 * Part A: plan-phase.md cross-phase context load includes LEARNINGS.md
 * Part B: transition.md graduation_scan step + graduation.md helper
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOWS_DIR = path.join(__dirname, '../get-shit-done/workflows');

function readWorkflow(name) {
  return fs.readFileSync(path.join(WORKFLOWS_DIR, name), 'utf-8');
}

describe('enh-2430 Part A — plan-phase LEARNINGS.md context load', () => {
  let content;

  test('plan-phase.md includes LEARNINGS.md in cross-phase context load', () => {
    content = readWorkflow('plan-phase.md');
    assert.ok(
      content.includes('LEARNINGS.md files from the 3 most recent completed phases'),
      'plan-phase.md must mention LEARNINGS.md in cross-phase context block'
    );
  });

  test('plan-phase.md LEARNINGS load is inside the 1M context-window gate', () => {
    content = content || readWorkflow('plan-phase.md');
    const windowBlock = content.match(/\$\{CONTEXT_WINDOW >= 500000[\s\S]*?\` : ''\}/);
    assert.ok(windowBlock, 'CONTEXT_WINDOW gate block must exist');
    assert.ok(
      windowBlock[0].includes('LEARNINGS.md'),
      'LEARNINGS.md load must be inside the CONTEXT_WINDOW >= 500000 gate'
    );
  });

  test('plan-phase.md source attribution mentioned for LEARNINGS load', () => {
    content = content || readWorkflow('plan-phase.md');
    assert.ok(
      content.includes('[from Phase N LEARNINGS]') || content.includes('source attribution'),
      'plan-phase.md must document source attribution for loaded LEARNINGS.md content'
    );
  });

  test('plan-phase.md handles missing LEARNINGS.md gracefully (silent skip)', () => {
    content = content || readWorkflow('plan-phase.md');
    assert.ok(
      content.includes('skip silently if a phase has no LEARNINGS.md') ||
      content.includes('skip silently'),
      'plan-phase.md must document silent skip when LEARNINGS.md is absent'
    );
  });

  test('plan-phase.md LEARNINGS load includes Depends-on chain', () => {
    content = content || readWorkflow('plan-phase.md');
    const dependsSection = content.match(/Depends on.*?(\n.*?)+/);
    assert.ok(
      content.includes('LEARNINGS.md from any phases listed in'),
      'plan-phase.md must load LEARNINGS.md for Depends on chain phases'
    );
  });

  test('plan-phase.md specifies context budget limit for LEARNINGS', () => {
    content = content || readWorkflow('plan-phase.md');
    assert.ok(
      content.includes('15%') || content.includes('drop oldest'),
      'plan-phase.md must specify budget limit and truncation strategy for LEARNINGS'
    );
  });
});

describe('enh-2430 Part B — graduation_scan in transition.md', () => {
  let content;

  test('transition.md contains graduation_scan step', () => {
    content = readWorkflow('transition.md');
    assert.ok(
      content.includes('graduation_scan'),
      'transition.md must contain graduation_scan step'
    );
  });

  test('graduation_scan is placed after evolve_project step', () => {
    content = content || readWorkflow('transition.md');
    const evolvePos = content.indexOf('name="evolve_project"');
    const graduationPos = content.indexOf('name="graduation_scan"');
    assert.ok(evolvePos >= 0, 'evolve_project step must exist');
    assert.ok(graduationPos >= 0, 'graduation_scan step must exist');
    assert.ok(
      graduationPos > evolvePos,
      'graduation_scan must appear after evolve_project in transition.md'
    );
  });

  test('graduation_scan is non-blocking (transition continues regardless)', () => {
    content = content || readWorkflow('transition.md');
    const scanBlock = content.match(/name="graduation_scan"[\s\S]*?<\/step>/);
    assert.ok(scanBlock, 'graduation_scan step must be parseable');
    assert.ok(
      scanBlock[0].includes('non-blocking') || scanBlock[0].includes('always non-blocking'),
      'graduation_scan must be documented as non-blocking'
    );
  });

  test('graduation_scan delegates to graduation.md helper', () => {
    content = content || readWorkflow('transition.md');
    assert.ok(
      content.includes('graduation.md'),
      'graduation_scan must reference graduation.md helper workflow'
    );
  });
});

describe('enh-2430 Part B — graduation.md helper workflow', () => {
  let content;

  test('graduation.md exists', () => {
    content = readWorkflow('graduation.md');
    assert.ok(content.length > 0, 'graduation.md must exist and be non-empty');
  });

  test('graduation.md documents features.graduation config flag', () => {
    content = content || readWorkflow('graduation.md');
    assert.ok(
      content.includes('features.graduation'),
      'graduation.md must document features.graduation config flag'
    );
  });

  test('graduation.md documents graduation_window config', () => {
    content = content || readWorkflow('graduation.md');
    assert.ok(
      content.includes('graduation_window'),
      'graduation.md must document features.graduation_window config'
    );
  });

  test('graduation.md documents graduation_threshold config', () => {
    content = content || readWorkflow('graduation.md');
    assert.ok(
      content.includes('graduation_threshold'),
      'graduation.md must document features.graduation_threshold config'
    );
  });

  test('graduation.md specifies HITL: Promote / Defer / Dismiss', () => {
    content = content || readWorkflow('graduation.md');
    assert.ok(content.includes('Promote'), 'graduation.md must document Promote action');
    assert.ok(content.includes('Defer'), 'graduation.md must document Defer action');
    assert.ok(content.includes('Dismiss'), 'graduation.md must document Dismiss action');
  });

  test('graduation.md specifies category→target routing', () => {
    content = content || readWorkflow('graduation.md');
    assert.ok(
      content.includes('PROJECT.md') && content.includes('PATTERNS.md'),
      'graduation.md must route categories to appropriate target files'
    );
  });

  test('graduation.md specifies graduation_backlog in STATE.md', () => {
    content = content || readWorkflow('graduation.md');
    assert.ok(
      content.includes('graduation_backlog'),
      'graduation.md must document STATE.md graduation_backlog for Defer/Dismiss'
    );
  });

  test('graduation.md skips items with graduated: annotation', () => {
    content = content || readWorkflow('graduation.md');
    assert.ok(
      content.includes('graduated:') || content.includes('Graduated:'),
      'graduation.md must skip already-graduated items'
    );
  });

  test('graduation.md has silent no-op for first phase / insufficient data', () => {
    content = content || readWorkflow('graduation.md');
    assert.ok(
      content.includes('no-op') || content.includes('silent'),
      'graduation.md must silently no-op when there is insufficient data'
    );
  });

  test('graduation.md specifies Defer-all shorthand (A key)', () => {
    content = content || readWorkflow('graduation.md');
    assert.ok(
      content.includes('Defer all') || content.includes('[Defer all]'),
      'graduation.md must document the Defer all shorthand for first-run batches'
    );
  });
});

describe('enh-2430 — extract_learnings.md graduated: field', () => {
  test('extract_learnings.md documents optional graduated: annotation', () => {
    const content = readWorkflow('extract_learnings.md');
    assert.ok(
      content.includes('graduated:') || content.includes('Graduated:'),
      'extract_learnings.md must document optional graduated: field'
    );
  });

  test('extract_learnings.md clarifies graduated: is written only by graduation workflow', () => {
    const content = readWorkflow('extract_learnings.md');
    assert.ok(
      content.includes('graduation workflow') || content.includes('graduation.md'),
      'extract_learnings.md must clarify that graduated: is written only by graduation.md'
    );
  });
});

describe('enh-2430 — INVENTORY sync', () => {
  test('INVENTORY.md lists graduation.md', () => {
    const inventory = fs.readFileSync(
      path.join(__dirname, '../docs/INVENTORY.md'), 'utf-8'
    );
    assert.ok(inventory.includes('graduation.md'), 'INVENTORY.md must list graduation.md');
  });

  test('INVENTORY-MANIFEST.json includes graduation.md', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../docs/INVENTORY-MANIFEST.json'), 'utf-8')
    );
    assert.ok(
      manifest.families.workflows.includes('graduation.md'),
      'INVENTORY-MANIFEST.json must include graduation.md in workflows array'
    );
  });
});
