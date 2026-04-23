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
          // D-02 cited under a designated `## tasks` heading (review F4).
          '## tasks\n- Implements D-02: TArray display logic.\n',
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

// ─── Adversarial-review regression tests ──────────────────────────────────

describe('translation gate haystack restriction (review F4)', () => {
  it('does NOT count a D-NN citation buried in an HTML comment', async () => {
    await setupPhase(
      `<decisions>
### Cat
- **D-77:** A trackable decision worth six or more words long
</decisions>`,
      {
        '17-01-PLAN.md': planFile(
          `  truths: []\n  artifacts: []\n  key_links: []`,
          '<!-- D-77 was here -->\nNothing else mentions the decision.',
        ),
      },
    );
    const result = await checkDecisionCoveragePlan([phaseDir, contextPath], tmp);
    expect(result.data.passed).toBe(false);
    expect(result.data.uncovered.map((u: { id: string }) => u.id)).toContain('D-77');
  });

  it('does NOT count a D-NN citation buried in a fenced code example', async () => {
    await setupPhase(
      `<decisions>
### Cat
- **D-78:** A trackable decision worth six or more words long
</decisions>`,
      {
        '17-01-PLAN.md': planFile(
          `  truths: []\n  artifacts: []\n  key_links: []`,
          '## Design notes\n\n```text\nExample: D-78 should appear here\n```\n',
        ),
      },
    );
    const result = await checkDecisionCoveragePlan([phaseDir, contextPath], tmp);
    expect(result.data.passed).toBe(false);
    expect(result.data.uncovered.map((u: { id: string }) => u.id)).toContain('D-78');
  });

  it('counts a citation in front-matter `must_haves`', async () => {
    await setupPhase(
      `<decisions>
### Cat
- **D-79:** Trackable decision text long enough to soft-match.
</decisions>`,
      {
        '17-01-PLAN.md': `---
phase: 17
plan: 1
must_haves:
  - "D-79 must be honored"
truths: []
artifacts: []
key_links: []
---
`,
      },
    );
    const result = await checkDecisionCoveragePlan([phaseDir, contextPath], tmp);
    expect(result.data.passed).toBe(true);
  });

  it('counts a citation in front-matter `truths`', async () => {
    await setupPhase(
      `<decisions>
### Cat
- **D-80:** Trackable decision text long enough to soft-match.
</decisions>`,
      {
        '17-01-PLAN.md': planFile(`  truths: ["D-80 honored"]\n  artifacts: []\n  key_links: []`),
      },
    );
    const result = await checkDecisionCoveragePlan([phaseDir, contextPath], tmp);
    expect(result.data.passed).toBe(true);
  });
});

describe('soft-phrase length gating (review F5)', () => {
  it('flags a sub-6-word decision when only the body paraphrases — id citation is required', async () => {
    await setupPhase(
      // 4 words → cannot soft-match; user must cite the id.
      `<decisions>
### Cat
- **D-81:** Use bit offsets always
</decisions>`,
      {
        '17-01-PLAN.md': planFile(
          `  truths: ["something else"]\n  artifacts: []\n  key_links: []`,
          // No D-81 citation, paraphrase only.
          '## tasks\n- Use bit offsets in storage layer\n',
        ),
      },
    );
    const result = await checkDecisionCoveragePlan([phaseDir, contextPath], tmp);
    expect(result.data.passed).toBe(false);
    expect(result.data.uncovered.map((u: { id: string }) => u.id)).toEqual(['D-81']);
  });

  it('still passes a sub-6-word decision when the id is cited', async () => {
    await setupPhase(
      `<decisions>
### Cat
- **D-82:** Disable cache
</decisions>`,
      {
        '17-01-PLAN.md': planFile(`  truths: ["D-82"]\n  artifacts: []\n  key_links: []`),
      },
    );
    const result = await checkDecisionCoveragePlan([phaseDir, contextPath], tmp);
    expect(result.data.passed).toBe(true);
  });
});

