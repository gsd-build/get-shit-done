/**
 * new-project workflow — MVP mode prompt contract test
 * Verifies the workflow markdown documents the Vertical MVP / Horizontal Layers
 * prompt and the ROADMAP.md template branch under MVP mode.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'new-project.md');

function parseNewProjectContract(content) {
  const lines = content.split(/\r?\n/);
  const lowerLines = lines.map(line => line.toLowerCase());
  return {
    hasVerticalMvpOption: lowerLines.some(line => line.includes('vertical mvp')),
    hasHorizontalLayersOption: lowerLines.some(line => line.includes('horizontal layers')),
    hasModeMvpTemplateLine: lowerLines.some(line => line.includes('**mode:** mvp')),
    hasHorizontalStandardFallback: lowerLines.some(line =>
      (line.includes('horizontal') && line.includes('standard')) ||
      (line.includes('standard') && line.includes('horizontal')) ||
      (line.includes('no mode line'))
    ),
  };
}

describe('new-project — MVP mode prompt', () => {
  const contract = parseNewProjectContract(fs.readFileSync(WORKFLOW, 'utf-8'));

  test('workflow includes Vertical MVP option in mode prompt', () => {
    assert.ok(contract.hasVerticalMvpOption, 'must mention Vertical MVP option');
  });

  test('workflow includes Horizontal Layers option in mode prompt', () => {
    assert.ok(contract.hasHorizontalLayersOption, 'must mention Horizontal Layers option');
  });

  test('ROADMAP template emits **Mode:** mvp under Vertical MVP path', () => {
    assert.ok(contract.hasModeMvpTemplateLine, 'must emit **Mode:** mvp on initial roadmap phases under Vertical MVP');
  });

  test('workflow falls back to standard template when Horizontal Layers picked', () => {
    assert.ok(contract.hasHorizontalStandardFallback, 'must specify fallback to standard template');
  });
});
