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
const { output, error, planningPaths, planningRoot, toPosixPath, getMilestoneInfo, generateSlugInternal, setActiveWorkstream, getActiveWorkstream, filterPlanFiles, filterSummaryFiles, readSubdirectories } = require('./core.cjs');
const { stateExtractField } = require('./state.cjs');

// ─── Migration ──────────────────────────────────────────────────────────────

/**
 * Migrate flat .planning/ layout to workstream mode.
 * Moves per-workstream files (ROADMAP.md, STATE.md, REQUIREMENTS.md, phases/)
 * into .planning/workstreams/{name}/. Shared files (PROJECT.md, config.json,
 * milestones/, research/, codebase/, todos/) stay in place.
 */
function migrateToWorkstreams(cwd, workstreamName) {
  if (!workstreamName || /[/\\]/.test(workstreamName) || workstreamName === '.' || workstreamName === '..') {
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

  fs.mkdirSync(wsDir, { recursive: true });

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

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) {
    error('Invalid workstream name — must contain at least one alphanumeric character');
  }

  const baseDir = planningRoot(cwd);
  if (!fs.existsSync(baseDir)) {
    error('.planning/ directory not found — run /gsd-new-project first');
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
        existingWsName = migrateName;
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
      fs.mkdirSync(wsRoot, { recursive: true });
    }
  }

  fs.mkdirSync(wsDir, { recursive: true });
  fs.mkdirSync(path.join(wsDir, 'phases'), { recursive: true });

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
    fs.writeFileSync(statePath, stateContent, 'utf-8');
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
  const wsRoot = path.join(planningRoot(cwd), 'workstreams');

  if (!fs.existsSync(wsRoot)) {
    output({ mode: 'flat', workstreams: [], message: 'No workstreams — operating in flat mode' }, raw);
    return;
  }

  const entries = fs.readdirSync(wsRoot, { withFileTypes: true });
  const workstreams = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const wsDir = path.join(wsRoot, entry.name);
    const phasesDir = path.join(wsDir, 'phases');

    const phaseDirs = readSubdirectories(phasesDir);
    const phaseCount = phaseDirs.length;
    let completedCount = 0;
    for (const d of phaseDirs) {
      try {
        const phaseFiles = fs.readdirSync(path.join(phasesDir, d));
        const plans = filterPlanFiles(phaseFiles);
        const summaries = filterSummaryFiles(phaseFiles);
        if (plans.length > 0 && summaries.length >= plans.length) completedCount++;
      } catch {}
    }

    let status = 'unknown', currentPhase = null;
    try {
      const stateContent = fs.readFileSync(path.join(wsDir, 'STATE.md'), 'utf-8');
      status = stateExtractField(stateContent, 'Status') || 'unknown';
      currentPhase = stateExtractField(stateContent, 'Current Phase');
    } catch {}

    workstreams.push({
      name: entry.name,
      path: toPosixPath(path.relative(cwd, wsDir)),
      has_roadmap: fs.existsSync(path.join(wsDir, 'ROADMAP.md')),
      has_state: fs.existsSync(path.join(wsDir, 'STATE.md')),
      status,
      current_phase: currentPhase,
      phase_count: phaseCount,
      completed_phases: completedCount,
    });
  }

  output({ mode: 'workstream', workstreams, count: workstreams.length }, raw);
}

function cmdWorkstreamStatus(cwd, name, raw) {
  if (!name) error('workstream name required. Usage: workstream status <name>');
  if (/[/\\]/.test(name) || name === '.' || name === '..') error('Invalid workstream name');

  const wsDir = path.join(planningRoot(cwd), 'workstreams', name);
  if (!fs.existsSync(wsDir)) {
    output({ found: false, workstream: name }, raw);
    return;
  }

  const p = planningPaths(cwd, name);
  const relPath = toPosixPath(path.relative(cwd, wsDir));

  const files = {
    roadmap: fs.existsSync(p.roadmap),
    state: fs.existsSync(p.state),
    requirements: fs.existsSync(p.requirements),
  };

  const phases = [];
  for (const dir of readSubdirectories(p.phases).sort()) {
    try {
      const phaseFiles = fs.readdirSync(path.join(p.phases, dir));
      const plans = filterPlanFiles(phaseFiles);
      const summaries = filterSummaryFiles(phaseFiles);
      phases.push({
        directory: dir,
        status: summaries.length >= plans.length && plans.length > 0 ? 'complete' :
                plans.length > 0 ? 'in_progress' : 'pending',
        plan_count: plans.length,
        summary_count: summaries.length,
      });
    } catch {}
  }

  let stateInfo = {};
  try {
    const stateContent = fs.readFileSync(p.state, 'utf-8');
    stateInfo = {
      status: stateExtractField(stateContent, 'Status') || 'unknown',
      current_phase: stateExtractField(stateContent, 'Current Phase'),
      last_activity: stateExtractField(stateContent, 'Last Activity'),
    };
  } catch {}

  output({
    found: true,
    workstream: name,
    path: relPath,
    files,
    phases,
    phase_count: phases.length,
    completed_phases: phases.filter(ph => ph.status === 'complete').length,
    ...stateInfo,
  }, raw);
}

