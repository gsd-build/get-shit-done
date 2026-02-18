// @ts-check
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { parseFutureFile, writeFutureFile } = require('./future');
const { parseMilestonesFile, writeMilestonesFile } = require('./milestones');
const { parsePlanFile, writePlanFile } = require('./plan');
const { slugify, milestoneFolderName, ensureMilestoneFolder, findMilestoneFolder, archiveMilestoneFolder } = require('./milestone-folders');
const { DeclareDag } = require('../graph/engine');

// ---------------------------------------------------------------------------
// FUTURE.md tests
// ---------------------------------------------------------------------------

describe('parseFutureFile', () => {
  it('parses canonical format correctly', () => {
    const content = `# Future: Test Project

## D-01: Users can declare futures
**Statement:** Users declare future truth statements
**Status:** ACTIVE
**Milestones:** M-01, M-02

## D-02: System validates on load
**Statement:** The system validates graph integrity when loading
**Status:** PENDING
**Milestones:** M-03
`;

    const result = parseFutureFile(content);
    assert.equal(result.length, 2);

    assert.equal(result[0].id, 'D-01');
    assert.equal(result[0].title, 'Users can declare futures');
    assert.equal(result[0].statement, 'Users declare future truth statements');
    assert.equal(result[0].status, 'ACTIVE');
    assert.deepEqual(result[0].milestones, ['M-01', 'M-02']);

    assert.equal(result[1].id, 'D-02');
    assert.equal(result[1].title, 'System validates on load');
    assert.equal(result[1].status, 'PENDING');
    assert.deepEqual(result[1].milestones, ['M-03']);
  });

  it('parses hand-edited format permissively', () => {
    const content = `# Future: My Project

## D-01:   Extra spaces in title
  **Statement:**   loosely formatted statement
  **status:**   active

## D-02: No milestones field
**Statement:** Just a statement
**Status:** done
`;

    const result = parseFutureFile(content);
    assert.equal(result.length, 2);

    assert.equal(result[0].title, 'Extra spaces in title');
    assert.equal(result[0].statement, 'loosely formatted statement');
    assert.equal(result[0].status, 'ACTIVE');
    assert.deepEqual(result[0].milestones, []);

    assert.equal(result[1].id, 'D-02');
    assert.equal(result[1].status, 'DONE');
    assert.deepEqual(result[1].milestones, []);
  });

  it('returns empty array for empty file', () => {
    assert.deepEqual(parseFutureFile(''), []);
    assert.deepEqual(parseFutureFile('  \n  \n'), []);
  });

  it('skips sections without valid ID pattern', () => {
    const content = `# Future: Test

## Overview
Some intro text

## D-01: Valid declaration
**Statement:** A real declaration
**Status:** PENDING

## Random Section
Not a declaration
`;

    const result = parseFutureFile(content);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'D-01');
  });
});

describe('writeFutureFile', () => {
  it('produces canonical format', () => {
    const declarations = [
      { id: 'D-01', title: 'First', statement: 'Statement one', status: 'ACTIVE', milestones: ['M-01'] },
      { id: 'D-02', title: 'Second', statement: 'Statement two', status: 'PENDING', milestones: ['M-02', 'M-03'] },
    ];

    const output = writeFutureFile(declarations, 'Test Project');
    assert.ok(output.startsWith('# Future: Test Project'));
    assert.ok(output.includes('## D-01: First'));
    assert.ok(output.includes('**Statement:** Statement one'));
    assert.ok(output.includes('**Status:** ACTIVE'));
    assert.ok(output.includes('**Milestones:** M-01'));
    assert.ok(output.includes('**Milestones:** M-02, M-03'));
  });
});

describe('FUTURE.md round-trip', () => {
  it('preserves data through write -> parse cycle', () => {
    const original = [
      { id: 'D-01', title: 'First declaration', statement: 'Truth one', status: 'ACTIVE', milestones: ['M-01', 'M-02'] },
      { id: 'D-02', title: 'Second declaration', statement: 'Truth two', status: 'PENDING', milestones: ['M-03'] },
    ];

    const written = writeFutureFile(original, 'Round Trip');
    const parsed = parseFutureFile(written);

    assert.equal(parsed.length, original.length);
    for (let i = 0; i < original.length; i++) {
      assert.equal(parsed[i].id, original[i].id);
      assert.equal(parsed[i].title, original[i].title);
      assert.equal(parsed[i].statement, original[i].statement);
      assert.equal(parsed[i].status, original[i].status);
      assert.deepEqual(parsed[i].milestones, original[i].milestones);
    }
  });
});

