'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { estimateTokens, applyBudget } = require('../get-shit-done/bin/lib/prompt-budget.cjs');

describe('prompt-budget', () => {
  // ── Cycle 1: estimator basics ──────────────────────────────────────────────
  test('estimateTokens — basic contract', () => {
    assert.equal(estimateTokens(''), 0);
    assert.equal(estimateTokens('hello'), 2);         // ceil(5/4) = 2
    assert.equal(estimateTokens('a'.repeat(400)), 100); // 400/4 = 100 exactly
  });

  // ── Cycle 2: applyBudget no-trim path ─────────────────────────────────────
  test('applyBudget — no-trim path when well under budget', () => {

    const sections = {
      instructions: 'Review this code.',
      projectMd: 'Project info.',
      roadmap: 'Phase 1: ship it.',
      plans: [{ file: 'plan-a.md', content: 'Do the thing.' }],
      context: 'Session context.',
      research: 'Background research.',
      requirements: 'Must pass tests.',
    };
    const { prompt, metadata } = applyBudget({ sections, budget: 10000 });

    assert.deepEqual(metadata.omitted, []);
    assert.equal(metadata.hardFailed, false);
    assert.equal(metadata.noteInjected, false);
    assert.equal(metadata.projectMdShrunk, false);
    assert.equal(metadata.planTruncationPct, 0);

    assert.ok(prompt.includes('Review this code.'));
    assert.ok(prompt.includes('Project info.'));
    assert.ok(prompt.includes('Phase 1: ship it.'));
    assert.ok(prompt.includes('Do the thing.'));
    assert.ok(prompt.includes('Session context.'));
    assert.ok(prompt.includes('Background research.'));
    assert.ok(prompt.includes('Must pass tests.'));
  });

  // ── Cycle 3: drop research when it is the sole cause of over-budget ─────────
  test('applyBudget — drops research when it alone causes over-budget', () => {
    // context is null; research alone pushes us over budget.
    // Without research: base ≈ 20 tokens. With research (~500 tokens): over budget.
    // effectiveBudget = floor(200 * 0.9) = 180. contentBudget = 180 - 80 = 100.
    const researchContent = 'a'.repeat(2000); // ~500 tokens

    const sections = {
      instructions: 'Review this code.',
      projectMd: null,
      roadmap: 'Phase 1: ship it.',
      plans: [{ file: 'plan-a.md', content: 'Do the thing.' }],
      context: null,
      research: researchContent,
      requirements: null,
    };

    const { prompt, metadata } = applyBudget({ sections, budget: 200 });

    assert.deepEqual(metadata.omitted, ['research']);
    assert.equal(metadata.noteInjected, true);
    assert.equal(prompt.includes(researchContent), false);
  });

  // ── Cycle 4: drop context first, then research ────────────────────────────
  test('applyBudget — drops context then research when both needed', () => {
    // Both context and research present; both must be dropped.
    // context drops first (priority 6), research second (priority 7).
    // base without either ≈ 20 tokens; each of context+research adds ~500 tokens.
    // effectiveBudget = floor(200 * 0.9) = 180. contentBudget = 100.
    const bigContent = 'b'.repeat(2000); // ~500 tokens each

    const sections = {
      instructions: 'Review this code.',
      projectMd: null,
      roadmap: 'Phase 1: ship it.',
      plans: [{ file: 'plan-a.md', content: 'Do the thing.' }],
      context: bigContent,
      research: bigContent,
      requirements: null,
    };

    const { prompt, metadata } = applyBudget({ sections, budget: 200 });

    // context drops first per spec (priority 6), research second (priority 7)
    assert.deepEqual(metadata.omitted, ['context', 'research']);
    assert.equal(metadata.noteInjected, true);
  });

  // ── Cycle 5: head-shrink PROJECT.md before dropping context ──────────────
  test('applyBudget — shrinks PROJECT.md to 40 lines before dropping context', () => {
    // PROJECT.md is 80 lines; shrinking to 40 saves enough that context survives.
    // 80 lines of ~20 chars each = 1600 chars ≈ 400 tokens
    // 40 lines = 800 chars ≈ 200 tokens  (saves ~200 tokens)
    // effectiveBudget = floor(700 * 0.9) = 630. contentBudget = 630 - 80 = 550.
    // base with 80-line projectMd + short context ≈ 20 + 400 + short ≈ 440 → fits at 550 after shrink to 40
    // base with full 80-line projectMd ≈ 20 + 400 + 10 = 430... need it to be over 550 with full projectMd

    // Build 80-line projectMd where shrinking to 40 saves enough
    const lineOf20 = 'x'.repeat(19); // 19 chars + newline = 20 chars per line
    const projectMdFull = Array.from({ length: 80 }, () => lineOf20).join('\n');
    // full: 80*20 - 1 = 1599 chars ≈ 400 tokens; shrunk: 40*20 - 1 = 799 chars ≈ 200 tokens

    // Budget: effective = 400, contentBudget = 320
    // base with full projectMd + short context ≈ overhead(20) + projectMd(400) + context(5) ≈ 425 > 320 → pressure
    // After shrink: overhead(20) + projectMd_shrunk(200) + context(5) ≈ 225 < 320 → fits, no drops
    const sections = {
      instructions: 'Review this.',
      projectMd: projectMdFull,
      roadmap: 'Phase 1.',
      plans: [{ file: 'plan.md', content: 'Plan here.' }],
      context: 'Short context.',
      research: null,
      requirements: null,
    };

    const { prompt, metadata } = applyBudget({ sections, budget: 445 });

    assert.equal(metadata.projectMdShrunk, true);
    assert.deepEqual(metadata.omitted, []);
    assert.equal(metadata.noteInjected, true);
    assert.ok(prompt.includes('Short context.'));
  });

  // ── Cycle 6: proportional plan truncation when 2+ plans ──────────────────
  test('applyBudget — proportionally truncates plans, never drops a whole plan', () => {
    // Two plans of ~1000 tokens each (4000 chars each).
    // Budget chosen so plans must shrink ~30%.
    // effectiveBudget = floor(1600 * 0.9) = 1440. contentBudget = 1440 - 80 = 1360.
    // overhead ≈ 30 tokens. planBudget ≈ 1330 tokens ≈ 5320 chars.
    // original total plan chars = 8000. remaining = 5320. reduction = (8000-5320)/8000 ≈ 33.5%
    const planContent = 'p'.repeat(4000); // ~1000 tokens each

    const sections = {
      instructions: 'Review this.',
      projectMd: null,
      roadmap: 'Phase 1.',
      plans: [
        { file: 'plan-a.md', content: planContent },
        { file: 'plan-b.md', content: planContent },
      ],
      context: null,
      research: null,
      requirements: null,
    };

    const { prompt, metadata } = applyBudget({ sections, budget: 1600 });

    // Both plans still appear
    assert.ok(prompt.includes('### plan-a.md'));
    assert.ok(prompt.includes('### plan-b.md'));

    // planTruncationPct within ±10 of 30%
    assert.ok(
      metadata.planTruncationPct >= 20 && metadata.planTruncationPct <= 40,
      'planTruncationPct=' + metadata.planTruncationPct + ' expected ~30 (±10)'
    );
    assert.equal(metadata.noteInjected, true);
  });

  // ── Cycle 7: drop requirements only as last resort ────────────────────────
  test('applyBudget — drops requirements as last resort after all other trims', () => {
    // context + research + plan-truncation + project-shrink all applied but still over
    // → drop requirements.
    // Use a tight budget with all optional sections present and large.
    // effectiveBudget = floor(200 * 0.9) = 180. contentBudget = 100.
    // Each big section = 'x'.repeat(2000) ≈ 500 tokens.
    // base (no optionals) ≈ 20 tokens. With requirements: ~520 tokens.
    // After dropping context + research: still need requirements dropped.
    const bigContent = 'x'.repeat(2000);

    const sections = {
      instructions: 'Review.',
      projectMd: null,
      roadmap: 'Phase 1.',
      plans: [{ file: 'plan.md', content: 'Plan here.' }],
      context: bigContent,
      research: bigContent,
      requirements: bigContent,
    };

    const { prompt, metadata } = applyBudget({ sections, budget: 200 });

    assert.deepEqual(metadata.omitted, ['context', 'research', 'requirements']);
    assert.equal(metadata.noteInjected, true);
    assert.equal(metadata.hardFailed, false);
  });

  // ── Cycle 8: hard-fail when minimum-set exceeds budget ───────────────────
  test('applyBudget — hard-fails when minimum-set exceeds effective budget', () => {
    // budget=50, effectiveBudget=45. instructions alone = 200+ tokens.
    // minSet = instructions + NOTE_RESERVE(80) + roadmap + min-plan = way over 45.
    const bigInstructions = 'i'.repeat(800); // 200 tokens

    const sections = {
      instructions: bigInstructions,
      projectMd: null,
      roadmap: 'Phase 1.',
      plans: [{ file: 'plan.md', content: 'Plan here.' }],
      context: null,
      research: null,
      requirements: null,
    };

    const { prompt, metadata } = applyBudget({ sections, budget: 50 });

    assert.equal(metadata.hardFailed, true);
    assert.equal(prompt, '');
  });

  // ── Cycle 9: note reservation invariant (load-bearing) ───────────────────
  test('applyBudget — reserves note tokens before drop math so final prompt fits', () => {
    // Invariant: the algorithm reserves ~80 note tokens BEFORE deciding what to drop.
    // If the implementation skips reservation, a buggy version could:
    //   1. See base_with_research >> effectiveBudget → drop research
    //   2. See base_without_research < effectiveBudget → think "no more trim needed"
    //   3. Inject note anyway → final prompt exceeds effectiveBudget
    //
    // Design (budget=145, effectiveBudget=130, contentBudget=50):
    //   base_without_research = 60 tokens → in (contentBudget=50, effectiveBudget=130)
    //   base_with_research    = 564 tokens → triggers pressure
    //   base_without_research + note_reserve(80) = 140 > effectiveBudget(130) → must reserve
    //   minSet(130) ≤ effectiveBudget(130) → just barely avoids hard fail
    //
    // A correct implementation drops research and ensures estimatedTokens ≤ effectiveBudget.
    const sections = {
      instructions: 'i'.repeat(120),   // 30 tokens
      projectMd: null,
      roadmap: 'r'.repeat(40),         // 10 tokens
      plans: [{ file: 'plan.md', content: 'p'.repeat(40) }], // 10 tokens
      context: null,
      research: 'x'.repeat(2000),      // ~500 tokens — causes the pressure
      requirements: null,
    };

    const { prompt, metadata } = applyBudget({ sections, budget: 145 });

    // Research must be dropped (it caused the pressure)
    assert.ok(metadata.omitted.includes('research'), 'research must be omitted');
    // Note must be injected (trim occurred)
    assert.equal(metadata.noteInjected, true);
    // Final estimated tokens must be within effectiveBudget (the load-bearing assertion)
    assert.ok(
      metadata.estimatedTokens <= metadata.effectiveBudget,
      'estimatedTokens=' + metadata.estimatedTokens +
      ' must be ≤ effectiveBudget=' + metadata.effectiveBudget
    );
    // Not a hard failure
    assert.equal(metadata.hardFailed, false);
  });

  // ── Cycle 11: no false hard-fail when untrimmed prompt fits effectiveBudget ─
  test('applyBudget — does not hard-fail when untrimmed prompt fits within effectiveBudget', () => {
    // budget=44 → effectiveBudget=39. Full untrimmed prompt = 32 tokens ≤ 39.
    // Bug: minSet unconditionally includes NOTE_RESERVE_TOKENS(80), making
    // minSet=102 > 39 and triggering a spurious hard-fail even though no note
    // is needed (no trim occurs) and the prompt genuinely fits.
    // Fix: exclude NOTE_RESERVE_TOKENS from minSet; only account for it if trim
    // is actually needed.
    const sections = {
      instructions: 'i'.repeat(32),   // 8 tokens
      projectMd: null,
      roadmap: 'r'.repeat(16),        // 4 tokens
      plans: [{ file: 'plan.md', content: 'p'.repeat(40) }], // 10 tokens
      context: null,
      research: null,
      requirements: null,
    };

    const { prompt, metadata } = applyBudget({ sections, budget: 44 });

    assert.equal(metadata.hardFailed, false, 'must not hard-fail when prompt fits effectiveBudget');
    assert.ok(prompt.length > 0, 'prompt must be non-empty');
    assert.deepEqual(metadata.omitted, [], 'nothing should be omitted');
    assert.equal(metadata.noteInjected, false, 'no note needed — no trim occurred');
  });

  // ── Cycle 12: no unneeded trim when full prompt already fits effectiveBudget ─
  test('applyBudget — does not drop context or research when full untrimmed prompt already fits effectiveBudget', () => {
    // budget=156 → effectiveBudget=140. Full prompt (with context+research) ≈ 88 tokens ≤ 140.
    // Bug: budgetUnderPressure = baseTokens > effectiveBudget - NOTE_RESERVE_TOKENS
    //   = 89 > 60 → true, sets contentBudget=60, triggers trim steps → drops context/research.
    // Fix: budgetUnderPressure should check baseTokens > effectiveBudget, not the pre-reserved
    // threshold. Note reservation happens only after a real trim decision is made.
    const sections = {
      instructions: 'i'.repeat(120),  // 30 tokens
      projectMd: null,
      roadmap: 'r'.repeat(40),        // 10 tokens
      plans: [{ file: 'plan-a.md', content: 'p'.repeat(40) }], // 10 tokens
      context: 'c'.repeat(40),        // 10 tokens + header
      research: 'x'.repeat(40),       // 10 tokens + header
      requirements: null,
    };

    const { prompt, metadata } = applyBudget({ sections, budget: 156 });

    assert.equal(metadata.hardFailed, false, 'must not hard-fail');
    assert.deepEqual(metadata.omitted, [], 'context and research must NOT be omitted');
    assert.ok(prompt.length > 0, 'prompt must be non-empty');
    // context and research must appear in the assembled prompt
    assert.ok(prompt.includes('## Context'), 'context section must be present');
    assert.ok(prompt.includes('## Research'), 'research section must be present');
    assert.equal(metadata.noteInjected, false, 'no note needed — no trim occurred');
  });

  // ── Cycle 10: null optional sections ─────────────────────────────────────
  test('applyBudget — null optional sections are excluded from prompt without counting as omitted', () => {
    // All optionals are null, no projectMd — big budget so no trim.
    const sections = {
      instructions: 'Review this code.',
      projectMd: null,
      roadmap: 'Phase 1: ship it.',
      plans: [{ file: 'plan.md', content: 'Do the thing.' }],
      context: null,
      research: null,
      requirements: null,
    };

    const { prompt, metadata } = applyBudget({ sections, budget: 10000 });

    // Nulls don't count as "omitted" — only sections with content that were trimmed do
    assert.deepEqual(metadata.omitted, []);
    assert.equal(metadata.hardFailed, false);
    assert.equal(metadata.noteInjected, false);

    // None of the optional section headers should appear
    assert.equal(prompt.includes('## Context'), false);
    assert.equal(prompt.includes('## Research'), false);
    assert.equal(prompt.includes('## Requirements'), false);
    assert.equal(prompt.includes('## Project'), false);

    // Required sections must still appear
    assert.ok(prompt.includes('Review this code.'));
    assert.ok(prompt.includes('Phase 1: ship it.'));
    assert.ok(prompt.includes('Do the thing.'));
  });

});
