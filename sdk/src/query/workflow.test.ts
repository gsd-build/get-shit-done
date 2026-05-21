/**
 * Tests for workflow.parse — structural IR parser for workflow/agent/reference markdown.
 *
 * One cycle per IR field, in order:
 *   Cycle 1: sections
 *   Cycle 2: code_blocks (language detection / MD040 null case)
 *   Cycle 3: asks (AskUserQuestion detection)
 *   Cycle 4: references (at_include, markdown_link, inline_path)
 *   Cycle 5: sdk_calls (gsd-sdk query lines)
 *   Cycle 6: conditionals (bash if/elif/else/case with keyword extraction)
 *   Cycle 7: bash_assignments (VAR= lines)
 *   Cycle 8: terms (presence lookup with default seed list + custom terms)
 *   Cycle 9: integration test against real plan-phase.md
 */

import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseWorkflowFile, workflowParse, DEFAULT_TERMS } from './workflow.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const tmpDirs: string[] = [];

function makeTmpFile(content: string, name = 'sample.md'): string {
  const dir = mkdtempSync(join(tmpdir(), 'wf-test-'));
  tmpDirs.push(dir);
  const file = join(dir, name);
  writeFileSync(file, content);
  return file;
}

afterAll(() => {
  for (const d of tmpDirs) {
    rmSync(d, { recursive: true, force: true });
  }
});

// ─── Cycle 1: sections ───────────────────────────────────────────────────────

