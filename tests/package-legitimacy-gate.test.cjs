'use strict';

/**
 * Package Legitimacy Gate — structural contract tests (#2827)
 *
 * Verifies that the three agents (researcher, planner, executor) contain the
 * interlocking instruction text that forms the slopsquatting defence gate.
 */

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const AGENTS = path.join(__dirname, '..', 'agents');
const RESEARCHER = path.join(AGENTS, 'gsd-phase-researcher.md');
const PLANNER = path.join(AGENTS, 'gsd-planner.md');
const EXECUTOR = path.join(AGENTS, 'gsd-executor.md');

function parseSections(md) {
  const lines = md.split('\n');
  const sections = [];
  let current = { heading: '__preamble__', body: [] };
  let inFence = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) inFence = !inFence;
    if (!inFence && /^#{1,3} /.test(line)) {
      sections.push(current);
      current = { heading: line.replace(/^#+\s*/, '').trim(), body: [] };
      continue;
    }
    current.body.push(line);
  }

  sections.push(current);
  return sections;
}

function extractCodeBlocks(text) {
  const blocks = [];
  const lines = text.split('\n');
  let inside = false;
  let buf = [];

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (inside) {
        blocks.push(buf.join('\n'));
        buf = [];
      }
      inside = !inside;
      continue;
    }
    if (inside) buf.push(line);
  }

  return blocks;
}

