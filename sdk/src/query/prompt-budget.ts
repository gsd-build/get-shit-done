'use strict';

/**
 * prompt-budget — SDK handler for applying a token budget to review prompts.
 *
 * Port of get-shit-done/bin/lib/prompt-budget.cjs + the `case 'prompt-budget':`
 * block in get-shit-done/bin/gsd-tools.cjs.
 *
 * CLI call surface (via `gsd-sdk query prompt-budget`):
 *   --budget <N>                   Token budget (required, positive integer)
 *   --instructions-file <path>     Path to instructions file (required)
 *   --roadmap-file <path>          Path to roadmap file (required)
 *   --plan-file <path>             Path to a plan file (required, repeatable)
 *   --output-prompt <path>         Path to write the trimmed prompt (required)
 *   --output-metadata <path>       Path to write the JSON metadata (required)
 *   --project-file <path>          Optional PROJECT.md file
 *   --context-file <path>          Optional context file
 *   --research-file <path>         Optional research file
 *   --requirements-file <path>     Optional requirements file
 *   --safety-margin-pct <N>        Safety margin % (default 10)
 *   --project-md-head-lines <N>    Max lines from PROJECT.md (default 40)
 *
 * Exit codes (propagated through dispatch error):
 *   0  success (trim or no-trim)
 *   1  invocation error (missing required arg, missing file, invalid budget)
 *   2  hardFailed: prompt cannot fit effective budget after trim policy
 */

import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import type { QueryHandler } from './utils.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const NOTE_RESERVE_TOKENS = 80;

const DEFAULT_NOTE_TEMPLATE = [
  '<note>',
  'Prompt automatically trimmed to fit a {budget}-token budget.',
  'Omitted sections: {omittedList}.',
  'Plan content truncated by approximately {planTruncationPct}%.',
  'Treat any missing context as out-of-scope rather than a review concern.',
  '</note>',
].join('\n');

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function renderNote(
  template: string,
  budget: number,
  omitted: string[],
  planTruncationPct: number,
): string {
  const omittedList = omitted.length > 0 ? omitted.join(', ') : 'none';
  return template
    .replace('{budget}', String(budget))
    .replace('{omittedList}', omittedList)
    .replace('{planTruncationPct}', String(Math.round(planTruncationPct)));
}

function headShrink(text: string, maxLines: number): string {
  if (maxLines <= 0) return '';
  let idx = -1;
  let seen = 0;
  while (seen < maxLines) {
    idx = text.indexOf('\n', idx + 1);
    if (idx === -1) return text;
    seen += 1;
  }
  return text.slice(0, idx);
}

function tailTruncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

interface PlanEntry {
  file: string;
  content: string;
}

interface BudgetSections {
  instructions: string;
  roadmap: string;
  plans: PlanEntry[];
  projectMd: string | null;
  context: string | null;
  research: string | null;
  requirements: string | null;
}

interface BudgetOptions {
  safetyMarginPct?: number;
  noteTemplate?: string;
  projectMdHeadLines?: number;
}

interface BudgetMetadata {
  budget: number;
  effectiveBudget: number;
  estimatedTokens: number;
  omitted: string[];
  projectMdShrunk: boolean;
  planTruncationPct: number;
  hardFailed: boolean;
  noteInjected: boolean;
}

interface BudgetResult {
  prompt: string;
  metadata: BudgetMetadata;
}

function assemblePrompt(parts: {
  instructions: string;
  note: string | null;
  roadmap: string;
  projectMd: string | null;
  plans: PlanEntry[];
  context: string | null;
  research: string | null;
  requirements: string | null;
}): string {
  const blocks: string[] = [];

  blocks.push(parts.instructions);

  if (parts.note) blocks.push(parts.note);

  blocks.push('## Roadmap\n\n' + parts.roadmap);

  if (parts.projectMd) blocks.push('## Project\n\n' + parts.projectMd);

  const planBlocks = parts.plans
    .map((p) => '### ' + p.file + '\n\n' + p.content)
    .join('\n\n');
  blocks.push('## Plans\n\n' + planBlocks);

  if (parts.context) blocks.push('## Context\n\n' + parts.context);
  if (parts.research) blocks.push('## Research\n\n' + parts.research);
  if (parts.requirements) blocks.push('## Requirements\n\n' + parts.requirements);

  return blocks.join('\n\n');
}

