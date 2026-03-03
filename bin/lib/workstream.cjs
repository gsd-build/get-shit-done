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
const { output, error, buildPaths, toPosixPath, getMilestoneInfo, generateSlugInternal, setActiveWorkstream, getActiveWorkstream } = require('./core.cjs');

// ─── Migration ──────────────────────────────────────────────────────────────

/**
 * Migrate flat .planning/ layout to workstream mode.
 * Moves per-workstream files (ROADMAP.md, STATE.md, REQUIREMENTS.md, phases/)
 * into .planning/workstreams/{name}/. Shared files (PROJECT.md, config.json,
 * milestones/, research/, codebase/, todos/) stay in place.
 *
 * Returns { migrated: true, workstream, files_moved[] } or throws on error.
 */
function migrateToWorkstreams(cwd, workstreamName) {
  // Validate name to prevent path traversal
  if (!workstreamName || /[/\\]/.test(workstreamName) || workstreamName === '.' || workstreamName === '..') {
    throw new Error('Invalid workstream name for migration');
  }

  const baseDir = path.join(cwd, '.planning');
  const wsDir = path.join(baseDir, 'workstreams', workstreamName);

  if (fs.existsSync(path.join(baseDir, 'workstreams'))) {
    throw new Error('Already in workstream mode — .planning/workstreams/ exists');
  }

  // Scoped files/dirs to move
  const toMove = [
    { name: 'ROADMAP.md', type: 'file' },
    { name: 'STATE.md', type: 'file' },
    { name: 'REQUIREMENTS.md', type: 'file' },
    { name: 'phases', type: 'dir' },
  ];

  // Create workstream directory
  fs.mkdirSync(wsDir, { recursive: true });

  // Move files with rollback on failure
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
    // Rollback: move everything back
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

function cmdWorkstreamCreate(cwd, name, options, raw, paths) {
  if (!name) {
    error('workstream name required. Usage: workstream create <name>');
  }

  // Validate name: lowercase alphanumeric + hyphens
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) {
    error('Invalid workstream name — must contain at least one alphanumeric character');
  }

  const baseDir = path.join(cwd, '.planning');
  if (!fs.existsSync(baseDir)) {
    error('.planning/ directory not found — run /gsd:new-project first');
  }

  const wsRoot = path.join(baseDir, 'workstreams');
  const wsDir = path.join(wsRoot, slug);

  // Check if already exists (with STATE.md = fully created; dir-only = partial, allow retry)
  if (fs.existsSync(wsDir) && fs.existsSync(path.join(wsDir, 'STATE.md'))) {
    output({ created: false, error: 'already_exists', workstream: slug, path: toPosixPath(path.relative(cwd, wsDir)) }, raw);
    return;
  }

  // If flat mode and files exist, offer migration
  const isFlatMode = !fs.existsSync(wsRoot);
  let migration = null;
  if (isFlatMode && options.migrate !== false) {
    // Check if there are existing scoped files to migrate
    const hasExistingWork = fs.existsSync(path.join(baseDir, 'ROADMAP.md')) ||
                            fs.existsSync(path.join(baseDir, 'STATE.md')) ||
                            fs.existsSync(path.join(baseDir, 'phases'));

    if (hasExistingWork) {
      // Determine migration name from current milestone
      const migrateName = options.migrateName || null;
      let existingWsName;
      if (migrateName) {
        existingWsName = migrateName;
      } else {
        // Auto-detect from milestone info
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
      // No existing work — just create workstreams/ dir
      fs.mkdirSync(wsRoot, { recursive: true });
    }
  }

  // Create the new workstream directory structure
  fs.mkdirSync(wsDir, { recursive: true });
  fs.mkdirSync(path.join(wsDir, 'phases'), { recursive: true });

  // Scaffold a minimal STATE.md
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

  // Auto-set this workstream as active
  setActiveWorkstream(cwd, slug);

  const relPath = toPosixPath(path.relative(cwd, wsDir));
  const result = {
    created: true,
    workstream: slug,
    path: relPath,
    state_path: relPath + '/STATE.md',
    phases_path: relPath + '/phases',
    migration: migration || null,
    active: true,
  };

  output(result, raw, relPath);
}

function cmdWorkstreamList(cwd, raw) {
  const wsRoot = path.join(cwd, '.planning', 'workstreams');

  if (!fs.existsSync(wsRoot)) {
    output({
      mode: 'flat',
      workstreams: [],
      message: 'No workstreams — operating in flat mode',
    }, raw);
    return;
  }

  const entries = fs.readdirSync(wsRoot, { withFileTypes: true });
  const workstreams = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const wsDir = path.join(wsRoot, entry.name);
    const hasRoadmap = fs.existsSync(path.join(wsDir, 'ROADMAP.md'));
    const hasState = fs.existsSync(path.join(wsDir, 'STATE.md'));
    const phasesDir = path.join(wsDir, 'phases');

    let phaseCount = 0;
    let completedCount = 0;
    try {
      const phaseEntries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = phaseEntries.filter(e => e.isDirectory());
      phaseCount = dirs.length;

      for (const d of dirs) {
        const files = fs.readdirSync(path.join(phasesDir, d.name));
        const plans = files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
        const summaries = files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        if (plans.length > 0 && summaries.length >= plans.length) {
          completedCount++;
        }
      }
    } catch {}

    // Read status from STATE.md
    let status = 'unknown';
    let currentPhase = null;
    try {
      const stateContent = fs.readFileSync(path.join(wsDir, 'STATE.md'), 'utf-8');
      const statusMatch = stateContent.match(/\*\*Status:\*\*\s*(.+)/);
      if (statusMatch) status = statusMatch[1].trim();
      const phaseMatch = stateContent.match(/\*\*Current Phase:\*\*\s*(.+)/);
      if (phaseMatch) currentPhase = phaseMatch[1].trim();
    } catch {}

    workstreams.push({
      name: entry.name,
      path: toPosixPath(path.relative(cwd, wsDir)),
      has_roadmap: hasRoadmap,
      has_state: hasState,
      status,
      current_phase: currentPhase,
      phase_count: phaseCount,
      completed_phases: completedCount,
    });
  }

  output({
    mode: 'workstream',
    workstreams,
    count: workstreams.length,
  }, raw);
}

