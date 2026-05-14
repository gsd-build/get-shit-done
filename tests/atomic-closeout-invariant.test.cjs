//
// Tests that the atomic close-out invariant is documented and that the
// gsd-executor agent prompt carries the producer-side callout pointing to
// the canonical doc. Closes #3212 (documentation gate, Stage A).
//
// These checks parse markdown headings/tables and XML-like prompt blocks.
// They assert on structural fields, not raw source-text presence.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const DOC_PATH = path.join(REPO_ROOT, 'docs', 'ATOMIC-CLOSEOUT-INVARIANT.md');
const EXECUTOR_PATH = path.join(REPO_ROOT, 'agents', 'gsd-executor.md');

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
}

function normalizeMarkdownText(value) {
  return value
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHeading(line, lineNumber) {
  const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
  if (!heading) return null;
  return {
    level: heading[1].length,
    title: normalizeMarkdownText(heading[2]),
    lineNumber,
    endLine: null,
    children: [],
  };
}

function parseMarkdownDocument(filePath) {
  const lines = readLines(filePath);
  const root = { level: 0, title: '<root>', lineNumber: -1, endLine: lines.length, children: [] };
  const headings = [];
  const stack = [root];
  let inFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim().slice(0, 3) === '```') {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = parseHeading(lines[i], i);
    if (!heading) continue;

    while (stack[stack.length - 1].level >= heading.level) stack.pop();
    stack[stack.length - 1].children.push(heading);
    stack.push(heading);
    headings.push(heading);
  }

  for (let i = 0; i < headings.length; i += 1) {
    const current = headings[i];
    const nextPeer = headings
      .slice(i + 1)
      .find(candidate => candidate.level <= current.level);
    current.endLine = nextPeer ? nextPeer.lineNumber : lines.length;
  }

  return { lines, root, headings };
}

function findHeading(doc, title) {
  const normalizedTitle = normalizeMarkdownText(title);
  return doc.headings.find(heading => heading.title === normalizedTitle);
}

function splitTableRow(line) {
  const trimmed = line.trim();
  const body = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return body.split('|').map(cell => normalizeMarkdownText(cell));
}

function isTableRow(line) {
  const trimmed = line.trim();
  return trimmed.length > 1 && trimmed[0] === '|' && trimmed[trimmed.length - 1] === '|';
}

function isSeparatorRow(cells) {
  return cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')));
}

function parseTablesInSection(doc, section) {
  const tables = [];
  let lineNumber = section.lineNumber + 1;

  while (lineNumber < section.endLine) {
    if (!isTableRow(doc.lines[lineNumber])) {
      lineNumber += 1;
      continue;
    }

    const rawRows = [];
    while (lineNumber < section.endLine && isTableRow(doc.lines[lineNumber])) {
      rawRows.push(splitTableRow(doc.lines[lineNumber]));
      lineNumber += 1;
    }

    if (rawRows.length >= 2 && isSeparatorRow(rawRows[1])) {
      tables.push({ header: rawRows[0], rows: rawRows.slice(2) });
    }
  }

  return tables;
}

