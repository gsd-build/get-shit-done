// @ts-check
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { DeclareDag, isCompleted, COMPLETED_STATUSES } = require('./engine');

describe('DeclareDag', () => {

  // --------------------------------------------------------------------------
  // Test 1: addNode with valid semantic IDs succeeds
  // --------------------------------------------------------------------------
  it('addNode with valid semantic IDs succeeds', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Future A');
    dag.addNode('M-01', 'milestone', 'Milestone A');
    dag.addNode('A-01', 'action', 'Action A');

    assert.equal(dag.size, 3);
    assert.equal(dag.getNode('D-01').title, 'Future A');
    assert.equal(dag.getNode('M-01').type, 'milestone');
    assert.equal(dag.getNode('A-01').status, 'PENDING');
  });

  // --------------------------------------------------------------------------
  // Test 2: addNode with mismatched prefix/type throws
  // --------------------------------------------------------------------------
  it('addNode with mismatched prefix/type throws', () => {
    const dag = new DeclareDag();
    assert.throws(
      () => dag.addNode('D-01', 'milestone', 'Wrong'),
      /prefix.*doesn't match type/i
    );
    assert.throws(
      () => dag.addNode('M-01', 'action', 'Wrong'),
      /prefix.*doesn't match type/i
    );
    assert.throws(
      () => dag.addNode('A-01', 'declaration', 'Wrong'),
      /prefix.*doesn't match type/i
    );
  });

  // --------------------------------------------------------------------------
  // Test 3: addNode with invalid status throws
  // --------------------------------------------------------------------------
  it('addNode with invalid status throws', () => {
    const dag = new DeclareDag();
    assert.throws(
      () => dag.addNode('D-01', 'declaration', 'Test', 'INVALID'),
      /Invalid status/
    );
  });

  // --------------------------------------------------------------------------
  // Test 4: addEdge action->milestone succeeds
  // --------------------------------------------------------------------------
  it('addEdge action->milestone succeeds', () => {
    const dag = new DeclareDag();
    dag.addNode('A-01', 'action', 'Action A');
    dag.addNode('M-01', 'milestone', 'Milestone A');
    dag.addEdge('A-01', 'M-01');

    assert.equal(dag.upEdges.get('A-01').has('M-01'), true);
    assert.equal(dag.downEdges.get('M-01').has('A-01'), true);
  });

  // --------------------------------------------------------------------------
  // Test 5: addEdge milestone->declaration succeeds
  // --------------------------------------------------------------------------
  it('addEdge milestone->declaration succeeds', () => {
    const dag = new DeclareDag();
    dag.addNode('M-01', 'milestone', 'Milestone A');
    dag.addNode('D-01', 'declaration', 'Declaration A');
    dag.addEdge('M-01', 'D-01');

    assert.equal(dag.upEdges.get('M-01').has('D-01'), true);
    assert.equal(dag.downEdges.get('D-01').has('M-01'), true);
  });

  // --------------------------------------------------------------------------
  // Test 6: addEdge action->declaration throws (skip layer)
  // --------------------------------------------------------------------------
  it('addEdge action->declaration throws (skip layer)', () => {
    const dag = new DeclareDag();
    dag.addNode('A-01', 'action', 'Action A');
    dag.addNode('D-01', 'declaration', 'Declaration A');

    assert.throws(
      () => dag.addEdge('A-01', 'D-01'),
      /Invalid edge.*action.*declaration/
    );
  });

  // --------------------------------------------------------------------------
  // Test 7: addEdge declaration->anything throws (declarations are top)
  // --------------------------------------------------------------------------
  it('addEdge declaration->anything throws (declarations are top)', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Declaration A');
    dag.addNode('M-01', 'milestone', 'Milestone A');
    dag.addNode('A-01', 'action', 'Action A');

    assert.throws(
      () => dag.addEdge('D-01', 'M-01'),
      /Invalid edge/
    );
    assert.throws(
      () => dag.addEdge('D-01', 'A-01'),
      /Invalid edge/
    );
  });

  // --------------------------------------------------------------------------
  // Test 8: addEdge with nonexistent node throws
  // --------------------------------------------------------------------------
  it('addEdge with nonexistent node throws', () => {
    const dag = new DeclareDag();
    dag.addNode('A-01', 'action', 'Action A');

    assert.throws(
      () => dag.addEdge('A-01', 'M-99'),
      /Node not found/
    );
    assert.throws(
      () => dag.addEdge('A-99', 'A-01'),
      /Node not found/
    );
  });

  // --------------------------------------------------------------------------
  // Test 9: removeNode removes node and all connected edges
  // --------------------------------------------------------------------------
  it('removeNode removes node and all connected edges', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Declaration A');
    dag.addNode('M-01', 'milestone', 'Milestone A');
    dag.addNode('A-01', 'action', 'Action A');
    dag.addEdge('A-01', 'M-01');
    dag.addEdge('M-01', 'D-01');

    dag.removeNode('M-01');

    assert.equal(dag.size, 2);
    assert.equal(dag.getNode('M-01'), undefined);
    // Edges cleaned up
    assert.equal(dag.upEdges.get('A-01').has('M-01'), false);
    assert.equal(dag.downEdges.get('D-01').has('M-01'), false);
  });

  // --------------------------------------------------------------------------
  // Test 10: validate detects orphan milestone (no upward edge)
  // --------------------------------------------------------------------------
  it('validate detects orphan milestone (no upward edge)', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Declaration A');
    dag.addNode('M-01', 'milestone', 'Orphan milestone');

    const result = dag.validate();
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].type, 'orphan');
    assert.equal(result.errors[0].node, 'M-01');
  });

  // --------------------------------------------------------------------------
  // Test 11: validate passes for valid graph
  // --------------------------------------------------------------------------
  it('validate passes for valid graph', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Declaration A');
    dag.addNode('M-01', 'milestone', 'Milestone A');
    dag.addNode('A-01', 'action', 'Action A');
    dag.addEdge('A-01', 'M-01');
    dag.addEdge('M-01', 'D-01');

    const result = dag.validate();
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  // --------------------------------------------------------------------------
  // Test 12: validate detects cycle (via direct map manipulation)
  // --------------------------------------------------------------------------
  it('validate detects cycle (via direct map manipulation)', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Declaration A');
    dag.addNode('M-01', 'milestone', 'Milestone A');
    dag.addNode('A-01', 'action', 'Action A');
    dag.addEdge('A-01', 'M-01');
    dag.addEdge('M-01', 'D-01');

    // Manually introduce a cycle by manipulating the edge maps directly
    dag.upEdges.get('D-01').add('A-01');
    dag.downEdges.get('A-01').add('D-01');

    const result = dag.validate();
    assert.equal(result.valid, false);
    const cycleError = result.errors.find(e => e.type === 'cycle');
    assert.ok(cycleError, 'Should detect cycle');
  });

  // --------------------------------------------------------------------------
  // Test 13: topologicalSort returns correct execution order
  // --------------------------------------------------------------------------
  it('topologicalSort returns correct execution order', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Declaration A');
    dag.addNode('M-01', 'milestone', 'Milestone A');
    dag.addNode('A-01', 'action', 'Action A');
    dag.addNode('A-02', 'action', 'Action B');
    dag.addEdge('A-01', 'M-01');
    dag.addEdge('A-02', 'M-01');
    dag.addEdge('M-01', 'D-01');

    const sorted = dag.topologicalSort();

    // Actions must come before their milestone
    const a01Idx = sorted.indexOf('A-01');
    const a02Idx = sorted.indexOf('A-02');
    const m01Idx = sorted.indexOf('M-01');
    const d01Idx = sorted.indexOf('D-01');

    assert.ok(a01Idx < m01Idx, 'A-01 before M-01');
    assert.ok(a02Idx < m01Idx, 'A-02 before M-01');
    assert.ok(m01Idx < d01Idx, 'M-01 before D-01');
  });

  // --------------------------------------------------------------------------
  // Test 14: topologicalSort throws on cycle
  // --------------------------------------------------------------------------
  it('topologicalSort throws on cycle', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Declaration A');
    dag.addNode('M-01', 'milestone', 'Milestone A');
    dag.addNode('A-01', 'action', 'Action A');
    dag.addEdge('A-01', 'M-01');
    dag.addEdge('M-01', 'D-01');

    // Manually introduce a cycle
    dag.upEdges.get('D-01').add('A-01');
    dag.downEdges.get('A-01').add('D-01');

    assert.throws(
      () => dag.topologicalSort(),
      /Cycle detected/
    );
  });

  // --------------------------------------------------------------------------
  // Test 15: toJSON/fromJSON round-trip preserves graph
  // --------------------------------------------------------------------------
  it('toJSON/fromJSON round-trip preserves graph', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Declaration A', 'ACTIVE', { statement: 'X is true' });
    dag.addNode('M-01', 'milestone', 'Milestone A');
    dag.addNode('A-01', 'action', 'Action A', 'DONE');
    dag.addEdge('A-01', 'M-01');
    dag.addEdge('M-01', 'D-01');

    const json = dag.toJSON();
    const restored = DeclareDag.fromJSON(json);

    assert.equal(restored.size, 3);
    assert.equal(restored.getNode('D-01').status, 'ACTIVE');
    assert.equal(restored.getNode('D-01').metadata.statement, 'X is true');
    assert.equal(restored.getNode('A-01').status, 'DONE');
    assert.equal(restored.upEdges.get('A-01').has('M-01'), true);
    assert.equal(restored.upEdges.get('M-01').has('D-01'), true);

    // Stats should match
    const origStats = dag.stats();
    const restoredStats = restored.stats();
    assert.deepEqual(origStats, restoredStats);
  });

  // --------------------------------------------------------------------------
  // Test 16: nextId returns correct sequential IDs
  // --------------------------------------------------------------------------
  it('nextId returns correct sequential IDs', () => {
    const dag = new DeclareDag();
    assert.equal(dag.nextId('declaration'), 'D-01');
    assert.equal(dag.nextId('milestone'), 'M-01');
    assert.equal(dag.nextId('action'), 'A-01');

    dag.addNode('D-01', 'declaration', 'Dec 1');
    dag.addNode('D-02', 'declaration', 'Dec 2');
    assert.equal(dag.nextId('declaration'), 'D-03');

    // Milestones unaffected
    assert.equal(dag.nextId('milestone'), 'M-01');

    dag.addNode('A-01', 'action', 'Act 1');
    dag.addNode('A-10', 'action', 'Act 10');
    assert.equal(dag.nextId('action'), 'A-11');
  });

  // --------------------------------------------------------------------------
  // Test 17: stats returns correct counts
  // --------------------------------------------------------------------------
  it('stats returns correct counts', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Dec 1', 'ACTIVE');
    dag.addNode('D-02', 'declaration', 'Dec 2', 'PENDING');
    dag.addNode('M-01', 'milestone', 'Ms 1', 'PENDING');
    dag.addNode('A-01', 'action', 'Act 1', 'DONE');
    dag.addNode('A-02', 'action', 'Act 2', 'ACTIVE');
    dag.addEdge('A-01', 'M-01');
    dag.addEdge('A-02', 'M-01');
    dag.addEdge('M-01', 'D-01');

    const s = dag.stats();
    assert.equal(s.declarations, 2);
    assert.equal(s.milestones, 1);
    assert.equal(s.actions, 2);
    assert.equal(s.edges, 3);
    assert.deepEqual(s.byStatus, { PENDING: 2, ACTIVE: 2, DONE: 1 });
  });

  // --------------------------------------------------------------------------
  // Test 18: Many-to-many relationships
  // --------------------------------------------------------------------------
  it('many-to-many: action serving multiple milestones, milestone linked to multiple declarations', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Dec 1');
    dag.addNode('D-02', 'declaration', 'Dec 2');
    dag.addNode('M-01', 'milestone', 'Ms 1');
    dag.addNode('M-02', 'milestone', 'Ms 2');
    dag.addNode('A-01', 'action', 'Act 1');

    // A-01 causes both M-01 and M-02
    dag.addEdge('A-01', 'M-01');
    dag.addEdge('A-01', 'M-02');

    // M-01 realizes both D-01 and D-02
    dag.addEdge('M-01', 'D-01');
    dag.addEdge('M-01', 'D-02');

    // M-02 realizes D-02
    dag.addEdge('M-02', 'D-02');

    assert.equal(dag.upEdges.get('A-01').size, 2);
    assert.equal(dag.upEdges.get('M-01').size, 2);
    assert.equal(dag.downEdges.get('D-02').size, 2); // M-01 and M-02

    const s = dag.stats();
    assert.equal(s.edges, 5);

    // Validate: no orphans, no cycles
    const result = dag.validate();
    assert.equal(result.valid, true);
  });

  // --------------------------------------------------------------------------
  // Test 19: Layer queries return correct subsets
  // --------------------------------------------------------------------------
  it('layer queries return correct subsets', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Dec 1');
    dag.addNode('D-02', 'declaration', 'Dec 2');
    dag.addNode('M-01', 'milestone', 'Ms 1');
    dag.addNode('A-01', 'action', 'Act 1');
    dag.addNode('A-02', 'action', 'Act 2');

    const declarations = dag.getDeclarations();
    assert.equal(declarations.length, 2);
    assert.ok(declarations.every(n => n.type === 'declaration'));

    const milestones = dag.getMilestones();
    assert.equal(milestones.length, 1);
    assert.equal(milestones[0].id, 'M-01');

    const actions = dag.getActions();
    assert.equal(actions.length, 2);
    assert.ok(actions.every(n => n.type === 'action'));
  });

  // --------------------------------------------------------------------------
  // Test 20: getUpstream/getDownstream return correct neighbors
  // --------------------------------------------------------------------------
  it('getUpstream/getDownstream return correct neighbors', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Dec 1');
    dag.addNode('M-01', 'milestone', 'Ms 1');
    dag.addNode('M-02', 'milestone', 'Ms 2');
    dag.addNode('A-01', 'action', 'Act 1');

    dag.addEdge('A-01', 'M-01');
    dag.addEdge('A-01', 'M-02');
    dag.addEdge('M-01', 'D-01');

    // A-01 upstream: M-01, M-02
    const a01Up = dag.getUpstream('A-01');
    assert.equal(a01Up.length, 2);
    const a01UpIds = a01Up.map(n => n.id).sort();
    assert.deepEqual(a01UpIds, ['M-01', 'M-02']);

    // M-01 upstream: D-01
    const m01Up = dag.getUpstream('M-01');
    assert.equal(m01Up.length, 1);
    assert.equal(m01Up[0].id, 'D-01');

    // D-01 downstream: M-01
    const d01Down = dag.getDownstream('D-01');
    assert.equal(d01Down.length, 1);
    assert.equal(d01Down[0].id, 'M-01');

    // M-01 downstream: A-01
    const m01Down = dag.getDownstream('M-01');
    assert.equal(m01Down.length, 1);
    assert.equal(m01Down[0].id, 'A-01');

    // D-01 has no upstream (it's top-level)
    const d01Up = dag.getUpstream('D-01');
    assert.equal(d01Up.length, 0);
  });

  // --------------------------------------------------------------------------
  // Test 21: addNode accepts all 7 statuses (including integrity statuses)
  // --------------------------------------------------------------------------
  it('addNode accepts all 7 statuses including integrity statuses', () => {
    const dag = new DeclareDag();
    dag.addNode('D-01', 'declaration', 'Dec 1', 'PENDING');
    dag.addNode('D-02', 'declaration', 'Dec 2', 'ACTIVE');
    dag.addNode('D-03', 'declaration', 'Dec 3', 'DONE');
    dag.addNode('D-04', 'declaration', 'Dec 4', 'KEPT');
    dag.addNode('D-05', 'declaration', 'Dec 5', 'BROKEN');
    dag.addNode('D-06', 'declaration', 'Dec 6', 'HONORED');
    dag.addNode('D-07', 'declaration', 'Dec 7', 'RENEGOTIATED');

    assert.equal(dag.size, 7);
    assert.equal(dag.getNode('D-04').status, 'KEPT');
    assert.equal(dag.getNode('D-05').status, 'BROKEN');
    assert.equal(dag.getNode('D-06').status, 'HONORED');
    assert.equal(dag.getNode('D-07').status, 'RENEGOTIATED');
  });

  // --------------------------------------------------------------------------
  // Test 22: addNode rejects invalid statuses
  // --------------------------------------------------------------------------
  it('addNode rejects invalid statuses', () => {
    const dag = new DeclareDag();
    assert.throws(
      () => dag.addNode('D-01', 'declaration', 'Test', 'INVALID'),
      /Invalid status/
    );
    assert.throws(
      () => dag.addNode('D-01', 'declaration', 'Test', 'COMPLETED'),
      /Invalid status/
    );
    assert.throws(
      () => dag.addNode('D-01', 'declaration', 'Test', 'kept'),
      /Invalid status/
    );
  });

  // --------------------------------------------------------------------------
  // Test 23: isCompleted returns true for DONE, KEPT, HONORED, RENEGOTIATED
  // --------------------------------------------------------------------------
  it('isCompleted returns true for completed statuses', () => {
    assert.equal(isCompleted('DONE'), true);
    assert.equal(isCompleted('KEPT'), true);
    assert.equal(isCompleted('HONORED'), true);
    assert.equal(isCompleted('RENEGOTIATED'), true);
  });

  // --------------------------------------------------------------------------
  // Test 24: isCompleted returns false for PENDING, ACTIVE, BROKEN
  // --------------------------------------------------------------------------
  it('isCompleted returns false for non-completed statuses', () => {
    assert.equal(isCompleted('PENDING'), false);
    assert.equal(isCompleted('ACTIVE'), false);
    assert.equal(isCompleted('BROKEN'), false);
  });

});
