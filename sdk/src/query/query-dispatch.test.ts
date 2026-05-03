import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRegistry } from './index.js';
import { runQueryDispatch } from './query-dispatch.js';

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
    }, ['state', 'json']);

    expect(out.error).toBeUndefined();
    expect(out.stdout).toBe('{\n  "ok": true\n}\n');
  });

  it('applies --pick to native json output', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => ({ data: { nested: { value: 7 } } }),
    }, ['state', 'json', '--pick', 'nested.value']);

    expect(out.error).toBeUndefined();
    expect(out.stdout).toBe('7\n');
  });

  it('returns structured error for unknown command when fallback disabled', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: false,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => ({ data: {} }),
    }, ['unknown-cmd']);

    expect(out.error?.code).toBe(10);
    expect(out.error?.message).toContain('Unknown command: "unknown-cmd"');
    expect(out.error?.message).toContain('Attempted dotted:');
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
    }, ['unknown-cmd', '--help']);

    expect(out.error).toBeUndefined();
    expect(out.stdout).toBe('USAGE: help text\n');
    expect(out.stderr[0]).toContain('falling back to gsd-tools.cjs');
  });

  it('returns requires-command error for empty argv', async () => {
    const registry = createRegistry();
    const out = await runQueryDispatch({
      registry,
      projectDir: tmpDir,
      cjsFallbackEnabled: true,
      resolveGsdToolsPath: () => '',
      dispatchNative: async () => ({ data: {} }),
    }, []);
    expect(out.error?.code).toBe(10);
    expect(out.error?.message).toContain('requires a command');
  });
});
