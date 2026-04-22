/**
 * GSD Tools Tests - Seed Scan in New Milestone (#2169)
 *
 * Structural tests verifying that new-milestone.md includes seed scanning
 * instructions (step 2.5) and that plant-seed.md still promises auto-surfacing.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const NEW_MILESTONE_PATH = path.join(ROOT, 'get-shit-done', 'workflows', 'new-milestone.md');
const PLANT_SEED_PATH = path.join(ROOT, 'get-shit-done', 'workflows', 'plant-seed.md');

const newMilestone = fs.readFileSync(NEW_MILESTONE_PATH, 'utf-8');
const plantSeed = fs.readFileSync(PLANT_SEED_PATH, 'utf-8');

describe('seed scanning in new-milestone workflow (#2169)', () => {
  test('new-milestone.md mentions seed scanning', () => {
    assert.ok(
      newMilestone.includes('.planning/seeds/'),
      'new-milestone.md should contain instructions about scanning .planning/seeds/'
    );
    assert.ok(
      newMilestone.includes('SEED-*.md'),
      'new-milestone.md should reference the SEED-*.md file pattern'
    );
  });

  test('new-milestone.md handles no-seeds case', () => {
    assert.ok(
      /no seed files exist.*skip/i.test(newMilestone),
      'new-milestone.md should mention skipping when no seed files exist'
    );
  });

  test('new-milestone.md handles auto-mode for seeds', () => {
    assert.ok(
      newMilestone.includes('--auto'),
      'new-milestone.md should mention --auto mode in the seed scanning step'
    );
    assert.ok(
      /auto.*select.*all.*matching.*seed/i.test(newMilestone),
      'new-milestone.md should instruct auto-selecting all matching seeds in --auto mode'
    );
  });

  test('plant-seed.md still promises auto-surfacing during new-milestone', () => {
    assert.ok(
      plantSeed.includes('new-milestone'),
      'plant-seed.md should reference new-milestone as the surfacing mechanism for seeds'
    );
    assert.ok(
      /auto.surface/i.test(plantSeed) || /auto-surface/i.test(plantSeed) || /auto.present/i.test(plantSeed) || /auto-present/i.test(plantSeed),
      'plant-seed.md should describe seeds as auto-surfacing or auto-presenting'
    );
  });
});
