/**
 * Open Artifact Audit — full TypeScript port of `get-shit-done/bin/lib/audit.cjs`.
 *
 * Scans `.planning/` artifact categories for unresolved items (same JSON as gsd-tools `audit-open`).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { extractFrontmatter } from './frontmatter.js';
import { planningPaths, sanitizeForDisplay } from './helpers.js';
import type { QueryHandler } from './utils.js';

function scanDebugSessions(planDir: string): Array<Record<string, unknown>> {
  const debugDir = join(planDir, 'debug');
  if (!existsSync(debugDir)) return [];

  const results: Array<Record<string, unknown>> = [];
  let files;
  try {
    files = readdirSync(debugDir, { withFileTypes: true });
  } catch {
    return [{ scan_error: true }];
  }

  for (const entry of files) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md')) continue;

    const filePath = join(debugDir, entry.name);
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      results.push({
        slug: sanitizeForDisplay(basename(entry.name, '.md')),
        status: 'unreadable',
        scan_error: true,
        detail: 'file read failed',
      });
      continue;
    }

    const fm = extractFrontmatter(content);
    const status = (fm.status || 'unknown').toString().toLowerCase();
    if (status === 'resolved' || status === 'complete') continue;

    let hypothesis = '';
    const focusMatch = content.match(/##\s*Current Focus[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
    if (focusMatch) {
      const focusText = focusMatch[1].trim().split('\n')[0].trim();
      hypothesis = sanitizeForDisplay(focusText.slice(0, 100));
    }

    const slug = basename(entry.name, '.md');
    results.push({
      slug: sanitizeForDisplay(slug),
      status: sanitizeForDisplay(status),
      updated: sanitizeForDisplay(String(fm.updated || fm.date || '')),
      hypothesis,
    });
  }

  return results;
}

function scanQuickTasks(planDir: string): Array<Record<string, unknown>> {
  const quickDir = join(planDir, 'quick');
  if (!existsSync(quickDir)) return [];

  let entries;
  try {
    entries = readdirSync(quickDir, { withFileTypes: true });
  } catch {
    return [{ scan_error: true }];
  }

  const results: Array<Record<string, unknown>> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dirName = entry.name;
    const taskDir = join(quickDir, dirName);
    const summaryPath = join(taskDir, 'SUMMARY.md');

    let status = 'missing';
    const description = '';

    if (existsSync(summaryPath)) {
      try {
        const content = readFileSync(summaryPath, 'utf-8');
        const fm = extractFrontmatter(content);
        status = (fm.status || 'unknown').toString().toLowerCase();
      } catch {
        status = 'unreadable';
      }
    }

    if (status === 'complete') continue;

    let date = '';
    let slug = sanitizeForDisplay(dirName);
    const dateMatch = dirName.match(/^(\d{4}-?\d{2}-?\d{2})-(.+)$/);
    if (dateMatch) {
      date = dateMatch[1];
      slug = sanitizeForDisplay(dateMatch[2]);
    }

    results.push({
      slug,
      date,
      status: sanitizeForDisplay(status),
      description,
    });
  }

  return results;
}

function scanThreads(planDir: string): Array<Record<string, unknown>> {
  const threadsDir = join(planDir, 'threads');
  if (!existsSync(threadsDir)) return [];

  let files;
  try {
    files = readdirSync(threadsDir, { withFileTypes: true });
  } catch {
    return [{ scan_error: true }];
  }

  const openStatuses = new Set(['open', 'in_progress', 'in progress']);
  const results: Array<Record<string, unknown>> = [];

  for (const entry of files) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md')) continue;

    const filePath = join(threadsDir, entry.name);
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      results.push({
        slug: sanitizeForDisplay(basename(entry.name, '.md')),
        status: 'unreadable',
        scan_error: true,
        detail: 'file read failed',
      });
      continue;
    }

    const fm = extractFrontmatter(content);
    let status = (fm.status || '').toString().toLowerCase().trim();

    if (!status) {
      const bodyStatusMatch = content.match(/##\s*Status:\s*(OPEN|IN PROGRESS|IN_PROGRESS)/i);
      if (bodyStatusMatch) {
        status = bodyStatusMatch[1].toLowerCase().replace(/ /g, '_');
      }
    }

    if (!openStatuses.has(status)) continue;

    let title = sanitizeForDisplay(String(fm.title || ''));
    if (!title) {
      const headingMatch = content.match(/^#\s*Thread:\s*(.+)$/m);
      if (headingMatch) {
        title = sanitizeForDisplay(headingMatch[1].trim().slice(0, 100));
      }
    }

    const slug = basename(entry.name, '.md');
    results.push({
      slug: sanitizeForDisplay(slug),
      status: sanitizeForDisplay(status),
      updated: sanitizeForDisplay(String(fm.updated || fm.date || '')),
      title,
    });
  }

  return results;
}

function scanTodos(planDir: string): Array<Record<string, unknown>> {
  const pendingDir = join(planDir, 'todos', 'pending');
  if (!existsSync(pendingDir)) return [];

  let files;
  try {
    files = readdirSync(pendingDir, { withFileTypes: true });
  } catch {
    return [{ scan_error: true }];
  }

  const mdFiles = files.filter(e => e.isFile() && e.name.endsWith('.md'));
  const results: Array<Record<string, unknown>> = [];

  const displayFiles = mdFiles.slice(0, 5);
  for (const entry of displayFiles) {
    const filePath = join(pendingDir, entry.name);
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const fm = extractFrontmatter(content);
    const bodyMatch = content.replace(/^---[\s\S]*?---\n?/, '');
    const firstLine = bodyMatch.trim().split('\n')[0] || '';
    const summary = sanitizeForDisplay(firstLine.slice(0, 100));

    results.push({
      filename: sanitizeForDisplay(entry.name),
      priority: sanitizeForDisplay(String(fm.priority || '')),
      area: sanitizeForDisplay(String(fm.area || '')),
      summary,
    });
  }

  if (mdFiles.length > 5) {
    results.push({ _remainder_count: mdFiles.length - 5 });
  }

  return results;
}

function scanSeeds(planDir: string): Array<Record<string, unknown>> {
  const seedsDir = join(planDir, 'seeds');
  if (!existsSync(seedsDir)) return [];

  let files;
  try {
    files = readdirSync(seedsDir, { withFileTypes: true });
  } catch {
    return [{ scan_error: true }];
  }

  const unimplementedStatuses = new Set(['dormant', 'active', 'triggered']);
  const results: Array<Record<string, unknown>> = [];

  for (const entry of files) {
    if (!entry.isFile()) continue;
    if (!entry.name.startsWith('SEED-') || !entry.name.endsWith('.md')) continue;

    const filePath = join(seedsDir, entry.name);
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const fm = extractFrontmatter(content);
    const status = (fm.status || 'dormant').toString().toLowerCase();

    if (!unimplementedStatuses.has(status)) continue;

    const seedIdMatch = entry.name.match(/^(SEED-[\w-]+)\.md$/);
    const seed_id = seedIdMatch ? seedIdMatch[1] : basename(entry.name, '.md');
    const slug = sanitizeForDisplay(seed_id.replace(/^SEED-/, ''));

    let title = sanitizeForDisplay(String(fm.title || ''));
    if (!title) {
      const headingMatch = content.match(/^#\s*(.+)$/m);
      if (headingMatch) title = sanitizeForDisplay(headingMatch[1].trim().slice(0, 100));
    }

    results.push({
      seed_id: sanitizeForDisplay(seed_id),
      slug,
      status: sanitizeForDisplay(status),
      title,
    });
  }

  return results;
}

function scanUatGaps(planDir: string): Array<Record<string, unknown>> {
  const phasesDir = join(planDir, 'phases');
  if (!existsSync(phasesDir)) return [];

  let dirs: string[];
  try {
    dirs = readdirSync(phasesDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();
  } catch {
    return [{ scan_error: true }];
  }

  const results: Array<Record<string, unknown>> = [];

  for (const dir of dirs) {
    const phaseDir = join(phasesDir, dir);
    const phaseMatch = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
    const phaseNum = phaseMatch ? phaseMatch[1] : dir;

    let phaseFiles: string[];
    try {
      phaseFiles = readdirSync(phaseDir);
    } catch {
      continue;
    }

    for (const file of phaseFiles.filter(f => f.includes('-UAT') && f.endsWith('.md'))) {
      const filePath = join(phaseDir, file);
      let content: string;
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      const fm = extractFrontmatter(content);
      const status = (fm.status || 'unknown').toString().toLowerCase();

      if (status === 'complete') continue;

      const pendingMatches = (content.match(/result:\s*(?:pending|\[pending\])/gi) || []).length;

      results.push({
        phase: sanitizeForDisplay(phaseNum),
        file: sanitizeForDisplay(file),
        status: sanitizeForDisplay(status),
        open_scenario_count: pendingMatches,
      });
    }
  }

  return results;
}

function scanVerificationGaps(planDir: string): Array<Record<string, unknown>> {
  const phasesDir = join(planDir, 'phases');
  if (!existsSync(phasesDir)) return [];

  let dirs: string[];
  try {
    dirs = readdirSync(phasesDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();
  } catch {
    return [{ scan_error: true }];
  }

  const results: Array<Record<string, unknown>> = [];

  for (const dir of dirs) {
    const phaseDir = join(phasesDir, dir);
    const phaseMatch = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
    const phaseNum = phaseMatch ? phaseMatch[1] : dir;

    let phaseFiles: string[];
    try {
      phaseFiles = readdirSync(phaseDir);
    } catch {
      continue;
    }

    for (const file of phaseFiles.filter(f => f.includes('-VERIFICATION') && f.endsWith('.md'))) {
      const filePath = join(phaseDir, file);
      let content: string;
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      const fm = extractFrontmatter(content);
      const status = (fm.status || 'unknown').toString().toLowerCase();

      if (status !== 'gaps_found' && status !== 'human_needed') continue;

      results.push({
        phase: sanitizeForDisplay(phaseNum),
        file: sanitizeForDisplay(file),
        status: sanitizeForDisplay(status),
      });
    }
  }

  return results;
}

function scanContextQuestions(planDir: string): Array<Record<string, unknown>> {
  const phasesDir = join(planDir, 'phases');
  if (!existsSync(phasesDir)) return [];

  let dirs: string[];
  try {
    dirs = readdirSync(phasesDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();
  } catch {
    return [{ scan_error: true }];
  }

  const results: Array<Record<string, unknown>> = [];

  for (const dir of dirs) {
    const phaseDir = join(phasesDir, dir);
    const phaseMatch = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
    const phaseNum = phaseMatch ? phaseMatch[1] : dir;

    let phaseFiles: string[];
    try {
      phaseFiles = readdirSync(phaseDir);
    } catch {
      continue;
    }

    for (const file of phaseFiles.filter(f => f.includes('-CONTEXT') && f.endsWith('.md'))) {
      const filePath = join(phaseDir, file);
      let content: string;
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      const fm = extractFrontmatter(content);

      let questions: string[] = [];
      if (fm.open_questions) {
        if (Array.isArray(fm.open_questions) && fm.open_questions.length > 0) {
          questions = fm.open_questions.map(q => sanitizeForDisplay(String(q).slice(0, 200)));
        }
      }

      if (questions.length === 0) {
        const oqMatch = content.match(/##\s*Open Questions[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
        if (oqMatch) {
          const oqBody = oqMatch[1].trim();
          if (oqBody && oqBody.length > 0 && !/^\s*none\s*$/i.test(oqBody)) {
            const items = oqBody.split('\n')
              .map(l => l.trim())
              .filter(l => l && l !== '-' && l !== '*')
              .filter(l => /^[-*\d]/.test(l) || l.includes('?'));
            questions = items.slice(0, 3).map(q => sanitizeForDisplay(q.slice(0, 200)));
          }
        }
      }

      if (questions.length === 0) continue;

      results.push({
        phase: sanitizeForDisplay(phaseNum),
        file: sanitizeForDisplay(file),
        question_count: questions.length,
        questions: questions.slice(0, 3),
      });
    }
  }

  return results;
}

export interface AuditOpenResult {
  scanned_at: string;
  /** True when at least one category reported scan_error / unreadable rows (audit may be incomplete). */
  has_scan_errors: boolean;
  has_open_items: boolean;
  counts: {
    debug_sessions: number;
    quick_tasks: number;
    threads: number;
    todos: number;
    seeds: number;
    uat_gaps: number;
    verification_gaps: number;
    context_questions: number;
    total: number;
  };
  items: {
    debug_sessions: Array<Record<string, unknown>>;
    quick_tasks: Array<Record<string, unknown>>;
    threads: Array<Record<string, unknown>>;
    todos: Array<Record<string, unknown>>;
    seeds: Array<Record<string, unknown>>;
    uat_gaps: Array<Record<string, unknown>>;
    verification_gaps: Array<Record<string, unknown>>;
    context_questions: Array<Record<string, unknown>>;
  };
}

