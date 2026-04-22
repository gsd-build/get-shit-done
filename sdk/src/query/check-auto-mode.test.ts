/**
 * Unit tests for `check.auto-mode` (decision-routing audit §3.5).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkAutoMode } from './check-auto-mode.js';

describe('checkAutoMode', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(tmpdir(), `gsd-auto-mode-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(projectDir, '.planning'), { recursive: true });
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('returns defaults when config.json is missing', async () => {
    const { data } = await checkAutoMode([], projectDir);
    expect(data).toEqual({
      active: false,
      source: 'none',
      auto_chain_active: false,
      auto_advance: false,
    });
  });

  it('active true when only auto_advance is set', async () => {
    await writeFile(
      join(projectDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { auto_advance: true } }),
      'utf-8',
    );
    const { data } = await checkAutoMode([], projectDir);
    expect(data).toMatchObject({
      active: true,
      source: 'auto_advance',
      auto_advance: true,
      auto_chain_active: false,
    });
  });

  it('active true when only _auto_chain_active is set', async () => {
    await writeFile(
      join(projectDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { _auto_chain_active: true } }),
      'utf-8',
    );
    const { data } = await checkAutoMode([], projectDir);
    expect(data).toMatchObject({
      active: true,
      source: 'auto_chain',
      auto_advance: false,
      auto_chain_active: true,
    });
  });

  it('uses source both when both flags are true', async () => {
    await writeFile(
      join(projectDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { auto_advance: true, _auto_chain_active: true } }),
      'utf-8',
    );
    const { data } = await checkAutoMode([], projectDir);
    expect(data).toMatchObject({
      active: true,
      source: 'both',
      auto_advance: true,
      auto_chain_active: true,
    });
  });
});
