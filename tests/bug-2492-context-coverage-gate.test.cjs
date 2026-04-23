/**
 * Bug #2492: Add gates to ensure discuss-phase decisions are translated to
 * plans (plan-phase, BLOCKING) and verified against shipped artifacts
 * (verify-phase, NON-BLOCKING).
 *
 * These workflow files are loaded as prompts by the corresponding subagents.
 * The tests below verify that the prompt text contains the gate steps and
 * the config-toggle skip clauses — losing them silently would regress the
 * fix.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PLAN_PHASE = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'plan-phase.md');
const VERIFY_PHASE = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'verify-phase.md');
const CONFIG_TS = path.join(__dirname, '..', 'sdk', 'src', 'config.ts');
const CONFIG_MUTATION_TS = path.join(__dirname, '..', 'sdk', 'src', 'query', 'config-mutation.ts');
const CONFIG_GATES_TS = path.join(__dirname, '..', 'sdk', 'src', 'query', 'config-gates.ts');
const QUERY_INDEX_TS = path.join(__dirname, '..', 'sdk', 'src', 'query', 'index.ts');

describe('plan-phase decision-coverage gate (#2492)', () => {
  const md = fs.readFileSync(PLAN_PHASE, 'utf-8');

  test('contains a Decision Coverage Gate step', () => {
    assert.ok(
      /Decision Coverage Gate/i.test(md),
      'plan-phase.md must define a Decision Coverage Gate step',
    );
  });

  test('invokes the check.decision-coverage-plan handler', () => {
    assert.ok(
      md.includes('check.decision-coverage-plan'),
      'plan-phase.md must call gsd-sdk query check.decision-coverage-plan',
    );
  });

  test('mentions workflow.context_coverage_gate skip clause', () => {
    assert.ok(
      md.includes('workflow.context_coverage_gate'),
      'plan-phase.md must reference workflow.context_coverage_gate to allow skipping',
    );
  });

  test('decision gate appears AFTER the existing Requirements Coverage Gate', () => {
    const reqIdx = md.indexOf('Requirements Coverage Gate');
    const decIdx = md.indexOf('Decision Coverage Gate');
    assert.ok(reqIdx !== -1, 'Requirements Coverage Gate must still exist');
    assert.ok(decIdx !== -1, 'Decision Coverage Gate must exist');
    assert.ok(decIdx > reqIdx, 'Decision gate must run after Requirements gate');
  });

  test('decision gate appears BEFORE plans are committed', () => {
    const decIdx = md.indexOf('Decision Coverage Gate');
    const commitIdx = md.indexOf('Commit Plans');
    assert.ok(decIdx !== -1 && commitIdx !== -1);
    assert.ok(decIdx < commitIdx, 'Decision gate must run before commit so failures block the commit');
  });
});

describe('verify-phase decision-coverage gate (#2492)', () => {
  const md = fs.readFileSync(VERIFY_PHASE, 'utf-8');

  test('contains a verify_decisions step', () => {
    assert.ok(
      /verify_decisions/.test(md),
      'verify-phase.md must define a verify_decisions step',
    );
  });

  test('invokes the check.decision-coverage-verify handler', () => {
    assert.ok(
      md.includes('check.decision-coverage-verify'),
      'verify-phase.md must call gsd-sdk query check.decision-coverage-verify',
    );
  });

  test('declares the decision gate as non-blocking / warning only', () => {
    const lower = md.toLowerCase();
    assert.ok(
      lower.includes('non-blocking') || lower.includes('warning only') || lower.includes('not block'),
      'verify-phase.md must declare the decision gate is non-blocking',
    );
  });

  test('mentions workflow.context_coverage_gate skip clause', () => {
    assert.ok(
      md.includes('workflow.context_coverage_gate'),
      'verify-phase.md must reference workflow.context_coverage_gate to allow skipping',
    );
  });
});

describe('SDK wiring for #2492 gates', () => {
  test('config.ts WorkflowConfig has context_coverage_gate key', () => {
    const c = fs.readFileSync(CONFIG_TS, 'utf-8');
    assert.ok(c.includes('context_coverage_gate'), 'WorkflowConfig must declare context_coverage_gate');
    assert.ok(
      /context_coverage_gate:\s*true/.test(c),
      'CONFIG_DEFAULTS.workflow.context_coverage_gate must default to true',
    );
  });

  test('config-mutation.ts VALID_CONFIG_KEYS allows workflow.context_coverage_gate', () => {
    const c = fs.readFileSync(CONFIG_MUTATION_TS, 'utf-8');
    assert.ok(
      c.includes("'workflow.context_coverage_gate'"),
      'workflow.context_coverage_gate must be in VALID_CONFIG_KEYS',
    );
  });

  test('config-gates.ts surfaces context_coverage_gate', () => {
    const c = fs.readFileSync(CONFIG_GATES_TS, 'utf-8');
    assert.ok(
      c.includes('context_coverage_gate'),
      'check.config-gates must expose context_coverage_gate to workflows',
    );
  });

  test('query index.ts registers the new handlers', () => {
    const c = fs.readFileSync(QUERY_INDEX_TS, 'utf-8');
    assert.ok(c.includes('check.decision-coverage-plan'), 'check.decision-coverage-plan handler must be registered');
    assert.ok(c.includes('check.decision-coverage-verify'), 'check.decision-coverage-verify handler must be registered');
    assert.ok(c.includes('decisions.parse'), 'decisions.parse handler must be registered');
  });
});
