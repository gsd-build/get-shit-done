const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'config.cjs');
const EXECUTE_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
const CONFIG_TEMPLATE_PATH = path.join(__dirname, '..', 'get-shit-done', 'templates', 'config.json');

describe('cross-AI execution', () => {

  describe('config keys', () => {
    test('workflow.cross_ai_execution is in VALID_CONFIG_KEYS', () => {
      const { VALID_CONFIG_KEYS } = require(CONFIG_PATH);
      assert.ok(VALID_CONFIG_KEYS.has('workflow.cross_ai_execution'),
        'VALID_CONFIG_KEYS must include workflow.cross_ai_execution');
    });

    test('workflow.cross_ai_command is in VALID_CONFIG_KEYS', () => {
      const { VALID_CONFIG_KEYS } = require(CONFIG_PATH);
      assert.ok(VALID_CONFIG_KEYS.has('workflow.cross_ai_command'),
        'VALID_CONFIG_KEYS must include workflow.cross_ai_command');
    });

    test('workflow.cross_ai_timeout is in VALID_CONFIG_KEYS', () => {
      const { VALID_CONFIG_KEYS } = require(CONFIG_PATH);
      assert.ok(VALID_CONFIG_KEYS.has('workflow.cross_ai_timeout'),
        'VALID_CONFIG_KEYS must include workflow.cross_ai_timeout');
    });
  });

  describe('config template defaults', () => {
    test('config template has cross_ai_execution default', () => {
      const template = JSON.parse(fs.readFileSync(CONFIG_TEMPLATE_PATH, 'utf-8'));
      assert.strictEqual(template.workflow.cross_ai_execution, false,
        'cross_ai_execution should default to false');
    });

    test('config template has cross_ai_command default', () => {
      const template = JSON.parse(fs.readFileSync(CONFIG_TEMPLATE_PATH, 'utf-8'));
      assert.strictEqual(template.workflow.cross_ai_command, '',
        'cross_ai_command should default to empty string');
    });

    test('config template has cross_ai_timeout default', () => {
      const template = JSON.parse(fs.readFileSync(CONFIG_TEMPLATE_PATH, 'utf-8'));
      assert.strictEqual(template.workflow.cross_ai_timeout, 300,
        'cross_ai_timeout should default to 300 seconds');
    });
  });

  describe('execute-phase.md cross-AI step', () => {
    let content;

    test('execute-phase.md has a cross-AI execution step', () => {
      content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
      assert.ok(content.includes('<step name="cross_ai_delegation">'),
        'execute-phase.md must have a step named cross_ai_delegation');
    });

    test('cross-AI step appears between discover_and_group_plans and execute_waves', () => {
      content = content || fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
      const discoverIdx = content.indexOf('<step name="discover_and_group_plans">');
      const crossAiIdx = content.indexOf('<step name="cross_ai_delegation">');
      const executeIdx = content.indexOf('<step name="execute_waves">');
      assert.ok(discoverIdx < crossAiIdx, 'cross_ai_delegation must come after discover_and_group_plans');
      assert.ok(crossAiIdx < executeIdx, 'cross_ai_delegation must come before execute_waves');
    });

    test('cross-AI step handles --cross-ai flag', () => {
      content = content || fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
      assert.ok(content.includes('--cross-ai'),
        'execute-phase.md must reference --cross-ai flag');
    });

    test('cross-AI step handles --no-cross-ai flag', () => {
      content = content || fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
      assert.ok(content.includes('--no-cross-ai'),
        'execute-phase.md must reference --no-cross-ai flag');
    });

    test('cross-AI step uses stdin-based prompt delivery', () => {
      content = content || fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
      // The step must describe piping prompt via stdin, not shell interpolation
      assert.ok(content.includes('stdin'),
        'cross-AI step must describe stdin-based prompt delivery');
    });

    test('cross-AI step validates summary output', () => {
      content = content || fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
      // The step must describe validating the captured summary
      const crossAiSection = content.substring(
        content.indexOf('<step name="cross_ai_delegation">'),
        content.indexOf('</step>', content.indexOf('<step name="cross_ai_delegation">')) + '</step>'.length
      );
      assert.ok(
        crossAiSection.includes('SUMMARY') && crossAiSection.includes('valid'),
        'cross-AI step must validate the summary output'
      );
    });

    test('cross-AI step warns about dirty working tree', () => {
      content = content || fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
      const crossAiSection = content.substring(
        content.indexOf('<step name="cross_ai_delegation">'),
        content.indexOf('</step>', content.indexOf('<step name="cross_ai_delegation">')) + '</step>'.length
      );
      assert.ok(
        crossAiSection.includes('dirty') || crossAiSection.includes('uncommitted') || crossAiSection.includes('working tree'),
        'cross-AI step must warn about dirty/uncommitted changes from external command'
      );
    });

    test('cross-AI step reads cross_ai_command from config', () => {
      content = content || fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
      const crossAiSection = content.substring(
        content.indexOf('<step name="cross_ai_delegation">'),
        content.indexOf('</step>', content.indexOf('<step name="cross_ai_delegation">')) + '</step>'.length
      );
      assert.ok(
        crossAiSection.includes('cross_ai_command'),
        'cross-AI step must read cross_ai_command from config'
      );
    });

    test('cross-AI step reads cross_ai_timeout from config', () => {
      content = content || fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
      const crossAiSection = content.substring(
        content.indexOf('<step name="cross_ai_delegation">'),
        content.indexOf('</step>', content.indexOf('<step name="cross_ai_delegation">')) + '</step>'.length
      );
      assert.ok(
        crossAiSection.includes('cross_ai_timeout'),
        'cross-AI step must read cross_ai_timeout from config'
      );
    });

    test('cross-AI step handles failure with retry/skip/abort', () => {
      content = content || fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
      const crossAiSection = content.substring(
        content.indexOf('<step name="cross_ai_delegation">'),
        content.indexOf('</step>', content.indexOf('<step name="cross_ai_delegation">')) + '</step>'.length
      );
      assert.ok(crossAiSection.includes('retry'), 'cross-AI step must offer retry on failure');
      assert.ok(crossAiSection.includes('skip'), 'cross-AI step must offer skip on failure');
      assert.ok(crossAiSection.includes('abort'), 'cross-AI step must offer abort on failure');
    });

    test('cross-AI step skips normal executor for handled plans', () => {
      content = content || fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
      const crossAiSection = content.substring(
        content.indexOf('<step name="cross_ai_delegation">'),
        content.indexOf('</step>', content.indexOf('<step name="cross_ai_delegation">')) + '</step>'.length
      );
      assert.ok(
        crossAiSection.includes('skip') && (crossAiSection.includes('executor') || crossAiSection.includes('execute_waves')),
        'cross-AI step must describe skipping normal executor for cross-AI handled plans'
      );
    });

    test('parse_args step includes --cross-ai and --no-cross-ai', () => {
      content = content || fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
      const parseArgsSection = content.substring(
        content.indexOf('<step name="parse_args"'),
        content.indexOf('</step>', content.indexOf('<step name="parse_args"')) + '</step>'.length
      );
      assert.ok(parseArgsSection.includes('--cross-ai'),
        'parse_args step must parse --cross-ai flag');
      assert.ok(parseArgsSection.includes('--no-cross-ai'),
        'parse_args step must parse --no-cross-ai flag');
    });
  });
});
