// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * GSD Tools Tests - Adaptive Context Enrichment for 1M Models
 *
 * Tests for feat/1m-context-enrichment-1473b:
 *   - Workflow template syntax validation (CONTEXT_WINDOW conditionals)
 *   - execute-phase.md enrichment blocks (executor + verifier)
 *   - plan-phase.md cross-phase context gating
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Workflow template syntax validation
// ─────────────────────────────────────────────────────────────────────────────

describe('execute-phase.md context enrichment', () => {
  const EXECUTE_WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');

  test('contains CONTEXT_WINDOW config-get command', () => {
    const content = fs.readFileSync(EXECUTE_WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('CONTEXT_WINDOW'),
      'execute-phase.md should reference CONTEXT_WINDOW variable'
    );
    assert.ok(
      content.includes('config-get context_window'),
      'execute-phase.md should read context_window via config-get'
    );
    assert.ok(
      content.includes('|| echo "200000"'),
      'execute-phase.md should default CONTEXT_WINDOW to 200000'
    );
  });

  test('contains conditional prior_wave_summaries in executor prompt', () => {
    const content = fs.readFileSync(EXECUTE_WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('CONTEXT_WINDOW >= 500000'),
      'execute-phase.md should gate enrichment on CONTEXT_WINDOW >= 500000'
    );
    assert.ok(
      content.includes('prior_wave_summaries'),
      'execute-phase.md should include prior_wave_summaries in enrichment block'
    );
    assert.ok(
      content.includes('CONTEXT.md'),
      'execute-phase.md should reference CONTEXT.md in conditional enrichment'
    );
    assert.ok(
      content.includes('RESEARCH.md'),
      'execute-phase.md should reference RESEARCH.md in conditional enrichment'
    );
  });

  test('verifier prompt includes files_to_read block', () => {
    const content = fs.readFileSync(EXECUTE_WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('<files_to_read>'),
      'execute-phase.md should contain <files_to_read> opening tag'
    );
    assert.ok(
      content.includes('</files_to_read>'),
      'execute-phase.md should contain </files_to_read> closing tag'
    );
    const verifierSection = content.substring(content.lastIndexOf('<files_to_read>'));
    assert.ok(
      verifierSection.includes('PLAN.md'),
      'verifier files_to_read should reference PLAN.md'
    );
    assert.ok(
      verifierSection.includes('SUMMARY.md'),
      'verifier files_to_read should reference SUMMARY.md'
    );
    assert.ok(
      verifierSection.includes('REQUIREMENTS.md'),
      'verifier files_to_read should reference REQUIREMENTS.md'
    );
  });

  test('executor enrichment block includes CONTEXT.md and RESEARCH.md for 1M models', () => {
    const content = fs.readFileSync(EXECUTE_WORKFLOW_PATH, 'utf-8');
    // Find the executor section's enrichment block
    const executorIdx = content.indexOf('CONTEXT_WINDOW >= 500000');
    assert.ok(executorIdx > -1, 'Should find CONTEXT_WINDOW >= 500000 conditional');

    // Extract ~500 chars after the conditional to check what's included
    const enrichmentBlock = content.substring(executorIdx, executorIdx + 500);
    assert.ok(
      enrichmentBlock.includes('CONTEXT.md'),
      'executor enrichment should include CONTEXT.md'
    );
    assert.ok(
      enrichmentBlock.includes('RESEARCH.md'),
      'executor enrichment should include RESEARCH.md'
    );
  });
});

describe('plan-phase.md context enrichment', () => {
  const PLAN_WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'plan-phase.md');

  test('contains CONTEXT_WINDOW conditional for prior CONTEXT.md', () => {
    const content = fs.readFileSync(PLAN_WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('CONTEXT_WINDOW'),
      'plan-phase.md should reference CONTEXT_WINDOW variable'
    );
    assert.ok(
      content.includes('config-get context_window'),
      'plan-phase.md should read context_window via config-get'
    );
    assert.ok(
      content.includes('CONTEXT_WINDOW >= 500000'),
      'plan-phase.md should gate cross-phase context on CONTEXT_WINDOW >= 500000'
    );
    assert.ok(
      content.includes('CONTEXT.md'),
      'plan-phase.md should reference CONTEXT.md in cross-phase enrichment'
    );
  });

  test('enrichment block mentions cross-phase decision consistency', () => {
    const content = fs.readFileSync(PLAN_WORKFLOW_PATH, 'utf-8');
    // The enrichment should explain why prior context matters
    assert.ok(
      content.includes('cross-phase') || content.includes('Cross-phase'),
      'plan-phase.md should mention cross-phase context'
    );
    assert.ok(
      content.includes('SUMMARY.md'),
      'plan-phase.md should reference prior SUMMARY.md files'
    );
  });

  test('default CONTEXT_WINDOW fallback is 200000', () => {
    const content = fs.readFileSync(PLAN_WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('|| echo "200000"'),
      'plan-phase.md should default CONTEXT_WINDOW to 200000'
    );
  });
});
