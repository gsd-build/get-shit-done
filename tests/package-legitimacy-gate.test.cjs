'use strict';

/**
 * Package Legitimacy Gate — structural contract tests (#2827)
 *
 * Verifies that the three agents (researcher, planner, executor) contain the
 * interlocking instruction text that forms the slopsquatting defence gate:
 *
 *  researcher → runs slopcheck, emits Package Legitimacy Audit table,
 *               graceful-degrades, uses ecosystem-specific verification,
 *               never auto-downloads via npx --yes
 *  planner    → gates [ASSUMED]/[SUS] packages behind checkpoint:human-verify,
 *               adds supply-chain row to threat_model template
 *  executor   → RULE 3 explicitly excludes package installs from auto-fix
 *
 * Assertions are structural: content is verified at the correct structural
 * position (inside the RESEARCH.md template block, inside a code block, inside
 * the threat_model XML element) not merely present anywhere in the file.
 */

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// ── path constants ────────────────────────────────────────────────────────────

const AGENTS = path.join(__dirname, '..', 'agents');
const RESEARCHER = path.join(AGENTS, 'gsd-phase-researcher.md');
const PLANNER    = path.join(AGENTS, 'gsd-planner.md');
const EXECUTOR   = path.join(AGENTS, 'gsd-executor.md');

// ── structural helpers ────────────────────────────────────────────────────────

/**
 * Split a markdown string into sections by ## headings, respecting fenced
 * code blocks (# inside a code block is not a heading).
 * Returns [{heading, body}] where body is the raw text under the heading.
 */
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
    } else {
      current.body.push(line);
    }
  }
  sections.push(current);
  return sections;
}

/**
 * Extract all fenced code block contents from a string.
 * Returns an array of strings (one per block, without the fence lines).
 */
function extractCodeBlocks(text) {
  const blocks = [];
  const lines = text.split('\n');
  let inside = false;
  let buf = [];
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (inside) { blocks.push(buf.join('\n')); buf = []; }
      inside = !inside;
    } else if (inside) {
      buf.push(line);
    }
  }
  return blocks;
}

/** True if any extracted code block contains the substring. */
function codeBlockContains(text, sub) {
  return extractCodeBlocks(text).some(b => b.includes(sub));
}

/**
 * Extract the RESEARCH.md output template from gsd-phase-researcher.md.
 * The template is the ```markdown block that begins with "# Phase".
 */
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
    } else if (inside && line.startsWith('```') && isMarkdownFence) {
      const candidate = buf.join('\n');
      if (candidate.trimStart().startsWith('# Phase')) return candidate;
      inside = false;
      isMarkdownFence = false;
    } else if (inside) {
      buf.push(line);
    }
  }
  return '';
}

/**
 * Extract the PLAN.md output template from gsd-planner.md.
 * Finds the code block that contains <threat_model>.
 */
function extractPlanTemplate(content) {
  const blocks = extractCodeBlocks(content);
  return blocks.find(b => b.includes('<threat_model>')) || '';
}

/**
 * Extract the text content inside <tag>...</tag> (first match).
 */
function extractXmlElement(text, tag) {
  const start = text.indexOf(`<${tag}>`);
  const end   = text.indexOf(`</${tag}>`);
  if (start === -1 || end === -1) return '';
  return text.slice(start, end + tag.length + 3);
}

// ── 1. researcher — slopcheck invocation ─────────────────────────────────────

describe('gsd-phase-researcher.md — slopcheck invocation', () => {
  let content;
  before(() => { content = fs.readFileSync(RESEARCHER, 'utf-8'); });

  test('contains slopcheck install command in a fenced code block', () => {
    assert.ok(
      codeBlockContains(content, 'slopcheck install'),
      'researcher must invoke "slopcheck install" inside a fenced code block'
    );
  });

  test('slopcheck invocation includes --json flag', () => {
    const hasJson = extractCodeBlocks(content).some(
      b => b.includes('slopcheck install') && b.includes('--json')
    );
    assert.ok(hasJson, 'slopcheck invocation must pass --json');
  });

  test('guards slopcheck invocation with a command availability check', () => {
    assert.ok(
      codeBlockContains(content, 'command -v slopcheck') ||
        codeBlockContains(content, 'which slopcheck'),
      'researcher must check for slopcheck binary before invoking it'
    );
  });

  test('documents graceful degradation when slopcheck is unavailable', () => {
    const hasDegradation =
      content.includes('[ASSUMED]') &&
      content.includes('slopcheck') &&
      (content.includes('not available') ||
        content.includes('not found') ||
        content.includes('unavailable') ||
        content.includes('cannot be installed'));
    assert.ok(hasDegradation, 'researcher must document [ASSUMED] fallback when slopcheck cannot run');
  });
});

