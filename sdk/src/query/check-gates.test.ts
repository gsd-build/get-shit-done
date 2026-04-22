/**
 * Unit tests for `check.gates` (decision-routing audit §3.2).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkGates } from './check-gates.js';

describe('checkGates', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(tmpdir(), `gsd-check-gates-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(projectDir, '.planning', 'phases'), { recursive: true });
    // Write a clean STATE.md
    await writeFile(
      join(projectDir, '.planning', 'STATE.md'),
      '---\nstatus: active\n---\n\n# Project State\n\nStatus: active\n',
      'utf-8',
    );
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('throws when workflow name arg is missing', async () => {
    await expect(checkGates([], projectDir)).rejects.toThrow();
  });

  it('returns passed true when no blockers exist', async () => {
    const { data } = await checkGates(['execute-phase'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.passed).toBe(true);
    expect(d.blockers).toEqual([]);
  });

  it('returns blocker when .continue-here.md is present in root', async () => {
    await writeFile(join(projectDir, '.continue-here.md'), '# Continue here', 'utf-8');

    const { data } = await checkGates(['execute-phase'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.passed).toBe(false);
    const blockers = d.blockers as Array<Record<string, unknown>>;
    expect(blockers.length).toBeGreaterThan(0);
    expect(blockers[0].gate).toBe('continue-here');
    expect(blockers[0].severity).toBe('blocking');
  });

  it('returns blocker when STATE.md has status: failed', async () => {
    await writeFile(
      join(projectDir, '.planning', 'STATE.md'),
      '---\nstatus: failed\n---\n\n# Project State\n',
      'utf-8',
    );

    const { data } = await checkGates(['execute-phase'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.passed).toBe(false);
    const blockers = d.blockers as Array<Record<string, unknown>>;
    const stateBlocker = blockers.find(b => b.gate === 'state-error');
    expect(stateBlocker).toBeDefined();
  });

  it('returns blocker when STATE.md has status: error', async () => {
    await writeFile(
      join(projectDir, '.planning', 'STATE.md'),
      '---\nstatus: error\n---\n\n# Project State\n',
      'utf-8',
    );

    const { data } = await checkGates(['execute-phase'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.passed).toBe(false);
    const blockers = d.blockers as Array<Record<string, unknown>>;
    const stateBlocker = blockers.find(b => b.gate === 'state-error');
    expect(stateBlocker).toBeDefined();
  });

  it('includes warnings shape in result', async () => {
    const { data } = await checkGates(['execute-phase'], projectDir);
    const d = data as Record<string, unknown>;
    expect(Array.isArray(d.warnings)).toBe(true);
  });

  it('returns verification-debt warning when phase VERIFICATION.md has FAIL rows', async () => {
    const phaseDir = join(projectDir, '.planning', 'phases', '01-foundation');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(
      join(phaseDir, 'VERIFICATION.md'),
      '| T-01 | Auth works | FAIL |\n| T-02 | User model | PASS |\n',
      'utf-8',
    );

    const { data } = await checkGates(['execute-phase', '--phase', '1'], projectDir);
    const d = data as Record<string, unknown>;
    const warnings = d.warnings as Array<Record<string, unknown>>;
    const debtWarning = warnings.find(w => w.gate === 'verification-debt');
    expect(debtWarning).toBeDefined();
  });
});
