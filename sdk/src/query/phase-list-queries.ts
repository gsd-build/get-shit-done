/**
 * Handlers: phase.list-plans, phase.list-artifacts — deterministic plan/artifact listing
 * for agents (replaces shell `ls` / `find` patterns). SDK-only; no gsd-tools.cjs mirror.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter } from './frontmatter.js';
import {
  normalizePhaseName,
  comparePhaseNum,
  phaseTokenMatches,
  toPosixPath,
  planningPaths,
} from './helpers.js';
import type { QueryHandler } from './utils.js';

/** Resolve `.planning/phases/<dir>` for a phase token, or null. */
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

type ArtifactType = 'context' | 'summary' | 'verification' | 'research';

/**
 * phase.list-artifacts — list CONTEXT / SUMMARY / VERIFICATION / RESEARCH files in a phase directory.
 *
 * Args: `<phase>` `--type` `<context|summary|verification|research>`
 */
export const phaseListArtifacts: QueryHandler = async (args, projectDir, workstream) => {
  if (!args[0]) {
    throw new GSDError('phase required', ErrorClassification.Validation);
  }
  const typeIdx = args.indexOf('--type');
  if (typeIdx === -1 || !args[typeIdx + 1]) {
    throw new GSDError('--type context|summary|verification|research required', ErrorClassification.Validation);
  }
  const phase = args[0];
  const rawType = args[typeIdx + 1].toLowerCase();
  const allowed: ArtifactType[] = ['context', 'summary', 'verification', 'research'];
  if (!allowed.includes(rawType as ArtifactType)) {
    throw new GSDError(`invalid --type ${rawType}`, ErrorClassification.Validation);
  }
  const artifactType = rawType as ArtifactType;

  const phaseDir = await resolvePhaseDir(phase, projectDir, workstream);
  if (!phaseDir) {
    return { data: { phase: normalizePhaseName(phase), type: artifactType, artifacts: [], error: 'Phase not found' } };
  }

  const files = await readdir(phaseDir);
  const baseNames = files.filter((f) => {
    if (artifactType === 'context') {
      return f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md';
    }
    if (artifactType === 'summary') {
      return f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md';
    }
    if (artifactType === 'verification') {
      return f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md';
    }
    return f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md';
  });

  const artifacts = baseNames.sort().map((f) =>
    toPosixPath(relative(projectDir, join(phaseDir, f))),
  );

  return {
    data: {
      phase: normalizePhaseName(phase),
      type: artifactType,
      artifacts,
    },
  };
};

/**
 * phase.list-plans — list PLAN files in a phase with optional frontmatter key filter.
 *
 * Args: `<phase>` [`--with-schema` `<yamlKey>`]
 */
export const phaseListPlans: QueryHandler = async (args, projectDir, workstream) => {
  if (!args[0]) {
    throw new GSDError('phase required', ErrorClassification.Validation);
  }
  let schemaKey: string | null = null;
  const wsIdx = args.indexOf('--with-schema');
  if (wsIdx !== -1) {
    schemaKey = args[wsIdx + 1] ?? null;
    if (!schemaKey) {
      throw new GSDError('--with-schema requires a field name', ErrorClassification.Validation);
    }
  }

  const phase = args[0];
  const normalized = normalizePhaseName(phase);
  const phaseDir = await resolvePhaseDir(phase, projectDir, workstream);
  if (!phaseDir) {
    return {
      data: {
        phase: normalized,
        plans: [] as Array<Record<string, unknown>>,
        error: 'Phase not found',
      },
    };
  }

  const phaseFiles = await readdir(phaseDir);
  const planFiles = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();

  const plans: Array<Record<string, unknown>> = [];
  for (const planFile of planFiles) {
    const planId = planFile.replace('-PLAN.md', '').replace('PLAN.md', '');
    const planPath = join(phaseDir, planFile);
    const content = await readFile(planPath, 'utf-8');
    const fm = extractFrontmatter(content) as Record<string, unknown>;

    if (schemaKey && !(schemaKey in fm)) {
      continue;
    }

    plans.push({
      id: planId,
      file: toPosixPath(planFile),
      wave: parseInt(String(fm.wave ?? '1'), 10) || 1,
      autonomous: fm.autonomous !== false && fm.autonomous !== 'false',
      frontmatter_keys: Object.keys(fm).sort(),
    });
  }

  return {
    data: {
      phase: normalized,
      with_schema: schemaKey,
      plans,
    },
  };
};
