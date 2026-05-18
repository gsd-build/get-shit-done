'use strict';

/**
 * prompt-budget.cjs
 *
 * Pure functions for assembling and trimming review prompts to fit within
 * a token budget. Used by the review pipeline to support small-context models.
 *
 * Trim priority (in order — never violate):
 *   1. Instructions:   ALWAYS kept verbatim
 *   2. Reserve note tokens FIRST when any trim is anticipated
 *   3. Roadmap:        ALWAYS kept verbatim
 *   4. PROJECT.md:     head-shrink to projectMdHeadLines (default 40) if over budget
 *   5. Plans:          tail-truncate proportionally; never drop a whole plan
 *   6. Context:        DROP first if still over
 *   7. Research:       DROP second if still over
 *   8. Requirements:   DROP last (last-resort)
 *   9. Hard-fail:      if minimum-set exceeds effectiveBudget
 */

const NOTE_RESERVE_TOKENS = 80;

const DEFAULT_NOTE_TEMPLATE = [
  '<note>',
  'Prompt automatically trimmed to fit a {budget}-token budget.',
  'Omitted sections: {omittedList}.',
  'Plan content truncated by approximately {planTruncationPct}%.',
  'Treat any missing context as out-of-scope rather than a review concern.',
  '</note>',
].join('\n');

/**
 * Estimate tokens for a string. Chars / 4, rounded up.
 *
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Render the trim-disclosure note.
 *
 * @param {string} template
 * @param {number} budget
 * @param {string[]} omitted
 * @param {number} planTruncationPct
 * @returns {string}
 */
function renderNote(template, budget, omitted, planTruncationPct) {
  const omittedList = omitted.length > 0 ? omitted.join(', ') : 'none';
  return template
    .replace('{budget}', String(budget))
    .replace('{omittedList}', omittedList)
    .replace('{planTruncationPct}', String(Math.round(planTruncationPct)));
}

/**
 * Head-shrink a string to at most `maxLines` lines.
 *
 * @param {string} text
 * @param {number} maxLines
 * @returns {string}
 */
function headShrink(text, maxLines) {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join('\n');
}

/**
 * Tail-truncate a string to at most `maxChars` characters.
 *
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
function tailTruncate(text, maxChars) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

/**
 * Assemble the final prompt string from its sections.
 *
 * @param {object} parts
 * @returns {string}
 */
function assemblePrompt(parts) {
  const {
    instructions,
    note,
    roadmap,
    projectMd,
    plans,
    context,
    research,
    requirements,
  } = parts;

  const blocks = [];

  blocks.push(instructions);

  if (note) blocks.push(note);

  blocks.push('## Roadmap\n\n' + roadmap);

  if (projectMd) blocks.push('## Project\n\n' + projectMd);

  const planBlocks = plans
    .map((p) => '### ' + p.file + '\n\n' + p.content)
    .join('\n\n');
  blocks.push('## Plans\n\n' + planBlocks);

  if (context) blocks.push('## Context\n\n' + context);
  if (research) blocks.push('## Research\n\n' + research);
  if (requirements) blocks.push('## Requirements\n\n' + requirements);

  return blocks.join('\n\n');
}

/**
 * Apply a token budget to a set of review prompt sections.
 * Returns the trimmed prompt and structured metadata.
 *
 * @param {object} param0
 * @param {object} param0.sections
 * @param {number} param0.budget
 * @param {object} [param0.options]
 * @returns {{ prompt: string, metadata: object }}
 */
