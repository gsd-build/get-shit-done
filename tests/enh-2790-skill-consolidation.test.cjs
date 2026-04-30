// allow-test-rule: source-text-is-the-product
// commands/gsd/*.md files ARE what the runtime loads — testing their
// existence/non-existence tests the deployed skill surface contract.

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');

/**
 * Parse the YAML frontmatter from a skill .md file.
 * Returns an object with the frontmatter fields as strings.
 * Only handles simple scalar and array values needed by these tests.
 */
function parseFrontmatter(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  if (lines[0].trim() !== '---') return {};
  const endIdx = lines.indexOf('---', 1);
  if (endIdx === -1) return {};
  const fmLines = lines.slice(1, endIdx);
  const result = {};
  let currentKey = null;
  for (const line of fmLines) {
    const kvMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      result[currentKey] = kvMatch[2].trim();
    } else if (currentKey && line.match(/^\s+-\s+/)) {
      // array item — append to existing string value so callers can check membership
      const item = line.replace(/^\s+-\s+/, '').trim();
      result[currentKey] = result[currentKey] ? [result[currentKey], item].join('\n') : item;
    }
  }
  return result;
}

function skillPath(name) {
  return path.join(COMMANDS_DIR, `${name}.md`);
}

// ---------------------------------------------------------------------------
// Group: New consolidated skills exist
// ---------------------------------------------------------------------------
describe('new consolidated skills exist', () => {
  test('commands/gsd/capture.md exists', () => {
    assert.ok(fs.existsSync(skillPath('capture')), 'capture.md does not exist');
  });

  test('capture.md has a name: field in frontmatter', () => {
    const fm = parseFrontmatter(skillPath('capture'));
    assert.ok(fm.name && fm.name.length > 0, 'capture.md missing name: in frontmatter');
  });

  test('commands/gsd/phase.md exists', () => {
    assert.ok(fs.existsSync(skillPath('phase')), 'phase.md does not exist');
  });

  test('phase.md has a name: field in frontmatter', () => {
    const fm = parseFrontmatter(skillPath('phase'));
    assert.ok(fm.name && fm.name.length > 0, 'phase.md missing name: in frontmatter');
  });

  test('commands/gsd/config.md exists', () => {
    assert.ok(fs.existsSync(skillPath('config')), 'config.md does not exist');
  });

  test('config.md has a name: field in frontmatter', () => {
    const fm = parseFrontmatter(skillPath('config'));
    assert.ok(fm.name && fm.name.length > 0, 'config.md missing name: in frontmatter');
  });

  test('commands/gsd/workspace.md exists', () => {
    assert.ok(fs.existsSync(skillPath('workspace')), 'workspace.md does not exist');
  });

  test('workspace.md has a name: field in frontmatter', () => {
    const fm = parseFrontmatter(skillPath('workspace'));
    assert.ok(fm.name && fm.name.length > 0, 'workspace.md missing name: in frontmatter');
  });
});

