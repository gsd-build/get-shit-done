// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Execute-phase active flag prompt tests
 *
 * Guards against prompt wording that makes optional flags look active by default.
 * This is especially important for weaker runtimes that may infer `--gaps-only`
 * from the command docs instead of the literal user arguments.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const COMMAND_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'execute-phase.md');

describe('execute-phase command: active flags are explicit', () => {
  test('command file exists', () => {
    assert.ok(fs.existsSync(COMMAND_PATH), 'commands/gsd/execute-phase.md should exist');
  });

  test('objective says documented flags are not implied active', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    const objectiveMatch = content.match(/<objective>([\s\S]*?)<\/objective>/);
    assert.ok(objectiveMatch, 'should have <objective> section');
    assert.ok(
      objectiveMatch[1].includes('available behaviors, not implied active behaviors'),
      'objective should state that documented flags are not automatically active'
    );
    assert.ok(
      objectiveMatch[1].includes('appears in `$ARGUMENTS`'),
      'objective should tie flag activation to literal $ARGUMENTS presence'
    );
  });

  test('context separates available flags from active flags', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    assert.ok(
      content.includes('Available optional flags (documentation only'),
      'context should clearly label flags as documentation only'
    );
    assert.ok(
      content.includes('Active flags must be derived from `$ARGUMENTS`'),
      'context should have a separate active-flags section'
    );
  });

  test('context explicitly warns against inferring inactive flags', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    assert.ok(
      content.includes('Do not infer that a flag is active just because it is documented in this prompt'),
      'context should forbid inferring flags from documentation alone'
    );
    assert.ok(
      content.includes('`--interactive` is active only if the literal `--interactive` token is present in `$ARGUMENTS`'),
      'context should apply the same active-flag rule to --interactive'
    );
    assert.ok(
      content.includes('If none of these tokens appear, run the standard full-phase execution flow'),
      'context should define the no-flags fallback behavior'
    );
  });
});
