'use strict';

// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Tests for #2310: plan-phase chunked mode + filesystem fallback.
 *
 * Context: on Windows (and occasionally other platforms), gsd-planner's
 * Task() call may never return even though the subagent finished writing all
 * PLAN.md files to disk. The orchestrator hangs indefinitely. Two mitigations:
 *
 * 1. Filesystem fallback (steps 9a, 11a): if the Task() return lacks the
 *    expected marker but PLAN.md files exist on disk, surface a recoverable
 *    prompt instead of hanging/failing silently.
 *
 * 2. Chunked mode (step 8.5): --chunked flag / workflow.plan_chunked config
 *    splits the single long planner Task into (a) a short outline Task and
 *    (b) N short single-plan Tasks. Each Task is shorter-lived, the
 *    orchestrator can commit work incrementally, and a hang loses only one
 *    plan instead of the entire phase.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLAN_PHASE = path.join(
  __dirname, '..', 'get-shit-done', 'workflows', 'plan-phase.md'
);

const PLANNER_AGENT = path.join(__dirname, '..', 'agents', 'gsd-planner.md');
const PLANNER_CHUNKED_REF = path.join(__dirname, '..', 'get-shit-done', 'references', 'planner-chunked.md');
const CONFIG_SCHEMA = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'config-schema.cjs');
const CONFIGURATION_MD = path.join(__dirname, '..', 'docs', 'CONFIGURATION.md');

describe('plan-phase.md — filesystem fallback (#2310)', () => {
  const content = fs.readFileSync(PLAN_PHASE, 'utf-8');

  test('step 9 checks PLAN.md count on disk when planner return lacks completion marker', () => {
    assert.ok(
      content.includes('DISK_PLANS=$(ls "${PHASE_DIR}"/*-PLAN.md'),
      'step 9a must check disk for PLAN.md files via DISK_PLANS variable'
    );
  });

  test('step 9a fallback section exists', () => {
    assert.ok(
      content.includes('## 9a. Filesystem Fallback'),
      'plan-phase.md must have a ## 9a. Filesystem Fallback section for planner hang recovery'
    );
  });

  test('step 9a fallback offers Accept plans option', () => {
    assert.ok(
      content.includes('Accept plans'),
      'step 9a must offer "Accept plans" as a recovery option'
    );
  });

  test('step 9a fallback offers Retry planner option', () => {
    assert.ok(
      content.includes('Retry planner'),
      'step 9a must offer "Retry planner" as a recovery option'
    );
  });

  test('step 11 has filesystem fallback section', () => {
    assert.ok(
      content.includes('## 11a. Filesystem Fallback'),
      'plan-phase.md must have a ## 11a. Filesystem Fallback section for checker hang recovery'
    );
  });

  test('step 11a fallback offers Accept verification option', () => {
    assert.ok(
      content.includes('Accept verification'),
      'step 11a must offer "Accept verification" as a recovery option'
    );
  });

  test('step 11a fallback offers Retry checker option', () => {
    assert.ok(
      content.includes('Retry checker'),
      'step 11a must offer "Retry checker" as a recovery option'
    );
  });

  test('step 9 routes to step 9a when no recognized marker found', () => {
    assert.ok(
      content.includes('step 9a') || content.includes('9a.'),
      'step 9 handle-return must reference the filesystem fallback path (step 9a)'
    );
  });

  test('step 11 routes to step 11a when no recognized marker found', () => {
    assert.ok(
      content.includes('step 11a') || content.includes('11a.'),
      'step 11 handle-return must reference the filesystem fallback path (step 11a)'
    );
  });
});

describe('plan-phase.md — chunked mode flag and config (#2310)', () => {
  const content = fs.readFileSync(PLAN_PHASE, 'utf-8');

  test('step 2 parses --chunked flag', () => {
    assert.ok(
      content.includes('--chunked'),
      'step 2 must parse --chunked flag from $ARGUMENTS'
    );
  });

  test('step 2 reads workflow.plan_chunked config', () => {
    assert.ok(
      content.includes('workflow.plan_chunked'),
      'step 2 must read workflow.plan_chunked config key'
    );
  });

  test('step 2 sets CHUNKED_MODE variable', () => {
    assert.ok(
      content.includes('CHUNKED_MODE'),
      'step 2 must set CHUNKED_MODE from flag or config'
    );
  });
});

