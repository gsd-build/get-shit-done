/**
 * VERIFICATION.md parser (`check.verification-status`).
 *
 * Replaces VERIFICATION.md grep/parse branches in `execute-phase.md`,
 * `autonomous.md`, `progress.md` with a structured query.
 * See `.planning/research/decision-routing-audit.md` §3.8.
 */

import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { normalizePhaseName } from './helpers.js';
import { findPhase } from './phase.js';
import type { QueryHandler } from './utils.js';

const NOT_FOUND_RESULT = {
  status: 'missing' as const,
  score: null,
  gaps: [] as string[],
  human_items: [] as string[],
  deferred: [] as string[],
};

// ─── Markdown table parser ─────────────────────────────────────────────────

interface TableRow {
  cells: string[];
  raw: string;
}

function parseTableRows(content: string): TableRow[] {
  return content
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('|') && trimmed.endsWith('|') && !/^\|[-: |]+\|$/.test(trimmed);
    })
    .map(line => ({
      cells: line
        .split('|')
        .slice(1, -1)
        .map(c => c.trim()),
      raw: line.trim(),
    }));
}

/**
 * Find the column index that matches a header predicate, falling back to -1.
 */
function findColIndex(headerRow: TableRow, predicate: (cell: string) => boolean): number {
  return headerRow.cells.findIndex(c => predicate(c));
}

export const checkVerificationStatus: QueryHandler = async (args, projectDir) => {
  const raw = args[0];
  if (!raw) {
    throw new GSDError('phase number required for check verification-status', ErrorClassification.Validation);
  }

  normalizePhaseName(raw); // validate format

  const phaseRes = await findPhase([raw], projectDir);
  const pdata = phaseRes.data as Record<string, unknown>;

  if (!pdata.found || !pdata.directory) {
    return { data: NOT_FOUND_RESULT };
  }

  const phaseDirFull = join(projectDir, pdata.directory as string);

  // Locate VERIFICATION.md — may be prefixed
  let verPath: string | null = null;
  if (existsSync(phaseDirFull)) {
    try {
      const files = readdirSync(phaseDirFull) as string[];
      const verFile = files.find(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');
      if (verFile) verPath = join(phaseDirFull, verFile);
    } catch {
      return { data: NOT_FOUND_RESULT };
    }
  }

  if (!verPath) return { data: NOT_FOUND_RESULT };

  let content: string;
  try {
    content = await readFile(verPath, 'utf-8');
  } catch {
    return { data: NOT_FOUND_RESULT };
  }

  const rows = parseTableRows(content);
  if (rows.length === 0) {
    // No table rows — check frontmatter status field only
    const statusMatch = content.match(/^status:\s*(\S+)/im);
    const status = statusMatch ? statusMatch[1].toLowerCase() : 'missing';
    return { data: { ...NOT_FOUND_RESULT, status: status === 'missing' ? 'missing' : status } };
  }

  // Detect header row — heuristic: first row typically has column names
  const firstRow = rows[0];
  const isHeader = firstRow.cells.some(c =>
    /^(id|status|description|type|notes)$/i.test(c),
  );
  const dataRows = isHeader ? rows.slice(1) : rows;
  const headerRow = isHeader ? firstRow : null;

  // Determine column indices
  let statusCol = headerRow ? findColIndex(headerRow, c => /^status$/i.test(c)) : -1;
  let typeCol = headerRow ? findColIndex(headerRow, c => /^type$/i.test(c)) : -1;
  let notesCol = headerRow ? findColIndex(headerRow, c => /^notes$/i.test(c)) : -1;
  let descCol = headerRow ? findColIndex(headerRow, c => /^description$/i.test(c)) : -1;

  // Fallbacks for tables without headers or unusual column orders
  if (statusCol === -1) statusCol = 2; // typical: | ID | Description | Status |
  if (descCol === -1) descCol = 1;

  let passCount = 0;
  let totalCount = 0;
  const gaps: string[] = [];
  const human_items: string[] = [];
  const deferred: string[] = [];

  for (const row of dataRows) {
    const statusVal = (row.cells[statusCol] ?? '').toUpperCase();
    const typeVal = typeCol >= 0 ? (row.cells[typeCol] ?? '').toLowerCase() : '';
    const notesVal = notesCol >= 0 ? (row.cells[notesCol] ?? '').toLowerCase() : '';
    const descVal = row.cells[descCol] ?? row.cells[0] ?? row.raw;

    if (statusVal === 'PASS' || statusVal === 'FAIL') totalCount++;
    if (statusVal === 'PASS') passCount++;
    if (statusVal === 'FAIL') gaps.push(descVal);
    if (typeVal.includes('human')) human_items.push(descVal);
    if (notesVal.includes('deferred')) deferred.push(descVal);
  }

  const score = totalCount > 0 ? `${passCount}/${totalCount}` : null;

  let status: string;
  if (gaps.length > 0) {
    status = 'fail';
  } else if (passCount === totalCount && totalCount > 0) {
    status = 'pass';
  } else {
    // Check frontmatter status as tiebreaker
    const statusMatch = content.match(/^status:\s*(\S+)/im);
    status = statusMatch ? statusMatch[1].toLowerCase() : 'partial';
  }

  return {
    data: {
      status,
      score,
      gaps,
      human_items,
      deferred,
    },
  };
};
