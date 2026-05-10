// allow-test-rule: source-text-is-the-product
// Planner and verifier agent .md files ARE the runtime contract loaded by
// the AI runtimes. Asserting that the canonical wording for the new
// `workflow.human_verify_mode` flag is present in those files is the only
// way to verify the agents will respect the flag at runtime.

/**
 * Enhancement #3309: workflow.human_verify_mode = end-of-phase
 *
 * "mid-flight" preserves the pre-#3309 behavior — the planner emits
 * `<task type="checkpoint:human-verify">` tasks, and the executor halts at
 * each one. Each halt costs a full executor cold-start (CLAUDE.md, MEMORY.md,
 * STATE.md, plan re-read) because subagent context is discarded across the
 * pause.
 *
 * "end-of-phase" (the new default) instructs the planner NOT to emit
 * `checkpoint:human-verify` tasks and instead embed the verification details
 * into the relevant `auto` task's `<verify><human-check>` block. The verifier
 * (Step 8) harvests these blocks at end-of-phase and consolidates them into the existing
 * `human_needed` → HUMAN-UAT.md path, restoring the v1.35-shaped behavior
 * the reporter wanted without resurrecting the v1.35 writer.
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

function readConfig(tmpDir) {
  const configPath = path.join(tmpDir, '.planning', 'config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

const REPO_ROOT = path.join(__dirname, '..');

// ─── Schema registration ──────────────────────────────────────────────────────

describe('workflow.human_verify_mode in VALID_CONFIG_KEYS', () => {
  test('is a recognized config key', () => {
    const { VALID_CONFIG_KEYS } = require('../get-shit-done/bin/lib/config.cjs');
    assert.ok(
      VALID_CONFIG_KEYS.has('workflow.human_verify_mode'),
      'workflow.human_verify_mode should be in VALID_CONFIG_KEYS',
    );
  });
});

// ─── Default value (CJS) ──────────────────────────────────────────────────────

describe('workflow.human_verify_mode default value', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('defaults to end-of-phase in new project config', () => {
    const result = runGsdTools('config-ensure-section', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `config-ensure-section failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(
      config.workflow.human_verify_mode,
      'end-of-phase',
      'workflow.human_verify_mode should default to "end-of-phase" — the cost-control mode is the project default; opt back into the pre-#3309 mid-flight behavior with config-set',
    );
  });
});

// ─── Round-trip ──────────────────────────────────────────────────────────────

describe('workflow.human_verify_mode config round-trip', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTempProject();
    runGsdTools('config-ensure-section', tmpDir, { HOME: tmpDir });
  });
  afterEach(() => { cleanup(tmpDir); });

  test('config-set end-of-phase persists to config.json', () => {
    const setResult = runGsdTools('config-set workflow.human_verify_mode end-of-phase', tmpDir);
    assert.ok(setResult.success, `config-set failed: ${setResult.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.workflow.human_verify_mode, 'end-of-phase');
  });

  test('config-set mid-flight overwrites end-of-phase in config.json', () => {
    runGsdTools('config-set workflow.human_verify_mode end-of-phase', tmpDir);

    const setResult = runGsdTools('config-set workflow.human_verify_mode mid-flight', tmpDir);
    assert.ok(setResult.success, `config-set failed: ${setResult.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.workflow.human_verify_mode, 'mid-flight');
  });

  test('persists in config.json as string', () => {
    runGsdTools('config-set workflow.human_verify_mode end-of-phase', tmpDir);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.workflow.human_verify_mode, 'end-of-phase');
    assert.strictEqual(typeof config.workflow.human_verify_mode, 'string');
  });

  test('rejects invalid mode values', () => {
    const result = runGsdTools('config-set workflow.human_verify_mode midflight', tmpDir);
    assert.strictEqual(result.success, false);
    assert.match(result.error, /Invalid workflow\.human_verify_mode 'midflight'/);
    assert.match(result.error, /mid-flight, end-of-phase/);
  });
});

// ─── Planner agent contract ──────────────────────────────────────────────────

describe('agents/gsd-planner.md acknowledges workflow.human_verify_mode', () => {
  let plannerSrc;

  test('loads', () => {
    plannerSrc = fs.readFileSync(path.join(REPO_ROOT, 'agents', 'gsd-planner.md'), 'utf-8');
    assert.ok(plannerSrc.length > 0);
  });

  test('mentions workflow.human_verify_mode by canonical name', () => {
    plannerSrc = plannerSrc || fs.readFileSync(path.join(REPO_ROOT, 'agents', 'gsd-planner.md'), 'utf-8');
    assert.ok(
      plannerSrc.includes('workflow.human_verify_mode'),
      'planner must reference the flag by canonical key so the runtime can resolve config-driven behavior',
    );
  });

  test('explains the end-of-phase behavior (do NOT emit checkpoint:human-verify)', () => {
    plannerSrc = plannerSrc || fs.readFileSync(path.join(REPO_ROOT, 'agents', 'gsd-planner.md'), 'utf-8');
    // The planner must instruct: when end-of-phase, do NOT emit checkpoint:human-verify
    assert.ok(
      /end-of-phase[\s\S]{0,400}checkpoint:human-verify/i.test(plannerSrc) ||
      /checkpoint:human-verify[\s\S]{0,400}end-of-phase/i.test(plannerSrc),
      'planner must couple "end-of-phase" mode with the rule that checkpoint:human-verify tasks are not emitted',
    );
  });

  test('routes deferred verification through the <verify><human-check> block on auto tasks', () => {
    plannerSrc = plannerSrc || fs.readFileSync(path.join(REPO_ROOT, 'agents', 'gsd-planner.md'), 'utf-8');
    assert.ok(
      /`?<verify>`?\s*[\s\S]{0,200}`?<human-check>`?/i.test(plannerSrc) ||
      plannerSrc.includes('<verify><human-check>') ||
      plannerSrc.includes('`<verify><human-check>`'),
      'planner must document the <verify><human-check>...</human-check></verify> shape so the verifier can harvest deferred items',
    );
  });
});

// ─── Verifier agent contract ─────────────────────────────────────────────────

describe('agents/gsd-verifier.md harvests deferred human verification items', () => {
  test('Step 8 mentions harvesting <verify><human-check> blocks from PLAN.md', () => {
    const verifierSrc = fs.readFileSync(path.join(REPO_ROOT, 'agents', 'gsd-verifier.md'), 'utf-8');
    assert.ok(
      verifierSrc.includes('<verify><human-check>') || /<verify>[\s\S]{0,200}<human-check>/i.test(verifierSrc),
      'verifier must instruct itself to harvest <verify><human-check> blocks from PLAN.md when human_verify_mode = end-of-phase',
    );
    assert.ok(
      verifierSrc.includes('human_verify_mode'),
      'verifier must reference the flag by canonical key',
    );
  });
});

// ─── References doc parity ───────────────────────────────────────────────────

describe('references/checkpoints.md documents the flag', () => {
  test('mentions workflow.human_verify_mode in the human-verify section', () => {
    const refSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'get-shit-done', 'references', 'checkpoints.md'),
      'utf-8',
    );
    assert.ok(
      refSrc.includes('workflow.human_verify_mode'),
      'checkpoints reference must document the new flag so users know the cost-control alternative exists',
    );
  });
});