// ---------------------------------------------------------------------------
// MILESTONES.md tests
// ---------------------------------------------------------------------------

describe('parseMilestonesFile', () => {
  it('parses new format with Plan column', () => {
    const content = `# Milestones: Test Project

## Milestones

| ID   | Title         | Status  | Realizes | Plan |
|------|---------------|---------|----------|------|
| M-01 | First MS      | PENDING | D-01     | YES  |
| M-02 | Second MS     | ACTIVE  | D-01     | NO   |
`;

    const result = parseMilestonesFile(content);
    assert.equal(result.milestones.length, 2);
    assert.ok(!('actions' in result), 'should not have actions property');

    assert.equal(result.milestones[0].id, 'M-01');
    assert.equal(result.milestones[0].title, 'First MS');
    assert.equal(result.milestones[0].status, 'PENDING');
    assert.deepEqual(result.milestones[0].realizes, ['D-01']);
    assert.equal(result.milestones[0].hasPlan, true);

    assert.equal(result.milestones[1].id, 'M-02');
    assert.equal(result.milestones[1].hasPlan, false);
  });

  it('parses hand-edited table permissively', () => {
    const content = `# Milestones: Test

## Milestones

| ID | Title | Status | Realizes | Plan |
|---|---|---|---|---|
|  M-01  |  Loose title  |  pending  |  D-01  |  yes |
`;

    const result = parseMilestonesFile(content);
    assert.equal(result.milestones.length, 1);
    assert.equal(result.milestones[0].id, 'M-01');
    assert.equal(result.milestones[0].title, 'Loose title');
    assert.equal(result.milestones[0].status, 'PENDING');
    assert.equal(result.milestones[0].hasPlan, true);
  });

  it('returns empty milestones for empty tables', () => {
    const content = `# Milestones: Test

## Milestones

| ID | Title | Status | Realizes | Plan |
|----|-------|--------|----------|------|
`;

    const result = parseMilestonesFile(content);
    assert.deepEqual(result.milestones, []);
  });

  it('returns empty milestones for empty/missing content', () => {
    const result = parseMilestonesFile('');
    assert.deepEqual(result.milestones, []);
  });
});

describe('writeMilestonesFile', () => {
  it('produces canonical format with aligned columns', () => {
    const milestones = [
      { id: 'M-01', title: 'First', status: 'PENDING', realizes: ['D-01'], hasPlan: true },
    ];

    const output = writeMilestonesFile(milestones, 'Test');
    assert.ok(output.includes('# Milestones: Test'));
    assert.ok(output.includes('## Milestones'));
    assert.ok(!output.includes('## Actions'), 'should not have Actions section');
    assert.ok(output.includes('M-01'));
    assert.ok(output.includes('YES'));
    assert.ok(output.includes('| ID'));
  });

  it('backward compat: accepts old 3-arg signature', () => {
    const milestones = [
      { id: 'M-01', title: 'First', status: 'PENDING', realizes: ['D-01'], hasPlan: false },
    ];
    const actions = []; // old signature passed actions array

    const output = writeMilestonesFile(milestones, actions, 'Test');
    assert.ok(output.includes('# Milestones: Test'));
    assert.ok(!output.includes('## Actions'));
  });
});

describe('MILESTONES.md round-trip', () => {
  it('preserves data through write -> parse cycle', () => {
    const originalMs = [
      { id: 'M-01', title: 'Milestone one', status: 'ACTIVE', realizes: ['D-01'], hasPlan: true },
      { id: 'M-02', title: 'Milestone two', status: 'PENDING', realizes: ['D-01', 'D-02'], hasPlan: false },
    ];

    const written = writeMilestonesFile(originalMs, 'Round Trip');
    const parsed = parseMilestonesFile(written);

    assert.equal(parsed.milestones.length, originalMs.length);

    for (let i = 0; i < originalMs.length; i++) {
      assert.equal(parsed.milestones[i].id, originalMs[i].id);
      assert.equal(parsed.milestones[i].title, originalMs[i].title);
      assert.equal(parsed.milestones[i].status, originalMs[i].status);
      assert.deepEqual(parsed.milestones[i].realizes, originalMs[i].realizes);
      assert.equal(parsed.milestones[i].hasPlan, originalMs[i].hasPlan);
    }
  });
});

