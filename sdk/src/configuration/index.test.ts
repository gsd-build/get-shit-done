/**
 * Pinning tests for the Configuration Module (ADR-3524 §6).
 *
 * These tests pin the public interface contract. They are RED until
 * sdk/src/configuration/index.ts is created (Cycle 2).
 *
 * Test precedent: sdk/src/config.test.ts (vitest + fs fixtures).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  loadConfig,
  normalizeLegacyKeys,
  mergeDefaults,
  migrateOnDisk,
  CONFIG_DEFAULTS,
} from './index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-cfg-test-'));
  mkdirSync(join(dir, '.planning'), { recursive: true });
  return dir;
}

function writeConfig(dir: string, data: unknown): void {
  writeFileSync(join(dir, '.planning', 'config.json'), JSON.stringify(data, null, 2));
}

function readConfigRaw(dir: string): string {
  return readFileSync(join(dir, '.planning', 'config.json'), 'utf-8');
}

function cleanupDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

// ─── loadConfig ──────────────────────────────────────────────────────────────

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpProject();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('returns CONFIG_DEFAULTS when config.json is missing', async () => {
    const config = await loadConfig(tmpDir);
    expect(config).toEqual(CONFIG_DEFAULTS);
  });

  it('returns CONFIG_DEFAULTS when config.json is empty {}', async () => {
    writeConfig(tmpDir, {});
    const config = await loadConfig(tmpDir);
    expect(config).toEqual(CONFIG_DEFAULTS);
  });

  it('returns nested git.branching_strategy when already nested', async () => {
    writeConfig(tmpDir, { git: { branching_strategy: 'phase' } });
    const config = await loadConfig(tmpDir);
    expect(config.git.branching_strategy).toBe('phase');
  });

  it('normalizes legacy top-level branching_strategy to git.branching_strategy', async () => {
    writeConfig(tmpDir, { branching_strategy: 'phase' });
    const config = await loadConfig(tmpDir);
    expect(config.git.branching_strategy).toBe('phase');
  });

  it('does NOT write disk when normalizing legacy branching_strategy', async () => {
    writeConfig(tmpDir, { branching_strategy: 'phase' });
    const before = readConfigRaw(tmpDir);
    await loadConfig(tmpDir);
    const after = readConfigRaw(tmpDir);
    expect(after).toBe(before);
  });

  it('normalizes legacy top-level sub_repos to planning.sub_repos', async () => {
    writeConfig(tmpDir, { sub_repos: ['app1', 'app2'] });
    const config = await loadConfig(tmpDir);
    expect((config.planning as Record<string, unknown>)?.sub_repos).toEqual(['app1', 'app2']);
  });

  it('handles legacy depth: comprehensive → planning.granularity: fine', async () => {
    writeConfig(tmpDir, { depth: 'comprehensive' });
    const config = await loadConfig(tmpDir);
    // depth is a legacy key that maps to granularity
    const granularity = (config as Record<string, unknown>).granularity
      ?? (config.planning as Record<string, unknown> | undefined)?.granularity;
    expect(granularity).toBe('fine');
  });

  it('handles legacy depth: quick → coarse', async () => {
    writeConfig(tmpDir, { depth: 'quick' });
    const config = await loadConfig(tmpDir);
    const granularity = (config as Record<string, unknown>).granularity
      ?? (config.planning as Record<string, unknown> | undefined)?.granularity;
    expect(granularity).toBe('coarse');
  });

  it('handles legacy depth: standard → standard', async () => {
    writeConfig(tmpDir, { depth: 'standard' });
    const config = await loadConfig(tmpDir);
    const granularity = (config as Record<string, unknown>).granularity
      ?? (config.planning as Record<string, unknown> | undefined)?.granularity;
    expect(granularity).toBe('standard');
  });

  it('throws with informative error on malformed JSON', async () => {
    writeFileSync(join(tmpDir, '.planning', 'config.json'), '{bad json');
    await expect(loadConfig(tmpDir)).rejects.toThrow(/parse|invalid|json/i);
  });

  it('does not throw when .planning/config.json is missing — returns defaults', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gsd-cfg-noplan-'));
    // intentionally no .planning dir
    try {
      const config = await loadConfig(dir);
      expect(config).toEqual(CONFIG_DEFAULTS);
    } finally {
      cleanupDir(dir);
    }
  });
});

// ─── normalizeLegacyKeys ─────────────────────────────────────────────────────

describe('normalizeLegacyKeys', () => {
  it('migrates top-level branching_strategy to git.branching_strategy', () => {
    const input = { branching_strategy: 'phase' };
    const { parsed, normalizations } = normalizeLegacyKeys(input);
    expect((parsed as Record<string, unknown>).branching_strategy).toBeUndefined();
    expect((parsed as Record<string, Record<string, unknown>>).git?.branching_strategy).toBe('phase');
    expect(normalizations).toHaveLength(1);
    expect(normalizations[0]).toMatchObject({ from: 'branching_strategy', to: 'git.branching_strategy', value: 'phase' });
  });

  it('migrates top-level sub_repos to planning.sub_repos', () => {
    const input = { sub_repos: ['app1', 'app2'] };
    const { parsed, normalizations } = normalizeLegacyKeys(input);
    expect((parsed as Record<string, unknown>).sub_repos).toBeUndefined();
    expect((parsed as Record<string, Record<string, unknown>>).planning?.sub_repos).toEqual(['app1', 'app2']);
    expect(normalizations).toHaveLength(1);
    expect(normalizations[0]).toMatchObject({ from: 'sub_repos', to: 'planning.sub_repos', value: ['app1', 'app2'] });
  });

  it('migrates multiRepo: true to planning.sub_repos marker', () => {
    const input = { multiRepo: true };
    const { parsed, normalizations } = normalizeLegacyKeys(input);
    expect((parsed as Record<string, unknown>).multiRepo).toBeUndefined();
    expect(normalizations).toHaveLength(1);
    expect(normalizations[0]).toMatchObject({ from: 'multiRepo', to: 'planning.sub_repos', requiresFilesystem: true });
  });

  it('migrates top-level depth to granularity (comprehensive → fine)', () => {
    const input = { depth: 'comprehensive' };
    const { parsed, normalizations } = normalizeLegacyKeys(input);
    expect((parsed as Record<string, unknown>).depth).toBeUndefined();
    expect(normalizations).toHaveLength(1);
    expect(normalizations[0].from).toBe('depth');
    // The value in parsed is the mapped granularity value
    const gv = (parsed as Record<string, unknown>).granularity
      ?? (parsed as Record<string, Record<string, unknown>>).planning?.granularity;
    expect(gv).toBe('fine');
  });

  it('migrates top-level depth: quick → coarse', () => {
    const input = { depth: 'quick' };
    const { parsed, normalizations } = normalizeLegacyKeys(input);
    const gv = (parsed as Record<string, unknown>).granularity
      ?? (parsed as Record<string, Record<string, unknown>>).planning?.granularity;
    expect(gv).toBe('coarse');
    expect(normalizations[0].from).toBe('depth');
  });

  it('migrates all four legacy keys in one pass', () => {
    const input = {
      branching_strategy: 'phase',
      sub_repos: ['app1'],
      multiRepo: true,
      depth: 'comprehensive',
    };
    const { parsed, normalizations } = normalizeLegacyKeys(input);
    expect(normalizations).toHaveLength(4);
    // branching_strategy → git.branching_strategy
    expect((parsed as Record<string, Record<string, unknown>>).git?.branching_strategy).toBe('phase');
  });

  it('returns empty normalizations for already-normalized input', () => {
    const input = { git: { branching_strategy: 'phase' }, planning: { sub_repos: ['app1'] } };
    const { parsed, normalizations } = normalizeLegacyKeys(input);
    expect(normalizations).toHaveLength(0);
    expect(parsed).toEqual(input);
  });

  it('is idempotent — running twice produces same result with empty normalizations second time', () => {
    const input = { branching_strategy: 'phase' };
    const first = normalizeLegacyKeys(input);
    const second = normalizeLegacyKeys(first.parsed as Record<string, unknown>);
    expect(second.normalizations).toHaveLength(0);
    expect(second.parsed).toEqual(first.parsed);
  });

  it('preserves canonical git.branching_strategy when both top-level and nested exist', () => {
    const input = { branching_strategy: 'milestone', git: { branching_strategy: 'phase' } };
    const { parsed } = normalizeLegacyKeys(input);
    // canonical nested wins
    expect((parsed as Record<string, Record<string, unknown>>).git?.branching_strategy).toBe('phase');
  });

  it('preserves canonical planning.sub_repos when both top-level and nested exist', () => {
    const input = { sub_repos: ['legacy'], planning: { sub_repos: null } };
    const { parsed } = normalizeLegacyKeys(input);
    expect((parsed as Record<string, Record<string, unknown>>).sub_repos).toBeUndefined();
    // canonical nested wins even when explicit null is used to unset
    expect((parsed as Record<string, Record<string, unknown>>).planning?.sub_repos).toBeNull();
  });
});

// ─── mergeDefaults ───────────────────────────────────────────────────────────

describe('mergeDefaults', () => {
  it('returns full CONFIG_DEFAULTS for empty input', () => {
    const result = mergeDefaults({});
    expect(result).toEqual(CONFIG_DEFAULTS);
  });

  it('merges partial nested input without losing sibling keys', () => {
    const partial = { git: { base_branch: 'main' } };
    const result = mergeDefaults(partial);
    // base_branch from input
    expect((result.git as Record<string, unknown>).base_branch).toBe('main');
    // sibling from defaults
    expect(result.git.branching_strategy).toBe(CONFIG_DEFAULTS.git.branching_strategy);
    expect(result.git.phase_branch_template).toBe(CONFIG_DEFAULTS.git.phase_branch_template);
  });

  it('preserves boolean false values (not overridden by truthy defaults)', () => {
    // workflow.research defaults to true; setting false should survive merge
    const partial = { workflow: { research: false } };
    const result = mergeDefaults(partial);
    expect(result.workflow.research).toBe(false);
  });

  it('preserves explicit null values', () => {
    const partial = { project_code: null };
    const result = mergeDefaults(partial);
    expect(result.project_code).toBeNull();
  });

  it('user top-level keys win over defaults', () => {
    const partial = { model_profile: 'quality' };
    const result = mergeDefaults(partial);
    expect(result.model_profile).toBe('quality');
  });
});

// ─── migrateOnDisk ───────────────────────────────────────────────────────────

describe('migrateOnDisk', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpProject();
  });

  afterEach(() => {
    cleanupDir(tmpDir);
  });

  it('returns migrated:false, wrote:null for already-normalized config', async () => {
    writeConfig(tmpDir, { git: { branching_strategy: 'phase' } });
    const report = await migrateOnDisk(tmpDir);
    expect(report.migrated).toBe(false);
    expect(report.wrote).toBeNull();
    expect(report.normalizations).toHaveLength(0);
  });

  it('returns migrated:true, writes disk when legacy key present', async () => {
    writeConfig(tmpDir, { branching_strategy: 'phase' });
    const report = await migrateOnDisk(tmpDir);
    expect(report.migrated).toBe(true);
    expect(report.wrote).not.toBeNull();
    expect(report.normalizations.length).toBeGreaterThan(0);
    // Verify disk was updated
    const onDisk = JSON.parse(readConfigRaw(tmpDir));
    expect(onDisk.branching_strategy).toBeUndefined();
    expect(onDisk.git?.branching_strategy).toBe('phase');
  });

  it('returns report shape: { migrated, normalizations, wrote }', async () => {
    writeConfig(tmpDir, { branching_strategy: 'milestone' });
    const report = await migrateOnDisk(tmpDir);
    expect(report).toHaveProperty('migrated');
    expect(report).toHaveProperty('normalizations');
    expect(report).toHaveProperty('wrote');
  });

  it('is a no-op when .planning/config.json is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gsd-cfg-nomig-'));
    try {
      const report = await migrateOnDisk(dir);
      expect(report.migrated).toBe(false);
      expect(report.wrote).toBeNull();
    } finally {
      cleanupDir(dir);
    }
  });
});
