/**
 * UAT query handlers — checkpoint rendering and audit scanning.
 *
 * Ported from get-shit-done/bin/lib/uat.cjs.
 * Provides UAT checkpoint rendering for verify-work workflows and
 * audit scanning for UAT/VERIFICATION files across phases.
 *
 * @example
 * ```typescript
 * import { uatRenderCheckpoint, auditUat } from './uat.js';
 *
 * await uatRenderCheckpoint(['--file', 'path/to/UAT.md'], '/project');
 * // { data: { test_number: 1, test_name: 'Login', checkpoint: '...' } }
 *
 * await auditUat([], '/project');
 * // { data: { results: [...], summary: { total_files: 2, total_items: 5 } } }
 * ```
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter } from './frontmatter.js';
import { planningPaths, resolvePathUnderProject, sanitizeForDisplay, toPosixPath } from './helpers.js';
import { getMilestonePhaseFilter } from './state.js';
import type { QueryHandler } from './utils.js';

/** Same string as `buildCheckpoint` in `get-shit-done/bin/lib/uat.cjs`. */
function buildUatCheckpoint(currentTest: { number: number; name: string; expected: string }): string {
  return [
    '╔══════════════════════════════════════════════════════════════╗',
    '║  CHECKPOINT: Verification Required                           ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    `**Test ${currentTest.number}: ${currentTest.name}**`,
    '',
    currentTest.expected,
    '',
    '──────────────────────────────────────────────────────────────',
    'Type `pass` or describe what\'s wrong.',
    '──────────────────────────────────────────────────────────────',
  ].join('\n');
}

// ─── uatRenderCheckpoint ─────────────────────────────────────────────────

/**
 * Render the current UAT checkpoint — reads a UAT file, parses the
 * "Current Test" section, and returns a formatted checkpoint prompt.
 *
 * Port of `cmdRenderCheckpoint` from `uat.cjs` (paths via `requireSafePath`,
 * checkpoint via `buildCheckpoint`, name/expected via `sanitizeForDisplay`).
 *
 * Args: --file <path>
 */
export const uatRenderCheckpoint: QueryHandler = async (args, projectDir) => {
  const fileIdx = args.indexOf('--file');
  const filePath = fileIdx !== -1 ? args[fileIdx + 1] : null;
  if (!filePath) {
    return { data: { error: 'UAT file required: use uat render-checkpoint --file <path>' } };
  }

  let resolvedPath: string;
  try {
    resolvedPath = await resolvePathUnderProject(projectDir, filePath);
  } catch {
    return { data: { error: `UAT file not found: ${filePath}` } };
  }

  if (!existsSync(resolvedPath)) {
    return { data: { error: `UAT file not found: ${filePath}` } };
  }

  const content = readFileSync(resolvedPath, 'utf-8');

  const currentTestMatch = content.match(/##\s*Current Test\s*(?:\n<!--[\s\S]*?-->)?\n([\s\S]*?)(?=\n##\s|$)/i);
  if (!currentTestMatch) {
    return { data: { error: 'UAT file is missing a Current Test section' } };
  }

  const section = currentTestMatch[1].trimEnd();
  if (!section.trim()) {
    return { data: { error: 'Current Test section is empty' } };
  }

  if (/\[testing complete\]/i.test(section)) {
    return { data: { error: 'UAT session is already complete; no pending checkpoint to render' } };
  }

  const numberMatch = section.match(/^number:\s*(\d+)\s*$/m);
  const nameMatch = section.match(/^name:\s*(.+)\s*$/m);
  const expectedBlockMatch = section.match(/^expected:\s*\|\n([\s\S]*?)(?=^\w[\w-]*:\s)/m)
    || section.match(/^expected:\s*\|\n([\s\S]+)/m);
  const expectedInlineMatch = section.match(/^expected:\s*(.+)\s*$/m);

  if (!numberMatch || !nameMatch || (!expectedBlockMatch && !expectedInlineMatch)) {
    return { data: { error: 'Current Test section is malformed' } };
  }

  let expectedRaw: string;
  if (expectedBlockMatch) {
    expectedRaw = expectedBlockMatch[1]
      .split('\n')
      .map(line => line.replace(/^ {2}/, ''))
      .join('\n')
      .trim();
  } else {
    expectedRaw = expectedInlineMatch![1].trim();
  }

  const currentTest = {
    complete: false as const,
    number: parseInt(numberMatch[1], 10),
    name: sanitizeForDisplay(nameMatch[1].trim()),
    expected: sanitizeForDisplay(expectedRaw),
  };

  const checkpoint = buildUatCheckpoint(currentTest);

  return {
    data: {
      file_path: toPosixPath(relative(projectDir, resolvedPath)),
      test_number: currentTest.number,
      test_name: currentTest.name,
      checkpoint,
    },
  };
};

// ─── auditUat (cmdAuditUat) ────────────────────────────────────────────────

/** Port of `categorizeItem` from `uat.cjs`. */
function categorizeItem(
  result: string,
  reason: string | undefined,
  blockedBy: string | undefined,
): string {
  if (result === 'blocked' || blockedBy) {
    if (blockedBy) {
      if (/server/i.test(blockedBy)) return 'server_blocked';
      if (/device|physical/i.test(blockedBy)) return 'device_needed';
      if (/build|release|preview/i.test(blockedBy)) return 'build_needed';
      if (/third.party|twilio|stripe/i.test(blockedBy)) return 'third_party';
    }
    return 'blocked';
  }
  if (result === 'skipped') {
    if (reason) {
      if (/server|not running|not available/i.test(reason)) return 'server_blocked';
      if (/simulator|physical|device/i.test(reason)) return 'device_needed';
      if (/build|release|preview/i.test(reason)) return 'build_needed';
    }
    return 'skipped_unresolved';
  }
  if (result === 'pending') return 'pending';
  if (result === 'human_needed') return 'human_uat';
  return 'unknown';
}

/** Port of `parseUatItems` from `uat.cjs`. */
function parseUatItems(content: string): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  const testPattern =
    /###\s*(\d+)\.\s*([^\n]+)\nexpected:\s*([^\n]+)\nresult:\s*(\w+)(?:\n(?:reported|reason|blocked_by):\s*[^\n]*)?/g;
  let match: RegExpExecArray | null;
  while ((match = testPattern.exec(content)) !== null) {
    const [, num, name, expected, result] = match;
    if (result === 'pending' || result === 'skipped' || result === 'blocked') {
      const afterMatch = content.slice(match.index);
      const nextHeading = afterMatch.indexOf('\n###', 1);
      const blockText = nextHeading > 0 ? afterMatch.slice(0, nextHeading) : afterMatch;
      const reasonMatch = blockText.match(/reason:\s*(.+)/);
      const blockedByMatch = blockText.match(/blocked_by:\s*(.+)/);

      const item: Record<string, unknown> = {
        test: parseInt(num, 10),
        name: name.trim(),
        expected: expected.trim(),
        result,
        category: categorizeItem(result, reasonMatch?.[1], blockedByMatch?.[1]),
      };
      if (reasonMatch) item.reason = reasonMatch[1].trim();
      if (blockedByMatch) item.blocked_by = blockedByMatch[1].trim();
      items.push(item);
    }
  }
  return items;
}