function applyBudget({
  sections,
  budget,
  options = {},
}: {
  sections: BudgetSections;
  budget: number;
  options?: BudgetOptions;
}): BudgetResult {
  const {
    safetyMarginPct = 10,
    noteTemplate = DEFAULT_NOTE_TEMPLATE,
    projectMdHeadLines = 40,
  } = options;

  const effectiveBudget = Math.floor(budget * (1 - safetyMarginPct / 100));

  const {
    instructions,
    roadmap,
    plans,
    projectMd: projectMdRaw = null,
    context: contextRaw = null,
    research: researchRaw = null,
    requirements: requirementsRaw = null,
  } = sections;

  let projectMd = projectMdRaw;
  let context = contextRaw;
  let research = researchRaw;
  let requirements = requirementsRaw;
  let workingPlans: PlanEntry[] = plans.map((p) => ({ file: p.file, content: p.content }));

  const omitted: string[] = [];
  let projectMdShrunk = false;
  let planTruncationPct = 0;
  let noteInjected = false;
  let hardFailed = false;

  // Minimum-set check: instructions + roadmap + 1KB per plan.
  // NOTE_RESERVE_TOKENS is intentionally excluded here: a note is only injected
  // when trimming actually occurs, and a prompt that fits without any trim needs
  // no note at all. Including NOTE_RESERVE_TOKENS here would cause false hard-fails
  // for prompts that genuinely fit the effective budget untrimmed.
  const MIN_PLAN_BYTES = 1024;
  const minPlanTokens = plans.reduce((sum, p) => {
    return sum + estimateTokens(p.content.slice(0, MIN_PLAN_BYTES));
  }, 0);
  const minSet =
    estimateTokens(instructions) +
    estimateTokens(roadmap) +
    minPlanTokens;

  if (minSet > effectiveBudget) {
    return {
      prompt: '',
      metadata: {
        budget,
        effectiveBudget,
        estimatedTokens: 0,
        omitted: [],
        projectMdShrunk: false,
        planTruncationPct: 0,
        hardFailed: true,
        noteInjected: false,
      },
    };
  }

  const TOKENS_ROADMAP_HEADER = estimateTokens('## Roadmap\n\n');
  const TOKENS_PROJECT_HEADER = estimateTokens('## Project\n\n');
  const TOKENS_PLANS_HEADER = estimateTokens('## Plans\n\n');
  const TOKENS_CONTEXT_HEADER = estimateTokens('## Context\n\n');
  const TOKENS_RESEARCH_HEADER = estimateTokens('## Research\n\n');
  const TOKENS_REQUIREMENTS_HEADER = estimateTokens('## Requirements\n\n');
  const TOKENS_PLAN_ITEM_HEADERS = workingPlans.reduce(
    (sum, p) => sum + estimateTokens('### ' + p.file + '\n\n'),
    0,
  );

  const staticBaseTokens =
    estimateTokens(instructions) +
    TOKENS_ROADMAP_HEADER +
    estimateTokens(roadmap) +
    TOKENS_PLANS_HEADER +
    TOKENS_PLAN_ITEM_HEADERS;

  let projectTokens = projectMd ? TOKENS_PROJECT_HEADER + estimateTokens(projectMd) : 0;
  let contextTokens = context ? TOKENS_CONTEXT_HEADER + estimateTokens(context) : 0;
  let researchTokens = research ? TOKENS_RESEARCH_HEADER + estimateTokens(research) : 0;
  let requirementsTokens = requirements ? TOKENS_REQUIREMENTS_HEADER + estimateTokens(requirements) : 0;
  let planContentTokens = workingPlans.reduce((sum, p) => sum + estimateTokens(p.content), 0);

  const getCurrentBaseTokens = (): number =>
    staticBaseTokens +
    projectTokens +
    planContentTokens +
    contextTokens +
    researchTokens +
    requirementsTokens;

  let currentBaseTokens = getCurrentBaseTokens();

  // Detect budget pressure: is ANY trim needed?
  // Pressure exists when the current base tokens already exceed the effective
  // budget. Only when pressure is real do we reserve NOTE_RESERVE_TOKENS so
  // the note itself fits after trimming. Checking against
  // effectiveBudget - NOTE_RESERVE_TOKENS (the old threshold) would cause
  // spurious pressure 80 tokens early, dropping sections that fit fine.
  const baseTokens = currentBaseTokens;
  const budgetUnderPressure = baseTokens > effectiveBudget;
  let contentBudget = budgetUnderPressure ? effectiveBudget - NOTE_RESERVE_TOKENS : effectiveBudget;

  // Trim step 1: head-shrink PROJECT.md
  if (currentBaseTokens > contentBudget && projectMd) {
    const shrunk = headShrink(projectMd, projectMdHeadLines);
    if (shrunk !== projectMd) {
      projectMd = shrunk;
      projectMdShrunk = true;
      projectTokens = TOKENS_PROJECT_HEADER + estimateTokens(projectMd);
      currentBaseTokens = getCurrentBaseTokens();
    }
  }

  // Trim step 2: proportional plan truncation
  if (currentBaseTokens > contentBudget) {
    const overhead =
      staticBaseTokens +
      projectTokens +
      contextTokens +
      researchTokens +
      requirementsTokens;

    const planBudgetTokens = contentBudget - overhead;
    const totalPlanTokens = planContentTokens;

    if (planBudgetTokens > 0 && planBudgetTokens < totalPlanTokens) {
      const totalOriginalChars = plans.reduce((sum, p) => sum + p.content.length, 0);

      workingPlans = workingPlans.map((p) => {
        const proportionalShare =
          totalOriginalChars > 0
            ? Math.floor((p.content.length / totalOriginalChars) * (planBudgetTokens * 4))
            : 0;
        const maxChars = Math.max(proportionalShare, MIN_PLAN_BYTES);
        return { file: p.file, content: tailTruncate(p.content, maxChars) };
      });

      const newTotalChars = workingPlans.reduce((sum, p) => sum + p.content.length, 0);
      if (totalOriginalChars > 0) {
        planTruncationPct = ((totalOriginalChars - newTotalChars) / totalOriginalChars) * 100;
      }
      planContentTokens = workingPlans.reduce((sum, p) => sum + estimateTokens(p.content), 0);
      currentBaseTokens = getCurrentBaseTokens();
    }
  }

  // Trim step 3: drop context
  if (currentBaseTokens > contentBudget && context) {
    context = null;
    omitted.push('context');
    contextTokens = 0;
    currentBaseTokens = getCurrentBaseTokens();
  }

  // Trim step 4: drop research
  if (currentBaseTokens > contentBudget && research) {
    research = null;
    omitted.push('research');
    researchTokens = 0;
    currentBaseTokens = getCurrentBaseTokens();
  }

  // Trim step 5: drop requirements (last resort)
  if (currentBaseTokens > contentBudget && requirements) {
    requirements = null;
    omitted.push('requirements');
    requirementsTokens = 0;
    currentBaseTokens = getCurrentBaseTokens();
  }

  const anyTrimOccurred = omitted.length > 0 || projectMdShrunk || planTruncationPct > 0;

  let note: string | null = null;
  if (anyTrimOccurred) {
    note = renderNote(noteTemplate, budget, omitted, planTruncationPct);
    noteInjected = true;
  }

  const prompt = assemblePrompt({
    instructions,
    note,
    roadmap,
    projectMd,
    plans: workingPlans,
    context,
    research,
    requirements,
  });

  const estimatedTokens = estimateTokens(prompt);

  if (estimatedTokens > effectiveBudget) {
    hardFailed = true;
    return {
      prompt: '',
      metadata: {
        budget,
        effectiveBudget,
        estimatedTokens,
        omitted,
        projectMdShrunk,
        planTruncationPct,
        hardFailed,
        noteInjected,
      },
    };
  }

  return {
    prompt,
    metadata: {
      budget,
      effectiveBudget,
      estimatedTokens,
      omitted,
      projectMdShrunk,
      planTruncationPct,
      hardFailed,
      noteInjected,
    },
  };
}

