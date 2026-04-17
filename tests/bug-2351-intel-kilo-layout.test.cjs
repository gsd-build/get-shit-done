/**
 * Regression test for bug #2351
 *
 * gsd-intel-updater used hardcoded canonical paths (`agents/*.md`,
 * `commands/gsd/*.md`, `hooks/*.js`, etc.) that assumed the standard
 * `.claude/` runtime layout. Under a `.kilo` install, the runtime root is
 * `.kilo/`, and the command directory is `command/` (not `commands/gsd/`).
 * Globs against the old paths returned no results, producing semantically
 * empty intel files (`"entries": {}`).
 *
 * Fix: add runtime layout detection and a mapping table so the agent
 * resolves paths against the correct root.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const AGENT_PATH = path.join(__dirname, '..', 'agents', 'gsd-intel-updater.md');

describe('bug #2351: intel updater kilo layout support', () => {
  let content;

  test('agent file exists', () => {
    assert.ok(fs.existsSync(AGENT_PATH), 'agents/gsd-intel-updater.md must exist');
    content = fs.readFileSync(AGENT_PATH, 'utf-8');
  });

  test('scope section includes layout detection step', () => {
    content = content || fs.readFileSync(AGENT_PATH, 'utf-8');
    const hasDetection =
      content.includes('ls -d .kilo') ||
      content.includes('Runtime layout detection') ||
      content.includes('detected layout') ||
      content.includes('layout detection');
    assert.ok(
      hasDetection,
      'gsd-intel-updater.md must instruct the agent to detect the runtime layout ' +
      '(.kilo vs .claude) before resolving canonical paths (#2351)'
    );
  });

  test('scope section maps .kilo/agents path', () => {
    content = content || fs.readFileSync(AGENT_PATH, 'utf-8');
    assert.ok(
      content.includes('.kilo/agents'),
      'scope section must include the .kilo/agents/*.md path so agent count is correct under kilo layout'
    );
  });

  test('scope section maps .kilo/command path (not commands/gsd)', () => {
    content = content || fs.readFileSync(AGENT_PATH, 'utf-8');
    assert.ok(
      content.includes('.kilo/command'),
      'scope section must include .kilo/command path — kilo uses "command/" not "commands/gsd/"'
    );
  });

  test('scope section maps .kilo/hooks path', () => {
    content = content || fs.readFileSync(AGENT_PATH, 'utf-8');
    assert.ok(
      content.includes('.kilo/hooks'),
      'scope section must include .kilo/hooks path for hook file counts'
    );
  });

  test('scope section retains standard layout paths for .claude installs', () => {
    content = content || fs.readFileSync(AGENT_PATH, 'utf-8');
    assert.ok(
      content.includes('agents/*.md') || content.includes('Standard `.claude` layout'),
      'scope section must still document the standard .claude layout paths for non-kilo installs'
    );
  });
});
