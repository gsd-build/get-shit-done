// allow-test-rule: source-text-is-the-product
// Workflow `.md` files are the runtime contract executed by Claude Code as
// embedded bash. This test extracts the actual `check_incomplete_work` bash
// block from resume-project.md and exercises it against a planted directory
// layout — that's a behavioral integration test of the workflow contract,
// not regex-on-source.

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createTempDir, cleanup } = require('./helpers.cjs');

const WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'resume-project.md');

// Extract the first ```bash``` code block inside the
// `<step name="check_incomplete_work">` element. That's the snippet the
// runtime actually executes; it's what we want to validate.
function extractCheckBlock() {
  const md = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  const stepStart = md.indexOf('<step name="check_incomplete_work">');
  assert.ok(stepStart >= 0, 'resume-project.md must contain a check_incomplete_work step');
  const stepEnd = md.indexOf('</step>', stepStart);
  assert.ok(
    stepEnd >= 0,
    'check_incomplete_work step must have a closing </step> tag',
  );
  const stepBody = md.slice(stepStart, stepEnd);
  const fenceMatch = stepBody.match(/```(?:bash|sh)\r?\n([\s\S]*?)\r?\n```/);
  assert.ok(fenceMatch, 'check_incomplete_work step must embed a ```bash code block');
  return fenceMatch[1];
}

function runSnippet(cwd, snippet) {
  // has_interrupted_agent is a downstream-orchestrator variable; default it
  // to "false" so the embedded `if` branch is a no-op during this test.
  return spawnSync('bash', ['-c', snippet], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, has_interrupted_agent: 'false', interrupted_agent_id: '' },
  });
}

describe('bug #3446: resume-project detects non-phase and legacy continue-here handoffs', () => {
  let tmpDir;
  let snippet;

  before(() => {
    snippet = extractCheckBlock();
    tmpDir = createTempDir('gsd-bug-3446-');

    // Plant the three discovery surfaces that bug #3446 was originally
    // filed to cover.
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', '.continue-here.md'),
      '---\ncontext: default\n---\nroot-of-.planning handoff\n',
      'utf8',
    );

    fs.mkdirSync(path.join(tmpDir, '.planning', 'sketches', 'SKETCH-001'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'sketches', 'SKETCH-001', '.continue-here.md'),
      '---\ncontext: sketch\n---\nsketch handoff\n',
      'utf8',
    );

    fs.writeFileSync(
      path.join(tmpDir, '.continue-here.md'),
      '---\ncontext: legacy\n---\nlegacy repo-root handoff\n',
      'utf8',
    );
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('check_incomplete_work surfaces .planning/.continue-here.md (depth 1 under .planning)', () => {
    const result = runSnippet(tmpDir, snippet);
    assert.equal(result.status, 0, `snippet exited ${result.status}; stderr=${result.stderr}`);
    assert.match(
      result.stdout,
      /\.planning\/\.continue-here\.md/,
      `expected .planning/.continue-here.md in stdout; got: ${JSON.stringify(result.stdout)}`,
    );
  });

  test('check_incomplete_work surfaces .planning/sketches/SKETCH-001/.continue-here.md (depth 3 under .planning)', () => {
    const result = runSnippet(tmpDir, snippet);
    assert.equal(result.status, 0, `snippet exited ${result.status}; stderr=${result.stderr}`);
    assert.match(
      result.stdout,
      /\.planning\/sketches\/SKETCH-001\/\.continue-here\.md/,
      `expected sketch handoff in stdout; got: ${JSON.stringify(result.stdout)}`,
    );
  });

  test('check_incomplete_work surfaces legacy repo-root .continue-here.md', () => {
    const result = runSnippet(tmpDir, snippet);
    assert.equal(result.status, 0, `snippet exited ${result.status}; stderr=${result.stderr}`);
    assert.match(
      result.stdout,
      /(^|\n)\.\/\.continue-here\.md(\n|$)/,
      `expected legacy ./.continue-here.md in stdout; got: ${JSON.stringify(result.stdout)}`,
    );
  });
});