function cmdWorkstreamComplete(cwd, name, options, raw) {
  if (!name) error('workstream name required. Usage: workstream complete <name>');
  if (/[/\\]/.test(name) || name === '.' || name === '..') error('Invalid workstream name');

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

  fs.mkdirSync(archivePath, { recursive: true });

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

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    output({ active: null, error: 'invalid_name', message: 'Workstream name must be alphanumeric, hyphens, and underscores only' }, raw);
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
  const root = planningRoot(cwd);
  const wsRoot = path.join(root, 'workstreams');

  if (!fs.existsSync(wsRoot)) {
    output({ mode: 'flat', workstreams: [], message: 'No workstreams — operating in flat mode' }, raw);
    return;
  }

  const active = getActiveWorkstream(cwd);
  const entries = fs.readdirSync(wsRoot, { withFileTypes: true });
  const workstreams = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const wsDir = path.join(wsRoot, entry.name);
    const phasesDir = path.join(wsDir, 'phases');

    const phaseDirsProgress = readSubdirectories(phasesDir);
    const phaseCount = phaseDirsProgress.length;
    let completedCount = 0, totalPlans = 0, completedPlans = 0;
    for (const d of phaseDirsProgress) {
      try {
        const phaseFiles = fs.readdirSync(path.join(phasesDir, d));
        const plans = filterPlanFiles(phaseFiles);
        const summaries = filterSummaryFiles(phaseFiles);
        totalPlans += plans.length;
        completedPlans += Math.min(summaries.length, plans.length);
        if (plans.length > 0 && summaries.length >= plans.length) completedCount++;
      } catch {}
    }

    let roadmapPhaseCount = phaseCount;
    try {
      const roadmapContent = fs.readFileSync(path.join(wsDir, 'ROADMAP.md'), 'utf-8');
      const phaseMatches = roadmapContent.match(/^###?\s+Phase\s+\d/gm);
      if (phaseMatches) roadmapPhaseCount = phaseMatches.length;
    } catch {}

    let status = 'unknown', currentPhase = null;
    try {
      const stateContent = fs.readFileSync(path.join(wsDir, 'STATE.md'), 'utf-8');
      status = stateExtractField(stateContent, 'Status') || 'unknown';
      currentPhase = stateExtractField(stateContent, 'Current Phase');
    } catch {}

    workstreams.push({
      name: entry.name,
      active: entry.name === active,
      status,
      current_phase: currentPhase,
      phases: `${completedCount}/${roadmapPhaseCount}`,
      plans: `${completedPlans}/${totalPlans}`,
      progress_percent: roadmapPhaseCount > 0 ? Math.round((completedCount / roadmapPhaseCount) * 100) : 0,
    });
  }

  output({ mode: 'workstream', active, workstreams, count: workstreams.length }, raw);
}

// ─── Collision Detection ────────────────────────────────────────────────────

/**
 * Return other workstreams that are NOT complete.
 * Used to detect whether the milestone has active parallel work
 * when a workstream finishes its last phase.
 */
function getOtherActiveWorkstreams(cwd, excludeWs) {
  const wsRoot = path.join(planningRoot(cwd), 'workstreams');
  if (!fs.existsSync(wsRoot)) return [];

  const entries = fs.readdirSync(wsRoot, { withFileTypes: true });
  const others = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === excludeWs) continue;

    const wsDir = path.join(wsRoot, entry.name);
    const statePath = path.join(wsDir, 'STATE.md');

    let status = 'unknown', currentPhase = null;
    try {
      const content = fs.readFileSync(statePath, 'utf-8');
      status = stateExtractField(content, 'Status') || 'unknown';
      currentPhase = stateExtractField(content, 'Current Phase');
    } catch {}

    if (status.toLowerCase().includes('milestone complete') ||
        status.toLowerCase().includes('archived')) {
      continue;
    }

    const phasesDir = path.join(wsDir, 'phases');
    const phaseDirsOther = readSubdirectories(phasesDir);
    const phaseCount = phaseDirsOther.length;
    let completedCount = 0;
    for (const d of phaseDirsOther) {
      try {
        const phaseFiles = fs.readdirSync(path.join(phasesDir, d));
        const plans = filterPlanFiles(phaseFiles);
        const summaries = filterSummaryFiles(phaseFiles);
        if (plans.length > 0 && summaries.length >= plans.length) completedCount++;
      } catch {}
    }

    others.push({ name: entry.name, status, current_phase: currentPhase, phases: `${completedCount}/${phaseCount}` });
  }

  return others;
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
