/**
 * Workstream — CRUD operations for workstream namespacing
 *
 * Workstreams enable parallel milestones by scoping ROADMAP.md, STATE.md,
 * REQUIREMENTS.md, and phases/ into .planning/workstreams/{name}/ directories.
 *
 * When no workstreams/ directory exists, GSD operates in "flat mode" with
 * everything at .planning/ — backward compatible with pre-workstream installs.
 */

const fs = require('fs');
const path = require('path');
const { output, error, toPosixPath, getMilestoneInfo, generateSlugInternal } = require('./core.cjs');
const { platformWriteSync, platformEnsureDir } = require('./shell-command-projection.cjs');
const { planningRoot, setActiveWorkstream, getActiveWorkstream } = require('./planning-workspace.cjs');
const { toWorkstreamSlug, hasInvalidPathSegment, isValidActiveWorkstreamName } = require('./workstream-name-policy.cjs');
const {
  getOtherActiveWorkstreamInventories,
  inspectWorkstream,
  listWorkstreamInventories,
} = require('./workstream-inventory.cjs');

// ─── Migration ──────────────────────────────────────────────────────────────

/**
 * Migrate flat .planning/ layout to workstream mode.
 * Moves per-workstream files (ROADMAP.md, STATE.md, REQUIREMENTS.md, phases/)
 * into .planning/workstreams/{name}/. Shared files (PROJECT.md, config.json,
 * milestones/, research/, codebase/, todos/) stay in place.
 */
function migrateToWorkstreams(cwd, workstreamName) {
  if (!workstreamName || hasInvalidPathSegment(workstreamName)) {
    throw new Error('Invalid workstream name for migration');
  }

  const baseDir = planningRoot(cwd);
  const wsDir = path.join(baseDir, 'workstreams', workstreamName);

  if (fs.existsSync(path.join(baseDir, 'workstreams'))) {
    throw new Error('Already in workstream mode — .planning/workstreams/ exists');
  }

  const toMove = [
    { name: 'ROADMAP.md', type: 'file' },
    { name: 'STATE.md', type: 'file' },
    { name: 'REQUIREMENTS.md', type: 'file' },
    { name: 'phases', type: 'dir' },
  ];

  platformEnsureDir(wsDir);

  const filesMoved = [];
  try {
    for (const item of toMove) {
      const src = path.join(baseDir, item.name);
      if (fs.existsSync(src)) {
        const dest = path.join(wsDir, item.name);
        fs.renameSync(src, dest);
        filesMoved.push(item.name);
      }
    }
  } catch (err) {
    for (const name of filesMoved) {
      try { fs.renameSync(path.join(wsDir, name), path.join(baseDir, name)); } catch {}
    }
    try { fs.rmSync(wsDir, { recursive: true }); } catch {}
    try { fs.rmdirSync(path.join(baseDir, 'workstreams')); } catch {}
    throw err;
  }

  return { migrated: true, workstream: workstreamName, files_moved: filesMoved };
}

// ─── CRUD Commands ──────────────────────────────────────────────────────────

