/**
 * Template handlers — template selection and fill operations.
 *
 * Ported from get-shit-done/bin/lib/template.cjs.
 * Provides templateSelect (heuristic template type selection) and
 * templateFill (create file from template with auto-generated frontmatter).
 *
 * @example
 * ```typescript
 * import { templateSelect, templateFill } from './template.js';
 *
 * const selectResult = await templateSelect(['9'], projectDir);
 * // { data: { template: 'summary' } }
 *
 * const fillResult = await templateFill(['summary', '/path/out.md', 'phase=09'], projectDir);
 * // { data: { created: true, path: '/path/out.md', template: 'summary' } }
 * ```
 */

import { readdir, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { reconstructFrontmatter, spliceFrontmatter } from './frontmatter-mutation.js';
import { normalizeMd, planningPaths, normalizePhaseName, phaseTokenMatches } from './helpers.js';
import type { QueryHandler } from './utils.js';

// ─── templateSelect ─────────────────────────────────────────────────────────

/**
 * Select the appropriate template type based on phase directory contents.
 *
 * Heuristic:
 * - Has all PLAN+SUMMARY pairs -> "verification"
 * - Has PLAN but missing SUMMARY for latest plan -> "summary"
 * - Else -> "plan" (default)
 *
 * @param args - [phaseNumber?] Optional phase number to check
 * @param projectDir - Project root directory
 * @returns QueryResult with { template: 'plan' | 'summary' | 'verification' }
 */
export const templateSelect: QueryHandler = async (args, projectDir, workstream) => {
  const phaseNum = args[0];
  if (!phaseNum) {
    return { data: { template: 'plan' } };
  }

  const paths = planningPaths(projectDir, workstream);
  const normalized = normalizePhaseName(phaseNum);

  // Find the phase directory
  let phaseDir: string | null = null;
  try {
    const entries = await readdir(paths.phases);
    for (const entry of entries) {
      if (phaseTokenMatches(entry, normalized)) {
        phaseDir = join(paths.phases, entry);
        break;
      }
    }
  } catch {
    return { data: { template: 'plan' } };
  }

  if (!phaseDir) {
    return { data: { template: 'plan' } };
  }

  // Read directory contents and check for plans/summaries
  try {
    const files = await readdir(phaseDir);
    const plans = files.filter(f => f.match(/-PLAN\.md$/i));
    const summaries = files.filter(f => f.match(/-SUMMARY\.md$/i));

    if (plans.length === 0) {
      return { data: { template: 'plan' } };
    }

    // Check if all plans have corresponding summaries
    const allHaveSummaries = plans.every(plan => {
      // Extract plan number: e.g., 09-01-PLAN.md -> 09-01
      const prefix = plan.replace(/-PLAN\.md$/i, '');
      return summaries.some(s => s.startsWith(prefix));
    });

    if (allHaveSummaries) {
      return { data: { template: 'verification' } };
    }

    return { data: { template: 'summary' } };
  } catch {
    return { data: { template: 'plan' } };
  }
};

// ─── templateFill ───────────────────────────────────────────────────────────

/**
 * Create a file from a template type with auto-generated frontmatter.
 *
 * Port of cmdTemplateFill from template.cjs.
 *
 * @param args - [templateType, outputPath, ...key=value overrides]
 *   templateType: "summary" | "plan" | "verification"
 *   outputPath: Absolute or relative path for output file
 *   key=value: Optional frontmatter field overrides
 * @param projectDir - Project root directory
 * @returns QueryResult with { created: true, path, template }
 */
export const templateFill: QueryHandler = async (args, projectDir) => {
  const templateType = args[0];
  const outputPath = args[1];

  if (!templateType) {
    throw new GSDError(
      'template type required: summary, plan, or verification',
      ErrorClassification.Validation,
    );
  }
  if (!outputPath) {
    throw new GSDError(
      'output path required',
      ErrorClassification.Validation,
    );
  }

  // T-11-10: Reject path traversal attempts
  const resolvedOut = resolve(projectDir, outputPath);
  const rel = relative(projectDir, resolvedOut);
  if (rel.startsWith('..') || rel.includes('..')) {
    throw new GSDError(
      `Output path escapes project directory: ${outputPath}`,
      ErrorClassification.Validation,
    );
  }

  // Parse key=value overrides from remaining args
  const overrides: Record<string, unknown> = {};
  for (let i = 2; i < args.length; i++) {
    const eqIdx = args[i].indexOf('=');
    if (eqIdx > 0) {
      overrides[args[i].slice(0, eqIdx)] = args[i].slice(eqIdx + 1);
    }
  }

  let fm: Record<string, unknown>;
  let body: string;

  switch (templateType) {
    case 'summary': {
      fm = {
        phase: '', plan: '', subsystem: '', tags: [],
        requires: [], provides: [], affects: [],
        'tech-stack': { added: [], patterns: [] },
        'key-files': { created: [], modified: [] },
        'key-decisions': [], 'patterns-established': [],
        'requirements-completed': [],
        duration: '', completed: '',
      };
      body = [
        '# Phase {phase} Plan {plan}: Summary',
        '',
        '## Performance',
        '',
        '## Accomplishments',
        '',
        '## Task Commits',
        '',
        '## Files Created/Modified',
        '',
        '## Decisions Made',
        '',
        '## Deviations from Plan',
        '',
        '## Issues Encountered',
        '',
        '## User Setup Required',
        '',
        '## Next Phase Readiness',
        '',
        '## Self-Check',
      ].join('\n');
      break;
    }
    case 'plan': {
      fm = {
        phase: '', plan: '', type: 'execute', wave: 1,
        depends_on: [], files_modified: [], autonomous: true,
        requirements: [], must_haves: { truths: [], artifacts: [], key_links: [] },
      };
      body = [
        '<objective>',
        '</objective>',
        '',
        '<context>',
        '</context>',
        '',
        '<tasks>',
        '</tasks>',
        '',
        '<verification>',
        '</verification>',
        '',
        '<success_criteria>',
        '</success_criteria>',
      ].join('\n');
      break;
    }
    case 'verification': {
      fm = {
        phase: '', status: 'pending', verified_at: '',
      };
      body = [
        '# Phase {phase} Verification',
        '',
        '## Must-Have Checks',
        '',
        '## Artifact Verification',
        '',
        '## Key-Link Verification',
        '',
        '## Result',
      ].join('\n');
      break;
    }
    default:
      throw new GSDError(
        `Unknown template type: ${templateType}. Available: summary, plan, verification`,
        ErrorClassification.Validation,
      );
  }

  // Apply overrides
  Object.assign(fm, overrides);

  // Generate content
  const content = spliceFrontmatter('', fm) + '\n' + body + '\n';
  const normalized = normalizeMd(content);

  await writeFile(resolvedOut, normalized, 'utf-8');

  return { data: { created: true, path: outputPath, template: templateType } };
};
