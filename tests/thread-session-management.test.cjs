'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('thread session management (#2156)', () => {
  const threadCmd = fs.readFileSync(
    path.join(__dirname, '..', 'commands', 'gsd', 'thread.md'),
    'utf8'
  );

  test('thread command has list subcommand with status filter', () => {
    assert.ok(
      threadCmd.includes('list --open') || threadCmd.includes('LIST-OPEN'),
      'missing list --open filter'
    );
  });

  test('thread command has close subcommand', () => {
    assert.ok(
      threadCmd.includes('CLOSE') || threadCmd.includes('close <slug>'),
      'missing close subcommand'
    );
  });

  test('thread command has status subcommand', () => {
    assert.ok(
      threadCmd.includes('STATUS') || threadCmd.includes('status <slug>'),
      'missing status subcommand'
    );
  });

  test('thread command does not use heredoc', () => {
    assert.ok(
      !threadCmd.includes("<< 'EOF'") && !threadCmd.includes('<< EOF'),
      'thread command still uses heredoc — injection risk'
    );
  });

  test('thread template includes frontmatter status field', () => {
    assert.ok(
      threadCmd.includes('status: open') || threadCmd.includes('status:'),
      'thread template missing frontmatter status field'
    );
  });

  test('thread command has security_notes section', () => {
    assert.ok(threadCmd.includes('security_notes'), 'missing security_notes section');
  });

  test('thread command has slug sanitization', () => {
    assert.ok(
      threadCmd.includes('sanitiz') || threadCmd.includes('[a-z0-9'),
      'missing slug sanitization'
    );
  });

  test('thread command uses Write tool for file creation', () => {
    assert.ok(
      threadCmd.includes('Write tool'),
      'thread create mode should use the Write tool instead of heredoc'
    );
  });

  test('thread command list reads frontmatter status', () => {
    assert.ok(
      threadCmd.includes('frontmatter get'),
      'list mode should read status via frontmatter get'
    );
  });

  test('thread command close updates status to resolved', () => {
    assert.ok(
      threadCmd.includes('resolved'),
      'close mode should set status to resolved'
    );
  });

  test('thread command list shows resolved filter option', () => {
    assert.ok(
      threadCmd.includes('list --resolved') || threadCmd.includes('LIST-RESOLVED'),
      'missing list --resolved filter'
    );
  });

  test('thread command rejects slugs with path traversal', () => {
    assert.ok(
      threadCmd.includes('..') && threadCmd.includes('reject'),
      'missing path traversal rejection for slugs'
    );
  });

  test('thread create uses frontmatter with slug title status created updated fields', () => {
    assert.ok(
      threadCmd.includes('slug:') &&
      threadCmd.includes('title:') &&
      threadCmd.includes('status:') &&
      threadCmd.includes('created:') &&
      threadCmd.includes('updated:'),
      'thread template missing required frontmatter fields'
    );
  });
});
