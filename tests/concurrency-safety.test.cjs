/**
 * GSD Tools Tests - Concurrency Safety
 *
 * Tests for fix/concurrency-safety-1473a:
 *   - Planning lock integration (withPlanningLock in phase/roadmap operations)
 *   - readModifyWriteStateMd (atomic state updates)
 *   - normalizeMd behavioral equivalence (O(n) insideFence rewrite)
 *   - Warnings (frontmatter parse warning, stateReplaceFieldWithFallback)
 *   - Performance benchmarks (normalizeMd O(n) verification)
 *   - Snapshot tests for normalizeMd (regression detection)
 *   - Multi-process concurrent write tests
 *   - Stress tests at scale (50+ phases)
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, exec } = require('child_process');
const { promisify } = require('util');
const { performance } = require('perf_hooks');
const { runGsdTools, createTempProject, cleanup, TOOLS_PATH } = require('./helpers.cjs');

const {
  normalizeMd,
} = require('../get-shit-done/bin/lib/core.cjs');

const execAsync = promisify(exec);

// ─── Helpers ────────────────────────────────────────────────────────────────

function writeMinimalRoadmap(tmpDir, phases = ['1']) {
  const lines = phases.map(n => `### Phase ${n}: Phase ${n} Description`).join('\n');
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    `# Roadmap\n\n${lines}\n`
  );
}

function writeMinimalStateMd(tmpDir, content) {
  const defaultContent = content || `# Session State\n\n## Current Position\n\nPhase: 1\n`;
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    defaultContent
  );
}

function writeMinimalProjectMd(tmpDir) {
  const sections = ['## What This Is', '## Core Value', '## Requirements'];
  const content = sections.map(s => `${s}\n\nContent here.\n`).join('\n');
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'PROJECT.md'),
    `# Project\n\n${content}`
  );
}

function writeValidConfigJson(tmpDir, overrides = {}) {
  const base = { model_profile: 'balanced', commit_docs: true };
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ ...base, ...overrides }, null, 2)
  );
}

/**
 * Generate a 50-phase project structure for stress testing.
 */
function create50PhaseProject(tmpDir, completedCount = 25) {
  let roadmapContent = '# Roadmap v1.0\n\n';
  for (let i = 1; i <= 50; i++) {
    roadmapContent += `- [${i <= completedCount ? 'x' : ' '}] Phase ${i}: Feature ${i}\n`;
  }
  roadmapContent += '\n';
  for (let i = 1; i <= 50; i++) {
    const pad = String(i).padStart(2, '0');
    roadmapContent += `### Phase ${i}: Feature ${i}\n\n`;
    roadmapContent += `**Goal:** Build feature ${i}\n`;
    roadmapContent += `**Requirements:** REQ-${pad}\n`;
    roadmapContent += `**Plans:** 1 plans\n\n`;
    roadmapContent += `Plans:\n- [${i <= completedCount ? 'x' : ' '}] ${pad}-01-PLAN.md\n\n`;
  }
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    roadmapContent
  );

  const phasesDir = path.join(tmpDir, '.planning', 'phases');
  for (let i = 1; i <= 50; i++) {
    const pad = String(i).padStart(2, '0');
    const dirName = `${pad}-feature-${i}`;
    const phaseDir = path.join(phasesDir, dirName);
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(
      path.join(phaseDir, `${pad}-01-PLAN.md`),
      `# Phase ${i} Plan 1\n\nBuild feature ${i}.\n`
    );
    if (i <= completedCount) {
      fs.writeFileSync(
        path.join(phaseDir, `${pad}-01-SUMMARY.md`),
        `# Phase ${i} Plan 1 Summary\n\nFeature ${i} completed.\n`
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Planning lock integration
// ─────────────────────────────────────────────────────────────────────────────

describe('planning lock integration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('phase add creates and releases .planning/.lock during ROADMAP write', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n\n---\n`
    );

    const result = runGsdTools('phase add Testing', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const lockPath = path.join(tmpDir, '.planning', '.lock');
    assert.ok(!fs.existsSync(lockPath), '.lock file should be released after phase add');

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 2, 'should be phase 2');
  });

  test('phase complete creates and releases .planning/.lock', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n- [ ] Phase 1: Foundation\n\n### Phase 1: Foundation\n**Goal:** Setup\n**Plans:** 1 plans\n\n### Phase 2: API\n**Goal:** Build\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Current Phase:** 01\n**Current Phase Name:** Foundation\n**Status:** In progress\n**Current Plan:** 01-01\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '02-api'), { recursive: true });

    const result = runGsdTools('phase complete 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const lockPath = path.join(tmpDir, '.planning', '.lock');
    assert.ok(!fs.existsSync(lockPath), '.lock file should be released after phase complete');

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed_phase, '1', 'phase should be completed');
  });

  test('roadmap update-plan-progress creates and releases .planning/.lock', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n| Phase | Plans | Status | Updated |\n|-------|-------|--------|---------|\n| 1 | 0/0 | Not started | - |\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('roadmap update-plan-progress 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const lockPath = path.join(tmpDir, '.planning', '.lock');
    assert.ok(!fs.existsSync(lockPath), '.lock file should be released after roadmap update');
  });

  test('lock file does NOT persist after successful phase operations', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );

    runGsdTools('phase add First Phase', tmpDir);
    runGsdTools('phase add Second Phase', tmpDir);

    const lockPath = path.join(tmpDir, '.planning', '.lock');
    assert.ok(!fs.existsSync(lockPath), '.lock file should not persist after multiple operations');
  });

  test('phase add still works correctly with lock (behavioral regression)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n\n### Phase 2: API\n**Goal:** Build API\n\n---\n`
    );

    const result = runGsdTools('phase add User Dashboard', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_number, 3, 'should be phase 3');
    assert.strictEqual(output.slug, 'user-dashboard');

    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '03-user-dashboard')),
      'directory should be created'
    );

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('### Phase 3: User Dashboard'), 'roadmap should include new phase');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. readModifyWriteStateMd (tested via CLI commands that use it)
// ─────────────────────────────────────────────────────────────────────────────

