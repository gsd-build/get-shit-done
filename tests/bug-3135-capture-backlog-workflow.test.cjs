// allow-test-rule: source-text-is-the-product — workflow and command .md files
// ARE what the runtime loads; asserting their existence and behavioral content
// tests the deployed skill surface contract, not implementation internals.

'use strict';

// Regression tests for bug #3135.
//
// PR #2824 consolidated add-backlog into `gsd-capture --backlog` by creating
// a routing wrapper in commands/gsd/capture.md that delegates to
// workflows/add-backlog.md via execution_context. The workflow file was never
// created. Same gap class as reapply-patches.md (found and fixed in the same PR).
//
// Fix: create get-shit-done/workflows/add-backlog.md with the full process
// ported from the deleted commands/gsd/add-backlog.md (git ref 87917131^).
//
// Also adds a broad regression: every @-reference in any commands/gsd/*.md
// execution_context block must resolve to an existing workflow file.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WORKFLOW = path.join(ROOT, 'get-shit-done', 'workflows', 'add-backlog.md');
const COMMANDS_DIR = path.join(ROOT, 'commands', 'gsd');
const WORKFLOWS_DIR = path.join(ROOT, 'get-shit-done', 'workflows');

// ─── #3135: add-backlog workflow ─────────────────────────────────────────────

describe('#3135: get-shit-done/workflows/add-backlog.md', () => {
  test('file exists', () => {
    assert.ok(
      fs.existsSync(WORKFLOW),
      'get-shit-done/workflows/add-backlog.md does not exist — capture --backlog has no implementation to load',
    );
  });

  test('uses gsd-sdk query phase.next-decimal to find next 999.x slot', () => {
    const src = fs.readFileSync(WORKFLOW, 'utf8');
    assert.ok(
      src.includes('phase.next-decimal'),
      'add-backlog.md must use gsd-sdk query phase.next-decimal to find the next 999.x number',
    );
  });

  test('writes to ROADMAP.md', () => {
    const src = fs.readFileSync(WORKFLOW, 'utf8');
    assert.ok(src.includes('ROADMAP.md'), 'add-backlog.md must write to ROADMAP.md');
  });

  test('creates a .planning/phases/ directory', () => {
    const src = fs.readFileSync(WORKFLOW, 'utf8');
    assert.ok(
      src.includes('.planning/phases') || src.includes('planning/phases'),
      'add-backlog.md must create a phase directory under .planning/phases/',
    );
  });

  test('uses generate-slug for the directory name', () => {
    const src = fs.readFileSync(WORKFLOW, 'utf8');
    assert.ok(
      src.includes('generate-slug'),
      'add-backlog.md must use gsd-sdk query generate-slug to build the phase directory slug',
    );
  });

  test('commits via gsd-sdk query commit', () => {
    const src = fs.readFileSync(WORKFLOW, 'utf8');
    assert.ok(
      src.includes('gsd-sdk query commit') || src.includes('query commit'),
      'add-backlog.md must commit via gsd-sdk query commit',
    );
  });

  test('writes ROADMAP entry before creating directory (#2280 ordering invariant)', () => {
    const src = fs.readFileSync(WORKFLOW, 'utf8');
    const roadmapIdx = src.indexOf('ROADMAP.md');
    const mkdirIdx = src.search(/mkdir|\.gitkeep/);
    assert.ok(roadmapIdx !== -1, 'ROADMAP.md write step not found');
    assert.ok(mkdirIdx !== -1, 'directory creation step not found');
    assert.ok(
      roadmapIdx < mkdirIdx,
      'ROADMAP.md entry must be written BEFORE the phase directory is created (#2280 ordering invariant)',
    );
  });

  test('uses 999.x numbering for backlog items', () => {
    const src = fs.readFileSync(WORKFLOW, 'utf8');
    assert.ok(
      src.includes('999'),
      'add-backlog.md must document 999.x numbering scheme for backlog items',
    );
  });

  test('documents /gsd-review-backlog for promotion', () => {
    const src = fs.readFileSync(WORKFLOW, 'utf8');
    assert.ok(
      src.includes('review-backlog') || src.includes('gsd-review-backlog'),
      'add-backlog.md should mention /gsd-review-backlog for promoting items to active milestone',
    );
  });
});

// ─── capture.md routing integrity ────────────────────────────────────────────

describe('#3135: capture.md correctly routes --backlog to add-backlog workflow', () => {
  function executionContextIncludes(body) {
    const blocks = [
      ...body.matchAll(/<execution_context(?:_extended)?>([\s\S]*?)<\/execution_context(?:_extended)?>/g),
    ].map((m) => m[1]);
    const targets = [];
    for (const blk of blocks) {
      for (const line of blk.split('\n')) {
        const t = line.trim();
        if (!t.startsWith('@')) continue;
        const rel = t.replace(/^@~?\/?(?:\.claude\/)?(?:get-shit-done\/)?/, '');
        targets.push(rel);
      }
    }
    return targets;
  }

  test('capture.md execution_context @-includes add-backlog.md', () => {
    const body = fs.readFileSync(path.join(COMMANDS_DIR, 'capture.md'), 'utf8');
    const targets = executionContextIncludes(body);
    assert.ok(
      targets.some((t) => /(^|\/)workflows\/add-backlog\.md$/.test(t)),
      `capture.md execution_context must @-include workflows/add-backlog.md; got: ${JSON.stringify(targets)}`,
    );
  });
});

// ─── Broad regression: all execution_context @-refs must resolve ─────────────

describe('regression: every execution_context @-reference in commands/gsd/*.md resolves to an existing workflow file', () => {
  // Extract @-references from execution_context blocks, normalised to the
  // get-shit-done/workflows/ relative tail so we can resolve them on disk.
  function extractWorkflowRefs(filePath) {
    const body = fs.readFileSync(filePath, 'utf8');
    const blocks = [
      ...body.matchAll(/<execution_context(?:_extended)?>([\s\S]*?)<\/execution_context(?:_extended)?>/g),
    ].map((m) => m[1]);
    const refs = [];
    for (const blk of blocks) {
      for (const line of blk.split('\n')) {
        const t = line.trim();
        if (!t.startsWith('@')) continue;
        // Only care about workflow references (skip non-workflow @-refs)
        if (!t.includes('/workflows/')) continue;
        // Normalise: drop everything up to and including 'get-shit-done/'
        const match = t.match(/get-shit-done\/(workflows\/.+\.md)/);
        if (match) refs.push(match[1]);
      }
    }
    return refs;
  }

  const commandFiles = fs
    .readdirSync(COMMANDS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(COMMANDS_DIR, f));

  for (const cmdFile of commandFiles) {
    const cmdName = path.basename(cmdFile);
    let refs;
    try {
      refs = extractWorkflowRefs(cmdFile);
    } catch {
      continue;
    }
    for (const ref of refs) {
      test(`${cmdName}: @-ref '${ref}' exists on disk`, () => {
        const absPath = path.join(ROOT, 'get-shit-done', ref);
        assert.ok(
          fs.existsSync(absPath),
          `${cmdName} references @${ref} in execution_context but get-shit-done/${ref} does not exist`,
        );
      });
    }
  }
});
