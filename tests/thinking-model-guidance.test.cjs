/**
 * Thinking Model Guidance Reference Tests
 *
 * Validates that all 5 thinking model reference files exist with required
 * sections, and that each of the 6 relevant agent files references its
 * thinking model guidance doc via inline @-reference wiring placed inside
 * the specific step/section blocks where thinking decisions occur.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REFERENCES_DIR = path.join(__dirname, '..', 'get-shit-done', 'references');
const AGENTS_DIR = path.join(__dirname, '..', 'agents');

const THINKING_CONTEXTS = ['debug', 'execution', 'planning', 'research', 'verification'];

// Sections present in #1791-style content (named models with anti-patterns, not generic schema)
const REQUIRED_SECTIONS = [
  '## Conflict Resolution',
  '## When NOT to Think',
];

// Sections present in all files regardless of approach
const UNIVERSAL_SECTIONS = [
  '## When NOT to Think',
];

// Named models expected in each file (from #1791 content)
const NAMED_MODELS = {
  'debug': ['Fault Tree Analysis', 'Hypothesis-Driven Investigation', 'Occam\'s Razor', 'Counterfactual Thinking'],
  'execution': ['Circle of Concern vs Circle of Control', 'Forcing Function', 'First Principles Thinking', 'Occam\'s Razor', 'Chesterton\'s Fence'],
  'planning': ['Pre-Mortem Analysis', 'MECE Decomposition', 'Constraint Analysis', 'Reversibility Test'],
  'research': ['First Principles Thinking', 'Simpson\'s Paradox Awareness', 'Survivorship Bias', 'Confirmation Bias Counter', 'Steel Man'],
  'verification': ['Inversion', 'Chesterton\'s Fence', 'Confirmation Bias Counter', 'Planning Fallacy Calibration', 'Counterfactual Thinking'],
};

// Sequencing rules are documented in Conflict Resolution sections
const SEQUENCING_CONTEXTS = ['debug', 'execution', 'planning', 'research', 'verification'];

// Gap Closure Mode is only in planning
const GAP_CLOSURE_CONTEXT = 'planning';

// Inline wiring: agent -> { refFile, wiredInsideBlock }
// wiredInsideBlock is a string that should appear BEFORE the @-reference in the agent file,
// confirming the reference is inside a specific step/section (not at top-of-agent)
const AGENT_WIRING = {
  'gsd-debugger': {
    refFile: 'thinking-models-debug.md',
    wiredInsideBlock: 'step name="investigation_loop"',
    wiredInsideText: 'At investigation decision points, apply structured reasoning',
  },
  'gsd-executor': {
    refFile: 'thinking-models-execution.md',
    wiredInsideBlock: 'step name="execute_tasks"',
    wiredInsideText: 'At execution decision points, apply structured reasoning',
  },
  'gsd-planner': {
    refFile: 'thinking-models-planning.md',
    wiredInsideBlock: 'step name="break_into_tasks"',
    wiredInsideText: 'At decision points during plan creation, apply structured reasoning',
  },
  'gsd-phase-researcher': {
    refFile: 'thinking-models-research.md',
    wiredInsideBlock: 'execution_flow',
    wiredInsideText: 'At research decision points, apply structured reasoning',
  },
  'gsd-plan-checker': {
    refFile: 'thinking-models-planning.md',
    wiredInsideBlock: 'verification_dimensions',
    wiredInsideText: 'At decision points during plan verification, apply structured reasoning',
  },
  'gsd-verifier': {
    refFile: 'thinking-models-verification.md',
    wiredInsideBlock: 'verification_process',
    wiredInsideText: 'At verification decision points, apply structured reasoning',
  },
};

// ─── Reference File Existence ────────────────────────────────────────────────

describe('thinking model reference files exist', () => {
  for (const context of THINKING_CONTEXTS) {
    test(`thinking-models-${context}.md exists`, () => {
      const filePath = path.join(REFERENCES_DIR, `thinking-models-${context}.md`);
      assert.ok(fs.existsSync(filePath), `Missing reference file: thinking-models-${context}.md`);
    });
  }
});

// ─── Reference File Universal Sections ──────────────────────────────────────

describe('thinking model reference files have required sections', () => {
  for (const context of THINKING_CONTEXTS) {
    describe(`thinking-models-${context}.md`, () => {
      const filePath = path.join(REFERENCES_DIR, `thinking-models-${context}.md`);
      let content;

      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch {
        content = '';
      }

      for (const section of UNIVERSAL_SECTIONS) {
        test(`contains "${section}"`, () => {
          assert.ok(
            content.includes(section),
            `thinking-models-${context}.md missing section: ${section}`
          );
        });
      }

      test('contains Conflict Resolution sequencing rules', () => {
        assert.ok(
          content.includes('## Conflict Resolution'),
          `thinking-models-${context}.md missing ## Conflict Resolution section (sequencing rules)`
        );
      });
    });
  }
});

// ─── Named Reasoning Models ──────────────────────────────────────────────────

describe('thinking model reference files contain named reasoning models', () => {
  for (const [context, models] of Object.entries(NAMED_MODELS)) {
    describe(`thinking-models-${context}.md`, () => {
      const filePath = path.join(REFERENCES_DIR, `thinking-models-${context}.md`);
      let content;

      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch {
        content = '';
      }

      for (const model of models) {
        test(`contains named model "${model}"`, () => {
          assert.ok(
            content.includes(model),
            `thinking-models-${context}.md missing named model: ${model}`
          );
        });
      }

      test('each named model documents what failure mode it counters', () => {
        assert.ok(
          content.includes('**Counters:**'),
          `thinking-models-${context}.md: named models must document what failure mode they counter via **Counters:** prefix`
        );
      });
    });
  }
});

// ─── Gap Closure Mode (planning only) ────────────────────────────────────────

describe('thinking-models-planning.md contains Gap Closure Mode section', () => {
  const filePath = path.join(REFERENCES_DIR, `thinking-models-${GAP_CLOSURE_CONTEXT}.md`);
  let content;

  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    content = '';
  }

  test('contains Gap Closure Mode section', () => {
    assert.ok(
      content.includes('Gap Closure Mode'),
      'thinking-models-planning.md missing Gap Closure Mode section'
    );
  });

  test('Gap Closure Mode section references gap closure trigger condition', () => {
    assert.ok(
      content.includes('gaps_found') || content.includes('gap closure mode'),
      'thinking-models-planning.md Gap Closure Mode section missing trigger condition reference'
    );
  });
});

// ─── Inline Agent Wiring (decision-point placement) ──────────────────────────

describe('agent files use inline @-reference wiring at decision points', () => {
  for (const [agent, wiring] of Object.entries(AGENT_WIRING)) {
    describe(`${agent}.md`, () => {
      const agentPath = path.join(AGENTS_DIR, `${agent}.md`);
      let content;

      try {
        content = fs.readFileSync(agentPath, 'utf-8');
      } catch {
        content = '';
      }

      test(`references ${wiring.refFile} via inline @-reference`, () => {
        assert.ok(
          content.includes(wiring.refFile),
          `${agent}.md does not reference ${wiring.refFile}`
        );
      });

      test(`wiring is placed inside the correct block (${wiring.wiredInsideBlock})`, () => {
        assert.ok(
          content.includes(wiring.wiredInsideBlock),
          `${agent}.md does not contain expected block: ${wiring.wiredInsideBlock}`
        );

        // Confirm the decision-point annotation appears alongside the reference
        assert.ok(
          content.includes(wiring.wiredInsideText),
          `${agent}.md missing decision-point annotation: "${wiring.wiredInsideText}"`
        );
      });

      test('does NOT put thinking-models reference inside <required_reading> (inline wiring only)', () => {
        // Extract content from all <required_reading> blocks
        const reqReadingMatches = content.match(/<required_reading>([\s\S]*?)<\/required_reading>/g) || [];
        const reqReadingContent = reqReadingMatches.join('');
        assert.equal(
          reqReadingContent.includes(wiring.refFile),
          false,
          `${agent}.md puts ${wiring.refFile} inside a <required_reading> block — thinking-model references must use inline @-reference wiring at decision points, not <required_reading> blocks`
        );
      });
    });
  }
});
