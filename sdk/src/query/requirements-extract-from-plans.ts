/**
 * requirements.extract-from-plans — aggregate `requirements` frontmatter across all plans in a phase.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter } from './frontmatter.js';
import {
  normalizePhaseName,
  comparePhaseNum,
  phaseTokenMatches,
  planningPaths,
} from './helpers.js';
import type { QueryHandler } from './utils.js';

async function resolvePhaseDir(phase: string, projectDir: string, workstream?: string): Promise<string | null> {
  const phasesDir = planningPaths(projectDir, workstream).phases;
  const normalized = normalizePhaseName(phase);
  try {
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort((a, b) => comparePhaseNum(a, b));
    const match = dirs.find(d => phaseTokenMatches(d, normalized));
    return match ? join(phasesDir, match) : null;
  } catch {
    return null;
  }
}

function normalizeReqList(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === 'string') return [v];
  return [];
}

/**
 * Args: `<phase>`
 */
export const requirementsExtractFromPlans: QueryHandler = async (args, projectDir, workstream) => {
  const phase = args[0];
  if (!phase) {
    throw new GSDError('phase required', ErrorClassification.Validation);
  }

  const normalized = normalizePhaseName(phase);
  const phaseDir = await resolvePhaseDir(phase, projectDir, workstream);
  if (!phaseDir) {
    return {
      data: {
        phase: normalized,
        requirements: [] as string[],
        by_plan: {} as Record<string, string[]>,
        error: 'Phase not found',
      },
    };
  }

  const files = await readdir(phaseDir);
  const planFiles = files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();
  const byPlan: Record<string, string[]> = {};
  const seen = new Set<string>();

  for (const planFile of planFiles) {
    const planId =
      planFile === 'PLAN.md' ? 'PLAN' : planFile.replace(/-PLAN\.md$/i, '').replace(/PLAN\.md$/i, '');
    const content = await readFile(join(phaseDir, planFile), 'utf-8');
    const fm = extractFrontmatter(content) as Record<string, unknown>;
    const list = normalizeReqList(fm.requirements);
    byPlan[planId] = list;
    for (const r of list) {
      seen.add(r);
    }
  }

  return {
    data: {
      phase: normalized,
      requirements: [...seen].sort(),
      by_plan: byPlan,
    },
  };
};
