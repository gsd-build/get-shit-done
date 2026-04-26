/**
 * Regression tests for bug #2346
 *
 * Multiple GSD agents (gsd-ui-checker, gsd-planner) entered unbounded Read
 * loops — re-reading the same file hundreds of times in a single run. Root
 * cause: no explicit no-re-read rule or tool-budget cap in the agent prompts.
 * gsd-pattern-mapper was fixed in #2312; this covers the remaining agents.
 *
 * Fix: add <critical_rules> block to each affected agent with:
 *   1. No-re-read constraint
 *   2. Large-file strategy (Grep first, then targeted offset/limit Read)
 *   3. Stop-on-sufficient-evidence rule (where applicable)
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '..', 'agents');

// allow-test-rule: source-text-is-the-product
// The <critical_rules> block in agent .md files IS the fix — it is the AI instruction that
// prevents unbounded Read loops. There is no behavioral equivalent without a live LLM run.
describe('bug #2346: agent read loop guards', () => {

  describe('gsd-ui-checker', () => {
    const agentPath = path.join(AGENTS_DIR, 'gsd-ui-checker.md');
    const content = fs.readFileSync(agentPath, 'utf-8');

    test('agent file exists', () => {
      assert.ok(fs.existsSync(agentPath), 'agents/gsd-ui-checker.md must exist');
    });

    test('has <critical_rules> block', () => {
      assert.ok(
        content.includes('<critical_rules>'),
        'gsd-ui-checker.md must have a <critical_rules> block to prevent unbounded read loops (#2346)'
      );
    });

    test('critical_rules contains no-re-read constraint', () => {
      const rulesStart = content.indexOf('<critical_rules>');
      const rulesEnd = content.indexOf('</critical_rules>', rulesStart);
      assert.ok(rulesStart !== -1 && rulesEnd !== -1, '<critical_rules> block must be complete');
      const rulesBlock = content.slice(rulesStart, rulesEnd);
      assert.ok(
        rulesBlock.includes('re-read') || rulesBlock.includes('re read'),
        'critical_rules must include a no-re-read rule'
      );
    });

    test('critical_rules appears before success_criteria', () => {
      const rulesIdx = content.indexOf('<critical_rules>');
      const successIdx = content.indexOf('<success_criteria>');
      assert.ok(rulesIdx !== -1 && successIdx !== -1, 'both sections must exist');
      assert.ok(
        rulesIdx < successIdx,
        '<critical_rules> must appear before <success_criteria>'
      );
    });
  });

  describe('gsd-planner', () => {
    const agentPath = path.join(AGENTS_DIR, 'gsd-planner.md');
    const content = fs.readFileSync(agentPath, 'utf-8');

    test('agent file exists', () => {
      assert.ok(fs.existsSync(agentPath), 'agents/gsd-planner.md must exist');
    });

    test('has <critical_rules> block', () => {
      assert.ok(
        content.includes('<critical_rules>'),
        'gsd-planner.md must have a <critical_rules> block to prevent unbounded read loops (#2346)'
      );
    });

    test('critical_rules contains no-re-read constraint', () => {
      const rulesStart = content.indexOf('<critical_rules>');
      const rulesEnd = content.indexOf('</critical_rules>', rulesStart);
      assert.ok(rulesStart !== -1 && rulesEnd !== -1, '<critical_rules> block must be complete');
      const rulesBlock = content.slice(rulesStart, rulesEnd);
      assert.ok(
        rulesBlock.includes('re-read') || rulesBlock.includes('re read'),
        'critical_rules must include a no-re-read rule'
      );
    });

    test('critical_rules appears before success_criteria', () => {
      const rulesIdx = content.indexOf('<critical_rules>');
      const successIdx = content.lastIndexOf('<success_criteria>');
      assert.ok(rulesIdx !== -1 && successIdx !== -1, 'both sections must exist');
      assert.ok(
        rulesIdx < successIdx,
        '<critical_rules> must appear before <success_criteria>'
      );
    });
  });

});
