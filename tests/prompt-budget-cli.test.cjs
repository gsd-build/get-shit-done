'use strict';

// allow-test-rule: prompt-content-is-the-product
// The prompt-budget CLI writes an assembled, trimmed prompt string to disk.
// Testing that the prompt omits a dropped section (research) requires a
// content assertion on the output file — the file content IS the product.
// Structured metadata (omitted[], hardFailed, etc.) is always the primary
// assertion; text content checks are secondary and only used to verify the
// trim policy was applied correctly to the assembled output.

/**
 * prompt-budget-cli.test.cjs
 *
 * Integration tests for the `gsd-tools prompt-budget` CLI subcommand.
 * Covers the 5 specified scenarios:
 *   1. Happy path: budget forces trim (research dropped)
 *   2. No-trim path: huge budget, metadata shows no omissions
 *   3. Hard-fail path: tiny budget, exit 2, metadata written, prompt empty
 *   4. Missing required arg: exit 1, stderr has error message
 *   5. Missing input file: exit 1
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createTempDir, cleanup, runGsdTools } = require('./helpers.cjs');

const TEST_INSTRUCTIONS = [
  '# Cross-AI Plan Review Request',
  '',
  'You are reviewing implementation plans for a software project phase.',
  'Provide structured feedback on plan quality, completeness, and risks.',
].join('\n');

const TEST_ROADMAP = [
  '## Phase 3: Implement token budgeting',
  '',
  '### Goal',
  'Add deterministic prompt trimming for small-context local model servers.',
].join('\n');

const TEST_PLAN = [
  '## PLAN-01: Add prompt-budget module',
  '',
  '### Tasks',
  '- [ ] Write estimateTokens()',
  '- [ ] Write applyBudget()',
  '- [ ] Write CLI wrapper',
].join('\n');

const TEST_RESEARCH = 'a'.repeat(8000); // ~2000 tokens — large enough to force trimming

/**
 * Run gsd-tools with args as an array (safe for paths with spaces/dollars).
 * Returns { exitCode, stdout, stderr }.
 */
function runCli(args, cwd) {
  const result = runGsdTools(args, cwd);
  return {
    exitCode: result.exitCode ?? (result.success ? 0 : 1),
    stdout: result.output ?? '',
    stderr: result.error ?? '',
  };
}

