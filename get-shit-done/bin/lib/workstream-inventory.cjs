'use strict';

/**
 * Workstream Inventory Module
 *
 * Owns discovery and read-only projection of .planning/workstreams/* state.
 * Command handlers should render outputs from this inventory instead of
 * rescanning workstream directories directly.
 */

const fs = require('fs');
const path = require('path');
const { toPosixPath, readSubdirectories } = require('./core.cjs');
const scanPhasePlans = require('./plan-scan.cjs');
const { planningPaths, planningRoot, getActiveWorkstream } = require('./planning-workspace.cjs');
const { stateExtractField } = require('./state-document.cjs');

function workstreamsRoot(cwd) {
  return path.join(planningRoot(cwd), 'workstreams');
}

function countRoadmapPhases(roadmapPath, fallbackCount) {
  try {
    const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
    const matches = roadmapContent.match(/^#{2,4}\s+Phase\s+[\w][\w.-]*/gm);
    return matches ? matches.length : fallbackCount;
  } catch {
    return fallbackCount;
  }
}

function countPhaseFiles(phaseDir) {
  const scan = scanPhasePlans(phaseDir);
  return { planCount: scan.planCount, summaryCount: scan.summaryCount };
}

function readStateProjection(statePath) {
  try {
    const stateContent = fs.readFileSync(statePath, 'utf-8');
    return {
      status: stateExtractField(stateContent, 'Status') || 'unknown',
      current_phase: stateExtractField(stateContent, 'Current Phase'),
      last_activity: stateExtractField(stateContent, 'Last Activity'),
    };
  } catch {
    return {
      status: 'unknown',
      current_phase: null,
      last_activity: null,
    };
  }
}

function inspectWorkstream(cwd, name, options = {}) {
  const wsDir = path.join(workstreamsRoot(cwd), name);
  if (!fs.existsSync(wsDir)) return null;

  const active = options.active === undefined ? getActiveWorkstream(cwd) : options.active;
  const p = planningPaths(cwd, name);
  const phaseDirs = readSubdirectories(p.phases);
  const phases = [];
  let completedPhases = 0;
  let totalPlans = 0;
  let completedPlans = 0;

  for (const dir of phaseDirs.sort()) {
    const counts = countPhaseFiles(path.join(p.phases, dir));
    const status = counts.summaryCount >= counts.planCount && counts.planCount > 0
      ? 'complete'
      : counts.planCount > 0
        ? 'in_progress'
        : 'pending';

    totalPlans += counts.planCount;
    completedPlans += Math.min(counts.summaryCount, counts.planCount);
    if (status === 'complete') completedPhases++;

    phases.push({
      directory: dir,
      status,
      plan_count: counts.planCount,
      summary_count: counts.summaryCount,
    });
  }

  const roadmapPhaseCount = countRoadmapPhases(p.roadmap, phaseDirs.length);
  const state = readStateProjection(p.state);

  return {
    name,
    path: toPosixPath(path.relative(cwd, wsDir)),
    active: name === active,
    files: {
      roadmap: fs.existsSync(p.roadmap),
      state: fs.existsSync(p.state),
      requirements: fs.existsSync(p.requirements),
    },
    status: state.status,
    current_phase: state.current_phase,
    last_activity: state.last_activity,
    phases,
    phase_count: phases.length,
    completed_phases: completedPhases,
    roadmap_phase_count: roadmapPhaseCount,
    total_plans: totalPlans,
    completed_plans: completedPlans,
    progress_percent: roadmapPhaseCount > 0 ? Math.min(100, Math.round((completedPhases / roadmapPhaseCount) * 100)) : 0,
  };
}

function listWorkstreamInventories(cwd) {
  const wsRoot = workstreamsRoot(cwd);
  if (!fs.existsSync(wsRoot)) {
    return {
      mode: 'flat',
      active: null,
      workstreams: [],
      count: 0,
      message: 'No workstreams — operating in flat mode',
    };
  }

  const active = getActiveWorkstream(cwd);
  const entries = fs.readdirSync(wsRoot, { withFileTypes: true });
  const workstreams = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const inventory = inspectWorkstream(cwd, entry.name, { active });
    if (inventory) workstreams.push(inventory);
  }

  return {
    mode: 'workstream',
    active,
    workstreams,
    count: workstreams.length,
  };
}

function isCompletedInventory(inventory) {
  const status = String(inventory && inventory.status ? inventory.status : '').toLowerCase();
  return status.includes('milestone complete') || status.includes('archived');
}

function getOtherActiveWorkstreamInventories(cwd, excludeWs) {
  return listWorkstreamInventories(cwd).workstreams
    .filter(inventory => inventory.name !== excludeWs)
    .filter(inventory => !isCompletedInventory(inventory));
}

module.exports = {
  countPhaseFiles,
  countRoadmapPhases,
  getOtherActiveWorkstreamInventories,
  inspectWorkstream,
  isCompletedInventory,
  listWorkstreamInventories,
  workstreamsRoot,
};
