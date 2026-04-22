'use strict';

/**
 * Planner Language Regression Tests (#2091, #2092)
 *
 * Prevents time-based reasoning and complexity-as-scope-justification
 * from leaking back into planning artifacts via future PRs.
 *
 * These tests scan agent definitions, workflow files, and references
 * for prohibited patterns that import human-world constraints into
 * an AI execution context where those constraints do not exist.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const AGENTS_DIR = path.join(ROOT, 'agents');
const WORKFLOWS_DIR = path.join(ROOT, 'get-shit-done', 'workflows');
const REFERENCES_DIR = path.join(ROOT, 'get-shit-done', 'references');
const TEMPLATES_DIR = path.join(ROOT, 'get-shit-done', 'templates');

/**
 * Collect all .md files from a directory (non-recursive).
 */
function mdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ name: f, path: path.join(dir, f) }));
}

/**
 * Collect all .md files recursively.
 */
function mdFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...mdFilesRecursive(full));
    } else if (entry.name.endsWith('.md')) {
      results.push({ name: entry.name, path: full });
    }
  }
  return results;
}

/**
 * Files that define planning behavior — agents, workflows, references.
 * These are the files where time-based and complexity-based scope
 * reasoning must never appear.
 */
const PLANNING_FILES = [
  ...mdFiles(AGENTS_DIR),
  ...mdFiles(WORKFLOWS_DIR),
  ...mdFiles(REFERENCES_DIR),
  ...mdFilesRecursive(TEMPLATES_DIR),
];

// -- Prohibited patterns --

/**
 * Time-based task sizing patterns.
 * Matches "15-60 minutes", "X minutes Claude execution time", etc.
 * Does NOT match operational timeouts ("timeout: 5 minutes"),
 * API docs examples ("100 requests per 15 minutes"),
 * or human-readable timeout descriptions in workflow execution steps.
 */
const TIME_SIZING_PATTERNS = [
  // "N-M minutes" in task sizing context (not timeout context)
  /each task[:\s]*\*?\*?\d+[-–]\d+\s*min/i,
  // "minutes Claude execution time" or "minutes execution time"
  /minutes?\s+(claude\s+)?execution\s+time/i,
  // Duration-based sizing table rows: "< 15 min", "15-60 min", "> 60 min"
  /[<>]\s*\d+\s*min\s*\|/i,
];

/**
 * Complexity-as-scope-justification patterns.
 * Matches "too complex to implement", "challenging feature", etc.
 * Does NOT match legitimate uses like:
 *   - "complex domains" in research/discovery context (describing what to research)
 *   - "non-trivial" in verification context (confirming substantive code exists)
 *   - "challenging" in user-profiling context (quoting user reactions)
 */
const COMPLEXITY_SCOPE_PATTERNS = [
  // "too complex to" — always a scope-reduction justification
  /too\s+complex\s+to/i,
  // "too difficult" — always a scope-reduction justification
  /too\s+difficult/i,
  // "is too complex for" — scope justification (e.g. "Phase X is too complex for")
  /is\s+too\s+complex\s+for/i,
];

/**
 * Files allowed to contain certain patterns because they document
 * the prohibition itself, or use the terms in non-scope-reduction context.
 */
const ALLOWLIST = {
  // Plan-checker scans FOR these patterns — it's a detection list, not usage
  'gsd-plan-checker.md': ['complexity_scope', 'time_sizing'],
  // Planner defines the prohibition and the authority limits — uses terms to explain what NOT to do
  'gsd-planner.md': ['complexity_scope'],
  // Debugger uses "30+ minutes" as anti-pattern detection, not task sizing
  'gsd-debugger.md': ['time_sizing'],
  // Doc-writer uses "15 minutes" in API rate limit example, "2 minutes" for doc quality
  'gsd-doc-writer.md': ['time_sizing'],
  // Discovery-phase uses time for level descriptions (operational, not scope)
  'discovery-phase.md': ['time_sizing'],
  // Explore uses "~30 seconds" as operational estimate
  'explore.md': ['time_sizing'],
  // Review uses "up to 5 minutes" for CodeRabbit timeout
  'review.md': ['time_sizing'],
  // Fast uses "under 2 minutes wall time" as operational constraint
  'fast.md': ['time_sizing'],
  // Execute-phase uses "timeout: 5 minutes" for test runner
  'execute-phase.md': ['time_sizing'],
  // Verify-phase uses "timeout: 5 minutes" for test runner
  'verify-phase.md': ['time_sizing'],
  // Map-codebase documents subagent_timeout
  'map-codebase.md': ['time_sizing'],
  // Help documents CodeRabbit timing
  'help.md': ['time_sizing'],
};

