// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

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
// #2653 — allowlist moved to shared schema module.
const CONFIG_SCHEMA_TS = path.join(__dirname, '..', 'sdk', 'src', 'query', 'config-schema.ts');
const CONFIG_GATES_TS = path.join(__dirname, '..', 'sdk', 'src', 'query', 'config-gates.ts');
const QUERY_INDEX_TS = path.join(__dirname, '..', 'sdk', 'src', 'query', 'registry-assembly.ts');

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
    // Anchored heading regexes — avoid prose-substring traps (review F8/F9).
    const reqIdx = md.search(/^## 13[a-z]?\.\s+Requirements Coverage Gate/m);
    const decIdx = md.search(/^## 13[a-z]?\.\s+Decision Coverage Gate/m);
    assert.ok(reqIdx !== -1, 'Requirements Coverage Gate heading must exist as ## 13[a-z]?.');
    assert.ok(decIdx !== -1, 'Decision Coverage Gate heading must exist as ## 13[a-z]?.');
    assert.ok(decIdx > reqIdx, 'Decision gate must run after Requirements gate');
  });

  test('decision gate appears BEFORE plans are committed', () => {
    const decIdx = md.search(/^## 13[a-z]?\.\s+Decision Coverage Gate/m);
    const commitIdx = md.search(/^## 13[a-z]?\.\s+Commit Plans/m);
    assert.ok(decIdx !== -1, 'Decision Coverage Gate heading must exist as ## 13[a-z]?.');
    assert.ok(commitIdx !== -1, 'Commit Plans heading must exist as ## 13[a-z]?.');
    assert.ok(decIdx < commitIdx, 'Decision gate must run before commit so failures block the commit');
  });

  test('plan-phase Decision Coverage Gate uses CONTEXT_PATH variable defined in INIT extraction (review F1)', () => {
    // The CONTEXT_PATH bash variable is defined at Step 4 (`CONTEXT_PATH=$(_gsd_field "$INIT" context_path)`).
    // The plan-phase gate snippet must reference the same casing — `${CONTEXT_PATH}` — not `${context_path}`,
    // otherwise the BLOCKING gate is invoked with an empty path and silently skips.
    const defIdx = md.indexOf('CONTEXT_PATH=$(_gsd_field "$INIT" context_path)');
    assert.ok(defIdx !== -1, 'CONTEXT_PATH must be defined from INIT JSON');

    const gateIdx = md.indexOf('check.decision-coverage-plan');
    assert.ok(gateIdx !== -1, 'check.decision-coverage-plan invocation must exist');

    // Slice the surrounding gate snippet (~600 chars) and verify variable casing matches the definition.
    const snippet = md.slice(Math.max(0, gateIdx - 200), gateIdx + 400);
    assert.ok(
      snippet.includes('${CONTEXT_PATH}'),
      'Gate snippet must reference ${CONTEXT_PATH} (uppercase) to match the variable defined in Step 4',
    );
    assert.ok(
      !snippet.includes('${context_path}'),
      'Gate snippet must NOT reference ${context_path} (lowercase) — that name is undefined in shell scope',
    );
  });

  test('plan-phase blocking gate exits non-zero on failure (review F15)', () => {
    // The gate is documented as BLOCKING. To actually block, the shell snippet must
    // exit with non-zero status when `passed` is false. Without exit-1 the workflow
    // continues silently past the failure.
    const gateIdx = md.indexOf('check.decision-coverage-plan');
    assert.ok(gateIdx !== -1);
    const snippet = md.slice(gateIdx, gateIdx + 800);
    // Accept either an inline `|| exit 1` or a `|| { ...; exit 1; }` group.
    const hasJqGuard = /jq[^\n]*passed\s*==\s*true/.test(snippet);
    const hasExitOne = /\|\|\s*(?:exit\s+1|\{[\s\S]{0,200}?exit\s+1)/.test(snippet);
    assert.ok(
      hasJqGuard && hasExitOne,
      'plan-phase gate must guard with `jq -e .passed == true || exit 1` (or `|| { ...; exit 1; }`) to actually block',
    );
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

  test('config-schema.ts VALID_CONFIG_KEYS allows workflow.context_coverage_gate', () => {
    // #2653 — allowlist moved out of config-mutation.ts into shared config-schema.ts.
    const c = fs.readFileSync(CONFIG_SCHEMA_TS, 'utf-8');
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

  test('query registry assembly registers the new handlers', () => {
    const c = fs.readFileSync(QUERY_INDEX_TS, 'utf-8');
    // Handlers are now registered through catalog-based registration.
    assert.ok(c.includes('VERIFY_DECISION_STATIC_CATALOG'), 'decision-coverage-plan handler must be registered via the verify-decision catalog');
    assert.ok(c.includes('registerStaticCatalog(registry, VERIFY_DECISION_STATIC_CATALOG)'), 'check.decision-coverage-plan handler must be registered');
    assert.ok(c.includes('registerStaticCatalog(registry, VERIFY_DECISION_STATIC_CATALOG)'), 'check.decision-coverage-verify handler must be registered');
    assert.ok(c.includes('decisions.parse') || c.includes('VERIFY_DECISION_STATIC_CATALOG'), 'decisions.parse handler must be registered');
  });
});
