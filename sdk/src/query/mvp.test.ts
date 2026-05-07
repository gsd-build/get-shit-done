/**
 * Tests for the three MVP-mode query handlers in `mvp.ts`:
 *   - `phase.mvp-mode` — precedence chain resolver
 *   - `task.is-behavior-adding` — three-check predicate
 *   - `user-story.validate` — regex validator
 *
 * Plus the regression for the SDK roadmap-port mode-extraction bug
 * (`searchPhaseInContent` previously omitted the `mode` field).
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  phaseMvpMode,
  taskIsBehaviorAdding,
  userStoryValidate,
  USER_STORY_REGEX,
} from './mvp.js';
import { roadmapGetPhase } from './roadmap.js';

function tmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-mvp-test-'));
  mkdirSync(join(dir, '.planning'), { recursive: true });
  return dir;
}

function writeRoadmap(dir: string, body: string): void {
  writeFileSync(join(dir, '.planning', 'ROADMAP.md'), body);
}

function writeConfig(dir: string, config: Record<string, unknown>): void {
  writeFileSync(join(dir, '.planning', 'config.json'), JSON.stringify(config));
}

function writeWorkstreamConfig(dir: string, workstream: string, config: Record<string, unknown>): void {
  const wsDir = join(dir, '.planning', 'workstreams', workstream);
  mkdirSync(wsDir, { recursive: true });
  writeFileSync(join(wsDir, 'config.json'), JSON.stringify(config));
}

// ─── roadmap.get-phase mode field regression ────────────────────────────────

describe('roadmap.get-phase: mode field (regression)', () => {
  it('extracts **Mode:** mvp from a phase section', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `# Roadmap\n\n## Phase 1: Walking Skeleton\n\n**Mode:** mvp\n**Goal:** Ship the walking skeleton.\n\n**Success Criteria**:\n1. Stack works end-to-end\n`);
      const result = await roadmapGetPhase(['1'], dir);
      const data = result.data as { found: boolean; mode?: string | null };
      expect(data.found).toBe(true);
      expect(data.mode).toBe('mvp');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns mode=null when **Mode:** absent', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `# Roadmap\n\n## Phase 2: Standard\n\n**Goal:** Generic phase.\n`);
      const result = await roadmapGetPhase(['2'], dir);
      const data = result.data as { found: boolean; mode?: string | null };
      expect(data.found).toBe(true);
      expect(data.mode).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('preserves unrecognized mode verbatim (lowercased) for forward-compat', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `# Roadmap\n\n## Phase 3: Future\n\n**Mode:** Spike\n**Goal:** Try a spike.\n`);
      const result = await roadmapGetPhase(['3'], dir);
      const data = result.data as { found: boolean; mode?: string | null };
      expect(data.mode).toBe('spike');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── phase.mvp-mode ─────────────────────────────────────────────────────────

describe('phase.mvp-mode', () => {
  it('rejects missing phase argument', async () => {
    await expect(phaseMvpMode([], '/tmp')).rejects.toThrow(/Usage: phase.mvp-mode/);
  });

  it('CLI flag wins over roadmap and config', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: X\n\n**Goal:** Test.\n`);
      writeConfig(dir, { workflow: { mvp_mode: false } });
      const result = await phaseMvpMode(['1', '--cli-flag'], dir);
      expect(result.data.active).toBe(true);
      expect(result.data.source).toBe('cli_flag');
      expect(result.data.cli_flag_present).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('roadmap **Mode:** mvp activates when CLI flag absent', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: X\n\n**Mode:** mvp\n**Goal:** Test.\n`);
      writeConfig(dir, { workflow: { mvp_mode: false } });
      const result = await phaseMvpMode(['1'], dir);
      expect(result.data.active).toBe(true);
      expect(result.data.source).toBe('roadmap');
      expect(result.data.roadmap_mode).toBe('mvp');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('roadmap mode is normalized before comparison (MVP/whitespace still activates)', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: X\n\n**Mode:**  MVP  \n**Goal:** Test.\n`);
      writeConfig(dir, { workflow: { mvp_mode: false } });
      const result = await phaseMvpMode(['1'], dir);
      expect(result.data.active).toBe(true);
      expect(result.data.source).toBe('roadmap');
      expect(result.data.roadmap_mode).toBe('mvp');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('config workflow.mvp_mode=true activates when CLI and roadmap absent', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: X\n\n**Goal:** Test.\n`);
      writeConfig(dir, { workflow: { mvp_mode: true } });
      const result = await phaseMvpMode(['1'], dir);
      expect(result.data.active).toBe(true);
      expect(result.data.source).toBe('config');
      expect(result.data.config_mvp_mode).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('workstream config overrides root config when workstream is provided', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: X\n\n**Goal:** Test.\n`);
      writeConfig(dir, { workflow: { mvp_mode: false } });
      writeWorkstreamConfig(dir, 'alpha', { workflow: { mvp_mode: true } });
      const result = await phaseMvpMode(['1'], dir, 'alpha');
      expect(result.data.active).toBe(true);
      expect(result.data.source).toBe('config');
      expect(result.data.config_mvp_mode).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('all three signals absent → active=false, source=none', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: X\n\n**Goal:** Test.\n`);
      writeConfig(dir, { workflow: {} });
      const result = await phaseMvpMode(['1'], dir);
      expect(result.data.active).toBe(false);
      expect(result.data.source).toBe('none');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('non-mvp roadmap mode does not activate (forward-compat preservation)', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: X\n\n**Mode:** spike\n**Goal:** Test.\n`);
      writeConfig(dir, { workflow: {} });
      const result = await phaseMvpMode(['1'], dir);
      expect(result.data.active).toBe(false);
      expect(result.data.roadmap_mode).toBe('spike');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

// ─── task.is-behavior-adding ────────────────────────────────────────────────

describe('task.is-behavior-adding', () => {
  it('rejects when neither path nor --task-content given', async () => {
    await expect(taskIsBehaviorAdding([], '/tmp')).rejects.toThrow(/Usage:/);
  });

  it('rejects nonexistent file path', async () => {
    await expect(taskIsBehaviorAdding(['/tmp/__nope__.md'], '/tmp')).rejects.toThrow(/not found/);
  });

  it('all three checks pass → is_behavior_adding=true', async () => {
    const result = await taskIsBehaviorAdding([
      '--task-content',
      `<task tdd="true">\n<behavior>User can log in</behavior>\n<files>\nsrc/auth.ts\nsrc/auth.test.ts\n</files>\n</task>`,
    ], '/tmp');
    expect(result.data.is_behavior_adding).toBe(true);
    expect(result.data.checks).toEqual({
      tdd_true: true,
      has_behavior_block: true,
      has_source_files: true,
    });
    expect(result.data.reason).toBeNull();
  });

  it('tdd="false" → not behavior-adding', async () => {
    const result = await taskIsBehaviorAdding([
      '--task-content',
      `<task tdd="false">\n<behavior>User can log in</behavior>\n<files>src/auth.ts</files>\n</task>`,
    ], '/tmp');
    expect(result.data.is_behavior_adding).toBe(false);
    expect(result.data.checks.tdd_true).toBe(false);
    expect(result.data.reason).toMatch(/tdd="true" frontmatter absent/);
  });

  it('empty <behavior> block → not behavior-adding', async () => {
    const result = await taskIsBehaviorAdding([
      '--task-content',
      `<task tdd="true">\n<behavior>   </behavior>\n<files>src/a.ts</files>\n</task>`,
    ], '/tmp');
    expect(result.data.is_behavior_adding).toBe(false);
    expect(result.data.checks.has_behavior_block).toBe(false);
  });

  it('only test files in <files> → not behavior-adding', async () => {
    const result = await taskIsBehaviorAdding([
      '--task-content',
      `<task tdd="true">\n<behavior>X</behavior>\n<files>\nsrc/a.test.ts\nsrc/b.spec.js\n</files>\n</task>`,
    ], '/tmp');
    expect(result.data.is_behavior_adding).toBe(false);
    expect(result.data.checks.has_source_files).toBe(false);
  });

  it('only docs in <files> → not behavior-adding', async () => {
    const result = await taskIsBehaviorAdding([
      '--task-content',
      `<task tdd="true">\n<behavior>X</behavior>\n<files>\ndocs/X.md\nconfig.json\n</files>\n</task>`,
    ], '/tmp');
    expect(result.data.is_behavior_adding).toBe(false);
    expect(result.data.checks.has_source_files).toBe(false);
  });

  it('reads from a file path on disk', async () => {
    const dir = tmpProject();
    try {
      const file = join(dir, 'plan.md');
      writeFileSync(file, `<task tdd="true">\n<behavior>X</behavior>\n<files>src/a.ts</files>\n</task>`);
      const result = await taskIsBehaviorAdding([file], dir);
      expect(result.data.is_behavior_adding).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('rejects task file path outside project scope', async () => {
    const dir = tmpProject();
    try {
      await expect(taskIsBehaviorAdding(['/tmp/outside-plan.md'], dir))
        .rejects
        .toThrow(/outside project scope/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('config-only files in <files> are excluded from behavior-adding', async () => {
    const result = await taskIsBehaviorAdding([
      '--task-content',
      `<task tdd="true">\n<behavior>Update settings</behavior>\n<files>\nconfig/app.yaml\n.env.local\nsettings.toml\n</files>\n</task>`,
    ], '/tmp');
    expect(result.data.is_behavior_adding).toBe(false);
    expect(result.data.checks.has_source_files).toBe(false);
  });

  it('files under tests/ are excluded from behavior-adding source-file detection', async () => {
    const result = await taskIsBehaviorAdding([
      '--task-content',
      `<task tdd="true">\n<behavior>Adjust tests only</behavior>\n<files>\ntests/user-flow.spec.ts\ntest/helpers.ts\n</files>\n</task>`,
    ], '/tmp');
    expect(result.data.is_behavior_adding).toBe(false);
    expect(result.data.checks.has_source_files).toBe(false);
  });
});

// ─── user-story.validate ────────────────────────────────────────────────────

describe('user-story.validate', () => {
  it('rejects empty input', async () => {
    await expect(userStoryValidate([], '/tmp')).rejects.toThrow(/Usage:/);
  });

  it('canonical user story is valid + slots extracted', async () => {
    const result = await userStoryValidate([
      'As a solo developer, I want to log in, so that I can see my dashboard.',
    ], '/tmp');
    expect(result.data.valid).toBe(true);
    expect(result.data.slots).toEqual({
      role: 'solo developer',
      capability: 'log in',
      outcome: 'I can see my dashboard',
    });
    expect(result.data.errors).toEqual([]);
  });

  it('--story flag form parses single argument', async () => {
    const result = await userStoryValidate([
      '--story',
      'As a user, I want to bulk-import contacts, so that onboarding takes seconds.',
    ], '/tmp');
    expect(result.data.valid).toBe(true);
    expect(result.data.slots?.role).toBe('user');
  });

  it('missing terminal period flagged', async () => {
    const result = await userStoryValidate([
      'As a user, I want to X, so that Y',
    ], '/tmp');
    expect(result.data.valid).toBe(false);
    expect(result.data.errors.some(e => /period/.test(e))).toBe(true);
  });

  it('missing "I want to" phrase flagged', async () => {
    const result = await userStoryValidate([
      'As a user, I would like X, so that Y.',
    ], '/tmp');
    expect(result.data.valid).toBe(false);
    expect(result.data.errors.some(e => /I want to/.test(e))).toBe(true);
  });

  it('missing "As a " prefix flagged', async () => {
    const result = await userStoryValidate([
      'A user wants X, I want to log in, so that Y.',
    ], '/tmp');
    expect(result.data.valid).toBe(false);
    expect(result.data.errors.some(e => /As a/.test(e))).toBe(true);
  });

  it('USER_STORY_REGEX is exported and matches the canonical shape', () => {
    expect(USER_STORY_REGEX.test('As a X, I want to Y, so that Z.')).toBe(true);
    expect(USER_STORY_REGEX.test('As a X, I want to Y, so that Z')).toBe(false);
    expect(USER_STORY_REGEX.test('As X, I want to Y, so that Z.')).toBe(false);
  });
});
