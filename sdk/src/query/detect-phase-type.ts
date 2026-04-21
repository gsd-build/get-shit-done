/**
 * Phase type detection (`detect.phase-type`).
 *
 * Replaces fragile grep-based UI/schema/API detection in workflows with a
 * structured query. See `.planning/research/decision-routing-audit.md` §3.6.
 */

import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { escapeRegex, normalizePhaseName, planningPaths } from './helpers.js';
import { findPhase } from './phase.js';
import { detectSchemaFiles } from './schema-detect.js';
import type { QueryHandler } from './utils.js';

// Copied from phase-ready.ts — do not import to avoid cross-module coupling.
const UI_INDICATOR_RE = /UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget/i;

const API_INDICATOR_RE = /route\.ts|controller\.|api\//i;
const API_HEADING_RE = /\bAPI\b|endpoint|REST|GraphQL/i;
const INFRA_RE = /docker|terraform|k8s|helm|infra/i;

async function roadmapHeadingForPhase(projectDir: string, phaseNum: string, workstream?: string): Promise<string | null> {
  const roadmapPath = planningPaths(projectDir, workstream).roadmap;
  let content: string;
  try {
    content = await readFile(roadmapPath, 'utf-8');
  } catch {
    return null;
  }
  const re = new RegExp(`#{2,4}\\s*Phase\\s+${escapeRegex(phaseNum)}\\s*:[^\\n]*`, 'i');
  const m = content.match(re);
  return m ? m[0] : null;
}

export const detectPhaseType: QueryHandler = async (args, projectDir, workstream) => {
  const raw = args[0];
  if (!raw) {
    throw new GSDError('phase number required for detect phase-type', ErrorClassification.Validation);
  }
  const phaseArg = normalizePhaseName(raw);

  const phaseRes = await findPhase([raw], projectDir, workstream);
  const pdata = phaseRes.data as Record<string, unknown>;
  const found = Boolean(pdata.found);

  // Build phase dir absolute path when found
  let phaseDirFull: string | null = null;
  if (found && pdata.directory) {
    phaseDirFull = join(projectDir, pdata.directory as string);
  }

  const phaseNumForRoadmap = (pdata.phase_number as string) || phaseArg;

  // Read ROADMAP heading — try both normalized forms
  let heading = await roadmapHeadingForPhase(projectDir, phaseNumForRoadmap, workstream);
  if (!heading && phaseNumForRoadmap !== phaseArg) {
    heading = await roadmapHeadingForPhase(projectDir, phaseArg, workstream);
  }

  // Frontend detection
  const headingUiMatch = heading ? UI_INDICATOR_RE.test(heading) : false;
  const frontendIndicators: string[] = [];

  if (heading && headingUiMatch) {
    // Collect matched keywords from heading
    const keywords = ['UI', 'interface', 'frontend', 'component', 'layout', 'page', 'screen', 'view', 'form', 'dashboard', 'widget'];
    for (const kw of keywords) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(heading)) {
        frontendIndicators.push(kw);
      }
    }
  }

  let hasUiSpecFile = false;
  let dirFiles: string[] = [];

  if (phaseDirFull && existsSync(phaseDirFull)) {
    try {
      dirFiles = readdirSync(phaseDirFull, { recursive: false }) as string[];
    } catch {
      dirFiles = [];
    }
    hasUiSpecFile = dirFiles.some(f => f === 'UI-SPEC.md' || f.endsWith('-UI-SPEC.md'));
  }

  const has_frontend = headingUiMatch || hasUiSpecFile;

  // Schema detection — build relative paths from phase dir for detectSchemaFiles
  let schemaFiles: string[] = [];
  let schemaOrm: string | null = null;
  let hasSchema = false;

  if (phaseDirFull && dirFiles.length > 0) {
    // Also check subdirectory one level deep (e.g. prisma/schema.prisma)
    const allRelPaths: string[] = [...dirFiles];
    for (const f of dirFiles) {
      const sub = join(phaseDirFull, f);
      if (existsSync(sub)) {
        try {
          const subStat = readdirSync(sub);
          for (const sf of subStat) {
            allRelPaths.push(`${f}/${sf}`);
          }
        } catch {
          // Not a directory — ignore
        }
      }
    }

    const detection = detectSchemaFiles(allRelPaths);
    if (detection.detected) {
      hasSchema = true;
      schemaFiles = detection.matches;
      schemaOrm = detection.orms[0] ?? null;
    }
  }

  // API detection
  const apiFromFiles = dirFiles.some(f => API_INDICATOR_RE.test(f));
  const apiFromHeading = heading ? API_HEADING_RE.test(heading) : false;
  const has_api = apiFromFiles || apiFromHeading;

  // Infra detection
  const has_infra = dirFiles.some(f => INFRA_RE.test(f));

  return {
    data: {
      phase: phaseArg,
      has_frontend,
      frontend_indicators: frontendIndicators,
      has_schema: hasSchema,
      schema_orm: schemaOrm,
      schema_files: schemaFiles,
      push_command: null,
      has_api,
      has_infra,
    },
  };
};
