/**
 * `state load` — full project config + STATE.md raw text (CJS `cmdStateLoad`).
 *
 * Uses the same `loadConfig(cwd)` as `get-shit-done/bin/lib/state.cjs` by resolving
 * `core.cjs` next to a shipped/bundled/user `get-shit-done` install (same probe order
 * as `resolveGsdToolsPath`). This keeps JSON output **byte-compatible** with
 * `node gsd-tools.cjs state load` for monorepo and standard installs.
 *
 * Distinct from {@link stateJson} (`state json` / `state.json`) which mirrors
 * `cmdStateJson` (rebuilt frontmatter only).
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { planningPaths } from './helpers.js';
import type { QueryHandler } from './utils.js';
import { loadLegacyCoreConfig } from '../sdk-package-compatibility.js';

/**
 * Query handler for `state load` / bare `state` (normalize → `state.load`).
 *
 * Port of `cmdStateLoad` from `get-shit-done/bin/lib/state.cjs` lines 44–86.
 */
export const stateProjectLoad: QueryHandler = async (_args, projectDir, workstream) => {
  const config = loadLegacyCoreConfig(projectDir);
  const planDir = planningPaths(projectDir, workstream).planning;

  let stateRaw = '';
  try {
    stateRaw = await readFile(join(planDir, 'STATE.md'), 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }

  const configExists = existsSync(join(planDir, 'config.json'));
  const roadmapExists = existsSync(join(planDir, 'ROADMAP.md'));
  const stateExists = stateRaw.length > 0;

  return {
    data: {
      config,
      state_raw: stateRaw,
      state_exists: stateExists,
      roadmap_exists: roadmapExists,
      config_exists: configExists,
    },
  };
};

/**
 * `--raw` stdout for `state load` (matches CJS `cmdStateLoad` lines 65–83).
 */
export function formatStateLoadRawStdout(data: unknown): string {
  const d = data as Record<string, unknown>;
  const c = d.config as Record<string, unknown> | undefined;
  if (!c) {
    return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  }
  const configExists = d.config_exists;
  const roadmapExists = d.roadmap_exists;
  const stateExists = d.state_exists;
  const lines = [
    `model_profile=${c.model_profile}`,
    `commit_docs=${c.commit_docs}`,
    `branching_strategy=${c.branching_strategy}`,
    `phase_branch_template=${c.phase_branch_template}`,
    `milestone_branch_template=${c.milestone_branch_template}`,
    `parallelization=${c.parallelization}`,
    `research=${c.research}`,
    `plan_checker=${c.plan_checker}`,
    `verifier=${c.verifier}`,
    `config_exists=${configExists}`,
    `roadmap_exists=${roadmapExists}`,
    `state_exists=${stateExists}`,
  ];
  return lines.join('\n');
}
