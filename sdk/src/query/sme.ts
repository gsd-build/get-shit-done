/**
 * SME (Subject Matter Expert) query handlers.
 *
 * Provides three QueryHandler functions that form the data access layer
 * for the SME agent framework:
 *
 * - `smeList`           — Lists all SME documents with frontmatter metadata (SDK-01)
 * - `smeDetectProcesses` — Detects which SME processes a phase touches (SDK-02)
 * - `smeContextBlock`   — Produces an XML context block for agent prompt injection (SDK-03)
 *
 * All handlers respect the `workflow.use_sme_agents` feature flag.
 * Path construction uses only `planningPaths().planning` + filenames returned by
 * `readdir` — never user-supplied path segments (T-02-01 mitigation).
 *
 * @example
 * ```typescript
 * import { smeList, smeDetectProcesses, smeContextBlock } from './sme.js';
 *
 * const list = await smeList([], '/project');
 * // { data: { enabled: true, smes: [{ file, process_name, block_mode, ... }] } }
 *
 * const detect = await smeDetectProcesses(
 *   ['--file-paths', 'src/payments/charge.ts', '--goal', 'update payment flow'],
 *   '/project',
 * );
 * // { data: { enabled: true, matches: [{ file, process_name, block_mode, match_source }] } }
 *
 * const ctx = await smeContextBlock(['payments'], '/project');
 * // { data: { found: true, process: 'payments', block: '<sme_context ...>...</sme_context>' } }
 * ```
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter } from './frontmatter.js';
import { planningPaths } from './helpers.js';
import { loadConfig } from '../config.js';
import type { QueryHandler } from './utils.js';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Parse --file-paths and --goal arguments from an args array.
 *
 * `--file-paths` collects all values until the next flag or end of args.
 * `--goal` takes the single next value.
 */
function parseDetectArgs(args: string[]): { filePaths: string[]; goal: string } {
  const filePaths: string[] = [];
  let goal = '';
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--file-paths') {
      i++;
      while (i < args.length && !args[i]!.startsWith('--')) {
        filePaths.push(args[i]!);
        i++;
      }
    } else if (args[i] === '--goal') {
      i++;
      if (i < args.length) {
        goal = args[i]!;
        i++;
      }
    } else {
      i++;
    }
  }
  return { filePaths, goal };
}

/** Filename suffix that all SME documents must end with. */
const SME_SUFFIX = '-SME.md';

// ─── smeList (SDK-01) ─────────────────────────────────────────────────────────

/**
 * List all SME documents from `.planning/smes/` with their frontmatter metadata.
 *
 * Returns `{ enabled: false, smes: [] }` when:
 * - `workflow.use_sme_agents` is false
 * - `config.json` does not exist or throws on load
 *
 * Returns `{ enabled: true, smes: [] }` when:
 * - The smes directory does not exist
 * - The smes directory is empty
 *
 * Uses null-coalescing on all frontmatter fields (T-02-03 mitigation).
 */
export const smeList: QueryHandler = async (args, projectDir, workstream) => {
  // Config guard — return disabled if config missing or flag is off
  let config: Awaited<ReturnType<typeof loadConfig>>;
  try {
    config = await loadConfig(projectDir, workstream);
  } catch {
    return { data: { enabled: false, smes: [] } };
  }

  if (!config.workflow.use_sme_agents) {
    return { data: { enabled: false, smes: [] } };
  }

  const smesDir = join(planningPaths(projectDir, workstream).planning, 'smes');

  // List smes directory — return empty on any error (missing dir, permissions, etc.)
  let files: string[];
  try {
    files = await readdir(smesDir);
  } catch {
    return { data: { enabled: true, smes: [] } };
  }

  // Filter to *-SME.md files and sort alphabetically
  const smeFiles = files.filter(f => f.endsWith(SME_SUFFIX)).sort();

  const smes: Array<Record<string, unknown>> = [];
  for (const file of smeFiles) {
    // Only compose with filenames returned by readdir — no user-supplied segments (T-02-01)
    const filePath = join(smesDir, file);
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    // Null-coalesce all frontmatter fields to guard against malformed docs (T-02-03)
    const fm = extractFrontmatter(content) as Record<string, unknown>;

    // finding_counts is a nested object; extractFrontmatter returns its values as
    // strings — coerce each count field to a number for consistent API output.
    const rawCounts = (fm['finding_counts'] as Record<string, unknown>) ?? {};
    const findingCounts = {
      blocker: Number(rawCounts['blocker'] ?? 0),
      warning: Number(rawCounts['warning'] ?? 0),
      watch: Number(rawCounts['watch'] ?? 0),
    };

    smes.push({
      file,
      process_name: fm['process_name'] ?? null,
      block_mode: fm['block_mode'] ?? 'soft',
      last_analyzed_commit: fm['last_analyzed_commit'] ?? null,
      finding_counts: findingCounts,
    });
  }

  return { data: { enabled: true, smes } };
};

