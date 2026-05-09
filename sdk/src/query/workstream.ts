/**
 * Workstream query handlers — list, get, create, set, status, complete, progress.
 *
 * Ported from get-shit-done/bin/lib/workstream.cjs.
 * Manages .planning/workstreams/ directory for multi-workstream projects.
 *
 * @example
 * ```typescript
 * import { workstreamList, workstreamCreate } from './workstream.js';
 *
 * await workstreamList([], '/project');
 * // { data: { workstreams: ['backend', 'frontend'], count: 2 } }
 *
 * await workstreamCreate(['api'], '/project');
 * // { data: { created: true, name: 'api', path: '.planning/workstreams/api' } }
 * ```
 */

import {
  existsSync, readdirSync, readFileSync, writeFileSync,
  mkdirSync, renameSync, rmdirSync, unlinkSync,
} from 'node:fs';
import { join, relative } from 'node:path';

import { toPosixPath } from './helpers.js';
import { GSDError, ErrorClassification } from '../errors.js';
import { validateWorkstreamName, toWorkstreamSlug } from '../workstream-name-policy.js';
import { readActiveWorkstream, writeActiveWorkstream } from './active-workstream-store.js';
import {
  inspectWorkstream,
  listWorkstreamInventories,
  planningRoot,
  workstreamsRoot,
} from './workstream-inventory.js';
import type { QueryHandler } from './utils.js';

// ─── Internal helpers ─────────────────────────────────────────────────────

// ─── Handlers ─────────────────────────────────────────────────────────────

/**
 * Current active workstream and mode (flat vs workstream).
 *
 * Port of `cmdWorkstreamGet` from `workstream.cjs` lines 367–371.
 */
export const workstreamGet: QueryHandler = async (_args, projectDir) => {
  const active = readActiveWorkstream(projectDir);
  const wsRoot = workstreamsRoot(projectDir);
  return {
    data: {
      active,
      mode: existsSync(wsRoot) ? 'workstream' : 'flat',
    },
  };
};

export const workstreamList: QueryHandler = async (_args, projectDir) => {
  const inventory = listWorkstreamInventories(projectDir);
  if (inventory.mode === 'flat') {
    return { data: { mode: 'flat', workstreams: [], message: inventory.message } };
  }
  return {
    data: {
      mode: 'workstream',
      workstreams: inventory.workstreams.map(ws => ({
        name: ws.name,
        path: ws.path,
        has_roadmap: ws.files.roadmap,
        has_state: ws.files.state,
        status: ws.status,
        current_phase: ws.current_phase,
        phase_count: ws.phase_count,
        completed_phases: ws.completed_phases,
      })),
      count: inventory.count,
    },
  };
};

export const workstreamCreate: QueryHandler = async (args, projectDir) => {
  const rawName = args[0];
  if (!rawName) return { data: { created: false, reason: 'name required' } };
  if (rawName.includes('/') || rawName.includes('\\') || rawName.includes('..')) {
    return { data: { created: false, reason: 'invalid workstream name — path separators not allowed' } };
  }

  const slug = toWorkstreamSlug(rawName);
  if (!slug) return { data: { created: false, reason: 'invalid workstream name — must contain at least one alphanumeric character' } };

  const baseDir = planningRoot(projectDir);
  if (!existsSync(baseDir)) {
    return { data: { created: false, reason: '.planning/ directory not found — run /gsd-new-project first' } };
  }

  const wsRoot = workstreamsRoot(projectDir);
  const wsDir = join(wsRoot, slug);

  if (existsSync(wsDir) && existsSync(join(wsDir, 'STATE.md'))) {
    return { data: { created: false, error: 'already_exists', workstream: slug, path: toPosixPath(relative(projectDir, wsDir)) } };
  }

  mkdirSync(wsDir, { recursive: true });
  mkdirSync(join(wsDir, 'phases'), { recursive: true });

  const today = new Date().toISOString().split('T')[0];
  const stateContent = [
    '---',
    `workstream: ${slug}`,
    `created: ${today}`,
    '---',
    '',
    '# Project State',
    '',
    '## Current Position',
    '**Status:** Not started',
    '**Current Phase:** None',
    `**Last Activity:** ${today}`,
    '**Last Activity Description:** Workstream created',
    '',
    '## Progress',
    '**Phases Complete:** 0',
    '**Current Plan:** N/A',
    '',
    '## Session Continuity',
    '**Stopped At:** N/A',
    '**Resume File:** None',
    '',
  ].join('\n');

  const statePath = join(wsDir, 'STATE.md');
  if (!existsSync(statePath)) {
    writeFileSync(statePath, stateContent, 'utf-8');
  }

  writeActiveWorkstream(projectDir, slug);

  const relPath = toPosixPath(relative(projectDir, wsDir));
  return {
    data: {
      created: true,
      workstream: slug,
      path: relPath,
      state_path: relPath + '/STATE.md',
      phases_path: relPath + '/phases',
      active: true,
    },
  };
};

/**
 * Rewrite the root `.planning/STATE.md` to mirror the active workstream's STATE.md.
 *
 * Fixes #2618 gap 2 — downstream consumers (statusline, progress, any tool that
 * reads the root mirror) must see the new workstream's state immediately after a
 * switch. The workstream STATE.md is authoritative; the root file is a
 * pass-through copy. We write content verbatim (atomic write via writeFileSync)
 * so frontmatter fields and body stay in lockstep with the source.
 */
