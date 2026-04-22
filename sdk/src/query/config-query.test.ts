/**
 * Unit tests for config-get and resolve-model query handlers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GSDError } from '../errors.js';

// ─── Test setup ─────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-cfg-'));
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── configGet ──────────────────────────────────────────────────────────────

describe('configGet', () => {
  it('returns raw config value for top-level key', async () => {
    const { configGet } = await import('./config-query.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' }),
    );
    const result = await configGet(['model_profile'], tmpDir);
    expect(result.data).toBe('quality');
  });

  it('traverses dot-notation for nested keys', async () => {
    const { configGet } = await import('./config-query.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { auto_advance: true } }),
    );
    const result = await configGet(['workflow.auto_advance'], tmpDir);
    expect(result.data).toBe(true);
  });

  it('throws GSDError when no key provided', async () => {
    const { configGet } = await import('./config-query.js');
    await expect(configGet([], tmpDir)).rejects.toThrow(GSDError);
  });

  it('throws GSDError for nonexistent key', async () => {
    const { configGet } = await import('./config-query.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' }),
    );
    await expect(configGet(['nonexistent.key'], tmpDir)).rejects.toThrow(GSDError);
  });

  it('reads raw config without merging defaults', async () => {
    const { configGet } = await import('./config-query.js');
    // Write config with only model_profile -- no workflow section
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }),
    );
    // Accessing workflow should fail (not merged with defaults)
    await expect(configGet(['workflow.auto_advance'], tmpDir)).rejects.toThrow(GSDError);
  });
});

// ─── resolveModel ───────────────────────────────────────────────────────────

describe('resolveModel', () => {
  it('returns model and profile for known agent', async () => {
    const { resolveModel } = await import('./config-query.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }),
    );
    const result = await resolveModel(['gsd-planner'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data).toHaveProperty('model');
    expect(data).toHaveProperty('profile', 'balanced');
    expect(data).not.toHaveProperty('unknown_agent');
  });

  it('returns unknown_agent flag for unknown agent', async () => {
    const { resolveModel } = await import('./config-query.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }),
    );
    const result = await resolveModel(['unknown-agent'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data).toHaveProperty('model', 'sonnet');
    expect(data).toHaveProperty('unknown_agent', true);
  });

  it('throws GSDError when no agent type provided', async () => {
    const { resolveModel } = await import('./config-query.js');
    await expect(resolveModel([], tmpDir)).rejects.toThrow(GSDError);
  });

  it('respects model_overrides from config', async () => {
    const { resolveModel } = await import('./config-query.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({
        model_profile: 'balanced',
        model_overrides: { 'gsd-planner': 'openai/gpt-5.4' },
      }),
    );
    const result = await resolveModel(['gsd-planner'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data).toHaveProperty('model', 'openai/gpt-5.4');
  });

  it('returns empty model when resolve_model_ids is omit', async () => {
    const { resolveModel } = await import('./config-query.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({
        model_profile: 'balanced',
        resolve_model_ids: 'omit',
      }),
    );
    const result = await resolveModel(['gsd-planner'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data).toHaveProperty('model', '');
  });
});

// ─── MODEL_PROFILES ─────────────────────────────────────────────────────────

describe('MODEL_PROFILES', () => {
  it('contains all 18 agent entries (sync with model-profiles.cjs)', async () => {
    const { MODEL_PROFILES } = await import('./config-query.js');
    expect(Object.keys(MODEL_PROFILES)).toHaveLength(18);
  });

  it('has quality/balanced/budget/adaptive for each agent', async () => {
    const { MODEL_PROFILES } = await import('./config-query.js');
    for (const agent of Object.keys(MODEL_PROFILES)) {
      expect(MODEL_PROFILES[agent]).toHaveProperty('quality');
      expect(MODEL_PROFILES[agent]).toHaveProperty('balanced');
      expect(MODEL_PROFILES[agent]).toHaveProperty('budget');
      expect(MODEL_PROFILES[agent]).toHaveProperty('adaptive');
    }
  });
});

// ─── VALID_PROFILES ─────────────────────────────────────────────────────────

describe('VALID_PROFILES', () => {
  it('contains the four profile names', async () => {
    const { VALID_PROFILES } = await import('./config-query.js');
    expect(VALID_PROFILES).toEqual(['quality', 'balanced', 'budget', 'adaptive']);
  });
});
