// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const GSD_ROOT = path.join(__dirname, '..', 'get-shit-done');

describe('Thinking Partner Integration (#1726)', () => {
  // Reference doc tests
  describe('Reference document', () => {
    const refPath = path.join(GSD_ROOT, 'references', 'thinking-partner.md');

    test('thinking-partner.md exists', () => {
      assert.ok(fs.existsSync(refPath), 'references/thinking-partner.md should exist');
    });

    test('documents all 3 integration points', () => {
      const content = fs.readFileSync(refPath, 'utf-8');
      assert.ok(content.includes('### 1. Discuss Phase'), 'should document Discuss Phase integration');
      assert.ok(content.includes('### 2. Plan Phase'), 'should document Plan Phase integration');
      assert.ok(content.includes('### 3. Explore'), 'should document Explore integration');
    });

    test('documents keyword tradeoff signals', () => {
      const content = fs.readFileSync(refPath, 'utf-8');
      assert.ok(content.includes('"or"'), 'should list "or" as keyword signal');
      assert.ok(content.includes('"versus"'), 'should list "versus" as keyword signal');
      assert.ok(content.includes('"tradeoff"'), 'should list "tradeoff" as keyword signal');
      assert.ok(content.includes('"pros and cons"'), 'should list "pros and cons" as keyword signal');
      assert.ok(content.includes('"torn between"'), 'should list "torn between" as keyword signal');
    });

    test('documents structural tradeoff signals', () => {
      const content = fs.readFileSync(refPath, 'utf-8');
      assert.ok(content.includes('2+ competing options'), 'should list competing options signal');
      assert.ok(content.includes('which is better'), 'should list "which is better" signal');
      assert.ok(content.includes('reverses a previous decision'), 'should list decision reversal signal');
    });

    test('documents when NOT to activate', () => {
      const content = fs.readFileSync(refPath, 'utf-8');
      assert.ok(content.includes('When NOT to activate'), 'should document non-activation cases');
      assert.ok(content.includes('already made a clear choice'), 'should mention clear choices');
    });

    test('feature is opt-in with default false', () => {
      const content = fs.readFileSync(refPath, 'utf-8');
      assert.ok(content.includes('Default: `false`'), 'should document default as false');
      assert.ok(content.includes('opt-in'), 'should describe feature as opt-in');
    });

    test('documents design principles', () => {
      const content = fs.readFileSync(refPath, 'utf-8');
      assert.ok(content.includes('Lightweight'), 'should list Lightweight principle');
      assert.ok(content.includes('Opt-in'), 'should list Opt-in principle');
      assert.ok(content.includes('Skippable'), 'should list Skippable principle');
      assert.ok(content.includes('Brief'), 'should list Brief principle');
      assert.ok(content.includes('Aligned'), 'should list Aligned principle');
    });

    test('explore integration deferred to #1729', () => {
      const content = fs.readFileSync(refPath, 'utf-8');
      assert.ok(content.includes('#1729'), 'should reference issue #1729 for explore integration');
    });
  });

  // Config tests
  describe('Config integration', () => {
    test('config-set accepts features.thinking_partner', () => {
      // Exercises VALID_CONFIG_KEYS membership and KNOWN_TOP_LEVEL acceptance in one call.
      // Replaces two source-grep tests that read config-schema.cjs and core.cjs (see #2691).
      const tmpDir = createTempProject();
      try {
        const setResult = runGsdTools('config-set features.thinking_partner true', tmpDir);
        assert.ok(setResult.success, `config-set should accept features.thinking_partner: ${setResult.error}`);
        const configPath = path.join(tmpDir, '.planning', 'config.json');
        assert.ok(fs.existsSync(configPath), 'config-set should create .planning/config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        assert.strictEqual(
          config.features?.thinking_partner,
          true,
          'config-set should persist features.thinking_partner=true'
        );
      } finally {
        cleanup(tmpDir);
      }
    });
  });

  // Workflow integration tests
  // After #2551 progressive-disclosure refactor, the thinking-partner block
  // moved into the per-mode files (default.md, advisor.md) since the prompt
  // is mode-specific (only fires inside discuss_areas, after a user answer).
  describe('Discuss-phase integration', () => {
    function readDiscussFamily() {
      const candidates = [
        path.join(GSD_ROOT, 'workflows', 'discuss-phase.md'),
        path.join(GSD_ROOT, 'workflows', 'discuss-phase', 'modes', 'default.md'),
        path.join(GSD_ROOT, 'workflows', 'discuss-phase', 'modes', 'advisor.md'),
      ];
      return candidates
        .filter(p => fs.existsSync(p))
        .map(p => fs.readFileSync(p, 'utf-8'))
        .join('\n');
    }

    test('discuss-phase.md contains thinking partner conditional block', () => {
      const content = readDiscussFamily();
      assert.ok(
        content.includes('Thinking partner (conditional)'),
        'discuss-phase workflow family should contain thinking partner conditional block'
      );
    });

    test('discuss-phase references features.thinking_partner config', () => {
      const content = readDiscussFamily();
      assert.ok(
        content.includes('features.thinking_partner'),
        'discuss-phase workflow family should reference the config key'
      );
    });

    test('discuss-phase references thinking-partner.md for signal list', () => {
      const content = readDiscussFamily();
      assert.ok(
        content.includes('references/thinking-partner.md'),
        'discuss-phase workflow family should reference the signal list doc'
      );
    });

    test('discuss-phase offers skip option', () => {
      const content = readDiscussFamily();
      assert.ok(
        content.includes('No, decision made'),
        'discuss-phase workflow family should offer a skip/decline option'
      );
    });
  });

  describe('Plan-phase integration', () => {
    test('plan-phase.md contains thinking partner conditional block', () => {
      const content = fs.readFileSync(
        path.join(GSD_ROOT, 'workflows', 'plan-phase.md'),
        'utf-8'
      );
      assert.ok(
        content.includes('Thinking partner for architectural tradeoffs (conditional)'),
        'plan-phase.md should contain thinking partner conditional block'
      );
    });

    test('plan-phase references features.thinking_partner config', () => {
      const content = fs.readFileSync(
        path.join(GSD_ROOT, 'workflows', 'plan-phase.md'),
        'utf-8'
      );
      assert.ok(
        content.includes('features.thinking_partner'),
        'plan-phase.md should reference the config key'
      );
    });

    test('plan-phase scans for architectural tradeoff keywords', () => {
      const content = fs.readFileSync(
        path.join(GSD_ROOT, 'workflows', 'plan-phase.md'),
        'utf-8'
      );
      assert.ok(
        content.includes('"architecture"'),
        'plan-phase.md should list architecture as a keyword'
      );
      assert.ok(
        content.includes('"approach"'),
        'plan-phase.md should list approach as a keyword'
      );
      assert.ok(
        content.includes('"alternative"'),
        'plan-phase.md should list alternative as a keyword'
      );
    });

    test('plan-phase offers skip option', () => {
      const content = fs.readFileSync(
        path.join(GSD_ROOT, 'workflows', 'plan-phase.md'),
        'utf-8'
      );
      assert.ok(
        content.includes("No, I'll decide"),
        'plan-phase.md should offer a skip/decline option'
      );
    });

    test('plan-phase block is between step 11 and step 12', () => {
      const content = fs.readFileSync(
        path.join(GSD_ROOT, 'workflows', 'plan-phase.md'),
        'utf-8'
      );
      const step11Idx = content.indexOf('## 11. Handle Checker Return');
      const thinkingIdx = content.indexOf('Thinking partner for architectural tradeoffs');
      const step12Idx = content.indexOf('## 12. Revision Loop');
      assert.ok(step11Idx < thinkingIdx, 'thinking partner block should come after step 11');
      assert.ok(thinkingIdx < step12Idx, 'thinking partner block should come before step 12');
    });
  });
});