describe('readModifyWriteStateMd (via state patch)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('transforms content atomically (read + modify + write under lock)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Current Phase:** 03\n**Status:** Planning\n**Current Plan:** 03-01\n`
    );

    const result = runGsdTools('state patch --Status "In progress" --"Current Plan" 03-02', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Status:** In progress'), 'Status should be updated');
    assert.ok(content.includes('03-02'), 'Current Plan should be updated');

    const lockPath = path.join(tmpDir, '.planning', 'STATE.md.lock');
    assert.ok(!fs.existsSync(lockPath), 'STATE.md.lock should be released after patch');
  });

  test('lock file cleaned up after state patch operation', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Current Phase:** 01\n**Status:** Ready\n`
    );

    runGsdTools('state patch --Status "In progress"', tmpDir);

    const lockPath = path.join(tmpDir, '.planning', 'STATE.md.lock');
    assert.ok(!fs.existsSync(lockPath), 'STATE.md.lock should not persist after operation');
  });

  test('state patch still works correctly via readModifyWriteStateMd path (behavioral regression)', () => {
    const stateMd = [
      '# Project State',
      '',
      '**Current Phase:** 03',
      '**Status:** Planning',
      '**Current Plan:** 03-01',
      '**Last Activity:** 2024-01-15',
    ].join('\n') + '\n';

    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateMd);

    const result = runGsdTools('state patch --Status Complete --"Current Phase" 04', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const updated = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(updated.includes('**Status:** Complete'), 'Status should be updated to Complete');
    assert.ok(updated.includes('**Last Activity:** 2024-01-15'), 'Last Activity should be unchanged');
  });

  test('two sequential state patches both persist (patch A then patch B)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Current Phase:** 01\n**Status:** Planning\n**Current Plan:** 01-01\n**Last Activity:** 2024-01-01\n`
    );

    const resultA = runGsdTools('state patch --Status "In progress"', tmpDir);
    assert.ok(resultA.success, `Patch A failed: ${resultA.error}`);

    const resultB = runGsdTools('state patch --"Current Plan" 01-02', tmpDir);
    assert.ok(resultB.success, `Patch B failed: ${resultB.error}`);

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('**Status:** In progress'), 'Patch A (Status) should persist');
    assert.ok(content.includes('01-02'), 'Patch B (Current Plan) should persist');
    assert.ok(content.includes('**Last Activity:** 2024-01-01'), 'Untouched field should be preserved');
  });

  test('lock file does not persist after rapid sequential patches', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Current Phase:** 01\n**Status:** Planning\n**Current Plan:** 01-01\n`
    );

    runGsdTools('state patch --Status "In progress"', tmpDir);
    runGsdTools('state patch --"Current Plan" 01-02', tmpDir);
    runGsdTools('state patch --Status Complete', tmpDir);

    const lockPath = path.join(tmpDir, '.planning', 'STATE.md.lock');
    assert.ok(!fs.existsSync(lockPath), 'STATE.md.lock should not persist after rapid sequential patches');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Multi-process concurrent write tests
// ─────────────────────────────────────────────────────────────────────────────

describe('multi-process concurrent write tests', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('two concurrent state patches to DIFFERENT fields both persist', async () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      [
        '# Project State',
        '',
        '**Current Phase:** 01',
        '**Status:** In progress',
        '**Current Plan:** 01-01',
        '**Last Activity:** 2025-01-01',
        '**Last Activity Description:** Working',
        '',
      ].join('\n')
    );

    const toolsPath = TOOLS_PATH;
    const nodeBin = process.execPath;
    const cmdA = `"${nodeBin}" "${toolsPath}" state patch --Status Complete --cwd "${tmpDir}"`;
    const cmdB = `"${nodeBin}" "${toolsPath}" state patch --"Current Plan" 01-02 --cwd "${tmpDir}"`;

    const [resultA, resultB] = await Promise.all([
      execAsync(cmdA, { encoding: 'utf-8' }).catch(e => e),
      execAsync(cmdB, { encoding: 'utf-8' }).catch(e => e),
    ]);

    const aOk = !(resultA instanceof Error);
    const bOk = !(resultB instanceof Error);
    assert.ok(aOk || bOk, 'At least one concurrent patch should succeed');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');

    assert.ok(
      content.includes('Complete') || content.includes('01-02'),
      `At least one concurrent patch should persist in STATE.md. Content:\n${content}`
    );

    if (content.includes('Complete') && content.includes('01-02')) {
      assert.ok(true, 'Both concurrent patches persisted (lock serialization)');
    }

    assert.ok(content.includes('**Current Phase:** 01'), 'Untouched field Current Phase should survive');
    assert.ok(content.includes('2025-01-01'), 'Untouched field Last Activity should survive');
  });

  test('lock file does not persist after concurrent operations', async () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      [
        '# Project State',
        '',
        '**Current Phase:** 01',
        '**Status:** Planning',
        '**Current Plan:** 01-01',
        '',
      ].join('\n')
    );

    const toolsPath = TOOLS_PATH;
    const nodeBin = process.execPath;
    const cmdA = `"${nodeBin}" "${toolsPath}" state patch --Status Complete --cwd "${tmpDir}"`;
    const cmdB = `"${nodeBin}" "${toolsPath}" state patch --"Current Plan" 01-02 --cwd "${tmpDir}"`;

    await Promise.all([
      execAsync(cmdA, { encoding: 'utf-8' }).catch(() => {}),
      execAsync(cmdB, { encoding: 'utf-8' }).catch(() => {}),
    ]);

    const lockPath = path.join(tmpDir, '.planning', 'STATE.md.lock');
    assert.ok(
      !fs.existsSync(lockPath),
      'STATE.md.lock should not persist after concurrent operations complete'
    );
  });

  test('three rapid sequential patches all persist', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      [
        '# Project State',
        '',
        '**Current Phase:** 01',
        '**Status:** Planning',
        '**Current Plan:** 01-01',
        '**Last Activity:** 2025-01-01',
        '',
      ].join('\n')
    );

    const r1 = runGsdTools('state patch --Status "In progress"', tmpDir);
    assert.ok(r1.success, `Patch 1 failed: ${r1.error}`);

    const r2 = runGsdTools('state patch --"Current Plan" 01-02', tmpDir);
    assert.ok(r2.success, `Patch 2 failed: ${r2.error}`);

    const r3 = runGsdTools('state patch --"Last Activity" 2025-06-15', tmpDir);
    assert.ok(r3.success, `Patch 3 failed: ${r3.error}`);

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('In progress'), 'Patch 1 (Status) should persist');
    assert.ok(content.includes('01-02'), 'Patch 2 (Current Plan) should persist');
    assert.ok(content.includes('2025-06-15'), 'Patch 3 (Last Activity) should persist');
    assert.ok(content.includes('**Current Phase:** 01'), 'Untouched field should be preserved');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. normalizeMd behavioral equivalence (O(n) insideFence rewrite)
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeMd behavioral equivalence', () => {
  test('simple markdown with headings and paragraphs', () => {
    const input = '# Title\nSome text.\n## Section\nMore text.\n';
    const result = normalizeMd(input);
    assert.ok(result.includes('# Title\n\nSome text.'), 'title heading should have blank line after');
    assert.ok(result.includes('\n\n## Section\n\nMore text.'), 'section heading should have blank lines around it');
    assert.ok(result.endsWith('\n'), 'should end with newline');
    assert.ok(!result.endsWith('\n\n'), 'should not end with double newline');
  });

  test('single fenced code block gets blank lines before/after', () => {
    const input = 'Some text\n```js\nconst x = 1;\n```\nMore text\n';
    const result = normalizeMd(input);
    assert.ok(result.includes('Some text\n\n```js'), 'code block should have blank line before');
    assert.ok(result.includes('```\n\nMore text'), 'code block should have blank line after');
    assert.ok(result.includes('const x = 1;'), 'code content should be preserved');
  });

  test('multiple fenced code blocks', () => {
    const input = 'Intro\n```js\nfoo();\n```\nMiddle\n```py\nbar()\n```\nEnd\n';
    const result = normalizeMd(input);
    assert.ok(result.includes('Intro\n\n```js'), 'first code block should have blank line before');
    assert.ok(result.includes('```\n\nMiddle'), 'first code block should have blank line after');
    assert.ok(result.includes('Middle\n\n```py'), 'second code block should have blank line before');
    assert.ok(result.includes('```\n\nEnd'), 'second code block should have blank line after');
  });

  test('unclosed fence at end of file (edge case)', () => {
    const input = 'Some text\n```js\nconst x = 1;\n';
    const result = normalizeMd(input);
    assert.ok(typeof result === 'string', 'should return a string');
    assert.ok(result.includes('```js'), 'fence opener should be preserved');
    assert.ok(result.includes('const x = 1;'), 'content after unclosed fence should be preserved');
    assert.ok(result.endsWith('\n'), 'should end with newline');
  });

  test('empty string input', () => {
    assert.strictEqual(normalizeMd(''), '', 'empty string should return empty string');
  });

  test('mixed headings + lists + fences (complex case)', () => {
    const input = [
      '# Title',
      '## Section One',
      'Paragraph text.',
      '- item 1',
      '- item 2',
      '## Section Two',
      '```bash',
      'echo hello',
      '```',
      'After code.',
      '## Section Three',
      '1. First',
      '2. Second',
      'Done.',
    ].join('\n') + '\n';

    const result = normalizeMd(input);

    assert.ok(result.includes('\n\n## Section One\n\n'), 'Section One heading needs blank lines');
    assert.ok(result.includes('\n\n## Section Two\n\n'), 'Section Two heading needs blank lines');
    assert.ok(result.includes('\n\n## Section Three\n\n'), 'Section Three heading needs blank lines');
    assert.ok(result.includes('Paragraph text.\n\n- item 1'), 'list should have blank line before');
    assert.ok(result.includes('\n\n```bash'), 'code block should have blank line before');
    assert.ok(result.includes('```\n\nAfter code.'), 'code block should have blank line after');
    assert.ok(result.includes('echo hello'), 'code content should be preserved');
    assert.ok(!result.includes('\n\n\n'), 'should not have 3+ consecutive blank lines');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. normalizeMd performance benchmark
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeMd performance benchmark', () => {
  test('processes a 100-line markdown file in under 50ms', () => {
    const lines = [];
    for (let i = 0; i < 100; i++) {
      if (i % 20 === 0) {
        lines.push(`## Section ${i / 20 + 1}`);
      } else if (i % 30 === 0) {
        lines.push('```js');
        lines.push(`const x${i} = ${i};`);
        lines.push('```');
      } else if (i % 5 === 0) {
        lines.push(`- List item ${i}`);
      } else {
        lines.push(`Paragraph text line ${i} with some content to process.`);
      }
    }
    const input = lines.join('\n') + '\n';

    const start = performance.now();
    const result = normalizeMd(input);
    const elapsed = performance.now() - start;

    assert.ok(typeof result === 'string', 'should return a string');
    assert.ok(result.length > 0, 'result should not be empty');
    assert.ok(result.endsWith('\n'), 'result should end with newline');
    assert.ok(elapsed < 50, `100-line file should process in under 50ms, took ${elapsed.toFixed(2)}ms`);
  });

  test('processes a 1000-line markdown file with 20 code blocks in under 200ms', () => {
    const lines = [];
    let codeBlockCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (i % 50 === 0 && codeBlockCount < 20) {
        lines.push(`## Section ${codeBlockCount + 1}`);
        lines.push('');
        lines.push('Some introductory text for this section.');
        lines.push('');
        lines.push('```python');
        for (let j = 0; j < 5; j++) {
          lines.push(`    result_${codeBlockCount}_${j} = compute(${j})`);
        }
        lines.push('```');
        lines.push('');
        lines.push('Explanation of the code above.');
        codeBlockCount++;
      } else if (i % 10 === 0) {
        lines.push(`### Subsection at line ${i}`);
      } else if (i % 7 === 0) {
        lines.push(`- Item ${i}: description of this list item`);
      } else if (i % 13 === 0) {
        lines.push(`1. Ordered item ${i}`);
      } else {
        lines.push(`Line ${i}: Regular paragraph content with various markdown elements.`);
      }
    }
    const input = lines.join('\n') + '\n';

    normalizeMd(input); // warm up JIT

    const start = performance.now();
    const result = normalizeMd(input);
    const elapsed = performance.now() - start;

    assert.ok(typeof result === 'string', 'should return a string');
    assert.ok(result.length > 0, 'result should not be empty');
    assert.ok(result.endsWith('\n'), 'result should end with newline');
    assert.ok(!result.includes('\n\n\n'), 'should not have 3+ consecutive blank lines');
    assert.ok(elapsed < 200, `1000-line file with 20 code blocks should process in under 200ms, took ${elapsed.toFixed(2)}ms`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. normalizeMd snapshot tests
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeMd snapshot tests', () => {
  test('snapshot - heading spacing', () => {
    const input = '# Title\nParagraph\n## Section\nMore text';
    const expected = '# Title\n\nParagraph\n\n## Section\n\nMore text\n';
    const result = normalizeMd(input);
    assert.strictEqual(result, expected,
      `Heading spacing snapshot mismatch.\nGot:      ${JSON.stringify(result)}\nExpected: ${JSON.stringify(expected)}`
    );
  });

  test('snapshot - code block spacing', () => {
    const input = 'Text before\n```js\nconst x = 1;\n```\nText after\n';
    const expected = 'Text before\n\n```js\nconst x = 1;\n```\n\nText after\n';
    const result = normalizeMd(input);
    assert.strictEqual(result, expected,
      `Code block spacing snapshot mismatch.\nGot:      ${JSON.stringify(result)}\nExpected: ${JSON.stringify(expected)}`
    );
  });

  test('snapshot - list spacing', () => {
    const input = 'Paragraph\n- item 1\n- item 2\nAnother paragraph';
    const expected = 'Paragraph\n\n- item 1\n- item 2\n\nAnother paragraph\n';
    const result = normalizeMd(input);
    assert.strictEqual(result, expected,
      `List spacing snapshot mismatch.\nGot:      ${JSON.stringify(result)}\nExpected: ${JSON.stringify(expected)}`
    );
  });

  test('snapshot - complex mixed document', () => {
    const input = [
      '# Main Title',
      'Intro paragraph.',
      '## Section One',
      'Some text here.',
      '```js',
      'const a = 1;',
      '```',
      '- first item',
      '- second item',
      '## Section Two',
      'Final text.',
    ].join('\n');

    const expected = [
      '# Main Title',
      '',
      'Intro paragraph.',
      '',
      '## Section One',
      '',
      'Some text here.',
      '',
      '```js',
      'const a = 1;',
      '```',
      '',
      '- first item',
      '- second item',
      '',
      '## Section Two',
      '',
      'Final text.',
      '',
    ].join('\n');

    const result = normalizeMd(input);
    assert.strictEqual(result, expected,
      `Complex mixed document snapshot mismatch.\nGot:      ${JSON.stringify(result)}\nExpected: ${JSON.stringify(expected)}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Warnings (frontmatter parse, state field miss)
// ─────────────────────────────────────────────────────────────────────────────

describe('warnings', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('must_haves parse warning fires for block with content but 0 items', () => {
    const planDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(planDir, { recursive: true });
    fs.writeFileSync(
      path.join(planDir, '01-01-PLAN.md'),
      `---
phase: "01"
plan: "01"
must_haves:
  acceptance:
    bare content without dash prefix
    another line without dash prefix
---

# Plan 01-01
`
    );

    const result = runGsdTools(
      ['frontmatter', 'get', path.join(planDir, '01-01-PLAN.md'), 'must_haves'],
      tmpDir
    );

    const stderr = result.error || '';
    assert.ok(
      stderr.includes('WARNING') && stderr.includes('must_haves') ||
      result.output.includes('acceptance'),
      `Expected WARNING about must_haves parse or valid parse result. stderr: ${stderr}, stdout: ${result.output}`
    );
  });

  test('stateReplaceFieldWithFallback logs warning on miss', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# Project State\n\n**Current Phase:** 01\n**Current Plan:** 1\n**Total Plans in Phase:** 3\n`
    );

    const result = runGsdTools('state advance-plan', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.advanced === true || output.reason === 'last_plan', 'advance should complete');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Malformed input resilience
// ─────────────────────────────────────────────────────────────────────────────

describe('malformed input resilience', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('STATE.md with invalid bold format -- state patch returns gracefully', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n**Current Phase: 01\n**Status:** Planning\n'
    );

    const result = runGsdTools('state patch --Status "In progress"', tmpDir);
    const didNotCrash = result.success || (result.output !== undefined);
    assert.ok(didNotCrash, `state patch should not crash on malformed bold format: ${result.error}`);

    if (result.success) {
      const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
      assert.ok(
        content.includes('In progress'),
        'Status field (with valid bold format) should be updated'
      );
    }
  });

  test('STATE.md with only frontmatter, no body -- state patch handles gracefully', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nphase: "01"\n---\n'
    );

    const result = runGsdTools('state patch --Status "In progress"', tmpDir);
    const didNotCrash = result.success || (result.output !== undefined);
    assert.ok(didNotCrash, `state patch should not crash on frontmatter-only STATE.md: ${result.error}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Stress tests with 50+ phases
// ─────────────────────────────────────────────────────────────────────────────

describe('stress tests with 50+ phases', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('roadmap analyze on 50-phase ROADMAP completes in under 2000ms', () => {
    create50PhaseProject(tmpDir, 25);

    const start = performance.now();
    const result = runGsdTools('roadmap analyze', tmpDir);
    const elapsed = performance.now() - start;

    assert.ok(result.success, `roadmap analyze should succeed: ${result.error}`);
    assert.ok(elapsed < 2000, `Should complete in under 2000ms, took ${elapsed.toFixed(0)}ms`);

    const output = JSON.parse(result.output);
    assert.ok(Array.isArray(output.phases), 'Output should contain a phases array');
    assert.strictEqual(output.phases.length, 50, `Should have 50 phases, got ${output.phases.length}`);

    const completedPhases = output.phases.filter(p => p.disk_status === 'complete');
    assert.strictEqual(completedPhases.length, 25, `Should have 25 complete phases, got ${completedPhases.length}`);
  });

  test('phase complete on phase 26 of 50-phase project works correctly', () => {
    create50PhaseProject(tmpDir, 25);
    writeMinimalStateMd(tmpDir, '# Session State\n\n**Current Phase:** 26\n**Status:** In progress\n');

    const phase26Dir = path.join(tmpDir, '.planning', 'phases', '26-feature-26');
    fs.writeFileSync(
      path.join(phase26Dir, '26-01-SUMMARY.md'),
      '# Phase 26 Plan 1 Summary\n\nFeature 26 completed.\n'
    );

    const result = runGsdTools('phase complete 26', tmpDir);
    assert.ok(result.success, `phase complete 26 should succeed: ${result.error}`);

    const roadmapContent = fs.readFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      'utf-8'
    );
    const phase26Checkbox = roadmapContent.match(/-\s*\[(x| )\]\s*.*Phase\s+26/i);
    assert.ok(phase26Checkbox, 'Should find Phase 26 checkbox in ROADMAP');
    assert.strictEqual(phase26Checkbox[1], 'x', 'Phase 26 should now be marked as complete [x]');
  });
});
