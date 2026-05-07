/**
 * Roadmap parser — `**Mode:**` field extraction
 * Covers PRD: vertical-mvp-slice Phase 1 (Q1: all-or-nothing per phase).
 */
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const ROADMAP_WITH_MODE = `# Roadmap

## v1.0.0

### Phase 1: User Auth MVP
**Goal:** A user can register and log in
**Mode:** mvp
**Success Criteria**:
1. Registration works
2. Login works

### Phase 2: Bulk Import
**Goal:** Admin can upload CSV
**Success Criteria**:
1. CSV parses
`;

describe('roadmap parser — mode field', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('roadmap.get-phase returns mode="mvp" when **Mode:** mvp present', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_WITH_MODE);
    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.found, true);
    assert.strictEqual(out.mode, 'mvp');
  });

  test('roadmap.get-phase returns mode=null when **Mode:** absent', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_WITH_MODE);
    const result = runGsdTools('roadmap get-phase 2', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.found, true);
    assert.strictEqual(out.mode, null);
  });

  test('roadmap.analyze surfaces mode per phase', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_WITH_MODE);
    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const out = JSON.parse(result.output);
    const p1 = out.phases.find(p => p.number === '1');
    const p2 = out.phases.find(p => p.number === '2');
    assert.strictEqual(p1.mode, 'mvp');
    assert.strictEqual(p2.mode, null);
  });

  test('mode field is case-insensitive and trimmed', () => {
    const variant = ROADMAP_WITH_MODE.replace('**Mode:** mvp', '**mode**:  MVP  ');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), variant);
    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.mode, 'mvp');
  });

  test('unrecognized mode value is preserved verbatim (forward-compat)', () => {
    const variant = ROADMAP_WITH_MODE.replace('**Mode:** mvp', '**Mode:** experimental');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), variant);
    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.mode, 'experimental');
  });
});
