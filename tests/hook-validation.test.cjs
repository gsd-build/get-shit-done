/**
 * GSD Tools Tests - Hook Field Validation
 *
 * Tests for validateHookFields() which prevents silent settings.json
 * rejection by removing hook entries that fail Claude Code's Zod schema.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { validateHookFields } = require('../bin/install.js');

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Deep-clone to avoid cross-test mutation. */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Build a valid command hook entry. */
function commandEntry(command, matcher = 'gsd-test') {
  return {
    matcher,
    hooks: [{ type: 'command', command }],
  };
}

/** Build a valid agent hook entry. */
function agentEntry(prompt, matcher = 'gsd-test') {
  return {
    matcher,
    hooks: [{ type: 'agent', prompt }],
  };
}

// ─── No-op / passthrough cases ──────────────────────────────────────────────

describe('validateHookFields — passthrough', () => {
  test('returns settings unchanged when no hooks key exists', () => {
    const settings = { theme: 'dark' };
    const result = validateHookFields(clone(settings));
    assert.deepStrictEqual(result, settings);
  });

  test('returns settings unchanged when hooks is null', () => {
    const settings = { hooks: null };
    const result = validateHookFields(clone(settings));
    assert.deepStrictEqual(result, settings);
  });

  test('returns settings unchanged when hooks is a non-object primitive', () => {
    const settings = { hooks: 42 };
    const result = validateHookFields(clone(settings));
    assert.deepStrictEqual(result, settings);
  });

  test('preserves valid command hooks', () => {
    const settings = {
      hooks: {
        PostToolUse: [commandEntry('echo hello')],
      },
    };
    const input = clone(settings);
    const result = validateHookFields(input);
    assert.deepStrictEqual(result.hooks.PostToolUse, [commandEntry('echo hello')]);
  });

  test('preserves valid agent hooks', () => {
    const settings = {
      hooks: {
        SessionStart: [agentEntry('do something')],
      },
    };
    const input = clone(settings);
    const result = validateHookFields(input);
    assert.deepStrictEqual(result.hooks.SessionStart, [agentEntry('do something')]);
  });

  test('preserves mixed valid hooks across event types', () => {
    const settings = {
      hooks: {
        PostToolUse: [commandEntry('echo a')],
        Stop: [agentEntry('summarize')],
      },
    };
    const input = clone(settings);
    const result = validateHookFields(input);
    assert.strictEqual(Object.keys(result.hooks).length, 2);
    assert.strictEqual(result.hooks.PostToolUse.length, 1);
    assert.strictEqual(result.hooks.Stop.length, 1);
  });

  test('skips non-array event type values', () => {
    const settings = {
      hooks: {
        PostToolUse: 'not-an-array',
        Stop: [commandEntry('echo ok')],
      },
    };
    const input = clone(settings);
    const result = validateHookFields(input);
    // Non-array value left untouched
    assert.strictEqual(result.hooks.PostToolUse, 'not-an-array');
    assert.strictEqual(result.hooks.Stop.length, 1);
  });
});

// ─── Removal of invalid hooks ───────────────────────────────────────────────

describe('validateHookFields — removes invalid hooks', () => {
  test('removes agent hook missing prompt field', () => {
    const settings = {
      hooks: {
        Stop: [{
          matcher: 'test',
          hooks: [{ type: 'agent' }],  // missing prompt
        }],
      },
    };
    const result = validateHookFields(clone(settings));
    // Entry had only one hook and it was invalid, so entry is dropped
    // Event array is now empty, so the key is removed
    assert.strictEqual(result.hooks.Stop, undefined);
  });

  test('removes command hook missing command field', () => {
    const settings = {
      hooks: {
        PostToolUse: [{
          matcher: 'test',
          hooks: [{ type: 'command' }],  // missing command
        }],
      },
    };
    const result = validateHookFields(clone(settings));
    assert.strictEqual(result.hooks.PostToolUse, undefined);
  });

  test('keeps valid hooks and removes invalid ones within same entry', () => {
    const settings = {
      hooks: {
        Stop: [{
          matcher: 'test',
          hooks: [
            { type: 'command', command: 'echo valid' },
            { type: 'agent' },  // invalid — no prompt
            { type: 'command' },  // invalid — no command
          ],
        }],
      },
    };
    const result = validateHookFields(clone(settings));
    assert.strictEqual(result.hooks.Stop.length, 1);
    assert.strictEqual(result.hooks.Stop[0].hooks.length, 1);
    assert.strictEqual(result.hooks.Stop[0].hooks[0].command, 'echo valid');
  });

  test('removes entry when all its hooks are invalid', () => {
    const settings = {
      hooks: {
        SessionStart: [
          {
            matcher: 'bad',
            hooks: [
              { type: 'agent' },   // no prompt
              { type: 'command' },  // no command
            ],
          },
          commandEntry('echo keeper'),
        ],
      },
    };
    const result = validateHookFields(clone(settings));
    assert.strictEqual(result.hooks.SessionStart.length, 1);
    assert.strictEqual(result.hooks.SessionStart[0].hooks[0].command, 'echo keeper');
  });
});

// ─── Entries without hooks sub-array (issue #2 from review) ─────────────────

