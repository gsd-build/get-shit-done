/**
 * Common Bug Patterns Reference Tests
 *
 * Structural tests for the common-bug-patterns.md reference file:
 * - File exists at expected path
 * - Contains expected bug pattern categories (at least 5 of 10)
 * - Debugger agent references the file in required_reading
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REFERENCE_PATH = path.join(
  __dirname, '..', 'get-shit-done', 'references', 'common-bug-patterns.md'
);
const DEBUGGER_AGENT_PATH = path.join(
  __dirname, '..', 'agents', 'gsd-debugger.md'
);

const EXPECTED_CATEGORIES = [
  'Off-by-One',
  'Null',
  'Async',
  'State Management',
  'Import',
  'Environment',
  'Data Shape',
  'String Handling',
  'File System',
  'Error Handling',
];

describe('common-bug-patterns.md reference', () => {
  test('reference file exists', () => {
    assert.ok(
      fs.existsSync(REFERENCE_PATH),
      `Expected reference file at ${REFERENCE_PATH}`
    );
  });

  test('has title and intro', () => {
    const content = fs.readFileSync(REFERENCE_PATH, 'utf-8');
    assert.ok(
      content.startsWith('# Common Bug Patterns'),
      'File should start with "# Common Bug Patterns" title'
    );
    assert.ok(
      content.includes('---'),
      'File should contain --- separator after intro'
    );
  });

  test('contains at least 5 of 10 expected categories', () => {
    const content = fs.readFileSync(REFERENCE_PATH, 'utf-8');
    const found = EXPECTED_CATEGORIES.filter(cat =>
      content.toLowerCase().includes(cat.toLowerCase())
    );
    assert.ok(
      found.length >= 5,
      `Expected at least 5 categories, found ${found.length}: ${found.join(', ')}`
    );
  });

  test('each pattern category has at least one bold bullet item', () => {
    const content = fs.readFileSync(REFERENCE_PATH, 'utf-8');
    // Only check sections inside <patterns> block, not <usage>
    const patternsBlock = (content.split('<patterns>')[1] || '').split('</patterns>')[0];
    const sections = patternsBlock.split(/^## /m).slice(1);
    assert.ok(sections.length >= 5, `Expected at least 5 pattern sections, got ${sections.length}`);
    for (const section of sections) {
      const title = section.split('\n')[0].trim();
      const bullets = section.match(/^- \*\*/gm);
      assert.ok(
        bullets && bullets.length >= 1,
        `Pattern section "${title}" should have at least one "- **" bullet item`
      );
    }
  });
});

describe('debugger agent references bug patterns', () => {
  test('gsd-debugger.md exists', () => {
    assert.ok(
      fs.existsSync(DEBUGGER_AGENT_PATH),
      `Expected debugger agent at ${DEBUGGER_AGENT_PATH}`
    );
  });

  test('gsd-debugger.md references common-bug-patterns.md', () => {
    const content = fs.readFileSync(DEBUGGER_AGENT_PATH, 'utf-8');
    assert.ok(
      content.includes('common-bug-patterns.md'),
      'Debugger agent should reference common-bug-patterns.md'
    );
  });

  test('reference is inside <required_reading> block', () => {
    const content = fs.readFileSync(DEBUGGER_AGENT_PATH, 'utf-8');
    const reqReadMatch = content.match(
      /<required_reading>([\s\S]*?)<\/required_reading>/
    );
    assert.ok(reqReadMatch, 'Debugger agent should have a <required_reading> block');
    assert.ok(
      reqReadMatch[1].includes('common-bug-patterns.md'),
      'common-bug-patterns.md should be inside <required_reading> block'
    );
  });
});
