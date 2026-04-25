import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, CONFIG_DEFAULTS } from './config.js';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('loadConfig', () => {
  let tmpDir: string;
  let homeDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-config-test-'));
    homeDir = await mkdtemp(join(tmpdir(), 'gsd-home-test-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  /**
   * Write isolated user-level defaults under the test-controlled home dir.
   */
  async function writeUserDefaults(defaults: unknown) {
    await mkdir(join(homeDir, '.gsd'), { recursive: true });
    const content = typeof defaults === 'string' ? defaults : JSON.stringify(defaults);
    await writeFile(join(homeDir, '.gsd', 'defaults.json'), content);
  }

  function loadTestConfig() {
    return loadConfig(tmpDir, undefined, { homeDir });
  }

  it('returns all defaults when config file is missing', async () => {
    // No config.json created
    await rm(join(tmpDir, '.planning', 'config.json'), { force: true });
    const config = await loadTestConfig();
    expect(config).toEqual(CONFIG_DEFAULTS);
  });

  it('returns all defaults when config file is empty', async () => {
    await writeFile(join(tmpDir, '.planning', 'config.json'), '');
    const config = await loadTestConfig();
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

    const config = await loadTestConfig();

    expect(config.model_profile).toBe('fast');
    expect(config.workflow.research).toBe(false);
    // Other workflow defaults preserved
    expect(config.workflow.plan_check).toBe(true);
    expect(config.workflow.verifier).toBe(true);
    // Top-level defaults preserved
    expect(config.commit_docs).toBe(true);
    expect(config.parallelization).toBe(true);
  });

  it('layers user defaults from ~/.gsd/defaults.json when project config is missing', async () => {
    await rm(join(tmpDir, '.planning', 'config.json'), { force: true });
    await writeUserDefaults({
      resolve_model_ids: 'omit',
      workflow: { auto_advance: true },
      agent_skills: { 'gsd-planner': ['codex-skill'] },
      features: { global_learnings: true },
      model_overrides: { 'gsd-planner': 'openai/gpt-5.4' },
    });

    const config = await loadTestConfig();

    expect(config.resolve_model_ids).toBe('omit');
    expect(config.workflow.auto_advance).toBe(true);
    expect(config.workflow.research).toBe(true);
    expect(config.agent_skills).toEqual({ 'gsd-planner': ['codex-skill'] });
    expect(config.features).toEqual({ global_learnings: true });
    expect(config.model_overrides).toEqual({ 'gsd-planner': 'openai/gpt-5.4' });
  });

  it('lets project config override user defaults while preserving nested fallbacks', async () => {
    await writeUserDefaults({
      resolve_model_ids: 'omit',
      workflow: { auto_advance: true, research: false },
      git: { branching_strategy: 'phase' },
      agent_skills: { 'gsd-planner': 'global-skill' },
      features: { global_learnings: true, thinking_partner: true },
      model_overrides: {
        'gsd-planner': 'global-planner',
        'gsd-executor': 'global-executor',
      },
    });
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({
        resolve_model_ids: false,
        workflow: { auto_advance: false },
        git: { branching_strategy: 'none' },
        agent_skills: { 'gsd-planner': 'project-skill' },
        features: { thinking_partner: false },
        model_overrides: { 'gsd-planner': 'project-planner' },
      }),
    );

    const config = await loadTestConfig();

    expect(config.resolve_model_ids).toBe(false);
    expect(config.workflow.auto_advance).toBe(false);
    expect(config.workflow.research).toBe(false);
    expect(config.git.branching_strategy).toBe('none');
    expect(config.agent_skills).toEqual({ 'gsd-planner': 'project-skill' });
    expect(config.features).toEqual({ global_learnings: true, thinking_partner: false });
    expect(config.model_overrides).toEqual({
      'gsd-planner': 'project-planner',
      'gsd-executor': 'global-executor',
    });
  });

  it('deep-merges features from defaults, user defaults, and project config', async () => {
    await writeUserDefaults({
      features: { global_learnings: true, thinking_partner: true },
    });
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ features: { thinking_partner: false } }),
    );

    const config = await loadTestConfig();

    expect(config.features).toEqual({
      global_learnings: true,
      thinking_partner: false,
    });
  });

  it('recursively merges deeper config trees without clobbering sibling defaults', async () => {
    await writeUserDefaults({
      review: {
        models: {
          codex: 'codex exec --model gpt-5',
          gemini: 'gemini -m gemini-2.5-pro',
        },
      },
      claude_md_assembly: {
        mode: 'embed',
        blocks: {
          architecture: 'link',
          workflow: 'embed',
        },
      },
      model_profile_overrides: {
        codex: {
          opus: { model: 'gpt-5.5', reasoning_effort: 'xhigh' },
          sonnet: 'gpt-5.4',
        },
        gemini: {
          opus: 'gemini-2.5-pro',
        },
      },
    });
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({
        review: {
          models: {
            codex: 'codex exec --model gpt-5.5',
          },
        },
        claude_md_assembly: {
          blocks: {
            workflow: 'link',
          },
        },
        model_profile_overrides: {
          codex: {
            sonnet: { model: 'gpt-5.4', reasoning_effort: 'high' },
          },
        },
      }),
    );

    const config = await loadTestConfig();

    expect(config.review).toEqual({
      models: {
        codex: 'codex exec --model gpt-5.5',
        gemini: 'gemini -m gemini-2.5-pro',
      },
    });
    expect(config.claude_md_assembly).toEqual({
      mode: 'embed',
      blocks: {
        architecture: 'link',
        workflow: 'link',
      },
    });
    expect(config.model_profile_overrides).toEqual({
      codex: {
        opus: { model: 'gpt-5.5', reasoning_effort: 'xhigh' },
        sonnet: { model: 'gpt-5.4', reasoning_effort: 'high' },
      },
      gemini: {
        opus: 'gemini-2.5-pro',
      },
    });
  });

  it('ignores malformed user defaults', async () => {
    await writeUserDefaults('{bad json');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'fast' }),
    );

    const config = await loadTestConfig();

    expect(config.model_profile).toBe('fast');
    expect(config.resolve_model_ids).toBe(CONFIG_DEFAULTS.resolve_model_ids);
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

    const config = await loadTestConfig();

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

    const config = await loadTestConfig();
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

    const config = await loadTestConfig();
    expect(config.agent_skills).toEqual({ planner: 'custom-skill' });
  });

  // ─── Negative tests ─────────────────────────────────────────────────────

  it('throws on malformed JSON', async () => {
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      '{bad json',
    );

    await expect(loadTestConfig()).rejects.toThrow(/Failed to parse config/);
  });

  it('throws when config is not an object (array)', async () => {
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      '[1, 2, 3]',
    );

    await expect(loadTestConfig()).rejects.toThrow(/must be a JSON object/);
  });

  it('throws when config is not an object (string)', async () => {
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      '"just a string"',
    );

    await expect(loadTestConfig()).rejects.toThrow(/must be a JSON object/);
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

    const config = await loadTestConfig();
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

    const config = await loadTestConfig();
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
    await loadTestConfig();

    expect(CONFIG_DEFAULTS).toEqual(before);
  });
});
