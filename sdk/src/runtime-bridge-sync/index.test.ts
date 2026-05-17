/**
 * Pinning tests for the executeForCjs synchronous primitive.
 *
 * Covers:
 * - Success path: known read-only command returns { ok: true, data, exitCode: 0 }
 * - unknown_command: unknown command key returns { ok: false, errorKind: 'unknown_command' }
 * - native_failure: handler that throws a generic Error returns { ok: false, errorKind: 'native_failure' }
 * - internal_error mapping tracked as a TODO until a deterministic TypeError fixture exists
 * - Idempotency: calling twice with identical input produces identical output
 * - Sync nature: returned value is not a Promise
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { RuntimeBridgeSyncResult } from './index.js';

// We import after build — the test runner loads the TS via tsx/vitest,
// but executeForCjs creates a Worker which loads the compiled worker.js.
// So we must build before running these tests. In CI, build runs first.
// In local dev, run `npm run build` before vitest.

let executeForCjs: (input: import('./index.js').ExecuteForCjsInput) => RuntimeBridgeSyncResult;

beforeAll(async () => {
  // Dynamic import so we get an actionable error if the module is missing
  // (RED phase: will fail here with "Cannot find module")
  const mod = await import('./index.js');
  executeForCjs = mod.executeForCjs;
});

describe('executeForCjs - sync primitive', () => {
  it('returns a non-Promise object synchronously', () => {
    const result = executeForCjs({
      registryCommand: 'generate-slug',
      registryArgs: ['My Phase'],
      legacyCommand: 'generate-slug',
      legacyArgs: ['My Phase'],
      mode: 'json',
      projectDir: '/tmp',
    });

    // Must NOT be a Promise
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe('object');
    // .ok must be accessible synchronously
    expect('ok' in result).toBe(true);
  });

  it('success: generate-slug returns ok:true with data and exitCode:0', () => {
    const result = executeForCjs({
      registryCommand: 'generate-slug',
      registryArgs: ['My Phase'],
      legacyCommand: 'generate-slug',
      legacyArgs: ['My Phase'],
      mode: 'json',
      projectDir: '/tmp',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.exitCode).toBe(0);
    expect(result.data).toBeDefined();
    // generate-slug returns { slug: 'my-phase' }
    expect((result.data as Record<string, unknown>).slug).toBe('my-phase');
  });

  it('unknown_command: returns ok:false with errorKind unknown_command', () => {
    const result = executeForCjs({
      registryCommand: '__nonexistent_command_xyz__',
      registryArgs: [],
      legacyCommand: '__nonexistent_command_xyz__',
      legacyArgs: [],
      mode: 'json',
      projectDir: '/tmp',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errorKind).toBe('unknown_command');
    expect(result.exitCode).not.toBe(0);
  });

  it('native_failure: handler execution failure is classified as native_failure', () => {
    // generate-slug with no args throws a GSDError (validation) — that maps to validation_error.
    // We need a command that throws a plain Error (GSDToolsError classification.kind='failure').
    //
    // Phase 5.1 fix note: the Phase 5.0 fixture used projectDir='/tmp' with an absolute
    // path arg that started with /tmp — after the worker fix threads projectDir correctly,
    // frontmatter.get returns a soft ok:true error instead of throwing (path escape check
    // passes, then realpath on the nonexistent path returns ok:true with error field).
    // Updated fixture: use a completely nonexistent projectDir so resolvePathUnderProject
    // calls realpath('/nonexistent...') and throws ENOENT, which is classified as native_failure.
    const result = executeForCjs({
      registryCommand: 'frontmatter.get',
      registryArgs: ['file.md'],
      legacyCommand: 'frontmatter get',
      legacyArgs: ['file.md'],
      mode: 'json',
      projectDir: '/nonexistent-absolutely-does-not-exist-project-dir',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errorKind).toBe('native_failure');
    expect(result.exitCode).not.toBe(0);
  });

  it.todo('internal_error: requires fixture command that throws TypeError');

  it('unknown_command: unregistered command is classified as unknown_command', () => {
    const result = executeForCjs({
      registryCommand: '__nonexistent_xyz__',
      registryArgs: [],
      legacyCommand: '__nonexistent_xyz__',
      legacyArgs: [],
      mode: 'json',
      projectDir: '/tmp',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errorKind).toBe('unknown_command');
  });

  it('idempotency: calling twice with identical input returns identical output', () => {
    const input = {
      registryCommand: 'generate-slug',
      registryArgs: ['Idempotency Test'],
      legacyCommand: 'generate-slug',
      legacyArgs: ['Idempotency Test'],
      mode: 'json' as const,
      projectDir: '/tmp',
    };

    const result1 = executeForCjs(input);
    const result2 = executeForCjs(input);

    expect(result1.ok).toBe(result2.ok);
    expect(result1.exitCode).toBe(result2.exitCode);
    if (result1.ok && result2.ok) {
      expect(JSON.stringify(result1.data)).toBe(JSON.stringify(result2.data));
    }
  });

  it('idempotency: unknown command returns same errorKind on repeat calls', () => {
    const input = {
      registryCommand: '__idempotency_test_unknown__',
      registryArgs: [],
      legacyCommand: '__idempotency_test_unknown__',
      legacyArgs: [],
      mode: 'json' as const,
      projectDir: '/tmp',
    };

    const result1 = executeForCjs(input);
    const result2 = executeForCjs(input);

    expect(result1.ok).toBe(false);
    expect(result2.ok).toBe(false);
    if (!result1.ok && !result2.ok) {
      expect(result1.errorKind).toBe(result2.errorKind);
      expect(result1.exitCode).toBe(result2.exitCode);
    }
  });
});