function extractResearchTemplate(content) {
  const lines = content.split('\n');
  let inside = false;
  let isMarkdownFence = false;
  let buf = [];

  for (const line of lines) {
    if (!inside && line.startsWith('```markdown')) {
      inside = true;
      isMarkdownFence = true;
      buf = [];
      continue;
    }

    if (inside && line.startsWith('```') && isMarkdownFence) {
      const candidate = buf.join('\n');
      if (/^\s*#\s+Phase\b/m.test(candidate)) return candidate;
      inside = false;
      isMarkdownFence = false;
      continue;
    }

    if (inside) buf.push(line);
  }

  return '';
}

function extractPlanTemplate(content) {
  const blocks = extractCodeBlocks(content);
  for (const block of blocks) {
    if (/^\s*<threat_model>/m.test(block)) return block;
  }
  return '';
}

function extractXmlElement(text, tag) {
  const start = text.indexOf(`<${tag}>`);
  const end = text.indexOf(`</${tag}>`);
  if (start === -1 || end === -1) return '';
  return text.slice(start, end + tag.length + 3);
}

function normalizeTokens(text) {
  return text
    .toLowerCase()
    .replace(/https?:\/\//g, ' ')
    .replace(/[\[\]]/g, '')
    .replace(/[^a-z0-9{}:_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function hasAllTokens(text, required) {
  const tokenSet = new Set(normalizeTokens(text));
  return required.every((token) => tokenSet.has(token.toLowerCase()));
}

function anyLineHasAll(lines, required) {
  return lines.some((line) => hasAllTokens(line, required));
}

function parseMarkdownTable(lines) {
  const tableLines = lines.filter((line) => /^\s*\|/.test(line));
  if (tableLines.length < 2) return null;

  const toCells = (line) => line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

  const headers = toCells(tableLines[0]);
  const rows = tableLines
    .slice(2)
    .map(toCells)
    .filter((cells) => cells.length === headers.length)
    .map((cells) => ({
      cells,
      fields: Object.fromEntries(headers.map((h, i) => [h, cells[i]])),
    }));

  return { headers, rows };
}

function parseMarkdownTables(lines) {
  const groups = [];
  let current = [];

  for (const line of lines) {
    if (/^\s*\|/.test(line)) {
      current.push(line);
      continue;
    }
    if (current.length > 0) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) groups.push(current);

  return groups
    .map((group) => parseMarkdownTable(group))
    .filter(Boolean);
}

function lineIndexes(lines, predicate) {
  const indexes = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (predicate(lines[i], i)) indexes.push(i);
  }
  return indexes;
}

function inNearbyWindow(sourceIndexes, targetIndexes, distance) {
  return sourceIndexes.some((src) => targetIndexes.some((dst) => Math.abs(src - dst) <= distance));
}

function readModel(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  return {
    text,
    lines: text.split('\n'),
    sections: parseSections(text),
    codeBlocks: extractCodeBlocks(text),
  };
}

describe('gsd-phase-researcher.md — slopcheck invocation', () => {
  let model;

  before(() => {
    model = readModel(RESEARCHER);
  });

  test('contains slopcheck install command in a fenced code block', () => {
    const found = model.codeBlocks.some((block) => hasAllTokens(block, ['slopcheck', 'install']));
    assert.ok(found, 'researcher must invoke slopcheck install inside a fenced code block');
  });

  test('slopcheck invocation includes --json flag', () => {
    const found = model.codeBlocks.some((block) =>
      hasAllTokens(block, ['slopcheck', 'install']) && hasAllTokens(block, ['json'])
    );
    assert.ok(found, 'slopcheck invocation must pass --json');
  });

  test('guards slopcheck invocation with command availability check', () => {
    const hasCommandV = model.codeBlocks.some((block) => hasAllTokens(block, ['command', '-v', 'slopcheck']));
    const hasWhich = model.codeBlocks.some((block) => hasAllTokens(block, ['which', 'slopcheck']));
    assert.ok(hasCommandV || hasWhich, 'researcher must guard slopcheck invocation with command -v or which');
  });

  test('documents graceful degradation when slopcheck is unavailable', () => {
    const hasAssumedLine = anyLineHasAll(model.lines, ['assumed']);
    const hasSlopcheckUnavailableLine = model.lines.some((line) => {
      const slopcheckMention = hasAllTokens(line, ['slopcheck']);
      const unavailableMention =
        hasAllTokens(line, ['not', 'available']) ||
        hasAllTokens(line, ['not', 'found']) ||
        hasAllTokens(line, ['unavailable']) ||
        hasAllTokens(line, ['cannot', 'installed']);
      return slopcheckMention && unavailableMention;
    });

    assert.ok(
      hasAssumedLine && hasSlopcheckUnavailableLine,
      'researcher must document [ASSUMED] fallback when slopcheck cannot run'
    );
  });
});

describe('gsd-phase-researcher.md — Package Legitimacy Audit section in template', () => {
  let templateSections;

  before(() => {
    const model = readModel(RESEARCHER);
    const template = extractResearchTemplate(model.text);
    templateSections = parseSections(template);
  });

  test('RESEARCH.md template contains Package Legitimacy Audit section', () => {
    const section = templateSections.find((s) => s.heading === 'Package Legitimacy Audit');
    assert.ok(section, 'RESEARCH.md template must include a Package Legitimacy Audit section');
  });

  test('Package Legitimacy Audit table has required columns', () => {
    const section = templateSections.find((s) => s.heading === 'Package Legitimacy Audit');
    assert.ok(section, 'Package Legitimacy Audit section must exist');

    const table = parseMarkdownTable(section.body);
    assert.ok(table, 'Package Legitimacy Audit section must include a markdown table');

    const expected = ['Package', 'Registry', 'Age', 'Downloads', 'slopcheck', 'Disposition'];
    for (const column of expected) {
      assert.ok(table.headers.includes(column), `audit table must have "${column}" column`);
    }
  });

  test('audit section documents [SLOP], [SUS], and [OK] dispositions', () => {
    const section = templateSections.find((s) => s.heading === 'Package Legitimacy Audit');
    assert.ok(section, 'Package Legitimacy Audit section must exist');

    const table = parseMarkdownTable(section.body);
    assert.ok(table, 'Package Legitimacy Audit section must include a markdown table');

    const rowTexts = table.rows.map((row) => row.cells.join(' '));
    const slop = rowTexts.some((value) => hasAllTokens(value, ['slop']));
    const sus = rowTexts.some((value) => hasAllTokens(value, ['sus']));
    const ok = rowTexts.some((value) => hasAllTokens(value, ['ok']));

    assert.ok(slop, 'audit section must document [SLOP] disposition');
    assert.ok(sus, 'audit section must document [SUS] disposition');
    assert.ok(ok, 'audit section must document [OK] disposition');
  });
});

describe('gsd-phase-researcher.md — ecosystem-specific package verification', () => {
  let model;

  before(() => {
    model = readModel(RESEARCHER);
  });

  test('documents pip index versions for Python phases', () => {
    assert.ok(anyLineHasAll(model.lines, ['pip', 'index', 'versions']), 'researcher must document pip index versions');
  });

  test('documents cargo search for Rust phases', () => {
    assert.ok(anyLineHasAll(model.lines, ['cargo', 'search']), 'researcher must document cargo search');
  });
});

describe('gsd-phase-researcher.md — no npx --yes auto-download', () => {
  let model;

  before(() => {
    model = readModel(RESEARCHER);
  });

  test('does not invoke npx --yes inside a code block', () => {
    const found = model.codeBlocks.some((block) => hasAllTokens(block, ['npx', '--yes']));
    assert.equal(found, false, 'researcher must not invoke npx --yes in any code block');
  });

  test('ctx7 CLI fallback uses command -v guard', () => {
    const found = model.codeBlocks.some((block) => hasAllTokens(block, ['command', '-v', 'ctx7']));
    assert.ok(found, 'ctx7 CLI fallback must guard with command -v ctx7 before invocation');
  });
});

describe('gsd-phase-researcher.md — WebSearch-origin package tagging', () => {
  let model;

  before(() => {
    model = readModel(RESEARCHER);
  });

  test('packages discovered via WebSearch are tagged [ASSUMED]', () => {
    const webSearchLines = lineIndexes(model.lines, (line) => hasAllTokens(line, ['websearch']));
    const assumedLines = lineIndexes(model.lines, (line) => hasAllTokens(line, ['assumed']));

    assert.ok(webSearchLines.length > 0, 'researcher file must mention WebSearch');
    assert.ok(assumedLines.length > 0, 'researcher file must mention [ASSUMED]');
    assert.ok(
      inNearbyWindow(webSearchLines, assumedLines, 25),
      'researcher must instruct WebSearch-discovered packages are tagged [ASSUMED] in nearby guidance'
    );
  });
});

describe('gsd-planner.md — checkpoint gate for [ASSUMED]/[SUS] packages', () => {
  let model;

  before(() => {
    model = readModel(PLANNER);
  });

  test('checkpoint:human-verify guidance references [ASSUMED] and [SUS]', () => {
    const hasCheckpoint = anyLineHasAll(model.lines, ['checkpoint:human-verify']);
    const hasAssumed = anyLineHasAll(model.lines, ['assumed']);
    const hasSus = anyLineHasAll(model.lines, ['sus']);

    assert.ok(hasCheckpoint && hasAssumed, 'planner must gate [ASSUMED] packages behind checkpoint:human-verify');
    assert.ok(hasCheckpoint && hasSus, 'planner must gate [SUS] packages behind checkpoint:human-verify');
  });

  test('package-legitimacy checkpoint uses blocking-human gate and non-auto-approvable language', () => {
    const hasBlockingHumanGate = anyLineHasAll(model.lines, ['checkpoint:human-verify', 'blocking-human']);
    const hasNeverAutoApproveRule = model.lines.some((line) =>
      hasAllTokens(line, ['never', 'auto-approvable']) ||
      hasAllTokens(line, ['never', 'auto', 'approvable'])
    );

    assert.ok(hasBlockingHumanGate, 'planner legitimacy checkpoint must use gate="blocking-human"');
    assert.ok(hasNeverAutoApproveRule, 'planner must state legitimacy checkpoints are never auto-approvable');
  });

  test('package verification checkpoint includes registry URL guidance', () => {
    const hasRegistryGuidance = model.lines.some((line) =>
      hasAllTokens(line, ['npmjs', 'package']) ||
      hasAllTokens(line, ['pypi', 'project']) ||
      hasAllTokens(line, ['crates', 'crates'])
    );

    assert.ok(hasRegistryGuidance, 'planner package-verify checkpoint must include registry URL examples');
  });
});

describe('gsd-planner.md — supply-chain row in threat_model template', () => {
  let planTemplate;
  let threatModelBlock;

  before(() => {
    const model = readModel(PLANNER);
    planTemplate = extractPlanTemplate(model.text);
    threatModelBlock = extractXmlElement(planTemplate, 'threat_model');
  });

  test('PLAN.md template contains threat_model element', () => {
    assert.ok(/^\s*<threat_model>/m.test(planTemplate), 'PLAN.md template must include <threat_model>');
  });

  test('threat_model template includes supply-chain row with mitigate disposition', () => {
    const tables = parseMarkdownTables(threatModelBlock.split('\n'));
    const strideTable = tables.find((table) => table.headers.includes('Threat ID'));
    assert.ok(strideTable, 'threat_model must include STRIDE threat register table');

    const supplyChainRow = strideTable.rows.find((row) => hasAllTokens(row.cells[0] || '', ['t-{phase}-sc']));
    assert.ok(supplyChainRow, 'threat_model must include T-{phase}-SC supply-chain row');

    const disposition = supplyChainRow.cells[3] || '';
    assert.ok(hasAllTokens(disposition, ['mitigate']), 'supply-chain threat disposition must be mitigate');
  });
});

describe('gsd-planner.md — no npx --yes auto-download', () => {
  test('does not invoke npx --yes inside a code block', () => {
    const model = readModel(PLANNER);
    const found = model.codeBlocks.some((block) => hasAllTokens(block, ['npx', '--yes']));
    assert.equal(found, false, 'planner must not invoke npx --yes in any code block');
  });
});

describe('gsd-executor.md — package installs excluded from RULE 3 auto-fix', () => {
  let model;

  before(() => {
    model = readModel(EXECUTOR);
  });

  test('does not invoke npx --yes inside a code block', () => {
    const found = model.codeBlocks.some((block) => hasAllTokens(block, ['npx', '--yes']));
    assert.equal(found, false, 'executor must not invoke npx --yes in any code block');
  });

  test('RULE 3 section explicitly excludes package-manager installs', () => {
    const rule3Line = lineIndexes(model.lines, (line) => hasAllTokens(line, ['rule', '3']))[0];
    assert.notEqual(rule3Line, undefined, 'executor must contain RULE 3 section');

    const window = model.lines.slice(rule3Line, rule3Line + 35);

    const hasInstallCommands =
      anyLineHasAll(window, ['npm', 'install']) ||
      anyLineHasAll(window, ['pip', 'install']) ||
      anyLineHasAll(window, ['cargo', 'add']);

    const hasExclusionLanguage =
      anyLineHasAll(window, ['excluded']) ||
      anyLineHasAll(window, ['not', 'auto-fixable']) ||
      anyLineHasAll(window, ['do', 'not']);

    assert.ok(hasInstallCommands && hasExclusionLanguage, 'RULE 3 must explicitly exclude package-manager installs');
  });

  test('failed package installs surface checkpoint:human-verify', () => {
    const rule3Line = lineIndexes(model.lines, (line) => hasAllTokens(line, ['rule', '3']))[0];
    assert.notEqual(rule3Line, undefined, 'executor must contain RULE 3 section');

    const window = model.lines.slice(rule3Line, rule3Line + 50);
    const hasFailureLanguage =
      anyLineHasAll(window, ['failed', 'install']) ||
      anyLineHasAll(window, ['install', 'fails']) ||
      anyLineHasAll(window, ['install', 'failed']);

    const hasCheckpoint = anyLineHasAll(window, ['checkpoint:human-verify']);

    assert.ok(
      hasFailureLanguage && hasCheckpoint,
      'executor must emit checkpoint:human-verify when package install fails'
    );
  });

  test('auto mode does not auto-approve package-legitimacy checkpoints', () => {
    const autoModeLine = lineIndexes(model.lines, (line) => hasAllTokens(line, ['auto-mode', 'checkpoint', 'behavior']))[0];
    assert.notEqual(autoModeLine, undefined, 'executor must define auto-mode checkpoint behavior');

    const window = model.lines.slice(autoModeLine, autoModeLine + 25);

    const hasExceptionRule =
      anyLineHasAll(window, ['except', 'package-legitimacy', 'checkpoints']) ||
      anyLineHasAll(window, ['do', 'not', 'auto-approve']) ||
      anyLineHasAll(window, ['blocking-human']);

    assert.ok(
      hasExceptionRule,
      'executor auto mode must explicitly block auto-approval for package-legitimacy checkpoints'
    );
  });
});
