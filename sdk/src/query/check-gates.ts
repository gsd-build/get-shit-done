/**
 * Safety gate consolidation (`check.gates`).
 *
 * Checks blocking conditions before proceeding with a workflow — replaces
 * per-workflow gate logic in `next.md`, `execute-phase.md`, `discuss-phase.md`.
 * See `.planning/research/decision-routing-audit.md` §3.2.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { normalizePhaseName, planningPaths } from './helpers.js';
import { findPhase } from './phase.js';
import type { QueryHandler } from './utils.js';

interface Blocker {
  gate: string;
  file: string;
  severity: 'blocking';
  anti_patterns: string[];
}

interface Warning {
  gate: string;
  phase: string;
  items: string[];
  message: string;
}

async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export const checkGates: QueryHandler = async (args, projectDir, workstream) => {
  const workflow = args[0];
  if (!workflow) {
    throw new GSDError('workflow name required for check gates', ErrorClassification.Validation);
  }

  // Parse optional --phase flag
  let phaseNum: string | null = null;
  const phaseIdx = args.indexOf('--phase');
  if (phaseIdx !== -1 && args[phaseIdx + 1]) {
    phaseNum = args[phaseIdx + 1];
  }

  const blockers: Blocker[] = [];
  const warnings: Warning[] = [];
  const paths = planningPaths(projectDir, workstream);

  // Gate 1: .continue-here.md in project root
  const continueHerePath = join(projectDir, '.continue-here.md');
  if (existsSync(continueHerePath)) {
    blockers.push({
      gate: 'continue-here',
      file: '.continue-here.md',
      severity: 'blocking',
      anti_patterns: ['continue-here.md present — another session may be in progress'],
    });
  }

  // Gate 2: STATE.md error/failed status
  const stateContent = await readFileSafe(paths.state);
  if (stateContent) {
    const hasErrorStatus =
      /^status:\s*(error|failed)/im.test(stateContent) ||
      /##\s*Error/i.test(stateContent);
    if (hasErrorStatus) {
      blockers.push({
        gate: 'state-error',
        file: '.planning/STATE.md',
        severity: 'blocking',
        anti_patterns: ['STATE.md status is error/failed'],
      });
    }
  }

  // Gate 3: Verification debt — check VERIFICATION.md in phase dir if phase provided
  if (phaseNum) {
    const phaseRes = await findPhase([phaseNum], projectDir, workstream);
    const pdata = phaseRes.data as Record<string, unknown>;
    if (pdata.found && pdata.directory) {
      const phaseDirFull = join(projectDir, pdata.directory as string);
      const verPath = join(phaseDirFull, 'VERIFICATION.md');
      const verContent = await readFileSafe(verPath);
      if (verContent) {
        const failLines = verContent.match(/\|\s*FAIL\s*\|[^\n]*/gi) || [];
        if (failLines.length > 0) {
          warnings.push({
            gate: 'verification-debt',
            phase: normalizePhaseName(phaseNum),
            items: failLines.map(l => `FAIL: ${l.trim()}`),
            message: `${failLines.length} FAIL row(s) in VERIFICATION.md`,
          });
        }
      }
    }
  }

  return {
    data: {
      passed: blockers.length === 0,
      blockers,
      warnings,
    },
  };
};
