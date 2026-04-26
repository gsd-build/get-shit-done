'use strict';

/**
 * Tests for /gsd-edit-phase (#2617)
 *
 * Covers:
 *  - Command file and workflow file existence
 *  - Single-field edit instructions
 *  - Full-phase regeneration from clarified intent
 *  - Invalid depends_on blocks with clear error
 *  - Guarded edit of in_progress phase without --force
 *  - --force override of status guard
 *  - Invalid phase number produces clear error
 *  - Diff + confirmation before writing
 *  - Phase number and position are preserved
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const COMMAND_PATH = path.join(ROOT, 'commands', 'gsd', 'edit-phase.md');
const WORKFLOW_PATH = path.join(ROOT, 'get-shit-done', 'workflows', 'edit-phase.md');

// ─── File existence ──────────────────────────────────────────────────────────

describe('edit-phase: file existence', () => {
  test('commands/gsd/edit-phase.md exists', () => {
    assert.ok(fs.existsSync(COMMAND_PATH), 'commands/gsd/edit-phase.md should exist');
  });

  test('get-shit-done/workflows/edit-phase.md exists', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'get-shit-done/workflows/edit-phase.md should exist');
  });
});

// ─── Command file structure ───────────────────────────────────────────────────

describe('edit-phase: command file structure', () => {
  test('command file has correct name frontmatter', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    assert.ok(/^name:\s*gsd:edit-phase/m.test(content), 'name should be gsd:edit-phase');
  });

  test('command file has description frontmatter', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    assert.ok(/^description:/m.test(content), 'should have description frontmatter');
  });

  test('command file references edit-phase workflow', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    assert.ok(
      content.includes('edit-phase.md'),
      'command file should reference edit-phase workflow'
    );
  });

  test('command file documents --force flag', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    assert.ok(content.includes('--force'), 'command file should document --force flag');
  });
});

// ─── Workflow: single-field edit ─────────────────────────────────────────────

describe('edit-phase workflow: single-field edit', () => {
  test('workflow instructs presenting current field values before editing', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const showsCurrentValues = (
      /current\s+value/i.test(content) ||
      /present.*current/i.test(content) ||
      /display.*current/i.test(content) ||
      /current_value/i.test(content)
    );
    assert.ok(showsCurrentValues, 'workflow must present current field values before editing');
  });

  test('workflow supports editing specific fields individually', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const supportsIndividualFields = (
      /specific\s+field/i.test(content) ||
      /individual\s+field/i.test(content) ||
      /edit.*field/i.test(content)
    );
    assert.ok(supportsIndividualFields, 'workflow must support editing individual fields');
  });

  test('workflow covers title, goal, depends_on, requirements, success_criteria fields', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(/\btitle\b/i.test(content), 'workflow should mention title field');
    assert.ok(/\bgoal\b/i.test(content), 'workflow should mention goal field');
    assert.ok(/depends_on/i.test(content), 'workflow should mention depends_on field');
    assert.ok(/requirements/i.test(content), 'workflow should mention requirements field');
    assert.ok(/success_criteria/i.test(content), 'workflow should mention success_criteria field');
  });
});

// ─── Workflow: full-phase regeneration ───────────────────────────────────────

describe('edit-phase workflow: full-phase regeneration', () => {
  test('workflow supports regenerating all fields from clarified intent', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const supportsRegen = (
      /regenerate/i.test(content) ||
      /rewrite.*all/i.test(content) ||
      /all.*from.*clarified/i.test(content) ||
      /clarified.*intent/i.test(content)
    );
    assert.ok(supportsRegen, 'workflow must support full regeneration from clarified intent');
  });

  test('workflow prompts user for clarified intent during full regeneration', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const promptsClarifiedIntent = (
      /clarified?\s+intent/i.test(content) ||
      /revised\s+intent/i.test(content) ||
      /describe.*revised/i.test(content)
    );
    assert.ok(
      promptsClarifiedIntent,
      'workflow must prompt user for clarified intent during full regeneration'
    );
  });
});

// ─── Workflow: invalid depends_on ────────────────────────────────────────────

describe('edit-phase workflow: depends_on validation', () => {
  test('workflow validates depends_on references against existing phases', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const validatesDepends = (
      /validate.*depends/i.test(content) ||
      /depends.*valid/i.test(content) ||
      /invalid.*depends/i.test(content) ||
      /depends_on.*valid/i.test(content)
    );
    assert.ok(validatesDepends, 'workflow must validate depends_on references');
  });

  test('workflow blocks write when depends_on references invalid phase', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const blocksInvalidRef = (
      /invalid.*phase/i.test(content) &&
      /exit|block|error/i.test(content)
    );
    assert.ok(blocksInvalidRef, 'workflow must block write for invalid depends_on references');
  });

  test('workflow validates that depends_on does not reference the phase itself', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const preventsCircular = (
      /not reference itself/i.test(content) ||
      /circular/i.test(content) ||
      /self-reference/i.test(content) ||
      /itself/i.test(content)
    );
    assert.ok(preventsCircular, 'workflow must prevent self-referencing depends_on');
  });
});

// ─── Workflow: status guard ───────────────────────────────────────────────────

describe('edit-phase workflow: in-progress/completed status guard', () => {
  test('workflow checks phase status before allowing edit', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const checksStatus = (
      /disk_status/i.test(content) ||
      /phase.*status/i.test(content) ||
      /status.*check/i.test(content)
    );
    assert.ok(checksStatus, 'workflow must check phase status before allowing edit');
  });

  test('workflow refuses to edit in_progress phases without --force', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const refusesInProgress = (
      /in.progress/i.test(content) &&
      /--force/i.test(content)
    );
    assert.ok(refusesInProgress, 'workflow must refuse in_progress edits without --force');
  });

  test('workflow refuses to edit completed phases without --force', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const refusesCompleted = (
      /completed/i.test(content) &&
      /--force/i.test(content)
    );
    assert.ok(refusesCompleted, 'workflow must refuse completed phase edits without --force');
  });

  test('workflow allows edit with --force flag override', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const forcePath = content.match(/--force[\s\S]{0,300}/i);
    assert.ok(forcePath, 'workflow must handle --force flag');
    const forceSection = forcePath[0];
    const allowsForce = (
      /proceed|continue|allow|override/i.test(forceSection) ||
      /force.*was.*passed/i.test(content) ||
      /force.*passed/i.test(content)
    );
    assert.ok(allowsForce, 'workflow must allow editing when --force is passed');
  });
});

// ─── Workflow: invalid phase number ──────────────────────────────────────────

describe('edit-phase workflow: invalid phase number', () => {
  test('workflow produces clear error when phase number does not exist', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const handlesNotFound = (
      /not.*found/i.test(content) ||
      /phase.*not.*found/i.test(content) ||
      /does not exist/i.test(content)
    );
    assert.ok(handlesNotFound, 'workflow must error clearly when phase number does not exist');
  });

  test('workflow errors on missing phase number argument', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const handlesNoArg = (
      /no.*argument/i.test(content) ||
      /required/i.test(content) ||
      /phase number required/i.test(content)
    );
    assert.ok(handlesNoArg, 'workflow must error when phase number argument is missing');
  });
});

// ─── Workflow: diff + confirmation ───────────────────────────────────────────

describe('edit-phase workflow: diff and confirmation', () => {
  test('workflow shows diff of changes before writing', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const showsDiff = (
      /diff/i.test(content) ||
      /proposed.*change/i.test(content) ||
      /show.*change/i.test(content)
    );
    assert.ok(showsDiff, 'workflow must show a diff of changes before writing');
  });

  test('workflow asks for confirmation before writing', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const asksConfirmation = (
      /confirm/i.test(content) ||
      /apply.*change/i.test(content) ||
      /y\/n/i.test(content) ||
      /yes.*no/i.test(content)
    );
    assert.ok(asksConfirmation, 'workflow must ask for confirmation before writing');
  });

  test('workflow exits without writing if user declines', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const handlesDecline = (
      /says.*n/i.test(content) ||
      /user says.*n/i.test(content) ||
      /if.*user.*n/i.test(content) ||
      /exit.*without.*writing/i.test(content) ||
      /without writing/i.test(content)
    );
    assert.ok(handlesDecline, 'workflow must exit without writing if user declines confirmation');
  });
});

// ─── Workflow: phase number and position preservation ────────────────────────

describe('edit-phase workflow: phase number and position preservation', () => {
  test('workflow preserves phase number when writing back', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const preservesNumber = (
      /number.*preserved/i.test(content) ||
      /preserve.*number/i.test(content) ||
      /position.*preserved/i.test(content) ||
      /number and position/i.test(content)
    );
    assert.ok(preservesNumber, 'workflow must preserve phase number and position');
  });

  test('anti_patterns block renumbering', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const antiPatterns = content.match(/<anti_patterns>([\s\S]*?)<\/anti_patterns>/i);
    assert.ok(antiPatterns, 'workflow should have anti_patterns section');
    assert.ok(
      /renumber|number.*preserved|preserve.*number/i.test(antiPatterns[1]),
      'anti_patterns must prohibit renumbering'
    );
  });

  test('workflow writes phase back in place (replaces section, not full file)', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const inPlace = (
      /in.*place/i.test(content) ||
      /replace.*section/i.test(content) ||
      /section.*replace/i.test(content) ||
      /replace.*old.*section/i.test(content)
    );
    assert.ok(inPlace, 'workflow must write phase back in place (section replacement)');
  });
});

// ─── Workflow: STATE.md update ────────────────────────────────────────────────

describe('edit-phase workflow: STATE.md roadmap evolution', () => {
  test('workflow updates STATE.md Roadmap Evolution after edit', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const updatesState = (
      /state\.add-roadmap-evolution/i.test(content) ||
      /Roadmap Evolution/i.test(content)
    );
    assert.ok(updatesState, 'workflow must update STATE.md Roadmap Evolution after edit');
  });
});

// ─── Docs registration ────────────────────────────────────────────────────────

describe('edit-phase: documentation registration', () => {
  test('INVENTORY.md contains /gsd-edit-phase', () => {
    const inventory = fs.readFileSync(
      path.join(ROOT, 'docs', 'INVENTORY.md'),
      'utf-8'
    );
    assert.ok(
      inventory.includes('/gsd-edit-phase'),
      'docs/INVENTORY.md must contain /gsd-edit-phase'
    );
  });

  test('INVENTORY.md contains edit-phase.md workflow', () => {
    const inventory = fs.readFileSync(
      path.join(ROOT, 'docs', 'INVENTORY.md'),
      'utf-8'
    );
    assert.ok(
      inventory.includes('edit-phase.md'),
      'docs/INVENTORY.md must contain edit-phase.md workflow row'
    );
  });

  test('INVENTORY-MANIFEST.json contains /gsd-edit-phase in commands', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'docs', 'INVENTORY-MANIFEST.json'), 'utf-8')
    );
    assert.ok(
      manifest.families.commands.includes('/gsd-edit-phase'),
      'INVENTORY-MANIFEST.json must list /gsd-edit-phase in commands'
    );
  });

  test('INVENTORY-MANIFEST.json contains edit-phase.md in workflows', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'docs', 'INVENTORY-MANIFEST.json'), 'utf-8')
    );
    assert.ok(
      manifest.families.workflows.includes('edit-phase.md'),
      'INVENTORY-MANIFEST.json must list edit-phase.md in workflows'
    );
  });

  test('docs/COMMANDS.md contains /gsd-edit-phase', () => {
    const commands = fs.readFileSync(
      path.join(ROOT, 'docs', 'COMMANDS.md'),
      'utf-8'
    );
    assert.ok(
      commands.includes('/gsd-edit-phase'),
      'docs/COMMANDS.md must document /gsd-edit-phase'
    );
  });
});
