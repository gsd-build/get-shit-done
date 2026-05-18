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
 *   2  hardFailed: minimum-set exceeds budget; metadata still written
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join('\n');
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
  const hardFailed = false;

  // Minimum-set check
  const MIN_PLAN_BYTES = 1024;
  const minPlanTokens = plans.reduce((sum, p) => {
    return sum + estimateTokens(p.content.slice(0, MIN_PLAN_BYTES));
  }, 0);
  const minSet =
    estimateTokens(instructions) +
    NOTE_RESERVE_TOKENS +
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

  function computeBaseTokens(): number {
    const planTokens = workingPlans.reduce((sum, p) => sum + estimateTokens(p.content), 0);
    const planHeaders = workingPlans.reduce(
      (sum, p) => sum + estimateTokens('### ' + p.file + '\n\n'),
      0,
    );
    return (
      estimateTokens(instructions) +
      estimateTokens('## Roadmap\n\n') +
      estimateTokens(roadmap) +
      (projectMd ? estimateTokens('## Project\n\n') + estimateTokens(projectMd) : 0) +
      estimateTokens('## Plans\n\n') +
      planHeaders +
      planTokens +
      (context ? estimateTokens('## Context\n\n') + estimateTokens(context) : 0) +
      (research ? estimateTokens('## Research\n\n') + estimateTokens(research) : 0) +
      (requirements ? estimateTokens('## Requirements\n\n') + estimateTokens(requirements) : 0)
    );
  }

  const baseTokens = computeBaseTokens();
  const budgetUnderPressure = baseTokens > effectiveBudget - NOTE_RESERVE_TOKENS;
  let contentBudget = budgetUnderPressure ? effectiveBudget - NOTE_RESERVE_TOKENS : effectiveBudget;

  // Trim step 1: head-shrink PROJECT.md
  if (computeBaseTokens() > contentBudget && projectMd) {
    const shrunk = headShrink(projectMd, projectMdHeadLines);
    if (shrunk !== projectMd) {
      projectMd = shrunk;
      projectMdShrunk = true;
    }
  }

  // Trim step 2: drop context
  if (computeBaseTokens() > contentBudget && context) {
    context = null;
    omitted.push('context');
  }

  // Trim step 3: drop research
  if (computeBaseTokens() > contentBudget && research) {
    research = null;
    omitted.push('research');
  }

  // Trim step 4: proportional plan truncation
  if (computeBaseTokens() > contentBudget) {
    const overhead =
      estimateTokens(instructions) +
      estimateTokens('## Roadmap\n\n') +
      estimateTokens(roadmap) +
      (projectMd ? estimateTokens('## Project\n\n') + estimateTokens(projectMd) : 0) +
      estimateTokens('## Plans\n\n') +
      workingPlans.reduce((sum, p) => sum + estimateTokens('### ' + p.file + '\n\n'), 0) +
      (requirements ? estimateTokens('## Requirements\n\n') + estimateTokens(requirements) : 0);

    const planBudgetTokens = contentBudget - overhead;
    const totalPlanTokens = workingPlans.reduce((sum, p) => sum + estimateTokens(p.content), 0);

    if (planBudgetTokens > 0 && planBudgetTokens < totalPlanTokens) {
      const totalOriginalChars = plans.reduce((sum, p) => sum + p.content.length, 0);

      workingPlans = workingPlans.map((p) => {
        const share = planBudgetTokens / workingPlans.length;
        const maxChars = Math.max(Math.floor(share * 4), MIN_PLAN_BYTES);
        return { file: p.file, content: tailTruncate(p.content, maxChars) };
      });

      const newTotalChars = workingPlans.reduce((sum, p) => sum + p.content.length, 0);
      if (totalOriginalChars > 0) {
        planTruncationPct = ((totalOriginalChars - newTotalChars) / totalOriginalChars) * 100;
      }
    }
  }

  // Trim step 5: drop requirements (last resort)
  if (computeBaseTokens() > contentBudget && requirements) {
    requirements = null;
    omitted.push('requirements');
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

function readRequired(filePath: string, flagName: string): string {
  const resolved = resolve(filePath);
  if (!existsSync(resolved)) {
    throw new GSDError(
      `file not found for ${flagName}: ${resolved}`,
      ErrorClassification.Validation,
    );
  }
  return readFileSync(resolved, 'utf8');
}

function readOptional(filePath: string | null): string | null {
  if (!filePath) return null;
  const resolved = resolve(filePath);
  if (!existsSync(resolved)) return null;
  return readFileSync(resolved, 'utf8');
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
  const instructions = readRequired(instructionsFile, '--instructions-file');
  const roadmap = readRequired(roadmapFile, '--roadmap-file');
  const plans: PlanEntry[] = planFilePaths.map((p) => {
    const resolved = resolve(p);
    if (!existsSync(resolved)) {
      throw new GSDError(
        `plan file not found: ${resolved}`,
        ErrorClassification.Validation,
      );
    }
    return { file: basename(p), content: readFileSync(resolved, 'utf8') };
  });

  const projectMd = readOptional(projectFile);
  const context = readOptional(contextFile);
  const research = readOptional(researchFile);
  const requirements = readOptional(requirementsFile);

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
  writeFileSync(resolve(outputMetadataFile), JSON.stringify(metadata, null, 2));
  writeFileSync(resolve(outputPromptFile), prompt);

  // Signal hard-fail
  if (metadata.hardFailed) {
    throw new GSDError(
      'prompt-budget hard failed: minimum-set exceeds the effective budget',
      ErrorClassification.Blocked,
    );
  }

  return { data: metadata };
};
