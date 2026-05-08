// allow-test-rule: source-text-is-the-product — workflow and command .md files
// ARE what the runtime loads; asserting their existence and behavioral content
// tests the deployed skill surface contract, not implementation internals.

'use strict';

// Regression tests for bug #3236.
//
// The `plant-seed.md` workflow gained a mandatory Trigger / Why / Scope
// questionnaire (gather_context step) that blocks before the seed file is
// written. Users capturing a stream of ideas lose flow because the AI must
// receive three answers before a single write happens.
//
// Fix: the seed file must be written FIRST (one-shot), with sensible defaults
// for Trigger / Why / Scope. The enrichment questions must be optional and must
// come AFTER the file is written, not before.
//
// Behavioral contract tested here:
//   1. The `write-seed` step exists and comes BEFORE any AskUserQuestion for
//      Trigger / Why / Scope enrichment.
//   2. The workflow provides sensible defaults for trigger_when and scope when
//      the user supplies only the idea summary.
//   3. The AskUserQuestion calls for Trigger / Why / Scope still exist (optional
//      enrichment path preserved) but are gated after the file is written.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PLANT_SEED = path.join(ROOT, 'get-shit-done', 'workflows', 'plant-seed.md');

// ── helpers ───────────────────────────────────────────────────────────────────

function readPlantSeed() {
  try {
    return fs.readFileSync(PLANT_SEED, 'utf8');
  } catch (err) {
    throw new Error('get-shit-done/workflows/plant-seed.md not found: ' + err.message);
  }
}

/**
 * Extract step names in document order from workflow XML.
 */
function extractStepNames(src) {
  const names = [];
  const re = /<step name="([^"]+)"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    names.push(m[1]);
  }
  return names;
}

/**
 * Return byte offset of the step opening tag, or -1 if absent.
 */
function stepOffset(src, stepName) {
  return src.indexOf('<step name="' + stepName + '"');
}

/**
 * Return byte offset of the first AskUserQuestion with the given header label.
 */
function askQuestionOffset(src, header) {
  return src.indexOf('header: "' + header + '"');
}

// ── #3236: plant-seed one-shot contract ──────────────────────────────────────

describe('#3236: plant-seed.md one-shot capture contract', () => {
  test('plant-seed.md exists', () => {
    assert.ok(
      fs.existsSync(PLANT_SEED),
      'get-shit-done/workflows/plant-seed.md does not exist',
    );
  });

  test('write-seed step exists (hyphenated name per CONTEXT.md rule)', () => {
    const src = readPlantSeed();
    const steps = extractStepNames(src);
    assert.ok(
      steps.includes('write-seed'),
      'plant-seed.md must contain a <step name="write-seed"> (hyphens, not underscores); found: ' + JSON.stringify(steps),
    );
  });

  test('write-seed step appears before Trigger AskUserQuestion', () => {
    const src = readPlantSeed();
    const writeOff = stepOffset(src, 'write-seed');
    assert.ok(writeOff !== -1, 'write-seed step must exist');
    const triggerOff = askQuestionOffset(src, 'Trigger');
    if (triggerOff === -1) return; // fully optional — no question at all is fine
    assert.ok(
      writeOff < triggerOff,
      'write-seed (offset ' + writeOff + ') must precede Trigger question (offset ' + triggerOff + ')',
    );
  });

  test('write-seed step appears before Why AskUserQuestion', () => {
    const src = readPlantSeed();
    const writeOff = stepOffset(src, 'write-seed');
    assert.ok(writeOff !== -1, 'write-seed step must exist');
    const whyOff = askQuestionOffset(src, 'Why');
    if (whyOff === -1) return;
    assert.ok(
      writeOff < whyOff,
      'write-seed (offset ' + writeOff + ') must precede Why question (offset ' + whyOff + ')',
    );
  });

  test('write-seed step appears before Scope AskUserQuestion', () => {
    const src = readPlantSeed();
    const writeOff = stepOffset(src, 'write-seed');
    assert.ok(writeOff !== -1, 'write-seed step must exist');
    const scopeOff = askQuestionOffset(src, 'Scope');
    if (scopeOff === -1) return;
    assert.ok(
      writeOff < scopeOff,
      'write-seed (offset ' + writeOff + ') must precede Scope question (offset ' + scopeOff + ')',
    );
  });

  test('workflow documents a default value for trigger_when', () => {
    const src = readPlantSeed();
    assert.ok(
      /trigger_when.*default|default.*trigger|when relevant|when scope matches|unspecified/i.test(src),
      'plant-seed.md must document a default for trigger_when when the user provides no Trigger',
    );
  });

  test('workflow documents a default value for scope', () => {
    const src = readPlantSeed();
    assert.ok(
      /scope.*default|default.*scope|scope.*unknown|unknown|scope.*unspecified|unspecified/i.test(src),
      'plant-seed.md must document a default for scope when the user provides no Scope',
    );
  });

  test('write-seed step precedes enrich/gather step in step order', () => {
    const src = readPlantSeed();
    const steps = extractStepNames(src);
    const writeIdx = steps.findIndex((s) => s === 'write-seed' || s === 'write_seed');
    const gatherIdx = steps.findIndex(
      (s) => s === 'gather-context' || s === 'gather_context' || s === 'enrich-seed' || s === 'enrich_seed',
    );
    if (gatherIdx === -1 || writeIdx === -1) return; // no gather step — one-shot only path, fine
    assert.ok(
      writeIdx < gatherIdx,
      'write-seed (step index ' + writeIdx + ') must appear before gather/enrich (index ' + gatherIdx + ') — capture first, enrich later',
    );
  });

  test('optional enrichment path is preserved', () => {
    const src = readPlantSeed();
    const hasEnrichStep = /enrich|gather.context|gather_context/i.test(src);
    const hasTriggerQuestion = src.includes('header: "Trigger"');
    assert.ok(
      hasEnrichStep || hasTriggerQuestion,
      'plant-seed.md must preserve an optional enrichment path (enrich step or Trigger/Why/Scope AskUserQuestion)',
    );
  });
});