function cmdWorkstreamStatus(cwd, name, raw) {
  if (!name) {
    error('workstream name required. Usage: workstream status <name>');
  }
  if (/[/\\]/.test(name) || name === '.' || name === '..') {
    error('Invalid workstream name');
  }

  const wsDir = path.join(cwd, '.planning', 'workstreams', name);
  if (!fs.existsSync(wsDir)) {
    output({ found: false, workstream: name }, raw);
    return;
  }

  // Build paths for this specific workstream
  const p = buildPaths(cwd, name);
  const relPath = toPosixPath(path.relative(cwd, wsDir));

  // File inventory
  const files = {
    roadmap: fs.existsSync(p.roadmap),
    state: fs.existsSync(p.state),
    requirements: fs.existsSync(p.requirements),
  };

  // Phase analysis
  const phases = [];
  try {
    const entries = fs.readdirSync(p.phases, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

    for (const dir of dirs) {
      const phasePath = path.join(p.phases, dir);
      const phaseFiles = fs.readdirSync(phasePath);
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');

      const status = summaries.length >= plans.length && plans.length > 0 ? 'complete' :
                     plans.length > 0 ? 'in_progress' : 'pending';

      phases.push({
        directory: dir,
        status,
        plan_count: plans.length,
        summary_count: summaries.length,
      });
    }
  } catch {}

  // State info
  let stateInfo = {};
  try {
    const stateContent = fs.readFileSync(p.state, 'utf-8');
    const statusMatch = stateContent.match(/\*\*Status:\*\*\s*(.+)/);
    const phaseMatch = stateContent.match(/\*\*Current Phase:\*\*\s*(.+)/);
    const activityMatch = stateContent.match(/\*\*Last Activity:\*\*\s*(.+)/);
    stateInfo = {
      status: statusMatch ? statusMatch[1].trim() : 'unknown',
      current_phase: phaseMatch ? phaseMatch[1].trim() : null,
      last_activity: activityMatch ? activityMatch[1].trim() : null,
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
  if (!name) {
    error('workstream name required. Usage: workstream complete <name>');
  }

  // Validate name for path traversal
  if (/[/\\]/.test(name) || name === '.' || name === '..') {
    error('Invalid workstream name');
  }

  const wsRoot = path.join(cwd, '.planning', 'workstreams');
  const wsDir = path.join(wsRoot, name);

  if (!fs.existsSync(wsDir)) {
    output({ completed: false, error: 'not_found', workstream: name }, raw);
    return;
  }

  // Clear active-workstream if completing the active one
  const active = getActiveWorkstream(cwd);
  if (active === name) {
    setActiveWorkstream(cwd, null);
  }

  const archiveDir = path.join(cwd, '.planning', 'milestones');
  const today = new Date().toISOString().split('T')[0];

  // Avoid same-day archive collision
  const baseArchiveName = `ws-${name}-${today}`;
  let archivePath = path.join(archiveDir, baseArchiveName);
  let suffix = 1;
  while (fs.existsSync(archivePath)) {
    archivePath = path.join(archiveDir, `${baseArchiveName}-${suffix++}`);
  }

  // Archive: move the entire workstream dir to milestones/ (with rollback)
  fs.mkdirSync(archivePath, { recursive: true });

  const filesMoved = [];
  try {
    const entries = fs.readdirSync(wsDir, { withFileTypes: true });
    for (const entry of entries) {
      const src = path.join(wsDir, entry.name);
      const dest = path.join(archivePath, entry.name);
      fs.renameSync(src, dest);
      filesMoved.push(entry.name);
    }
  } catch (err) {
    // Rollback: move files back, restore active-workstream
    for (const fname of filesMoved) {
      try { fs.renameSync(path.join(archivePath, fname), path.join(wsDir, fname)); } catch {}
    }
    try { fs.rmSync(archivePath, { recursive: true }); } catch {}
    if (active === name) { setActiveWorkstream(cwd, name); }
    output({ completed: false, error: 'archive_failed', message: err.message, workstream: name }, raw);
    return;
  }

  // Remove the now-empty workstream directory
  try { fs.rmdirSync(wsDir); } catch {}

  // If no workstreams remain, remove the workstreams/ dir to revert to flat mode
  let remainingWs = 0;
  try {
    const remaining = fs.readdirSync(wsRoot, { withFileTypes: true });
    remainingWs = remaining.filter(e => e.isDirectory()).length;
    if (remainingWs === 0) {
      fs.rmdirSync(wsRoot);
    }
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
  if (!name) {
    // Clear active workstream
    setActiveWorkstream(cwd, null);
    output({ active: null, cleared: true }, raw);
    return;
  }

  const wsDir = path.join(cwd, '.planning', 'workstreams', name);
  if (!fs.existsSync(wsDir)) {
    output({ active: null, error: 'not_found', workstream: name }, raw);
    return;
  }

  setActiveWorkstream(cwd, name);
  output({ active: name, set: true }, raw, name);
}

function cmdWorkstreamGet(cwd, raw) {
  const active = getActiveWorkstream(cwd);

  // Also check if workstreams exist
  const wsRoot = path.join(cwd, '.planning', 'workstreams');
  const mode = fs.existsSync(wsRoot) ? 'workstream' : 'flat';

  output({ active, mode }, raw, active || 'none');
}

function cmdWorkstreamProgress(cwd, raw) {
  const wsRoot = path.join(cwd, '.planning', 'workstreams');

  if (!fs.existsSync(wsRoot)) {
    output({
      mode: 'flat',
      workstreams: [],
      message: 'No workstreams — operating in flat mode',
    }, raw);
    return;
  }

  const active = getActiveWorkstream(cwd);
  const entries = fs.readdirSync(wsRoot, { withFileTypes: true });
  const workstreams = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const wsDir = path.join(wsRoot, entry.name);
    const phasesDir = path.join(wsDir, 'phases');

    // Count phases and completion
    let phaseCount = 0;
    let completedCount = 0;
    let totalPlans = 0;
    let completedPlans = 0;

    try {
      const phaseEntries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = phaseEntries.filter(e => e.isDirectory());
      phaseCount = dirs.length;

      for (const d of dirs) {
        const files = fs.readdirSync(path.join(phasesDir, d.name));
        const plans = files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
        const summaries = files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        totalPlans += plans.length;
        completedPlans += Math.min(summaries.length, plans.length);
        if (plans.length > 0 && summaries.length >= plans.length) {
          completedCount++;
        }
      }
    } catch {}

    // Read roadmap for total phase count
    let roadmapPhaseCount = phaseCount;
    try {
      const roadmapContent = fs.readFileSync(path.join(wsDir, 'ROADMAP.md'), 'utf-8');
      const phaseMatches = roadmapContent.match(/^###?\s+Phase\s+\d/gm);
      if (phaseMatches) roadmapPhaseCount = phaseMatches.length;
    } catch {}

    // Read status from STATE.md
    let status = 'unknown';
    let currentPhase = null;
    try {
      const stateContent = fs.readFileSync(path.join(wsDir, 'STATE.md'), 'utf-8');
      const statusMatch = stateContent.match(/\*\*Status:\*\*\s*(.+)/);
      if (statusMatch) status = statusMatch[1].trim();
      const phaseMatch = stateContent.match(/\*\*Current Phase:\*\*\s*(.+)/);
      if (phaseMatch) currentPhase = phaseMatch[1].trim();
    } catch {}

    const progressPct = roadmapPhaseCount > 0
      ? Math.round((completedCount / roadmapPhaseCount) * 100)
      : 0;

    workstreams.push({
      name: entry.name,
      active: entry.name === active,
      status,
      current_phase: currentPhase,
      phases: `${completedCount}/${roadmapPhaseCount}`,
      plans: `${completedPlans}/${totalPlans}`,
      progress_percent: progressPct,
    });
  }

  output({
    mode: 'workstream',
    active,
    workstreams,
    count: workstreams.length,
  }, raw);
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
};
