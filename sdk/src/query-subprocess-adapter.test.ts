import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { QuerySubprocessAdapter } from './query-subprocess-adapter.js';

class FakeToolsError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly args: string[],
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
  }
}

describe('QuerySubprocessAdapter', () => {
  let dir: string;
  let fixtures: string;

  beforeEach(async () => {
    dir = join(tmpdir(), `query-subprocess-adapter-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fixtures = join(dir, 'fixtures');
    await mkdir(fixtures, { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function createScript(name: string, code: string): Promise<string> {
    const scriptPath = join(fixtures, name);
    await writeFile(scriptPath, code, { mode: 0o755 });
    return scriptPath;
  }

  function createAdapter(gsdToolsPath: string): QuerySubprocessAdapter {
    return new QuerySubprocessAdapter({
      projectDir: dir,
      gsdToolsPath,
      timeoutMs: 2_000,
      createToolsError: (message, command, args, exitCode, stderr) =>
        new FakeToolsError(message, command, args, exitCode, stderr) as never,
    });
  }

  it('execJson parses JSON', async () => {
    const script = await createScript('json.cjs', `process.stdout.write(JSON.stringify({ ok: true }));`);
    const adapter = createAdapter(script);

    await expect(adapter.execJson('state', ['load'])).resolves.toEqual({ ok: true });
  });

  it('execJson resolves @file output', async () => {
    const outFile = join(fixtures, 'out.json');
    await writeFile(outFile, JSON.stringify({ from: 'file' }));
    const script = await createScript('file.cjs', `process.stdout.write('@file:${outFile.replace(/\\/g, '\\\\')}');`);
    const adapter = createAdapter(script);

    await expect(adapter.execJson('state', ['load'])).resolves.toEqual({ from: 'file' });
  });

  it('execRaw returns trimmed stdout', async () => {
    const script = await createScript('raw.cjs', `process.stdout.write('  hello  ');`);
    const adapter = createAdapter(script);

    await expect(adapter.execRaw('config-set', ['x', 'y'])).resolves.toBe('hello');
  });
});
