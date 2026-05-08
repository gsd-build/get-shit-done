/**
 * Agent skills query handler — read configured skills from `.planning/config.json`
 * and emit the `<agent_skills>` XML block workflows interpolate into Task() prompts.
 *
 * Ports `buildAgentSkillsBlock` semantics from
 * `get-shit-done/bin/lib/init.cjs` so the SDK path honors
 * `config.agent_skills[agentType]` the same way the legacy
 * `gsd-tools.cjs agent-skills <type>` path does. Project-relative skills stay
 * project-root validated; `global:<name>` now resolves through runtime-aware
 * global skills dir policy rather than a Claude-only hardcoded path. Fixes #2555.
 *
 * @example
 * ```typescript
 * import { agentSkills } from './skills.js';
 *
 * // With config.agent_skills = { "gsd-planner": [".claude/skills/demo-skill"] }
 * await agentSkills(['gsd-planner'], '/project');
 * // { data: '<agent_skills>\nRead these user-configured skills:\n- @.claude/skills/demo-skill/SKILL.md\n</agent_skills>' }
 *
 * // No agent type → empty string (matches gsd-tools cmdAgentSkills).
 * await agentSkills([], '/project');
 * // { data: '' }
 * ```
 */

import { existsSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

import type { QueryHandler } from './utils.js';
import { detectRuntime, renderGlobalSkillDisplayPath, resolveGlobalSkillDir, resolveGlobalSkillsBase } from './helpers.js';
import { loadConfig } from '../config.js';

const GLOBAL_SKILL_NAME_RE = /^[a-zA-Z0-9_-]+$/;

/**
 * Resolve `target` and ensure it stays inside `baseDir` after symlink resolution.
 * Mirrors the symlink-escape guard in `bin/lib/security.cjs#validatePath`.
 */
function resolveWithinBase(target: string, baseDir: string): string | null {
  try {
    const resolvedBase = existsSync(baseDir) ? realpathSync(baseDir) : resolve(baseDir);
    const absTarget = resolve(baseDir, target);
    const resolvedTarget = existsSync(absTarget) ? realpathSync(absTarget) : absTarget;
    const baseWithSep = resolvedBase.endsWith(sep) ? resolvedBase : resolvedBase + sep;
    if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(baseWithSep)) {
      return null;
    }
    return resolvedTarget;
  } catch {
    return null;
  }
}

export const agentSkills: QueryHandler = async (args, projectDir) => {
  const agentType = (args[0] || '').trim();
  // Match gsd-tools `cmdAgentSkills`: no agent type → empty string (JSON `""`), not a structured object.
  if (!agentType) {
    return { data: '' };
  }

  let config;
  try {
    config = await loadConfig(projectDir);
  } catch {
    return { data: '' };
  }

  const raw = config.agent_skills?.[agentType];
  if (!raw) return { data: '' };

  let skillPaths: unknown[];
  if (typeof raw === 'string') {
    skillPaths = [raw];
  } else if (Array.isArray(raw)) {
    skillPaths = raw;
  } else {
    return { data: '' };
  }
  if (skillPaths.length === 0) return { data: '' };

  const runtime = detectRuntime(config as { runtime?: unknown });
  const globalSkillsBase = resolveGlobalSkillsBase(runtime);
  const validEntries: Array<{ ref: string }> = [];

  for (const entry of skillPaths) {
    if (typeof entry !== 'string') continue;

    // `global:<name>` — skill installed under the runtime-global skills dir (#1992, #3126).
    if (entry.startsWith('global:')) {
      const skillName = entry.slice(7);
      if (!skillName) {
        process.stderr.write('[agent-skills] WARNING: "global:" prefix with empty skill name — skipping\n');
        continue;
      }
      if (!GLOBAL_SKILL_NAME_RE.test(skillName)) {
        process.stderr.write(`[agent-skills] WARNING: Invalid global skill name "${skillName}" — skipping\n`);
        continue;
      }
      if (globalSkillsBase === null) {
        process.stderr.write(`[agent-skills] WARNING: Runtime "${runtime}" does not use a skills directory — "global:${skillName}" is not supported on this runtime\n`);
        continue;
      }
      const skillDir = resolveGlobalSkillDir(runtime, skillName);
      const displayPath = renderGlobalSkillDisplayPath(runtime, skillName);
      if (!skillDir) {
        process.stderr.write(`[agent-skills] WARNING: Could not resolve global skill directory for "${skillName}" on runtime "${runtime}" — skipping\n`);
        continue;
      }
      const skillMd = join(skillDir, 'SKILL.md');
      if (!existsSync(skillMd)) {
        process.stderr.write(`[agent-skills] WARNING: Global skill not found at "${displayPath}/SKILL.md" — skipping\n`);
        continue;
      }
      if (resolveWithinBase(skillMd, globalSkillsBase) === null) {
        process.stderr.write(`[agent-skills] WARNING: Global skill "${skillName}" failed path check (symlink escape?) — skipping\n`);
        continue;
      }
      validEntries.push({ ref: skillMd });
      continue;
    }

    // Project-relative path — must resolve within projectDir.
    if (resolveWithinBase(entry, projectDir) === null) {
      process.stderr.write(`[agent-skills] WARNING: Skipping unsafe path "${entry}"\n`);
      continue;
    }
    const skillMd = join(projectDir, entry, 'SKILL.md');
    if (!existsSync(skillMd)) {
      process.stderr.write(`[agent-skills] WARNING: Skill not found at "${entry}/SKILL.md" — skipping\n`);
      continue;
    }
    validEntries.push({ ref: `${entry}/SKILL.md` });
  }

  if (validEntries.length === 0) return { data: '' };

  const lines = validEntries.map((e) => `- @${e.ref}`).join('\n');
  const block = `<agent_skills>\nRead these user-configured skills:\n${lines}\n</agent_skills>`;
  // Signal the CLI dispatcher to write raw text — workflows embed the result
  // with `$(gsd-sdk query agent-skills …)` and need the XML block verbatim, not
  // a JSON-quoted string (see cli.ts QueryResult.format handling).
  return { data: block, format: 'text' };
};
