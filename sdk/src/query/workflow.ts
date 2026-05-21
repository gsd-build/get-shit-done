/**
 * workflow.parse — structural IR for workflow/agent/reference markdown files.
 *
 * Parses a markdown file and returns a typed WorkflowParseResult covering:
 *   - sections (headings, level, ordering, parent)
 *   - code_blocks (fenced blocks, language tag — null = MD040 violation)
 *   - asks (AskUserQuestion call sites)
 *   - references (at includes, markdown links, bare path mentions)
 *   - sdk_calls (gsd-sdk query invocations)
 *   - conditionals (bash if/elif/else/case branches with extracted keyword)
 *   - bash_assignments (VAR= or readonly VAR= top-level lines)
 *   - terms (presence lookup for configurable term list)
 *
 * Foundation for retrofitting 11 source-grep tests in the #2826 audit.
 *
 * Usage:
 *   gsd-sdk query workflow.parse <path> [--terms='MVP_MODE,vertical-slice,...']
 */

import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { GSDError, ErrorClassification } from '../errors.js';
import type { QueryHandler } from './utils.js';

// ─── Public types ────────────────────────────────────────────────────────────

export interface SectionEntry {
  /** Raw text after the # signs (trimmed). */
  heading: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  /** 0-indexed document order. */
  position: number;
  line_start: number;
  line_end: number;
  has_subsections: boolean;
  /** Index into sections array; null for top-level. */
  parent_index: number | null;
}

export interface AskEntry {
  line: number;
  multiSelect: boolean | null;
  /** First ~80 chars of the surrounding line. */
  question_excerpt: string;
}

export interface CodeBlockEntry {
  /** null = bare fence (MD040 violation). */
  language: string | null;
  line_start: number;
  line_end: number;
  content_length: number;
}

export interface ReferenceEntry {
  path: string;
  line: number;
  kind: 'at_include' | 'markdown_link' | 'inline_path';
}

export interface SdkCallEntry {
  /** e.g. "phase.mvp-mode" */
  verb: string;
  /** condensed args after the verb */
  args_summary: string;
  line: number;
}

export interface ConditionalEntry {
  line_start: number;
  line_end: number;
  /** Extracted variable name (MVP_MODE, TDD_MODE, etc.) or null if not identifiable. */
  keyword: string | null;
  branch: 'if' | 'elif' | 'else' | 'case';
}

export interface AssignmentEntry {
  var: string;
  line: number;
  /** First 60 chars of the assigned value. */
  value_excerpt: string;
}

export interface TermPresence {
  term: string;
  count: number;
  /** null when not present. */
  first_line: number | null;
}

export interface WorkflowParseResult {
  path: string;
  size_bytes: number;
  total_lines: number;
  sections: SectionEntry[];
  asks: AskEntry[];
  code_blocks: CodeBlockEntry[];
  references: ReferenceEntry[];
  sdk_calls: SdkCallEntry[];
  conditionals: ConditionalEntry[];
  bash_assignments: AssignmentEntry[];
  terms: TermPresence[];
}

// ─── Default term seed list ──────────────────────────────────────────────────

export const DEFAULT_TERMS: readonly string[] = [
  'MVP_MODE',
  'TDD_MODE',
  'WALKING_SKELETON',
  'SKELETON_EXISTS',
  'vertical-slice',
  'walking-skeleton',
  'Walking Skeleton',
  'SPIDR',
  'user-story',
  'As a',
  'I want to',
  'so that',
  'RED commit',
  'GREEN commit',
  'behavior-adding',
  'slice plan',
  '--mvp',
  '--tdd',
  '--no-mvp',
  '--no-tdd',
];

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse a single markdown file into a WorkflowParseResult.
 * Exported for direct use in unit tests.
 */
