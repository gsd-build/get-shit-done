/**
 * Tests for intel query handlers and JSON search helpers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  searchJsonEntries,
  MAX_JSON_SEARCH_DEPTH,
  intelStatus,
  intelSnapshot,
} from './intel.js';

describe('searchJsonEntries', () => {
  it('finds matches in shallow objects', () => {
    const data = { files: [{ name: 'AuthService' }, { name: 'Other' }] };
    const found = searchJsonEntries(data, 'auth');
    expect(found.length).toBeGreaterThan(0);
  });

  it('stops at max depth without throwing', () => {
    let nested: Record<string, unknown> = { leaf: 'findme' };
    for (let i = 0; i < MAX_JSON_SEARCH_DEPTH + 5; i++) {
      nested = { inner: nested };
    }
    const found = searchJsonEntries({ root: nested }, 'findme');
    expect(Array.isArray(found)).toBe(true);
  });
});

describe('intelStatus', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-intel-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify({ model_profile: 'balanced' }));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns disabled when intel.enabled is not true', async () => {
    const r = await intelStatus([], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.disabled).toBe(true);
  });

  it('returns file map when intel is enabled', async () => {
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced', intel: { enabled: true } }),
    );
    const r = await intelStatus([], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.disabled).not.toBe(true);
    expect(data.files).toBeDefined();
  });
});

describe('intelSnapshot', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-intel-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced', intel: { enabled: true } }),
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes .last-refresh.json when intel is enabled', async () => {
    await mkdir(join(tmpDir, '.planning', 'intel'), { recursive: true });
    await writeFile(join(tmpDir, '.planning', 'intel', 'stack.json'), JSON.stringify({ _meta: { updated_at: new Date().toISOString() } }));
    const r = await intelSnapshot([], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.saved).toBe(true);
    const snap = await readFile(join(tmpDir, '.planning', 'intel', '.last-refresh.json'), 'utf-8');
    expect(JSON.parse(snap)).toHaveProperty('hashes');
  });
});
