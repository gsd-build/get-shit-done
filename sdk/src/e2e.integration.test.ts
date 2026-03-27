/**
 * E2E integration test — proves full SDK pipeline:
 * parse → prompt → query() → SUMMARY.md
 *
 * Requires Claude Code CLI (`claude`) installed and authenticated.
 * Skips gracefully if CLI is unavailable.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtemp, cp, rm, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { GSD, parsePlanFile, GSDEventType } from './index.js';
import type { GSDEvent } from './index.js';

// ─── CLI availability check ─────────────────────────────────────────────────

let cliAvailable = false;
try {
  execSync('which claude', { stdio: 'ignore' });
  cliAvailable = true;
} catch {
  cliAvailable = false;
}

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = join(__dirname, '..', 'test-fixtures');

// ─── Test suite ──────────────────────────────────────────────────────────────

describe.skipIf(!cliAvailable)('E2E: Single plan execution', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-sdk-e2e-'));
    // Copy fixture files to temp directory
    await cp(fixturesDir, tmpDir, { recursive: true });
  });

  afterAll(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('executes a single plan and returns a valid PlanResult', async () => {
    const gsd = new GSD({ projectDir: tmpDir, maxBudgetUsd: 1.0, maxTurns: 20 });
    const result = await gsd.executePlan('sample-plan.md');

    expect(result.success).toBe(true);
    expect(typeof result.sessionId).toBe('string');
    expect(result.sessionId.length).toBeGreaterThan(0);
    expect(result.totalCostUsd).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.numTurns).toBeGreaterThan(0);

    // Verify the plan's task was executed — output.txt should exist
    const outputPath = join(tmpDir, 'output.txt');
    const outputContent = await readFile(outputPath, 'utf-8');
    expect(outputContent).toContain('hello from gsd-sdk');
  }, 120_000); // 2 minute timeout for real CLI execution

  it('proves session isolation (R014) — different session IDs for sequential runs', async () => {
    // Create a second temp dir for isolation proof
    const tmpDir2 = await mkdtemp(join(tmpdir(), 'gsd-sdk-e2e-'));
    await cp(fixturesDir, tmpDir2, { recursive: true });

    try {
      const gsd1 = new GSD({ projectDir: tmpDir, maxBudgetUsd: 1.0, maxTurns: 20 });
      const gsd2 = new GSD({ projectDir: tmpDir2, maxBudgetUsd: 1.0, maxTurns: 20 });

      const result1 = await gsd1.executePlan('sample-plan.md');
      const result2 = await gsd2.executePlan('sample-plan.md');

      // Different sessions must have different session IDs
      expect(result1.sessionId).not.toBe(result2.sessionId);

      // Both should track cost independently
      expect(result1.totalCostUsd).toBeGreaterThanOrEqual(0);
      expect(result2.totalCostUsd).toBeGreaterThanOrEqual(0);
    } finally {
      await rm(tmpDir2, { recursive: true, force: true });
    }
  }, 240_000); // 4 minute timeout — two sequential runs
});

describe('E2E: Fixture validation (no CLI required)', () => {
  it('fixture PLAN.md is valid and parseable', async () => {
    const plan = await parsePlanFile(join(fixturesDir, 'sample-plan.md'));

    expect(plan.frontmatter.phase).toBe('01-test');
    expect(plan.frontmatter.plan).toBe('01');
    expect(plan.frontmatter.type).toBe('execute');
    expect(plan.frontmatter.wave).toBe(1);
    expect(plan.frontmatter.depends_on).toEqual([]);
    expect(plan.frontmatter.files_modified).toEqual(['output.txt']);
    expect(plan.frontmatter.autonomous).toBe(true);
    expect(plan.frontmatter.requirements).toEqual(['TEST-01']);
    expect(plan.frontmatter.must_haves.truths).toEqual(['output.txt exists with expected content']);

    expect(plan.objective).toContain('simple output file');
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].name).toBe('Create output file');
    expect(plan.tasks[0].type).toBe('auto');
    expect(plan.tasks[0].verify).toBe('test -f output.txt');
  });
});

describe.skipIf(!cliAvailable)('E2E: Event stream during plan execution (R007)', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-sdk-e2e-stream-'));
    await cp(fixturesDir, tmpDir, { recursive: true });
  });

  afterAll(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('event stream emits events during plan execution (R007)', async () => {
    const events: GSDEvent[] = [];
    const gsd = new GSD({ projectDir: tmpDir, maxBudgetUsd: 1.0, maxTurns: 20 });

    // Subscribe to all events
    gsd.onEvent((event) => {
      events.push(event);
    });

    const result = await gsd.executePlan('sample-plan.md');
    expect(result.success).toBe(true);

    // (a) At least one session_init event received
    const initEvents = events.filter(e => e.type === GSDEventType.SessionInit);
    expect(initEvents.length).toBeGreaterThanOrEqual(1);

    // (b) At least one tool_call event received
    const toolCallEvents = events.filter(e => e.type === GSDEventType.ToolCall);
    expect(toolCallEvents.length).toBeGreaterThanOrEqual(1);

    // (c) Exactly one session_complete event with cost >= 0
    const completeEvents = events.filter(e => e.type === GSDEventType.SessionComplete);
    expect(completeEvents).toHaveLength(1);
    const completeEvent = completeEvents[0]!;
    if (completeEvent.type === GSDEventType.SessionComplete) {
      expect(completeEvent.totalCostUsd).toBeGreaterThanOrEqual(0);
    }

    // (d) Events arrived in order: session_init before tool_call before session_complete
    const initIdx = events.findIndex(e => e.type === GSDEventType.SessionInit);
    const toolCallIdx = events.findIndex(e => e.type === GSDEventType.ToolCall);
    const completeIdx = events.findIndex(e => e.type === GSDEventType.SessionComplete);
    expect(initIdx).toBeLessThan(toolCallIdx);
    expect(toolCallIdx).toBeLessThan(completeIdx);

    // Bonus: at least one cost_update event was emitted
    const costEvents = events.filter(e => e.type === GSDEventType.CostUpdate);
    expect(costEvents.length).toBeGreaterThanOrEqual(1);
  }, 120_000);
});

describe('E2E: Error handling', () => {
  it('returns failure for nonexistent plan path', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gsd-sdk-e2e-err-'));

    try {
      const gsd = new GSD({ projectDir: tmpDir });
      await expect(gsd.executePlan('nonexistent-plan.md')).rejects.toThrow();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