// ---------------------------------------------------------------------------
// Multi-value field parsing
// ---------------------------------------------------------------------------

describe('multi-value field parsing', () => {
  it('parses comma-separated realizes with spaces', () => {
    const content = `# Milestones: Test

## Milestones

| ID | Title | Status | Realizes | Plan |
|----|-------|--------|----------|------|
| M-01 | Test | PENDING | D-01, D-02 | YES |
`;

    const result = parseMilestonesFile(content);
    assert.deepEqual(result.milestones[0].realizes, ['D-01', 'D-02']);
  });

  it('parses comma-separated realizes without spaces', () => {
    const content = `# Milestones: Test

## Milestones

| ID | Title | Status | Realizes | Plan |
|----|-------|--------|----------|------|
| M-01 | Test | PENDING | D-01,D-02 | NO |
`;

    const result = parseMilestonesFile(content);
    assert.deepEqual(result.milestones[0].realizes, ['D-01', 'D-02']);
  });
});

// ---------------------------------------------------------------------------
// PLAN.md tests
// ---------------------------------------------------------------------------

describe('parsePlanFile', () => {
  it('parses canonical format correctly', () => {
    const content = `# Plan: M-01 -- User Authentication

**Milestone:** M-01
**Realizes:** D-01, D-02
**Status:** PENDING
**Derived:** 2026-02-16

## Actions

### A-01: Build login form
**Status:** PENDING
**Produces:** Login component

### A-02: Add session management
**Status:** DONE
**Produces:** Session store
`;

    const result = parsePlanFile(content);
    assert.equal(result.milestone, 'M-01');
    assert.deepEqual(result.realizes, ['D-01', 'D-02']);
    assert.equal(result.status, 'PENDING');
    assert.equal(result.derived, '2026-02-16');
    assert.equal(result.actions.length, 2);

    assert.equal(result.actions[0].id, 'A-01');
    assert.equal(result.actions[0].title, 'Build login form');
    assert.equal(result.actions[0].status, 'PENDING');
    assert.equal(result.actions[0].produces, 'Login component');

    assert.equal(result.actions[1].id, 'A-02');
    assert.equal(result.actions[1].status, 'DONE');
  });

  it('parses hand-edited/permissive format', () => {
    const content = `# Plan:  M-02  --  Loose Format

  **milestone:**  M-02
  **realizes:**  D-01
  **status:**  active

## Actions

### A-03:   Loose action title
  **status:**  pending
  **produces:**  something
`;

    const result = parsePlanFile(content);
    assert.equal(result.milestone, 'M-02');
    assert.deepEqual(result.realizes, ['D-01']);
    assert.equal(result.status, 'ACTIVE');
    assert.equal(result.actions.length, 1);
    assert.equal(result.actions[0].id, 'A-03');
    assert.equal(result.actions[0].title, 'Loose action title');
  });

  it('returns defaults for empty content', () => {
    const result = parsePlanFile('');
    assert.equal(result.milestone, null);
    assert.deepEqual(result.realizes, []);
    assert.equal(result.status, 'PENDING');
    assert.deepEqual(result.actions, []);
  });

  it('parses actions with descriptions', () => {
    const content = `# Plan: M-01 -- Test

**Milestone:** M-01
**Realizes:** D-01
**Status:** PENDING
**Derived:** 2026-02-16

## Actions

### A-01: Action with desc
**Status:** PENDING
**Produces:** Thing
This is a description paragraph.
It spans multiple lines.
`;

    const result = parsePlanFile(content);
    assert.equal(result.actions[0].description, 'This is a description paragraph.\nIt spans multiple lines.');
  });
});