export function parseWorkflowFile(filePath: string, termList: readonly string[]): WorkflowParseResult {
  const content = readFileSync(filePath, 'utf-8');
  const stat = statSync(filePath);
  const lines = content.split(/\r?\n/);

  // ── sections ────────────────────────────────────────────────────────────────
  const sections: SectionEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = line.match(/^(#{1,6})\s+(.*)/);
    if (!m) continue;
    const level = m[1]!.length as 1 | 2 | 3 | 4 | 5 | 6;
    const heading = m[2]!.trim();
    sections.push({
      heading,
      level,
      position: sections.length,
      line_start: i + 1,
      line_end: -1,
      has_subsections: false,
      parent_index: null,
    });
  }

  // Compute line_end for each section
  for (let si = 0; si < sections.length; si++) {
    const s = sections[si]!;
    let endLine = lines.length;
    for (let sj = si + 1; sj < sections.length; sj++) {
      if (sections[sj]!.level <= s.level) {
        endLine = sections[sj]!.line_start - 1;
        break;
      }
    }
    s.line_end = endLine;
  }

  // Compute parent_index and has_subsections
  const parentStack: number[] = [];
  for (let si = 0; si < sections.length; si++) {
    const s = sections[si]!;
    while (parentStack.length > 0) {
      const topIdx = parentStack[parentStack.length - 1]!;
      if (sections[topIdx]!.level >= s.level) {
        parentStack.pop();
      } else {
        break;
      }
    }
    if (parentStack.length > 0) {
      const parentIdx = parentStack[parentStack.length - 1]!;
      s.parent_index = parentIdx;
      sections[parentIdx]!.has_subsections = true;
    }
    parentStack.push(si);
  }

  // ── code_blocks ─────────────────────────────────────────────────────────────
  const code_blocks: CodeBlockEntry[] = [];
  let inBlock = false;
  let blockLang: string | null = null;
  let blockStart = 0;
  let blockContentLen = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!inBlock) {
      const openM = line.match(/^```(.*)$/);
      if (openM) {
        inBlock = true;
        const langRaw = openM[1]!.trim();
        blockLang = langRaw.length > 0 ? langRaw : null;
        blockStart = i + 1;
        blockContentLen = 0;
      }
    } else {
      if (line.match(/^```\s*$/)) {
        code_blocks.push({
          language: blockLang,
          line_start: blockStart,
          line_end: i + 1,
          content_length: blockContentLen,
        });
        inBlock = false;
      } else {
        blockContentLen += line.length + 1;
      }
    }
  }
  // Unclosed fenced block at EOF — push what we have (language=null signals MD040 violation)
  if (inBlock) {
    code_blocks.push({
      language: blockLang,
      line_start: blockStart,
      line_end: lines.length,
      content_length: blockContentLen,
    });
  }

  // ── asks ────────────────────────────────────────────────────────────────────
  const asks: AskEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lower = line.toLowerCase();
    if (lower.includes('askuserquestion') || lower.includes('vscode_askquestions')) {
      const multiSelectMatch = lower.includes('multiselect=true') || lower.includes('multi_select: true')
        ? true
        : lower.includes('multiselect=false') || lower.includes('multi_select: false')
          ? false
          : null;
      asks.push({
        line: i + 1,
        multiSelect: multiSelectMatch,
        question_excerpt: line.slice(0, 80),
      });
    }
  }

  // ── references ──────────────────────────────────────────────────────────────
  const references: ReferenceEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // @include style: line starting with @
    const atM = line.match(/^@(~?\/[^\s]+|[a-zA-Z0-9._~/-]+\.md)/);
    if (atM) {
      references.push({ path: atM[1]!, line: i + 1, kind: 'at_include' });
    }

    // Markdown links to .md files
    const mdRe = /\[([^\]]*)\]\(([^)]+)\)/g;
    let mdM: RegExpExecArray | null;
    while ((mdM = mdRe.exec(line)) !== null) {
      const href = mdM[2]!;
      if (href.endsWith('.md') || href.includes('.md#')) {
        references.push({ path: href, line: i + 1, kind: 'markdown_link' });
      }
    }

    // Bare paths like references/X.md, workflows/Y.md, etc.
    const ipRe = /\b((?:references|workflows|agents|commands)\/[^\s,'"`)]+\.md)/g;
    let ipM: RegExpExecArray | null;
    while ((ipM = ipRe.exec(line)) !== null) {
      const candidate = ipM[1]!;
      const alreadyCaptured = references.some(
        r => r.line === i + 1 && r.path.includes(candidate)
      );
      if (!alreadyCaptured) {
        references.push({ path: candidate, line: i + 1, kind: 'inline_path' });
      }
    }
  }

  // ── sdk_calls ────────────────────────────────────────────────────────────────
  const sdk_calls: SdkCallEntry[] = [];
  const sdkRe = /gsd-sdk\s+query\s+(\S+)(.*)/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = line.match(sdkRe);
    if (m) {
      const verb = m[1]!.trim();
      const argsSummary = (m[2] ?? '').trim().slice(0, 80);
      sdk_calls.push({ verb, args_summary: argsSummary, line: i + 1 });
    }
  }

  // ── conditionals ────────────────────────────────────────────────────────────
  const conditionals: ConditionalEntry[] = [];
  const ifRe = /^\s*(if|elif)\s+(.+)/;
  const elseRe = /^\s*else\s*(?:;.*)?$/;
  const caseRe = /^\s*case\s+(\S+)\s+in/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    const ifM = line.match(ifRe);
    if (ifM) {
      const branch = ifM[1] as 'if' | 'elif';
      const expr = ifM[2]!;
      let endLine = i + 1;
      const indentM = line.match(/^(\s*)/);
      const indent = indentM ? indentM[1]!.length : 0;
      for (let j = i + 1; j < lines.length; j++) {
        const jline = lines[j]!;
        const jIndentM = jline.match(/^(\s*)/);
        const jIndent = jIndentM ? jIndentM[1]!.length : 0;
        if (jIndent === indent && /^\s*fi\b/.test(jline)) {
          endLine = j + 1;
          break;
        }
      }
      // Extract the most prominent shell variable from the condition
      const vars: string[] = [];
      const exprRe = /\$\{?([A-Z_]{3,})\}?|\b([A-Z_]{4,})\b/g;
      let vm: RegExpExecArray | null;
      while ((vm = exprRe.exec(expr)) !== null) {
        vars.push(vm[1] ?? vm[2] ?? '');
      }
      conditionals.push({
        line_start: i + 1,
        line_end: endLine,
        keyword: vars[0] ?? null,
        branch,
      });
      continue;
    }

    if (elseRe.test(line)) {
      conditionals.push({
        line_start: i + 1,
        line_end: i + 1,
        keyword: null,
        branch: 'else',
      });
      continue;
    }

    const caseM = line.match(caseRe);
    if (caseM) {
      const caseVar = caseM[1]!.replace(/^\$\{?/, '').replace(/\}?$/, '');
      conditionals.push({
        line_start: i + 1,
        line_end: i + 1,
        keyword: caseVar.match(/^[A-Z_]{2,}$/) ? caseVar : null,
        branch: 'case',
      });
    }
  }

  // ── bash_assignments ─────────────────────────────────────────────────────────
  const bash_assignments: AssignmentEntry[] = [];
  const assignRe = /^(?:readonly\s+)?([A-Z_][A-Z0-9_]{1,})=(.*)/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('#')) continue;
    const m = line.match(assignRe);
    if (m) {
      bash_assignments.push({
        var: m[1]!,
        line: i + 1,
        value_excerpt: (m[2] ?? '').slice(0, 60),
      });
    }
  }

  // ── terms ────────────────────────────────────────────────────────────────────
  const terms: TermPresence[] = termList.map(term => {
    let count = 0;
    let first_line: number | null = null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.includes(term)) {
        count++;
        if (first_line === null) first_line = i + 1;
      }
    }
    return { term, count, first_line };
  });

  return {
    path: filePath,
    size_bytes: stat.size,
    total_lines: lines.length,
    sections,
    asks,
    code_blocks,
    references,
    sdk_calls,
    conditionals,
    bash_assignments,
    terms,
  };
}

// ─── QueryHandler ────────────────────────────────────────────────────────────

/**
 * Parse a workflow/agent/reference markdown file into a typed IR.
 *
 * @example
 *   gsd-sdk query workflow.parse get-shit-done/workflows/plan-phase.md
 *   gsd-sdk query workflow.parse agents/gsd-executor.md --terms='MVP_MODE,TDD_MODE'
 */
export const workflowParse: QueryHandler<WorkflowParseResult> = async (args, projectDir) => {
  const filePath = args[0];
  if (!filePath) {
    throw new GSDError(
      'Usage: workflow.parse <file-path> [--terms=\'term1,term2,...\']',
      ErrorClassification.Validation,
    );
  }

  const root = resolve(projectDir ?? process.cwd());
  const absPath = resolve(root, filePath);

  // Parse --terms arg
  const termsArg = args.find(a => a.startsWith('--terms='));
  const termList: readonly string[] = termsArg
    ? termsArg
        .slice('--terms='.length)
        // Strip optional surrounding single or double quotes
        .replace(/^['"]/, '').replace(/['"]$/, '')
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
    : DEFAULT_TERMS;

  const result = parseWorkflowFile(absPath, termList);
  return { data: result };
};