// ── 2. researcher — Package Legitimacy Audit section in RESEARCH.md template ─

describe('gsd-phase-researcher.md — Package Legitimacy Audit section in template', () => {
  let template, templateSections;
  before(() => {
    const content = fs.readFileSync(RESEARCHER, 'utf-8');
    template = extractResearchTemplate(content);
    templateSections = parseSections(template);
  });

  test('RESEARCH.md template contains a Package Legitimacy Audit section', () => {
    const hasSection = templateSections.some(s => s.heading === 'Package Legitimacy Audit');
    assert.ok(hasSection, 'RESEARCH.md template must include a ## Package Legitimacy Audit section');
  });

  test('Package Legitimacy Audit table has all required columns', () => {
    const sec = templateSections.find(s => s.heading === 'Package Legitimacy Audit');
    assert.ok(sec, 'Package Legitimacy Audit section must exist');
    const body = sec.body.join('\n');
    for (const col of ['Package', 'Registry', 'Age', 'Downloads', 'slopcheck', 'Disposition']) {
      assert.ok(body.includes(col), `audit table must have "${col}" column`);
    }
  });

  test('audit section documents [SLOP] disposition', () => {
    const sec = templateSections.find(s => s.heading === 'Package Legitimacy Audit');
    assert.ok(sec, 'Package Legitimacy Audit section must exist');
    assert.ok(sec.body.join('\n').includes('[SLOP]'), 'audit section must document [SLOP] disposition');
  });

  test('audit section documents [SUS] disposition', () => {
    const sec = templateSections.find(s => s.heading === 'Package Legitimacy Audit');
    assert.ok(sec, 'Package Legitimacy Audit section must exist');
    assert.ok(sec.body.join('\n').includes('[SUS]'), 'audit section must document [SUS] disposition');
  });

  test('audit section documents [OK] disposition', () => {
    const sec = templateSections.find(s => s.heading === 'Package Legitimacy Audit');
    assert.ok(sec, 'Package Legitimacy Audit section must exist');
    assert.ok(sec.body.join('\n').includes('[OK]'), 'audit section must document [OK] disposition');
  });
});

// ── 3. researcher — ecosystem-specific verification ───────────────────────────

describe('gsd-phase-researcher.md — ecosystem-specific package verification', () => {
  let content;
  before(() => { content = fs.readFileSync(RESEARCHER, 'utf-8'); });

  test('documents pip index versions for Python phases', () => {
    assert.ok(
      content.includes('pip index versions'),
      'researcher must document "pip index versions" for Python package verification'
    );
  });

  test('documents cargo search for Rust phases', () => {
    assert.ok(
      content.includes('cargo search'),
      'researcher must document "cargo search" for Rust package verification'
    );
  });
});

// ── 4. researcher — no npx --yes, ctx7 guard ─────────────────────────────────

describe('gsd-phase-researcher.md — no npx --yes auto-download', () => {
  let content;
  before(() => { content = fs.readFileSync(RESEARCHER, 'utf-8'); });

  test('does not invoke "npx --yes" inside a code block', () => {
    assert.ok(
      !codeBlockContains(content, 'npx --yes'),
      'researcher must not invoke "npx --yes" in any code block (silently auto-executes unverified packages)'
    );
  });

  test('ctx7 CLI fallback uses command -v guard instead of npx --yes', () => {
    assert.ok(
      codeBlockContains(content, 'command -v ctx7'),
      'ctx7 CLI fallback must guard with "command -v ctx7" before invocation'
    );
  });
});

// ── 5. researcher — WebSearch packages tagged [ASSUMED] ──────────────────────

describe('gsd-phase-researcher.md — WebSearch-origin package tagging', () => {
  let content;
  before(() => { content = fs.readFileSync(RESEARCHER, 'utf-8'); });

  test('instructs that packages discovered only via WebSearch are tagged [ASSUMED]', () => {
    const wsIdx = content.indexOf('WebSearch');
    assert.ok(wsIdx !== -1, 'researcher file must mention WebSearch');
    // [ASSUMED] must appear within ~1000 chars of a WebSearch reference
    const nearby = content.slice(Math.max(0, wsIdx - 200), wsIdx + 1200);
    assert.ok(
      nearby.includes('[ASSUMED]'),
      'researcher must instruct that packages discovered via WebSearch are tagged [ASSUMED]'
    );
  });
});

