import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRegistry } from './index.js';
import { runQueryDispatch } from './query-dispatch.js';
import { createCommandTopology } from './command-topology.js';

describe('runQueryDispatch', () => {
  let tmpDir: string;
  let fixtureDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `query-dispatch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fixtureDir = join(tmpDir, 'fixtures');
    await mkdir(fixtureDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function createScript(name: string, code: string): Promise<string> {
    const scriptPath = join(fixtureDir, name);
    await writeFile(scriptPath, code, { mode: 0o755 });
    return scriptPath;
  }

  it('runs native dispatch and formats json', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => ({ data: { ok: true } }),
      topology: createCommandTopology(registry),
    }, ['state', 'json']);

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.stdout).toBe('{\n  "ok": true\n}\n');
    expect(out.exit_code).toBe(0);
  });

  it('applies --pick to native json output', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => ({ data: { nested: { value: 7 } } }),
      topology: createCommandTopology(registry),
    }, ['state', 'json', '--pick', 'nested.value']);

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.stdout).toBe('7\n');
    expect(out.exit_code).toBe(0);
  });

  it('returns structured error for unknown command when fallback disabled', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: false,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => ({ data: {} }),
      topology: createCommandTopology(registry),
    }, ['unknown-cmd']);

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.error.code).toBe(10);
    expect(out.error.kind).toBe('unknown_command');
    expect(out.error.message).toContain('Unknown command: "unknown-cmd"');
    expect(out.error.message).toContain('Attempted dotted:');
  });

  it('runs cjs fallback and formats text mode', async () => {
    const script = await createScript('text.cjs', "process.stdout.write('USAGE: help text');");
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => script,
      dispatchNative: async () => ({ data: {} }),
      topology: createCommandTopology(registry),
    }, ['unknown-cmd', '--help']);

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected success');
    expect(out.stdout).toBe('USAGE: help text\n');
    expect(out.stderr[0]).toContain('falling back to gsd-tools.cjs');
  });

  it('returns structured fallback failure when resolveGsdToolsPath throws', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => { throw new Error('path boom'); },
      dispatchNative: async () => ({ data: {} }),
      topology: createCommandTopology(registry),
    }, ['unknown-cmd']);

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.error.kind).toBe('fallback_failure');
    expect(out.error.code).toBe(1);
    expect(out.error.message).toContain('path boom');
    expect(out.error.details).toMatchObject({ command: 'unknown-cmd', backend: 'cjs' });
  });

  it('returns requires-command error for empty argv', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => ({ data: {} }),
      topology: createCommandTopology(registry),
    }, []);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.error.code).toBe(10);
    expect(out.error.kind).toBe('validation_error');
    expect(out.error.message).toContain('requires a command');
    expect(out.error.details).toEqual({ reason: 'missing_command' });
  });

  it('maps native timeout to native_timeout kind with details', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => { throw new Error('gsd-tools timed out after 30000ms: state load'); },
      topology: createCommandTopology(registry),
    }, ['state', 'load']);

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.error.kind).toBe('native_timeout');
    expect(out.error.code).toBe(1);
    expect(out.error.details).toMatchObject({ command: 'state.load', args: [], timeout_ms: 30000 });
  });

  it('maps native error to native_failure kind with details', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => { throw new Error('boom'); },
      topology: createCommandTopology(registry),
    }, ['state', 'json']);

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.error.kind).toBe('native_failure');
    expect(out.error.code).toBe(1);
    expect(out.error.details).toMatchObject({ command: 'state.json', args: [] });
  });
});
