/**
 * Tests for workstream query handlers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { workstreamList, workstreamCreate } from './workstream.js';

describe('workstreamList', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-ws-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify({ model_profile: 'balanced' }));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns flat mode when no workstreams directory', async () => {
    const r = await workstreamList([], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.mode).toBe('flat');
    expect(Array.isArray(data.workstreams)).toBe(true);
  });
});

describe('workstreamCreate', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-ws2-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify({ model_profile: 'balanced' }));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates workstream directory tree', async () => {
    const r = await workstreamCreate(['test-ws'], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.created).toBe(true);
  });
});