/** Port of `parseVerificationItems` from `uat.cjs`. */
function parseVerificationItems(content: string, status: string): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  if (status === 'human_needed') {
    const hvSection = content.match(/##\s*Human Verification.*?\n([\s\S]*?)(?=\n##\s|\n---\s|$)/i);
    if (hvSection) {
      const lines = hvSection[1].split('\n');
      for (const line of lines) {
        const tableMatch = line.match(/\|\s*(\d+)\s*\|\s*([^|]+)/);
        const bulletMatch = line.match(/^[-*]\s+(.+)/);
        const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);

        if (tableMatch) {
          items.push({
            test: parseInt(tableMatch[1], 10),
            name: tableMatch[2].trim(),
            result: 'human_needed',
            category: 'human_uat',
          });
        } else if (numberedMatch) {
          items.push({
            test: parseInt(numberedMatch[1], 10),
            name: numberedMatch[2].trim(),
            result: 'human_needed',
            category: 'human_uat',
          });
        } else if (bulletMatch && bulletMatch[1].length > 10) {
          items.push({
            name: bulletMatch[1].trim(),
            result: 'human_needed',
            category: 'human_uat',
          });
        }
      }
    }
  }
  return items;
}

/**
 * Cross-phase UAT / VERIFICATION audit — port of `cmdAuditUat` (`uat.cjs`).
 */
export const auditUat: QueryHandler = async (_args, projectDir, workstream) => {
  const paths = planningPaths(projectDir, workstream);
  if (!existsSync(paths.phases)) {
    throw new GSDError('No phases directory found in planning directory', ErrorClassification.Blocked);
  }

  const isDirInMilestone = await getMilestonePhaseFilter(projectDir, workstream);
  const results: Record<string, unknown>[] = [];

  const dirs = readdirSync(paths.phases, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .filter(isDirInMilestone)
    .sort();

  for (const dir of dirs) {
    const phaseMatch = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
    const phaseNum = phaseMatch ? phaseMatch[1] : dir;
    const phaseDir = join(paths.phases, dir);
    const files = readdirSync(phaseDir);

    for (const file of files.filter(f => f.includes('-UAT') && f.endsWith('.md'))) {
      const content = readFileSync(join(phaseDir, file), 'utf-8');
      const items = parseUatItems(content);
      if (items.length > 0) {
        const fm = extractFrontmatter(content);
        results.push({
          phase: phaseNum,
          phase_dir: dir,
          file,
          file_path: toPosixPath(relative(projectDir, join(phaseDir, file))),
          type: 'uat',
          status: (fm.status || 'unknown') as string,
          items,
        });
      }
    }

    for (const file of files.filter(f => f.includes('-VERIFICATION') && f.endsWith('.md'))) {
      const content = readFileSync(join(phaseDir, file), 'utf-8');
      const fm = extractFrontmatter(content);
      const status = (fm.status || 'unknown') as string;
      if (status === 'human_needed' || status === 'gaps_found') {
        const items = parseVerificationItems(content, status);
        if (items.length > 0) {
          results.push({
            phase: phaseNum,
            phase_dir: dir,
            file,
            file_path: toPosixPath(relative(projectDir, join(phaseDir, file))),
            type: 'verification',
            status,
            items,
          });
        }
      }
    }
  }

  const summary: {
    total_files: number;
    total_items: number;
    by_category: Record<string, number>;
    by_phase: Record<string, number>;
  } = {
    total_files: results.length,
    total_items: results.reduce((sum, r) => sum + (r.items as unknown[]).length, 0),
    by_category: {},
    by_phase: {},
  };

  for (const r of results) {
    if (!summary.by_phase[r.phase as string]) summary.by_phase[r.phase as string] = 0;
    for (const item of r.items as Array<{ category?: string }>) {
      summary.by_phase[r.phase as string]++;
      const cat = item.category || 'unknown';
      summary.by_category[cat] = (summary.by_category[cat] || 0) + 1;
    }
  }

  return { data: { results, summary } };
};