// ---------------------------------------------------------------------------
// Group: Absorbed skills are removed
// ---------------------------------------------------------------------------
describe('absorbed skills are removed', () => {
  const absorbed = [
    ['add-todo', 'absorbed into capture.md'],
    ['note', 'absorbed into capture.md'],
    ['add-backlog', 'absorbed into capture.md'],
    ['plant-seed', 'absorbed into capture.md'],
    ['check-todos', 'absorbed into capture.md'],
    ['add-phase', 'absorbed into phase.md'],
    ['insert-phase', 'absorbed into phase.md'],
    ['remove-phase', 'absorbed into phase.md'],
    ['edit-phase', 'absorbed into phase.md'],
    ['settings-advanced', 'absorbed into config.md'],
    ['settings-integrations', 'absorbed into config.md'],
    ['set-profile', 'absorbed into config.md'],
    ['new-workspace', 'absorbed into workspace.md'],
    ['list-workspaces', 'absorbed into workspace.md'],
    ['remove-workspace', 'absorbed into workspace.md'],
    ['sync-skills', 'absorbed into update.md'],
    ['reapply-patches', 'absorbed into update.md'],
    ['sketch-wrap-up', 'absorbed into sketch.md'],
    ['spike-wrap-up', 'absorbed into spike.md'],
    ['scan', 'absorbed into map-codebase.md'],
    ['intel', 'absorbed into map-codebase.md'],
    ['code-review-fix', 'absorbed into code-review.md'],
    ['next', 'absorbed into progress.md'],
    ['do', 'absorbed into progress.md'],
  ];

  for (const [name, reason] of absorbed) {
    test(`commands/gsd/${name}.md does NOT exist (${reason})`, () => {
      assert.ok(
        !fs.existsSync(skillPath(name)),
        [
          `${name}.md still exists but should have been deleted`,
          `(${reason})`,
        ].join(' '),
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Group: Outright deletions
// ---------------------------------------------------------------------------
describe('outright deleted dead skills are removed', () => {
  const deleted = [
    'join-discord',
    'research-phase',
    'session-report',
    'from-gsd2',
    'analyze-dependencies',
    'list-phase-assumptions',
    'plan-milestone-gaps',
  ];

  for (const name of deleted) {
    test(`commands/gsd/${name}.md does NOT exist`, () => {
      assert.ok(
        !fs.existsSync(skillPath(name)),
        `${name}.md still exists but should have been deleted (outright dead skill)`,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Group: Parent skills updated with new flags
// ---------------------------------------------------------------------------
describe('parent skills updated with new flags in argument-hint', () => {
  test('update.md argument-hint contains --sync', () => {
    const fm = parseFrontmatter(skillPath('update'));
    assert.ok(
      (fm['argument-hint'] || '').includes('--sync'),
      [
        'update.md argument-hint does not contain --sync',
        'got: ' + (fm['argument-hint'] || '(none)'),
      ].join('. '),
    );
  });

  test('update.md argument-hint contains --reapply', () => {
    const fm = parseFrontmatter(skillPath('update'));
    assert.ok(
      (fm['argument-hint'] || '').includes('--reapply'),
      [
        'update.md argument-hint does not contain --reapply',
        'got: ' + (fm['argument-hint'] || '(none)'),
      ].join('. '),
    );
  });

  test('sketch.md argument-hint contains --wrap-up', () => {
    const fm = parseFrontmatter(skillPath('sketch'));
    assert.ok(
      (fm['argument-hint'] || '').includes('--wrap-up'),
      [
        'sketch.md argument-hint does not contain --wrap-up',
        'got: ' + (fm['argument-hint'] || '(none)'),
      ].join('. '),
    );
  });

  test('spike.md argument-hint contains --wrap-up', () => {
    const fm = parseFrontmatter(skillPath('spike'));
    assert.ok(
      (fm['argument-hint'] || '').includes('--wrap-up'),
      [
        'spike.md argument-hint does not contain --wrap-up',
        'got: ' + (fm['argument-hint'] || '(none)'),
      ].join('. '),
    );
  });

  test('map-codebase.md argument-hint contains --fast', () => {
    const fm = parseFrontmatter(skillPath('map-codebase'));
    assert.ok(
      (fm['argument-hint'] || '').includes('--fast'),
      [
        'map-codebase.md argument-hint does not contain --fast',
        'got: ' + (fm['argument-hint'] || '(none)'),
      ].join('. '),
    );
  });

  test('code-review.md argument-hint contains --fix', () => {
    const fm = parseFrontmatter(skillPath('code-review'));
    assert.ok(
      (fm['argument-hint'] || '').includes('--fix'),
      [
        'code-review.md argument-hint does not contain --fix',
        'got: ' + (fm['argument-hint'] || '(none)'),
      ].join('. '),
    );
  });

  test('progress.md argument-hint contains --do', () => {
    const fm = parseFrontmatter(skillPath('progress'));
    assert.ok(
      (fm['argument-hint'] || '').includes('--do'),
      [
        'progress.md argument-hint does not contain --do',
        'got: ' + (fm['argument-hint'] || '(none)'),
      ].join('. '),
    );
  });
});

// ---------------------------------------------------------------------------
// Group: settings.md is NOT deleted
// ---------------------------------------------------------------------------
describe('settings.md is kept (merged into config entry point or remains standalone)', () => {
  test('commands/gsd/settings.md still exists', () => {
    assert.ok(
      fs.existsSync(skillPath('settings')),
      'settings.md was deleted — it should be kept (or renamed to config.md, but not both missing)',
    );
  });
});

// ---------------------------------------------------------------------------
// Group: Skill count reduced
// ---------------------------------------------------------------------------
describe('skill count', () => {
  test('total user-invocable files in commands/gsd/*.md is <= 63', () => {
    // Exclude `ns-*.md` namespace meta-skills (#2792) from this cap.
    // Those are descriptor-only routers selected first by the model and
    // are not part of the consolidation surface this test tracks; their
    // own contract is enforced by tests/enh-2792-namespace-skills.test.cjs.
    const files = fs.readdirSync(COMMANDS_DIR)
      .filter((f) => f.endsWith('.md') && !f.startsWith('ns-'));
    assert.ok(
      files.length <= 63,
      [
        `Expected <= 63 user-invocable skill files, found ${files.length}.`,
        'Consolidation target is ~58.',
      ].join(' '),
    );
  });
});
