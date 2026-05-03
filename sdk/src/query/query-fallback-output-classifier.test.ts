import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { classifyFallbackOutput } from './query-fallback-output-classifier.js';

describe('query-fallback-output-classifier', () => {
  it('classifies json output', async () => {
    const out = await classifyFallbackOutput('{"ok":true}', process.cwd());
    expect(out.mode).toBe('json');
  });

  it('classifies text output on invalid json', async () => {
    const out = await classifyFallbackOutput('USAGE', process.cwd());
    expect(out.mode).toBe('text');
  });

  it('resolves @file json output', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'classifier-'));
    try {
      const file = join(dir, 'payload.json');
      await writeFile(file, '{"from":"file"}', 'utf-8');
      const out = await classifyFallbackOutput('@file:payload.json', dir);
      expect(out.mode).toBe('json');
      expect(out.output).toEqual({ from: 'file' });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('classifies empty output as text', async () => {
    const out = await classifyFallbackOutput('   ', process.cwd());
    expect(out.mode).toBe('text');
    expect(out.output).toBe('   ');
  });
});
