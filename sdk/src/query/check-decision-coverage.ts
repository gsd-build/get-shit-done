/**
 * Decision-coverage gates — issue #2492.
 *
 * Two handlers, two semantics:
 *
 *   - `check.decision-coverage-plan`  — translation gate, BLOCKING.
 *     Plan-phase calls this after the existing requirements coverage gate.
 *     Each trackable CONTEXT.md decision must appear (by id or normalized
 *     phrase) in at least one PLAN.md `must_haves` / `truths` block or in
 *     the plan body. A miss returns `passed: false` with a clear message
 *     naming the missed decision; the workflow surfaces this to the user
 *     and refuses to mark the phase planned.
 *
 *   - `check.decision-coverage-verify` — validation gate, NON-BLOCKING.
 *     Verify-phase calls this. Each trackable decision is searched in the
 *     phase's shipped artifacts (PLAN.md, SUMMARY.md, files_modified, recent
 *     commit subjects). Misses are reported but do NOT change verification
 *     status. Rationale: by verification time the work is done; a fuzzy
 *     "honored" check is a soft signal, not a blocker.
 *
 * Both gates short-circuit when `workflow.context_coverage_gate` is `false`.
 *
 * Match strategy (used by both gates):
 *   1. Strict id match — `D-NN` appears verbatim somewhere in the searched
 *      text. This is the path users should aim for.
 *   2. Soft phrase match — a normalized 6+-word slice of the decision text
 *      appears as a substring. Catches plans/summaries that paraphrase but
 *      forget the id.
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { loadConfig } from '../config.js';
import { parseDecisions, type ParsedDecision } from './decisions.js';
import type { QueryHandler } from './utils.js';

const execFile = promisify(execFileCb);

interface GateUncoveredItem {
  id: string;
  text: string;
  category: string;
}

interface PlanGateData {
  passed: boolean;
  skipped: boolean;
  reason?: string;
  total: number;
  covered: number;
  uncovered: GateUncoveredItem[];
  message: string;
}

interface VerifyGateData {
  skipped: boolean;
  blocking: false;
  reason?: string;
  total: number;
  honored: number;
  not_honored: GateUncoveredItem[];
  message: string;
}

function normalizePhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a soft-match phrase: the first 6 normalized words. Six is empirically
 * long enough to avoid collisions with common English fragments and short
 * enough to survive minor rewordings.
 */
function softPhrase(text: string): string {
  const words = normalizePhrase(text).split(' ').filter(Boolean);
  return words.slice(0, 6).join(' ');
}

/** True when decision text or id appears in `haystack`. */
function decisionMentioned(haystack: string, decision: ParsedDecision): boolean {
  if (!haystack) return false;
  const idRe = new RegExp(`\\b${decision.id}\\b`);
  if (idRe.test(haystack)) return true;
  const phrase = softPhrase(decision.text);
  if (phrase.length < 12) return false; // too short to be unique
  return normalizePhrase(haystack).includes(phrase);
}

async function readIfExists(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return '';
  }
}

async function loadPlanContents(phaseDir: string): Promise<string[]> {
  if (!existsSync(phaseDir)) return [];
  let entries: string[] = [];
  try {
    entries = await readdir(phaseDir);
  } catch {
    return [];
  }
  const planFiles = entries.filter((e) => /-PLAN\.md$/.test(e));
  const out: string[] = [];
  for (const f of planFiles) {
    out.push(await readIfExists(join(phaseDir, f)));
  }
  return out;
}

async function loadGateConfig(projectDir: string): Promise<boolean> {
  try {
    const cfg = await loadConfig(projectDir);
    const wf = (cfg.workflow ?? {}) as unknown as Record<string, unknown>;
    const v = wf.context_coverage_gate;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.toLowerCase() !== 'false';
    return true; // default ON
  } catch {
    return true;
  }
}

function resolvePath(p: string, projectDir: string): string {
  return isAbsolute(p) ? p : join(projectDir, p);
}

function buildPlanMessage(uncovered: GateUncoveredItem[]): string {
  if (uncovered.length === 0) return 'All trackable CONTEXT.md decisions are covered by plans.';
  const lines = [
    `## ⚠ Decision Coverage Gap`,
    ``,
    `${uncovered.length} CONTEXT.md decision(s) are not covered by any plan:`,
    ``,
  ];
  for (const u of uncovered) {
    lines.push(`- **${u.id}** (${u.category || 'uncategorized'}): ${u.text}`);
  }
  lines.push('');
  lines.push(
    'Resolve by citing `D-NN:` in a relevant plan\'s `must_haves`/`truths` (or body),',
  );
  lines.push(
    'OR move the decision to `### Claude\'s Discretion` / tag it `[informational]` if it should not be tracked.',
  );
  return lines.join('\n');
}

function buildVerifyMessage(notHonored: GateUncoveredItem[]): string {
  if (notHonored.length === 0)
    return 'All trackable CONTEXT.md decisions are honored by shipped artifacts.';
  const lines = [
    `### Decision Coverage (warning)`,
    ``,
    `${notHonored.length} decision(s) not found in shipped artifacts:`,
    ``,
  ];
  for (const u of notHonored) {
    lines.push(`- **${u.id}** (${u.category || 'uncategorized'}): ${u.text}`);
  }
  lines.push('');
  lines.push('This is a soft warning — verification status is unchanged.');
  return lines.join('\n');
}

// ─── Plan-phase gate ──────────────────────────────────────────────────────

