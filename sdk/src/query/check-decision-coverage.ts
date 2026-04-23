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

/** Minimum normalized words a decision must have to be soft-matchable. */
const SOFT_PHRASE_MIN_WORDS = 6;

/**
 * Build a soft-match phrase: the first 6 normalized words. Six is empirically
 * long enough to avoid collisions with common English fragments and short
 * enough to survive minor rewordings.
 *
 * Returns an empty string when the decision text has fewer than
 * SOFT_PHRASE_MIN_WORDS words — such decisions are effectively id-only and
 * callers must rely on a `D-NN` citation (review F5).
 */
function softPhrase(text: string): string {
  const words = normalizePhrase(text).split(' ').filter(Boolean);
  if (words.length < SOFT_PHRASE_MIN_WORDS) return '';
  return words.slice(0, SOFT_PHRASE_MIN_WORDS).join(' ');
}

/** True when a decision is too short to soft-match — caller must cite by id. */
function requiresIdCitation(decision: ParsedDecision): boolean {
  const wordCount = normalizePhrase(decision.text).split(' ').filter(Boolean).length;
  return wordCount < SOFT_PHRASE_MIN_WORDS;
}

/** True when decision text or id appears in `haystack`. */
function decisionMentioned(haystack: string, decision: ParsedDecision): boolean {
  if (!haystack) return false;
  const idRe = new RegExp(`\\b${decision.id}\\b`);
  if (idRe.test(haystack)) return true;
  const phrase = softPhrase(decision.text);
  if (!phrase) return false; // too short to soft-match — id citation required
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

/**
 * One plan reduced to the sections the BLOCKING translation gate searches.
 *
 * The plan-phase gate refuses to honor a decision mention buried in a code
 * fence, an HTML comment, or arbitrary prose elsewhere on the page. The user
 * must put a `D-NN` citation (or a 6+-word phrase) in a designated section
 * so they have an unambiguous way to make a decision deliberately uncovered.
 *
 * Designated sections (review F4):
 *   - Front-matter `must_haves` block (YAML)
 *   - Front-matter `truths` block (YAML)
 *   - Front-matter `objective` field
 *   - Body section under a heading whose text contains "must_haves",
 *     "truths", "tasks", or "objective" (case-insensitive)
 *
 * HTML comments (`<!-- ... -->`) and fenced code blocks are stripped before
 * extraction so neither a commented-out citation nor a literal example
 * counts as coverage.
 */
interface PlanSections {
  /** Concatenation of all designated section text, with HTML comments and code fences stripped. */
  designated: string;
}

const DESIGNATED_HEADINGS_RE = /^#{1,6}\s+(?:must[_ ]haves?|truths?|tasks?|objective)\b/i;

/** Strip HTML comments AND fenced code blocks from `text`. */
function stripCommentsAndFences(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ');
}

/** Extract a YAML block scalar (key followed by indented continuation lines). */
function extractYamlBlock(frontmatter: string, key: string): string {
  const re = new RegExp(`^${key}\\s*:(.*)$`, 'm');
  const match = frontmatter.match(re);
  if (!match) return '';
  const startIdx = (match.index ?? 0) + match[0].length;
  const sameLine = match[1] ?? '';
  const rest = frontmatter.slice(startIdx + 1).split(/\r?\n/);
  const block: string[] = [sameLine];
  for (const line of rest) {
    // Stop at a non-indented, non-empty line (next top-level key) or end of frontmatter.
    if (line === '' || /^\s/.test(line)) {
      block.push(line);
    } else {
      break;
    }
  }
  return block.join('\n');
}

function extractPlanSections(planContent: string): PlanSections {
  if (!planContent) return { designated: '' };
  const cleaned = stripCommentsAndFences(planContent);

  // Split front-matter from body.
  const fmMatch = cleaned.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const frontmatter = fmMatch ? fmMatch[1] : '';
  const body = fmMatch ? fmMatch[2] : cleaned;

  const fmParts: string[] = [];
  for (const key of ['must_haves', 'truths', 'objective']) {
    const block = extractYamlBlock(frontmatter, key);
    if (block) fmParts.push(block);
  }

  // Body sections under designated headings (must_haves, truths, tasks, objective).
  const bodyLines = body.split(/\r?\n/);
  const bodyParts: string[] = [];
  let inDesignated = false;
  for (const line of bodyLines) {
    const heading = /^#{1,6}\s+/.test(line);
    if (heading) {
      inDesignated = DESIGNATED_HEADINGS_RE.test(line);
      if (inDesignated) bodyParts.push(line);
      continue;
    }
    if (inDesignated) bodyParts.push(line);
  }

  return { designated: [...fmParts, bodyParts.join('\n')].join('\n\n') };
}

async function loadPlanSections(phaseDir: string): Promise<PlanSections[]> {
  const contents = await loadPlanContents(phaseDir);
  return contents.map(extractPlanSections);
}

/** True when a decision is mentioned in any plan's designated sections. */
function planSectionsMention(planSections: PlanSections[], decision: ParsedDecision): boolean {
  for (const p of planSections) {
    if (decisionMentioned(p.designated, decision)) return true;
  }
  return false;
}

async function loadGateConfig(projectDir: string, workstream?: string): Promise<boolean> {
  try {
    const cfg = await loadConfig(projectDir, workstream);
    const wf = (cfg.workflow ?? {}) as unknown as Record<string, unknown>;
    const v = wf.context_coverage_gate;
    if (typeof v === 'boolean') return v;
    // Tolerate stringified booleans coming from environment-variable-style configs,
    // but warn loudly on numeric / other-shaped values so silent type drift surfaces.
    // Schema-vs-loadConfig validation gap (review F16, mirror of #2609).
    if (typeof v === 'string') {
      const lower = v.toLowerCase();
      if (lower === 'false' || lower === 'true') return lower !== 'false';
      console.warn(
        `[gsd] workflow.context_coverage_gate is a string "${v}" — expected boolean. Defaulting to ON.`,
      );
      return true;
    }
    if (v !== undefined && v !== null) {
      console.warn(
        `[gsd] workflow.context_coverage_gate has invalid type ${typeof v} (value: ${JSON.stringify(v)}); expected boolean. Defaulting to ON.`,
      );
    }
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

export const checkDecisionCoveragePlan: QueryHandler = async (args, projectDir, workstream) => {
  const phaseDir = args[0] ? resolvePath(args[0], projectDir) : '';
  const contextPath = args[1] ? resolvePath(args[1], projectDir) : '';

  const enabled = await loadGateConfig(projectDir, workstream);
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
    return { data };
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
    return { data };
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
    return { data };
  }

  const planSections = await loadPlanSections(phaseDir);

  const uncovered: GateUncoveredItem[] = [];
  let covered = 0;
  for (const d of decisions) {
    if (planSectionsMention(planSections, d)) {
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
  return { data };
};

// ─── Verify-phase gate ────────────────────────────────────────────────────

/**
 * Recent commit subjects + bodies, capped at 200 to span typical phase boundaries
 * even on busy repos. The non-blocking verify gate trades precision for recall —
 * a few extra commits in the haystack only inflate "honored" counts harmlessly,
 * while too few commits could cause false misses on long-running phases (review F18).
 */
async function recentCommitMessages(projectDir: string, limit = 200): Promise<string> {
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

/** Per-file size cap when slurping modified-file contents into the verify haystack. */
const MAX_MODIFIED_FILE_BYTES = 256 * 1024;

/** Read a file and truncate to MAX_MODIFIED_FILE_BYTES; returns '' on error. */
async function readBoundedFile(absPath: string): Promise<string> {
  try {
    const raw = await readFile(absPath, 'utf-8');
    return raw.length > MAX_MODIFIED_FILE_BYTES ? raw.slice(0, MAX_MODIFIED_FILE_BYTES) : raw;
  } catch {
    return '';
  }
}

/**
 * True when `candidatePath` (after resolution) is contained within `rootDir`.
 * Rejects absolute paths outside the root, `..` traversal, and any input
 * whose canonical form escapes the project boundary (review F7).
 *
 * Note: this is a lexical check. Symlink targets are NOT resolved here — we
 * intentionally do not follow links, so a symlink inside the project pointing
 * outside is not de-referenced (we read the link's target only if it resolves
 * within projectDir). For full symlink hardening callers should run on a
 * trusted SUMMARY.md.
 */
function isInsideRoot(candidatePath: string, rootDir: string): boolean {
  const root = isAbsolute(rootDir) ? rootDir : join(process.cwd(), rootDir);
  const target = isAbsolute(candidatePath) ? candidatePath : join(root, candidatePath);
  // Normalize both via path.resolve-equivalent (join handles `..`).
  const normalizedRoot = root.endsWith('/') ? root : root + '/';
  const normalizedTarget = target;
  return normalizedTarget === root || normalizedTarget.startsWith(normalizedRoot);
}

async function readModifiedFilesContent(projectDir: string, summaries: string[]): Promise<string> {
  // Walk EVERY summary independently and aggregate file paths. The previous
  // implementation matched only the first `files_modified:` block in a
  // concatenated string — when two summaries shipped in one phase the second
  // plan's files were silently dropped (review F6).
  const out: string[] = [];
  let total = 0;
  for (const summary of summaries) {
    if (!summary) continue;
    // /g so multiple `files_modified:` blocks in a single summary are also captured.
    const blockMatches = summary.matchAll(/files_modified:\s*\n((?:[ \t]*-\s+.+\n?)+)/g);
    for (const blockMatch of blockMatches) {
      const block = blockMatch[1] ?? '';
      const files = [...block.matchAll(/-\s+(.+)/g)].map((m) =>
        m[1].trim().replace(/^["']|["']$/g, ''),
      );
      for (const f of files) {
        if (!f) continue;
        if (total >= 50) break; // cap total files across all summaries
        // Reject absolute paths AND any relative path that escapes projectDir.
        if (!isInsideRoot(f, projectDir)) {
          console.warn(
            `[gsd] decision-coverage: skipping files_modified entry "${f}" — outside project root`,
          );
          continue;
        }
        out.push(await readBoundedFile(resolvePath(f, projectDir)));
        total++;
      }
      if (total >= 50) break;
    }
    if (total >= 50) break;
  }
  return out.join('\n\n');
}

export const checkDecisionCoverageVerify: QueryHandler = async (args, projectDir, workstream) => {
  const phaseDir = args[0] ? resolvePath(args[0], projectDir) : '';
  const contextPath = args[1] ? resolvePath(args[1], projectDir) : '';

  const enabled = await loadGateConfig(projectDir, workstream);
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
    return { data };
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
    return { data };
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
    return { data };
  }

  // Verify-phase haystack is intentionally broad — this gate is non-blocking and looks
  // for honored decisions across all phase artifacts, not just plan front-matter sections.
  const planContents = await loadPlanContents(phaseDir);
  // Read all *-SUMMARY.md files in phaseDir, capped to keep the haystack bounded.
  const summaryParts: string[] = [];
  let summaryContent = '';
  if (existsSync(phaseDir)) {
    try {
      const entries = await readdir(phaseDir);
      for (const e of entries.filter((x) => /-SUMMARY\.md$/.test(x))) {
        summaryParts.push(await readIfExists(join(phaseDir, e)));
      }
    } catch {
      /* ignore */
    }
  }
  summaryContent = summaryParts.join('\n\n');

  const filesModifiedContent = await readModifiedFilesContent(projectDir, summaryParts);
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
  return { data };
};
