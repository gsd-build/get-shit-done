/**
 * Install profiles — single source of truth for which skills/agents
 * are written to the runtime config dirs.
 *
 * Background: every installed `gsd-*` skill costs eager system-prompt
 * tokens because runtimes (Claude Code, opencode, etc.) enumerate
 * skill descriptions in `<available_skills>` on every turn. With 86
 * skills + 33 agents the floor is ~12k tokens per turn, which is a
 * meaningful tax for local LLMs with 32K–128K context. Frontier
 * models (Sonnet 4.6 / Opus 4.7 with 200K–1M ctx) don't feel it.
 *
 * The `minimal` profile installs the main GSD loop only:
 *   new-project → discuss-phase → plan-phase → execute-phase
 * plus `help` (discoverability) and `update` (upgrade path).
 *
 * Users opt into minimal via `--minimal` on the install CLI.
 * Default install (`full`) is unchanged — back-compat preserved.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const MINIMAL_SKILL_ALLOWLIST = Object.freeze([
  'new-project',
  'discuss-phase',
  'plan-phase',
  'execute-phase',
  'help',
  'update',
]);

const MINIMAL_ALLOWLIST_SET = new Set(MINIMAL_SKILL_ALLOWLIST);

function isMinimalMode(mode) {
  return mode === 'minimal';
}

function shouldInstallSkill(skillBaseName, mode) {
  if (!isMinimalMode(mode)) return true;
  return MINIMAL_ALLOWLIST_SET.has(skillBaseName);
}

/**
 * Stage a filtered copy of the source commands/gsd directory when in
 * minimal mode. All runtime-specific copy fns recurse a source dir,
 * so filtering at the source point lets every copy fn stay unchanged
 * (DRY: one filter, not 12).
 *
 * In full mode this is a no-op — the original srcDir is returned.
 *
 * @param {string} srcDir absolute path to commands/gsd
 * @param {string} mode 'full' | 'minimal'
 * @returns {string} path to use (original or staged tmp)
 */
function stageSkillsForMode(srcDir, mode) {
  if (!isMinimalMode(mode)) return srcDir;
  if (!fs.existsSync(srcDir)) return srcDir;

  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-minimal-skills-'));
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md')) continue;
    const baseName = entry.name.replace(/\.md$/, '');
    if (!shouldInstallSkill(baseName, mode)) continue;
    fs.copyFileSync(
      path.join(srcDir, entry.name),
      path.join(stageDir, entry.name),
    );
  }
  return stageDir;
}

module.exports = {
  MINIMAL_SKILL_ALLOWLIST,
  isMinimalMode,
  shouldInstallSkill,
  stageSkillsForMode,
};
