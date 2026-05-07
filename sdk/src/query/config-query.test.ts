/**
 * Unit tests for config-get and resolve-model query handlers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { GSDError, ErrorClassification, exitCodeFor } from '../errors.js';

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

  it('throws GSDError that maps to exit code 1 for missing key (bug #2544)', async () => {
    const { configGet } = await import('./config-query.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' }),
    );
    try {
      await configGet(['nonexistent.key'], tmpDir);
      throw new Error('expected configGet to throw for missing key');
    } catch (err) {
      expect(err).toBeInstanceOf(GSDError);
      const gsdErr = err as GSDError;
      // UNIX convention: missing config key should exit 1 (like `git config --get`).
      // Validation (exit 10) is the previous buggy classification — see issue #2544.
      expect(gsdErr.classification).toBe(ErrorClassification.Execution);
      expect(exitCodeFor(gsdErr.classification)).toBe(1);
    }
  });

  it('throws GSDError that maps to exit code 1 when traversing into non-object (bug #2544)', async () => {
    const { configGet } = await import('./config-query.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' }),
    );
    try {
      await configGet(['model_profile.subkey'], tmpDir);
      throw new Error('expected configGet to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(GSDError);
      const gsdErr = err as GSDError;
      expect(exitCodeFor(gsdErr.classification)).toBe(1);
    }
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

  it('resolves shipped-but-previously-missing agents without unknown_agent (#3229)', async () => {
    const { resolveModel } = await import('./config-query.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' }),
    );
    const result = await resolveModel(['gsd-code-reviewer'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data).toHaveProperty('model', 'opus');
    expect(data).toHaveProperty('profile', 'quality');
    expect(data).not.toHaveProperty('unknown_agent');
  });

  it('returns profile-semantic fallback for truly unknown agents (#3229)', async () => {
    const { resolveModel } = await import('./config-query.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' }),
    );
    const quality = (await resolveModel(['unknown-agent'], tmpDir)).data as Record<string, unknown>;
    expect(quality).toHaveProperty('model', 'opus');
    expect(quality).toHaveProperty('unknown_agent', true);

    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'budget' }),
    );
    const budget = (await resolveModel(['unknown-agent'], tmpDir)).data as Record<string, unknown>;
    expect(budget).toHaveProperty('model', 'haiku');
    expect(budget).toHaveProperty('unknown_agent', true);
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

  it('resolveModel uses workstream config when --ws is specified', async () => {
    const { resolveModel } = await import('./config-query.js');
    // Root config: balanced profile → gsd-executor resolves to 'sonnet'
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }),
    );
    // Workstream config: quality profile → gsd-executor resolves to 'opus'
    await mkdir(join(tmpDir, '.planning', 'workstreams', 'frontend'), { recursive: true });
    await writeFile(
      join(tmpDir, '.planning', 'workstreams', 'frontend', 'config.json'),
      JSON.stringify({ model_profile: 'quality' }),
    );

    const rootResult = await resolveModel(['gsd-executor'], tmpDir);
    const rootData = rootResult.data as Record<string, unknown>;
    expect(rootData.profile).toBe('balanced');
    expect(rootData.model).toBe('sonnet');

    const wsResult = await resolveModel(['gsd-executor'], tmpDir, 'frontend');
    const wsData = wsResult.data as Record<string, unknown>;
    expect(wsData.profile).toBe('quality');
    expect(wsData.model).toBe('opus');
  });
});

// ─── MODEL_PROFILES ─────────────────────────────────────────────────────────

describe('MODEL_PROFILES', () => {
  it('contains every shipped gsd agent file on disk (#3229)', async () => {
    const { MODEL_PROFILES } = await import('./config-query.js');
    const repoRoot = resolve(process.cwd(), '..');
    const agentFiles = (await readdir(join(repoRoot, 'agents')))
      .filter((f) => /^gsd-.*\.md$/.test(f))
      .map((f) => f.replace(/\.md$/, ''))
      .sort();
    expect(Object.keys(MODEL_PROFILES).sort()).toEqual(agentFiles);
  });

  it('has quality/balanced/budget/adaptive for each shipped agent', async () => {
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
  it('contains quality, balanced, budget, adaptive, and inherit', async () => {
    const { VALID_PROFILES } = await import('./config-query.js');
    expect(VALID_PROFILES.sort()).toEqual(['adaptive', 'balanced', 'budget', 'inherit', 'quality']);
  });
});

// ─── #2997: Secret masking in configGet response ────────────────────────────

describe('configGet secret masking (#2997)', () => {
  it('masks the response data for SECRET_CONFIG_KEYS', async () => {
    const { configGet } = await import('./config-query.js');
    const apiKey = 'BSA-1234567890abcdef';
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ brave_search: apiKey }),
    );
    const result = await configGet(['brave_search'], tmpDir);
    expect(result.data).toBe('****cdef');
    expect(result.data).not.toBe(apiKey);
  });

  it('does NOT mask non-secret keys', async () => {
    const { configGet } = await import('./config-query.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' }),
    );
    const result = await configGet(['model_profile'], tmpDir);
    expect(result.data).toBe('quality');
  });

  it('renders short secret values as **** (no tail leak)', async () => {
    const { configGet } = await import('./config-query.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ firecrawl: 'abc' }),
    );
    const result = await configGet(['firecrawl'], tmpDir);
    expect(result.data).toBe('****');
  });

  it('does not mask the user-supplied --default value (it is the user\'s own input, not a stored secret)', async () => {
    const { configGet } = await import('./config-query.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }),
    );
    const result = await configGet(['brave_search', '--default', 'placeholder'], tmpDir);
    // Default flows through unchanged: the user typed it, the SDK echoed it.
    expect(result.data).toBe('placeholder');
  });
});
