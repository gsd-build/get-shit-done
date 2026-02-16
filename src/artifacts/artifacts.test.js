// @ts-check
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseFutureFile, writeFutureFile } = require('./future');
const { parseMilestonesFile, writeMilestonesFile } = require('./milestones');
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
  it('parses canonical format correctly', () => {
    const content = `# Milestones & Actions: Test Project

## Milestones

| ID   | Title         | Status  | Realizes | Caused By |
|------|---------------|---------|----------|-----------|
| M-01 | First MS      | PENDING | D-01     | A-01, A-02 |
| M-02 | Second MS     | ACTIVE  | D-01     | A-03       |

## Actions

| ID   | Title         | Status  | Causes |
|------|---------------|---------|--------|
| A-01 | First action  | PENDING | M-01   |
| A-02 | Second action | DONE    | M-01   |
| A-03 | Third action  | ACTIVE  | M-01, M-02 |
`;

    const result = parseMilestonesFile(content);
    assert.equal(result.milestones.length, 2);
    assert.equal(result.actions.length, 3);

    assert.equal(result.milestones[0].id, 'M-01');
    assert.equal(result.milestones[0].title, 'First MS');
    assert.equal(result.milestones[0].status, 'PENDING');
    assert.deepEqual(result.milestones[0].realizes, ['D-01']);
    assert.deepEqual(result.milestones[0].causedBy, ['A-01', 'A-02']);

    assert.equal(result.actions[2].id, 'A-03');
    assert.deepEqual(result.actions[2].causes, ['M-01', 'M-02']);
  });

  it('parses hand-edited table permissively', () => {
    const content = `# Milestones & Actions: Test

## Milestones

| ID | Title | Status | Realizes | Caused By |
|---|---|---|---|---|
|  M-01  |  Loose title  |  pending  |  D-01  |  A-01 |

## Actions

| ID | Title | Status | Causes |
|---|---|---|---|
| A-01 | Loose action |active| M-01 |
`;

    const result = parseMilestonesFile(content);
    assert.equal(result.milestones.length, 1);
    assert.equal(result.milestones[0].id, 'M-01');
    assert.equal(result.milestones[0].title, 'Loose title');
    assert.equal(result.milestones[0].status, 'PENDING');

    assert.equal(result.actions[0].status, 'ACTIVE');
  });

  it('returns empty arrays for empty tables', () => {
    const content = `# Milestones & Actions: Test

## Milestones

| ID | Title | Status | Realizes | Caused By |
|----|-------|--------|----------|-----------|

## Actions

| ID | Title | Status | Causes |
|----|-------|--------|--------|
`;

    const result = parseMilestonesFile(content);
    assert.deepEqual(result.milestones, []);
    assert.deepEqual(result.actions, []);
  });

  it('returns empty arrays for empty/missing content', () => {
    const result = parseMilestonesFile('');
    assert.deepEqual(result.milestones, []);
    assert.deepEqual(result.actions, []);
  });
});

describe('writeMilestonesFile', () => {
  it('produces canonical format with aligned columns', () => {
    const milestones = [
      { id: 'M-01', title: 'First', status: 'PENDING', realizes: ['D-01'], causedBy: ['A-01'] },
    ];
    const actions = [
      { id: 'A-01', title: 'Do thing', status: 'ACTIVE', causes: ['M-01'] },
    ];

    const output = writeMilestonesFile(milestones, actions, 'Test');
    assert.ok(output.includes('# Milestones & Actions: Test'));
    assert.ok(output.includes('## Milestones'));
    assert.ok(output.includes('## Actions'));
    assert.ok(output.includes('M-01'));
    assert.ok(output.includes('A-01'));
    assert.ok(output.includes('| ID'));
  });
});

