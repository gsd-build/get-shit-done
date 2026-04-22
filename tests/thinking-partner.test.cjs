const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

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
    test('features.thinking_partner is in VALID_CONFIG_KEYS', () => {
      const configSrc = fs.readFileSync(
        path.join(GSD_ROOT, 'bin', 'lib', 'config-schema.cjs'),
        'utf-8'
      );
      assert.ok(
        configSrc.includes("'features.thinking_partner'"),
        'VALID_CONFIG_KEYS should contain features.thinking_partner'
      );
    });

    test('features is in KNOWN_TOP_LEVEL section containers', () => {
      const coreSrc = fs.readFileSync(
        path.join(GSD_ROOT, 'bin', 'lib', 'core.cjs'),
        'utf-8'
      );
      // The KNOWN_TOP_LEVEL set should include 'features' in section containers
      assert.ok(
        coreSrc.includes("'features'"),
        'KNOWN_TOP_LEVEL should contain features as a section container'
      );
    });
  });

  // Workflow integration tests
  describe('Discuss-phase integration', () => {
    test('discuss-phase.md contains thinking partner conditional block', () => {
      const content = fs.readFileSync(
        path.join(GSD_ROOT, 'workflows', 'discuss-phase.md'),
        'utf-8'
      );
      assert.ok(
        content.includes('Thinking partner (conditional)'),
        'discuss-phase.md should contain thinking partner conditional block'
      );
    });

    test('discuss-phase references features.thinking_partner config', () => {
      const content = fs.readFileSync(
        path.join(GSD_ROOT, 'workflows', 'discuss-phase.md'),
        'utf-8'
      );
      assert.ok(
        content.includes('features.thinking_partner'),
        'discuss-phase.md should reference the config key'
      );
    });

    test('discuss-phase references thinking-partner.md for signal list', () => {
      const content = fs.readFileSync(
        path.join(GSD_ROOT, 'workflows', 'discuss-phase.md'),
        'utf-8'
      );
      assert.ok(
        content.includes('references/thinking-partner.md'),
        'discuss-phase.md should reference the signal list doc'
      );
    });

    test('discuss-phase offers skip option', () => {
      const content = fs.readFileSync(
        path.join(GSD_ROOT, 'workflows', 'discuss-phase.md'),
        'utf-8'
      );
      assert.ok(
        content.includes('No, decision made'),
        'discuss-phase.md should offer a skip/decline option'
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
