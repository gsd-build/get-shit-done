'use strict';

/**
 * Tests for gsd-health MILESTONES.md drift detection (#2446).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { cmdValidateHealth } = require('../get-shit-done/bin/lib/verify.cjs');

function makeTempProject(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2446-'));
  fs.mkdirSync(path.join(dir, '.planning', 'milestones'), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
  }
  return dir;
}

test('W018: warns when archived snapshot has no MILESTONES.md entry', () => {
  const dir = makeTempProject({
    '.planning/PROJECT.md': '# P\n\n## What This Is\n\nX\n\n## Core Value\n\nY\n\n## Requirements\n\nZ\n',
    '.planning/ROADMAP.md': '# Roadmap\n',
    '.planning/STATE.md': '# State\n',
    '.planning/config.json': '{}',
    '.planning/milestones/v1.0-ROADMAP.md': '# Milestone v1.0\n',
    // No MILESTONES.md entry for v1.0
  });

  const result = cmdValidateHealth(dir, { repair: false }, false);

  const w018 = result.warnings.find(w => w.code === 'W018');
  assert.ok(w018, 'W018 warning should be emitted');
  assert.ok(w018.message.includes('v1.0'), 'warning should mention v1.0');
  assert.ok(w018.repairable, 'W018 should be marked repairable');
});

test('no W018 when all snapshots have MILESTONES.md entries', () => {
  const dir = makeTempProject({
    '.planning/PROJECT.md': '# P\n\n## What This Is\n\nX\n\n## Core Value\n\nY\n\n## Requirements\n\nZ\n',
    '.planning/ROADMAP.md': '# Roadmap\n',
    '.planning/STATE.md': '# State\n',
    '.planning/config.json': '{}',
    '.planning/milestones/v1.0-ROADMAP.md': '# Milestone v1.0\n',
    '.planning/MILESTONES.md': '# Milestones\n\n## v1.0 My App (Shipped: 2026-01-01)\n\n---\n\n',
  });

  const result = cmdValidateHealth(dir, { repair: false }, false);

  const w018 = result.warnings.find(w => w.code === 'W018');
  assert.strictEqual(w018, undefined, 'no W018 when entries are present');
});

test('no W018 when milestones archive dir is empty', () => {
  const dir = makeTempProject({
    '.planning/PROJECT.md': '# P\n\n## What This Is\n\nX\n\n## Core Value\n\nY\n\n## Requirements\n\nZ\n',
    '.planning/ROADMAP.md': '# Roadmap\n',
    '.planning/STATE.md': '# State\n',
    '.planning/config.json': '{}',
    // No snapshots in milestones/
  });

  const result = cmdValidateHealth(dir, { repair: false }, false);

  const w018 = result.warnings.find(w => w.code === 'W018');
  assert.strictEqual(w018, undefined, 'no W018 with empty archive dir');
});

test('--backfill synthesizes missing MILESTONES.md entry from snapshot', () => {
  const dir = makeTempProject({
    '.planning/PROJECT.md': '# P\n\n## What This Is\n\nX\n\n## Core Value\n\nY\n\n## Requirements\n\nZ\n',
    '.planning/ROADMAP.md': '# Roadmap\n',
    '.planning/STATE.md': '# State\n',
    '.planning/config.json': '{}',
    '.planning/milestones/v1.0-ROADMAP.md': '# Milestone v1.0 First Release\n',
  });

  cmdValidateHealth(dir, { repair: true, backfill: true }, false);

  const milestonesPath = path.join(dir, '.planning', 'MILESTONES.md');
  assert.ok(fs.existsSync(milestonesPath), 'MILESTONES.md should be created');
  const content = fs.readFileSync(milestonesPath, 'utf-8');
  assert.ok(content.includes('## v1.0'), 'backfilled entry should contain v1.0');
  assert.ok(content.includes('Backfilled'), 'should note it was backfilled');
});

test('health.md mentions --backfill flag', () => {
  const healthMd = fs.readFileSync(
    path.join(__dirname, '../get-shit-done/workflows/health.md'), 'utf-8'
  );
  assert.ok(healthMd.includes('--backfill'), 'health.md should document --backfill');
  assert.ok(healthMd.includes('W018'), 'health.md should list W018 error code');
  assert.ok(healthMd.includes('backfillMilestones'), 'repair_actions should include backfillMilestones');
});
