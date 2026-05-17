'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'get-shit-done', 'workflows');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function extractFindingsProbesFromBashBlocks(markdown) {
  const probes = [];
  const fenceRe = /```bash\r?\n([\s\S]*?)```/g;
  let fenceMatch;

  while ((fenceMatch = fenceRe.exec(markdown)) !== null) {
    const block = fenceMatch[1];
    const baseLine = markdown.slice(0, fenceMatch.index).split(/\r?\n/).length;
    const lines = block.split(/\r?\n/);

    lines.forEach((line, idx) => {
      if (!line.includes('.claude/skills/')) return;
      const kind = line.includes('sketch-findings-*/SKILL.md')
        ? 'sketch'
        : line.includes('spike-findings-*/SKILL.md')
          ? 'spike'
          : null;
      if (!kind) return;

      probes.push({
        lineNumber: baseLine + idx,
        commandText: line.trim(),
        kind,
        hasNonFatalGuard: /\|\|\s*true/.test(line),
      });
    });
  }

  return probes;
}

describe('bug #3072: optional sketch/spike findings probes are non-fatal', () => {
  test('all sketch/spike findings SKILL.md ls probes include || true', () => {
    const files = ['ui-phase.md', 'plan-phase.md', 'discuss-phase.md', 'new-project.md'];
    const offenders = [];

    for (const file of files) {
      const content = read(file);
      const probes = extractFindingsProbesFromBashBlocks(content);
      for (const probe of probes) {
        if (!probe.hasNonFatalGuard) {
          offenders.push(`${file}:${probe.lineNumber} ${probe.commandText}`);
        }
      }
    }

    assert.deepStrictEqual(offenders, [], `missing non-fatal guard on optional findings probe:\n${offenders.join('\n')}`);
  });
});