function isAllowlisted(fileName, category) {
  const entry = ALLOWLIST[fileName];
  return entry && entry.includes(category);
}

// -- Tests --

describe('Planner language regression — time-based task sizing (#2092)', () => {
  for (const file of PLANNING_FILES) {
    test(`${file.name} must not use time-based task sizing`, () => {
      if (isAllowlisted(file.name, 'time_sizing')) return;

      const content = fs.readFileSync(file.path, 'utf-8');
      for (const pattern of TIME_SIZING_PATTERNS) {
        const match = content.match(pattern);
        assert.ok(
          !match,
          [
            `${file.name} contains time-based task sizing: "${match?.[0]}"`,
            'Task sizing must use context-window percentage, not time units.',
            'See issue #2092 for rationale.',
          ].join('\n')
        );
      }
    });
  }
});

describe('Planner language regression — complexity-as-scope-justification (#2092)', () => {
  for (const file of PLANNING_FILES) {
    test(`${file.name} must not use complexity to justify scope reduction`, () => {
      if (isAllowlisted(file.name, 'complexity_scope')) return;

      const content = fs.readFileSync(file.path, 'utf-8');
      for (const pattern of COMPLEXITY_SCOPE_PATTERNS) {
        const match = content.match(pattern);
        assert.ok(
          !match,
          [
            `${file.name} contains complexity-as-scope-justification: "${match?.[0]}"`,
            'Scope decisions must be based on context cost, missing information,',
            'or dependency conflicts — not perceived difficulty.',
            'See issue #2092 for rationale.',
          ].join('\n')
        );
      }
    });
  }
});

describe('gsd-planner.md — required structural sections (#2091, #2092)', () => {
  let plannerContent;

  test('planner file exists and is readable', () => {
    const plannerPath = path.join(AGENTS_DIR, 'gsd-planner.md');
    assert.ok(fs.existsSync(plannerPath), 'agents/gsd-planner.md must exist');
    plannerContent = fs.readFileSync(plannerPath, 'utf-8');
  });

  test('contains <planner_authority_limits> section', () => {
    assert.ok(
      plannerContent.includes('<planner_authority_limits>'),
      'gsd-planner.md must contain a <planner_authority_limits> section defining what the planner cannot decide'
    );
  });

  test('authority limits prohibit difficulty-based scope decisions', () => {
    assert.ok(
      plannerContent.includes('The planner has no authority to'),
      'planner_authority_limits must explicitly state what the planner cannot decide'
    );
  });

  test('authority limits list three legitimate split reasons: context cost, missing info, dependency', () => {
    assert.ok(
      plannerContent.includes('Context cost') || plannerContent.includes('context cost'),
      'authority limits must list context cost as a legitimate split reason'
    );
    assert.ok(
      plannerContent.includes('Missing information') || plannerContent.includes('missing information'),
      'authority limits must list missing information as a legitimate split reason'
    );
    assert.ok(
      plannerContent.includes('Dependency conflict') || plannerContent.includes('dependency conflict'),
      'authority limits must list dependency conflict as a legitimate split reason'
    );
  });

  test('task sizing uses context percentage, not time units', () => {
    assert.ok(
      plannerContent.includes('context consumption') || plannerContent.includes('context cost'),
      'task sizing must reference context consumption, not time'
    );
    assert.ok(
      !(/each task[:\s]*\*?\*?\d+[-–]\d+\s*min/i.test(plannerContent)),
      'task sizing must not use minutes as sizing unit'
    );
  });

  test('contains multi-source coverage audit (not just D-XX decisions)', () => {
    assert.ok(
      plannerContent.includes('Multi-Source Coverage Audit') ||
      plannerContent.includes('multi-source coverage audit'),
      'gsd-planner.md must contain a multi-source coverage audit, not just D-XX decision matrix'
    );
  });

  test('coverage audit includes all four source types: GOAL, REQ, RESEARCH, CONTEXT', () => {
    // The planner file or its referenced planner-source-audit.md must define all four types.
    // The inline compact version uses **GOAL**, **REQ**, **RESEARCH**, **CONTEXT**.
    const refPath = path.join(ROOT, 'get-shit-done', 'references', 'planner-source-audit.md');
    const combined = plannerContent + (fs.existsSync(refPath) ? fs.readFileSync(refPath, 'utf-8') : '');

    const hasGoal = combined.includes('**GOAL**');
    const hasReq = combined.includes('**REQ**');
    const hasResearch = combined.includes('**RESEARCH**');
    const hasContext = combined.includes('**CONTEXT**');

    assert.ok(hasGoal, 'coverage audit must include GOAL source type (ROADMAP.md phase goal)');
    assert.ok(hasReq, 'coverage audit must include REQ source type (REQUIREMENTS.md)');
    assert.ok(hasResearch, 'coverage audit must include RESEARCH source type (RESEARCH.md)');
    assert.ok(hasContext, 'coverage audit must include CONTEXT source type (CONTEXT.md decisions)');
  });

  test('coverage audit defines MISSING item handling with developer escalation', () => {
    assert.ok(
      plannerContent.includes('Source Audit: Unplanned Items Found') ||
      plannerContent.includes('MISSING'),
      'coverage audit must define handling for MISSING items'
    );
    assert.ok(
      plannerContent.includes('Awaiting developer decision') ||
      plannerContent.includes('developer confirmation'),
      'MISSING items must escalate to developer, not be silently dropped'
    );
  });
});

