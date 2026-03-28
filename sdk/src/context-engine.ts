/**
 * Context engine — resolves which .planning/ state files exist per phase type.
 *
 * Different phases need different subsets of context files. The execute phase
 * only needs STATE.md + config.json (minimal). Research needs STATE.md +
 * ROADMAP.md + CONTEXT.md. Plan needs all files. Verify needs STATE.md +
 * ROADMAP.md + REQUIREMENTS.md + PLAN/SUMMARY files.
 */

import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { constants } from 'node:fs';

import type { ContextFiles } from './types.js';
import { PhaseType } from './types.js';
import type { GSDLogger } from './logger.js';

// ─── File manifest per phase ─────────────────────────────────────────────────

interface FileSpec {
  key: keyof ContextFiles;
  filename: string;
  required: boolean;
}

/**
 * Define which files each phase needs. Required files emit warnings when missing;
 * optional files silently return undefined.
 */
const PHASE_FILE_MANIFEST: Record<PhaseType, FileSpec[]> = {
  [PhaseType.Execute]: [
    { key: 'state', filename: 'STATE.md', required: true },
    { key: 'config', filename: 'config.json', required: false },
  ],
  [PhaseType.Research]: [
    { key: 'state', filename: 'STATE.md', required: true },
    { key: 'roadmap', filename: 'ROADMAP.md', required: true },
    { key: 'context', filename: 'CONTEXT.md', required: true },
    { key: 'requirements', filename: 'REQUIREMENTS.md', required: false },
  ],
  [PhaseType.Plan]: [
    { key: 'state', filename: 'STATE.md', required: true },
    { key: 'roadmap', filename: 'ROADMAP.md', required: true },
    { key: 'context', filename: 'CONTEXT.md', required: true },
    { key: 'research', filename: 'RESEARCH.md', required: false },
    { key: 'requirements', filename: 'REQUIREMENTS.md', required: false },
  ],
  [PhaseType.Verify]: [
    { key: 'state', filename: 'STATE.md', required: true },
    { key: 'roadmap', filename: 'ROADMAP.md', required: true },
    { key: 'requirements', filename: 'REQUIREMENTS.md', required: false },
    { key: 'plan', filename: 'PLAN.md', required: false },
    { key: 'summary', filename: 'SUMMARY.md', required: false },
  ],
  [PhaseType.Discuss]: [
    { key: 'state', filename: 'STATE.md', required: true },
    { key: 'roadmap', filename: 'ROADMAP.md', required: false },
    { key: 'context', filename: 'CONTEXT.md', required: false },
  ],
};

// ─── ContextEngine class ─────────────────────────────────────────────────────

export class ContextEngine {
  private readonly planningDir: string;
  private readonly logger?: GSDLogger;

  constructor(projectDir: string, logger?: GSDLogger) {
    this.planningDir = join(projectDir, '.planning');
    this.logger = logger;
  }

  /**
   * Resolve context files appropriate for the given phase type.
   * Reads each file defined in the phase manifest, returning undefined
   * for missing optional files and warning for missing required files.
   */
  async resolveContextFiles(phaseType: PhaseType): Promise<ContextFiles> {
    const manifest = PHASE_FILE_MANIFEST[phaseType];
    const result: ContextFiles = {};

    for (const spec of manifest) {
      const filePath = join(this.planningDir, spec.filename);
      const content = await this.readFileIfExists(filePath);

      if (content !== undefined) {
        result[spec.key] = content;
      } else if (spec.required) {
        this.logger?.warn(`Required context file missing for ${phaseType} phase: ${spec.filename}`, {
          phase: phaseType,
          file: spec.filename,
          path: filePath,
        });
      }
    }

    return result;
  }

  /**
   * Check if a file exists and read it. Returns undefined if not found.
   */
  private async readFileIfExists(filePath: string): Promise<string | undefined> {
    try {
      await access(filePath, constants.R_OK);
      return await readFile(filePath, 'utf-8');
    } catch {
      return undefined;
    }
  }
}

export { PHASE_FILE_MANIFEST };
export type { FileSpec };
