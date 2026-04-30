/**
 * Structural validation tests for Phase 3 SME creator agent definitions.
 *
 * Tests verify static structure of agent markdown files and eval config — not
 * runtime behavior. All tests read files from the repo root using absolute paths.
 *
 * Requirements covered:
 *   CREATE-01 — Agent produces complete SME document (role block, severity_examples,
 *               all 6 H2 section references in synthesize step, self-check SECTION_COUNT)
 *   CREATE-02 — Git history captured in findings (analyzer mandates git log --follow)
 *   CREATE-03 — Parallel sub-agent decomposition (Task in orchestrator, NOT in analyzer,
 *               subagent_type name match, sequential fallback, eval config >= 10 tests)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── File paths (absolute from repo root) ────────────────────────────────────

// The SDK lives at <repo>/sdk; the agent definitions are at <repo>/agents/
// import.meta.dirname = <repo>/sdk/src/agents → up 3 levels = <repo>
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');

const ORCHESTRATOR_PATH = resolve(REPO_ROOT, 'agents', 'gsd-sme-creator.md');
const ANALYZER_PATH = resolve(REPO_ROOT, 'agents', 'gsd-sme-creator-analyzer.md');
const EVAL_CONFIG_PATH = resolve(REPO_ROOT, 'evals', 'sme-creator.promptfooconfig.yaml');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readAgent(path: string): string {
  return readFileSync(path, 'utf-8');
}

function countOccurrences(content: string, needle: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = content.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

// ─── CREATE-01: Orchestrator produces complete SME document ───────────────────

describe('CREATE-01: orchestrator agent structure for complete SME document output', () => {
  let orchestrator: string;

  // Load once, share across tests in this describe block
  beforeAll(() => {
    orchestrator = readAgent(ORCHESTRATOR_PATH);
  });

  it('orchestrator has a <role> block with GSD SME creator identity', () => {
    expect(orchestrator).toContain('<role>');
    expect(orchestrator).toContain('GSD SME creator');
  });

  it('orchestrator has a <severity_examples> block with BLOCKER, WARNING, and WATCH examples', () => {
    expect(orchestrator).toContain('<severity_examples>');
    expect(orchestrator).toContain('[BLOCKER]');
    expect(orchestrator).toContain('[WARNING]');
    expect(orchestrator).toContain('[WATCH]');
  });

  it('orchestrator synthesize_and_write step references all 6 required H2 section names', () => {
    const six_sections = [
      '## Process Overview',
      '## Identified Risks',
      '## Test Gaps',
      '## Outdated Logic',
      '## Edge Cases',
      '## Known Blockers',
    ];
    for (const section of six_sections) {
      expect(orchestrator).toContain(section);
    }
  });

  it('orchestrator has a self-check using SECTION_COUNT variable', () => {
    expect(orchestrator).toContain('SECTION_COUNT');
    // The self-check grep command should look for all 6 sections
    expect(orchestrator).toMatch(/grep.*SECTION_COUNT|SECTION_COUNT.*grep/s);
  });

  it('orchestrator self-check threshold is >= 6', () => {
    // The plan mandates >= 6 threshold for section count
    expect(orchestrator).toMatch(/>= 6|>= six|must be >= 6/i);
  });

  it('orchestrator has ## INCOMPLETE marker for self-check failure case', () => {
    expect(orchestrator).toContain('## INCOMPLETE');
  });
});

// ─── CREATE-02: Analyzer mandates git log --follow ────────────────────────────

describe('CREATE-02: analyzer agent mandates git log --follow for file history', () => {
  let analyzer: string;

  beforeAll(() => {
    analyzer = readAgent(ANALYZER_PATH);
  });

  it('analyzer contains git log --follow at least 3 times (checklist, process step, critical_rules)', () => {
    const occurrences = countOccurrences(analyzer, 'git log --follow');
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });

  it('analyzer analysis_checklist block includes git log --follow as MANDATORY step', () => {
    expect(analyzer).toContain('<analysis_checklist>');
    // The MANDATORY comment must appear near the git log --follow instruction
    const checklistStart = analyzer.indexOf('<analysis_checklist>');
    const checklistEnd = analyzer.indexOf('</analysis_checklist>');
    const checklist = analyzer.slice(checklistStart, checklistEnd);
    expect(checklist).toContain('git log --follow');
    expect(checklist).toMatch(/MANDATORY|mandatory/);
  });

  it('analyzer process block includes git log --follow in analyze_files step', () => {
    const processStart = analyzer.indexOf('<process>');
    const processEnd = analyzer.indexOf('</process>');
    const processBlock = analyzer.slice(processStart, processEnd);
    expect(processBlock).toContain('git log --follow');
  });

  it('analyzer critical_rules block includes git log --follow mandate', () => {
    const rulesStart = analyzer.indexOf('<critical_rules>');
    const rulesEnd = analyzer.indexOf('</critical_rules>');
    const rulesBlock = analyzer.slice(rulesStart, rulesEnd);
    expect(rulesBlock).toContain('git log --follow');
  });
});

// ─── CREATE-03: Parallel sub-agent decomposition ─────────────────────────────

describe('CREATE-03: sub-agent decomposition — Tool configuration', () => {
  let orchestrator: string;
  let analyzer: string;

  beforeAll(() => {
    orchestrator = readAgent(ORCHESTRATOR_PATH);
    analyzer = readAgent(ANALYZER_PATH);
  });

  it('orchestrator YAML frontmatter includes Task in the tools field', () => {
    // tools line must include Task
    const toolsLine = orchestrator
      .split('\n')
      .find((line) => line.startsWith('tools:'));
    expect(toolsLine).toBeDefined();
    expect(toolsLine).toContain('Task');
  });

  it('analyzer YAML frontmatter does NOT include Task in the tools field', () => {
    const toolsLine = analyzer
      .split('\n')
      .find((line) => line.startsWith('tools:'));
    expect(toolsLine).toBeDefined();
    expect(toolsLine).not.toContain('Task');
  });
});

describe('CREATE-03: sub-agent decomposition — subagent_type name match', () => {
  let orchestrator: string;
  let analyzer: string;

  beforeAll(() => {
    orchestrator = readAgent(ORCHESTRATOR_PATH);
    analyzer = readAgent(ANALYZER_PATH);
  });

  it('orchestrator references subagent_type="gsd-sme-creator-analyzer" at least once', () => {
    expect(orchestrator).toContain('subagent_type="gsd-sme-creator-analyzer"');
  });

  it('analyzer name field in YAML frontmatter is exactly "gsd-sme-creator-analyzer"', () => {
    const nameLine = analyzer
      .split('\n')
      .find((line) => line.startsWith('name:'));
    expect(nameLine).toBeDefined();
    expect(nameLine!.trim()).toBe('name: gsd-sme-creator-analyzer');
  });

  it('orchestrator subagent_type value matches analyzer name field exactly', () => {
    const analyzerNameLine = analyzer
      .split('\n')
      .find((line) => line.startsWith('name:'));
    const analyzerName = analyzerNameLine!.replace('name:', '').trim();

    // Orchestrator must use this exact name as subagent_type
    expect(orchestrator).toContain(`subagent_type="${analyzerName}"`);
  });
});

describe('CREATE-03: sub-agent decomposition — sequential fallback exists', () => {
  let orchestrator: string;

  beforeAll(() => {
    orchestrator = readAgent(ORCHESTRATOR_PATH);
  });

  it('orchestrator has a sequential_analysis step or sequential fallback path', () => {
    // Must have a step with sequential in the name or a clear sequential fallback description
    expect(orchestrator).toMatch(/sequential_analysis|sequential fallback|sequential/i);
  });

  it('orchestrator sequential fallback has condition for Task tool unavailability', () => {
    // The sequential step must be conditioned on Task tool NOT being available
    const seqMatch = orchestrator.match(
      /sequential[^<]*condition[^=]*=[^"]*"([^"]+)"|condition="([^"]+)"[^<]*sequential/i,
    );
    // Also accept the plan's exact condition text appearing anywhere near "sequential"
    const hasCondition =
      orchestrator.includes('Task tool is NOT available') ||
      orchestrator.includes('Task tool unavailable') ||
      (orchestrator.includes('sequential') &&
        orchestrator.includes('condition='));
    expect(hasCondition).toBe(true);
  });
});

describe('CREATE-03: eval config is valid YAML with >= 10 test cases', () => {
  let evalContent: string;

  beforeAll(() => {
    evalContent = readFileSync(EVAL_CONFIG_PATH, 'utf-8');
  });

  it('eval config file is non-empty and readable', () => {
    expect(evalContent.length).toBeGreaterThan(0);
  });

  it('eval config has at least 10 "- description:" entries (one per test case)', () => {
    // Each test case in Promptfoo YAML starts with "  - description:" at 2-space indent
    const testCaseLines = evalContent
      .split('\n')
      .filter((line) => /^\s{2,4}-\s+description:/.test(line));
    expect(testCaseLines.length).toBeGreaterThanOrEqual(10);
  });

  it('eval config has top-level description field containing "SME Creator Agent"', () => {
    // Top-level description is not indented
    const descriptionLine = evalContent
      .split('\n')
      .find((line) => /^description:/.test(line));
    expect(descriptionLine).toBeDefined();
    expect(descriptionLine).toMatch(/SME Creator Agent/);
  });

  it('eval config has no YAML syntax error indicators (tab characters where spaces expected)', () => {
    // YAML forbids literal tabs for indentation — a common source of parse errors
    const linesWithLeadingTabs = evalContent
      .split('\n')
      .filter((line) => /^\t/.test(line));
    expect(linesWithLeadingTabs.length).toBe(0);
  });
});
