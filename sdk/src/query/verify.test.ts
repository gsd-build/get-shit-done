/**
 * Unit tests for verification query handlers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GSDError } from '../errors.js';
import { verifyPlanStructure, verifyPhaseCompleteness, verifyArtifacts } from './verify.js';

// ─── verifyPlanStructure ───────────────────────────────────────────────────

describe('verifyPlanStructure', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-verify-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns valid for plan with all required fields and task elements', async () => {
    const plan = `---
phase: 12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/foo.ts
autonomous: true
must_haves:
  truths:
    - something works
---

<task type="auto">
  <name>Task 1: Do something</name>
  <files>src/foo.ts</files>
  <action>Implement foo</action>
  <verify>Run tests</verify>
  <done>Foo works</done>
</task>
`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyPlanStructure(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.valid).toBe(true);
    expect(data.errors).toEqual([]);
    expect(data.task_count).toBe(1);
    expect(data.frontmatter_fields).toContain('phase');
  });

  it('returns invalid when required frontmatter field wave is missing', async () => {
    const plan = `---
phase: 12
plan: 01
type: execute
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - something
---

<task type="auto">
  <name>Task 1</name>
  <action>Do it</action>
</task>
`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyPlanStructure(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.valid).toBe(false);
    expect(data.errors).toContain('Missing required frontmatter field: wave');
  });

  it('returns error when task missing <name> element', async () => {
    const plan = `---
phase: 12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - x
---

<task type="auto">
  <action>Do something</action>
</task>
`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyPlanStructure(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.valid).toBe(false);
    expect(data.errors).toContain('Task missing <name> element');
  });

  it('returns error when task missing <action> element', async () => {
    const plan = `---
phase: 12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - x
---

<task type="auto">
  <name>Task 1</name>
  <done>Done</done>
</task>
`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyPlanStructure(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.valid).toBe(false);
    expect((data.errors as string[])).toContainEqual(expect.stringContaining("missing <action>"));
  });

  it('returns warning when wave > 1 but depends_on is empty', async () => {
    const plan = `---
phase: 12
plan: 01
type: execute
wave: 2
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - x
---

<task type="auto">
  <name>Task 1</name>
  <action>Do it</action>
</task>
`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyPlanStructure(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.warnings).toContain('Wave > 1 but depends_on is empty');
  });

  it('returns error when checkpoint task present but autonomous is not false', async () => {
    const plan = `---
phase: 12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - x
---

<task type="checkpoint:human-verify">
  <name>Check it</name>
  <action>Verify</action>
</task>
`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyPlanStructure(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.valid).toBe(false);
    expect(data.errors).toContain('Has checkpoint tasks but autonomous is not false');
  });

  it('returns warning when no tasks found', async () => {
    const plan = `---
phase: 12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - x
---

No tasks here.
`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyPlanStructure(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.warnings).toContain('No <task> elements found');
  });

  it('returns error for missing file', async () => {
    const result = await verifyPlanStructure(['nonexistent.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBe('File not found');
  });

  it('throws GSDError with Validation classification when no args', async () => {
    let caught: unknown;
    try {
      await verifyPlanStructure([], tmpDir);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(GSDError);
    expect((caught as GSDError).classification).toBe('validation');
  });
});

// ─── verifyPhaseCompleteness ───────────────────────────────────────────────

describe('verifyPhaseCompleteness', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-verify-phase-'));
    await mkdir(join(tmpDir, '.planning', 'phases', '09-foundation'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns complete when all plans have matching summaries', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '09-foundation');
    await writeFile(join(phaseDir, '09-01-PLAN.md'), '---\nphase: 09\n---\n');
    await writeFile(join(phaseDir, '09-02-PLAN.md'), '---\nphase: 09\n---\n');
    await writeFile(join(phaseDir, '09-01-SUMMARY.md'), '# Summary\n');
    await writeFile(join(phaseDir, '09-02-SUMMARY.md'), '# Summary\n');

    const result = await verifyPhaseCompleteness(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.complete).toBe(true);
    expect(data.plan_count).toBe(2);
    expect(data.summary_count).toBe(2);
  });

  it('returns incomplete when plan is missing summary', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '09-foundation');
    await writeFile(join(phaseDir, '09-01-PLAN.md'), '---\nphase: 09\n---\n');
    await writeFile(join(phaseDir, '09-02-PLAN.md'), '---\nphase: 09\n---\n');
    await writeFile(join(phaseDir, '09-01-SUMMARY.md'), '# Summary\n');

    const result = await verifyPhaseCompleteness(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.complete).toBe(false);
    expect(data.incomplete_plans).toContain('09-02');
  });

  it('returns warning for orphan summary', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '09-foundation');
    await writeFile(join(phaseDir, '09-01-PLAN.md'), '---\nphase: 09\n---\n');
    await writeFile(join(phaseDir, '09-01-SUMMARY.md'), '# Summary\n');
    await writeFile(join(phaseDir, '09-99-SUMMARY.md'), '# Orphan\n');

    const result = await verifyPhaseCompleteness(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect((data.orphan_summaries as string[])).toContain('09-99');
    expect((data.warnings as string[]).some(w => w.includes('09-99'))).toBe(true);
  });

  it('returns error for phase not found', async () => {
    const result = await verifyPhaseCompleteness(['99'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBe('Phase not found');
  });

  it('throws GSDError with Validation classification when no args', async () => {
    await expect(verifyPhaseCompleteness([], tmpDir)).rejects.toThrow(GSDError);
  });
});

// ─── verifyArtifacts ───────────────────────────────────────────────────────

describe('verifyArtifacts', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-verify-art-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns all_passed when all artifacts exist and pass checks', async () => {
    await writeFile(join(tmpDir, 'src.ts'), 'export function foo() {}\nexport function bar() {}\nline3\nline4\nline5\n');
    const plan = `---
phase: 12
must_haves:
  artifacts:
    - path: src.ts
      provides: Foo handler
      min_lines: 3
      contains: export function foo
      exports:
        - foo
        - bar
---
body`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyArtifacts(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.all_passed).toBe(true);
    expect(data.passed).toBe(1);
    expect(data.total).toBe(1);
  });

  it('returns passed false when artifact file does not exist', async () => {
    const plan = `---
phase: 12
must_haves:
  artifacts:
    - path: nonexistent.ts
      provides: Something
---
body`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyArtifacts(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.all_passed).toBe(false);
    const artifacts = data.artifacts as Array<Record<string, unknown>>;
    expect(artifacts[0].passed).toBe(false);
    expect((artifacts[0].issues as string[])).toContain('File not found');
  });

  it('returns issue when min_lines check fails', async () => {
    await writeFile(join(tmpDir, 'short.ts'), 'line1\nline2\n');
    const plan = `---
phase: 12
must_haves:
  artifacts:
    - path: short.ts
      min_lines: 100
---
body`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyArtifacts(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.all_passed).toBe(false);
    const artifacts = data.artifacts as Array<Record<string, unknown>>;
    expect((artifacts[0].issues as string[])[0]).toContain('lines');
  });

  it('returns issue when contains check fails', async () => {
    await writeFile(join(tmpDir, 'file.ts'), 'const x = 1;\n');
    const plan = `---
phase: 12
must_haves:
  artifacts:
    - path: file.ts
      contains: export function missing
---
body`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyArtifacts(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.all_passed).toBe(false);
    const artifacts = data.artifacts as Array<Record<string, unknown>>;
    expect((artifacts[0].issues as string[])[0]).toContain('Missing pattern');
  });

  it('returns issue when exports check fails', async () => {
    await writeFile(join(tmpDir, 'file.ts'), 'export function foo() {}\n');
    const plan = `---
phase: 12
must_haves:
  artifacts:
    - path: file.ts
      exports:
        - foo
        - missingExport
---
body`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyArtifacts(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.all_passed).toBe(false);
    const artifacts = data.artifacts as Array<Record<string, unknown>>;
    expect((artifacts[0].issues as string[]).some(i => i.includes('missingExport'))).toBe(true);
  });

  it('returns error when no must_haves.artifacts found', async () => {
    const plan = `---
phase: 12
must_haves:
  truths:
    - something
---
body`;
    await writeFile(join(tmpDir, 'plan.md'), plan);
    const result = await verifyArtifacts(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBe('No must_haves.artifacts found in frontmatter');
  });

  it('throws GSDError with Validation classification when no args', async () => {
    await expect(verifyArtifacts([], tmpDir)).rejects.toThrow(GSDError);
  });
});
