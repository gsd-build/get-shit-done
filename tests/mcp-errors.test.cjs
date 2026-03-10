/**
 * MCP Errors Module - Unit Tests
 *
 * Tests the error envelope pattern and error factories in isolation.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  envelope,
  errorEnvelope,
  GsdError,
  phaseNotFoundError,
  planNotFoundError,
  projectNotFoundError,
  invalidInputError,
} = require('../get-shit-done/bin/lib/mcp/errors.cjs');

// ============================================================================
// envelope() tests
// ============================================================================

describe('envelope()', () => {
  test('wraps data with success=true', () => {
    const result = envelope({ foo: 'bar' });

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.data, { foo: 'bar' });
    assert.strictEqual(result.error, null);
    assert.deepStrictEqual(result.next_actions, []);
  });

  test('includes next_actions when provided', () => {
    const result = envelope({ status: 'ok' }, ['progress', 'health']);

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.next_actions, ['progress', 'health']);
  });

  test('handles null data', () => {
    const result = envelope(null);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data, null);
    assert.strictEqual(result.error, null);
  });

  test('handles array data', () => {
    const result = envelope([1, 2, 3]);

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.data, [1, 2, 3]);
  });

  test('handles primitive data', () => {
    const result = envelope('test string');

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data, 'test string');
  });
});

// ============================================================================
// errorEnvelope() tests
// ============================================================================

describe('errorEnvelope()', () => {
  test('wraps error with success=false', () => {
    const result = errorEnvelope('TEST_ERROR', 'Test message', 'Run /gsd:test');

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.data, null);
    assert.deepStrictEqual(result.error, {
      code: 'TEST_ERROR',
      message: 'Test message',
      recovery: 'Run /gsd:test',
    });
    assert.deepStrictEqual(result.next_actions, []);
  });

  test('includes next_actions when provided', () => {
    const result = errorEnvelope('ERR', 'msg', 'fix', ['health']);

    assert.deepStrictEqual(result.next_actions, ['health']);
  });

  test('all fields are required in error object', () => {
    const result = errorEnvelope('CODE', 'Message', 'Recovery');

    assert.ok('code' in result.error);
    assert.ok('message' in result.error);
    assert.ok('recovery' in result.error);
  });
});

// ============================================================================
// GsdError class tests
// ============================================================================

describe('GsdError', () => {
  test('extends Error', () => {
    const err = new GsdError('CODE', 'message', 'recovery');

    assert.ok(err instanceof Error);
    assert.ok(err instanceof GsdError);
  });

  test('sets all properties', () => {
    const err = new GsdError('MY_CODE', 'My message', 'My recovery', ['action1']);

    assert.strictEqual(err.code, 'MY_CODE');
    assert.strictEqual(err.message, 'My message');
    assert.strictEqual(err.recovery, 'My recovery');
    assert.deepStrictEqual(err.nextActions, ['action1']);
    assert.strictEqual(err.name, 'GsdError');
  });

  test('toEnvelope() returns valid error envelope', () => {
    const err = new GsdError('ERR_CODE', 'Error occurred', 'Try again', ['retry']);
    const result = err.toEnvelope();

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.data, null);
    assert.deepStrictEqual(result.error, {
      code: 'ERR_CODE',
      message: 'Error occurred',
      recovery: 'Try again',
    });
    assert.deepStrictEqual(result.next_actions, ['retry']);
  });

  test('can be thrown and caught', () => {
    const err = new GsdError('THROWN', 'Thrown error', 'Catch it');

    assert.throws(
      () => {
        throw err;
      },
      (thrown) => {
        return thrown instanceof GsdError && thrown.code === 'THROWN';
      }
    );
  });

  test('default nextActions is empty array', () => {
    const err = new GsdError('CODE', 'msg', 'rec');

    assert.deepStrictEqual(err.nextActions, []);
  });
});

// ============================================================================
// Error factory tests
// ============================================================================

describe('phaseNotFoundError()', () => {
  test('creates GsdError with correct code', () => {
    const err = phaseNotFoundError('12');

    assert.ok(err instanceof GsdError);
    assert.strictEqual(err.code, 'PHASE_NOT_FOUND');
  });

  test('includes phase in message', () => {
    const err = phaseNotFoundError('42');

    assert.ok(err.message.includes('42'));
    assert.ok(err.message.includes('.planning/phases/'));
  });

  test('has recovery suggestion with /gsd commands', () => {
    const err = phaseNotFoundError('5');

    assert.ok(err.recovery.includes('/gsd:progress'));
    assert.ok(err.recovery.includes('/gsd:plan-phase'));
  });

  test('suggests progress and roadmap_get as next actions', () => {
    const err = phaseNotFoundError('1');

    assert.ok(err.nextActions.includes('progress'));
    assert.ok(err.nextActions.includes('roadmap_get'));
  });
});

describe('planNotFoundError()', () => {
  test('creates GsdError with correct code', () => {
    const err = planNotFoundError('12', '03');

    assert.ok(err instanceof GsdError);
    assert.strictEqual(err.code, 'PLAN_NOT_FOUND');
  });

  test('includes phase and plan in message', () => {
    const err = planNotFoundError('5', '02');

    assert.ok(err.message.includes('02'));
    assert.ok(err.message.includes('5'));
  });

  test('has recovery suggestion', () => {
    const err = planNotFoundError('3', '01');

    assert.ok(err.recovery.includes('/gsd:progress'));
    assert.ok(err.recovery.includes('3'));
  });

  test('suggests progress and phase_info as next actions', () => {
    const err = planNotFoundError('1', '1');

    assert.ok(err.nextActions.includes('progress'));
    assert.ok(err.nextActions.includes('phase_info'));
  });
});

describe('projectNotFoundError()', () => {
  test('creates GsdError with correct code', () => {
    const err = projectNotFoundError();

    assert.ok(err instanceof GsdError);
    assert.strictEqual(err.code, 'PROJECT_NOT_FOUND');
  });

  test('mentions .planning/ directory', () => {
    const err = projectNotFoundError();

    assert.ok(err.message.includes('.planning/'));
  });

  test('suggests /gsd:init for recovery', () => {
    const err = projectNotFoundError();

    assert.ok(err.recovery.includes('/gsd:init'));
  });

  test('suggests init as next action', () => {
    const err = projectNotFoundError();

    assert.deepStrictEqual(err.nextActions, ['init']);
  });
});

describe('invalidInputError()', () => {
  test('creates GsdError with correct code', () => {
    const err = invalidInputError('phase', 'must be a number');

    assert.ok(err instanceof GsdError);
    assert.strictEqual(err.code, 'INVALID_INPUT');
  });

  test('includes field and reason in message', () => {
    const err = invalidInputError('format', 'must be json or table');

    assert.ok(err.message.includes('format'));
    assert.ok(err.message.includes('must be json or table'));
  });

  test('has generic recovery suggestion', () => {
    const err = invalidInputError('field', 'reason');

    assert.ok(err.recovery.includes('documentation'));
  });

  test('has empty next actions', () => {
    const err = invalidInputError('f', 'r');

    assert.deepStrictEqual(err.nextActions, []);
  });
});

// ============================================================================
// Envelope structure consistency tests
// ============================================================================

describe('envelope structure consistency', () => {
  test('success and error envelopes have same top-level keys', () => {
    const success = envelope({ test: true });
    const error = errorEnvelope('CODE', 'msg', 'rec');

    const successKeys = Object.keys(success).sort();
    const errorKeys = Object.keys(error).sort();

    assert.deepStrictEqual(successKeys, errorKeys);
    assert.deepStrictEqual(successKeys, ['data', 'error', 'next_actions', 'success']);
  });

  test('GsdError.toEnvelope() produces same structure as errorEnvelope()', () => {
    const fromFactory = errorEnvelope('CODE', 'msg', 'rec', ['action']);
    const fromClass = new GsdError('CODE', 'msg', 'rec', ['action']).toEnvelope();

    assert.deepStrictEqual(fromFactory, fromClass);
  });
});
