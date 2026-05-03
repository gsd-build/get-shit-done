import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCjsFallbackQuery } from './query-fallback-executor.js';

describe('runCjsFallbackQuery', () => {
  let tmpDir: string;
  let fixtureDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `fallback-exec-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

  it('returns json mode when stdout is json', async () => {
    const script = await createScript('json.cjs', "process.stdout.write(JSON.stringify({ok:true}));");
    const result = await runCjsFallbackQuery(tmpDir, script, 'state', ['load'], undefined);
    expect(result.mode).toBe('json');
    expect(result.output).toEqual({ ok: true });
  });

  it('returns text mode when stdout is non-json', async () => {
    const script = await createScript('text.cjs', "process.stdout.write('USAGE: help text');");
    const result = await runCjsFallbackQuery(tmpDir, script, 'phase', ['add', '--help'], undefined);
    expect(result.mode).toBe('text');
    expect(result.output).toBe('USAGE: help text');
  });

  it('passes ws flag to cjs command', async () => {
    const script = await createScript('ws.cjs', "const args=process.argv.slice(2); process.stdout.write(JSON.stringify({args}));");
    const result = await runCjsFallbackQuery(tmpDir, script, 'state', ['load'], 'ws-1');
    expect(result.mode).toBe('json');
    expect((result.output as { args: string[] }).args).toEqual(['state', 'load', '--ws', 'ws-1']);
  });
});
