// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * Bug #2419: gsd-project-researcher agent type not found
 *
 * When gsd-new-project spawns gsd-project-researcher subagents, it fails with
 * "agent type not found" if the user has a local-only install (agents in
 * .claude/agents/ of a different project, not the global ~/.claude/agents/).
 *
 * Fix: new-project.md and new-milestone.md must parse agents_installed from
 * the init JSON and warn the user (rather than silently failing) when agents
 * are missing.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const NEW_PROJECT_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'new-project.md');
const NEW_MILESTONE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'new-milestone.md');
const AGENTS_DIR = path.join(__dirname, '..', 'agents');

describe('gsd-project-researcher agent registration (#2419)', () => {
  test('gsd-project-researcher.md exists in agents source dir', () => {
    const agentFile = path.join(AGENTS_DIR, 'gsd-project-researcher.md');
    assert.ok(
      fs.existsSync(agentFile),
      'agents/gsd-project-researcher.md must exist in the source agents directory'
    );
  });

  test('gsd-project-researcher.md has correct name in frontmatter', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gsd-project-researcher.md'), 'utf-8');
    assert.ok(
      content.includes('name: gsd-project-researcher'),
      'agents/gsd-project-researcher.md must have name: gsd-project-researcher in frontmatter'
    );
  });

  test('new-project.md parses agents_installed from init JSON', () => {
    const content = fs.readFileSync(NEW_PROJECT_PATH, 'utf-8');
    assert.ok(
      content.includes('agents_installed'),
      'new-project.md must parse agents_installed from the init JSON to detect missing agents'
    );
  });

  test('new-project.md warns user when agents_installed is false', () => {
    const content = fs.readFileSync(NEW_PROJECT_PATH, 'utf-8');
    assert.ok(
      content.includes('agents_installed') && content.includes('agent type not found') ||
      content.includes('agents_installed') && content.includes('missing') ||
      content.includes('agents_installed') && content.includes('not installed'),
      'new-project.md must warn the user when agents are not installed (agents_installed is false)'
    );
  });

  test('new-milestone.md parses agents_installed from init JSON', () => {
    const content = fs.readFileSync(NEW_MILESTONE_PATH, 'utf-8');
    assert.ok(
      content.includes('agents_installed'),
      'new-milestone.md must parse agents_installed from the init JSON to detect missing agents'
    );
  });

  test('new-milestone.md warns user when agents_installed is false', () => {
    const content = fs.readFileSync(NEW_MILESTONE_PATH, 'utf-8');
    assert.ok(
      content.includes('agents_installed') && (
        content.includes('agent type not found') ||
        content.includes('missing') ||
        content.includes('not installed')
      ),
      'new-milestone.md must warn the user when agents are not installed (agents_installed is false)'
    );
  });

  test('new-project.md lists gsd-project-researcher in available_agent_types', () => {
    const content = fs.readFileSync(NEW_PROJECT_PATH, 'utf-8');
    const agentTypesMatch = content.match(/<available_agent_types>([\s\S]*?)<\/available_agent_types>/);
    assert.ok(agentTypesMatch, 'new-project.md must have <available_agent_types> section');
    assert.ok(
      agentTypesMatch[1].includes('gsd-project-researcher'),
      'new-project.md <available_agent_types> must list gsd-project-researcher'
    );
  });

  test('new-milestone.md lists gsd-project-researcher in available_agent_types', () => {
    const content = fs.readFileSync(NEW_MILESTONE_PATH, 'utf-8');
    const agentTypesMatch = content.match(/<available_agent_types>([\s\S]*?)<\/available_agent_types>/);
    assert.ok(agentTypesMatch, 'new-milestone.md must have <available_agent_types> section');
    assert.ok(
      agentTypesMatch[1].includes('gsd-project-researcher'),
      'new-milestone.md <available_agent_types> must list gsd-project-researcher'
    );
  });
});
