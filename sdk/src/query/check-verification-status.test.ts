/**
 * Unit tests for `check.verification-status` (decision-routing audit §3.8).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkVerificationStatus } from './check-verification-status.js';

describe('checkVerificationStatus', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(tmpdir(), `gsd-check-ver-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(projectDir, '.planning', 'phases'), { recursive: true });
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('throws when phase arg is missing', async () => {
    await expect(checkVerificationStatus([], projectDir)).rejects.toThrow();
  });

  it('returns status missing when VERIFICATION.md does not exist', async () => {
    await mkdir(join(projectDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const { data } = await checkVerificationStatus(['1'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.status).toBe('missing');
    expect(d.score).toBeNull();
    expect(d.gaps).toEqual([]);
    expect(d.human_items).toEqual([]);
    expect(d.deferred).toEqual([]);
  });

  it('returns status pass when all rows are PASS', async () => {
    const phaseDir = join(projectDir, '.planning', 'phases', '02-core');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(
      join(phaseDir, 'VERIFICATION.md'),
      [
        '---',
        'status: passed',
        '---',
        '',
        '| ID | Description | Status | Notes |',
        '|---|---|---|---|',
        '| T-01 | Auth works | PASS | |',
        '| T-02 | User model | PASS | |',
        '| T-03 | API endpoint | PASS | |',
      ].join('\n'),
      'utf-8',
    );

    const { data } = await checkVerificationStatus(['2'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.status).toBe('pass');
    expect(d.gaps).toEqual([]);
  });

  it('returns status fail with gaps when FAIL rows present', async () => {
    const phaseDir = join(projectDir, '.planning', 'phases', '03-api');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(
      join(phaseDir, 'VERIFICATION.md'),
      [
        '| ID | Description | Status | Notes |',
        '|---|---|---|---|',
        '| T-01 | Auth works | PASS | |',
        '| T-02 | Error handling | FAIL | Missing 500 handler |',
        '| T-03 | API endpoint | PASS | |',
      ].join('\n'),
      'utf-8',
    );

    const { data } = await checkVerificationStatus(['3'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.status).toBe('fail');
    expect((d.gaps as string[]).length).toBeGreaterThan(0);
  });

  it('returns score as fraction string', async () => {
    const phaseDir = join(projectDir, '.planning', 'phases', '04-ui');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(
      join(phaseDir, 'VERIFICATION.md'),
      [
        '| ID | Description | Status | Notes |',
        '|---|---|---|---|',
        '| T-01 | Feature A | PASS | |',
        '| T-02 | Feature B | PASS | |',
        '| T-03 | Feature C | FAIL | |',
        '| T-04 | Feature D | PASS | |',
      ].join('\n'),
      'utf-8',
    );

    const { data } = await checkVerificationStatus(['4'], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.score).toBe('3/4');
  });

  it('collects human_items when type column contains human', async () => {
    const phaseDir = join(projectDir, '.planning', 'phases', '05-test');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(
      join(phaseDir, 'VERIFICATION.md'),
      [
        '| ID | Description | Type | Status | Notes |',
        '|---|---|---|---|---|',
        '| T-01 | API returns 200 | truth | PASS | |',
        '| T-02 | UI looks correct | human | PASS | Manual check |',
      ].join('\n'),
      'utf-8',
    );

    const { data } = await checkVerificationStatus(['5'], projectDir);
    const d = data as Record<string, unknown>;
    expect((d.human_items as string[]).length).toBeGreaterThan(0);
  });

  it('collects deferred items when notes column contains deferred', async () => {
    const phaseDir = join(projectDir, '.planning', 'phases', '06-misc');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(
      join(phaseDir, 'VERIFICATION.md'),
      [
        '| ID | Description | Status | Notes |',
        '|---|---|---|---|',
        '| T-01 | Feature A | PASS | |',
        '| T-02 | Perf test | PASS | deferred to phase 8 |',
      ].join('\n'),
      'utf-8',
    );

    const { data } = await checkVerificationStatus(['6'], projectDir);
    const d = data as Record<string, unknown>;
    expect((d.deferred as string[]).length).toBeGreaterThan(0);
  });
});