export const checkDecisionCoveragePlan: QueryHandler = async (args, projectDir) => {
  const phaseDir = args[0] ? resolvePath(args[0], projectDir) : '';
  const contextPath = args[1] ? resolvePath(args[1], projectDir) : '';

  const enabled = await loadGateConfig(projectDir);
  if (!enabled) {
    const data: PlanGateData = {
      passed: true,
      skipped: true,
      reason: 'workflow.context_coverage_gate is false',
      total: 0,
      covered: 0,
      uncovered: [],
      message: 'Decision coverage gate disabled by config.',
    };
    return { data: data as unknown as Record<string, unknown> };
  }

  if (!contextPath || !existsSync(contextPath)) {
    const data: PlanGateData = {
      passed: true,
      skipped: true,
      reason: 'CONTEXT.md missing',
      total: 0,
      covered: 0,
      uncovered: [],
      message: 'No CONTEXT.md — nothing to check.',
    };
    return { data: data as unknown as Record<string, unknown> };
  }

  const contextRaw = await readIfExists(contextPath);
  const decisions = parseDecisions(contextRaw).filter((d) => d.trackable);
  if (decisions.length === 0) {
    const data: PlanGateData = {
      passed: true,
      skipped: true,
      reason: 'no trackable decisions',
      total: 0,
      covered: 0,
      uncovered: [],
      message: 'No trackable decisions in CONTEXT.md.',
    };
    return { data: data as unknown as Record<string, unknown> };
  }

  const planContents = await loadPlanContents(phaseDir);
  const planHaystack = planContents.join('\n\n');

  const uncovered: GateUncoveredItem[] = [];
  let covered = 0;
  for (const d of decisions) {
    if (decisionMentioned(planHaystack, d)) {
      covered++;
    } else {
      uncovered.push({ id: d.id, text: d.text, category: d.category });
    }
  }

  const passed = uncovered.length === 0;
  const data: PlanGateData = {
    passed,
    skipped: false,
    total: decisions.length,
    covered,
    uncovered,
    message: buildPlanMessage(uncovered),
  };
  return { data: data as unknown as Record<string, unknown> };
};

// ─── Verify-phase gate ────────────────────────────────────────────────────

async function recentCommitMessages(projectDir: string, limit = 50): Promise<string> {
  try {
    const { stdout } = await execFile('git', ['log', `-n`, String(limit), '--pretty=%s%n%b'], {
      cwd: projectDir,
      maxBuffer: 4 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return '';
  }
}

async function readModifiedFilesContent(projectDir: string, summary: string): Promise<string> {
  // Find a `files_modified:` YAML or markdown list and read each.
  const out: string[] = [];
  const fmMatch = summary.match(/files_modified:\s*\n((?:\s*-\s+.+\n?)+)/);
  const block = fmMatch ? fmMatch[1] : '';
  const files = [...block.matchAll(/-\s+(.+)/g)].map((m) => m[1].trim().replace(/^["']|["']$/g, ''));
  for (const f of files.slice(0, 50)) {
    if (!f) continue;
    out.push(await readIfExists(resolvePath(f, projectDir)));
  }
  return out.join('\n\n');
}

export const checkDecisionCoverageVerify: QueryHandler = async (args, projectDir) => {
  const phaseDir = args[0] ? resolvePath(args[0], projectDir) : '';
  const contextPath = args[1] ? resolvePath(args[1], projectDir) : '';

  const enabled = await loadGateConfig(projectDir);
  if (!enabled) {
    const data: VerifyGateData = {
      skipped: true,
      blocking: false,
      reason: 'workflow.context_coverage_gate is false',
      total: 0,
      honored: 0,
      not_honored: [],
      message: 'Decision coverage gate disabled by config.',
    };
    return { data: data as unknown as Record<string, unknown> };
  }

  if (!contextPath || !existsSync(contextPath)) {
    const data: VerifyGateData = {
      skipped: true,
      blocking: false,
      reason: 'CONTEXT.md missing',
      total: 0,
      honored: 0,
      not_honored: [],
      message: 'No CONTEXT.md — nothing to check.',
    };
    return { data: data as unknown as Record<string, unknown> };
  }

  const contextRaw = await readIfExists(contextPath);
  const decisions = parseDecisions(contextRaw).filter((d) => d.trackable);
  if (decisions.length === 0) {
    const data: VerifyGateData = {
      skipped: true,
      blocking: false,
      reason: 'no trackable decisions',
      total: 0,
      honored: 0,
      not_honored: [],
      message: 'No trackable decisions in CONTEXT.md.',
    };
    return { data: data as unknown as Record<string, unknown> };
  }

  const planContents = await loadPlanContents(phaseDir);
  // Read all *-SUMMARY.md files in phaseDir
  let summaryContent = '';
  if (existsSync(phaseDir)) {
    try {
      const entries = await readdir(phaseDir);
      for (const e of entries.filter((x) => /-SUMMARY\.md$/.test(x))) {
        summaryContent += '\n\n' + (await readIfExists(join(phaseDir, e)));
      }
    } catch {
      /* ignore */
    }
  }

  const filesModifiedContent = await readModifiedFilesContent(projectDir, summaryContent);
  const commits = await recentCommitMessages(projectDir);

  const haystack = [planContents.join('\n\n'), summaryContent, filesModifiedContent, commits].join(
    '\n\n',
  );

  const notHonored: GateUncoveredItem[] = [];
  let honored = 0;
  for (const d of decisions) {
    if (decisionMentioned(haystack, d)) {
      honored++;
    } else {
      notHonored.push({ id: d.id, text: d.text, category: d.category });
    }
  }

  const data: VerifyGateData = {
    skipped: false,
    blocking: false,
    total: decisions.length,
    honored,
    not_honored: notHonored,
    message: buildVerifyMessage(notHonored),
  };
  return { data: data as unknown as Record<string, unknown> };
};