describe('writePlanFile', () => {
  it('produces canonical format', () => {
    const output = writePlanFile('M-01', 'User Auth', ['D-01'], [
      { id: 'A-01', title: 'Build login', status: 'PENDING', produces: 'Login form' },
      { id: 'A-02', title: 'Add sessions', status: 'PENDING', produces: 'Session store' },
    ]);

    assert.ok(output.includes('# Plan: M-01 -- User Auth'));
    assert.ok(output.includes('**Milestone:** M-01'));
    assert.ok(output.includes('**Realizes:** D-01'));
    assert.ok(output.includes('**Status:** PENDING'));
    assert.ok(output.includes('### A-01: Build login'));
    assert.ok(output.includes('### A-02: Add sessions'));
    assert.ok(output.includes('**Produces:** Login form'));
  });

  it('round-trips through write -> parse', () => {
    const written = writePlanFile('M-02', 'Test MS', ['D-01', 'D-02'], [
      { id: 'A-01', title: 'First', status: 'PENDING', produces: 'artifact1' },
      { id: 'A-02', title: 'Second', status: 'DONE', produces: 'artifact2' },
    ]);
    const parsed = parsePlanFile(written);

    assert.equal(parsed.milestone, 'M-02');
    assert.deepEqual(parsed.realizes, ['D-01', 'D-02']);
    assert.equal(parsed.actions.length, 2);
    assert.equal(parsed.actions[0].id, 'A-01');
    assert.equal(parsed.actions[0].title, 'First');
    assert.equal(parsed.actions[0].produces, 'artifact1');
    assert.equal(parsed.actions[1].id, 'A-02');
    assert.equal(parsed.actions[1].title, 'Second');
  });
});

// ---------------------------------------------------------------------------
// Milestone folder tests
// ---------------------------------------------------------------------------

describe('slugify', () => {
  it('converts basic title to slug', () => {
    assert.equal(slugify('User Authentication'), 'user-authentication');
  });

  it('handles special characters', () => {
    assert.equal(slugify('OAuth 2.0 + JWT'), 'oauth-2-0-jwt');
  });

  it('strips leading and trailing hyphens', () => {
    assert.equal(slugify('--hello--'), 'hello');
  });
});

describe('milestoneFolderName', () => {
  it('produces correct format', () => {
    assert.equal(milestoneFolderName('M-01', 'User Auth'), 'M-01-user-auth');
  });
});

