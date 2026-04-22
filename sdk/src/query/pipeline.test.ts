/**
 * Unit tests for pipeline middleware.
 *
 * Tests wrapWithPipeline with dry-run mode, prepare/finalize callbacks,
 * and normal execution passthrough.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { QueryRegistry } from './registry.js';
import { wrapWithPipeline } from './pipeline.js';
import type { QueryResult } from './utils.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-pipeline-'));
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
  await writeFile(join(tmpDir, '.planning', 'STATE.md'), '# State\nstatus: idle\n');
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── Helper ───────────────────────────────────────────────────────────────

function makeRegistry(): QueryRegistry {
  const registry = new QueryRegistry();
  registry.register('read-cmd', async (_args, _dir) => ({ data: { read: true } }));
  registry.register('mut-cmd', async (_args, dir) => {
    // Simulate a mutation: write a file to the project dir
    const { writeFile: wf } = await import('node:fs/promises');
    await wf(join(dir, '.planning', 'MUTATED.md'), '# mutated');
    return { data: { mutated: true } };
  });
  return registry;
}

const MUTATION_SET = new Set(['mut-cmd']);

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('wrapWithPipeline — passthrough (no options)', () => {
  it('read command passes through normally', async () => {
    const registry = makeRegistry();
    wrapWithPipeline(registry, MUTATION_SET, {});
    const result = await registry.dispatch('read-cmd', [], tmpDir);
    expect((result.data as Record<string, unknown>).read).toBe(true);
  });

  it('mutation command executes and writes to disk when dryRun=false', async () => {
    const registry = makeRegistry();
    wrapWithPipeline(registry, MUTATION_SET, { dryRun: false });
    const result = await registry.dispatch('mut-cmd', [], tmpDir);
    expect((result.data as Record<string, unknown>).mutated).toBe(true);
    // File should have been written to the real dir
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(tmpDir, '.planning', 'MUTATED.md'))).toBe(true);
  });
});

describe('wrapWithPipeline — dry-run mode', () => {
  it('dry-run mutation returns diff without writing to disk', async () => {
    const registry = makeRegistry();
    wrapWithPipeline(registry, MUTATION_SET, { dryRun: true });
    const result = await registry.dispatch('mut-cmd', [], tmpDir);
    const data = result.data as Record<string, unknown>;

    // Should be a dry-run result
    expect(data.dry_run).toBe(true);
    expect(data.command).toBe('mut-cmd');
    expect(data.diff).toBeDefined();
    expect(typeof data.changes_summary).toBe('string');

    // Real project should NOT have been written to
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(tmpDir, '.planning', 'MUTATED.md'))).toBe(false);
  });

  it('dry-run diff contains before/after for changed files', async () => {
    const registry = makeRegistry();
    wrapWithPipeline(registry, MUTATION_SET, { dryRun: true });
    const result = await registry.dispatch('mut-cmd', [], tmpDir);
    const data = result.data as Record<string, unknown>;
    const diff = data.diff as Record<string, { before: string | null; after: string | null }>;

    // MUTATED.md is a new file — before should be null
    const mutatedKey = Object.keys(diff).find(k => k.includes('MUTATED'));
    expect(mutatedKey).toBeDefined();
    expect(diff[mutatedKey!].before).toBeNull();
    expect(diff[mutatedKey!].after).toBe('# mutated');
  });

  it('dry-run read command executes normally (side-effect-free)', async () => {
    const registry = makeRegistry();
    wrapWithPipeline(registry, MUTATION_SET, { dryRun: true });
    // read-cmd is NOT in MUTATION_SET, so it's not wrapped at all
    const result = await registry.dispatch('read-cmd', [], tmpDir);
    expect((result.data as Record<string, unknown>).read).toBe(true);
  });

  it('dry-run changes_summary reflects number of changed files', async () => {
    const registry = makeRegistry();
    wrapWithPipeline(registry, MUTATION_SET, { dryRun: true });
    const result = await registry.dispatch('mut-cmd', [], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.changes_summary).toContain('1 file');
  });
});

describe('wrapWithPipeline — prepare/finalize callbacks', () => {
  it('onPrepare fires before mutation execution', async () => {
    const registry = makeRegistry();
    const preparedCommands: string[] = [];
    wrapWithPipeline(registry, MUTATION_SET, {
      onPrepare: async (cmd) => { preparedCommands.push(cmd); },
    });
    await registry.dispatch('mut-cmd', ['arg1'], tmpDir);
    expect(preparedCommands).toContain('mut-cmd');
  });

  it('onFinalize fires after mutation with result', async () => {
    const registry = makeRegistry();
    let capturedResult: QueryResult | null = null;
    wrapWithPipeline(registry, MUTATION_SET, {
      onFinalize: async (_cmd, _args, result) => { capturedResult = result; },
    });
    await registry.dispatch('mut-cmd', [], tmpDir);
    expect(capturedResult).not.toBeNull();
  });

  it('onPrepare receives correct args', async () => {
    const registry = makeRegistry();
    let capturedArgs: string[] = [];
    wrapWithPipeline(registry, MUTATION_SET, {
      onPrepare: async (_cmd, args) => { capturedArgs = args; },
    });
    await registry.dispatch('mut-cmd', ['foo', 'bar'], tmpDir);
    expect(capturedArgs).toEqual(['foo', 'bar']);
  });

  it('onFinalize fires even in dry-run mode', async () => {
    const registry = makeRegistry();
    let finalizeCalled = false;
    wrapWithPipeline(registry, MUTATION_SET, {
      dryRun: true,
      onFinalize: async () => { finalizeCalled = true; },
    });
    await registry.dispatch('mut-cmd', [], tmpDir);
    expect(finalizeCalled).toBe(true);
  });
});

describe('wrapWithPipeline — unregistered command passthrough', () => {
  it('commands not in mutation set are not wrapped', async () => {
    const registry = makeRegistry();
    const spy = vi.fn(async (_args: string[], _dir: string): Promise<QueryResult> => ({ data: { value: 42 } }));
    registry.register('other-cmd', spy);
    wrapWithPipeline(registry, MUTATION_SET, {
      onPrepare: async () => { /* should not fire for non-mutation */ },
    });
    const result = await registry.dispatch('other-cmd', [], tmpDir);
    // Since other-cmd is not in MUTATION_SET, it's not wrapped
    expect((result.data as Record<string, unknown>).value).toBe(42);
  });
});
