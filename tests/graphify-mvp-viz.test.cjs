/**
 * graphify — MVP visual differentiation contract test
 * Per PRD Q5: distinct node color + 'MVP' label suffix.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CMD = path.join(__dirname, '..', 'commands', 'gsd', 'graphify.md');

function parseVizContract(content) {
  const lines = content.split(/\r?\n/);
  const lowerLines = lines.map(line => line.toLowerCase());
  const mvpLines = lines.filter(line => line.toLowerCase().includes('mvp'));
  return {
    mentionsMvp: mvpLines.length > 0,
    colorRuleLine: mvpLines.find(line => {
      const lower = line.toLowerCase();
      return lower.includes('color') || lower.includes('fill') || line.includes('#');
    }) || '',
    labelRuleLine: mvpLines.find(line => {
      const lower = line.toLowerCase();
      return lower.includes('label') || lower.includes('suffix');
    }) || '',
    fallbackLine: lowerLines.find(line =>
      (line.includes('mode') && (line.includes('null') || line.includes('absent') || line.includes('not mvp'))) ||
      (line.includes('standard') && (line.includes('render') || line.includes('fallback')))
    ) || '',
  };
}

describe('graphify — MVP visualization', () => {
  const contract = parseVizContract(fs.readFileSync(CMD, 'utf-8'));

  test('command documents distinct color for MVP-mode phases', () => {
    assert.ok(contract.mentionsMvp, 'must mention MVP in color rule');
    assert.ok(contract.colorRuleLine.length > 0, 'must reference a color/fill rule for MVP nodes');
  });

  test('command documents MVP label suffix on node text', () => {
    assert.ok(contract.labelRuleLine.length > 0, 'must add an MVP label/suffix to node text');
  });

  test('falls back to standard rendering when phase mode is null', () => {
    assert.ok(contract.fallbackLine.length > 0, 'must specify fallback when mode is not mvp');
  });
});