function cmdWorkstreamCreate(cwd, name, options, raw) {
  if (!name) {
    error('workstream name required. Usage: workstream create <name>');
  }

  const slug = toWorkstreamSlug(name);
  if (!slug) {
    error('Invalid workstream name — must contain at least one alphanumeric character');
  }

  const baseDir = planningRoot(cwd);
  if (!fs.existsSync(baseDir)) {
    error('.planning/ directory not found — run /gsd:new-project first');
  }

  const wsRoot = path.join(baseDir, 'workstreams');
  const wsDir = path.join(wsRoot, slug);

  if (fs.existsSync(wsDir) && fs.existsSync(path.join(wsDir, 'STATE.md'))) {
    output({ created: false, error: 'already_exists', workstream: slug, path: toPosixPath(path.relative(cwd, wsDir)) }, raw);
    return;
  }

  const isFlatMode = !fs.existsSync(wsRoot);
  let migration = null;
  if (isFlatMode && options.migrate !== false) {
    const hasExistingWork = fs.existsSync(path.join(baseDir, 'ROADMAP.md')) ||
                            fs.existsSync(path.join(baseDir, 'STATE.md')) ||
                            fs.existsSync(path.join(baseDir, 'phases'));

    if (hasExistingWork) {
      const migrateName = options.migrateName || null;
      let existingWsName;
      if (migrateName) {
        existingWsName = toWorkstreamSlug(migrateName);
        if (!existingWsName) {
          output({
            created: false,
            error: 'migration_failed',
            message: 'Invalid migrate-name — must contain at least one alphanumeric character',
          }, raw);
          return;
        }
      } else {
        try {
          const milestone = getMilestoneInfo(cwd);
          existingWsName = generateSlugInternal(milestone.name) || 'default';
        } catch {
          existingWsName = 'default';
        }
      }

      try {
        migration = migrateToWorkstreams(cwd, existingWsName);
      } catch (e) {
        output({ created: false, error: 'migration_failed', message: e.message }, raw);
        return;
      }
    } else {
      platformEnsureDir(wsRoot);
    }
  }

  platformEnsureDir(wsDir);
  platformEnsureDir(path.join(wsDir, 'phases'));

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

  const statePath = path.join(wsDir, 'STATE.md');
  if (!fs.existsSync(statePath)) {
    platformWriteSync(statePath, stateContent);
  }

  setActiveWorkstream(cwd, slug);

  const relPath = toPosixPath(path.relative(cwd, wsDir));
  output({
    created: true,
    workstream: slug,
    path: relPath,
    state_path: relPath + '/STATE.md',
    phases_path: relPath + '/phases',
    migration: migration || null,
    active: true,
  }, raw);
}

function cmdWorkstreamList(cwd, raw) {
  const inventory = listWorkstreamInventories(cwd);
  if (inventory.mode === 'flat') {
    output({ mode: 'flat', workstreams: [], message: inventory.message }, raw);
    return;
  }

  const workstreams = inventory.workstreams.map(ws => ({
    name: ws.name,
    path: ws.path,
    has_roadmap: ws.files.roadmap,
    has_state: ws.files.state,
    status: ws.status,
    current_phase: ws.current_phase,
    phase_count: ws.phase_count,
    completed_phases: ws.completed_phases,
  }));

  output({ mode: 'workstream', workstreams, count: workstreams.length }, raw);
}

function cmdWorkstreamStatus(cwd, name, raw) {
  if (!name) error('workstream name required. Usage: workstream status <name>');
  if (hasInvalidPathSegment(name)) error('Invalid workstream name');

  const wsDir = path.join(planningRoot(cwd), 'workstreams', name);
  if (!fs.existsSync(wsDir)) {
    output({ found: false, workstream: name }, raw);
    return;
  }

  const inventory = inspectWorkstream(cwd, name);

  output({
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
  }, raw);
}

function cmdWorkstreamComplete(cwd, name, options, raw) {
  if (!name) error('workstream name required. Usage: workstream complete <name>');
  if (hasInvalidPathSegment(name)) error('Invalid workstream name');

  const root = planningRoot(cwd);
  const wsRoot = path.join(root, 'workstreams');
  const wsDir = path.join(wsRoot, name);

  if (!fs.existsSync(wsDir)) {
    output({ completed: false, error: 'not_found', workstream: name }, raw);
    return;
  }

  const active = getActiveWorkstream(cwd);
  if (active === name) setActiveWorkstream(cwd, null);

  const archiveDir = path.join(root, 'milestones');
  const today = new Date().toISOString().split('T')[0];
  let archivePath = path.join(archiveDir, `ws-${name}-${today}`);
  let suffix = 1;
  while (fs.existsSync(archivePath)) {
    archivePath = path.join(archiveDir, `ws-${name}-${today}-${suffix++}`);
  }

  platformEnsureDir(archivePath);

  const filesMoved = [];
  try {
    const entries = fs.readdirSync(wsDir, { withFileTypes: true });
    for (const entry of entries) {
      fs.renameSync(path.join(wsDir, entry.name), path.join(archivePath, entry.name));
      filesMoved.push(entry.name);
    }
  } catch (err) {
    for (const fname of filesMoved) {
      try { fs.renameSync(path.join(archivePath, fname), path.join(wsDir, fname)); } catch {}
    }
    try { fs.rmSync(archivePath, { recursive: true }); } catch {}
    if (active === name) setActiveWorkstream(cwd, name);
    output({ completed: false, error: 'archive_failed', message: err.message, workstream: name }, raw);
    return;
  }

  try { fs.rmdirSync(wsDir); } catch {}

  let remainingWs = 0;
  try {
    remainingWs = fs.readdirSync(wsRoot, { withFileTypes: true }).filter(e => e.isDirectory()).length;
    if (remainingWs === 0) fs.rmdirSync(wsRoot);
  } catch {}

  output({
    completed: true,
    workstream: name,
    archived_to: toPosixPath(path.relative(cwd, archivePath)),
    remaining_workstreams: remainingWs,
    reverted_to_flat: remainingWs === 0,
  }, raw);
}

