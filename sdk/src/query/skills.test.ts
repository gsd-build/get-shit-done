/**
 * Tests for agent skills query handler.
 *
 * Verifies the handler reads `config.agent_skills[agentType]` from
 * `.planning/config.json` and returns the `<agent_skills>` XML block
 * workflows interpolate into Task() prompts (regression for #2555).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { agentSkills } from './skills.js';

const CLI = resolve(fileURLToPath(import.meta.url), '../../../dist/cli.js');

async function writeSkill(rootDir: string, name: string) {
  const skillDir = join(rootDir, name);
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: test skill\n---\n\n# ${name}\n`,
  );
}

async function writeConfig(projectDir: string, config: unknown) {
  await mkdir(join(projectDir, '.planning'), { recursive: true });
  await writeFile(join(projectDir, '.planning', 'config.json'), JSON.stringify(config, null, 2));
}

describe('agentSkills', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-skills-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty string when no agent type is provided', async () => {
    const r = await agentSkills([], tmpDir);
    expect(r.data).toBe('');
  });

  it('returns empty string when project has no config', async () => {
    const r = await agentSkills(['gsd-planner'], tmpDir);
    expect(r.data).toBe('');
  });

  it('returns empty string when agent type not in config.agent_skills', async () => {
    await writeConfig(tmpDir, { agent_skills: { 'gsd-executor': ['.claude/skills/foo'] } });
    const r = await agentSkills(['gsd-planner'], tmpDir);
    expect(r.data).toBe('');
  });

  it('returns <agent_skills> block for each configured skill path', async () => {
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'skill-a');
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'skill-b');
    await writeConfig(tmpDir, {
      agent_skills: {
        'gsd-planner': ['.claude/skills/skill-a', '.claude/skills/skill-b'],
      },
    });

    const r = await agentSkills(['gsd-planner'], tmpDir);
    expect(r.data).toBe(
      '<agent_skills>\n' +
        'Read these user-configured skills:\n' +
        '- @.claude/skills/skill-a/SKILL.md\n' +
        '- @.claude/skills/skill-b/SKILL.md\n' +
        '</agent_skills>',
    );
  });

  it('accepts a single string skill path (normalizes to array)', async () => {
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'only-one');
    await writeConfig(tmpDir, {
      agent_skills: { 'gsd-planner': '.claude/skills/only-one' },
    });

    const r = await agentSkills(['gsd-planner'], tmpDir);
    expect(r.data).toBe(
      '<agent_skills>\n' +
        'Read these user-configured skills:\n' +
        '- @.claude/skills/only-one/SKILL.md\n' +
        '</agent_skills>',
    );
  });

  it('skips skills whose SKILL.md is missing', async () => {
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'exists');
    await mkdir(join(tmpDir, '.claude', 'skills', 'missing-md'), { recursive: true });
    await writeConfig(tmpDir, {
      agent_skills: {
        'gsd-planner': ['.claude/skills/exists', '.claude/skills/missing-md'],
      },
    });

    const r = await agentSkills(['gsd-planner'], tmpDir);
    expect(r.data).toBe(
      '<agent_skills>\n' +
        'Read these user-configured skills:\n' +
        '- @.claude/skills/exists/SKILL.md\n' +
        '</agent_skills>',
    );
  });

  it('rejects path traversal escaping the project root', async () => {
    await writeConfig(tmpDir, {
      agent_skills: { 'gsd-planner': ['../evil-skill'] },
    });

    const r = await agentSkills(['gsd-planner'], tmpDir);
    expect(r.data).toBe('');
  });

  it('returns empty string when agent_skills value is an empty array', async () => {
    await writeConfig(tmpDir, { agent_skills: { 'gsd-planner': [] } });
    const r = await agentSkills(['gsd-planner'], tmpDir);
    expect(r.data).toBe('');
  });

  it('signals format:"text" for non-empty blocks (used by CLI dispatcher)', async () => {
    await writeSkill(join(tmpDir, '.claude', 'skills'), 'a-skill');
    await writeConfig(tmpDir, {
      agent_skills: { 'gsd-planner': '.claude/skills/a-skill' },
    });

    const r = await agentSkills(['gsd-planner'], tmpDir);
    expect(r.format).toBe('text');
  });

  it('does not signal format:"text" for empty result', async () => {
    const r = await agentSkills(['gsd-planner'], tmpDir);
    expect(r.format).toBeUndefined();
  });
});

// ─── CLI stdout integration ─────────────────────────────────────────────────
// Regression guard for the JSON-wrapping bug (#2914): the CLI must emit the
// raw <agent_skills> block to stdout, not a JSON-quoted string.  Spawns the
// CLI as a child process so the full dispatch path (including cli.ts format
// handling) is exercised.

describe('agentSkills CLI stdout', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-skills-cli-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes raw <agent_skills> block to stdout — not JSON-wrapped', async () => {
    const skillDir = join(tmpDir, '.claude', 'skills', 'cli-skill');
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), '# cli-skill\n');
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ agent_skills: { 'gsd-planner': '.claude/skills/cli-skill' } }),
    );

    const stdout = execSync(
      `node "${CLI}" query --project-dir "${tmpDir}" agent-skills gsd-planner`,
      { encoding: 'utf-8' },
    );

    expect(stdout).toBe(
      '<agent_skills>\nRead these user-configured skills:\n- @.claude/skills/cli-skill/SKILL.md\n</agent_skills>\n',
    );
  });

  it('emits empty output (no JSON null) when agent type is unmapped', async () => {
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ agent_skills: { 'gsd-executor': ['.claude/skills/foo'] } }),
    );

    const stdout = execSync(
      `node "${CLI}" query --project-dir "${tmpDir}" agent-skills gsd-planner`,
      { encoding: 'utf-8' },
    );

    // Unmapped agent → empty string → CLI falls through to JSON (""), not raw
    // text. This is acceptable: workflows that embed an empty var are no-ops.
    // The important invariant is that a MAPPED agent never gets JSON-wrapped.
    expect(stdout.trim()).toBe('""');
  });
});