describe('plan-phase.md — chunked mode implementation (#2310)', () => {
  const content = fs.readFileSync(PLAN_PHASE, 'utf-8');

  test('step 8.5 chunked planning section exists', () => {
    assert.ok(
      content.includes('## 8.5.'),
      'plan-phase.md must have a step 8.5 section for chunked planning mode'
    );
  });

  test('chunked mode produces PLAN-OUTLINE.md', () => {
    assert.ok(
      content.includes('PLAN-OUTLINE.md'),
      'chunked mode outline step must produce a *-PLAN-OUTLINE.md file'
    );
  });

  test('chunked outline step uses outline-only mode', () => {
    assert.ok(
      content.includes('outline-only'),
      'chunked step 8.5.1 must spawn the planner in outline-only mode'
    );
  });

  test('chunked per-plan step uses single-plan mode', () => {
    assert.ok(
      content.includes('single-plan'),
      'chunked step 8.5.2 must spawn the planner in single-plan mode for each plan'
    );
  });

  test('chunked mode checks for existing outline to enable resume', () => {
    // The resume check skips the outline Task if PLAN-OUTLINE.md already exists
    assert.ok(
      content.includes('PLAN-OUTLINE.md') && content.includes('already exists'),
      'chunked mode must detect existing PLAN-OUTLINE.md and skip outline generation (resume safety)'
    );
  });

  test('chunked mode commits each plan individually', () => {
    assert.ok(
      content.includes('chunked'),
      'chunked mode must commit each individual plan for crash resilience'
    );
  });

  test('step 8 routes to chunked path when CHUNKED_MODE is true', () => {
    assert.ok(
      content.includes('CHUNKED_MODE') && content.includes('8.5'),
      'step 8 must route to step 8.5 when CHUNKED_MODE is true'
    );
  });
});

describe('gsd-planner.md — references planner-chunked.md (#2310)', () => {
  const plannerContent = fs.readFileSync(PLANNER_AGENT, 'utf-8');

  test('gsd-planner.md references planner-chunked.md for chunked return formats', () => {
    assert.ok(
      plannerContent.includes('planner-chunked.md'),
      'gsd-planner.md must reference planner-chunked.md for ## OUTLINE COMPLETE / ## PLAN COMPLETE formats'
    );
  });
});

describe('planner-chunked.md — chunked return formats (#2310)', () => {
  const content = fs.readFileSync(PLANNER_CHUNKED_REF, 'utf-8');

  test('planner-chunked.md defines OUTLINE COMPLETE structured return', () => {
    assert.ok(
      content.includes('## OUTLINE COMPLETE'),
      'planner-chunked.md must define ## OUTLINE COMPLETE return format for outline-only mode'
    );
  });

  test('planner-chunked.md defines PLAN COMPLETE structured return for single-plan mode', () => {
    assert.ok(
      content.includes('## PLAN COMPLETE'),
      'planner-chunked.md must define ## PLAN COMPLETE return format for single-plan mode'
    );
  });

  test('planner-chunked.md describes resume behaviour', () => {
    assert.ok(
      content.includes('Resume') || content.includes('resume'),
      'planner-chunked.md must describe resume behaviour for interrupted chunked runs'
    );
  });
});

describe('config-schema.cjs — workflow.plan_chunked key (#2310)', () => {
  test('VALID_CONFIG_KEYS includes workflow.plan_chunked', () => {
    const { VALID_CONFIG_KEYS } = require(CONFIG_SCHEMA);
    assert.ok(
      VALID_CONFIG_KEYS.has('workflow.plan_chunked'),
      'config-schema.cjs VALID_CONFIG_KEYS must include workflow.plan_chunked'
    );
  });
});

describe('docs/CONFIGURATION.md — workflow.plan_chunked documented (#2310)', () => {
  const content = fs.readFileSync(CONFIGURATION_MD, 'utf-8');

  test('CONFIGURATION.md documents workflow.plan_chunked', () => {
    assert.ok(
      content.includes('`workflow.plan_chunked`'),
      'docs/CONFIGURATION.md must document workflow.plan_chunked'
    );
  });
});
