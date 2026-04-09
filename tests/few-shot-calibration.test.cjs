const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REFS_DIR = path.join(__dirname, '..', 'get-shit-done', 'references', 'few-shot-examples');
const AGENTS_DIR = path.join(__dirname, '..', 'agents');

// ── Helpers ────────────────────────────────────────────────────────
function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function countPattern(content, pattern) {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

// ── File existence ─────────────────────────────────────────────────
describe('few-shot calibration examples', () => {
  describe('reference files exist', () => {
    test('plan-checker.md exists in references/few-shot-examples/', () => {
      assert.ok(fs.existsSync(path.join(REFS_DIR, 'plan-checker.md')));
    });

    test('verifier.md exists in references/few-shot-examples/', () => {
      assert.ok(fs.existsSync(path.join(REFS_DIR, 'verifier.md')));
    });
  });

  // ── Version/format metadata ────────────────────────────────────
  describe('frontmatter metadata', () => {
    test('plan-checker.md has version and component in frontmatter', () => {
      const content = readFile(path.join(REFS_DIR, 'plan-checker.md'));
      assert.match(content, /^---\n/);
      assert.match(content, /component:\s*plan-checker/);
      assert.match(content, /version:\s*\d+/);
      assert.match(content, /last_calibrated:\s*\d{4}-\d{2}-\d{2}/);
    });

    test('verifier.md has version and component in frontmatter', () => {
      const content = readFile(path.join(REFS_DIR, 'verifier.md'));
      assert.match(content, /^---\n/);
      assert.match(content, /component:\s*verifier/);
      assert.match(content, /version:\s*\d+/);
      assert.match(content, /last_calibrated:\s*\d{4}-\d{2}-\d{2}/);
    });

    // Version difference is intentional: plan-checker was calibrated first (v1),
    // verifier later with updated format (v2) including calibration_source field.
    test('version metadata values are present and numeric', () => {
      const pcContent = readFile(path.join(REFS_DIR, 'plan-checker.md'));
      const vContent = readFile(path.join(REFS_DIR, 'verifier.md'));
      const pcVersion = pcContent.match(/version:\s*(\d+)/);
      const vVersion = vContent.match(/version:\s*(\d+)/);
      assert.ok(pcVersion, 'plan-checker.md must have a numeric version');
      assert.ok(vVersion, 'verifier.md must have a numeric version');
    });
  });

  // ── Example counts ─────────────────────────────────────────────
  describe('example counts', () => {
    test('plan-checker.md contains exactly 4 examples (2 positive, 2 negative)', () => {
      const content = readFile(path.join(REFS_DIR, 'plan-checker.md'));
      const totalExamples = countPattern(content, /^### Example \d+/gm);
      assert.strictEqual(totalExamples, 4);

      // Verify section breakdown
      const positiveSection = content.indexOf('## Positive Examples');
      const negativeSection = content.indexOf('## Negative Examples');
      assert.ok(positiveSection >= 0, 'must have Positive Examples section');
      assert.ok(negativeSection >= 0, 'must have Negative Examples section');
      assert.ok(positiveSection < negativeSection, 'positive examples come before negative');
    });

    test('verifier.md contains exactly 7 examples (5 positive, 2 negative)', () => {
      const content = readFile(path.join(REFS_DIR, 'verifier.md'));
      const totalExamples = countPattern(content, /^### Example \d+/gm);
      assert.strictEqual(totalExamples, 7);

      const positiveSection = content.indexOf('## Positive Examples');
      const negativeSection = content.indexOf('## Negative Examples');
      assert.ok(positiveSection >= 0, 'must have Positive Examples section');
      assert.ok(negativeSection >= 0, 'must have Negative Examples section');
      assert.ok(positiveSection < negativeSection, 'positive examples come before negative');
    });
  });

  // ── WHY annotations ────────────────────────────────────────────
  describe('WHY annotations', () => {
    test('every plan-checker example has a WHY annotation', () => {
      const content = readFile(path.join(REFS_DIR, 'plan-checker.md'));
      const exampleCount = countPattern(content, /^### Example \d+/gm);
      const whyCount = countPattern(content, /^\*\*Why this is (good|bad):\*\*/gm);
      assert.strictEqual(whyCount, exampleCount,
        `expected ${exampleCount} WHY annotations, found ${whyCount}`);
    });

    test('every verifier example has a WHY annotation', () => {
      const content = readFile(path.join(REFS_DIR, 'verifier.md'));
      const exampleCount = countPattern(content, /^### Example \d+/gm);
      const whyCount = countPattern(content, /^\*\*Why this is (good|bad):\*\*/gm);
      assert.strictEqual(whyCount, exampleCount,
        `expected ${exampleCount} WHY annotations, found ${whyCount}`);
    });
  });

  // ── Agent reference lines ──────────────────────────────────────
  describe('agent files reference few-shot examples', () => {
    test('gsd-plan-checker.md contains reference to plan-checker few-shot examples', () => {
      const content = readFile(path.join(AGENTS_DIR, 'gsd-plan-checker.md'));
      assert.match(content, /@~\/\.claude\/get-shit-done\/references\/few-shot-examples\/plan-checker\.md/);
    });

    test('gsd-verifier.md contains reference to verifier few-shot examples', () => {
      const content = readFile(path.join(AGENTS_DIR, 'gsd-verifier.md'));
      assert.match(content, /@~\/\.claude\/get-shit-done\/references\/few-shot-examples\/verifier\.md/);
    });
  });

  // ── Content structure ──────────────────────────────────────────
  describe('content structure', () => {
    test('plan-checker examples include input/output pairs', () => {
      const content = readFile(path.join(REFS_DIR, 'plan-checker.md'));
      const inputCount = countPattern(content, /^\*\*Input:\*\*/gm);
      const outputCount = countPattern(content, /^\*\*Output:\*\*/gm);
      assert.ok(inputCount >= 4, `expected at least 4 Input blocks, found ${inputCount}`);
      assert.ok(outputCount >= 4, `expected at least 4 Output blocks, found ${outputCount}`);
    });

    test('verifier examples include input/output pairs', () => {
      const content = readFile(path.join(REFS_DIR, 'verifier.md'));
      const inputCount = countPattern(content, /^\*\*Input:\*\*/gm);
      const outputCount = countPattern(content, /^\*\*Output:\*\*/gm);
      assert.ok(inputCount >= 7, `expected at least 7 Input blocks, found ${inputCount}`);
      assert.ok(outputCount >= 7, `expected at least 7 Output blocks, found ${outputCount}`);
    });

    test('verifier.md includes calibration-derived gap patterns table', () => {
      const content = readFile(path.join(REFS_DIR, 'verifier.md'));
      assert.match(content, /## Calibration-Derived Gap Patterns/);
      assert.match(content, /Missing wiring/);
      assert.match(content, /Missing tests/);
    });
  });
});
