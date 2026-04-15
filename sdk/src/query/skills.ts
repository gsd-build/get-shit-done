/**
 * Agent skills query handler — scan installed skill directories.
 *
 * Reads from project `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`,
 * `.github/skills/`, `.codex/skills/`, plus managed global `~/.claude/skills/`
 * and `~/.codex/skills/` roots.
 *
 * @example
 * ```typescript
 * import { agentSkills } from './skills.js';
 *
 * await agentSkills(['gsd-executor'], '/project');
 * // { data: { agent_type: 'gsd-executor', skills: ['plan', 'verify'], skill_count: 2 } }
 * ```
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import type { QueryHandler } from './utils.js';

export const agentSkills: QueryHandler = async (args, projectDir) => {
  const agentType = args[0] || '';
  const skillDirs = [
    join(projectDir, '.claude', 'skills'),
    join(projectDir, '.agents', 'skills'),
    join(projectDir, '.cursor', 'skills'),
    join(projectDir, '.github', 'skills'),
    join(projectDir, '.codex', 'skills'),
    join(homedir(), '.claude', 'skills'),
    join(homedir(), '.codex', 'skills'),
  ];

  const skills: string[] = [];
  for (const dir of skillDirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!existsSync(join(dir, entry.name, 'SKILL.md'))) continue;
        skills.push(entry.name);
      }
    } catch { /* skip */ }
  }

  const dedupedSkills = [...new Set(skills)];
  return {
    data: {
      agent_type: agentType,
      skills: dedupedSkills,
      skill_count: dedupedSkills.length,
    },
  };
};