// ─── smeDetectProcesses (SDK-02) ──────────────────────────────────────────────

/**
 * Detect which SME processes a phase touches based on file paths and goal keywords.
 *
 * Args: `--file-paths <path>... --goal <text>`
 *
 * Matching is case-insensitive substring: `process_name` in a file path or goal string.
 * Deduplicates: one match per process, with `match_source` set to `'file-path'`,
 * `'keyword'`, or `'both'`.
 */
export const smeDetectProcesses: QueryHandler = async (args, projectDir, workstream) => {
  // Config guard
  let config: Awaited<ReturnType<typeof loadConfig>>;
  try {
    config = await loadConfig(projectDir, workstream);
  } catch {
    return { data: { enabled: false, matches: [] } };
  }

  if (!config.workflow.use_sme_agents) {
    return { data: { enabled: false, matches: [] } };
  }

  const smesDir = join(planningPaths(projectDir, workstream).planning, 'smes');

  let files: string[];
  try {
    files = await readdir(smesDir);
  } catch {
    return { data: { enabled: true, matches: [] } };
  }

  const smeFiles = files.filter(f => f.endsWith(SME_SUFFIX)).sort();
  const { filePaths, goal } = parseDetectArgs(args);

  const matches: Array<Record<string, unknown>> = [];

  for (const file of smeFiles) {
    const filePath = join(smesDir, file);
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    const fm = extractFrontmatter(content) as Record<string, unknown>;
    const processName = typeof fm['process_name'] === 'string' ? fm['process_name'] : null;
    if (!processName) continue;

    const processNameLower = processName.toLowerCase();

    // Check file path matches (case-insensitive)
    const filePathMatch = filePaths.some(fp => fp.toLowerCase().includes(processNameLower));

    // Check goal keyword match (case-insensitive)
    const keywordMatch = goal.toLowerCase().includes(processNameLower);

    if (!filePathMatch && !keywordMatch) continue;

    // Determine match_source — one entry per process (no duplicates)
    let matchSource: string;
    if (filePathMatch && keywordMatch) {
      matchSource = 'both';
    } else if (filePathMatch) {
      matchSource = 'file-path';
    } else {
      matchSource = 'keyword';
    }

    matches.push({
      file,
      process_name: processName,
      block_mode: fm['block_mode'] ?? 'soft',
      match_source: matchSource,
    });
  }

  return { data: { enabled: true, matches } };
};

// ─── smeContextBlock (SDK-03) ─────────────────────────────────────────────────

/**
 * Produce an XML context block wrapping an SME document's full content.
 *
 * Args: `<process_name>` (positional, required)
 *
 * Returns `{ found: true, process, block: '<sme_context ...>...</sme_context>' }`
 * when the SME document exists, `{ found: false, process, block: '' }` when not found.
 *
 * The full file content (frontmatter + body) is included in the block — downstream
 * agents parse what they need. The XML attributes `process` and `block_mode` come
 * from the frontmatter. T-02-02: no escaping needed; SME docs are author-created
 * project files at same trust level as PLAN.md.
 *
 * @throws GSDError(Validation) when args[0] is missing
 */
export const smeContextBlock: QueryHandler = async (args, projectDir, workstream) => {
  // Config guard
  let config: Awaited<ReturnType<typeof loadConfig>>;
  try {
    config = await loadConfig(projectDir, workstream);
  } catch {
    return { data: { enabled: false, found: false, process: args[0] ?? '', block: '' } };
  }

  if (!config.workflow.use_sme_agents) {
    return { data: { enabled: false, found: false, process: args[0] ?? '', block: '' } };
  }

  // Validate required process name arg
  const processName = args[0];
  if (!processName) {
    throw new GSDError('process name required', ErrorClassification.Validation);
  }

  const smesDir = join(planningPaths(projectDir, workstream).planning, 'smes');

  let files: string[];
  try {
    files = await readdir(smesDir);
  } catch {
    return { data: { found: false, process: processName, block: '' } };
  }

  // Find SME file whose name matches `{processName}-SME.md` (case-insensitive).
  // Both sides lowercased so suffix '-SME.md' matches '-sme.md' in the comparison.
  const targetSuffix = SME_SUFFIX.toLowerCase();
  const targetFile = files.find(
    f => f.toLowerCase() === `${processName.toLowerCase()}${targetSuffix}`,
  );

  if (!targetFile) {
    return { data: { found: false, process: processName, block: '' } };
  }

  // Only compose with filename returned by readdir (T-02-01)
  const filePath = join(smesDir, targetFile);
  const content = await readFile(filePath, 'utf-8');
  const fm = extractFrontmatter(content) as Record<string, unknown>;

  // Build XML context block — full file content included for agent consumption
  const block = `<sme_context process="${fm['process_name'] ?? processName}" block_mode="${fm['block_mode'] ?? 'soft'}">\n${content}\n</sme_context>`;

  return { data: { found: true, process: processName, block } };
};
