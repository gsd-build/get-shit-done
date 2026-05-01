'use strict';

// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('debug session management implementation', () => {
  test('DEBUG.md template contains reasoning_checkpoint field', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'get-shit-done/templates/DEBUG.md'),
      'utf8'
    );
    assert.ok(content.includes('reasoning_checkpoint'), 'DEBUG.md must contain reasoning_checkpoint field');
  });

  test('DEBUG.md template contains tdd_checkpoint field', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'get-shit-done/templates/DEBUG.md'),
      'utf8'
    );
    assert.ok(content.includes('tdd_checkpoint'), 'DEBUG.md must contain tdd_checkpoint field');
  });

  test('debug command contains list subcommand logic', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'commands/gsd/debug.md'),
      'utf8'
    );
    assert.ok(
      content.includes('SUBCMD=list') || content.includes('"list"'),
      'debug.md must contain list subcommand logic'
    );
  });

  test('debug command contains continue subcommand logic', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'commands/gsd/debug.md'),
      'utf8'
    );
    assert.ok(
      content.includes('SUBCMD=continue') || content.includes('"continue"'),
      'debug.md must contain continue subcommand logic'
    );
  });

  test('debug command contains status subcommand logic', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'commands/gsd/debug.md'),
      'utf8'
    );
    assert.ok(
      content.includes('SUBCMD=status') || content.includes('"status"'),
      'debug.md must contain status subcommand logic'
    );
  });

  test('debug command contains TDD gate logic', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'commands/gsd/debug.md'),
      'utf8'
    );
    assert.ok(
      content.includes('TDD_MODE') || content.includes('tdd_mode'),
      'debug.md must contain TDD gate logic'
    );
  });

  test('debug.md reads tdd_mode via workflow.tdd_mode key (not bare tdd_mode)', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'commands/gsd/debug.md'),
      'utf8'
    );
    assert.ok(
      !content.includes('config-get tdd_mode'),
      'debug.md must not use bare "tdd_mode" key — use "workflow.tdd_mode" to match every other consumer'
    );
    assert.ok(
      content.includes('config-get workflow.tdd_mode'),
      'debug.md must read tdd_mode via the "workflow.tdd_mode" key'
    );
  });

  test('debug command contains security hardening', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'commands/gsd/debug.md'),
      'utf8'
    );
    assert.ok(content.includes('DATA_START'), 'debug.md must contain DATA_START injection boundary marker');
  });

  test('debug command surfaces next_action before spawn', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'commands/gsd/debug.md'),
      'utf8'
    );
    assert.ok(
      content.includes('[debug] Next:') || content.includes('next_action'),
      'debug.md must surface next_action before agent spawn'
    );
  });

  test('gsd-debugger contains structured reasoning checkpoint', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'agents/gsd-debugger.md'),
      'utf8'
    );
    assert.ok(content.includes('reasoning_checkpoint'), 'gsd-debugger.md must contain reasoning_checkpoint');
  });

  test('gsd-debugger contains TDD checkpoint mode', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'agents/gsd-debugger.md'),
      'utf8'
    );
    assert.ok(content.includes('tdd_mode'), 'gsd-debugger.md must contain tdd_mode');
    assert.ok(content.includes('TDD CHECKPOINT'), 'gsd-debugger.md must contain TDD CHECKPOINT return format');
  });

  test('gsd-debugger contains delta debugging technique', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'agents/gsd-debugger.md'),
      'utf8'
    );
    assert.ok(content.includes('Delta Debugging'), 'gsd-debugger.md must contain Delta Debugging technique');
  });

  test('gsd-debugger contains security note about DATA_START', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'agents/gsd-debugger.md'),
      'utf8'
    );
    assert.ok(content.includes('DATA_START'), 'gsd-debugger.md must contain DATA_START security reference');
  });
});

// Tests for #2148 and #2151
describe('debug skill dispatch and sub-orchestrator (#2148, #2151)', () => {
  test('gsd-debugger ROOT CAUSE FOUND format includes specialist_hint field', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'agents', 'gsd-debugger.md'), 'utf8');
    assert.ok(content.includes('specialist_hint'), 'gsd-debugger missing specialist_hint in ROOT CAUSE FOUND');
    assert.ok(content.includes('swift_concurrency'), 'gsd-debugger missing specialist_hint derivation guidance');
  });

  test('debug.md orchestrator has specialist skill dispatch step', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'commands', 'gsd', 'debug.md'), 'utf8');
    assert.ok(content.includes('specialist_hint'), 'debug.md missing specialist dispatch logic');
    assert.ok(content.includes('typescript-expert'), 'debug.md missing skill dispatch mapping');
  });

  test('debug.md specialist dispatch prompt uses DATA_START/DATA_END boundaries', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'commands', 'gsd', 'debug.md'), 'utf8');
    assert.ok(content.includes('DATA_START') && content.includes('DATA_END'),
      'debug.md specialist dispatch prompt missing security boundaries');
  });

  test('gsd-debug-session-manager agent exists with correct tools', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'agents', 'gsd-debug-session-manager.md'), 'utf8');
    assert.ok(content.includes('Task'), 'gsd-debug-session-manager missing Task tool');
    assert.ok(content.includes('AskUserQuestion'), 'gsd-debug-session-manager missing AskUserQuestion tool');
  });

  test('gsd-debug-session-manager uses DATA_START/DATA_END for checkpoint responses', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'agents', 'gsd-debug-session-manager.md'), 'utf8');
    assert.ok(content.includes('DATA_START') && content.includes('DATA_END'),
      'gsd-debug-session-manager missing security boundaries on checkpoint responses');
  });

  test('gsd-debug-session-manager has compact summary output format', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'agents', 'gsd-debug-session-manager.md'), 'utf8');
    assert.ok(content.includes('DEBUG SESSION COMPLETE'), 'session manager missing compact summary format');
  });

  test('gsd-debug-session-manager includes anti-heredoc rule', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'agents', 'gsd-debug-session-manager.md'), 'utf8');
    assert.ok(content.includes('heredoc'), 'session manager missing anti-heredoc rule');
  });

  test('debug.md delegates to gsd-debug-session-manager', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'commands', 'gsd', 'debug.md'), 'utf8');
    assert.ok(content.includes('gsd-debug-session-manager'),
      'debug.md does not delegate to session manager');
  });
});