describe('plan-phase.md — source audit orchestration (#2091)', () => {
  let workflowContent;

  test('plan-phase workflow exists and is readable', () => {
    const workflowPath = path.join(WORKFLOWS_DIR, 'plan-phase.md');
    assert.ok(fs.existsSync(workflowPath), 'workflows/plan-phase.md must exist');
    workflowContent = fs.readFileSync(workflowPath, 'utf-8');
  });

  test('step 9 handles Source Audit return from planner', () => {
    assert.ok(
      workflowContent.includes('Source Audit: Unplanned Items Found'),
      'plan-phase.md step 9 must handle the Source Audit return from the planner'
    );
  });

  test('step 9c exists for source audit gap handling', () => {
    assert.ok(
      workflowContent.includes('9c') && workflowContent.includes('Source Audit'),
      'plan-phase.md must have a step 9c for handling source audit gaps'
    );
  });

  test('step 9b does not use "too complex" language', () => {
    // Extract just step 9b content (between "## 9b" and "## 9c" or "## 10")
    const step9bMatch = workflowContent.match(/## 9b\.([\s\S]*?)(?=## 9c|## 10)/);
    if (step9bMatch) {
      const step9b = step9bMatch[1];
      assert.ok(
        !step9b.includes('too complex'),
        'step 9b must not use "too complex" — use context budget language instead'
      );
    }
  });

  test('phase split recommendation uses context budget framing', () => {
    assert.ok(
      workflowContent.includes('context budget') || workflowContent.includes('context cost'),
      'phase split recommendation must be framed in terms of context budget, not complexity'
    );
  });
});

describe('gsd-plan-checker.md — scope reduction detection includes time/complexity (#2092)', () => {
  let checkerContent;

  test('plan-checker exists and is readable', () => {
    const checkerPath = path.join(AGENTS_DIR, 'gsd-plan-checker.md');
    assert.ok(fs.existsSync(checkerPath), 'agents/gsd-plan-checker.md must exist');
    checkerContent = fs.readFileSync(checkerPath, 'utf-8');
  });

  test('scope reduction scan includes complexity-based justification patterns', () => {
    assert.ok(
      checkerContent.includes('too complex') || checkerContent.includes('too difficult'),
      'plan-checker scope reduction scan must detect complexity-based justification language'
    );
  });

  test('scope reduction scan includes time-based justification patterns', () => {
    assert.ok(
      checkerContent.includes('would take') || checkerContent.includes('hours') || checkerContent.includes('minutes'),
      'plan-checker scope reduction scan must detect time-based justification language'
    );
  });
});
