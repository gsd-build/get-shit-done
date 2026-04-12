'use strict';

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