function syncRootStateMirror(projectDir: string, name: string): void {
  const wsStatePath = join(workstreamsRoot(projectDir), name, 'STATE.md');
  const rootStatePath = join(planningRoot(projectDir), 'STATE.md');
  if (!existsSync(wsStatePath)) return;
  try {
    const content = readFileSync(wsStatePath, 'utf-8');
    writeFileSync(rootStatePath, content, 'utf-8');
  } catch { /* best-effort mirror; do not fail the switch */ }
}

export const workstreamSet: QueryHandler = async (args, projectDir) => {
  const name = args[0];

  if (!name || name === '--clear') {
    if (name !== '--clear') {
      return { data: { set: false, reason: 'name required. Usage: workstream set <name> (or workstream set --clear to unset)' } };
    }
    const previous = readActiveWorkstream(projectDir);
    writeActiveWorkstream(projectDir, null);
    return { data: { active: null, cleared: true, previous: previous || null } };
  }

  if (!validateWorkstreamName(name)) {
    return { data: { active: null, error: 'invalid_name', message: 'Workstream name must be alphanumeric, hyphens, underscores, or dots only' } };
  }

  const wsDir = join(workstreamsRoot(projectDir), name);
  if (!existsSync(wsDir)) {
    return { data: { active: null, error: 'not_found', workstream: name } };
  }

  writeActiveWorkstream(projectDir, name);
  syncRootStateMirror(projectDir, name);
  return { data: { active: name, set: true, mirror_synced: existsSync(join(wsDir, 'STATE.md')) } };
};

export const workstreamStatus: QueryHandler = async (args, projectDir) => {
  const name = args[0];
  if (!name) {
    throw new GSDError('workstream name required. Usage: workstream status <name>', ErrorClassification.Validation);
  }
  if (/[/\\]/.test(name) || name === '.' || name === '..') {
    throw new GSDError('Invalid workstream name', ErrorClassification.Validation);
  }

  const wsDir = join(workstreamsRoot(projectDir), name);
  if (!existsSync(wsDir)) {
    return { data: { found: false, workstream: name } };
  }

  const inventory = inspectWorkstream(projectDir, name);
  if (!inventory) return { data: { found: false, workstream: name } };

  return {
    data: {
      found: true,
      workstream: name,
      path: inventory.path,
      files: inventory.files,
      phases: inventory.phases,
      phase_count: inventory.phase_count,
      completed_phases: inventory.completed_phases,
      status: inventory.status,
      current_phase: inventory.current_phase,
      last_activity: inventory.last_activity,
    },
  };
};

export const workstreamComplete: QueryHandler = async (args, projectDir) => {
  const name = args[0];
  if (!name) return { data: { completed: false, reason: 'workstream name required' } };
  if (/[/\\]/.test(name) || name === '.' || name === '..') {
    return { data: { completed: false, reason: 'invalid workstream name' } };
  }

  const root = planningRoot(projectDir);
  const wsRoot = workstreamsRoot(projectDir);
  const wsDir = join(wsRoot, name);

  if (!existsSync(wsDir)) {
    return { data: { completed: false, error: 'not_found', workstream: name } };
  }

  const active = readActiveWorkstream(projectDir);
  if (active === name) writeActiveWorkstream(projectDir, null);

  const archiveDir = join(root, 'milestones');
  const today = new Date().toISOString().split('T')[0];
  let archivePath = join(archiveDir, `ws-${name}-${today}`);
  let suffix = 1;
  while (existsSync(archivePath)) {
    archivePath = join(archiveDir, `ws-${name}-${today}-${suffix++}`);
  }

  mkdirSync(archivePath, { recursive: true });

  const filesMoved: string[] = [];
  try {
    const entries = readdirSync(wsDir, { withFileTypes: true });
    for (const entry of entries) {
      renameSync(join(wsDir, entry.name), join(archivePath, entry.name));
      filesMoved.push(entry.name);
    }
  } catch (err) {
    for (const fname of filesMoved) {
      try { renameSync(join(archivePath, fname), join(wsDir, fname)); } catch { /* rollback */ }
    }
    try { rmdirSync(archivePath); } catch { /* cleanup */ }
    if (active === name) writeActiveWorkstream(projectDir, name);
    return { data: { completed: false, error: 'archive_failed', message: String(err), workstream: name } };
  }

  try { rmdirSync(wsDir); } catch { /* may not be empty */ }

  let remainingWs = 0;
  try {
    remainingWs = readdirSync(wsRoot, { withFileTypes: true })
      .filter(e => e.isDirectory()).length;
    if (remainingWs === 0) rmdirSync(wsRoot);
  } catch { /* best-effort */ }

  return {
    data: {
      completed: true,
      workstream: name,
      archived_to: toPosixPath(relative(projectDir, archivePath)),
      remaining_workstreams: remainingWs,
      reverted_to_flat: remainingWs === 0,
    },
  };
};

/**
 * Port of `cmdWorkstreamProgress` from `workstream.cjs` — aggregate status for each workstream.
 * (Not the same as roadmap `progress` / `progressBar`.)
 */
export const workstreamProgress: QueryHandler = async (_args, projectDir) => {
  const inventory = listWorkstreamInventories(projectDir);
  if (inventory.mode === 'flat') {
    return {
      data: {
        mode: 'flat',
        workstreams: [],
        message: inventory.message,
      },
    };
  }

  return {
    data: {
      mode: 'workstream',
      active: inventory.active,
      workstreams: inventory.workstreams.map(ws => ({
        name: ws.name,
        active: ws.active,
        status: ws.status,
        current_phase: ws.current_phase,
        phases: `${ws.completed_phases}/${ws.roadmap_phase_count}`,
        plans: `${ws.completed_plans}/${ws.total_plans}`,
        progress_percent: ws.progress_percent,
      })),
      count: inventory.count,
    },
  };
};
