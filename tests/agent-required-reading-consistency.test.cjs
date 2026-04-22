/**
 * GSD Agent Required Reading Consistency Tests
 *
 * Validates that all agent .md files use the standardized <required_reading>
 * pattern and that no legacy <files_to_read> blocks remain.
 *
 * See: https://github.com/gsd-build/get-shit-done/issues/2168
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '..', 'agents');

const ALL_AGENTS = fs.readdirSync(AGENTS_DIR)
  .filter(f => f.startsWith('gsd-') && f.endsWith('.md'))
  .map(f => f.replace('.md', ''));

// ─── No Legacy files_to_read Blocks ────────────────────────────────────────

describe('READING: no legacy <files_to_read> blocks remain', () => {
  for (const agent of ALL_AGENTS) {
    test(`${agent} does not contain <files_to_read>`, () => {
      const content = fs.readFileSync(path.join(AGENTS_DIR, agent + '.md'), 'utf-8');
      assert.ok(
        !content.includes('<files_to_read>'),
        `${agent} still has <files_to_read> opening tag — migrate to <required_reading>`
      );
      assert.ok(
        !content.includes('</files_to_read>'),
        `${agent} still has </files_to_read> closing tag — migrate to </required_reading>`
      );
    });
  }

  test('no backtick references to files_to_read in any agent', () => {
    for (const agent of ALL_AGENTS) {
      const content = fs.readFileSync(path.join(AGENTS_DIR, agent + '.md'), 'utf-8');
      assert.ok(
        !content.includes('`<files_to_read>`'),
        `${agent} still references \`<files_to_read>\` in prose — update to \`<required_reading>\``
      );
    }
  });
});

// ─── Standardized required_reading Pattern ─────────────────────────────────

describe('READING: agents with reading blocks use <required_reading>', () => {
  // Agents that have any kind of reading instruction should use required_reading
  const AGENTS_WITH_READING = ALL_AGENTS.filter(name => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, name + '.md'), 'utf-8');
    return content.includes('required_reading') || content.includes('files_to_read');
  });

  test('at least 20 agents have reading instructions', () => {
    assert.ok(
      AGENTS_WITH_READING.length >= 20,
      `Expected at least 20 agents with reading instructions, found ${AGENTS_WITH_READING.length}`
    );
  });

  for (const agent of AGENTS_WITH_READING) {
    test(`${agent} uses required_reading (not files_to_read)`, () => {
      const content = fs.readFileSync(path.join(AGENTS_DIR, agent + '.md'), 'utf-8');
      assert.ok(
        content.includes('required_reading'),
        `${agent} has reading instructions but does not use required_reading`
      );
      assert.ok(
        !content.includes('files_to_read'),
        `${agent} still uses files_to_read — must be migrated to required_reading`
      );
    });
  }
});