describe('MILESTONES.md round-trip', () => {
  it('preserves data through write -> parse cycle', () => {
    const originalMs = [
      { id: 'M-01', title: 'Milestone one', status: 'ACTIVE', realizes: ['D-01'], causedBy: ['A-01', 'A-02'] },
      { id: 'M-02', title: 'Milestone two', status: 'PENDING', realizes: ['D-01', 'D-02'], causedBy: ['A-03'] },
    ];
    const originalAs = [
      { id: 'A-01', title: 'Action one', status: 'DONE', causes: ['M-01'] },
      { id: 'A-02', title: 'Action two', status: 'PENDING', causes: ['M-01'] },
      { id: 'A-03', title: 'Action three', status: 'ACTIVE', causes: ['M-01', 'M-02'] },
    ];

    const written = writeMilestonesFile(originalMs, originalAs, 'Round Trip');
    const parsed = parseMilestonesFile(written);

    assert.equal(parsed.milestones.length, originalMs.length);
    assert.equal(parsed.actions.length, originalAs.length);

    for (let i = 0; i < originalMs.length; i++) {
      assert.equal(parsed.milestones[i].id, originalMs[i].id);
      assert.equal(parsed.milestones[i].title, originalMs[i].title);
      assert.equal(parsed.milestones[i].status, originalMs[i].status);
      assert.deepEqual(parsed.milestones[i].realizes, originalMs[i].realizes);
      assert.deepEqual(parsed.milestones[i].causedBy, originalMs[i].causedBy);
    }

    for (let i = 0; i < originalAs.length; i++) {
      assert.equal(parsed.actions[i].id, originalAs[i].id);
      assert.equal(parsed.actions[i].title, originalAs[i].title);
      assert.equal(parsed.actions[i].status, originalAs[i].status);
      assert.deepEqual(parsed.actions[i].causes, originalAs[i].causes);
    }
  });
});

// ---------------------------------------------------------------------------
// Multi-value field parsing
// ---------------------------------------------------------------------------

describe('multi-value field parsing', () => {
  it('parses comma-separated with spaces', () => {
    const content = `# Milestones & Actions: Test

## Milestones

| ID | Title | Status | Realizes | Caused By |
|----|-------|--------|----------|-----------|
| M-01 | Test | PENDING | D-01, D-02 | A-01, A-02 |

## Actions

| ID | Title | Status | Causes |
|----|-------|--------|--------|
| A-01 | Test | PENDING | M-01, M-02 |
`;

    const result = parseMilestonesFile(content);
    assert.deepEqual(result.milestones[0].realizes, ['D-01', 'D-02']);
    assert.deepEqual(result.milestones[0].causedBy, ['A-01', 'A-02']);
    assert.deepEqual(result.actions[0].causes, ['M-01', 'M-02']);
  });

  it('parses comma-separated without spaces', () => {
    const content = `# Milestones & Actions: Test

## Milestones

| ID | Title | Status | Realizes | Caused By |
|----|-------|--------|----------|-----------|
| M-01 | Test | PENDING | D-01,D-02 | A-01,A-02 |

## Actions

| ID | Title | Status | Causes |
|----|-------|--------|--------|
`;

    const result = parseMilestonesFile(content);
    assert.deepEqual(result.milestones[0].realizes, ['D-01', 'D-02']);
    assert.deepEqual(result.milestones[0].causedBy, ['A-01', 'A-02']);
  });
});

// ---------------------------------------------------------------------------
// Full integration: DeclareDag -> write -> parse -> reconstruct
// ---------------------------------------------------------------------------

describe('full integration round-trip', () => {
  it('creates graph, writes to files, parses back, loads into new graph -- graph is equivalent', () => {
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

    // Write to markdown
    const declarations = dag1.getDeclarations().map(d => ({
      id: d.id,
      title: d.title,
      statement: d.metadata.statement || '',
      status: d.status,
      milestones: [...dag1.downEdges.get(d.id) || []].filter(id => id.startsWith('M-')),
    }));

    const milestones = dag1.getMilestones().map(m => ({
      id: m.id,
      title: m.title,
      status: m.status,
      realizes: [...dag1.upEdges.get(m.id) || []].filter(id => id.startsWith('D-')),
      causedBy: [...dag1.downEdges.get(m.id) || []].filter(id => id.startsWith('A-')),
    }));

    const actions = dag1.getActions().map(a => ({
      id: a.id,
      title: a.title,
      status: a.status,
      causes: [...dag1.upEdges.get(a.id) || []].filter(id => id.startsWith('M-')),
    }));

    const futureContent = writeFutureFile(declarations, 'Integration Test');
    const msContent = writeMilestonesFile(milestones, actions, 'Integration Test');

    // Parse back
    const parsedDecls = parseFutureFile(futureContent);
    const parsedMs = parseMilestonesFile(msContent);

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
    for (const a of parsedMs.actions) {
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
  });
});