describe('workflow.parse: sections', () => {
  it('parses ordered sections with level and position', () => {
    const file = makeTmpFile('# Title\n\nSome body.\n\n## Step 1\n\nMore.\n\n## Step 2\n\nMore.\n');
    const result = parseWorkflowFile(file, []);
    expect(result.sections.length).toBe(3);
    expect(result.sections[0]!.heading).toBe('Title');
    expect(result.sections[0]!.level).toBe(1);
    expect(result.sections[1]!.heading).toBe('Step 1');
    expect(result.sections[1]!.level).toBe(2);
    expect(result.sections[2]!.heading).toBe('Step 2');
    expect(result.sections[2]!.level).toBe(2);
    expect(result.sections[1]!.position).toBe(1);
    expect(result.sections[2]!.position).toBe(2);
  });

  it('assigns line_start correctly (1-indexed)', () => {
    const file = makeTmpFile('# H1\n\nBody.\n\n## H2\n\nMore.\n');
    const result = parseWorkflowFile(file, []);
    expect(result.sections[0]!.line_start).toBe(1);
    expect(result.sections[1]!.line_start).toBe(5);
  });

  it('sets parent_index for subsections', () => {
    const file = makeTmpFile('# Root\n\n## Child A\n\n### Grandchild\n\n## Child B\n');
    const result = parseWorkflowFile(file, []);
    // Root (idx 0), Child A (idx 1), Grandchild (idx 2), Child B (idx 3)
    expect(result.sections[0]!.parent_index).toBeNull();
    expect(result.sections[1]!.parent_index).toBe(0);
    expect(result.sections[2]!.parent_index).toBe(1);
    expect(result.sections[3]!.parent_index).toBe(0);
  });

  it('marks has_subsections for parents', () => {
    const file = makeTmpFile('# Root\n\n## Child\n\n### Sub\n');
    const result = parseWorkflowFile(file, []);
    expect(result.sections[0]!.has_subsections).toBe(true);   // Root has Child
    expect(result.sections[1]!.has_subsections).toBe(true);   // Child has Sub
    expect(result.sections[2]!.has_subsections).toBe(false);  // Sub is leaf
  });

  it('returns empty sections for file with no headings', () => {
    const file = makeTmpFile('Just a paragraph.\n\nNo headings here.\n');
    const result = parseWorkflowFile(file, []);
    expect(result.sections).toHaveLength(0);
  });

  it('handles all 6 heading levels', () => {
    const file = makeTmpFile('# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6\n');
    const result = parseWorkflowFile(file, []);
    expect(result.sections.map(s => s.level)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

// ─── Cycle 2: code_blocks ────────────────────────────────────────────────────

describe('workflow.parse: code_blocks', () => {
  it('detects a fenced block with a language tag', () => {
    const file = makeTmpFile('# Doc\n\n```bash\necho hello\n```\n');
    const result = parseWorkflowFile(file, []);
    expect(result.code_blocks).toHaveLength(1);
    expect(result.code_blocks[0]!.language).toBe('bash');
  });

  it('sets language=null for bare fence (MD040 violation)', () => {
    const file = makeTmpFile('# Doc\n\n```\nsome content\n```\n');
    const result = parseWorkflowFile(file, []);
    expect(result.code_blocks).toHaveLength(1);
    expect(result.code_blocks[0]!.language).toBeNull();
  });

  it('captures multiple blocks with correct line numbers', () => {
    const content = [
      '# Doc',
      '',
      '```ts',
      'const x = 1;',
      '```',
      '',
      '```json',
      '{"key": "value"}',
      '```',
    ].join('\n') + '\n';
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    expect(result.code_blocks).toHaveLength(2);
    expect(result.code_blocks[0]!.language).toBe('ts');
    expect(result.code_blocks[1]!.language).toBe('json');
  });

  it('records content_length > 0 for non-empty blocks', () => {
    const file = makeTmpFile('```bash\nline1\nline2\n```\n');
    const result = parseWorkflowFile(file, []);
    expect(result.code_blocks[0]!.content_length).toBeGreaterThan(0);
  });

  it('records line_start and line_end', () => {
    const file = makeTmpFile('# H\n\n```bash\ncode here\n```\n');
    const result = parseWorkflowFile(file, []);
    // Opening fence is line 3, so line_start = 3
    expect(result.code_blocks[0]!.line_start).toBe(3);
    // Closing fence is line 5
    expect(result.code_blocks[0]!.line_end).toBe(5);
  });

  it('captures unclosed fenced block at EOF without throwing', () => {
    // A markdown file with an unclosed ``` fence (malformed but present in the wild)
    const file = makeTmpFile('# Doc\n\n```bash\necho hello\n');
    const result = parseWorkflowFile(file, []);
    expect(result.code_blocks).toHaveLength(1);
    expect(result.code_blocks[0]!.language).toBe('bash');
    expect(result.code_blocks[0]!.line_start).toBe(3);
    // line_end should equal total_lines (no closing fence — entire remainder is the block)
    expect(result.code_blocks[0]!.line_end).toBe(result.total_lines);
  });
});

// ─── Cycle 3: asks ───────────────────────────────────────────────────────────

describe('workflow.parse: asks', () => {
  it('detects AskUserQuestion call sites', () => {
    const content = [
      '# Workflow',
      '',
      'AskUserQuestion("What is your name?")',
      'AskUserQuestion("What is your goal?")',
    ].join('\n');
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    expect(result.asks).toHaveLength(2);
    expect(result.asks[0]!.line).toBe(3);
    expect(result.asks[1]!.line).toBe(4);
  });

  it('detects vscode_askQuestions call sites', () => {
    const content = '# W\n\nvscode_askQuestions([{question: "role?"}])\n';
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    expect(result.asks).toHaveLength(1);
  });

  it('detects multiSelect=true', () => {
    const content = 'AskUserQuestion("Pick one", multiSelect=true)\n';
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    expect(result.asks[0]!.multiSelect).toBe(true);
  });

  it('populates question_excerpt with first 80 chars', () => {
    const longLine = 'AskUserQuestion("A ' + 'x'.repeat(100) + '")';
    const file = makeTmpFile(longLine);
    const result = parseWorkflowFile(file, []);
    expect(result.asks[0]!.question_excerpt).toHaveLength(80);
  });

  it('returns empty asks for file with no AskUserQuestion calls', () => {
    const file = makeTmpFile('# Doc\n\nNo asks here.\n');
    const result = parseWorkflowFile(file, []);
    expect(result.asks).toHaveLength(0);
  });
});

// ─── Cycle 4: references ─────────────────────────────────────────────────────

describe('workflow.parse: references', () => {
  it('captures at_include references', () => {
    const content = '@references/execute-mvp-tdd.md\n# H\n';
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    const atRef = result.references.find(r => r.kind === 'at_include');
    expect(atRef).toBeDefined();
    expect(atRef!.path).toBe('references/execute-mvp-tdd.md');
  });

  it('captures markdown_link references to .md files', () => {
    const content = '# H\n\nSee [the guide](references/planner-mvp-mode.md) for details.\n';
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    const linkRef = result.references.find(r => r.kind === 'markdown_link');
    expect(linkRef).toBeDefined();
    expect(linkRef!.path).toBe('references/planner-mvp-mode.md');
  });

  it('captures inline_path references', () => {
    const content = '# H\n\nSee references/spidr-splitting.md for rules.\n';
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    const inlineRef = result.references.find(r => r.kind === 'inline_path');
    expect(inlineRef).toBeDefined();
    expect(inlineRef!.path).toBe('references/spidr-splitting.md');
  });

  it('records line numbers for references', () => {
    const content = '# H\n\nSee references/execute-mvp-tdd.md here.\n';
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    expect(result.references[0]!.line).toBe(3);
  });

  it('returns empty references for file with none', () => {
    const file = makeTmpFile('# H\n\nNo references.\n');
    const result = parseWorkflowFile(file, []);
    expect(result.references).toHaveLength(0);
  });
});

// ─── Cycle 5: sdk_calls ──────────────────────────────────────────────────────

describe('workflow.parse: sdk_calls', () => {
  it('detects gsd-sdk query calls and extracts verb', () => {
    const content = [
      '# W',
      '',
      'MVP_MODE=$(gsd-sdk query phase.mvp-mode 1)',
      'TDD=$(gsd-sdk query config-get workflow.tdd_mode)',
    ].join('\n');
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    expect(result.sdk_calls).toHaveLength(2);
    expect(result.sdk_calls[0]!.verb).toBe('phase.mvp-mode');
    expect(result.sdk_calls[1]!.verb).toBe('config-get');
  });

  it('records line numbers for sdk_calls', () => {
    const content = '# H\n\nX=$(gsd-sdk query phase.mvp-mode 1)\n';
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    expect(result.sdk_calls[0]!.line).toBe(3);
  });

  it('stores condensed args_summary (max 80 chars)', () => {
    const content = 'X=$(gsd-sdk query phase.mvp-mode 1 --cli-flag --pick active)\n';
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    expect(result.sdk_calls[0]!.args_summary.length).toBeLessThanOrEqual(80);
    expect(result.sdk_calls[0]!.args_summary).toContain('--cli-flag');
  });

  it('returns empty sdk_calls for file with no gsd-sdk query lines', () => {
    const file = makeTmpFile('# H\n\nNo sdk calls here.\n');
    const result = parseWorkflowFile(file, []);
    expect(result.sdk_calls).toHaveLength(0);
  });
});

// ─── Cycle 6: conditionals ───────────────────────────────────────────────────

describe('workflow.parse: conditionals', () => {
  it('detects bash if with variable keyword', () => {
    const content = [
      '# W',
      '',
      'if [ "$MVP_MODE" = "true" ]; then',
      '  echo yes',
      'fi',
    ].join('\n');
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    const ifEntry = result.conditionals.find(c => c.branch === 'if');
    expect(ifEntry).toBeDefined();
    expect(ifEntry!.keyword).toBe('MVP_MODE');
  });

  it('detects elif branch', () => {
    const content = [
      '# W',
      '',
      'if [ "$MVP_MODE" = "true" ]; then',
      '  echo mvp',
      'elif [ "$TDD_MODE" = "true" ]; then',
      '  echo tdd',
      'fi',
    ].join('\n');
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    const elifEntry = result.conditionals.find(c => c.branch === 'elif');
    expect(elifEntry).toBeDefined();
    expect(elifEntry!.keyword).toBe('TDD_MODE');
  });

  it('detects else branch', () => {
    const content = [
      '# W',
      '',
      'if [ "$MVP_MODE" = "true" ]; then',
      '  echo mvp',
      'else',
      '  echo no',
      'fi',
    ].join('\n');
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    const elseEntry = result.conditionals.find(c => c.branch === 'else');
    expect(elseEntry).toBeDefined();
    expect(elseEntry!.keyword).toBeNull();
  });

  it('detects case statement with variable keyword', () => {
    const content = [
      '# W',
      '',
      'case $MVP_MODE in',
      '  true) echo yes ;;',
      'esac',
    ].join('\n');
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    const caseEntry = result.conditionals.find(c => c.branch === 'case');
    expect(caseEntry).toBeDefined();
    expect(caseEntry!.keyword).toBe('MVP_MODE');
  });

  it('records line_start for each conditional', () => {
    const content = '# H\n\nif [ "$FLAG" = "1" ]; then\n  x\nfi\n';
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    expect(result.conditionals[0]!.line_start).toBe(3);
  });
});

// ─── Cycle 7: bash_assignments ───────────────────────────────────────────────

describe('workflow.parse: bash_assignments', () => {
  it('detects top-level VAR= assignments', () => {
    const content = [
      '# W',
      '',
      'MVP_MODE=false',
      'TDD_MODE=true',
    ].join('\n');
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    const mvp = result.bash_assignments.find(a => a.var === 'MVP_MODE');
    expect(mvp).toBeDefined();
    expect(mvp!.value_excerpt).toBe('false');
  });

  it('detects readonly VAR= assignments', () => {
    const content = 'readonly PHASE_NUM=1\n';
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    const entry = result.bash_assignments.find(a => a.var === 'PHASE_NUM');
    expect(entry).toBeDefined();
  });

  it('captures value_excerpt up to 60 chars', () => {
    const longVal = 'x'.repeat(100);
    const file = makeTmpFile(`LONG_VAR=${longVal}\n`);
    const result = parseWorkflowFile(file, []);
    expect(result.bash_assignments[0]!.value_excerpt).toHaveLength(60);
  });

  it('records line numbers', () => {
    const content = '# H\n\nMVP_MODE=false\n';
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    expect(result.bash_assignments.find(a => a.var === 'MVP_MODE')!.line).toBe(3);
  });

  it('returns empty bash_assignments when none present', () => {
    const file = makeTmpFile('# H\n\nNo assignments.\n');
    const result = parseWorkflowFile(file, []);
    expect(result.bash_assignments).toHaveLength(0);
  });
});

// ─── Cycle 8: terms ──────────────────────────────────────────────────────────

describe('workflow.parse: terms', () => {
  it('finds a present term with correct count and first_line', () => {
    const content = '# H\n\nMVP_MODE is here.\nAnd MVP_MODE again.\n';
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, ['MVP_MODE', 'TDD_MODE']);
    const mvp = result.terms.find(t => t.term === 'MVP_MODE');
    expect(mvp).toBeDefined();
    expect(mvp!.count).toBe(2);
    expect(mvp!.first_line).toBe(3);
  });

  it('returns count=0 and first_line=null for absent term', () => {
    const file = makeTmpFile('# H\n\nNo special terms.\n');
    const result = parseWorkflowFile(file, ['MVP_MODE']);
    const mvp = result.terms.find(t => t.term === 'MVP_MODE');
    expect(mvp!.count).toBe(0);
    expect(mvp!.first_line).toBeNull();
  });

  it('handles all DEFAULT_TERMS without throwing', () => {
    const file = makeTmpFile('# H\n\nBody.\n');
    const result = parseWorkflowFile(file, DEFAULT_TERMS);
    expect(result.terms).toHaveLength(DEFAULT_TERMS.length);
  });

  it('supports custom terms via --terms arg in workflowParse handler', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wf-handler-'));
    tmpDirs.push(dir);
    const file = join(dir, 'test.md');
    writeFileSync(file, '# H\n\nvertical-slice approach here.\n');
    const result = await workflowParse(
      [file, "--terms='vertical-slice,walking-skeleton'"],
      dir
    );
    const vSlice = result.data.terms.find(t => t.term === 'vertical-slice');
    expect(vSlice!.count).toBeGreaterThan(0);
  });

  it('uses DEFAULT_TERMS when no --terms arg supplied', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wf-handler2-'));
    tmpDirs.push(dir);
    const file = join(dir, 'test.md');
    writeFileSync(file, '# H\n\nMVP_MODE is here.\n');
    const result = await workflowParse([file], dir);
    expect(result.data.terms.length).toBe(DEFAULT_TERMS.length);
    const mvp = result.data.terms.find(t => t.term === 'MVP_MODE');
    expect(mvp!.count).toBeGreaterThan(0);
  });
});

// ─── Cycle 9: top-level metadata ─────────────────────────────────────────────

describe('workflow.parse: metadata', () => {
  it('populates path, size_bytes, total_lines', () => {
    const content = '# H\n\nBody.\n';
    const file = makeTmpFile(content);
    const result = parseWorkflowFile(file, []);
    expect(result.path).toBe(file);
    expect(result.size_bytes).toBeGreaterThan(0);
    expect(result.total_lines).toBeGreaterThan(0);
  });
});

// ─── Cycle 10: handler throws without args ────────────────────────────────────

describe('workflow.parse: handler validation', () => {
  it('throws GSDError when called with no args', async () => {
    await expect(workflowParse([], process.cwd())).rejects.toThrow('Usage: workflow.parse');
  });
});

// ─── Cycle 11: integration test against real plan-phase.md ───────────────────

describe('workflow.parse: integration — real plan-phase.md', () => {
  it('parses real plan-phase.md with expected MVP/TDD structure', () => {
    const planPhasePath = join(
      '/Users/trekkie/projects/get-shit-done',
      'get-shit-done/workflows/plan-phase.md'
    );
    const result = parseWorkflowFile(planPhasePath, DEFAULT_TERMS);

    // Should have a substantial number of sections
    expect(result.sections.length).toBeGreaterThan(5);

    // Must have the phase.mvp-mode SDK call
    expect(result.sdk_calls.some(c => c.verb === 'phase.mvp-mode')).toBe(true);

    // MVP_MODE term must appear
    const mvpTerm = result.terms.find(t => t.term === 'MVP_MODE');
    expect(mvpTerm!.count).toBeGreaterThan(0);

    // Must have code blocks (workflow has bash blocks)
    expect(result.code_blocks.length).toBeGreaterThan(0);

    // Must have bash_assignments (MVP_MODE, TDD_MODE, etc.)
    expect(result.bash_assignments.length).toBeGreaterThan(0);

    // --mvp term should be present (argument flag documented in workflow)
    const mvpFlag = result.terms.find(t => t.term === '--mvp');
    expect(mvpFlag!.count).toBeGreaterThan(0);
  });
});
