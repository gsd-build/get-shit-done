import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runFallbackBridge } from './query-fallback-bridge-adapter.js';

describe('query-fallback-bridge-adapter', () => {
  let tmpDir: string;
  let fixtureDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `fallback-bridge-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fixtureDir = join(tmpDir, 'fixtures');
    await mkdir(fixtureDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('includes stderr text when bridge subprocess fails', async () => {
    const scriptPath = join(fixtureDir, 'fail.cjs');
    await writeFile(scriptPath, "process.stderr.write('bridge boom'); process.exit(2);", { mode: 0o755 });

    await expect(runFallbackBridge({
      projectDir: tmpDir,
      gsdToolsPath: scriptPath,
      normCmd: 'state',
      normArgs: ['load'],
    })).rejects.toThrow(/bridge boom/);
  });
});
