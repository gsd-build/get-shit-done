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

import { toPosixPath, stateExtractField } from './helpers.js';
import { GSDError, ErrorClassification } from '../errors.js';
import type { QueryHandler } from './utils.js';

// ─── Internal helpers ─────────────────────────────────────────────────────

const planningRoot = (projectDir: string) =>
  join(projectDir, '.planning');

const workstreamsDir = (projectDir: string) =>
  join(planningRoot(projectDir), 'workstreams');

function wsPlanningPaths(projectDir: string, name: string) {
  const base = join(planningRoot(projectDir), 'workstreams', name);
  return {
    planning: base,
    state: join(base, 'STATE.md'),
    roadmap: join(base, 'ROADMAP.md'),
    phases: join(base, 'phases'),
    requirements: join(base, 'REQUIREMENTS.md'),
  };
}

function readSubdirectories(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
}

function filterPlanFiles(files: string[]): string[] {
  return files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
}

function filterSummaryFiles(files: string[]): string[] {
  return files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
}

function getActiveWorkstream(projectDir: string): string | null {
  const filePath = join(planningRoot(projectDir), 'active-workstream');
  try {
    const name = readFileSync(filePath, 'utf-8').trim();
    if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      try { unlinkSync(filePath); } catch { /* already gone */ }
      return null;
    }
    const wsDir = join(workstreamsDir(projectDir), name);
    if (!existsSync(wsDir)) {
      try { unlinkSync(filePath); } catch { /* already gone */ }
      return null;
    }
    return name;
  } catch {
    return null;
  }
}

function setActiveWorkstream(projectDir: string, name: string | null): void {
  const filePath = join(planningRoot(projectDir), 'active-workstream');
  if (!name) {
    try { unlinkSync(filePath); } catch { /* already gone */ }
    return;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Invalid workstream name: must be alphanumeric, hyphens, and underscores only');
  }
  writeFileSync(filePath, name + '\n', 'utf-8');
}

// ─── Handlers ─────────────────────────────────────────────────────────────

/**
 * Current active workstream and mode (flat vs workstream).
 *
 * Port of `cmdWorkstreamGet` from `workstream.cjs` lines 367–371.
 */
export const workstreamGet: QueryHandler = async (_args, projectDir) => {
  const active = getActiveWorkstream(projectDir);
  const wsRoot = workstreamsDir(projectDir);
  return {
    data: {
      active,
      mode: existsSync(wsRoot) ? 'workstream' : 'flat',
    },
  };
};

export const workstreamList: QueryHandler = async (_args, projectDir) => {
  const dir = workstreamsDir(projectDir);
  if (!existsSync(dir)) return { data: { mode: 'flat', workstreams: [], message: 'No workstreams — operating in flat mode' } };
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    const workstreams = entries.filter(e => e.isDirectory()).map(e => e.name);
    return { data: { mode: 'workstream', workstreams, count: workstreams.length } };
  } catch {
    return { data: { mode: 'flat', workstreams: [], count: 0 } };
  }
};

export const workstreamCreate: QueryHandler = async (args, projectDir) => {
  const rawName = args[0];
  if (!rawName) return { data: { created: false, reason: 'name required' } };
  if (rawName.includes('/') || rawName.includes('\\') || rawName.includes('..')) {
    return { data: { created: false, reason: 'invalid workstream name — path separators not allowed' } };
  }

  const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) return { data: { created: false, reason: 'invalid workstream name — must contain at least one alphanumeric character' } };

  const baseDir = planningRoot(projectDir);
  if (!existsSync(baseDir)) {
    return { data: { created: false, reason: '.planning/ directory not found — run /gsd-new-project first' } };
  }

  const wsRoot = workstreamsDir(projectDir);
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

  setActiveWorkstream(projectDir, slug);

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

export const workstreamSet: QueryHandler = async (args, projectDir) => {
  const name = args[0];

  if (!name || name === '--clear') {
    if (name !== '--clear') {
      return { data: { set: false, reason: 'name required. Usage: workstream set <name> (or workstream set --clear to unset)' } };
    }
    const previous = getActiveWorkstream(projectDir);
    setActiveWorkstream(projectDir, null);
    return { data: { active: null, cleared: true, previous: previous || null } };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return { data: { active: null, error: 'invalid_name', message: 'Workstream name must be alphanumeric, hyphens, and underscores only' } };
  }

  const wsDir = join(workstreamsDir(projectDir), name);
  if (!existsSync(wsDir)) {
    return { data: { active: null, error: 'not_found', workstream: name } };
  }

  setActiveWorkstream(projectDir, name);
  return { data: { active: name, set: true } };
};

