/**
 * GSD Tools Tests - Review (Cross-AI Peer Review)
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// init review
// ─────────────────────────────────────────────────────────────────────────────

describe('init review', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns phase info and cli availability', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan 1');
    fs.writeFileSync(path.join(phaseDir, '03-02-PLAN.md'), '# Plan 2');

    const result = runGsdTools('init review 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_found, true);
    assert.strictEqual(output.phase_number, '03');
    assert.strictEqual(output.plan_count, 2);
    assert.ok('cli_available' in output, 'Should have cli_available');
    assert.ok('gemini' in output.cli_available, 'Should check gemini');
    assert.ok('claude' in output.cli_available, 'Should check claude');
    assert.ok('codex' in output.cli_available, 'Should check codex');
  });

  test('returns has_reviews when REVIEWS.md exists', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-REVIEWS.md'), '# Reviews');

    const result = runGsdTools('init review 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_reviews, true);
    assert.ok(output.reviews_path.includes('03-REVIEWS.md'));
  });

  test('phase not found returns phase_found false', () => {
    const result = runGsdTools('init review 99', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_found, false);
    assert.strictEqual(output.phase_dir, null);
  });

  test('errors without phase argument', () => {
    const result = runGsdTools('init review', tmpDir);
    assert.strictEqual(result.success, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// review check-cli
// ─────────────────────────────────────────────────────────────────────────────

describe('review check-cli', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns boolean values for each CLI', () => {
    const result = runGsdTools('review check-cli', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(typeof output.gemini, 'boolean');
    assert.strictEqual(typeof output.claude, 'boolean');
    assert.strictEqual(typeof output.codex, 'boolean');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// review build-prompt
// ─────────────────────────────────────────────────────────────────────────────

describe('review build-prompt', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('builds prompt file with plans', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan 1\n\nBuild the API endpoints.');
    fs.writeFileSync(path.join(phaseDir, '03-02-PLAN.md'), '# Plan 2\n\nAdd authentication.');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Test Project\n\nA test project.');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), '# Requirements\n\n- [ ] REQ-01: Build API');

    const result = runGsdTools('review build-prompt --phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.plan_count, 2);
    assert.ok(output.prompt_path, 'Should have prompt_path');
    assert.ok(fs.existsSync(output.prompt_path), 'Prompt file should exist');

    // Verify prompt content includes plans
    const promptContent = fs.readFileSync(output.prompt_path, 'utf-8');
    assert.ok(promptContent.includes('Build the API endpoints'), 'Prompt should include plan content');
    assert.ok(promptContent.includes('Add authentication'), 'Prompt should include second plan');
    assert.ok(promptContent.includes('Cross-AI Review Request'), 'Prompt should have review header');

    // Cleanup temp file
    fs.unlinkSync(output.prompt_path);
  });

  test('errors without phase', () => {
    const result = runGsdTools('review build-prompt', tmpDir);
    assert.strictEqual(result.success, false);
  });

  test('errors when phase not found', () => {
    const result = runGsdTools('review build-prompt --phase 99', tmpDir);
    assert.strictEqual(result.success, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// review write-reviews
// ─────────────────────────────────────────────────────────────────────────────

describe('review write-reviews', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('writes REVIEWS.md from reviewer files', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    // Create temp review files
    const os = require('os');
    const geminiFile = path.join(os.tmpdir(), `gsd-test-gemini-${Date.now()}.md`);
    const claudeFile = path.join(os.tmpdir(), `gsd-test-claude-${Date.now()}.md`);
    fs.writeFileSync(geminiFile, '### Summary\n\nGood plans overall.\n\n### Concerns\n\nNone major.');
    fs.writeFileSync(claudeFile, '### Summary\n\nWell structured.\n\n### Suggestions\n\nAdd more tests.');

    const result = runGsdTools(
      ['review', 'write-reviews', '--phase', '03', '--gemini-file', geminiFile, '--claude-file', claudeFile],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);
    assert.ok(output.path.includes('03-REVIEWS.md'));
    assert.deepStrictEqual(output.reviewers, ['gemini', 'claude']);

    // Verify file content
    const reviewsContent = fs.readFileSync(path.join(phaseDir, '03-REVIEWS.md'), 'utf-8');
    assert.ok(reviewsContent.includes('Gemini Review'), 'Should have Gemini section');
    assert.ok(reviewsContent.includes('Claude Review'), 'Should have Claude section');
    assert.ok(reviewsContent.includes('Good plans overall'), 'Should include gemini review content');
    assert.ok(reviewsContent.includes('Add more tests'), 'Should include claude review content');
    assert.ok(reviewsContent.includes('reviewers: [gemini, claude]'), 'Should have reviewers in frontmatter');

    // Cleanup
    fs.unlinkSync(geminiFile);
    fs.unlinkSync(claudeFile);
  });

  test('handles missing review file gracefully', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    const result = runGsdTools(
      ['review', 'write-reviews', '--phase', '03', '--gemini-file', '/tmp/nonexistent-file.md'],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);

    const reviewsContent = fs.readFileSync(path.join(phaseDir, '03-REVIEWS.md'), 'utf-8');
    assert.ok(reviewsContent.includes('Review not available'), 'Should note missing review');
  });

  test('errors without phase', () => {
    const result = runGsdTools('review write-reviews', tmpDir);
    assert.strictEqual(result.success, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// has_reviews in init plan-phase
// ─────────────────────────────────────────────────────────────────────────────

describe('plan-phase --reviews integration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init plan-phase includes has_reviews when REVIEWS.md exists', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-REVIEWS.md'), '# Reviews\n\nSome reviews.');

    const result = runGsdTools('init plan-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_reviews, true);
    assert.ok(output.reviews_path.includes('03-REVIEWS.md'), 'Should have reviews_path');
  });

  test('init plan-phase has_reviews false when no REVIEWS.md', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    const result = runGsdTools('init plan-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_reviews, false);
    assert.strictEqual(output.reviews_path, undefined);
  });

  test('has_reviews detected via init review', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '05-deploy');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '05-REVIEWS.md'), '# Reviews');

    const result = runGsdTools('init review 05', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_reviews, true);
  });
});
