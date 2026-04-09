'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REFERENCES_DIR = path.join(ROOT, 'get-shit-done', 'references');
const WORKFLOWS_DIR = path.join(ROOT, 'get-shit-done', 'workflows');

describe('methodology artifact type (#1488)', () => {
  // -------------------------------------------------------------------------
  // artifact-types.md existence and structure
  // -------------------------------------------------------------------------
  let artifactTypesContent;

  test('artifact-types.md exists in get-shit-done/references/', () => {
    const p = path.join(REFERENCES_DIR, 'artifact-types.md');
    assert.ok(fs.existsSync(p), 'get-shit-done/references/artifact-types.md must exist');
    artifactTypesContent = fs.readFileSync(p, 'utf-8');
  });

  test('artifact-types.md documents the methodology artifact type', () => {
    artifactTypesContent = artifactTypesContent || fs.readFileSync(
      path.join(REFERENCES_DIR, 'artifact-types.md'), 'utf-8'
    );
    assert.ok(
      artifactTypesContent.includes('methodology') || artifactTypesContent.includes('Methodology'),
      'artifact-types.md must document the methodology artifact type'
    );
  });

  test('methodology artifact has shape documented (standing reference)', () => {
    artifactTypesContent = artifactTypesContent || fs.readFileSync(
      path.join(REFERENCES_DIR, 'artifact-types.md'), 'utf-8'
    );
    assert.ok(
      artifactTypesContent.includes('Standing reference') ||
      artifactTypesContent.includes('standing reference') ||
      artifactTypesContent.includes('reusable interpretive') ||
      artifactTypesContent.includes('interpretive framework'),
      'methodology artifact must have shape documented as standing reference / interpretive framework'
    );
  });

  test('methodology artifact has lifecycle documented (Created → Active → Superseded)', () => {
    artifactTypesContent = artifactTypesContent || fs.readFileSync(
      path.join(REFERENCES_DIR, 'artifact-types.md'), 'utf-8'
    );
    assert.ok(
      artifactTypesContent.includes('Superseded') || artifactTypesContent.includes('superseded'),
      'methodology artifact lifecycle must include Superseded state'
    );
    assert.ok(
      artifactTypesContent.includes('Active') || artifactTypesContent.includes('active'),
      'methodology artifact lifecycle must include Active state'
    );
  });

  test('methodology artifact has location documented (.planning/METHODOLOGY.md)', () => {
    artifactTypesContent = artifactTypesContent || fs.readFileSync(
      path.join(REFERENCES_DIR, 'artifact-types.md'), 'utf-8'
    );
    assert.ok(
      artifactTypesContent.includes('METHODOLOGY.md'),
      'artifact-types.md must document .planning/METHODOLOGY.md as the location'
    );
  });

  test('methodology artifact documents what it is consumed by', () => {
    artifactTypesContent = artifactTypesContent || fs.readFileSync(
      path.join(REFERENCES_DIR, 'artifact-types.md'), 'utf-8'
    );
    assert.ok(
      artifactTypesContent.toLowerCase().includes('consumed by') ||
      artifactTypesContent.toLowerCase().includes('consumption'),
      'methodology artifact must document its consumption mechanism'
    );
  });

  // -------------------------------------------------------------------------
  // Consumption in discuss-phase-assumptions.md
  // -------------------------------------------------------------------------
  let discussContent;

  test('discuss-phase-assumptions.md exists', () => {
    const p = path.join(WORKFLOWS_DIR, 'discuss-phase-assumptions.md');
    assert.ok(fs.existsSync(p), 'discuss-phase-assumptions.md must exist');
    discussContent = fs.readFileSync(p, 'utf-8');
  });

  test('discuss-phase-assumptions.md references METHODOLOGY.md as consumable artifact', () => {
    discussContent = discussContent || fs.readFileSync(
      path.join(WORKFLOWS_DIR, 'discuss-phase-assumptions.md'), 'utf-8'
    );
    assert.ok(
      discussContent.includes('METHODOLOGY.md'),
      'discuss-phase-assumptions.md must reference METHODOLOGY.md as a consumable artifact'
    );
  });

  test('discuss-phase-assumptions.md reads METHODOLOGY.md when it exists', () => {
    discussContent = discussContent || fs.readFileSync(
      path.join(WORKFLOWS_DIR, 'discuss-phase-assumptions.md'), 'utf-8'
    );
    assert.ok(
      discussContent.includes('METHODOLOGY.md') &&
      (discussContent.includes('if it exists') ||
       discussContent.includes('2>/dev/null') ||
       discussContent.includes('cat .planning/METHODOLOGY') ||
       discussContent.includes('exists') ||
       discussContent.includes('lenses')),
      'discuss-phase-assumptions.md must conditionally read METHODOLOGY.md and apply lenses'
    );
  });

  // -------------------------------------------------------------------------
  // Consumption in pause-work.md Required Reading section
  // -------------------------------------------------------------------------
  let pauseContent;

  test('pause-work.md exists', () => {
    const p = path.join(WORKFLOWS_DIR, 'pause-work.md');
    assert.ok(fs.existsSync(p), 'pause-work.md must exist');
    pauseContent = fs.readFileSync(p, 'utf-8');
  });

  test('pause-work.md Required Reading template includes METHODOLOGY.md', () => {
    pauseContent = pauseContent || fs.readFileSync(
      path.join(WORKFLOWS_DIR, 'pause-work.md'), 'utf-8'
    );
    assert.ok(
      pauseContent.includes('METHODOLOGY.md'),
      'pause-work.md Required Reading template must include METHODOLOGY.md so new sessions inherit the methodology'
    );
  });
});
