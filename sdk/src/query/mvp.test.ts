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
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import {
  phaseMvpMode,
  phaseTddMode,
  taskIsBehaviorAdding,
  userStoryValidate,
  USER_STORY_REGEX,
  phaseWalkingSkeletonTrigger,
  taskTddGateCheck,
  phaseSkeletonStatus,
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

  it('**Mode:** mvp is preserved when the **Goal:** field is mutated in-place', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: Alpha\n\n**Goal:** Original goal text\n\n**Mode:** mvp\n\nSome description\n`);
      writeConfig(dir, { workflow: {} });

      // Sanity: before mutation, mode resolves correctly
      const beforeMode = await phaseMvpMode(['1'], dir);
      expect(beforeMode.data).toEqual({
        active: true,
        source: 'roadmap',
        roadmap_mode: 'mvp',
        config_mvp_mode: false,
        cli_flag_present: false,
        cli_no_flag_present: false,
      });

      // Mutate the Goal line — simulates what mvp-phase.md:161-173 does (in-place replace)
      const roadmapPath = join(dir, '.planning', 'ROADMAP.md');
      let content = readFileSync(roadmapPath, 'utf-8');
      content = content.replace(/\*\*Goal:\*\*\s*[^\n]*/m, '**Goal:** Mutated goal text');
      writeFileSync(roadmapPath, content);

      // Sanity: file still has **Mode:** mvp and mutated Goal on disk
      const afterDisk = readFileSync(roadmapPath, 'utf-8');
      expect(afterDisk).toMatch(/\*\*Mode:\*\*\s*mvp/);
      expect(afterDisk).toMatch(/\*\*Goal:\*\*\s*Mutated goal text/);

      // THE contract assertion: mode still resolves after goal mutation
      const afterMode = await phaseMvpMode(['1'], dir);
      expect(afterMode.data).toEqual({
        active: true,
        source: 'roadmap',
        roadmap_mode: 'mvp',
        config_mvp_mode: false,
        cli_flag_present: false,
        cli_no_flag_present: false,
      });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('**Mode:** field is unaffected when an unrelated phase\'s Goal is mutated', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, [
        '## Phases',
        '',
        '### Phase 1: Alpha',
        '',
        '**Goal:** Phase 1 original goal',
        '',
        '**Mode:** mvp',
        '',
        'Phase 1 description',
        '',
        '### Phase 2: Beta',
        '',
        '**Goal:** Phase 2 original goal',
        '',
        'Phase 2 description',
        '',
      ].join('\n'));
      writeConfig(dir, { workflow: {} });

      // Sanity: Phase 1 mode resolves before any mutation
      const beforeMode = await phaseMvpMode(['1'], dir);
      expect(beforeMode.data).toEqual({
        active: true,
        source: 'roadmap',
        roadmap_mode: 'mvp',
        config_mvp_mode: false,
        cli_flag_present: false,
        cli_no_flag_present: false,
      });

      // Mutate Phase 2's Goal only — Phase 1's **Mode:** line must be untouched
      const roadmapPath = join(dir, '.planning', 'ROADMAP.md');
      let content = readFileSync(roadmapPath, 'utf-8');
      // Target the second Goal occurrence (Phase 2's)
      let count = 0;
      content = content.replace(/\*\*Goal:\*\*\s*[^\n]*/gm, (match) => {
        count++;
        return count === 2 ? '**Goal:** Phase 2 mutated goal' : match;
      });
      writeFileSync(roadmapPath, content);

      // Sanity: Phase 2's Goal was changed, Phase 1's was not
      const afterDisk = readFileSync(roadmapPath, 'utf-8');
      expect(afterDisk).toMatch(/\*\*Goal:\*\*\s*Phase 1 original goal/);
      expect(afterDisk).toMatch(/\*\*Goal:\*\*\s*Phase 2 mutated goal/);

      // THE contract assertion: Phase 1 mode is still active after Phase 2 mutation
      const afterMode = await phaseMvpMode(['1'], dir);
      expect(afterMode.data).toEqual({
        active: true,
        source: 'roadmap',
        roadmap_mode: 'mvp',
        config_mvp_mode: false,
        cli_flag_present: false,
        cli_no_flag_present: false,
      });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('--cli-no-flag deactivates mvp even when roadmap mode is mvp', async () => {
    const dir = tmpProject();
    try {
      writeFileSync(join(dir, '.planning', 'ROADMAP.md'),
        `## Phase 1: Test\n\n**Goal:** ...\n\n**Mode:** mvp\n`);
      const result = await phaseMvpMode(['1', '--cli-no-flag'], dir);
      expect(result.data.active).toBe(false);
      expect(result.data.source).toBe('cli_no_flag');
      expect(result.data.roadmap_mode).toBe('mvp');  // roadmap STATE preserved in signals
      expect(result.data.cli_no_flag_present).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('--cli-no-flag with no roadmap mvp returns inactive (no-op)', async () => {
    const dir = tmpProject();
    try {
      writeFileSync(join(dir, '.planning', 'ROADMAP.md'),
        `## Phase 1: Test\n\n**Goal:** ...\n`);  // No **Mode:** line at all
      const result = await phaseMvpMode(['1', '--cli-no-flag'], dir);
      expect(result.data.active).toBe(false);
      expect(result.data.source).toBe('cli_no_flag');  // still cli_no_flag — explicit deactivation, even if it was already false
      expect(result.data.cli_no_flag_present).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('--cli-no-flag wins over --cli-flag (restrictive-wins)', async () => {
    const dir = tmpProject();
    try {
      writeFileSync(join(dir, '.planning', 'ROADMAP.md'),
        `## Phase 1: Test\n\n**Goal:** ...\n`);
      const result = await phaseMvpMode(['1', '--cli-flag', '--cli-no-flag'], dir);
      expect(result.data.active).toBe(false);
      expect(result.data.source).toBe('cli_no_flag');
      expect(result.data.cli_flag_present).toBe(true);
      expect(result.data.cli_no_flag_present).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('without --cli-no-flag, roadmap mvp still activates normally', async () => {
    const dir = tmpProject();
    try {
      writeFileSync(join(dir, '.planning', 'ROADMAP.md'),
        `## Phase 1: Test\n\n**Goal:** ...\n\n**Mode:** mvp\n`);
      const result = await phaseMvpMode(['1'], dir);
      expect(result.data.active).toBe(true);
      expect(result.data.source).toBe('roadmap');
      expect(result.data.cli_no_flag_present).toBe(false);
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

// ─── phase.walking-skeleton-trigger ─────────────────────────────────────────

describe('phase.walking-skeleton-trigger', () => {
  it('brownfield project with source files does NOT trigger Walking Skeleton', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: Walking Skeleton\n\n**Mode:** mvp\n**Goal:** Ship the walking skeleton.\n`);
      mkdirSync(join(dir, 'src'), { recursive: true });
      writeFileSync(join(dir, 'src', 'index.ts'), 'export const hello = "world";');
      const result = await phaseWalkingSkeletonTrigger(['1', '--cli-flag'], dir);
      expect(result.data.active).toBe(false);
      expect(result.data.signals.source_files_count).toBeGreaterThan(0);
      expect(result.data.signals.mvp_mode_active).toBe(true);
      expect(result.data.signals.is_phase_one).toBe(true);
      expect(result.data.signals.summaries_total).toBe(0);
      expect(result.data.reason).not.toBeNull();
      expect(result.data.reason).toMatch(/source files/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('greenfield project (no source files) DOES trigger Walking Skeleton', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: Walking Skeleton\n\n**Mode:** mvp\n**Goal:** Ship the skeleton.\n`);
      const result = await phaseWalkingSkeletonTrigger(['1', '--cli-flag'], dir);
      expect(result.data.active).toBe(true);
      expect(result.data.signals.source_files_count).toBe(0);
      expect(result.data.signals.mvp_mode_active).toBe(true);
      expect(result.data.signals.is_phase_one).toBe(true);
      expect(result.data.signals.summaries_total).toBe(0);
      expect(result.data.reason).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('Phase 2 of new project does NOT trigger Walking Skeleton', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 2: Auth\n\n**Mode:** mvp\n**Goal:** Auth.\n`);
      const result = await phaseWalkingSkeletonTrigger(['2', '--cli-flag'], dir);
      expect(result.data.active).toBe(false);
      expect(result.data.signals.is_phase_one).toBe(false);
      expect(result.data.reason).toMatch(/phase 2 is not phase 1/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('Phase 1 with prior summaries does NOT trigger', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: Walking Skeleton\n\n**Mode:** mvp\n**Goal:** Skeleton.\n`);
      // Seed a summary file so summaries_total > 0
      const phasesDir = join(dir, '.planning', 'phases', '01-walking-skeleton');
      mkdirSync(phasesDir, { recursive: true });
      writeFileSync(join(phasesDir, 'SUMMARY.md'), '# Phase 1 Summary\nCompleted.');
      const result = await phaseWalkingSkeletonTrigger(['1', '--cli-flag'], dir);
      expect(result.data.active).toBe(false);
      expect(result.data.signals.summaries_total).toBeGreaterThan(0);
      expect(result.data.reason).toMatch(/summar/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('Phase 1 + mvp mode absent does NOT trigger', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: Walking Skeleton\n\n**Goal:** Skeleton.\n`);
      const result = await phaseWalkingSkeletonTrigger(['1'], dir);
      expect(result.data.active).toBe(false);
      expect(result.data.signals.mvp_mode_active).toBe(false);
      expect(result.data.reason).toMatch(/mvp mode not active/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── task.tdd-gate-check ─────────────────────────────────────────────────────

describe('task.tdd-gate-check', () => {
  it('blocks when mvp+tdd active, task is behavior-adding, no RED commit', async () => {
    const dir = tmpProject();
    try {
      // Seed ROADMAP with mvp mode on phase 1
      writeRoadmap(dir, `### Phase 1: Auth\n\n**Goal:** ...\n\n**Mode:** mvp\n`);
      // Seed a plan file with tdd="true" and a behavior + source files
      const planPath = join(dir, '.planning', 'phase-01', '01-PLAN-auth.md');
      mkdirSync(dirname(planPath), { recursive: true });
      writeFileSync(planPath, `<task tdd="true">\n<behavior>User can log in</behavior>\n<files>\nsrc/auth.ts\n</files>\n</task>`);
      // Initialize git repo in tmp dir with NO RED commits
      execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });

      const result = await taskTddGateCheck([planPath, '--cli-tdd-flag'], dir);
      expect(result.data.gate_active).toBe(true);
      expect(result.data.blocked).toBe(true);
      expect(result.data.signals.mvp_mode_active).toBe(true);
      expect(result.data.signals.tdd_mode_active).toBe(true);
      expect(result.data.signals.is_behavior_adding).toBe(true);
      expect(result.data.signals.red_commit.found).toBe(false);
      expect(result.data.reason).toMatch(/no RED commit/i);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('unblocks when matching RED commit exists in git log', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `### Phase 1: Auth\n\n**Goal:** ...\n\n**Mode:** mvp\n`);
      const planPath = join(dir, '.planning', 'phase-01', '01-PLAN-auth.md');
      mkdirSync(dirname(planPath), { recursive: true });
      writeFileSync(planPath, `<task tdd="true">\n<behavior>User can log in</behavior>\n<files>\nsrc/auth.ts\n</files>\n</task>`);

      execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.email', 'test@test'], { cwd: dir });
      execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir });
      // Create a test file and commit it as a RED commit
      const testFile = join(dir, 'src', 'auth.test.ts');
      mkdirSync(dirname(testFile), { recursive: true });
      writeFileSync(testFile, 'test("login", () => { expect(true).toBe(false); });');
      execFileSync('git', ['add', '.'], { cwd: dir });
      execFileSync('git', ['commit', '-m', 'test(01-01-PLAN-auth): failing login spec (RED)'], { cwd: dir });

      const result = await taskTddGateCheck([planPath, '--cli-tdd-flag'], dir);
      expect(result.data.gate_active).toBe(true);
      expect(result.data.blocked).toBe(false);
      expect(result.data.signals.red_commit.found).toBe(true);
      expect(result.data.signals.red_commit.sha).toMatch(/^[a-f0-9]{7,}$/);
      expect(result.data.signals.red_commit.subject).toMatch(/test\(01-01-PLAN-auth\)/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('gate inactive when mvp mode absent', async () => {
    const dir = tmpProject();
    try {
      // No **Mode:** mvp in roadmap
      writeRoadmap(dir, `### Phase 1: Auth\n\n**Goal:** ...\n`);
      const planPath = join(dir, '.planning', 'phase-01', '01-PLAN-auth.md');
      mkdirSync(dirname(planPath), { recursive: true });
      writeFileSync(planPath, `<task tdd="true">\n<behavior>User can log in</behavior>\n<files>\nsrc/auth.ts\n</files>\n</task>`);

      const result = await taskTddGateCheck([planPath, '--cli-tdd-flag'], dir);
      expect(result.data.gate_active).toBe(false);
      expect(result.data.blocked).toBe(false);
      expect(result.data.reason).toMatch(/mvp.*not active/i);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('gate inactive when tdd mode absent', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `### Phase 1: Auth\n\n**Goal:** ...\n\n**Mode:** mvp\n`);
      const planPath = join(dir, '.planning', 'phase-01', '01-PLAN-auth.md');
      mkdirSync(dirname(planPath), { recursive: true });
      writeFileSync(planPath, `<task tdd="true">\n<behavior>User can log in</behavior>\n<files>\nsrc/auth.ts\n</files>\n</task>`);
      // NO --cli-tdd-flag and no config.tdd_mode

      const result = await taskTddGateCheck([planPath], dir);
      expect(result.data.gate_active).toBe(false);
      expect(result.data.blocked).toBe(false);
      expect(result.data.reason).toMatch(/tdd.*not active/i);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('gate active but not blocked when task is doc-only', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `### Phase 1: Auth\n\n**Goal:** ...\n\n**Mode:** mvp\n`);
      const planPath = join(dir, '.planning', 'phase-01', '01-PLAN-auth.md');
      mkdirSync(dirname(planPath), { recursive: true });
      // Only docs in <files> → not behavior-adding
      writeFileSync(planPath, `<task tdd="true">\n<behavior>Update docs</behavior>\n<files>\ndocs/auth.md\n</files>\n</task>`);

      const result = await taskTddGateCheck([planPath, '--cli-tdd-flag'], dir);
      expect(result.data.signals.is_behavior_adding).toBe(false);
      expect(result.data.gate_active).toBe(false);
      expect(result.data.blocked).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('gate evaluates correctly with tdd flag from config', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `### Phase 1: Auth\n\n**Goal:** ...\n\n**Mode:** mvp\n`);
      const planPath = join(dir, '.planning', 'phase-01', '01-PLAN-auth.md');
      mkdirSync(dirname(planPath), { recursive: true });
      writeFileSync(planPath, `<task tdd="true">\n<behavior>User can log in</behavior>\n<files>\nsrc/auth.ts\n</files>\n</task>`);
      // Set tdd_mode via config (no --cli-tdd-flag)
      writeConfig(dir, { workflow: { tdd_mode: true } });
      // Init git with no RED commits
      execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });

      const result = await taskTddGateCheck([planPath], dir);
      expect(result.data.signals.tdd_mode_active).toBe(true);
      expect(result.data.gate_active).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

// ─── phase.tdd-mode ──────────────────────────────────────────────────────────

describe('phase.tdd-mode', () => {
  it('reads **TDD:** true from roadmap', async () => {
    const dir = tmpProject();
    try {
      writeFileSync(join(dir, '.planning', 'ROADMAP.md'),
        `## Phase 1: Test\n\n**Goal:** ...\n\n**TDD:** true\n`);
      const result = await phaseTddMode(['1'], dir);
      expect(result.data.active).toBe(true);
      expect(result.data.source).toBe('roadmap');
      expect(result.data.roadmap_tdd).toBe('true');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('tdd absent → active=false, source=none', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: X\n\n**Goal:** Test.\n`);
      writeConfig(dir, { workflow: {} });
      const result = await phaseTddMode(['1'], dir);
      expect(result.data.active).toBe(false);
      expect(result.data.source).toBe('none');
      expect(result.data.roadmap_tdd).toBeNull();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('roadmap **TDD:** false → active=false', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: X\n\n**TDD:** false\n**Goal:** Test.\n`);
      writeConfig(dir, { workflow: {} });
      const result = await phaseTddMode(['1'], dir);
      expect(result.data.active).toBe(false);
      expect(result.data.source).toBe('none');
      expect(result.data.roadmap_tdd).toBe('false');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('cli_flag activates without roadmap', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: X\n\n**Goal:** Test.\n`);
      writeConfig(dir, { workflow: { tdd_mode: false } });
      const result = await phaseTddMode(['1', '--cli-flag'], dir);
      expect(result.data.active).toBe(true);
      expect(result.data.source).toBe('cli_flag');
      expect(result.data.cli_flag_present).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('cli_no_flag deactivates roadmap tdd', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: X\n\n**TDD:** true\n**Goal:** Test.\n`);
      const result = await phaseTddMode(['1', '--cli-no-flag'], dir);
      expect(result.data.active).toBe(false);
      expect(result.data.source).toBe('cli_no_flag');
      expect(result.data.roadmap_tdd).toBe('true');
      expect(result.data.cli_no_flag_present).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('cli_no_flag wins over cli_flag (restrictive-wins)', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: X\n\n**Goal:** Test.\n`);
      const result = await phaseTddMode(['1', '--cli-flag', '--cli-no-flag'], dir);
      expect(result.data.active).toBe(false);
      expect(result.data.source).toBe('cli_no_flag');
      expect(result.data.cli_flag_present).toBe(true);
      expect(result.data.cli_no_flag_present).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('config workflow.tdd_mode=true activates without roadmap', async () => {
    const dir = tmpProject();
    try {
      writeRoadmap(dir, `## Phase 1: X\n\n**Goal:** Test.\n`);
      writeConfig(dir, { workflow: { tdd_mode: true } });
      const result = await phaseTddMode(['1'], dir);
      expect(result.data.active).toBe(true);
      expect(result.data.source).toBe('config');
      expect(result.data.config_tdd_mode).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

// ─── phase.skeleton-status ───────────────────────────────────────────────────

describe('phase.skeleton-status', () => {
  it('reports exists=true with per-phase SKELETON.md path', async () => {
    const dir = tmpProject();
    try {
      const phaseDir = join(dir, '.planning', 'phase-01');
      mkdirSync(phaseDir, { recursive: true });
      const skeletonPath = join(phaseDir, 'SKELETON.md');
      writeFileSync(skeletonPath, '# Walking Skeleton\n\nArchitectural baseline.\n');
      const result = await phaseSkeletonStatus(['1'], dir);
      expect(result.data.exists).toBe(true);
      expect(result.data.path).toBe(skeletonPath);
      expect(result.data.size_bytes).toBeGreaterThan(0);
      expect(result.data.last_modified_ms).toBeGreaterThan(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('reports exists=false when no SKELETON.md present', async () => {
    const dir = tmpProject();
    try {
      const result = await phaseSkeletonStatus(['1'], dir);
      expect(result.data.exists).toBe(false);
      expect(result.data.size_bytes).toBe(0);
      expect(result.data.last_modified_ms).toBe(0);
      expect(result.data.path).toMatch(/SKELETON\.md$/); // path is set even when file absent
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('falls back to root SKELETON.md when per-phase absent', async () => {
    const dir = tmpProject();
    try {
      const rootSkeleton = join(dir, 'SKELETON.md');
      writeFileSync(rootSkeleton, '# Legacy Skeleton\n');
      const result = await phaseSkeletonStatus(['1'], dir);
      expect(result.data.exists).toBe(true);
      expect(result.data.path).toBe(rootSkeleton);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('per-phase SKELETON.md takes precedence over root', async () => {
    const dir = tmpProject();
    try {
      writeFileSync(join(dir, 'SKELETON.md'), '# Root\n');
      const phaseDir = join(dir, '.planning', 'phase-01');
      mkdirSync(phaseDir, { recursive: true });
      const phaseSkel = join(phaseDir, 'SKELETON.md');
      writeFileSync(phaseSkel, '# Phase 1\n');
      const result = await phaseSkeletonStatus(['1'], dir);
      expect(result.data.exists).toBe(true);
      expect(result.data.path).toBe(phaseSkel);  // per-phase wins
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
