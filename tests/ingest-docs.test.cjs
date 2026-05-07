// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * Ingest Docs Tests — ingest-docs.test.cjs
 *
 * Structural assertions for /gsd-ingest-docs (#2387). Agents and workflows
 * are prompt-based; these tests guard the contract (files exist, frontmatter
 * present, required references wired up, safety semantics preserved).
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { extractFrontmatter } = require('../get-shit-done/bin/lib/frontmatter.cjs');

const ROOT = path.join(__dirname, '..');
const CMD_PATH = path.join(ROOT, 'commands', 'gsd', 'ingest-docs.md');
const WF_PATH = path.join(ROOT, 'get-shit-done', 'workflows', 'ingest-docs.md');
const CLASSIFIER_PATH = path.join(ROOT, 'agents', 'gsd-doc-classifier.md');
const SYNTHESIZER_PATH = path.join(ROOT, 'agents', 'gsd-doc-synthesizer.md');
const CONFLICT_ENGINE_PATH = path.join(ROOT, 'get-shit-done', 'references', 'doc-conflict-engine.md');

// ─── File Existence ────────────────────────────────────────────────────────────

describe('ingest-docs file structure (#2387)', () => {
  test('command file exists', () => {
    assert.ok(fs.existsSync(CMD_PATH), 'commands/gsd/ingest-docs.md should exist');
  });
  test('workflow file exists', () => {
    assert.ok(fs.existsSync(WF_PATH), 'get-shit-done/workflows/ingest-docs.md should exist');
  });
  test('classifier agent exists', () => {
    assert.ok(fs.existsSync(CLASSIFIER_PATH), 'agents/gsd-doc-classifier.md should exist');
  });
  test('synthesizer agent exists', () => {
    assert.ok(fs.existsSync(SYNTHESIZER_PATH), 'agents/gsd-doc-synthesizer.md should exist');
  });
  test('shared conflict-engine reference exists', () => {
    assert.ok(fs.existsSync(CONFLICT_ENGINE_PATH), 'references/doc-conflict-engine.md should exist');
  });
});

// ─── Command Frontmatter ───────────────────────────────────────────────────────

describe('ingest-docs command frontmatter', () => {
  const content = fs.readFileSync(CMD_PATH, 'utf-8');

  test('has name field', () => {
    assert.match(content, /^name:\s*gsd:ingest-docs$/m);
  });
  test('has description field', () => {
    assert.match(content, /^description:\s*.+$/m);
  });
  test('argument-hint mentions --mode, --manifest, --resolve', () => {
    const m = content.match(/^argument-hint:\s*"(.+)"$/m);
    assert.ok(m, 'argument-hint should be present');
    assert.ok(m[1].includes('--mode'), 'argument-hint should mention --mode');
    assert.ok(m[1].includes('--manifest'), 'argument-hint should mention --manifest');
    assert.ok(m[1].includes('--resolve'), 'argument-hint should mention --resolve');
  });
  test('allowed-tools include AskUserQuestion and Agent', () => {
    const frontmatter = extractFrontmatter(content);
    const allowedTools = frontmatter['allowed-tools'];
    assert.ok(Array.isArray(allowedTools), 'allowed-tools should be a frontmatter array');
    assert.ok(allowedTools.includes('AskUserQuestion'), 'command needs AskUserQuestion for gates');
    assert.ok(allowedTools.includes('Agent'), 'command needs Agent for agent spawns');
  });
});

// ─── Command References ─────────────────────────────────────────────────────────

describe('ingest-docs command references', () => {
  const content = fs.readFileSync(CMD_PATH, 'utf-8');

  test('references the ingest-docs workflow', () => {
    assert.ok(
      content.includes('@~/.claude/get-shit-done/workflows/ingest-docs.md'),
      'command must @-reference its workflow'
    );
  });
  test('references the doc-conflict-engine', () => {
    assert.ok(
      content.includes('@~/.claude/get-shit-done/references/doc-conflict-engine.md'),
      'command must load the shared conflict-engine contract'
    );
  });
  test('references gate-prompts', () => {
    assert.ok(
      content.includes('@~/.claude/get-shit-done/references/gate-prompts.md'),
      'command must load gate-prompts for AskUserQuestion patterns'
    );
  });
});

// ─── Workflow Content ───────────────────────────────────────────────────────────

describe('ingest-docs workflow content', () => {
  const content = fs.readFileSync(WF_PATH, 'utf-8');

  test('parses --mode, --manifest, --resolve, and a positional path', () => {
    assert.ok(content.includes('--mode'), '--mode flag must be parsed');
    assert.ok(content.includes('--manifest'), '--manifest flag must be parsed');
    assert.ok(content.includes('--resolve'), '--resolve flag must be parsed');
    assert.ok(content.includes('SCAN_PATH'), 'positional scan path must be parsed');
  });

  test('validates paths for traversal sequences', () => {
    assert.ok(
      content.includes('traversal') || content.match(/case\s+".*\*\.\.\*/),
      'workflow must reject traversal sequences in user-supplied paths'
    );
  });

  test('enforces 50-doc cap in v1', () => {
    assert.ok(
      content.includes('50'),
      'workflow must enforce the v1 doc cap'
    );
    assert.ok(
      content.toLowerCase().includes('cap') || content.toLowerCase().includes('limit'),
      'workflow must describe the cap/limit'
    );
  });

  test('auto-detects MODE from .planning/ presence', () => {
    assert.ok(
      content.includes('planning_exists'),
      'workflow must check planning_exists from init to auto-detect mode'
    );
  });

  test('discovers via directory conventions', () => {
    assert.ok(content.includes('adr'), 'workflow must match ADR directory convention');
    assert.ok(content.includes('prd'), 'workflow must match PRD directory convention');
    assert.ok(content.includes('spec'), 'workflow must match SPEC/RFC directory convention');
  });

  test('spawns gsd-doc-classifier and gsd-doc-synthesizer', () => {
    assert.ok(
      content.includes('gsd-doc-classifier'),
      'workflow must spawn gsd-doc-classifier'
    );
    assert.ok(
      content.includes('gsd-doc-synthesizer'),
      'workflow must spawn gsd-doc-synthesizer'
    );
  });

  test('conflict gate honors BLOCKER/WARNING/INFO semantics from doc-conflict-engine', () => {
    assert.ok(content.includes('BLOCKER'), 'workflow must reference BLOCKER severity');
    assert.ok(content.includes('WARNING'), 'workflow must reference WARNING severity');
    assert.ok(content.includes('INFO'), 'workflow must reference INFO severity');
    assert.ok(
      content.includes('doc-conflict-engine'),
      'workflow must cite the shared conflict-engine reference'
    );
  });

  test('hard-blocks writes when BLOCKERs exist', () => {
    // Must contain language that prevents writing destination files on blocker
    assert.ok(
      content.toLowerCase().includes('without writing') ||
      content.toLowerCase().includes('no destination files'),
      'workflow must forbid writes when BLOCKERs exist (safety gate)'
    );
  });

  test('routes to gsd-roadmapper in new mode', () => {
    assert.ok(
      content.includes('gsd-roadmapper'),
      'new mode must delegate to gsd-roadmapper'
    );
  });

  test('rejects --resolve interactive in v1', () => {
    const lower = content.toLowerCase();
    assert.ok(
      lower.includes('interactive') && lower.includes('future'),
      'workflow must reject --resolve interactive with a future-release message'
    );
  });

  test('references INGEST-CONFLICTS.md as the conflicts report location', () => {
    assert.ok(
      content.includes('INGEST-CONFLICTS.md'),
      'workflow must write/read INGEST-CONFLICTS.md'
    );
  });
});

// ─── Classifier Agent ───────────────────────────────────────────────────────────

describe('gsd-doc-classifier agent', () => {
  const content = fs.readFileSync(CLASSIFIER_PATH, 'utf-8');

  test('has Read and Write tools', () => {
    assert.match(content, /^tools:\s*.*Read.*Write.*/m);
  });
  test('produces JSON output schema', () => {
    assert.ok(content.includes('"type"'), 'schema must include type field');
    assert.ok(content.includes('"confidence"'), 'schema must include confidence field');
    assert.ok(content.includes('"locked"'), 'schema must include locked field for ADRs');
  });
  test('documents all five classification types', () => {
    assert.ok(content.includes('ADR'), 'classifier must handle ADR type');
    assert.ok(content.includes('PRD'), 'classifier must handle PRD type');
    assert.ok(content.includes('SPEC'), 'classifier must handle SPEC type');
    assert.ok(content.includes('DOC'), 'classifier must handle DOC type');
    assert.ok(content.includes('UNKNOWN'), 'classifier must handle UNKNOWN type');
  });
  test('only marks Accepted ADRs as locked', () => {
    assert.ok(
      content.includes('Accepted'),
      'classifier must tie locked status to Accepted ADR status'
    );
  });
});

// ─── Synthesizer Agent ──────────────────────────────────────────────────────────

describe('gsd-doc-synthesizer agent', () => {
  const content = fs.readFileSync(SYNTHESIZER_PATH, 'utf-8');

  test('has Read/Write/Bash tools', () => {
    assert.match(content, /^tools:\s*.*Read.*Write.*Bash.*/m);
  });
  test('documents default precedence ADR > SPEC > PRD > DOC', () => {
    const precedenceBlock = content.match(/ADR[^.]*SPEC[^.]*PRD[^.]*DOC/);
    assert.ok(precedenceBlock, 'default precedence ordering must be documented');
  });
  test('hard-blocks LOCKED vs LOCKED in both modes', () => {
    assert.ok(
      content.includes('LOCKED') && content.toLowerCase().includes('both'),
      'LOCKED-vs-LOCKED must be a hard block in both modes'
    );
  });
  test('produces three-bucket conflicts report', () => {
    assert.ok(content.includes('auto-resolved'), 'report must have auto-resolved bucket');
    assert.ok(content.includes('competing-variants'), 'report must have competing-variants bucket');
    assert.ok(content.includes('unresolved-blockers'), 'report must have unresolved-blockers bucket');
  });
  test('performs cycle detection', () => {
    assert.ok(
      content.toLowerCase().includes('cycle'),
      'synthesizer must run cycle detection on cross-ref graph'
    );
  });
  test('preserves competing PRD acceptance variants (no naive merge)', () => {
    assert.ok(
      content.toLowerCase().includes('variant'),
      'synthesizer must preserve competing acceptance variants'
    );
  });
  test('writes SYNTHESIS.md as entry point for downstream consumers', () => {
    assert.ok(
      content.includes('SYNTHESIS.md'),
      'synthesizer must write SYNTHESIS.md'
    );
  });
});

// ─── Shared Conflict Engine Contract ────────────────────────────────────────────

describe('doc-conflict-engine shared reference', () => {
  const content = fs.readFileSync(CONFLICT_ENGINE_PATH, 'utf-8');

  test('defines all three severity labels', () => {
    assert.ok(content.includes('[BLOCKER]'));
    assert.ok(content.includes('[WARNING]'));
    assert.ok(content.includes('[INFO]'));
  });
  test('forbids markdown tables in conflict reports', () => {
    assert.ok(
      content.toLowerCase().includes('never markdown tables') ||
      content.toLowerCase().includes('no markdown tables') ||
      content.toLowerCase().includes('never use markdown tables'),
      'reference must forbid markdown tables'
    );
  });
  test('defines the BLOCKER safety gate', () => {
    assert.ok(
      content.toLowerCase().includes('exit without writing'),
      'safety gate must forbid destination writes when BLOCKERs exist'
    );
  });
});

// ─── Import command still consumes the shared reference (#2387 refactor) ───────

describe('import command adopts shared conflict-engine', () => {
  const cmdContent = fs.readFileSync(path.join(ROOT, 'commands', 'gsd', 'import.md'), 'utf-8');
  const wfContent = fs.readFileSync(path.join(ROOT, 'get-shit-done', 'workflows', 'import.md'), 'utf-8');

  test('import command loads doc-conflict-engine reference', () => {
    assert.ok(
      cmdContent.includes('@~/.claude/get-shit-done/references/doc-conflict-engine.md'),
      '/gsd-import must load the shared conflict-engine contract'
    );
  });
  test('import workflow cites the shared reference', () => {
    assert.ok(
      wfContent.includes('doc-conflict-engine'),
      'import workflow must cite the shared conflict-engine'
    );
  });
  test('import workflow retains BLOCKER/WARNING/INFO labels', () => {
    assert.ok(wfContent.includes('[BLOCKER]'));
    assert.ok(wfContent.includes('[WARNING]'));
    assert.ok(wfContent.includes('[INFO]'));
  });
});
