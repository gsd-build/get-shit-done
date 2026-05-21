/**
 * Tests for isPhaseUatPassed across UAT result classification paths.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isPhaseUatPassed, REASON_CODE, PhaseUatPassedError, ERROR_CODE } from './phase-uat-passed.js';
import { createRegistry } from './index.js';

const UAT_PASS_CONTENT = `---
status: complete
phase: 5
source: roadmap
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
---

### 1. First item
expected: thing should happen
result: pass
`;

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-uat-passed-'));
  const phaseDir = join(tmpDir, '.planning', 'phases', '05-walking-skeleton');
  await mkdir(phaseDir, { recursive: true });
  await writeFile(join(phaseDir, '05-HUMAN-UAT.md'), UAT_PASS_CONTENT);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('isPhaseUatPassed', () => {
  it('returns passed=true when a single UAT file contains one pass result', async () => {
    const result = await isPhaseUatPassed(tmpDir, '5');
    expect(result.passed).toBe(true);
    expect(result.items.length).toBe(1);
    expect(result.items[0].result).toBe('pass');
    expect(result.reasons.length).toBe(0);
  });

  it('returns passed=false with NO_UAT_FILES reason when phase dir has no UAT files', async () => {
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-c4-'));
    try {
      const phaseDir = join(localTmp, '.planning', 'phases', '05-empty');
      await mkdir(phaseDir, { recursive: true });
      // Write a non-UAT file to ensure the dir exists but has no *-HUMAN-UAT.md
      await writeFile(join(phaseDir, '05-PLAN.md'), '# Plan\nNothing here.\n');

      const result = await isPhaseUatPassed(localTmp, '5');
      expect(result.passed).toBe(false);
      expect(result.items.length).toBe(0);
      expect(result.reasons.length).toBe(1);
      expect(result.reasons[0].code).toBe(REASON_CODE.NO_UAT_FILES);
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it('returns passed=false with NO_PHASE_DIR reason when phase has no directory', async () => {
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-c3-'));
    try {
      const otherPhaseDir = join(localTmp, '.planning', 'phases', '06-other');
      await mkdir(otherPhaseDir, { recursive: true });
      await writeFile(join(otherPhaseDir, '06-HUMAN-UAT.md'), UAT_PASS_CONTENT);

      // Query phase 5 which has NO directory in this fixture
      const result = await isPhaseUatPassed(localTmp, '5');
      expect(result.passed).toBe(false);
      expect(result.items.length).toBe(0);
      expect(result.reasons.length).toBe(1);
      expect(result.reasons[0].code).toBe(REASON_CODE.NO_PHASE_DIR);
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it('returns passed=false with NON_PASS_RESULT reason when single UAT item has result: issue', async () => {
    const nonPassContent = `---
status: complete
phase: 5
source: roadmap
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
---

### 1. Some item
expected: thing happens
result: issue
`;
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-c2-'));
    try {
      const phaseDir = join(localTmp, '.planning', 'phases', '05-non-pass');
      await mkdir(phaseDir, { recursive: true });
      await writeFile(join(phaseDir, '05-HUMAN-UAT.md'), nonPassContent);

      const result = await isPhaseUatPassed(localTmp, '5');
      expect(result.passed).toBe(false);
      expect(result.items.length).toBe(1);
      expect(result.reasons.length).toBe(1);
      expect(result.reasons[0].code).toBe(REASON_CODE.NON_PASS_RESULT);
      expect(result.reasons[0].capturedValue).toBe('issue');
      expect(result.reasons[0].itemName).toBe('Some item');
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it('ignores ### item content inside YAML frontmatter region', async () => {
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-c5-'));
    try {
      const phaseDir = join(localTmp, '.planning', 'phases', '05-frontmatter-injection');
      await mkdir(phaseDir, { recursive: true });
      const content = `---
status: complete
phase: 5
source: roadmap
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
malicious_demo: |
### 1. Frontmatter-injected item
expected: nothing
result: pass
---

### 1. Real item
expected: real thing
result: pass
`;
      await writeFile(join(phaseDir, '05-HUMAN-UAT.md'), content);

      const result = await isPhaseUatPassed(localTmp, '5');
      expect(result.passed).toBe(true);
      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe('Real item');
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it('ignores ### item content inside fenced code blocks', async () => {
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-c6-'));
    try {
      const phaseDir = join(localTmp, '.planning', 'phases', '05-fenced-injection');
      await mkdir(phaseDir, { recursive: true });
      const content = `---
status: complete
phase: 5
source: roadmap
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
---

Some prose.

\`\`\`markdown
### 1. Fenced example
expected: blah
result: pass
\`\`\`

### 1. Real item
expected: real
result: pass
`;
      await writeFile(join(phaseDir, '05-HUMAN-UAT.md'), content);

      const result = await isPhaseUatPassed(localTmp, '5');
      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe('Real item');
      expect(result.passed).toBe(true);
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it('ignores ### item content inside HTML comments', async () => {
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-c7-'));
    try {
      const phaseDir = join(localTmp, '.planning', 'phases', '05-html-comment-injection');
      await mkdir(phaseDir, { recursive: true });
      const content = `---
status: complete
phase: 5
source: roadmap
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
---

<!--
### 1. Commented-out item
expected: blah
result: pass
-->

### 1. Real item
expected: real
result: pass
`;
      await writeFile(join(phaseDir, '05-HUMAN-UAT.md'), content);

      const result = await isPhaseUatPassed(localTmp, '5');
      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe('Real item');
      expect(result.passed).toBe(true);
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it('ignores ### item content on blockquote-prefixed lines', async () => {
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-c8-'));
    try {
      const phaseDir = join(localTmp, '.planning', 'phases', '05-blockquote-injection');
      await mkdir(phaseDir, { recursive: true });
      const content = `---
status: complete
phase: 5
source: roadmap
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
---

> ### 1. Quoted item
expected: blah
result: pass

### 1. Real item
expected: real
result: pass
`;
      await writeFile(join(phaseDir, '05-HUMAN-UAT.md'), content);

      const result = await isPhaseUatPassed(localTmp, '5');
      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe('Real item');
      expect(result.passed).toBe(true);
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it('parses bold-prefixed **result:** key as equivalent to bare result:', async () => {
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-c9-'));
    try {
      const phaseDir = join(localTmp, '.planning', 'phases', '05-bold-key');
      await mkdir(phaseDir, { recursive: true });
      const content = `---
status: complete
phase: 5
source: roadmap
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
---

### 1. Bold-key item
expected: thing
**result:** pass
`;
      await writeFile(join(phaseDir, '05-HUMAN-UAT.md'), content);

      const result = await isPhaseUatPassed(localTmp, '5');
      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe('Bold-key item');
      expect(result.items[0].result).toBe('pass');
      expect(result.passed).toBe(true);
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it("human_verification items in frontmatter contribute HUMAN_VERIFICATION_NEEDED reasons", async () => {
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-c11-'));
    try {
      const phaseDir = join(localTmp, '.planning', 'phases', '05-human-verification');
      await mkdir(phaseDir, { recursive: true });
      const content = `---
status: complete
phase: 5
source: roadmap
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
human_verification:
  - name: manual smoke test
    expected: app loads
---

### 1. Real pass
expected: thing
result: pass
`;
      await writeFile(join(phaseDir, '05-HUMAN-UAT.md'), content);

      const result = await isPhaseUatPassed(localTmp, '5');
      expect(result.passed).toBe(false);
      expect(result.items.length).toBe(2);
      expect(result.reasons.length).toBe(1);
      expect(result.reasons[0].code).toBe(REASON_CODE.HUMAN_VERIFICATION_NEEDED);
      expect(result.reasons[0].itemName).toBe('manual smoke test');
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it("throws PhaseUatPassedError with PROJECT_DIR_MISSING code when projectDir does not exist", async () => {
    const missingPath = `/nonexistent/path/that/should/never/be/real-${Date.now()}`;
    let thrown: unknown;
    try {
      await isPhaseUatPassed(missingPath, '5');
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(PhaseUatPassedError);
    expect((thrown as PhaseUatPassedError).code).toBe(ERROR_CODE.PROJECT_DIR_MISSING);
  });

  it("emits NO_ITEMS_EXTRACTED reason when UAT file has no parseable items, orphans, or placeholders", async () => {
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-c14-'));
    try {
      const phaseDir = join(localTmp, '.planning', 'phases', '05-no-items');
      await mkdir(phaseDir, { recursive: true });
      const content = `---
status: complete
phase: 5
source: roadmap
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
---

This phase doesn't have any UAT items yet.
Prose only.
`;
      await writeFile(join(phaseDir, '05-HUMAN-UAT.md'), content);

      const result = await isPhaseUatPassed(localTmp, '5');
      expect(result.passed).toBe(false);
      expect(result.items.length).toBe(0);
      expect(result.reasons.length).toBe(1);
      expect(result.reasons[0].code).toBe(REASON_CODE.NO_ITEMS_EXTRACTED);
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it("emits BRACKETED_PLACEHOLDER reason when result value is wrapped in brackets", async () => {
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-c13-'));
    try {
      const phaseDir = join(localTmp, '.planning', 'phases', '05-bracketed-placeholder');
      await mkdir(phaseDir, { recursive: true });
      const content = `---
status: complete
phase: 5
source: roadmap
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
---

### 1. Forgot to fill in result
expected: thing
result: [pending]
`;
      await writeFile(join(phaseDir, '05-HUMAN-UAT.md'), content);

      const result = await isPhaseUatPassed(localTmp, '5');
      expect(result.passed).toBe(false);
      expect(result.items.length).toBe(0);
      expect(result.reasons.length).toBe(1);
      expect(result.reasons[0].code).toBe(REASON_CODE.BRACKETED_PLACEHOLDER);
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it("emits ORPHAN_ITEM_MISSING_RESULT reason for headings missing the result field", async () => {
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-c12-'));
    try {
      const phaseDir = join(localTmp, '.planning', 'phases', '05-orphan-heading');
      await mkdir(phaseDir, { recursive: true });
      const content = `---
status: complete
phase: 5
source: roadmap
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
---

### 1. Forgot to fill this in
expected: something

### 2. Real one
expected: works
result: pass
`;
      await writeFile(join(phaseDir, '05-HUMAN-UAT.md'), content);

      const result = await isPhaseUatPassed(localTmp, '5');
      expect(result.passed).toBe(false);
      expect(result.items.length).toBe(1);
      expect(result.reasons.length).toBe(1);
      expect(result.reasons[0].code).toBe(REASON_CODE.ORPHAN_ITEM_MISSING_RESULT);
      expect(result.reasons[0].itemName).toBe('Forgot to fill this in');
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it("emits CASE_MISMATCH reason when result value is \"PASS\" (uppercase variant of pass)", async () => {
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-c10-'));
    try {
      const phaseDir = join(localTmp, '.planning', 'phases', '05-case-mismatch');
      await mkdir(phaseDir, { recursive: true });
      const content = `---
status: complete
phase: 5
source: roadmap
started: 2026-05-18T00:00:00Z
updated: 2026-05-18T00:00:00Z
---

### 1. Uppercase pass item
expected: thing happens
result: PASS
`;
      await writeFile(join(phaseDir, '05-HUMAN-UAT.md'), content);

      const result = await isPhaseUatPassed(localTmp, '5');
      expect(result.passed).toBe(false);
      expect(result.items.length).toBe(1);
      expect(result.reasons.length).toBe(1);
      expect(result.reasons[0].code).toBe(REASON_CODE.CASE_MISMATCH);
      expect(result.reasons[0].capturedValue).toBe('PASS');
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it('preserves UAT body content when file contains an internal --- horizontal rule', async () => {
    // Regression: frontmatter regex with /m flag treated mid-body --- as a
    // second frontmatter block and stripped everything between them.
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-hrule-'));
    try {
      const phaseDir = join(localTmp, '.planning', 'phases', '05-hrule');
      await mkdir(phaseDir, { recursive: true });
      const content = `---
status: complete
phase: 5
---

### 1. Item above rule
expected: works
result: pass

---

### 2. Item below rule
expected: also works
result: pass
`;
      await writeFile(join(phaseDir, '05-HUMAN-UAT.md'), content);

      const result = await isPhaseUatPassed(localTmp, '5');
      expect(result.passed).toBe(true);
      expect(result.items.length).toBe(2);
      expect(result.items[0].name).toBe('Item above rule');
      expect(result.items[1].name).toBe('Item below rule');
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it('aggregates items and reasons across multiple UAT files in the same phase', async () => {
    // Finding #4: multiple *-HUMAN-UAT.md files — all-pass + one failure
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-multi-'));
    try {
      const phaseDir = join(localTmp, '.planning', 'phases', '05-multi');
      await mkdir(phaseDir, { recursive: true });

      const passFile = `---
status: complete
phase: 5
---

### 1. Passing check
expected: it works
result: pass
`;
      const failFile = `---
status: complete
phase: 5
---

### 1. Failing check
expected: it works
result: issue

### 2. Another pass
expected: also works
result: pass
`;
      await writeFile(join(phaseDir, '05a-HUMAN-UAT.md'), passFile);
      await writeFile(join(phaseDir, '05b-HUMAN-UAT.md'), failFile);

      const result = await isPhaseUatPassed(localTmp, '5');
      // Total items: 1 from first file + 2 from second file
      expect(result.items.length).toBe(3);
      // One NON_PASS_RESULT reason from the failing item
      expect(result.reasons.length).toBe(1);
      expect(result.reasons[0].code).toBe(REASON_CODE.NON_PASS_RESULT);
      expect(result.passed).toBe(false);
      // reasonsHuman must be non-empty
      expect(result.reasonsHuman.length).toBe(1);
      expect(typeof result.reasonsHuman[0]).toBe('string');
      expect(result.reasonsHuman[0].length).toBeGreaterThan(0);
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it('throws PhaseUatPassedError with INVALID_PHASE_NUM when phase arg is empty', async () => {
    // Finding #5: INVALID_PHASE_NUM error path via phaseUatPassed handler
    const { phaseUatPassed, ERROR_CODE: EC } = await import('./phase-uat-passed.js');
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-invalidphase-'));
    try {
      let thrown: unknown;
      try {
        await phaseUatPassed([], localTmp);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(PhaseUatPassedError);
      expect((thrown as PhaseUatPassedError).code).toBe(EC.INVALID_PHASE_NUM);
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });

  it('resolves isPhaseUatPassed via workstream routing', async () => {
    // Finding #6: workstream-keyed project under .planning/workstreams/ws1/phases/
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-ws-'));
    try {
      const wsPhaseDir = join(localTmp, '.planning', 'workstreams', 'ws1', 'phases', '05-ws-phase');
      await mkdir(wsPhaseDir, { recursive: true });
      const content = `---
status: complete
phase: 5
---

### 1. WS item
expected: works in workstream
result: pass
`;
      await writeFile(join(wsPhaseDir, '05-HUMAN-UAT.md'), content);

      const result = await isPhaseUatPassed(localTmp, '5', 'ws1');
      expect(result.passed).toBe(true);
      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe('WS item');
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });
});

describe('phase.uat-passed registry wire-up (cycle 16)', () => {
  it('phase.uat-passed is registered and dispatchable through the query registry', async () => {
    const localTmp = await mkdtemp(join(tmpdir(), 'gsd-uat-c16-'));
    try {
      const phaseDir = join(localTmp, '.planning', 'phases', '05-walking-skeleton');
      await mkdir(phaseDir, { recursive: true });
      await writeFile(join(phaseDir, '05-HUMAN-UAT.md'), UAT_PASS_CONTENT);

      const registry = createRegistry();

      // The handler must be found — if not registered, this returns undefined.
      expect(registry.has('phase.uat-passed'), 'phase.uat-passed handler not found in registry').toBe(true);

      // Dispatch via the real registry path; args[0] is the phase token.
      const result = await registry.dispatch('phase.uat-passed', ['5'], localTmp);

      const data = result.data as { passed: boolean; items: Array<Record<string, unknown>>; reasons: unknown[] };
      expect(data.passed).toBe(true);
      expect(data.items.length).toBe(1);
      expect(data.items[0].result).toBe('pass');
    } finally {
      await rm(localTmp, { recursive: true, force: true });
    }
  });
});
