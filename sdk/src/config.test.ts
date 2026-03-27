import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, CONFIG_DEFAULTS } from './config.js';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `gsd-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns all defaults when config file is missing', async () => {
    // No config.json created
    await rm(join(tmpDir, '.planning', 'config.json'), { force: true });
    const config = await loadConfig(tmpDir);
    expect(config).toEqual(CONFIG_DEFAULTS);
  });

  it('returns all defaults when config file is empty', async () => {
    await writeFile(join(tmpDir, '.planning', 'config.json'), '');
    const config = await loadConfig(tmpDir);
    expect(config).toEqual(CONFIG_DEFAULTS);
  });

  it('loads valid config and merges with defaults', async () => {
    const userConfig = {
      model_profile: 'fast',
      workflow: { research: false },
    };
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(userConfig),
    );

    const config = await loadConfig(tmpDir);

    expect(config.model_profile).toBe('fast');
    expect(config.workflow.research).toBe(false);
    // Other workflow defaults preserved
    expect(config.workflow.plan_check).toBe(true);
    expect(config.workflow.verifier).toBe(true);
    // Top-level defaults preserved
    expect(config.commit_docs).toBe(true);
    expect(config.parallelization).toBe(true);
  });

  it('partial config merges correctly for nested objects', async () => {
    const userConfig = {
      git: { branching_strategy: 'milestone' },
      hooks: { context_warnings: false },
    };
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(userConfig),
    );

    const config = await loadConfig(tmpDir);

    expect(config.git.branching_strategy).toBe('milestone');
    // Other git defaults preserved
    expect(config.git.phase_branch_template).toBe('gsd/phase-{phase}-{slug}');
    expect(config.hooks.context_warnings).toBe(false);
  });

  it('preserves unknown top-level keys', async () => {
    const userConfig = { custom_key: 'custom_value' };
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(userConfig),
    );

    const config = await loadConfig(tmpDir);
    expect(config.custom_key).toBe('custom_value');
  });

  it('merges agent_skills', async () => {
    const userConfig = {
      agent_skills: { planner: 'custom-skill' },
    };
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(userConfig),
    );

    const config = await loadConfig(tmpDir);
    expect(config.agent_skills).toEqual({ planner: 'custom-skill' });
  });

  // ─── Negative tests ─────────────────────────────────────────────────────

  it('throws on malformed JSON', async () => {
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      '{bad json',
    );

    await expect(loadConfig(tmpDir)).rejects.toThrow(/Failed to parse config/);
  });

  it('throws when config is not an object (array)', async () => {
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      '[1, 2, 3]',
    );

    await expect(loadConfig(tmpDir)).rejects.toThrow(/must be a JSON object/);
  });

  it('throws when config is not an object (string)', async () => {
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      '"just a string"',
    );

    await expect(loadConfig(tmpDir)).rejects.toThrow(/must be a JSON object/);
  });

  it('ignores unknown keys without error', async () => {
    const userConfig = {
      totally_unknown: true,
      another_unknown: { nested: 'value' },
    };
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(userConfig),
    );

    const config = await loadConfig(tmpDir);
    // Should load fine, with unknowns passed through
    expect(config.model_profile).toBe('balanced');
    expect((config as Record<string, unknown>).totally_unknown).toBe(true);
  });

  it('handles wrong value types gracefully (user sets string instead of bool)', async () => {
    const userConfig = {
      commit_docs: 'yes', // should be boolean but we don't validate types
      parallelization: 0,
    };
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify(userConfig),
    );

    const config = await loadConfig(tmpDir);
    // We pass through the user's values as-is — runtime code handles type mismatches
    expect(config.commit_docs).toBe('yes');
    expect(config.parallelization).toBe(0);
  });

  it('does not mutate CONFIG_DEFAULTS between calls', async () => {
    const before = structuredClone(CONFIG_DEFAULTS);

    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'fast', workflow: { research: false } }),
    );
    await loadConfig(tmpDir);

    expect(CONFIG_DEFAULTS).toEqual(before);
  });
});
