/**
 * Unit tests for config mutation handlers.
 *
 * Tests: isValidConfigKey, parseConfigValue, configSet,
 * configSetModelProfile, configNewProject, configEnsureSection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GSDError } from '../errors.js';

// ─── Test setup ─────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-cfgmut-'));
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── isValidConfigKey ──────────────────────────────────────────────────────

describe('isValidConfigKey', () => {
  it('accepts known exact keys', async () => {
    const { isValidConfigKey } = await import('./config-mutation.js');
    expect(isValidConfigKey('model_profile').valid).toBe(true);
    expect(isValidConfigKey('commit_docs').valid).toBe(true);
    expect(isValidConfigKey('workflow.auto_advance').valid).toBe(true);
  });

  it('accepts workflow.context_coverage_gate (#2492)', async () => {
    const { isValidConfigKey, parseConfigValue } = await import('./config-mutation.js');
    expect(isValidConfigKey('workflow.context_coverage_gate').valid).toBe(true);
    expect(parseConfigValue('true')).toBe(true);
    expect(parseConfigValue('false')).toBe(false);
  });

  it('accepts wildcard agent_skills.* patterns', async () => {
    const { isValidConfigKey } = await import('./config-mutation.js');
    expect(isValidConfigKey('agent_skills.gsd-planner').valid).toBe(true);
    expect(isValidConfigKey('agent_skills.custom_agent').valid).toBe(true);
  });

  it('accepts wildcard features.* patterns', async () => {
    const { isValidConfigKey } = await import('./config-mutation.js');
    expect(isValidConfigKey('features.global_learnings').valid).toBe(true);
    expect(isValidConfigKey('features.thinking_partner').valid).toBe(true);
  });

  it('rejects unknown keys with suggestion', async () => {
    const { isValidConfigKey } = await import('./config-mutation.js');
    const result = isValidConfigKey('model_profle');
    expect(result.valid).toBe(false);
    expect(result.suggestion).toBeDefined();
  });

  it('rejects completely invalid keys', async () => {
    const { isValidConfigKey } = await import('./config-mutation.js');
    const result = isValidConfigKey('totally_unknown_key');
    expect(result.valid).toBe(false);
  });

  it('accepts learnings.max_inject as valid key (D7)', async () => {
    const { isValidConfigKey } = await import('./config-mutation.js');
    expect(isValidConfigKey('learnings.max_inject').valid).toBe(true);
  });

  it('accepts features.global_learnings as valid key (D7)', async () => {
    const { isValidConfigKey } = await import('./config-mutation.js');
    expect(isValidConfigKey('features.global_learnings').valid).toBe(true);
  });

  it('returns curated suggestion for known typos before LCP fallback (D9)', async () => {
    const { isValidConfigKey } = await import('./config-mutation.js');
    const r1 = isValidConfigKey('workflow.codereview');
    expect(r1.valid).toBe(false);
    expect(r1.suggestion).toBe('workflow.code_review');

    const r2 = isValidConfigKey('agents.nyquist_validation_enabled');
    expect(r2.valid).toBe(false);
    expect(r2.suggestion).toBe('workflow.nyquist_validation');
  });
});

// ─── parseConfigValue ──────────────────────────────────────────────────────

describe('parseConfigValue', () => {
  it('converts "true" to boolean true', async () => {
    const { parseConfigValue } = await import('./config-mutation.js');
    expect(parseConfigValue('true')).toBe(true);
  });

  it('converts "false" to boolean false', async () => {
    const { parseConfigValue } = await import('./config-mutation.js');
    expect(parseConfigValue('false')).toBe(false);
  });

  it('converts numeric strings to numbers', async () => {
    const { parseConfigValue } = await import('./config-mutation.js');
    expect(parseConfigValue('42')).toBe(42);
    expect(parseConfigValue('3.14')).toBe(3.14);
  });

  it('parses JSON arrays', async () => {
    const { parseConfigValue } = await import('./config-mutation.js');
    expect(parseConfigValue('["a","b"]')).toEqual(['a', 'b']);
  });

  it('parses JSON objects', async () => {
    const { parseConfigValue } = await import('./config-mutation.js');
    expect(parseConfigValue('{"key":"val"}')).toEqual({ key: 'val' });
  });

  it('preserves plain strings', async () => {
    const { parseConfigValue } = await import('./config-mutation.js');
    expect(parseConfigValue('hello')).toBe('hello');
  });

  it('preserves empty string as empty string', async () => {
    const { parseConfigValue } = await import('./config-mutation.js');
    expect(parseConfigValue('')).toBe('');
  });
});

// ─── atomicWriteConfig behavior ───────────────────────────────────────────

describe('atomicWriteConfig internals (via configSet)', () => {
  it('uses PID-qualified temp file name (D4)', async () => {
    const { configSet } = await import('./config-mutation.js');
    await writeFile(join(tmpDir, '.planning', 'config.json'), '{}');

    await configSet(['model_profile', 'quality'], tmpDir);

    // Verify the config was written (temp file should be cleaned up)
    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.model_profile).toBe('quality');
  });

  it('falls back to direct write when rename fails (D5)', async () => {
    const { configSet } = await import('./config-mutation.js');
    await writeFile(join(tmpDir, '.planning', 'config.json'), '{}');

    // Even if rename would fail, config-set should still succeed via fallback
    await configSet(['model_profile', 'balanced'], tmpDir);
    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.model_profile).toBe('balanced');
  });
});

// ─── configSet lock protection ────────────────────────────────────────────

describe('configSet lock protection (D6)', () => {
  it('acquires and releases lock around read-modify-write', async () => {
    const { configSet } = await import('./config-mutation.js');
    await writeFile(join(tmpDir, '.planning', 'config.json'), '{}');

    // Run two concurrent config-set operations — both should succeed without corruption
    const [r1, r2] = await Promise.all([
      configSet(['commit_docs', 'true'], tmpDir),
      configSet(['model_profile', 'quality'], tmpDir),
    ]);
    expect((r1.data as { updated: boolean }).updated).toBe(true);
    expect((r2.data as { updated: boolean }).updated).toBe(true);

    // Both values should be present (no lost updates)
    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.commit_docs).toBe(true);
    expect(raw.model_profile).toBe('quality');
  });
});

// ─── configSet context validation ─────────────────────────────────────────

describe('configSet context validation (D8)', () => {
  it('rejects invalid context values', async () => {
    const { configSet } = await import('./config-mutation.js');
    await writeFile(join(tmpDir, '.planning', 'config.json'), '{}');

    await expect(configSet(['context', 'invalid'], tmpDir)).rejects.toThrow(/Invalid context value/);
  });

  it('accepts valid context values (dev, research, review)', async () => {
    const { configSet } = await import('./config-mutation.js');

    for (const ctx of ['dev', 'research', 'review']) {
      await writeFile(join(tmpDir, '.planning', 'config.json'), '{}');
      const result = await configSet(['context', ctx], tmpDir);
      expect((result.data as { updated: boolean }).updated).toBe(true);
    }
  });
});

// ─── configNewProject global defaults ─────────────────────────────────────

describe('configNewProject global defaults (D11)', () => {
  it('creates config with standard defaults when no global defaults exist', async () => {
    const { configNewProject } = await import('./config-mutation.js');
    const result = await configNewProject([], tmpDir);
    expect((result.data as { created: boolean }).created).toBe(true);

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.model_profile).toBe('balanced');
  });
});

// ─── configNewProject — nested global defaults merge (regression) ──────────
//
// Regression tests for the nested-object override merge bug: when
// ~/.gsd/defaults.json sets keys under nested sections (workflow.*, git.*,
// hooks.*, features.*, agent_skills.*), the final per-project config
// previously dropped them because the nested spread only merged `defaults`
// with `userChoices`, ignoring `globalDefaults`.
//
// The doc comment in config-mutation.ts promises:
//   "Deep merge: hardcoded <- globalDefaults <- userChoices (D11)"
// Top-level keys already honored that precedence; nested keys did not.
//
// Each test overrides HOME to an isolated tmp dir so the assertions do not
// depend on whether the machine running the tests has a real
// ~/.gsd/defaults.json present.

describe('configNewProject nested global defaults merge', () => {
  let homeTmpDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    homeTmpDir = await mkdtemp(join(tmpdir(), 'gsd-cfgmut-home-'));
    await mkdir(join(homeTmpDir, '.gsd'), { recursive: true });
    originalHome = process.env.HOME;
    process.env.HOME = homeTmpDir;
  });

  afterEach(async () => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    await rm(homeTmpDir, { recursive: true, force: true });
  });

  async function writeGlobalDefaults(contents: Record<string, unknown>): Promise<void> {
    await writeFile(join(homeTmpDir, '.gsd', 'defaults.json'), JSON.stringify(contents));
  }

  it('propagates nested workflow.* keys from ~/.gsd/defaults.json', async () => {
    await writeGlobalDefaults({
      workflow: {
        code_review_depth: 'deep',
        auto_advance: true,
        node_repair_budget: 3,
      },
    });
    const { configNewProject } = await import('./config-mutation.js');
    await configNewProject([], tmpDir);

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.workflow.code_review_depth).toBe('deep');
    expect(raw.workflow.auto_advance).toBe(true);
    expect(raw.workflow.node_repair_budget).toBe(3);
    // Non-overridden hardcoded workflow defaults must still be present.
    expect(raw.workflow.research).toBe(true);
    expect(raw.workflow.plan_check).toBe(true);
  });

  it('propagates nested git.* keys from ~/.gsd/defaults.json', async () => {
    await writeGlobalDefaults({
      git: { branching_strategy: 'milestone' },
    });
    const { configNewProject } = await import('./config-mutation.js');
    await configNewProject([], tmpDir);

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.git.branching_strategy).toBe('milestone');
    // Non-overridden hardcoded git defaults must still be present.
    expect(raw.git.phase_branch_template).toBe('gsd/phase-{phase}-{slug}');
  });

  it('propagates nested hooks.* and features.* keys from ~/.gsd/defaults.json', async () => {
    await writeGlobalDefaults({
      hooks: { context_warnings: false },
      features: { thinking_partner: true, global_learnings: true },
    });
    const { configNewProject } = await import('./config-mutation.js');
    await configNewProject([], tmpDir);

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.hooks.context_warnings).toBe(false);
    expect(raw.features.thinking_partner).toBe(true);
    expect(raw.features.global_learnings).toBe(true);
  });

  it('enforces precedence: userChoices > globalDefaults > hardcoded', async () => {
    await writeGlobalDefaults({
      workflow: {
        code_review_depth: 'deep', // only in global
        auto_advance: true,        // will be overridden by userChoices
      },
    });
    const userChoices = JSON.stringify({
      workflow: { auto_advance: false },
    });
    const { configNewProject } = await import('./config-mutation.js');
    await configNewProject([userChoices], tmpDir);

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    // userChoices wins over globalDefaults
    expect(raw.workflow.auto_advance).toBe(false);
    // globalDefaults wins over hardcoded when userChoices is silent
    expect(raw.workflow.code_review_depth).toBe('deep');
    // hardcoded applies when neither source specifies
    expect(raw.workflow.research).toBe(true);
  });
});

// ─── configSet ─────────────────────────────────────────────────────────────

describe('configSet', () => {
  it('writes value and round-trips through reading config.json', async () => {
    const { configSet } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }),
    );
    const result = await configSet(['model_profile', 'quality'], tmpDir);
    expect(result.data).toEqual({
      updated: true,
      key: 'model_profile',
      value: 'quality',
      previousValue: 'balanced',
    });

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.model_profile).toBe('quality');
  });

  it('sets nested dot-notation keys', async () => {
    const { configSet } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { research: true } }),
    );
    const result = await configSet(['workflow.auto_advance', 'true'], tmpDir);
    expect(result.data).toEqual({
      updated: true,
      key: 'workflow.auto_advance',
      value: true,
    });

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.workflow.auto_advance).toBe(true);
    expect(raw.workflow.research).toBe(true);
  });

  it('rejects invalid key with GSDError', async () => {
    const { configSet } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({}),
    );
    await expect(configSet(['totally_bogus_key', 'value'], tmpDir)).rejects.toThrow(GSDError);
  });

  it('coerces values through parseConfigValue', async () => {
    const { configSet } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({}),
    );
    await configSet(['commit_docs', 'true'], tmpDir);
    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.commit_docs).toBe(true);
  });
});

// ─── configSetModelProfile ─────────────────────────────────────────────────

describe('configSetModelProfile', () => {
  it('writes valid profile', async () => {
    const { configSetModelProfile } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }),
    );
    const result = await configSetModelProfile(['quality'], tmpDir);
    expect((result.data as { updated: boolean }).updated).toBe(true);
    expect((result.data as { profile: string }).profile).toBe('quality');

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.model_profile).toBe('quality');
  });

  it('rejects invalid profile with GSDError', async () => {
    const { configSetModelProfile } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({}),
    );
    await expect(configSetModelProfile(['invalid_profile'], tmpDir)).rejects.toThrow(GSDError);
  });

  it('normalizes profile name to lowercase', async () => {
    const { configSetModelProfile } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({}),
    );
    const result = await configSetModelProfile(['Quality'], tmpDir);
    expect((result.data as { profile: string }).profile).toBe('quality');
  });
});

// ─── configNewProject ──────────────────────────────────────────────────────

describe('configNewProject', () => {
  it('creates config.json with defaults', async () => {
    const { configNewProject } = await import('./config-mutation.js');
    const result = await configNewProject([], tmpDir);
    expect((result.data as { created: boolean }).created).toBe(true);

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.model_profile).toBe('balanced');
    expect(raw.commit_docs).toBe(true);
  });

  it('merges user choices', async () => {
    const { configNewProject } = await import('./config-mutation.js');
    const choices = JSON.stringify({ model_profile: 'quality', commit_docs: true });
    const result = await configNewProject([choices], tmpDir);
    expect((result.data as { created: boolean }).created).toBe(true);

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.model_profile).toBe('quality');
    expect(raw.commit_docs).toBe(true);
  });

  it('does not overwrite existing config', async () => {
    const { configNewProject } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'quality' }),
    );
    const result = await configNewProject([], tmpDir);
    expect((result.data as { created: boolean }).created).toBe(false);
  });
});

// ─── configEnsureSection ───────────────────────────────────────────────────

describe('configEnsureSection', () => {
  it('creates section if not present', async () => {
    const { configEnsureSection } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced' }),
    );
    const result = await configEnsureSection(['workflow'], tmpDir);
    expect((result.data as { ensured: boolean }).ensured).toBe(true);

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.workflow).toEqual({});
  });

  it('is idempotent on existing section', async () => {
    const { configEnsureSection } = await import('./config-mutation.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { research: true } }),
    );
    const result = await configEnsureSection(['workflow'], tmpDir);
    expect((result.data as { ensured: boolean }).ensured).toBe(true);

    const raw = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(raw.workflow).toEqual({ research: true });
  });
});