export const workstreamStatus: QueryHandler = async (args, projectDir) => {
  const name = args[0];
  if (!name) {
    throw new GSDError('workstream name required. Usage: workstream status <name>', ErrorClassification.Validation);
  }
  if (/[/\\]/.test(name) || name === '.' || name === '..') {
    throw new GSDError('Invalid workstream name', ErrorClassification.Validation);
  }

  const wsDir = join(workstreamsDir(projectDir), name);
  if (!existsSync(wsDir)) {
    return { data: { found: false, workstream: name } };
  }

  const p = wsPlanningPaths(projectDir, name);
  const relPath = toPosixPath(relative(projectDir, wsDir));

  const files = {
    roadmap: existsSync(p.roadmap),
    state: existsSync(p.state),
    requirements: existsSync(p.requirements),
  };

  const phases: Array<{ directory: string; status: string; plan_count: number; summary_count: number }> = [];
  for (const dir of readSubdirectories(p.phases).sort()) {
    try {
      const phaseFiles = readdirSync(join(p.phases, dir));
      const plans = filterPlanFiles(phaseFiles);
      const summaries = filterSummaryFiles(phaseFiles);
      phases.push({
        directory: dir,
        status:
          summaries.length >= plans.length && plans.length > 0
            ? 'complete'
            : plans.length > 0
              ? 'in_progress'
              : 'pending',
        plan_count: plans.length,
        summary_count: summaries.length,
      });
    } catch { /* skip */ }
  }

  let stateInfo: Record<string, string | null> = {};
  try {
    const stateContent = readFileSync(p.state, 'utf-8');
    stateInfo = {
      status: stateExtractField(stateContent, 'Status') || 'unknown',
      current_phase: stateExtractField(stateContent, 'Current Phase'),
      last_activity: stateExtractField(stateContent, 'Last Activity'),
    };
  } catch { /* skip */ }

  return {
    data: {
      found: true,
      workstream: name,
      path: relPath,
      files,
      phases,
      phase_count: phases.length,
      completed_phases: phases.filter(ph => ph.status === 'complete').length,
      ...stateInfo,
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
  const wsRoot = workstreamsDir(projectDir);
  const wsDir = join(wsRoot, name);

  if (!existsSync(wsDir)) {
    return { data: { completed: false, error: 'not_found', workstream: name } };
  }

  const active = getActiveWorkstream(projectDir);
  if (active === name) setActiveWorkstream(projectDir, null);

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
    if (active === name) setActiveWorkstream(projectDir, name);
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
  const wsRoot = workstreamsDir(projectDir);

  if (!existsSync(wsRoot)) {
    return {
      data: {
        mode: 'flat',
        workstreams: [],
        message: 'No workstreams — operating in flat mode',
      },
    };
  }

  const active = getActiveWorkstream(projectDir);
  const entries = readdirSync(wsRoot, { withFileTypes: true });
  const workstreams: Array<{
    name: string;
    active: boolean;
    status: string;
    current_phase: string | null;
    phases: string;
    plans: string;
    progress_percent: number;
  }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const wsDir = join(wsRoot, entry.name);
    const phasesDir = join(wsDir, 'phases');

    const phaseDirsProgress = readSubdirectories(phasesDir);
    const phaseCount = phaseDirsProgress.length;
    let completedCount = 0;
    let totalPlans = 0;
    let completedPlans = 0;
    for (const d of phaseDirsProgress) {
      try {
        const phaseFiles = readdirSync(join(phasesDir, d));
        const plans = filterPlanFiles(phaseFiles);
        const summaries = filterSummaryFiles(phaseFiles);
        totalPlans += plans.length;
        completedPlans += Math.min(summaries.length, plans.length);
        if (plans.length > 0 && summaries.length >= plans.length) completedCount++;
      } catch { /* skip */ }
    }

    let roadmapPhaseCount = phaseCount;
    try {
      const roadmapContent = readFileSync(join(wsDir, 'ROADMAP.md'), 'utf-8');
      const phaseMatches = roadmapContent.match(/^###?\s+Phase\s+\d/gm);
      if (phaseMatches) roadmapPhaseCount = phaseMatches.length;
    } catch { /* no roadmap */ }

    let status = 'unknown';
    let currentPhase: string | null = null;
    try {
      const stateContent = readFileSync(join(wsDir, 'STATE.md'), 'utf-8');
      status = stateExtractField(stateContent, 'Status') || 'unknown';
      currentPhase = stateExtractField(stateContent, 'Current Phase');
    } catch { /* skip */ }

    workstreams.push({
      name: entry.name,
      active: entry.name === active,
      status,
      current_phase: currentPhase,
      phases: `${completedCount}/${roadmapPhaseCount}`,
      plans: `${completedPlans}/${totalPlans}`,
      progress_percent:
        roadmapPhaseCount > 0 ? Math.round((completedCount / roadmapPhaseCount) * 100) : 0,
    });
  }

  return {
    data: {
      mode: 'workstream',
      active,
      workstreams,
      count: workstreams.length,
    },
  };
};