describe('verify-phase summary parsing (review F6, F7)', () => {
  it('reads files_modified from EVERY summary, not just the first', async () => {
    await mkdir(phaseDir, { recursive: true });
    await writeFile(
      contextPath,
      `# Phase 17 Context

<decisions>
### Cat
- **D-83:** A long-enough trackable decision text for soft matching honored elsewhere.
</decisions>
`,
      'utf-8',
    );
    await writeFile(
      join(phaseDir, '17-01-PLAN.md'),
      planFile(`  truths: []\n  artifacts: []\n  key_links: []`),
      'utf-8',
    );
    // Summary 01 — no files_modified mentioning D-83.
    await writeFile(
      join(phaseDir, '17-01-SUMMARY.md'),
      'files_modified:\n  - "src/unrelated.ts"\n',
      'utf-8',
    );
    // Summary 02 — files_modified entry whose content mentions D-83.
    await writeFile(
      join(phaseDir, '17-02-SUMMARY.md'),
      'files_modified:\n  - "src/keeper.ts"\n',
      'utf-8',
    );
    await mkdir(join(tmp, 'src'), { recursive: true });
    await writeFile(join(tmp, 'src', 'unrelated.ts'), '// nothing relevant\n', 'utf-8');
    await writeFile(join(tmp, 'src', 'keeper.ts'), '// honors D-83 in code\n', 'utf-8');
    const result = await checkDecisionCoverageVerify([phaseDir, contextPath], tmp);
    // If only the first SUMMARY were parsed, D-83 would be missing.
    expect(result.data.honored).toBe(1);
    expect(result.data.not_honored).toEqual([]);
  });

  it('rejects absolute files_modified paths outside projectDir (path traversal guard)', async () => {
    await mkdir(phaseDir, { recursive: true });
    await writeFile(
      contextPath,
      `# Phase 17

<decisions>
### Cat
- **D-84:** A trackable decision text spanning enough words to soft-match.
</decisions>
`,
      'utf-8',
    );
    await writeFile(
      join(phaseDir, '17-01-PLAN.md'),
      planFile(`  truths: []\n  artifacts: []\n  key_links: []`),
      'utf-8',
    );
    // Summary points at /etc/passwd and a parent-traversal path. Both must be skipped.
    await writeFile(
      join(phaseDir, '17-01-SUMMARY.md'),
      'files_modified:\n  - "/etc/passwd"\n  - "../../../etc/hostname"\n',
      'utf-8',
    );
    const result = await checkDecisionCoverageVerify([phaseDir, contextPath], tmp);
    // Should not honor D-84 from those files (and should not throw).
    expect(result.data.honored).toBe(0);
    expect(result.data.not_honored.map((u: { id: string }) => u.id)).toEqual(['D-84']);
  });
});

describe('workstream-aware config (review F3)', () => {
  it('honors workstream-scoped context_coverage_gate=false', async () => {
    await setupPhase(
      `<decisions>
### Cat
- **D-85:** A trackable decision long enough to potentially soft match.
</decisions>`,
      { '17-01-PLAN.md': planFile(`  truths: []\n  artifacts: []\n  key_links: []`) },
    );
    // Root config does NOT disable the gate.
    await mkdir(join(tmp, '.planning'), { recursive: true });
    await writeFile(
      join(tmp, '.planning', 'config.json'),
      JSON.stringify({ workflow: { context_coverage_gate: true } }),
      'utf-8',
    );
    // Workstream config DOES disable it.
    await mkdir(join(tmp, '.planning', 'workstreams', 'feat-x'), { recursive: true });
    await writeFile(
      join(tmp, '.planning', 'workstreams', 'feat-x', 'config.json'),
      JSON.stringify({ workflow: { context_coverage_gate: false } }),
      'utf-8',
    );

    // Without workstream → enabled → would fail
    const rootResult = await checkDecisionCoveragePlan([phaseDir, contextPath], tmp);
    expect(rootResult.data.skipped).toBe(false);
    expect(rootResult.data.passed).toBe(false);

    // With workstream → workstream config disables → skipped
    const wsResult = await checkDecisionCoveragePlan(
      [phaseDir, contextPath],
      tmp,
      'feat-x',
    );
    expect(wsResult.data.skipped).toBe(true);
    expect(wsResult.data.passed).toBe(true);

    // Same for verify
    const wsVerify = await checkDecisionCoverageVerify(
      [phaseDir, contextPath],
      tmp,
      'feat-x',
    );
    expect(wsVerify.data.skipped).toBe(true);
  });
});

describe('config-type validation (review F16)', () => {
  it('warns and defaults to ON when context_coverage_gate is a number', async () => {
    await setupPhase(
      `<decisions>
### Cat
- **D-86:** A trackable decision text long enough to soft-match.
</decisions>`,
      { '17-01-PLAN.md': planFile(`  truths: []\n  artifacts: []\n  key_links: []`) },
    );
    await mkdir(join(tmp, '.planning'), { recursive: true });
    await writeFile(
      join(tmp, '.planning', 'config.json'),
      JSON.stringify({ workflow: { context_coverage_gate: 1 } }),
      'utf-8',
    );

    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => warnings.push(String(msg));
    try {
      const result = await checkDecisionCoveragePlan([phaseDir, contextPath], tmp);
      // Defaulted to ON → not skipped, runs the gate (and fails with uncovered D-86).
      expect(result.data.skipped).toBe(false);
      expect(result.data.passed).toBe(false);
    } finally {
      console.warn = origWarn;
    }
    expect(warnings.some((w) => /context_coverage_gate.*invalid type/.test(w))).toBe(true);
  });
});
