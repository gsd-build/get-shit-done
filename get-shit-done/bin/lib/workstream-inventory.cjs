'use strict';

/**
 * Workstream Inventory Module
 *
 * Owns discovery and read-only projection of .planning/workstreams/* state.
 * Command handlers should render outputs from this inventory instead of
 * rescanning workstream directories directly.
 *
 * Pure projection logic lives in workstream-inventory-builder.generated.cjs.
 * This module handles I/O orchestration only.
 */

const fs = require('fs');
const path = require('path');
const { toPosixPath, readSubdirectories } = require('./core.cjs');
const scanPhasePlans = require('./plan-scan.cjs');
const { planningPaths, planningRoot, getActiveWorkstream } = require('./planning-workspace.cjs');
const { stateExtractField } = require('./state-document.cjs');
const { buildWorkstreamInventory, isCompletedInventory } = require('./workstream-inventory-builder.generated.cjs');

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

  const activeWorkstreamName = options.active === undefined ? getActiveWorkstream(cwd) : options.active;
  const p = planningPaths(cwd, name);
  const phaseDirNames = readSubdirectories(p.phases);

  // Collect per-phase file counts
  const phaseFilesCounts = phaseDirNames.map(dir => {
    const counts = countPhaseFiles(path.join(p.phases, dir));
    return { directory: dir, planCount: counts.planCount, summaryCount: counts.summaryCount };
  });

  return buildWorkstreamInventory({
    name,
    projectDir: cwd,
    workstreamDir: wsDir,
    phaseDirNames,
    activeWorkstreamName,
    phaseFilesCounts,
    roadmapPhaseCount: countRoadmapPhases(p.roadmap, phaseDirNames.length),
    stateProjection: readStateProjection(p.state),
    filesExist: {
      roadmap: fs.existsSync(p.roadmap),
      state: fs.existsSync(p.state),
      requirements: fs.existsSync(p.requirements),
    },
  });
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

function getOtherActiveWorkstreamInventories(cwd, excludeWs) {
  return listWorkstreamInventories(cwd).workstreams
    .filter(inventory => inventory.name !== excludeWs)
    .filter(inventory => !isCompletedInventory(inventory.status));
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
