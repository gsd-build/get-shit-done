/**
 * Tests for agent skills query handler.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { agentSkills } from './skills.js';

function writeSkill(rootDir: string, name: string, description = 'Skill under test') {
  const skillDir = join(rootDir, name);
  return mkdir(skillDir, { recursive: true }).then(() => writeFile(join(skillDir, 'SKILL.md'), [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    '---',
    '',
    `# ${name}`,
  ].join('\n')));
}

describe('agentSkills', () => {
  let tmpDir: string;
  let homeDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-skills-'));
    homeDir = await mkdtemp(join(tmpdir(), 'gsd-skills-home-'));
    await writeSkill(join(tmpDir, '.cursor', 'skills'), 'my-skill');
    await writeSkill(join(tmpDir, '.codex', 'skills'), 'project-codex');
    await mkdir(join(tmpDir, '.claude', 'skills', 'orphaned-dir'), { recursive: true });
    await writeSkill(join(homeDir, '.claude', 'skills'), 'global-claude');
    await writeSkill(join(homeDir, '.codex', 'skills'), 'global-codex');
    await writeSkill(join(homeDir, '.claude', 'get-shit-done', 'skills'), 'legacy-import');
    vi.stubEnv('HOME', homeDir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(tmpDir, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  it('returns deduped skill names from project and managed global skill dirs', async () => {
    const r = await agentSkills(['gsd-executor'], tmpDir);
    const data = r.data as Record<string, unknown>;
    const skills = data.skills as string[];

    expect(skills).toEqual(expect.arrayContaining([
      'my-skill',
      'project-codex',
      'global-claude',
      'global-codex',
    ]));
    expect(skills).not.toContain('orphaned-dir');
    expect(skills).not.toContain('legacy-import');
    expect(data.skill_count).toBe(skills.length);
  });

  it('counts deduped skill names when the same skill exists in multiple roots', async () => {
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'shared-skill');
    await writeSkill(join(tmpDir, '.agents', 'skills'), 'shared-skill');

    const r = await agentSkills(['gsd-executor'], tmpDir);
    const data = r.data as Record<string, unknown>;
    const skills = data.skills as string[];

    expect(skills.filter((skill) => skill === 'shared-skill')).toHaveLength(1);
    expect(data.skill_count).toBe(skills.length);
  });
});
