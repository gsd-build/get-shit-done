'use strict';

// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('quick session management (#2155)', () => {
  const quickCmd = fs.readFileSync(
    path.join(__dirname, '..', 'commands', 'gsd', 'quick.md'),
    'utf8'
  );

  test('quick command has list subcommand', () => {
    assert.ok(quickCmd.includes('SUBCMD=list'), 'missing list subcommand routing');
  });

  test('quick command has status subcommand', () => {
    assert.ok(quickCmd.includes('SUBCMD=status'), 'missing status subcommand routing');
  });

  test('quick command has resume subcommand', () => {
    assert.ok(quickCmd.includes('SUBCMD=resume'), 'missing resume subcommand routing');
  });

  test('quick command has slug sanitization', () => {
    assert.ok(
      quickCmd.includes('sanitiz') || quickCmd.includes('[a-z0-9'),
      'missing slug sanitization'
    );
  });

  test('quick command has security_notes section', () => {
    assert.ok(quickCmd.includes('security_notes'), 'missing security_notes section');
  });

  test('quick command list subcommand stops after display', () => {
    assert.ok(
      quickCmd.includes('STOP after displaying the list'),
      'list subcommand should stop after display'
    );
  });

  test('quick command rejects slugs with path traversal', () => {
    assert.ok(
      quickCmd.includes('..') && quickCmd.includes('reject'),
      'missing path traversal rejection for slugs'
    );
  });

  test('quick command sanitizes directory names for display', () => {
    assert.ok(
      quickCmd.includes('non-printable') || quickCmd.includes('ANSI'),
      'missing directory name sanitization for display'
    );
  });

  test('quick command list uses frontmatter get for status', () => {
    assert.ok(
      quickCmd.includes('frontmatter get') || quickCmd.includes('frontmatter.get'),
      'list should use frontmatter get / frontmatter.get to read status'
    );
  });

  test('quick command shows complete checkmark in list', () => {
    assert.ok(
      quickCmd.includes('complete ✓') || quickCmd.includes('complete'),
      'list should show complete status'
    );
  });
});
