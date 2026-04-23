/**
 * Decision-coverage gate tests for issue #2492.
 *
 * Two gates, two semantics:
 *
 *   - `check.decision-coverage-plan`  — translation gate, BLOCKING.
 *     Each trackable CONTEXT.md decision must appear (by id or text) in at
 *     least one PLAN.md `must_haves` / `truths` / body.
 *
 *   - `check.decision-coverage-verify` — validation gate, NON-BLOCKING.
 *     Each trackable decision should appear in shipped artifacts (PLANs,
 *     SUMMARY.md, files_modified, recent commit messages). Missing items
 *     are reported as warnings only.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  checkDecisionCoveragePlan,
  checkDecisionCoverageVerify,
} from './check-decision-coverage.js';

let tmp: string;
let phaseDir: string;
let contextPath: string;

async function setupPhase(decisionsBlock: string, plans: Record<string, string>, summary?: string) {
  await mkdir(phaseDir, { recursive: true });
  await writeFile(contextPath, `# Phase 17 Context\n\n${decisionsBlock}\n`, 'utf-8');
  for (const [name, content] of Object.entries(plans)) {
    await writeFile(join(phaseDir, name), content, 'utf-8');
  }
  if (summary !== undefined) {
    await writeFile(join(phaseDir, '17-SUMMARY.md'), summary, 'utf-8');
  }
}

function planFile(mustHavesYaml: string, body = ''): string {
  return `---
phase: 17
plan: 1
type: implementation
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
${mustHavesYaml}
---
${body}
`;
}

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'gsd-deccov-'));
  phaseDir = join(tmp, '.planning', 'phases', '17-foo');
  contextPath = join(phaseDir, '17-CONTEXT.md');
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('checkDecisionCoveragePlan — translation gate (#2492)', () => {
  it('passes when every trackable decision is cited by id in a plan', async () => {
    await setupPhase(
      `<decisions>
### Cat
- **D-01:** Use bit offsets
- **D-02:** Display TArray element type
</decisions>`,
      {
        '17-01-PLAN.md': planFile(
          `  truths:
    - "D-01: bit offsets are exposed via API"
  artifacts: []
  key_links: []`,
          'Implements D-02: TArray display logic.',
        ),
      },
    );

    const result = await checkDecisionCoveragePlan([phaseDir, contextPath], tmp);
    expect(result.data.passed).toBe(true);
    expect(result.data.uncovered).toEqual([]);
    expect(result.data.total).toBe(2);
    expect(result.data.covered).toBe(2);
  });

  it('fails when a decision is not covered by any plan and names it', async () => {
    await setupPhase(
      `<decisions>
### Cat
- **D-01:** Use bit offsets, not byte offsets
- **D-99:** A decision nobody bothered to plan
</decisions>`,
      {
        '17-01-PLAN.md': planFile(
          `  truths:
    - "D-01: bit offsets are exposed"
  artifacts: []
  key_links: []`,
        ),
      },
    );

    const result = await checkDecisionCoveragePlan([phaseDir, contextPath], tmp);
    expect(result.data.passed).toBe(false);
    expect(result.data.uncovered.map((u: { id: string }) => u.id)).toEqual(['D-99']);
    expect(result.data.message).toMatch(/D-99/);
  });

  it('honors `truths` AND `must_haves` body bullets', async () => {
    await setupPhase(
      `<decisions>
### Cat
- **D-01:** First decision
- **D-02:** Second decision
</decisions>`,
      {
        '17-01-PLAN.md': planFile(
          `  truths:
    - "D-01 honored"
  artifacts: []
  key_links: []`,
          '## must_haves\n- D-02: also honored in body\n',
        ),
      },
    );

    const result = await checkDecisionCoveragePlan([phaseDir, contextPath], tmp);
    expect(result.data.passed).toBe(true);
  });

  it('skips when context_coverage_gate is disabled in config', async () => {
    await setupPhase(
      `<decisions>
### Cat
- **D-01:** Anything
- **D-02:** Anything else
</decisions>`,
      { '17-01-PLAN.md': planFile(`  truths: []\n  artifacts: []\n  key_links: []`) },
    );
    await mkdir(join(tmp, '.planning'), { recursive: true });
    await writeFile(
      join(tmp, '.planning', 'config.json'),
      JSON.stringify({ workflow: { context_coverage_gate: false } }),
      'utf-8',
    );

    const result = await checkDecisionCoveragePlan([phaseDir, contextPath], tmp);
    expect(result.data.skipped).toBe(true);
    expect(result.data.passed).toBe(true);
  });

  it('skips cleanly when CONTEXT.md is missing', async () => {
    await mkdir(phaseDir, { recursive: true });
    const result = await checkDecisionCoveragePlan([phaseDir, contextPath], tmp);
    expect(result.data.skipped).toBe(true);
    expect(result.data.reason).toMatch(/CONTEXT/);
  });

  it('skips cleanly when <decisions> block is missing', async () => {
    await mkdir(phaseDir, { recursive: true });
    await writeFile(contextPath, '# Phase 17\n\nNo decisions block here.\n', 'utf-8');
    const result = await checkDecisionCoveragePlan([phaseDir, contextPath], tmp);
    expect(result.data.skipped).toBe(true);
  });

  it('does not flag non-trackable decisions (Discretion / informational / folded)', async () => {
    await setupPhase(
      `<decisions>
### Cat
- **D-01:** trackable
- **D-02 [informational]:** opt-out
- **D-03 [folded]:** opt-out

### Claude's Discretion
- **D-99:** never tracked
</decisions>`,
      {
        '17-01-PLAN.md': planFile(
          `  truths:
    - "D-01"
  artifacts: []
  key_links: []`,
        ),
      },
    );
    const result = await checkDecisionCoveragePlan([phaseDir, contextPath], tmp);
    expect(result.data.passed).toBe(true);
    expect(result.data.total).toBe(1); // only D-01 is trackable
  });
});

describe('checkDecisionCoverageVerify — validation gate (#2492)', () => {
  it('reports honored decisions when ID appears in shipped artifacts', async () => {
    await setupPhase(
      `<decisions>
### Cat
- **D-05:** Validate input
</decisions>`,
      { '17-01-PLAN.md': planFile(`  truths: ["D-05"]\n  artifacts: []\n  key_links: []`) },
      '## Summary\nImplemented D-05.\nfiles_modified: []\n',
    );

    const result = await checkDecisionCoverageVerify([phaseDir, contextPath], tmp);
    expect(result.data.honored).toBe(1);
    expect(result.data.not_honored).toEqual([]);
    expect(result.data.blocking).toBe(false);
  });

  it('reports decisions not honored when ID appears nowhere', async () => {
    await setupPhase(
      `<decisions>
### Cat
- **D-50:** Add metrics endpoint
</decisions>`,
      { '17-01-PLAN.md': planFile(`  truths: []\n  artifacts: []\n  key_links: []`) },
      '## Summary\nDid other things.\n',
    );

    const result = await checkDecisionCoverageVerify([phaseDir, contextPath], tmp);
    expect(result.data.honored).toBe(0);
    expect(result.data.not_honored.map((u: { id: string }) => u.id)).toEqual(['D-50']);
    expect(result.data.blocking).toBe(false); // non-blocking by spec
    expect(result.data.message).toMatch(/D-50/);
  });

  it('skips when context_coverage_gate is disabled', async () => {
    await setupPhase(
      `<decisions>
### Cat
- **D-50:** anything
</decisions>`,
      { '17-01-PLAN.md': planFile(`  truths: []\n  artifacts: []\n  key_links: []`) },
    );
    await mkdir(join(tmp, '.planning'), { recursive: true });
    await writeFile(
      join(tmp, '.planning', 'config.json'),
      JSON.stringify({ workflow: { context_coverage_gate: false } }),
      'utf-8',
    );
    const result = await checkDecisionCoverageVerify([phaseDir, contextPath], tmp);
    expect(result.data.skipped).toBe(true);
    expect(result.data.blocking).toBe(false);
  });

  it('skips cleanly when CONTEXT.md is missing', async () => {
    await mkdir(phaseDir, { recursive: true });
    const result = await checkDecisionCoverageVerify([phaseDir, contextPath], tmp);
    expect(result.data.skipped).toBe(true);
  });
});