function applyBudget({ sections, budget, options = {} }) {
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

  // Working mutable state
  let projectMd = projectMdRaw;
  let context = contextRaw;
  let research = researchRaw;
  let requirements = requirementsRaw;
  let workingPlans = plans.map((p) => ({ file: p.file, content: p.content }));

  const omitted = [];
  let projectMdShrunk = false;
  let planTruncationPct = 0;
  let noteInjected = false;
  let hardFailed = false;

  // Minimum-set check: instructions + reserved-note + roadmap + 1KB per plan
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

  // ── Budget accounting ──────────────────────────────────────────────────────

  // Helper: compute current total WITHOUT note (we handle note separately)
  function computeBaseTokens() {
    const planTokens = workingPlans.reduce(
      (sum, p) => sum + estimateTokens(p.content),
      0
    );
    const planHeaders = workingPlans.reduce(
      (sum, p) => sum + estimateTokens('### ' + p.file + '\n\n'),
      0
    );
    return (
      estimateTokens(instructions) +
      estimateTokens('## Roadmap\n\n') +
      estimateTokens(roadmap) +
      (projectMd
        ? estimateTokens('## Project\n\n') + estimateTokens(projectMd)
        : 0) +
      estimateTokens('## Plans\n\n') +
      planHeaders +
      planTokens +
      (context
        ? estimateTokens('## Context\n\n') + estimateTokens(context)
        : 0) +
      (research
        ? estimateTokens('## Research\n\n') + estimateTokens(research)
        : 0) +
      (requirements
        ? estimateTokens('## Requirements\n\n') + estimateTokens(requirements)
        : 0)
    );
  }

  // Detect budget pressure: is ANY trim needed?
  // We need to reserve note tokens whenever we anticipate a trim.
  // We check against effectiveBudget - NOTE_RESERVE_TOKENS to decide if
  // pressure exists (i.e. we'd need to trim even before adding the note).
  const baseTokens = computeBaseTokens();
  const budgetUnderPressure = baseTokens > effectiveBudget - NOTE_RESERVE_TOKENS;

  // Available for content (reserve note slot when under pressure)
  let contentBudget = budgetUnderPressure
    ? effectiveBudget - NOTE_RESERVE_TOKENS
    : effectiveBudget;

  // ── Trim step 1: head-shrink PROJECT.md ───────────────────────────────────
  if (computeBaseTokens() > contentBudget && projectMd) {
    const shrunk = headShrink(projectMd, projectMdHeadLines);
    if (shrunk !== projectMd) {
      projectMd = shrunk;
      projectMdShrunk = true;
    }
  }

  // ── Trim step 2: drop context ─────────────────────────────────────────────
  if (computeBaseTokens() > contentBudget && context) {
    context = null;
    omitted.push('context');
  }

  // ── Trim step 3: drop research ────────────────────────────────────────────
  if (computeBaseTokens() > contentBudget && research) {
    research = null;
    omitted.push('research');
  }

  // ── Trim step 4: proportional plan truncation ─────────────────────────────
  if (computeBaseTokens() > contentBudget) {
    // Compute tokens available for plan content only
    const overhead =
      estimateTokens(instructions) +
      estimateTokens('## Roadmap\n\n') +
      estimateTokens(roadmap) +
      (projectMd
        ? estimateTokens('## Project\n\n') + estimateTokens(projectMd)
        : 0) +
      estimateTokens('## Plans\n\n') +
      workingPlans.reduce(
        (sum, p) => sum + estimateTokens('### ' + p.file + '\n\n'),
        0
      ) +
      (requirements
        ? estimateTokens('## Requirements\n\n') + estimateTokens(requirements)
        : 0);

    const planBudgetTokens = contentBudget - overhead;
    const totalPlanTokens = workingPlans.reduce(
      (sum, p) => sum + estimateTokens(p.content),
      0
    );

    if (planBudgetTokens > 0 && planBudgetTokens < totalPlanTokens) {
      // Proportional share per plan (at least 1KB per plan)
      const totalOriginalChars = plans.reduce(
        (sum, p) => sum + p.content.length,
        0
      );

      workingPlans = workingPlans.map((p, i) => {
        const share = planBudgetTokens / workingPlans.length;
        const maxChars = Math.max(Math.floor(share * 4), MIN_PLAN_BYTES);
        return { file: p.file, content: tailTruncate(p.content, maxChars) };
      });

      const newTotalChars = workingPlans.reduce(
        (sum, p) => sum + p.content.length,
        0
      );
      if (totalOriginalChars > 0) {
        planTruncationPct =
          ((totalOriginalChars - newTotalChars) / totalOriginalChars) * 100;
      }
    }
  }

  // ── Trim step 5: drop requirements (last resort) ──────────────────────────
  if (computeBaseTokens() > contentBudget && requirements) {
    requirements = null;
    omitted.push('requirements');
  }

  // ── Decide whether note is actually needed ────────────────────────────────
  const anyTrimOccurred =
    omitted.length > 0 || projectMdShrunk || planTruncationPct > 0;

  let note = null;
  if (anyTrimOccurred) {
    note = renderNote(noteTemplate, budget, omitted, planTruncationPct);
    noteInjected = true;
  }

  // ── Assemble ──────────────────────────────────────────────────────────────
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

module.exports = { estimateTokens, applyBudget };
