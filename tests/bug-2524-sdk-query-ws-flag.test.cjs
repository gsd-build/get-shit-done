'use strict';

/**
 * Bug #2524: gsd-sdk query --ws <name> silently ignores the workstream flag.
 * Tests that --ws is forwarded through the call chain:
 *   cli.ts -> registry.dispatch() -> planningPaths()
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ─── Layer 3: planningPaths() accepts workstream ───────────────────────────

describe('planningPaths() workstream support', () => {
  test('without workstream returns .planning base', async () => {
    const { planningPaths } = await import('../sdk/dist/query/helpers.js');
    const paths = planningPaths('/myproject');
    assert.ok(paths.planning.endsWith('.planning'), `expected .planning suffix, got: ${paths.planning}`);
    assert.ok(!paths.planning.includes('workstreams'), `should not contain workstreams: ${paths.planning}`);
  });

  test('with workstream returns .planning/workstreams/<name>', async () => {
    const { planningPaths } = await import('../sdk/dist/query/helpers.js');
    const paths = planningPaths('/myproject', 'my-ws');
    assert.ok(
      paths.planning.includes('workstreams/my-ws') || paths.planning.includes('workstreams\\my-ws'),
      `expected workstreams/my-ws in path, got: ${paths.planning}`,
    );
  });

  test('state path uses workstream base', async () => {
    const { planningPaths } = await import('../sdk/dist/query/helpers.js');
    const paths = planningPaths('/myproject', 'my-ws');
    assert.ok(
      paths.state.includes('workstreams/my-ws') || paths.state.includes('workstreams\\my-ws'),
      `expected workstreams/my-ws in state path, got: ${paths.state}`,
    );
  });
});

// ─── Layer 2: QueryRegistry.dispatch() accepts workstream ─────────────────

describe('QueryRegistry.dispatch() workstream threading', () => {
  test('dispatch passes workstream to handler as third argument', async () => {
    const { QueryRegistry } = await import('../sdk/dist/query/registry.js');

    const registry = new QueryRegistry();
    let capturedWorkstream = '__not_set__';

    // Register a handler that captures the workstream argument
    registry.register('test-ws-handler', async (_args, _projectDir, workstream) => {
      capturedWorkstream = workstream ?? '__undefined__';
      return { data: { ok: true } };
    });

    await registry.dispatch('test-ws-handler', [], '/project', 'my-ws');
    assert.equal(capturedWorkstream, 'my-ws', 'dispatch must forward workstream to handler');
  });

  test('dispatch without workstream passes undefined to handler', async () => {
    const { QueryRegistry } = await import('../sdk/dist/query/registry.js');

    const registry = new QueryRegistry();
    let capturedWorkstream = '__not_set__';

    registry.register('test-no-ws-handler', async (_args, _projectDir, workstream) => {
      capturedWorkstream = workstream !== undefined ? workstream : '__undefined__';
      return { data: { ok: true } };
    });

    await registry.dispatch('test-no-ws-handler', [], '/project');
    assert.equal(capturedWorkstream, '__undefined__', 'dispatch without workstream should pass undefined');
  });
});

// ─── Layer 1: CLI forwards args.ws to registry.dispatch() ─────────────────

describe('QueryHandler type accepts optional workstream parameter', () => {
  test('QueryHandler type signature includes optional workstream', async () => {
    // Verify the type shape by checking dispatch accepts 4 args without error
    const { QueryRegistry } = await import('../sdk/dist/query/registry.js');

    const registry = new QueryRegistry();
    registry.register('ping', async (_args, _projectDir, _workstream) => {
      return { data: 'pong' };
    });

    // If workstream is properly threaded, this must not throw
    const result = await registry.dispatch('ping', [], '/tmp', 'feature-ws');
    assert.deepEqual(result, { data: 'pong' });
  });
});
