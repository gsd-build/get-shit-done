/**
 * Workstream Inventory Module.
 *
 * Owns discovery and read-only projection of .planning/workstreams/* state.
 * Query handlers should render outputs from this inventory instead of
 * rescanning workstream directories directly.
 *
 * Pure projection logic lives in ../workstream-inventory/builder.ts.
 * This module handles I/O orchestration only.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scanPhasePlans } from './plan-scan.js';
import { stateExtractField } from './state-document.js';
import { readActiveWorkstream } from './active-workstream-store.js';
import { buildWorkstreamInventory } from '../workstream-inventory/builder.js';

// Re-export types from the builder so downstream consumers can import from here.
export type {
  WorkstreamPhaseInventory,
  WorkstreamInventory,
  WorkstreamInventoryList,
} from '../workstream-inventory/builder.js';

import type { WorkstreamInventory, WorkstreamInventoryList } from '../workstream-inventory/builder.js';

export const planningRoot = (projectDir: string): string =>
  join(projectDir, '.planning');

export const workstreamsRoot = (projectDir: string): string =>
  join(planningRoot(projectDir), 'workstreams');

function wsPlanningPaths(projectDir: string, name: string) {
  const base = join(planningRoot(projectDir), 'workstreams', name);
  return {
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

export function countRoadmapPhases(roadmapPath: string, fallbackCount: number): number {
  try {
    const roadmapContent = readFileSync(roadmapPath, 'utf-8');
    const matches = roadmapContent.match(/^#{2,4}\s+Phase\s+[\w][\w.-]*/gm);
    return matches ? matches.length : fallbackCount;
  } catch {
    return fallbackCount;
  }
}

export function countPhaseFiles(phaseDir: string): { planCount: number; summaryCount: number } {
  const scan = scanPhasePlans(phaseDir);
  return { planCount: scan.planCount, summaryCount: scan.summaryCount };
}

function readStateProjection(statePath: string): { status: string; current_phase: string | null; last_activity: string | null } {
  try {
    const stateContent = readFileSync(statePath, 'utf-8');
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

export function inspectWorkstream(
  projectDir: string,
  name: string,
  options: { active?: string | null } = {},
): WorkstreamInventory | null {
  const wsDir = join(workstreamsRoot(projectDir), name);
  if (!existsSync(wsDir)) return null;

  const activeWorkstreamName = options.active === undefined ? readActiveWorkstream(projectDir) : options.active;
  const p = wsPlanningPaths(projectDir, name);
  const phaseDirNames = readSubdirectories(p.phases);

  // Collect per-phase file counts
  const phaseFilesCounts = phaseDirNames.map(dir => {
    const counts = countPhaseFiles(join(p.phases, dir));
    return { directory: dir, planCount: counts.planCount, summaryCount: counts.summaryCount };
  });

  return buildWorkstreamInventory({
    name,
    projectDir,
    workstreamDir: wsDir,
    phaseDirNames,
    activeWorkstreamName,
    phaseFilesCounts,
    roadmapPhaseCount: countRoadmapPhases(p.roadmap, phaseDirNames.length),
    stateProjection: readStateProjection(p.state),
    filesExist: {
      roadmap: existsSync(p.roadmap),
      state: existsSync(p.state),
      requirements: existsSync(p.requirements),
    },
  });
}

export function listWorkstreamInventories(projectDir: string): WorkstreamInventoryList {
  const wsRoot = workstreamsRoot(projectDir);
  if (!existsSync(wsRoot)) {
    return {
      mode: 'flat',
      active: null,
      workstreams: [],
      count: 0,
      message: 'No workstreams — operating in flat mode',
    };
  }

  const active = readActiveWorkstream(projectDir);
  const entries = readdirSync(wsRoot, { withFileTypes: true });
  const workstreams: WorkstreamInventory[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const inventory = inspectWorkstream(projectDir, entry.name, { active });
    if (inventory) workstreams.push(inventory);
  }

  return {
    mode: 'workstream',
    active,
    workstreams,
    count: workstreams.length,
  };
}