// ── 6. planner — checkpoint gate on [ASSUMED]/[SUS] packages ─────────────────

describe('gsd-planner.md — checkpoint gate for [ASSUMED]/[SUS] packages', () => {
  let content;
  before(() => { content = fs.readFileSync(PLANNER, 'utf-8'); });

  test('instructs inserting checkpoint:human-verify before install of [ASSUMED] packages', () => {
    assert.ok(
      content.includes('checkpoint:human-verify') && content.includes('[ASSUMED]'),
      'planner must instruct inserting a checkpoint:human-verify before installing [ASSUMED] packages'
    );
  });

  test('instructs inserting checkpoint:human-verify before install of [SUS] packages', () => {
    assert.ok(
      content.includes('checkpoint:human-verify') && content.includes('[SUS]'),
      'planner must instruct inserting a checkpoint:human-verify before installing [SUS] packages'
    );
  });

  test('package verification checkpoint includes registry URL guidance', () => {
    assert.ok(
      content.includes('npmjs.com/package') ||
        content.includes('pypi.org/project') ||
        content.includes('crates.io/crates'),
      'planner package-verify checkpoint must include a registry URL example'
    );
  });
});

// ── 7. planner — supply-chain threat model row in PLAN.md template ───────────

describe('gsd-planner.md — supply-chain row in threat_model template', () => {
  let planTemplate, threatBlock;
  before(() => {
    const content = fs.readFileSync(PLANNER, 'utf-8');
    planTemplate = extractPlanTemplate(content);
    threatBlock  = extractXmlElement(planTemplate, 'threat_model');
  });

  test('PLAN.md template contains a threat_model element', () => {
    assert.ok(planTemplate.includes('<threat_model>'), 'PLAN.md template must include <threat_model>');
  });

  test('threat_model template includes a supply-chain row', () => {
    assert.ok(
      threatBlock.includes('SC') ||
        threatBlock.includes('supply') ||
        threatBlock.includes('install'),
      'threat_model template must include a supply-chain (SC) row for install-bearing plans'
    );
  });

  test('supply-chain row disposition is mitigate', () => {
    assert.ok(
      threatBlock.includes('mitigate'),
      'supply-chain threat disposition must be "mitigate"'
    );
  });
});

// ── 8. planner — no npx --yes ────────────────────────────────────────────────

describe('gsd-planner.md — no npx --yes auto-download', () => {
  test('does not invoke "npx --yes" inside a code block', () => {
    const content = fs.readFileSync(PLANNER, 'utf-8');
    assert.ok(!codeBlockContains(content, 'npx --yes'), 'planner must not invoke "npx --yes" in any code block');
  });
});

// ── 9. executor — RULE 3 excludes package installs, failed installs → checkpoint

describe('gsd-executor.md — package installs excluded from RULE 3 auto-fix', () => {
  let content;
  before(() => { content = fs.readFileSync(EXECUTOR, 'utf-8'); });

  test('does not invoke "npx --yes" inside a code block', () => {
    assert.ok(!codeBlockContains(content, 'npx --yes'), 'executor must not invoke "npx --yes" in any code block');
  });

  test('RULE 3 section explicitly excludes package manager install commands', () => {
    const rule3Idx = content.indexOf('RULE 3');
    assert.ok(rule3Idx !== -1, 'executor must contain RULE 3 section');
    const rule3Body = content.slice(rule3Idx, rule3Idx + 1500);
    const excludesInstall =
      (rule3Body.includes('npm install') ||
        rule3Body.includes('pip install') ||
        rule3Body.includes('package install')) &&
      (rule3Body.includes('NOT') ||
        rule3Body.includes('exclude') ||
        rule3Body.includes('never') ||
        rule3Body.includes('prohibited') ||
        rule3Body.includes('do not'));
    assert.ok(
      excludesInstall,
      'RULE 3 must explicitly state that package manager installs are NOT auto-fixable'
    );
  });

  test('failed package installs must surface a checkpoint, not an auto-fix attempt', () => {
    const hasCheckpointForInstall =
      content.includes('install') && content.includes('checkpoint') &&
      (content.includes('install fails') ||
        content.includes('install fail') ||
        content.includes('failed install') ||
        (content.includes('package') && content.includes('checkpoint:human-verify')));
    assert.ok(
      hasCheckpointForInstall,
      'executor must instruct emitting a checkpoint when a package install fails (not auto-fix)'
    );
  });
});
