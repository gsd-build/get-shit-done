/**
 * Unit tests for runtime-gate.ts
 *
 * Regression tests for #2832: gsd-sdk auto silently routed Codex (and other
 * non-Claude) runtime projects through the Claude Agent SDK, picked
 * Claude-Sonnet defaults from the profile map, and reported instant failures.
 * The gate fails fast with an actionable error so users either set the right
 * runtime or fall back to the in-session GSD slash commands.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertRuntimeSupportsAutoMode } from './runtime-gate.js';

describe('assertRuntimeSupportsAutoMode', () => {
  let prevEnv: string | undefined;
  beforeEach(() => {
    prevEnv = process.env.GSD_RUNTIME;
    delete process.env.GSD_RUNTIME;
  });
  afterEach(() => {
    if (prevEnv === undefined) delete process.env.GSD_RUNTIME;
    else process.env.GSD_RUNTIME = prevEnv;
  });

  it('passes for runtime: claude (config)', () => {
    expect(() => assertRuntimeSupportsAutoMode({ runtime: 'claude' })).not.toThrow();
  });

  it('passes when no runtime configured (defaults to claude)', () => {
    expect(() => assertRuntimeSupportsAutoMode(undefined)).not.toThrow();
    expect(() => assertRuntimeSupportsAutoMode({})).not.toThrow();
  });

  it('throws for runtime: codex via config', () => {
    expect(() => assertRuntimeSupportsAutoMode({ runtime: 'codex' })).toThrow(/codex/);
  });

  it('throws for GSD_RUNTIME=codex even when config says claude', () => {
    process.env.GSD_RUNTIME = 'codex';
    expect(() => assertRuntimeSupportsAutoMode({ runtime: 'claude' })).toThrow(/codex/);
  });

  it('error message references issue #2832 and slash-command workaround', () => {
    let caught: Error | undefined;
    try {
      assertRuntimeSupportsAutoMode({ runtime: 'codex' });
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).toBeDefined();
    expect(caught!.message).toMatch(/#2832/);
    expect(caught!.message).toMatch(/gsd-discuss-phase|gsd-plan-phase|gsd-execute-phase/);
  });

  it('throws for gemini runtime', () => {
    expect(() => assertRuntimeSupportsAutoMode({ runtime: 'gemini' })).toThrow();
  });

  it('throws for opencode runtime', () => {
    expect(() => assertRuntimeSupportsAutoMode({ runtime: 'opencode' })).toThrow();
  });

  it('passes for unknown runtime values (fall through to claude default)', () => {
    // Mirrors detectRuntime: unknown values are NOT in SUPPORTED_RUNTIMES,
    // so they fall through to 'claude' rather than hard-blocking.
    expect(() => assertRuntimeSupportsAutoMode({ runtime: 'totally-bogus' })).not.toThrow();
  });

  it('attributes source to config when GSD_RUNTIME is set to an unsupported value', () => {
    // Unsupported env values fall through to config in detectRuntime; the
    // gate's error message must report config (not the discarded env value)
    // as the source so users debug the right thing.
    process.env.GSD_RUNTIME = 'unsupported-env';
    let caught: Error | undefined;
    try {
      assertRuntimeSupportsAutoMode({ runtime: 'codex' });
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).toBeDefined();
    expect(caught!.message).toMatch(/config\.runtime="codex"/);
    expect(caught!.message).not.toMatch(/GSD_RUNTIME=unsupported-env/);
  });
});
