/**
 * Regression test for bug #2268
 *
 * cmdInitProgress used a sliding-window pattern that set is_next_to_discuss
 * only on the FIRST undiscussed phase. Multiple independent undiscussed phases
 * could not be discussed in parallel — the manager only ever recommended one
 * discuss action at a time.
 *
 * Fix: mark ALL undiscussed phases as is_next_to_discuss = true so the user
 * can pick any of them.
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

function writeRoadmap(tmpDir, phases) {
  const sections = phases.map(p => {
    let section = `### Phase ${p.number}: ${p.name}\n\n**Goal:** Do the thing\n`;
    return section;
  }).join('\n');
  const checklist = phases.map(p => {
    const mark = p.complete ? 'x' : ' ';
    return `- [${mark}] **Phase ${p.number}: ${p.name}**`;
  }).join('\n');
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    `# Roadmap\n\n## Progress\n\n${checklist}\n\n${sections}`
  );
}

function writeState(tmpDir) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '---\nstatus: active\n---\n# State\n');
}

let tmpDir;

describe('bug #2268: parallel discuss — all undiscussed phases marked is_next_to_discuss', () => {
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('two undiscussed phases: both marked is_next_to_discuss', () => {
    writeState(tmpDir);
    writeRoadmap(tmpDir, [
      { number: '1', name: 'Foundation' },
      { number: '2', name: 'Cloud Deployment' },
    ]);

    const result = runGsdTools('init manager', tmpDir);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.phases[0].is_next_to_discuss, true, 'phase 1 should be discussable');
    assert.strictEqual(output.phases[1].is_next_to_discuss, true, 'phase 2 should also be discussable');
  });

  test('two undiscussed phases: both get discuss recommendations', () => {
    writeState(tmpDir);
    writeRoadmap(tmpDir, [
      { number: '1', name: 'Foundation' },
      { number: '2', name: 'Cloud Deployment' },
    ]);

    const result = runGsdTools('init manager', tmpDir);
    const output = JSON.parse(result.output);

    const discussActions = output.recommended_actions.filter(a => a.action === 'discuss');
    assert.strictEqual(discussActions.length, 2, 'should recommend discuss for both undiscussed phases');

    const phases = discussActions.map(a => a.phase).sort();
    assert.deepStrictEqual(phases, ['1', '2']);
  });

  test('five undiscussed phases: all five marked is_next_to_discuss', () => {
    writeState(tmpDir);
    writeRoadmap(tmpDir, [
      { number: '1', name: 'Alpha' },
      { number: '2', name: 'Beta' },
      { number: '3', name: 'Gamma' },
      { number: '4', name: 'Delta' },
      { number: '5', name: 'Epsilon' },
    ]);

    const result = runGsdTools('init manager', tmpDir);
    const output = JSON.parse(result.output);

    for (const phase of output.phases) {
      assert.strictEqual(phase.is_next_to_discuss, true, `phase ${phase.number} should be discussable`);
    }
  });

  test('discussed phase stays false; undiscussed sibling is true', () => {
    writeState(tmpDir);
    writeRoadmap(tmpDir, [
      { number: '1', name: 'Foundation' },
      { number: '2', name: 'API Layer' },
    ]);
    // scaffold CONTEXT.md to mark phase 1 as discussed
    const dir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '01-CONTEXT.md'), '# Context');

    const result = runGsdTools('init manager', tmpDir);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.phases[0].is_next_to_discuss, false, 'discussed phase must not be is_next_to_discuss');
    assert.strictEqual(output.phases[1].is_next_to_discuss, true, 'undiscussed sibling must be is_next_to_discuss');
  });
});