// ─── CLI arg helpers ──────────────────────────────────────────────────────────

function getFlag(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  const val = args[idx + 1];
  if (val === undefined || val.startsWith('--')) return null;
  return val;
}

function getPlanFiles(args: string[]): string[] {
  const planFiles: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--plan-file' && args[i + 1] && !args[i + 1].startsWith('--')) {
      planFiles.push(args[i + 1]);
      i++;
    }
  }
  return planFiles;
}

async function readRequired(filePath: string, flagName: string): Promise<string> {
  const resolved = resolve(filePath);
  try {
    return await readFile(resolved, 'utf8');
  } catch (err) {
    const msg = err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT'
      ? `file not found for ${flagName}: ${resolved}`
      : `cannot read ${flagName}: ${resolved}`;
    throw new GSDError(
      msg,
      ErrorClassification.Validation,
    );
  }
}

async function readOptional(filePath: string | null): Promise<string | null> {
  if (!filePath) return null;
  const resolved = resolve(filePath);
  try {
    return await readFile(resolved, 'utf8');
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

/**
 * SDK handler for `gsd-sdk query prompt-budget`.
 *
 * Reads input files, applies the token budget algorithm, writes the trimmed
 * prompt and metadata to the specified output files, and returns the metadata.
 *
 * Throws `GSDError(Validation)` on missing required args or missing files.
 * Throws `GSDError(Blocked)` when the minimum-set exceeds the effective budget
 * (hard-fail, exit code 11 — callers that previously relied on exit code 2 from
 * the CJS fallback path should treat any non-zero exit as "skip reviewer").
 */
export const promptBudget: QueryHandler = async (args, _projectDir) => {
  // Collect multi-value --plan-file flags
  const planFilePaths = getPlanFiles(args);

  // Parse single-value flags
  const budgetStr = getFlag(args, '--budget');
  const instructionsFile = getFlag(args, '--instructions-file');
  const roadmapFile = getFlag(args, '--roadmap-file');
  const outputPromptFile = getFlag(args, '--output-prompt');
  const outputMetadataFile = getFlag(args, '--output-metadata');
  const safetyMarginStr = getFlag(args, '--safety-margin-pct');
  const projectMdHeadLinesStr = getFlag(args, '--project-md-head-lines');
  const projectFile = getFlag(args, '--project-file');
  const contextFile = getFlag(args, '--context-file');
  const researchFile = getFlag(args, '--research-file');
  const requirementsFile = getFlag(args, '--requirements-file');

  // Validate required args
  if (!budgetStr) {
    throw new GSDError('--budget <N> is required', ErrorClassification.Validation);
  }
  const budget = parseInt(budgetStr, 10);
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new GSDError('--budget must be a positive integer', ErrorClassification.Validation);
  }
  if (!instructionsFile) {
    throw new GSDError('--instructions-file <path> is required', ErrorClassification.Validation);
  }
  if (!roadmapFile) {
    throw new GSDError('--roadmap-file <path> is required', ErrorClassification.Validation);
  }
  if (planFilePaths.length === 0) {
    throw new GSDError(
      'at least one --plan-file <path> is required',
      ErrorClassification.Validation,
    );
  }
  if (!outputPromptFile) {
    throw new GSDError('--output-prompt <path> is required', ErrorClassification.Validation);
  }
  if (!outputMetadataFile) {
    throw new GSDError('--output-metadata <path> is required', ErrorClassification.Validation);
  }

  // Read input files
  const instructions = await readRequired(instructionsFile, '--instructions-file');
  const roadmap = await readRequired(roadmapFile, '--roadmap-file');
  const plans: PlanEntry[] = await Promise.all(planFilePaths.map(async (p) => {
    const resolved = resolve(p);
    try {
      const content = await readFile(resolved, 'utf8');
      return { file: basename(p), content };
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
        throw new GSDError(
          `plan file not found: ${resolved}`,
          ErrorClassification.Validation,
        );
      }
      throw new GSDError(
        `cannot read plan file: ${resolved}`,
        ErrorClassification.Validation,
      );
    }
  }));

  const projectMd = await readOptional(projectFile);
  const context = await readOptional(contextFile);
  const research = await readOptional(researchFile);
  const requirements = await readOptional(requirementsFile);

  // Build options
  const options: BudgetOptions = {};
  if (safetyMarginStr !== null) {
    const pct = parseInt(safetyMarginStr, 10);
    if (Number.isFinite(pct)) options.safetyMarginPct = pct;
  }
  if (projectMdHeadLinesStr !== null) {
    const lines = parseInt(projectMdHeadLinesStr, 10);
    if (Number.isFinite(lines)) options.projectMdHeadLines = lines;
  }

  // Apply budget
  const sections: BudgetSections = {
    instructions,
    roadmap,
    plans,
    projectMd,
    context,
    research,
    requirements,
  };
  const { prompt, metadata } = applyBudget({ sections, budget, options });

  // Write outputs (always write metadata; prompt may be empty on hard-fail)
  await writeFile(resolve(outputMetadataFile), JSON.stringify(metadata, null, 2));
  await writeFile(resolve(outputPromptFile), prompt);

  // Signal hard-fail
  if (metadata.hardFailed) {
    throw new GSDError(
      'prompt-budget hard failed: minimum-set exceeds the effective budget',
      ErrorClassification.Blocked,
    );
  }

  return { data: metadata };
};
