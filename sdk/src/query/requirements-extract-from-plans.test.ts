/**
 * Unit tests for requirements.extract-from-plans.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { requirementsExtractFromPlans } from './requirements-extract-from-plans.js';

const P1 = `---
phase: 09-foundation
requirements:
  - REQ-A
  - REQ-B
---

<objective>
O
</objective>
<tasks><task type="auto"><name>T</name></task></tasks>
`;

const P2 = `---
phase: 09-foundation
requirements:
  - REQ-B
---

<objective>
O2
</objective>
<tasks><task type="auto"><name>T</name></task></tasks>
`;

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-req-'));
  const phaseDir = join(tmpDir, '.planning', 'phases', '09-foundation');
  await mkdir(phaseDir, { recursive: true });
  await writeFile(join(phaseDir, '09-01-PLAN.md'), P1);
  await writeFile(join(phaseDir, '09-02-PLAN.md'), P2);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('requirementsExtractFromPlans', () => {
  it('dedupes requirements across plans', async () => {
    const r = await requirementsExtractFromPlans(['9'], tmpDir);
    const d = r.data as { requirements: string[]; by_plan: Record<string, string[]> };
    expect(d.requirements.sort()).toEqual(['REQ-A', 'REQ-B']);
    expect(d.by_plan['09-01'].sort()).toEqual(['REQ-A', 'REQ-B']);
    expect(d.by_plan['09-02']).toEqual(['REQ-B']);
  });
});
