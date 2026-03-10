/**
 * MCP Tools Module - Unit Tests
 *
 * Tests the tool helpers, constants, and utility functions.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  CORE_TOOLS,
  EXTENDED_TOOLS,
  ensureProject,
  suggestNextActions,
  formatResponse,
} = require('../get-shit-done/bin/lib/mcp/tools.cjs');

const { GsdError } = require('../get-shit-done/bin/lib/mcp/errors.cjs');

// ============================================================================
// CORE_TOOLS constant tests
// ============================================================================

describe('CORE_TOOLS', () => {
  test('is an array', () => {
    assert.ok(Array.isArray(CORE_TOOLS));
  });

  test('contains expected tool names', () => {
    assert.ok(CORE_TOOLS.includes('progress'));
    assert.ok(CORE_TOOLS.includes('health'));
    assert.ok(CORE_TOOLS.includes('state_get'));
    assert.ok(CORE_TOOLS.includes('phase_info'));
    assert.ok(CORE_TOOLS.includes('roadmap_get'));
  });

  test('has exactly 5 tools', () => {
    assert.strictEqual(CORE_TOOLS.length, 5);
  });

  test('all tools are strings', () => {
    CORE_TOOLS.forEach((tool) => {
      assert.strictEqual(typeof tool, 'string');
    });
  });

  test('no duplicates', () => {
    const unique = [...new Set(CORE_TOOLS)];
    assert.strictEqual(unique.length, CORE_TOOLS.length);
  });
});

// ============================================================================
// EXTENDED_TOOLS constant tests
// ============================================================================

describe('EXTENDED_TOOLS', () => {
  test('is an array', () => {
    assert.ok(Array.isArray(EXTENDED_TOOLS));
  });

  test('contains expected tool names', () => {
    assert.ok(EXTENDED_TOOLS.includes('plan_phase'));
    assert.ok(EXTENDED_TOOLS.includes('execute_phase'));
    assert.ok(EXTENDED_TOOLS.includes('state_update'));
    assert.ok(EXTENDED_TOOLS.includes('phase_complete'));
  });

  test('has exactly 4 tools', () => {
    assert.strictEqual(EXTENDED_TOOLS.length, 4);
  });

  test('all tools are strings', () => {
    EXTENDED_TOOLS.forEach((tool) => {
      assert.strictEqual(typeof tool, 'string');
    });
  });

  test('no duplicates', () => {
    const unique = [...new Set(EXTENDED_TOOLS)];
    assert.strictEqual(unique.length, EXTENDED_TOOLS.length);
  });

  test('no overlap with CORE_TOOLS', () => {
    const overlap = EXTENDED_TOOLS.filter((t) => CORE_TOOLS.includes(t));
    assert.strictEqual(overlap.length, 0, `Overlap found: ${overlap.join(', ')}`);
  });
});

// ============================================================================
// ensureProject() tests
// ============================================================================

describe('ensureProject()', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-mcp-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('throws GsdError when .planning/ does not exist', () => {
    assert.throws(
      () => ensureProject(tmpDir),
      (err) => {
        return err instanceof GsdError && err.code === 'PROJECT_NOT_FOUND';
      }
    );
  });

  test('does not throw when .planning/ exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'));

    assert.doesNotThrow(() => ensureProject(tmpDir));
  });

  test('error has recovery suggestion', () => {
    try {
      ensureProject(tmpDir);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.recovery.includes('/gsd:init'));
    }
  });
});

// ============================================================================
// suggestNextActions() tests
// ============================================================================

describe('suggestNextActions()', () => {
  test('returns array for known context', () => {
    const result = suggestNextActions('progress');

    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
  });

  test('returns empty array for unknown context', () => {
    const result = suggestNextActions('unknown_context');

    assert.deepStrictEqual(result, []);
  });

  test('progress suggests health and phase_info', () => {
    const result = suggestNextActions('progress');

    assert.ok(result.includes('health'));
    assert.ok(result.includes('phase_info'));
  });

  test('health suggests progress', () => {
    const result = suggestNextActions('health');

    assert.ok(result.includes('progress'));
  });

  test('state_get suggests roadmap_get and progress', () => {
    const result = suggestNextActions('state_get');

    assert.ok(result.includes('roadmap_get'));
    assert.ok(result.includes('progress'));
  });

  test('phase_info suggests roadmap_get and state_get', () => {
    const result = suggestNextActions('phase_info');

    assert.ok(result.includes('roadmap_get'));
    assert.ok(result.includes('state_get'));
  });

  test('roadmap_get suggests phase_info and progress', () => {
    const result = suggestNextActions('roadmap_get');

    assert.ok(result.includes('phase_info'));
    assert.ok(result.includes('progress'));
  });

  test('plan_phase suggests execute_phase and progress', () => {
    const result = suggestNextActions('plan_phase');

    assert.ok(result.includes('execute_phase'));
    assert.ok(result.includes('progress'));
  });

  test('execute_phase suggests progress and health', () => {
    const result = suggestNextActions('execute_phase');

    assert.ok(result.includes('progress'));
    assert.ok(result.includes('health'));
  });

  test('state_update suggests state_get', () => {
    const result = suggestNextActions('state_update');

    assert.ok(result.includes('state_get'));
  });

  test('phase_complete suggests progress and roadmap_get', () => {
    const result = suggestNextActions('phase_complete');

    assert.ok(result.includes('progress'));
    assert.ok(result.includes('roadmap_get'));
  });
});

// ============================================================================
// formatResponse() tests
// ============================================================================

describe('formatResponse()', () => {
  test('wraps envelope in MCP content format', () => {
    const env = { success: true, data: { foo: 'bar' }, error: null, next_actions: [] };
    const result = formatResponse(env);

    assert.ok('content' in result);
    assert.ok(Array.isArray(result.content));
    assert.strictEqual(result.content.length, 1);
  });

  test('content item has type=text', () => {
    const env = { success: true, data: null, error: null, next_actions: [] };
    const result = formatResponse(env);

    assert.strictEqual(result.content[0].type, 'text');
  });

  test('content item has JSON string in text field', () => {
    const env = { success: true, data: { test: 123 }, error: null, next_actions: [] };
    const result = formatResponse(env);

    const parsed = JSON.parse(result.content[0].text);
    assert.deepStrictEqual(parsed.data, { test: 123 });
  });

  test('preserves envelope structure in output', () => {
    const env = {
      success: false,
      data: null,
      error: { code: 'ERR', message: 'msg', recovery: 'rec' },
      next_actions: ['action1'],
    };
    const result = formatResponse(env);

    const parsed = JSON.parse(result.content[0].text);
    assert.strictEqual(parsed.success, false);
    assert.strictEqual(parsed.error.code, 'ERR');
    assert.deepStrictEqual(parsed.next_actions, ['action1']);
  });

  test('produces pretty-printed JSON', () => {
    const env = { success: true, data: {}, error: null, next_actions: [] };
    const result = formatResponse(env);

    // Pretty-printed JSON has newlines
    assert.ok(result.content[0].text.includes('\n'));
  });
});

// ============================================================================
// Tool tier completeness tests
// ============================================================================

describe('tool tier completeness', () => {
  test('all 9 tools are defined across both tiers', () => {
    const allTools = [...CORE_TOOLS, ...EXTENDED_TOOLS];
    assert.strictEqual(allTools.length, 9);
  });

  test('core tier has read-only operations', () => {
    // Core tools should not modify state
    const expectedReadOnly = ['progress', 'health', 'state_get', 'phase_info', 'roadmap_get'];
    expectedReadOnly.forEach((tool) => {
      assert.ok(CORE_TOOLS.includes(tool), `${tool} should be in CORE_TOOLS`);
    });
  });

  test('extended tier has mutation operations', () => {
    // Extended tools can modify state
    const expectedMutations = ['plan_phase', 'execute_phase', 'state_update', 'phase_complete'];
    expectedMutations.forEach((tool) => {
      assert.ok(EXTENDED_TOOLS.includes(tool), `${tool} should be in EXTENDED_TOOLS`);
    });
  });
});
