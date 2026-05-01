/**
 * Bug #2950: Stale deleted command references in workflow files
 *
 * Multiple workflow files referenced command names removed in #2790
 * (gsd-add-phase, gsd-insert-phase, gsd-remove-phase, gsd-add-todo,
 * gsd-set-profile, gsd-settings-integrations, gsd-settings-advanced,
 * gsd-spike-wrap-up, gsd-sketch-wrap-up, gsd-code-review-fix).
 *
 * Fix: Update every occurrence to the new consolidated forms:
 *   /gsd-phase (no flag | --insert | --remove)
 *   /gsd-capture
 *   /gsd-config (--profile | --integrations | --advanced)
 *   /gsd-spike --wrap-up
 *   /gsd-sketch --wrap-up
 *   /gsd-code-review --fix
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOWS_DIR = path.join(__dirname, '..', 'get-shit-done', 'workflows');

function read(filename) {
  return fs.readFileSync(path.join(WORKFLOWS_DIR, filename), 'utf-8');
}

// Deleted command names that must not appear anywhere in the fixed files.
const DELETED_COMMANDS = [
  '/gsd-add-phase',
  '/gsd-insert-phase',
  '/gsd-remove-phase',
  '/gsd-add-todo',
  '/gsd-set-profile',
  '/gsd-settings-integrations',
  '/gsd-settings-advanced',
  '/gsd-spike-wrap-up',
  '/gsd-sketch-wrap-up',
  '/gsd-code-review-fix',
];

// Per-file assertions: [file, deletedCmd, newForm]
const FILE_ASSERTIONS = [
  // help.md
  ['help.md', '/gsd-add-phase', '/gsd-phase "Add admin dashboard"'],
  ['help.md', '/gsd-insert-phase', '/gsd-phase --insert 7 "Fix critical auth bug"'],
  ['help.md', '/gsd-remove-phase', '/gsd-phase --remove 17'],
  ['help.md', '/gsd-spike-wrap-up', '/gsd-spike --wrap-up'],
  ['help.md', '/gsd-sketch-wrap-up', '/gsd-sketch --wrap-up'],
  ['help.md', '/gsd-add-todo', '/gsd-capture'],
  ['help.md', '/gsd-set-profile', '/gsd-config --profile budget'],

  // do.md
  ['do.md', '/gsd-spike-wrap-up', '/gsd-spike --wrap-up'],
  ['do.md', '/gsd-sketch-wrap-up', '/gsd-sketch --wrap-up'],
  ['do.md', '/gsd-add-phase', '/gsd-phase'],
  ['do.md', '/gsd-add-todo', '/gsd-capture'],

  // settings.md
  ['settings.md', '/gsd-code-review-fix', '/gsd-code-review --fix'],
  ['settings.md', '/gsd-settings-integrations', '/gsd-config --integrations'],
  ['settings.md', '/gsd-set-profile', '/gsd-config --profile'],
  ['settings.md', '/gsd-settings-advanced', '/gsd-config --advanced'],

  // discuss-phase.md
  ['discuss-phase.md', '/gsd-spike-wrap-up', '/gsd-spike --wrap-up'],
  ['discuss-phase.md', '/gsd-sketch-wrap-up', '/gsd-sketch --wrap-up'],

  // new-project.md
  ['new-project.md', '/gsd-spike-wrap-up', '/gsd-spike --wrap-up'],
  ['new-project.md', '/gsd-sketch-wrap-up', '/gsd-sketch --wrap-up'],

  // plan-phase.md
  ['plan-phase.md', '/gsd-insert-phase', '/gsd-phase --insert'],

  // spike.md
  ['spike.md', '/gsd-spike-wrap-up', '/gsd-spike --wrap-up'],

  // sketch.md
  ['sketch.md', '/gsd-sketch-wrap-up', '/gsd-sketch --wrap-up'],
];

describe('bug #2950: stale deleted-command references removed from workflow files', () => {
  // Build a map of file → content to avoid re-reading
  const files = [...new Set(FILE_ASSERTIONS.map(([f]) => f))];
  const contentMap = {};
  for (const f of files) {
    contentMap[f] = read(f);
  }

  // For each (file, deletedCmd) pair, assert the old name is absent
  for (const [file, deletedCmd] of FILE_ASSERTIONS) {
    test(`${file}: does not contain deleted command "${deletedCmd}"`, () => {
      const content = contentMap[file];
      assert.ok(
        !content.includes(deletedCmd),
        `${file} still contains deleted command "${deletedCmd}" — update to new form`
      );
    });
  }

  // For each (file, deletedCmd, newForm) triple, assert the new form is present
  for (const [file, , newForm] of FILE_ASSERTIONS) {
    test(`${file}: contains new form "${newForm}"`, () => {
      const content = contentMap[file];
      assert.ok(
        content.includes(newForm),
        `${file} is missing expected new form "${newForm}"`
      );
    });
  }

  // Blanket check: no affected workflow file contains any of the deleted command names
  // (catches any we might have missed in per-file assertions above)
  const affectedFiles = [
    'help.md',
    'do.md',
    'settings.md',
    'discuss-phase.md',
    'new-project.md',
    'plan-phase.md',
    'spike.md',
    'sketch.md',
  ];

  for (const file of affectedFiles) {
    const content = read(file);
    for (const deleted of DELETED_COMMANDS) {
      test(`${file}: blanket check — "${deleted}" not present`, () => {
        assert.ok(
          !content.includes(deleted),
          `${file} contains deleted command "${deleted}"`
        );
      });
    }
  }
});