// ─── Active Workstream Commands ──────────────────────────────────────────────

function cmdWorkstreamSet(cwd, name, raw) {
  if (!name || name === '--clear') {
    if (name !== '--clear') {
      error('Workstream name required. Usage: workstream set <name> (or workstream set --clear to unset)');
    }
    const previous = getActiveWorkstream(cwd);
    setActiveWorkstream(cwd, null);
    output({ active: null, cleared: true, previous: previous || null }, raw);
    return;
  }

  if (!isValidActiveWorkstreamName(name)) {
    output({ active: null, error: 'invalid_name', message: 'Workstream name must be alphanumeric, hyphens, underscores, or dots' }, raw);
    return;
  }

  const wsDir = path.join(planningRoot(cwd), 'workstreams', name);
  if (!fs.existsSync(wsDir)) {
    output({ active: null, error: 'not_found', workstream: name }, raw);
    return;
  }

  setActiveWorkstream(cwd, name);
  output({ active: name, set: true }, raw, name);
}

function cmdWorkstreamGet(cwd, raw) {
  const active = getActiveWorkstream(cwd);
  const wsRoot = path.join(planningRoot(cwd), 'workstreams');
  output({ active, mode: fs.existsSync(wsRoot) ? 'workstream' : 'flat' }, raw, active || 'none');
}

function cmdWorkstreamProgress(cwd, raw) {
  const inventory = listWorkstreamInventories(cwd);
  if (inventory.mode === 'flat') {
    output({ mode: 'flat', workstreams: [], message: inventory.message }, raw);
    return;
  }

  const workstreams = inventory.workstreams.map(ws => ({
    name: ws.name,
    active: ws.active,
    status: ws.status,
    current_phase: ws.current_phase,
    phases: `${ws.completed_phases}/${ws.roadmap_phase_count}`,
    plans: `${ws.completed_plans}/${ws.total_plans}`,
    progress_percent: ws.progress_percent,
  }));

  output({ mode: 'workstream', active: inventory.active, workstreams, count: workstreams.length }, raw);
}

// ─── Collision Detection ────────────────────────────────────────────────────

/**
 * Return other workstreams that are NOT complete.
 * Used to detect whether the milestone has active parallel work
 * when a workstream finishes its last phase.
 */
function getOtherActiveWorkstreams(cwd, excludeWs) {
  return getOtherActiveWorkstreamInventories(cwd, excludeWs).map(ws => ({
    name: ws.name,
    status: ws.status,
    current_phase: ws.current_phase,
    phases: `${ws.completed_phases}/${ws.phase_count}`,
  }));
}

module.exports = {
  migrateToWorkstreams,
  cmdWorkstreamCreate,
  cmdWorkstreamList,
  cmdWorkstreamStatus,
  cmdWorkstreamComplete,
  cmdWorkstreamSet,
  cmdWorkstreamGet,
  cmdWorkstreamProgress,
  getOtherActiveWorkstreams,
};
