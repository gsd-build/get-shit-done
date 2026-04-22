'use strict';

/**
 * Prompt Thinning Tests (#1978)
 *
 * Validates context-window-aware prompt thinning for sub-200K models.
 * When CONTEXT_WINDOW < 200000, agent prompts strip extended examples
 * and anti-pattern lists, referencing them as @-required_reading files instead.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const EXECUTE_PHASE = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
const EXECUTOR_AGENT = path.join(__dirname, '..', 'agents', 'gsd-executor.md');
const PLANNER_AGENT = path.join(__dirname, '..', 'agents', 'gsd-planner.md');
const EXECUTOR_EXAMPLES_REF = path.join(__dirname, '..', 'get-shit-done', 'references', 'executor-examples.md');
const PLANNER_ANTIPATTERNS_REF = path.join(__dirname, '..', 'get-shit-done', 'references', 'planner-antipatterns.md');

describe('prompt thinning — sub-200K context window support (#1978)', () => {

  describe('execute-phase.md — thinning conditional', () => {
    test('has a CONTEXT_WINDOW < 200000 thinning conditional', () => {
      const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
      assert.ok(
        content.includes('CONTEXT_WINDOW < 200000') || content.includes('CONTEXT_WINDOW< 200000'),
        'execute-phase.md must contain a CONTEXT_WINDOW < 200000 conditional for prompt thinning'
      );
    });

    test('preserves the existing CONTEXT_WINDOW >= 500000 enrichment conditional', () => {
      const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
      assert.ok(
        content.includes('CONTEXT_WINDOW >= 500000'),
        'execute-phase.md must preserve the existing 500K enrichment conditional'
      );
    });

    test('thinning block references executor-examples.md for on-demand loading', () => {
      const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
      assert.ok(
        content.includes('executor-examples.md'),
        'execute-phase.md thinning block must reference executor-examples.md'
      );
    });
  });

  describe('gsd-executor.md — reference to extracted examples', () => {
    test('references executor-examples.md for extended examples', () => {
      const content = fs.readFileSync(EXECUTOR_AGENT, 'utf-8');
      assert.ok(
        content.includes('executor-examples.md'),
        'gsd-executor.md must reference executor-examples.md for extended deviation/checkpoint examples'
      );
    });
  });

  describe('gsd-planner.md — reference to extracted anti-patterns', () => {
    test('references planner-antipatterns.md for extended anti-patterns', () => {
      const content = fs.readFileSync(PLANNER_AGENT, 'utf-8');
      assert.ok(
        content.includes('planner-antipatterns.md'),
        'gsd-planner.md must reference planner-antipatterns.md for extended checkpoint anti-patterns and specificity examples'
      );
    });
  });

  describe('executor-examples.md — extracted reference file', () => {
    test('file exists', () => {
      assert.ok(
        fs.existsSync(EXECUTOR_EXAMPLES_REF),
        'get-shit-done/references/executor-examples.md must exist'
      );
    });

    test('contains deviation rule examples', () => {
      const content = fs.readFileSync(EXECUTOR_EXAMPLES_REF, 'utf-8');
      assert.ok(
        content.includes('Rule 1') || content.includes('RULE 1'),
        'executor-examples.md must contain deviation rule examples'
      );
    });

    test('contains checkpoint examples', () => {
      const content = fs.readFileSync(EXECUTOR_EXAMPLES_REF, 'utf-8');
      assert.ok(
        content.includes('checkpoint') || content.includes('Checkpoint'),
        'executor-examples.md must contain checkpoint examples'
      );
    });

    test('contains edge case examples', () => {
      const content = fs.readFileSync(EXECUTOR_EXAMPLES_REF, 'utf-8');
      assert.ok(
        content.includes('Edge case') || content.includes('edge case') || content.includes('Edge Case'),
        'executor-examples.md must contain edge case guidance'
      );
    });
  });

  describe('planner-antipatterns.md — extracted reference file', () => {
    test('file exists', () => {
      assert.ok(
        fs.existsSync(PLANNER_ANTIPATTERNS_REF),
        'get-shit-done/references/planner-antipatterns.md must exist'
      );
    });

    test('contains checkpoint anti-patterns', () => {
      const content = fs.readFileSync(PLANNER_ANTIPATTERNS_REF, 'utf-8');
      assert.ok(
        content.includes('anti-pattern') || content.includes('Anti-Pattern') || content.includes('Bad'),
        'planner-antipatterns.md must contain checkpoint anti-pattern examples'
      );
    });

    test('contains specificity examples', () => {
      const content = fs.readFileSync(PLANNER_ANTIPATTERNS_REF, 'utf-8');
      assert.ok(
        content.includes('TOO VAGUE') || content.includes('Specificity') || content.includes('specificity'),
        'planner-antipatterns.md must contain specificity examples'
      );
    });
  });

  describe('three-tier consistency', () => {
    test('thinning tier (< 200K), standard tier (200K-500K), and enrichment tier (>= 500K) all coexist', () => {
      const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
      const hasThinning = content.includes('CONTEXT_WINDOW < 200000');
      const hasEnrichment = content.includes('CONTEXT_WINDOW >= 500000');
      assert.ok(hasThinning, 'must have thinning conditional (< 200K)');
      assert.ok(hasEnrichment, 'must have enrichment conditional (>= 500K)');
    });
  });
});
