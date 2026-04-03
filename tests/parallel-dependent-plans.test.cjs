/**
 * Tests for bug #1587: parallel agents for dependent plans
 *
 * Validates that:
 * 1. gsd-planner.md assign_waves step explicitly checks files_modified overlap
 *    and mandates a later wave for any plan that shares files with a prior plan.
 * 2. execute-phase.md has a pre-spawn intra-wave files_modified overlap check
 *    and directs sequential execution when overlap is detected.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const PLANNER_AGENT_PATH = path.join(__dirname, '..', 'agents', 'gsd-planner.md');
const EXECUTE_PHASE_PATH = path.join(
  __dirname,
  '..',
  'get-shit-done',
  'workflows',
  'execute-phase.md'
);

// ---------------------------------------------------------------------------
// gsd-planner.md — wave assignment must account for files_modified overlap
// ---------------------------------------------------------------------------

describe('gsd-planner agent: files_modified wave ordering', () => {
  test('planner agent file exists', () => {
    assert.ok(fs.existsSync(PLANNER_AGENT_PATH), 'agents/gsd-planner.md should exist');
  });

  test('assign_waves step checks files_modified overlap', () => {
    const content = fs.readFileSync(PLANNER_AGENT_PATH, 'utf-8');
    // The assign_waves step must mention files_modified overlap as a wave-bumping condition
    assert.ok(
      content.includes('files_modified'),
      'assign_waves step should reference files_modified'
    );
    // Must state that overlap forces a later wave (not just "same plan or sequential")
    assert.ok(
      content.includes('files_modified overlap') ||
        content.includes('files_modified') &&
          (content.includes('later wave') || content.includes('strictly later wave')),
      'assign_waves step should explicitly require a later wave when files_modified overlap exists'
    );
  });

  test('assign_waves step contains explicit overlap → later-wave rule', () => {
    const content = fs.readFileSync(PLANNER_AGENT_PATH, 'utf-8');
    // Look for the assign_waves step block
    const assignWavesMatch = content.match(
      /<step name="assign_waves">([\s\S]*?)<\/step>/
    );
    assert.ok(assignWavesMatch, 'assign_waves step should exist in gsd-planner.md');

    const stepContent = assignWavesMatch[1];

    // Must mention files_modified as a wave-ordering factor inside the step
    assert.ok(
      stepContent.includes('files_modified'),
      'assign_waves step body must reference files_modified as a wave-assignment factor'
    );
  });

  test('assign_waves step treats files_modified overlap same as depends_on dependency', () => {
    const content = fs.readFileSync(PLANNER_AGENT_PATH, 'utf-8');
    const assignWavesMatch = content.match(
      /<step name="assign_waves">([\s\S]*?)<\/step>/
    );
    assert.ok(assignWavesMatch, 'assign_waves step should exist');

    const stepContent = assignWavesMatch[1];

    // The step must bump the wave when files_modified overlap exists
    assert.ok(
      stepContent.includes('overlap') || stepContent.includes('shared file'),
      'assign_waves step must handle file overlap as a wave-bumping condition'
    );
  });

  test('planner has validation step or quality gate for wave/files_modified consistency', () => {
    const content = fs.readFileSync(PLANNER_AGENT_PATH, 'utf-8');
    // Either a validation step or the quality_gate checklist must assert no same-wave overlap
    const hasValidationStep =
      content.includes('validate_waves') ||
      content.includes('wave_validation') ||
      content.includes('files_modified overlap');
    const hasQualityGateCheck =
      content.includes('files_modified') && content.includes('same wave');
    assert.ok(
      hasValidationStep || hasQualityGateCheck,
      'planner should validate that no two plans in the same wave share files_modified entries'
    );
  });
});

// ---------------------------------------------------------------------------
// execute-phase.md — pre-spawn intra-wave overlap safety net
// ---------------------------------------------------------------------------

describe('execute-phase workflow: intra-wave files_modified overlap check', () => {
  test('execute-phase workflow file exists', () => {
    assert.ok(fs.existsSync(EXECUTE_PHASE_PATH), 'workflows/execute-phase.md should exist');
  });

  test('execute_waves step contains intra-wave files_modified overlap check', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    // The workflow must mention checking files_modified overlap before spawning
    assert.ok(
      content.includes('files_modified') &&
        (content.includes('overlap') || content.includes('intra-wave')),
      'execute-phase workflow should check for files_modified overlap within a wave before spawning'
    );
  });

  test('overlap detection is placed before agent spawning', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    // Overlap check keyword must appear before the Task( spawn call
    const overlapIdx = content.indexOf('intra-wave') !== -1
      ? content.indexOf('intra-wave')
      : content.indexOf('files_modified overlap');
    const spawnIdx = content.indexOf('Spawn executor agents');
    assert.ok(overlapIdx !== -1, 'overlap check text should exist in execute-phase.md');
    assert.ok(spawnIdx !== -1, '"Spawn executor agents" heading should exist');
    assert.ok(
      overlapIdx < spawnIdx,
      'overlap check should appear before the "Spawn executor agents" section'
    );
  });

  test('workflow warns and switches to sequential when overlap detected', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    // Must log a warning and force sequential execution for overlapping plans
    assert.ok(
      content.includes('sequentially') || content.includes('sequential'),
      'workflow should direct sequential execution when overlap is detected'
    );
    assert.ok(
      content.includes('overlap') && content.includes('warn'),
      'workflow should log a warning when files_modified overlap is detected in a wave'
    );
  });

  test('overlap check covers all plans in the wave, not just adjacent pairs', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    // Must describe comparing all plans in the wave (set-intersection language)
    assert.ok(
      content.includes('all plans in') ||
        content.includes('all plans within') ||
        content.includes('each pair') ||
        content.includes('any two plans'),
      'overlap check should cover all plan pairs in the wave, not just adjacent ones'
    );
  });
});