/**
 * Same structured result as `gsd-tools.cjs audit-open` (JSON).
 */
export function auditOpenArtifacts(projectDir: string, workstream?: string): AuditOpenResult {
  const planDir = planningPaths(projectDir, workstream).planning;

  const debugSessions = (() => {
    try { return scanDebugSessions(planDir); } catch { return [{ scan_error: true }]; }
  })();

  const quickTasks = (() => {
    try { return scanQuickTasks(planDir); } catch { return [{ scan_error: true }]; }
  })();

  const threads = (() => {
    try { return scanThreads(planDir); } catch { return [{ scan_error: true }]; }
  })();

  const todos = (() => {
    try { return scanTodos(planDir); } catch { return [{ scan_error: true }]; }
  })();

  const seeds = (() => {
    try { return scanSeeds(planDir); } catch { return [{ scan_error: true }]; }
  })();

  const uatGaps = (() => {
    try { return scanUatGaps(planDir); } catch { return [{ scan_error: true }]; }
  })();

  const verificationGaps = (() => {
    try { return scanVerificationGaps(planDir); } catch { return [{ scan_error: true }]; }
  })();

  const contextQuestions = (() => {
    try { return scanContextQuestions(planDir); } catch { return [{ scan_error: true }]; }
  })();

  const countReal = (arr: Array<Record<string, unknown>>): number =>
    arr.filter(i => !i.scan_error && !i._remainder_count).length;

  const counts = {
    debug_sessions: countReal(debugSessions),
    quick_tasks: countReal(quickTasks),
    threads: countReal(threads),
    todos: countReal(todos),
    seeds: countReal(seeds),
    uat_gaps: countReal(uatGaps),
    verification_gaps: countReal(verificationGaps),
    context_questions: countReal(contextQuestions),
    total: 0,
  };
  counts.total =
    counts.debug_sessions +
    counts.quick_tasks +
    counts.threads +
    counts.todos +
    counts.seeds +
    counts.uat_gaps +
    counts.verification_gaps +
    counts.context_questions;

  const itemArrays = [
    debugSessions,
    quickTasks,
    threads,
    todos,
    seeds,
    uatGaps,
    verificationGaps,
    contextQuestions,
  ];
  const has_scan_errors = itemArrays.some(arr =>
    arr.some(i => i.scan_error === true),
  );

  return {
    scanned_at: new Date().toISOString(),
    has_scan_errors,
    has_open_items: counts.total > 0,
    counts,
    items: {
      debug_sessions: debugSessions,
      quick_tasks: quickTasks,
      threads,
      todos,
      seeds,
      uat_gaps: uatGaps,
      verification_gaps: verificationGaps,
      context_questions: contextQuestions,
    },
  };
}

