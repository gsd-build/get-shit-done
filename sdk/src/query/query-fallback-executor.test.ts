import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCjsFallbackDispatch } from './query-fallback-executor.js';

describe('runCjsFallbackDispatch', () => {
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

  it('returns json output', async () => {
    const script = await createScript('json.cjs', "process.stdout.write(JSON.stringify({ok:true}));");
    const result = await runCjsFallbackDispatch({
      projectDir: tmpDir,
      gsdToolsPath: script,
      normCmd: 'state',
      normArgs: ['load'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.stdout).toBe('{\n  "ok": true\n}\n');
  });

  it('returns text output with trailing newline', async () => {
    const script = await createScript('text.cjs', "process.stdout.write('USAGE: help text');");
    const result = await runCjsFallbackDispatch({
      projectDir: tmpDir,
      gsdToolsPath: script,
      normCmd: 'phase',
      normArgs: ['add', '--help'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.stdout).toBe('USAGE: help text\n');
  });

  it('passes ws flag to cjs command', async () => {
    const script = await createScript('ws.cjs', "const args=process.argv.slice(2); process.stdout.write(JSON.stringify({args}));");
    const result = await runCjsFallbackDispatch({
      projectDir: tmpDir,
      gsdToolsPath: script,
      normCmd: 'state',
      normArgs: ['load'],
      ws: 'ws-1',
      pickField: 'args',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.stdout).toBe('[\n  "state",\n  "load",\n  "--ws",\n  "ws-1"\n]\n');
  });

  it('returns structured error when subprocess fails', async () => {
    const result = await runCjsFallbackDispatch({
      projectDir: tmpDir,
      gsdToolsPath: join(fixtureDir, 'missing.cjs'),
      normCmd: 'state',
      normArgs: ['load'],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.code).toBe(1);
    expect(result.error.kind).toBe('fallback_failure');
    expect(result.error.message).toContain('fallback failed');
    expect(result.error.details).toMatchObject({ command: 'state', args: ['load'], backend: 'cjs' });
  });
});