describe('validateHookFields — entries without hooks sub-array', () => {
  test('removes entry with missing hooks property', () => {
    const settings = {
      hooks: {
        Stop: [{ matcher: 'orphan' }],  // no hooks sub-array
      },
    };
    const result = validateHookFields(clone(settings));
    assert.strictEqual(result.hooks.Stop, undefined);
  });

  test('removes entry with null hooks property', () => {
    const settings = {
      hooks: {
        Stop: [{ matcher: 'orphan', hooks: null }],
      },
    };
    const result = validateHookFields(clone(settings));
    assert.strictEqual(result.hooks.Stop, undefined);
  });

  test('removes entry with non-array hooks property', () => {
    const settings = {
      hooks: {
        Stop: [{ matcher: 'orphan', hooks: 'not-an-array' }],
      },
    };
    const result = validateHookFields(clone(settings));
    assert.strictEqual(result.hooks.Stop, undefined);
  });

  test('removes structurally invalid entry but keeps valid sibling', () => {
    const settings = {
      hooks: {
        PostToolUse: [
          { matcher: 'bad' },  // no hooks sub-array
          commandEntry('echo good'),
        ],
      },
    };
    const result = validateHookFields(clone(settings));
    assert.strictEqual(result.hooks.PostToolUse.length, 1);
    assert.strictEqual(result.hooks.PostToolUse[0].hooks[0].command, 'echo good');
  });
});

// ─── Empty event array cleanup ──────────────────────────────────────────────

describe('validateHookFields — empty event array cleanup', () => {
  test('removes event type key when all entries are invalid', () => {
    const settings = {
      hooks: {
        Stop: [{ matcher: 'a', hooks: [{ type: 'agent' }] }],
        PostToolUse: [commandEntry('echo keep')],
      },
    };
    const result = validateHookFields(clone(settings));
    assert.strictEqual(result.hooks.Stop, undefined);
    assert.strictEqual(result.hooks.PostToolUse.length, 1);
  });

  test('removes event type key when array was already empty', () => {
    const settings = {
      hooks: {
        Stop: [],
        PostToolUse: [commandEntry('echo keep')],
      },
    };
    const result = validateHookFields(clone(settings));
    assert.strictEqual(result.hooks.Stop, undefined);
    assert.ok(result.hooks.PostToolUse);
  });

  test('removes all event types when all are invalid', () => {
    const settings = {
      hooks: {
        Stop: [{ matcher: 'a', hooks: [{ type: 'agent' }] }],
        SessionStart: [{ matcher: 'b', hooks: [{ type: 'command' }] }],
      },
    };
    const result = validateHookFields(clone(settings));
    assert.deepStrictEqual(result.hooks, {});
  });
});

// ─── No mutation of original entries (issue #3 from review) ─────────────────

describe('validateHookFields — no input mutation', () => {
  test('does not mutate the original entry objects', () => {
    const original = {
      matcher: 'test',
      hooks: [
        { type: 'command', command: 'echo valid' },
        { type: 'agent' },  // invalid
      ],
    };
    const settings = {
      hooks: {
        Stop: [original],
      },
    };
    // Capture original hooks array length before validation
    const origHooksLength = original.hooks.length;
    validateHookFields(settings);
    // Original entry's hooks array must not be modified
    assert.strictEqual(original.hooks.length, origHooksLength);
  });

  test('result entry is a copy, not the same object reference', () => {
    const entry = commandEntry('echo test');
    const settings = {
      hooks: {
        Stop: [entry],
      },
    };
    const result = validateHookFields(settings);
    assert.notStrictEqual(result.hooks.Stop[0], entry);
    assert.deepStrictEqual(result.hooks.Stop[0], entry);
  });
});

// ─── Unknown hook types pass through (issue #4 — scope) ─────────────────────

describe('validateHookFields — unknown hook types', () => {
  test('preserves hooks with unrecognized type (future-proof)', () => {
    const settings = {
      hooks: {
        Stop: [{
          matcher: 'test',
          hooks: [{ type: 'webhook', url: 'https://example.com' }],
        }],
      },
    };
    const result = validateHookFields(clone(settings));
    assert.strictEqual(result.hooks.Stop.length, 1);
    assert.strictEqual(result.hooks.Stop[0].hooks[0].type, 'webhook');
  });

  test('preserves hooks with no type field', () => {
    const settings = {
      hooks: {
        Stop: [{
          matcher: 'test',
          hooks: [{ command: 'echo untyped' }],
        }],
      },
    };
    const result = validateHookFields(clone(settings));
    assert.strictEqual(result.hooks.Stop.length, 1);
  });
});

// ─── Iteration safety (issue #5 — no delete during Object.keys iteration) ──

describe('validateHookFields — iteration safety', () => {
  test('handles multiple event types with mixed validity without corruption', () => {
    const settings = {
      hooks: {
        A: [{ matcher: 'a', hooks: [{ type: 'agent' }] }],          // invalid
        B: [commandEntry('echo b')],                                   // valid
        C: [{ matcher: 'c', hooks: [{ type: 'command' }] }],          // invalid
        D: [agentEntry('do d')],                                       // valid
        E: [{ matcher: 'e', hooks: [{ type: 'agent' }] }],            // invalid
      },
    };
    const result = validateHookFields(clone(settings));
    assert.strictEqual(result.hooks.A, undefined);
    assert.strictEqual(result.hooks.B.length, 1);
    assert.strictEqual(result.hooks.C, undefined);
    assert.strictEqual(result.hooks.D.length, 1);
    assert.strictEqual(result.hooks.E, undefined);
  });
});

// ─── Preserves non-hook settings ────────────────────────────────────────────

describe('validateHookFields — does not touch non-hook settings', () => {
  test('preserves all other settings keys', () => {
    const settings = {
      theme: 'dark',
      plugins: ['a', 'b'],
      statusLine: { command: 'echo hi' },
      hooks: {
        Stop: [commandEntry('echo keep')],
      },
    };
    const result = validateHookFields(clone(settings));
    assert.strictEqual(result.theme, 'dark');
    assert.deepStrictEqual(result.plugins, ['a', 'b']);
    assert.deepStrictEqual(result.statusLine, { command: 'echo hi' });
  });
});