describe('milestone folder operations', () => {
  let tmpDir;

  it('ensureMilestoneFolder creates nested dirs', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gsd-test-'));
    const planningDir = join(tmpDir, '.planning');

    const result = ensureMilestoneFolder(planningDir, 'M-01', 'Test Milestone');
    assert.ok(existsSync(result));
    assert.ok(result.endsWith('M-01-test-milestone'));

    // Clean up
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('findMilestoneFolder finds by prefix', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gsd-test-'));
    const planningDir = join(tmpDir, '.planning');
    mkdirSync(join(planningDir, 'milestones', 'M-01-test-ms'), { recursive: true });

    const result = findMilestoneFolder(planningDir, 'M-01');
    assert.ok(result !== null);
    assert.ok(result.endsWith('M-01-test-ms'));

    // Clean up
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('findMilestoneFolder returns null when not found', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gsd-test-'));
    const planningDir = join(tmpDir, '.planning');
    mkdirSync(join(planningDir, 'milestones'), { recursive: true });

    const result = findMilestoneFolder(planningDir, 'M-99');
    assert.equal(result, null);

    // Clean up
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('archiveMilestoneFolder moves to _archived/', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gsd-test-'));
    const planningDir = join(tmpDir, '.planning');
    mkdirSync(join(planningDir, 'milestones', 'M-01-test'), { recursive: true });

    const result = archiveMilestoneFolder(planningDir, 'M-01');
    assert.equal(result, true);
    assert.ok(existsSync(join(planningDir, 'milestones', '_archived', 'M-01-test')));
    assert.ok(!existsSync(join(planningDir, 'milestones', 'M-01-test')));

    // Clean up
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('archiveMilestoneFolder returns false when not found', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gsd-test-'));
    const planningDir = join(tmpDir, '.planning');
    mkdirSync(join(planningDir, 'milestones'), { recursive: true });

    const result = archiveMilestoneFolder(planningDir, 'M-99');
    assert.equal(result, false);

    // Clean up
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// Full integration: DeclareDag -> write -> parse -> reconstruct
// ---------------------------------------------------------------------------

describe('full integration round-trip', () => {
  it('creates graph, writes to files (FUTURE.md + MILESTONES.md + PLAN.md), parses back, loads into new graph -- graph is equivalent', () => {
    // Create original graph
    const dag1 = new DeclareDag();
    dag1.addNode('D-01', 'declaration', 'Users can declare futures', 'ACTIVE', { statement: 'Users declare future truth statements' });
    dag1.addNode('D-02', 'declaration', 'System validates', 'PENDING', { statement: 'System validates graph on load' });
    dag1.addNode('M-01', 'milestone', 'CLI accepts input', 'PENDING');
    dag1.addNode('M-02', 'milestone', 'Graph persists', 'ACTIVE');
    dag1.addNode('A-01', 'action', 'Build parser', 'DONE');
    dag1.addNode('A-02', 'action', 'Build writer', 'PENDING');
    dag1.addNode('A-03', 'action', 'Build validator', 'ACTIVE');

    dag1.addEdge('A-01', 'M-01');
    dag1.addEdge('A-02', 'M-01');
    dag1.addEdge('A-03', 'M-02');
    dag1.addEdge('M-01', 'D-01');
    dag1.addEdge('M-02', 'D-01');
    dag1.addEdge('M-02', 'D-02');

    // Write to markdown -- declarations to FUTURE.md
    const declarations = dag1.getDeclarations().map(d => ({
      id: d.id,
      title: d.title,
      statement: d.metadata.statement || '',
      status: d.status,
      milestones: [...dag1.downEdges.get(d.id) || []].filter(id => id.startsWith('M-')),
    }));

    // Milestones to MILESTONES.md (no actions, hasPlan indicates plan exists)
    const milestones = dag1.getMilestones().map(m => ({
      id: m.id,
      title: m.title,
      status: m.status,
      realizes: [...dag1.upEdges.get(m.id) || []].filter(id => id.startsWith('D-')),
      hasPlan: true, // all milestones have plans in this test
    }));

    // Actions grouped by milestone for PLAN.md files
    const actionsByMilestone = new Map();
    for (const a of dag1.getActions()) {
      const milestoneIds = [...dag1.upEdges.get(a.id) || []].filter(id => id.startsWith('M-'));
      for (const msId of milestoneIds) {
        if (!actionsByMilestone.has(msId)) actionsByMilestone.set(msId, []);
        actionsByMilestone.get(msId).push({
          id: a.id,
          title: a.title,
          status: a.status,
          produces: '',
        });
      }
    }

    const futureContent = writeFutureFile(declarations, 'Integration Test');
    const msContent = writeMilestonesFile(milestones, 'Integration Test');

    // Write PLAN.md files to temp milestone folders
    const tmpDir = mkdtempSync(join(tmpdir(), 'gsd-integ-'));
    const planningDir = join(tmpDir, '.planning');
    for (const [msId, actions] of actionsByMilestone) {
      const msNode = dag1.getNode(msId);
      const realizes = [...dag1.upEdges.get(msId) || []].filter(id => id.startsWith('D-'));
      const planContent = writePlanFile(msId, msNode.title, realizes, actions);
      const folderPath = ensureMilestoneFolder(planningDir, msId, msNode.title);
      writeFileSync(join(folderPath, 'PLAN.md'), planContent);
    }

    // Parse back
    const parsedDecls = parseFutureFile(futureContent);
    const parsedMs = parseMilestonesFile(msContent);

    // Load actions from milestone folders (simulates load-graph)
    const { loadActionsFromFolders } = require('../commands/load-graph');
    const parsedActions = loadActionsFromFolders(planningDir);

    // Reconstruct graph
    const dag2 = new DeclareDag();

    for (const d of parsedDecls) {
      dag2.addNode(d.id, 'declaration', d.title, d.status, { statement: d.statement });
    }
    for (const m of parsedMs.milestones) {
      dag2.addNode(m.id, 'milestone', m.title, m.status);
      for (const declId of m.realizes) {
        dag2.addEdge(m.id, declId);
      }
    }
    for (const a of parsedActions) {
      dag2.addNode(a.id, 'action', a.title, a.status);
      for (const msId of a.causes) {
        dag2.addEdge(a.id, msId);
      }
    }

    // Compare graphs
    const stats1 = dag1.stats();
    const stats2 = dag2.stats();
    assert.equal(stats2.declarations, stats1.declarations);
    assert.equal(stats2.milestones, stats1.milestones);
    assert.equal(stats2.actions, stats1.actions);
    assert.equal(stats2.edges, stats1.edges);
    assert.deepEqual(stats2.byStatus, stats1.byStatus);

    // Verify specific edges survived
    assert.ok(dag2.upEdges.get('A-01').has('M-01'));
    assert.ok(dag2.upEdges.get('M-01').has('D-01'));
    assert.ok(dag2.upEdges.get('M-02').has('D-02'));

    // Both should validate
    assert.ok(dag1.validate().valid);
    assert.ok(dag2.validate().valid);

    // Clean up
    rmSync(tmpDir, { recursive: true, force: true });
  });
});
