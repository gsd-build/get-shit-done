/**
 * Regression tests for bug #2676:
 *   `gsd-sdk query phase.complete <N>` returns is_last_phase: true
 *   when the completed phase belongs to a milestone that is not the
 *   primary milestone recorded in STATE.md's `milestone:` field.
 *
 * Root cause: Step E of phaseComplete applies getMilestonePhaseFilter
 * unconditionally. getMilestonePhaseFilter extracts phases from the
 * milestone slice selected by STATE.md's `milestone:` field. When
 * completing phase 41.2 (which belongs to vB) but STATE.md points at
 * vA, all 41.x directories are excluded from the candidate set and
 * the empty set causes isLastPhase = true.
 *
 * Fix: before applying the filter, check if the completed phase itself
 * passes it. If not (parallel-milestone case), skip the filter entirely
 * so all filesystem phases are visible for next-phase detection.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup } = require('./helpers.cjs');

const SDK_CLI = path.join(__dirname, '..', 'sdk', 'dist', 'cli.js');
const { execFileSync } = require('child_process');

function runSdkQuery(args, cwd) {
  try {
    const result = execFileSync(process.execPath, [SDK_CLI, 'query', ...args], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(result.trim());
    return { success: true, data: parsed };
  } catch (err) {
    const stderr = err.stderr?.toString().trim() || '';
    const stdout = err.stdout?.toString().trim() || '';
    try {
      const parsed = JSON.parse(stdout);
      return { success: true, data: parsed };
    } catch {
      /* not JSON */
    }
    return { success: false, error: stderr || err.message };
  }
}

// ROADMAP.md with two active milestones: v1.0 (phases 10, 11) and v2.0 (phases 41.1, 41.2, 41.3).
// Using numeric version IDs so extractCurrentMilestone can correctly detect milestone boundaries.
const PARALLEL_ROADMAP = `# Roadmap

## v1.0 Milestone (Primary)

### Phase 10: Foo
**Goal:** Foo work

### Phase 11: Bar
**Goal:** Bar work

## v2.0 Milestone (Parallel)

### Phase 41.1: Baz
**Goal:** Baz work

### Phase 41.2: Qux
**Goal:** Qux work

### Phase 41.3: Quux
**Goal:** Quux work
`;

// STATE.md with milestone pointing at v1.0 (not v2.0).
// Uses YAML frontmatter so extractCurrentMilestone can read the `milestone:` field.
const STATE_POINTING_V1 = `---
milestone: v1.0
milestone_name: Primary Milestone
---
# State

**Current Phase:** 41.2
**Status:** In progress
**Last Activity:** 2026-04-25
**Last Activity Description:** Working on qux
`;

describe('bug #2676: phase.complete respects parallel milestone routing', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Write ROADMAP.md and STATE.md
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), PARALLEL_ROADMAP);
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), STATE_POINTING_V1);

    // Create filesystem phase directories for vA (primary milestone)
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '10-foo'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '11-bar'), { recursive: true });

    // Create filesystem phase directories for vB (parallel milestone)
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '41.1-baz'), { recursive: true });

    const phase412 = path.join(tmpDir, '.planning', 'phases', '41.2-qux');
    fs.mkdirSync(phase412, { recursive: true });
    fs.writeFileSync(path.join(phase412, '41.2-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase412, '41.2-01-SUMMARY.md'), '# Summary');

    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '41.3-quux'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('phase.complete 41.2 returns is_last_phase: false when 41.3 exists', () => {
    // BUG: before the fix this returns is_last_phase: true because the
    // milestone filter (built from vA's phases: 10, 11) excludes all 41.x dirs,
    // leaving an empty candidate set and defaulting isLastPhase to true.
    const result = runSdkQuery(['phase.complete', '41.2'], tmpDir);

    assert.ok(result.success, `phase.complete failed: ${result.error}`);
    assert.strictEqual(
      result.data.is_last_phase,
      false,
      `expected is_last_phase: false but got true — parallel milestone filter not bypassed. ` +
      `next_phase was: ${result.data.next_phase}`
    );
  });

  test('phase.complete 41.2 returns next_phase pointing at 41.3', () => {
    const result = runSdkQuery(['phase.complete', '41.2'], tmpDir);

    assert.ok(result.success, `phase.complete failed: ${result.error}`);
    assert.ok(
      result.data.next_phase !== null,
      `next_phase should not be null when 41.3 exists — got: ${JSON.stringify(result.data.next_phase)}`
    );
    // next_phase may be returned as "41.3" or "41" depending on dir name matching
    assert.match(
      String(result.data.next_phase),
      /^41\.3/,
      `next_phase should start with 41.3, got: ${result.data.next_phase}`
    );
  });

  test('phase.complete for vA phase still uses milestone filter normally', () => {
    // Completing phase 10 (in vA): the filter includes it, so the candidate
    // set for next-phase is {10, 11} and next should be 11.
    const phase10 = path.join(tmpDir, '.planning', 'phases', '10-foo');
    fs.writeFileSync(path.join(phase10, '10-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase10, '10-01-SUMMARY.md'), '# Summary');

    const result = runSdkQuery(['phase.complete', '10'], tmpDir);

    assert.ok(result.success, `phase.complete 10 failed: ${result.error}`);
    assert.strictEqual(result.data.is_last_phase, false, 'phase 10 should not be last (11 follows)');
    assert.match(
      String(result.data.next_phase ?? ''),
      /^11/,
      `next_phase should point to 11, got: ${result.data.next_phase}`
    );
  });

  test('phase.complete for actual last phase of vA still returns is_last_phase: true', () => {
    // Completing phase 11 (last in vA): the filter includes phases 10 and 11,
    // nothing higher in the vA milestone, so is_last_phase should be true
    // (even though 41.x dirs exist on disk for vB).
    const phase11 = path.join(tmpDir, '.planning', 'phases', '11-bar');
    fs.writeFileSync(path.join(phase11, '11-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase11, '11-01-SUMMARY.md'), '# Summary');

    const result = runSdkQuery(['phase.complete', '11'], tmpDir);

    assert.ok(result.success, `phase.complete 11 failed: ${result.error}`);
    assert.strictEqual(
      result.data.is_last_phase,
      true,
      `phase 11 is last in vA; is_last_phase should be true even with vB dirs on disk`
    );
  });
});