describe('prompt-budget CLI', () => {
  // ── Cycle 1: happy path — small budget that trims research ────────────────
  test('happy path: trims research when budget is small, exit 0', () => {
    const dir = createTempDir('pb-cli-happy-');
    try {
      // Write input files
      const instrFile = path.join(dir, 'instructions.md');
      const roadmapFile = path.join(dir, 'roadmap.md');
      const planFile = path.join(dir, 'plan-01.md');
      const researchFile = path.join(dir, 'research.md');
      const outPrompt = path.join(dir, 'out-prompt.md');
      const outMeta = path.join(dir, 'out-meta.json');

      fs.writeFileSync(instrFile, TEST_INSTRUCTIONS);
      fs.writeFileSync(roadmapFile, TEST_ROADMAP);
      fs.writeFileSync(planFile, TEST_PLAN);
      fs.writeFileSync(researchFile, TEST_RESEARCH);

      // Budget of 800 tokens: enough for instructions+roadmap+plan (min set ~389 tokens
      // with 10% safety margin) but not the ~2000-token research blob.
      // effectiveBudget = floor(800 * 0.9) = 720.
      // contentBudget = 720 - 80 (note reserve) = 640. Research (~2000 tokens) won't fit.
      const { exitCode, stderr } = runCli([
        'prompt-budget',
        '--budget', '800',
        '--instructions-file', instrFile,
        '--roadmap-file', roadmapFile,
        '--plan-file', planFile,
        '--research-file', researchFile,
        '--output-prompt', outPrompt,
        '--output-metadata', outMeta,
      ], dir);

      assert.equal(exitCode, 0, `Expected exit 0, got ${exitCode}. stderr: ${stderr}`);

      // Output files must exist
      assert.ok(fs.existsSync(outPrompt), 'output prompt file should exist');
      assert.ok(fs.existsSync(outMeta), 'output metadata file should exist');

      // Metadata must parse and have expected shape
      const meta = JSON.parse(fs.readFileSync(outMeta, 'utf8'));
      assert.equal(typeof meta.budget, 'number');
      assert.ok(Array.isArray(meta.omitted));
      assert.ok(meta.omitted.includes('research'), `Expected research in omitted, got: ${JSON.stringify(meta.omitted)}`);
      assert.equal(meta.hardFailed, false);

      // Prompt must not contain research content
      const promptText = fs.readFileSync(outPrompt, 'utf8');
      assert.ok(promptText.length > 0, 'prompt file must not be empty');
      // Research was dropped so the 'aaa...' block should be absent from the prompt
      assert.ok(!promptText.includes('a'.repeat(100)), 'dropped research should not appear in prompt');
    } finally {
      cleanup(dir);
    }
  });

  // ── Cycle 2: no-trim path — huge budget, nothing dropped ──────────────────
  test('no-trim path: huge budget returns all sections, exit 0', () => {
    const dir = createTempDir('pb-cli-notrim-');
    try {
      const instrFile = path.join(dir, 'instructions.md');
      const roadmapFile = path.join(dir, 'roadmap.md');
      const planFile = path.join(dir, 'plan-01.md');
      const researchFile = path.join(dir, 'research.md');
      const outPrompt = path.join(dir, 'out-prompt.md');
      const outMeta = path.join(dir, 'out-meta.json');

      fs.writeFileSync(instrFile, TEST_INSTRUCTIONS);
      fs.writeFileSync(roadmapFile, TEST_ROADMAP);
      fs.writeFileSync(planFile, TEST_PLAN);
      fs.writeFileSync(researchFile, 'Some research findings.');

      const { exitCode } = runCli([
        'prompt-budget',
        '--budget', '1000000',
        '--instructions-file', instrFile,
        '--roadmap-file', roadmapFile,
        '--plan-file', planFile,
        '--research-file', researchFile,
        '--output-prompt', outPrompt,
        '--output-metadata', outMeta,
      ], dir);

      assert.equal(exitCode, 0);

      const meta = JSON.parse(fs.readFileSync(outMeta, 'utf8'));
      assert.deepEqual(meta.omitted, []);
      assert.equal(meta.hardFailed, false);
      assert.equal(meta.projectMdShrunk, false);
      assert.equal(meta.planTruncationPct, 0);
      assert.equal(meta.noteInjected, false);

      // All sections must appear in the prompt
      const promptText = fs.readFileSync(outPrompt, 'utf8');
      assert.ok(promptText.includes('Some research findings.'));
    } finally {
      cleanup(dir);
    }
  });

  // ── Cycle 3: hard-fail path — budget is impossibly small ──────────────────
  test('hard-fail path: exit 2 when minimum set exceeds budget, metadata written, prompt empty', () => {
    const dir = createTempDir('pb-cli-hardfail-');
    try {
      const instrFile = path.join(dir, 'instructions.md');
      const roadmapFile = path.join(dir, 'roadmap.md');
      const planFile = path.join(dir, 'plan-01.md');
      const outPrompt = path.join(dir, 'out-prompt.md');
      const outMeta = path.join(dir, 'out-meta.json');

      // Large instructions to ensure minimum set exceeds the tiny budget
      fs.writeFileSync(instrFile, 'a'.repeat(4000)); // ~1000 tokens
      fs.writeFileSync(roadmapFile, TEST_ROADMAP);
      fs.writeFileSync(planFile, TEST_PLAN);

      // Budget of 5 tokens is far below the minimum set
      const { exitCode, stderr } = runCli([
        'prompt-budget',
        '--budget', '5',
        '--instructions-file', instrFile,
        '--roadmap-file', roadmapFile,
        '--plan-file', planFile,
        '--output-prompt', outPrompt,
        '--output-metadata', outMeta,
      ], dir);

      assert.equal(exitCode, 2, `Expected exit 2, got ${exitCode}. stderr: ${stderr}`);

      // Metadata must still be written
      assert.ok(fs.existsSync(outMeta), 'metadata file must be written even on hard fail');
      const meta = JSON.parse(fs.readFileSync(outMeta, 'utf8'));
      assert.equal(meta.hardFailed, true);

      // Prompt file must be written but empty
      assert.ok(fs.existsSync(outPrompt), 'prompt file must exist even on hard fail');
      const promptText = fs.readFileSync(outPrompt, 'utf8');
      assert.equal(promptText, '', 'prompt file must be empty on hard fail');
    } finally {
      cleanup(dir);
    }
  });

  // ── Cycle 4: missing required arg — exit 1, stderr has error ──────────────
  test('missing required arg: exit 1, stderr contains error message', () => {
    const dir = createTempDir('pb-cli-missingarg-');
    try {
      const instrFile = path.join(dir, 'instructions.md');
      const roadmapFile = path.join(dir, 'roadmap.md');
      const planFile = path.join(dir, 'plan-01.md');
      const outPrompt = path.join(dir, 'out-prompt.md');
      const outMeta = path.join(dir, 'out-meta.json');

      fs.writeFileSync(instrFile, TEST_INSTRUCTIONS);
      fs.writeFileSync(roadmapFile, TEST_ROADMAP);
      fs.writeFileSync(planFile, TEST_PLAN);

      // Omit --budget (required)
      const { exitCode, stderr } = runCli([
        'prompt-budget',
        '--instructions-file', instrFile,
        '--roadmap-file', roadmapFile,
        '--plan-file', planFile,
        '--output-prompt', outPrompt,
        '--output-metadata', outMeta,
      ], dir);

      assert.equal(exitCode, 1, `Expected exit 1, got ${exitCode}`);
      assert.ok(stderr.includes('--budget'), `Expected stderr to mention --budget, got: ${stderr}`);
    } finally {
      cleanup(dir);
    }
  });

  // ── Cycle 5: missing input file — exit 1 ──────────────────────────────────
  test('missing input file: exit 1', () => {
    const dir = createTempDir('pb-cli-missingfile-');
    try {
      const roadmapFile = path.join(dir, 'roadmap.md');
      const planFile = path.join(dir, 'plan-01.md');
      const outPrompt = path.join(dir, 'out-prompt.md');
      const outMeta = path.join(dir, 'out-meta.json');

      fs.writeFileSync(roadmapFile, TEST_ROADMAP);
      fs.writeFileSync(planFile, TEST_PLAN);

      // Instructions file doesn't exist
      const { exitCode } = runCli([
        'prompt-budget',
        '--budget', '10000',
        '--instructions-file', path.join(dir, 'nonexistent.md'),
        '--roadmap-file', roadmapFile,
        '--plan-file', planFile,
        '--output-prompt', outPrompt,
        '--output-metadata', outMeta,
      ], dir);

      assert.equal(exitCode, 1, 'Expected exit 1 when instructions file is missing');
    } finally {
      cleanup(dir);
    }
  });
});
