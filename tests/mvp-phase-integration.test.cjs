/**
 * mvp-phase ROADMAP mutation — integration smoke test
 * Simulates the workflow's step 5 (Update ROADMAP.md) and verifies that
 * roadmap.get-phase returns the expected mode and user-story goal afterward.
 */
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const ROADMAP_BEFORE = `# Roadmap

## v1.0.0

### Phase 1: User Auth
**Goal:** Users can register and log in
**Success Criteria**:
1. Registration works
2. Login works
`;

const ROADMAP_AFTER_MVP = `# Roadmap

## v1.0.0

### Phase 1: User Auth
**Goal:** As a new user, I want to register and log in, so that I can access my dashboard.
**Mode:** mvp
**Success Criteria**:
1. Registration works
2. Login works
`;

describe('mvp-phase — ROADMAP mutation result', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('after spec mutation, roadmap.get-phase reports mode=mvp', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_AFTER_MVP);
    const result = runGsdTools('roadmap get-phase 1 --pick mode', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(result.output.trim(), 'mvp');
  });

  test('after spec mutation, roadmap.get-phase reports the full user story as goal', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_AFTER_MVP);
    const result = runGsdTools('roadmap get-phase 1 --pick goal', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(
      result.output.trim(),
      'As a new user, I want to register and log in, so that I can access my dashboard.'
    );
  });

  test('before mutation, mode is null and goal is the original short text', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_BEFORE);
    const modeResult = runGsdTools('roadmap get-phase 1 --pick mode', tmpDir);
    const goalResult = runGsdTools('roadmap get-phase 1 --pick goal', tmpDir);
    assert.ok(modeResult.success && goalResult.success);
    // mode field absent → empty/null per Phase 1 parser contract
    assert.ok(modeResult.output.trim() === '' || modeResult.output.trim() === 'null');
    assert.strictEqual(goalResult.output.trim(), 'Users can register and log in');
  });

  test('user story longer than 120 chars (SPIDR trigger boundary)', () => {
    // This story is >120 chars — the workflow should have split it via SPIDR
    // before writing. This test confirms the parser still handles it correctly
    // if the user chose "Reject split" and proceeded with the long story.
    const longStory = 'As a registered customer with an active account and verified email, I want to reset my password and update my profile, so that I can recover access.';
    const variant = ROADMAP_AFTER_MVP.replace(
      'As a new user, I want to register and log in, so that I can access my dashboard.',
      longStory
    );
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), variant);
    const result = runGsdTools('roadmap get-phase 1 --pick goal', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(result.output.trim(), longStory);
  });
});
