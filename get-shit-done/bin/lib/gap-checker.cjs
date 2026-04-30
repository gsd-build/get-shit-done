'use strict';

/**
 * Post-planning gap analysis (#2493).
 *
 * Reads REQUIREMENTS.md (planning-root) and CONTEXT.md (per-phase) and compares
 * each REQ-ID and D-ID against the concatenated text of all PLAN.md files in
 * the phase directory. Emits a unified `Source | Item | Status` report.
 *
 * Gated on workflow.post_planning_gaps (default true). When false, returns
 * { enabled: false } and does not scan.
 *
 * Coverage detection uses word-boundary regex matching to avoid false positives
 * (REQ-1 must not match REQ-10).
 */

const fs = require('fs');
const path = require('path');
const { escapeRegex, output, error } = require('./core.cjs');
const { planningPaths, planningDir } = require('./planning-workspace.cjs');
const { parseDecisions } = require('./decisions.cjs');

/**
 * Parse REQ-IDs from REQUIREMENTS.md content.
 *
 * Supports both checkbox (`- [ ] **REQ-NN** ...`) and traceability table
 * (`| REQ-NN | ... |`) formats.
 */
function parseRequirements(reqMd) {
  if (!reqMd || typeof reqMd !== 'string') return [];
  const out = [];
  const seen = new Set();

  const checkboxRe = /^\s*-\s*\[[x ]\]\s*\*\*(REQ-[A-Za-z0-9_-]+)\*\*\s*(.*)$/gm;
  let cm = checkboxRe.exec(reqMd);
  while (cm !== null) {
    const id = cm[1];
    if (!seen.has(id)) {
      seen.add(id);
      out.push({ id, text: (cm[2] || '').trim() });
    }
    cm = checkboxRe.exec(reqMd);
  }

  const tableRe = /\|\s*(REQ-[A-Za-z0-9_-]+)\s*\|/g;
  let tm = tableRe.exec(reqMd);
  while (tm !== null) {
    const id = tm[1];
    if (!seen.has(id)) {
      seen.add(id);
      out.push({ id, text: '' });
    }
    tm = tableRe.exec(reqMd);
  }

  return out;
}

function detectCoverage(items, planText) {
  return items.map(it => {
    const re = new RegExp('\\b' + escapeRegex(it.id) + '\\b');
    return {
      source: it.source,
      item: it.id,
      status: re.test(planText) ? 'Covered' : 'Not covered',
    };
  });
}

function naturalKey(s) {
  return String(s).replace(/(\d+)/g, (_, n) => n.padStart(8, '0'));
}

function sortRows(rows) {
  const sourceOrder = { 'REQUIREMENTS.md': 0, 'CONTEXT.md': 1 };
  return rows.slice().sort((a, b) => {
    const so = (sourceOrder[a.source] ?? 99) - (sourceOrder[b.source] ?? 99);
    if (so !== 0) return so;
    return naturalKey(a.item).localeCompare(naturalKey(b.item));
  });
}

function formatGapTable(rows) {
  if (rows.length === 0) {
    return '## Post-Planning Gap Analysis\n\nNo requirements or decisions to check.\n';
  }
  const header = '| Source | Item | Status |\n|--------|------|--------|';
  const body = rows.map(r => {
    const tick = r.status === 'Covered' ? '\u2713 Covered' : '\u2717 Not covered';
    return `| ${r.source} | ${r.item} | ${tick} |`;
  }).join('\n');
  return `## Post-Planning Gap Analysis\n\n${header}\n${body}\n`;
}

function readGate(cwd) {
  const cfgPath = path.join(planningDir(cwd), 'config.json');
  try {
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    if (raw && raw.workflow && typeof raw.workflow.post_planning_gaps === 'boolean') {
      return raw.workflow.post_planning_gaps;
    }
  } catch { /* fall through */ }
  return true;
}

function runGapAnalysis(cwd, phaseDir) {
  if (!readGate(cwd)) {
    return {
      enabled: false,
      rows: [],
      table: '',
      summary: 'workflow.post_planning_gaps disabled — skipping post-planning gap analysis',
      counts: { total: 0, covered: 0, uncovered: 0 },
    };
  }

  const absPhaseDir = path.isAbsolute(phaseDir) ? phaseDir : path.join(cwd, phaseDir);

  const reqPath = planningPaths(cwd).requirements;
  const reqMd = fs.existsSync(reqPath) ? fs.readFileSync(reqPath, 'utf-8') : '';
  const reqItems = parseRequirements(reqMd).map(r => ({ ...r, source: 'REQUIREMENTS.md' }));

  const ctxPath = path.join(absPhaseDir, 'CONTEXT.md');
  const ctxMd = fs.existsSync(ctxPath) ? fs.readFileSync(ctxPath, 'utf-8') : '';
  const dItems = parseDecisions(ctxMd).map(d => ({ ...d, source: 'CONTEXT.md' }));

  const items = [...reqItems, ...dItems];

  let planText = '';
  try {
    if (fs.existsSync(absPhaseDir)) {
      const files = fs.readdirSync(absPhaseDir).filter(f => /-PLAN\.md$/.test(f));
      planText = files.map(f => {
        try { return fs.readFileSync(path.join(absPhaseDir, f), 'utf-8'); }
        catch { return ''; }
      }).join('\n');
    }
  } catch { /* unreadable */ }

  if (items.length === 0) {
    return {
      enabled: true,
      rows: [],
      table: '## Post-Planning Gap Analysis\n\nNo requirements or decisions to check.\n',
      summary: 'no requirements or decisions to check',
      counts: { total: 0, covered: 0, uncovered: 0 },
    };
  }

  const rows = sortRows(detectCoverage(items, planText));
  const uncovered = rows.filter(r => r.status === 'Not covered').length;
  const covered = rows.length - uncovered;

  const summary = uncovered === 0
    ? `\u2713 All ${rows.length} items covered by plans`
    : `\u26A0 ${uncovered} of ${rows.length} items not covered by any plan`;

  return {
    enabled: true,
    rows,
    table: formatGapTable(rows) + '\n' + summary + '\n',
    summary,
    counts: { total: rows.length, covered, uncovered },
  };
}

function cmdGapAnalysis(cwd, args, raw) {
  const idx = args.indexOf('--phase-dir');
  if (idx === -1 || !args[idx + 1]) {
    error('Usage: gap-analysis --phase-dir <path-to-phase-directory>');
  }
  const phaseDir = args[idx + 1];
  const result = runGapAnalysis(cwd, phaseDir);
  output(result, raw, result.table || result.summary);
}

module.exports = {
  parseRequirements,
  detectCoverage,
  formatGapTable,
  sortRows,
  runGapAnalysis,
  cmdGapAnalysis,
};