/**
 * Human-readable report (same text as gsd-tools without `--json`).
 */
export function formatAuditReport(auditResult: AuditOpenResult): string {
  const { counts, items, has_open_items, has_scan_errors } = auditResult;
  const lines: string[] = [];
  const hr = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  lines.push(hr);
  lines.push('  Milestone Close: Open Artifact Audit');
  lines.push(hr);

  if (has_scan_errors) {
    lines.push('');
    lines.push('  ⚠ Some files or directories could not be scanned completely.');
    lines.push('  Treat this audit as incomplete until read errors are resolved.');
    lines.push('');
  }

  if (!has_open_items && !has_scan_errors) {
    lines.push('');
    lines.push('  All artifact types clear. Safe to proceed.');
    lines.push('');
    lines.push(hr);
    return lines.join('\n');
  }

  if (!has_open_items && has_scan_errors) {
    lines.push('');
    lines.push('  No open items counted, but scanning had errors — not safe to assume a clean close.');
    lines.push('');
    lines.push(hr);
    return lines.join('\n');
  }

  if (counts.debug_sessions > 0) {
    lines.push('');
    lines.push(`🔴 Debug Sessions (${counts.debug_sessions} open)`);
    for (const item of items.debug_sessions.filter(i => !i.scan_error)) {
      const hyp = item.hypothesis ? ` — ${item.hypothesis}` : '';
      lines.push(`   • ${item.slug} [${item.status}]${hyp}`);
    }
  }

  if (counts.uat_gaps > 0) {
    lines.push('');
    lines.push(`🔴 UAT Gaps (${counts.uat_gaps} phases with incomplete UAT)`);
    for (const item of items.uat_gaps.filter(i => !i.scan_error)) {
      lines.push(`   • Phase ${item.phase}: ${item.file} [${item.status}] — ${item.open_scenario_count} pending scenarios`);
    }
  }

  if (counts.verification_gaps > 0) {
    lines.push('');
    lines.push(`🔴 Verification Gaps (${counts.verification_gaps} unresolved)`);
    for (const item of items.verification_gaps.filter(i => !i.scan_error)) {
      lines.push(`   • Phase ${item.phase}: ${item.file} [${item.status}]`);
    }
  }

  if (counts.quick_tasks > 0) {
    lines.push('');
    lines.push(`🟡 Quick Tasks (${counts.quick_tasks} incomplete)`);
    for (const item of items.quick_tasks.filter(i => !i.scan_error)) {
      const d = item.date ? ` (${item.date})` : '';
      lines.push(`   • ${item.slug}${d} [${item.status}]`);
    }
  }

  if (counts.todos > 0) {
    const realTodos = items.todos.filter(i => !i.scan_error && !i._remainder_count);
    const remainder = items.todos.find(i => i._remainder_count);
    lines.push('');
    lines.push(`🟡 Pending Todos (${counts.todos} pending)`);
    for (const item of realTodos) {
      const area = item.area ? ` [${item.area}]` : '';
      const pri = item.priority ? ` (${item.priority})` : '';
      lines.push(`   • ${item.filename}${area}${pri}`);
      if (item.summary) lines.push(`     ${item.summary}`);
    }
    if (remainder) {
      lines.push(`   ... and ${remainder._remainder_count} more`);
    }
  }

  if (counts.threads > 0) {
    lines.push('');
    lines.push(`🔵 Open Threads (${counts.threads} active)`);
    for (const item of items.threads.filter(i => !i.scan_error)) {
      const title = item.title ? ` — ${item.title}` : '';
      lines.push(`   • ${item.slug} [${item.status}]${title}`);
    }
  }

  if (counts.seeds > 0) {
    lines.push('');
    lines.push(`🔵 Unimplemented Seeds (${counts.seeds} pending)`);
    for (const item of items.seeds.filter(i => !i.scan_error)) {
      const title = item.title ? ` — ${item.title}` : '';
      lines.push(`   • ${item.seed_id} [${item.status}]${title}`);
    }
  }

  if (counts.context_questions > 0) {
    lines.push('');
    lines.push(`🔵 CONTEXT Open Questions (${counts.context_questions} phases with open questions)`);
    for (const item of items.context_questions.filter(i => !i.scan_error)) {
      lines.push(`   • Phase ${item.phase}: ${item.file} (${item.question_count} question${item.question_count !== 1 ? 's' : ''})`);
      for (const q of (item.questions as string[]) || []) {
        lines.push(`     - ${q}`);
      }
    }
  }

  lines.push('');
  lines.push(hr);
  lines.push(`  ${counts.total} item${counts.total !== 1 ? 's' : ''} require decisions before close.`);
  lines.push(hr);

  return lines.join('\n');
}

/**
 * `audit-open` / `audit.open` — optional `--json` for structured JSON only (default adds formatted report string).
 */
export const auditOpen: QueryHandler = async (args, projectDir, workstream) => {
  const jsonOnly = args.includes('--json');
  const result = auditOpenArtifacts(projectDir, workstream);
  if (jsonOnly) {
    return { data: result };
  }
  return {
    data: {
      ...result,
      report: formatAuditReport(result),
    },
  };
};
