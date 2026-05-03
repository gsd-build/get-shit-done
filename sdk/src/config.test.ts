import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, CONFIG_DEFAULTS } from './config.js';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('loadConfig', () => {
  let tmpDir: string;
  let fakeHome: string;
  let prevHome: string | undefined;
  let prevGsdHome: string | undefined;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `gsd-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    // Isolate ~/.gsd/defaults.json by pointing HOME at an empty tmp dir.
    fakeHome = join(tmpdir(), `gsd-home-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(fakeHome, { recursive: true });
    prevHome = process.env.HOME;
    process.env.HOME = fakeHome;
    // Also isolate GSD_HOME (loadUserDefaults prefers it over HOME).
    prevGsdHome = process.env.GSD_HOME;
    delete process.env.GSD_HOME;
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    await rm(fakeHome, { recursive: true, force: true });
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevGsdHome === undefined) delete process.env.GSD_HOME;
    else process.env.GSD_HOME = prevGsdHome;
  });

  async function writeUserDefaults(defaults: unknown) {
    await mkdir(join(fakeHome, '.gsd'), { recursive: true });
    await writeFile(join(fakeHome, '.gsd', 'defaults.json'), JSON.stringify(defaults));
  }

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

  // ─── User-level defaults (~/.gsd/defaults.json) ─────────────────────────
  // Regression: issue #2652 — SDK loadConfig ignored user-level defaults
  // for pre-project Codex installs, so init.quick still emitted Claude
  // model aliases from MODEL_PROFILES via resolveModel even when the user
  // had `resolve_model_ids: "omit"` in ~/.gsd/defaults.json.
  //
  // Mirrors CJS behavior in get-shit-done/bin/lib/core.cjs:421 (#1683):
  // user-level defaults only apply when no project .planning/config.json
  // exists (pre-project context). Once a project is initialized, its
  // config.json is authoritative — buildNewProjectConfig baked the user
  // defaults in at /gsd:new-project time.

  it('pre-project: ignores user defaults and uses built-in defaults', async () => {
    await writeUserDefaults({ resolve_model_ids: 'omit' });
    const config = await loadConfig(tmpDir);
    expect((config as Record<string, unknown>).resolve_model_ids).toBeUndefined();
    expect(config.model_profile).toBe('balanced');
    expect(config.workflow.plan_check).toBe(true);
  });

  it('pre-project: keeps built-in nested defaults even when user defaults exist', async () => {
    await writeUserDefaults({
      git: { branching_strategy: 'milestone' },
      agent_skills: { planner: 'user-skill' },
    });

    const config = await loadConfig(tmpDir);
    expect(config.git.branching_strategy).toBe('none');
    expect(config.git.phase_branch_template).toBe('gsd/phase-{phase}-{slug}');
    expect(config.agent_skills).toEqual({});
  });

  it('project config is authoritative over user defaults (CJS parity)', async () => {
    // User defaults set resolve_model_ids: "omit", but project config omits it.
    // Per CJS core.cjs loadConfig (#1683): once .planning/config.json exists,
    // ~/.gsd/defaults.json is ignored — buildNewProjectConfig already baked
    // the user defaults in at project creation time.
    await writeUserDefaults({
      resolve_model_ids: 'omit',
      model_profile: 'fast',
    });
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' }),
    );

    const config = await loadConfig(tmpDir);
    expect(config.model_profile).toBe('quality');
    // User-defaults not layered when project config present
    expect((config as Record<string, unknown>).resolve_model_ids).toBeUndefined();
  });

  it('ignores malformed ~/.gsd/defaults.json', async () => {
    await mkdir(join(fakeHome, '.gsd'), { recursive: true });
    await writeFile(join(fakeHome, '.gsd', 'defaults.json'), '{not json');

    const config = await loadConfig(tmpDir);
    // Falls back to built-in defaults
    expect(config).toEqual(CONFIG_DEFAULTS);
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