function parseCodeFencesInSection(doc, section) {
  const fences = [];
  let current = null;

  for (let lineNumber = section.lineNumber + 1; lineNumber < section.endLine; lineNumber += 1) {
    const fence = doc.lines[lineNumber].trim().match(/^```(\S*)\s*$/);
    if (!fence) {
      if (current) current.lines.push(doc.lines[lineNumber]);
      continue;
    }

    if (current) {
      current.endLine = lineNumber;
      fences.push(current);
      current = null;
    } else {
      current = { info: fence[1], startLine: lineNumber, endLine: null, lines: [] };
    }
  }

  return fences;
}

function shellCommandTokensFromFence(fence) {
  return fence.lines
    .map(line => line.trim())
    .filter(line => line.length > 0 && line[0] !== '#')
    .map(line => line.split(/\s+/));
}

function parseAttributes(source) {
  const attrs = {};
  if (!source) return attrs;
  const attrRe = /([A-Za-z_][\w-]*)="([^"]*)"/g;
  let match;
  while ((match = attrRe.exec(source)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function parsePromptBlocks(filePath) {
  const lines = readLines(filePath);
  const blocks = [];
  const stack = [];
  let inFence = false;

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const trimmed = lines[lineNumber].trim();
    if (trimmed.slice(0, 3) === '```') {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const opening = trimmed.match(/^<([A-Za-z_][\w-]*)(?:\s+([^>]*))?>$/);
    if (opening) {
      stack.push({
        tag: opening[1],
        attrs: parseAttributes(opening[2]),
        startLine: lineNumber,
        endLine: null,
      });
      continue;
    }

    const closing = trimmed.match(/^<\/([A-Za-z_][\w-]*)>$/);
    if (!closing) continue;

    const open = stack.pop();
    if (open && open.tag === closing[1]) {
      open.endLine = lineNumber;
      blocks.push(open);
    }
  }

  return { lines, blocks };
}

function findPromptBlock(prompt, tag, attrs = {}) {
  return prompt.blocks.find(block => {
    if (block.tag !== tag) return false;
    return Object.entries(attrs).every(([key, value]) => block.attrs[key] === value);
  });
}

function findPromptSection(prompt, name) {
  return findPromptBlock(prompt, name) || findPromptBlock(prompt, 'step', { name });
}

function blockBodyLines(prompt, block) {
  return prompt.lines.slice(block.startLine + 1, block.endLine);
}

function parseInlineCodeSpans(lines) {
  const spans = [];
  for (const line of lines) {
    const spanRe = /`([^`]+)`/g;
    let match;
    while ((match = spanRe.exec(line)) !== null) {
      spans.push(match[1]);
    }
  }
  return spans;
}

function parseOrderedListFirstCodeSpans(lines) {
  const items = [];
  for (const line of lines) {
    const ordered = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (!ordered) continue;
    const firstCodeSpan = parseInlineCodeSpans([ordered[2]])[0];
    if (!firstCodeSpan) continue;
    if (firstCodeSpan[0] !== '<') continue;
    if (firstCodeSpan[firstCodeSpan.length - 1] !== '>') continue;
    items.push({ number: Number(ordered[1]), code: firstCodeSpan });
  }
  return items;
}

describe('atomic close-out invariant doc (#3212)', () => {
  test('docs/ATOMIC-CLOSEOUT-INVARIANT.md exists', () => {
    assert.ok(
      fs.existsSync(DOC_PATH),
      'docs/ATOMIC-CLOSEOUT-INVARIANT.md must exist as the canonical home for the invariant'
    );
  });

  test('doc declares the four artifacts that must land together', () => {
    const doc = parseMarkdownDocument(DOC_PATH);
    const section = findHeading(doc, 'The four artifacts');
    assert.ok(section, 'doc must have a "The four artifacts" heading');

    const [table] = parseTablesInSection(doc, section);
    assert.ok(table, 'artifact section must contain a markdown table');
    assert.deepEqual(table.header, ['#', 'Artifact', 'Where it lives', 'What it proves']);
    assert.deepEqual(
      table.rows.map(row => row[1]),
      [
        'Per-task production commits',
        '{phase}-{plan}-SUMMARY.md',
        'STATE.md advanced',
        'ROADMAP.md updated',
      ],
    );
  });

  test('doc enumerates drift states A-D in the drift table', () => {
    const doc = parseMarkdownDocument(DOC_PATH);
    const section = findHeading(doc, 'Possible inconsistent states');
    assert.ok(section, 'doc must have a "Possible inconsistent states" heading');

    const [table] = parseTablesInSection(doc, section);
    assert.ok(table, 'drift section must contain a markdown table');
    assert.deepEqual(table.header, [
      'State',
      'Production commits?',
      'SUMMARY.md?',
      'STATE advanced?',
      'ROADMAP updated?',
      'Meaning',
    ]);
    assert.deepEqual(
      table.rows.map(row => row[0]),
      [
        'Consistent: not started',
        'Consistent: complete',
        'Drift A: stalled mid-execute',
        'Drift B: SUMMARY without state',
        'Drift C: state without SUMMARY',
        'Drift D: phantom done',
      ],
    );
  });

  test('doc shows the plan.consistency-check handler in the consumer command block', () => {
    const doc = parseMarkdownDocument(DOC_PATH);
    const section = findHeading(doc, 'Consumer-side responsibilities (resume / dispatch)');
    assert.ok(section, 'doc must have a consumer-side responsibilities heading');

    const commands = parseCodeFencesInSection(doc, section)
      .flatMap(shellCommandTokensFromFence)
      .filter(tokens => tokens[0] === 'gsd-sdk' && tokens[1] === 'query');
    const handlerCommand = commands.find(tokens => tokens[2] === 'plan.consistency-check');
    assert.ok(handlerCommand, 'consumer code fence must demonstrate the SDK handler name workflows call');
    assert.deepEqual(
      handlerCommand.slice(0, 3),
      ['gsd-sdk', 'query', 'plan.consistency-check'],
      'consumer code fence must demonstrate the SDK handler name workflows call'
    );
  });
});

describe('gsd-executor agent carries the invariant callout (#3212)', () => {
  test('agents/gsd-executor.md contains a closed atomic_closeout_invariant block', () => {
    const prompt = parsePromptBlocks(EXECUTOR_PATH);
    assert.ok(
      findPromptBlock(prompt, 'atomic_closeout_invariant'),
      'executor agent prompt must declare a closed atomic_closeout_invariant block'
    );
  });

  test('callout points to canonical doc path through an inline code token', () => {
    const prompt = parsePromptBlocks(EXECUTOR_PATH);
    const callout = findPromptBlock(prompt, 'atomic_closeout_invariant');
    assert.ok(callout, 'sanity: callout block exists');
    assert.ok(
      parseInlineCodeSpans(blockBodyLines(prompt, callout)).some(span => span === 'docs/ATOMIC-CLOSEOUT-INVARIANT.md'),
      'callout must point to the canonical doc through a structured markdown code token'
    );
  });

  test('callout sits between execution_flow and deviation_rules blocks', () => {
    const prompt = parsePromptBlocks(EXECUTOR_PATH);
    const executionFlow = findPromptBlock(prompt, 'execution_flow');
    const callout = findPromptBlock(prompt, 'atomic_closeout_invariant');
    const deviationRules = findPromptBlock(prompt, 'deviation_rules');
    assert.ok(executionFlow, 'sanity: execution_flow block exists');
    assert.ok(callout, 'sanity: callout block exists');
    assert.ok(deviationRules, 'sanity: deviation_rules block exists');
    assert.ok(
      executionFlow.endLine < callout.startLine && callout.endLine < deviationRules.startLine,
      'callout must sit between execution_flow and deviation_rules so executor reads it before deviation rules are applied'
    );
  });

  test('callout enumerates the five-step sequence as prompt section references', () => {
    const prompt = parsePromptBlocks(EXECUTOR_PATH);
    const callout = findPromptBlock(prompt, 'atomic_closeout_invariant');
    assert.ok(callout, 'sanity: callout block exists');

    const sequence = parseOrderedListFirstCodeSpans(blockBodyLines(prompt, callout));
    assert.deepEqual(
      sequence.map(item => item.code),
      ['<execute_tasks>', '<self_check>', '<summary_creation>', '<state_updates>', '<final_commit>']
    );
    assert.deepEqual(sequence.map(item => item.number), [1, 2, 3, 4, 5]);

    for (const item of sequence) {
      const sectionName = item.code.slice(1, item.code.length - 1);
      assert.ok(
        findPromptSection(prompt, sectionName),
        `callout sequence item ${item.code} must reference a structured prompt section`
      );
    }
  });
});
